import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { buildExecutionSettings, executeToolCalls, executionToolDefinitions } from "./tools.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const db = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
const corsHeaders={"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type, x-projectx-worker-token","Access-Control-Allow-Methods":"POST, OPTIONS"};
const MAX_BATCH = 5;
const DEFAULT_TIMEOUT_SECONDS = 120;
const MAX_TIMEOUT_SECONDS = 300;

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}
async function authorized(req: Request) {
  const token = req.headers.get("X-ProjectX-Worker-Token") || "";
  if (!token) return false;
  const { data, error } = await db.rpc("projectx_worker_token_valid", { p_token: token });
  return !error && data === true;
}
async function workerToken() {
  const { data, error } = await db.rpc("projectx_worker_token_get");
  if (error || !data) throw new Error("Worker secret unavailable");
  return String(data);
}
async function isCancelled(jobId: string) {
  const { data, error } = await db.from("job_queue").select("status,cancel_requested").eq("id", jobId).maybeSingle();
  if (error) throw error;
  return data?.status === "cancelled" || Boolean(data?.cancel_requested);
}
async function loadProject(projectId: string) {
  const { data, error } = await db.from("projects").select("id,spec_version,project_type,settings,status").eq("id", projectId).maybeSingle();
  if (error) throw error;
  if (!data) throw new Error("Project not found");
  const { data: files, error: fe } = await db.from("project_files").select("path,content").eq("project_id", projectId).order("path");
  if (fe) throw fe;
  return { ...data, specVersion:Number(data.spec_version || 1), type:String(data.project_type || "Other"), files:Object.fromEntries((files || []).map((f:any)=>[String(f.path),String(f.content ?? "")])), settings:data.settings && typeof data.settings==="object" ? data.settings : {} };
}
async function commitExecution(project:any,userId:string,job:any,action:any,executor:string,status:string,settings:any,ops:any[],event:string,tool:string|null,message:string,evidence:any[]) {
  const { data, error } = await db.rpc("commit_project_execution", { p_project_id:project.id,p_user_id:userId,p_base_version:Number(project.specVersion||1),p_job_id:job.id,p_action_id:String(action?.id||""),p_executor:executor,p_status:status,p_settings:settings,p_file_operations:ops,p_event:event,p_tool:tool,p_message:message,p_evidence:evidence.slice(0,20) });
  if (error) throw error;
  return data;
}
async function invokeAI(token:string,job:any,project:any,contract:any) {
  const controller = new AbortController();
  const seconds = Math.max(10,Math.min(MAX_TIMEOUT_SECONDS,Number(job.timeout_seconds || DEFAULT_TIMEOUT_SECONDS)));
  const timer = setTimeout(()=>controller.abort("execution_ai_timeout"),Math.max(5000,seconds*1000-5000));
  try {
    const response = await fetch(SUPABASE_URL + "/functions/v1/ai", { method:"POST",headers:{"Content-Type":"application/json","X-ProjectX-Worker-Token":token},body:JSON.stringify({action:"runQueuedJob",userId:job.user_id,kind:"execution",payload:{projectId:project.id,action:job.payload?.action || {},contract,tools:executionToolDefinitions()}}),signal:controller.signal });
    const raw = await response.text();
    let payload:any={}; try { payload=raw?JSON.parse(raw):{}; } catch { payload={error:raw.slice(0,2000)}; }
    if (!response.ok || payload?.ok===false) throw new Error(String(payload?.error || "AI execution planner failed"));
    return payload?.result || payload;
  } finally { clearTimeout(timer); }
}
async function executeExecutionJob(token:string,job:any) {
  if (!job.project_id) throw new Error("Execution jobs require a project.");
  if (await isCancelled(job.id)) { await db.rpc("finish_project_job",{p_id:job.id,p_status:"cancelled",p_result:{reason:"cancel_requested"},p_error:null,p_retry_seconds:60}); return {id:job.id,status:"cancelled"}; }
  const project=await loadProject(String(job.project_id));
  const payload=job.payload && typeof job.payload==="object" ? job.payload : {};
  const contract=payload.contract && typeof payload.contract==="object" ? payload.contract : {};
  const action=payload.action && typeof payload.action==="object" ? payload.action : {};
  const targetVersion=Number(contract.targetVersion ?? action.targetVersion ?? project.specVersion);
  if (targetVersion!==project.specVersion) throw new Error("Project version changed before execution.");
  if (!contract.actionId || contract.humanReviewRequired || !contract.executor) throw new Error("Execution contract is missing, unsafe, or requires human review.");
  if (contract.autoExecute===false && payload.explicitApproval!==true) throw new Error("Execution contract requires explicit approval.");
  const maxAttempts=Math.max(1,Math.min(3,Number(contract.retryPolicy?.maxAttempts || 1)));
  if (Number(action.attempts || 0)>=maxAttempts) throw new Error("Execution attempt limit reached.");
  const executor=String(contract.executor);
  const runningSettings=buildExecutionSettings(project.settings,{...action,id:contract.actionId},{kind:action.type,ok:true,message:"Remote worker claimed the action.",evidence:[{event:"worker_started",executor}]},"running");
  const started=await commitExecution(project,job.user_id,job,action,executor,"running",runningSettings,[],"action_started",null,"Remote worker started the execution contract.",[{executor,targetVersion}]);
  if (started?.status==="stale") throw new Error("Project changed before the worker could start.");
  if (await isCancelled(job.id)) {
    const blocked=buildExecutionSettings(runningSettings,{...action,id:contract.actionId},{kind:action.type,ok:false,error:"cancel_requested",message:"Execution cancelled.",evidence:[{reason:"cancel_requested"}],outputVersion:project.specVersion},"blocked");
    await commitExecution(project,job.user_id,job,action,executor,"blocked",blocked,[],"action_cancelled",null,"Execution cancelled before tool execution.",[{reason:"cancel_requested"}]);
    await db.rpc("finish_project_job",{p_id:job.id,p_status:"cancelled",p_result:{reason:"cancel_requested"},p_error:null,p_retry_seconds:60});
    return {id:job.id,status:"cancelled"};
  }
  const ai=await invokeAI(token,job,project,contract);
  const execution=executeToolCalls(project,contract,Array.isArray(ai?.toolCalls)?ai.toolCalls:[]);
  const plannerEvidence=(ai?.diagnosis || ai?.repairPlan) ? [{plannerDiagnosis:ai?.diagnosis||null,repairPlan:ai?.repairPlan||null}] : [];
  const evidence=[...(Array.isArray(ai?.evidence)?ai.evidence:[]),...plannerEvidence,...execution.evidence].slice(0,30);
  if (["rebuild","update","repair"].includes(action.type) && execution.operations.length === 0) {
    throw new Error("Execution produced no file changes.");
  }
  if (!execution.ok) {
    const failed=buildExecutionSettings(runningSettings,{...action,id:contract.actionId},{kind:action.type,ok:false,error:execution.errors?.[0]?.error || "Tool execution failed",message:"Remote execution failed.",evidence,outputVersion:project.specVersion},"failed");
    await commitExecution(project,job.user_id,job,action,executor,"failed",failed,[],"action_failed",null,"Remote execution failed contract validation or tool execution.",evidence);
    throw new Error(execution.errors?.[0]?.error || "Tool execution failed.");
  }
  const nextSettings=JSON.parse(JSON.stringify(runningSettings));
  nextSettings.executionState={...(nextSettings.executionState||{})};
  if (execution.operations.length) {
    nextSettings.tests={status:"stale",specVersion:project.specVersion,verifiedAgainstVersion:null,results:[],updatedAt:null};
    nextSettings.status="needs-build";
    for (const [key,artifact] of Object.entries(nextSettings.artifacts||{})) {
      if (!artifact || !Array.isArray((artifact as any).filePaths)) continue;
      if (execution.operations.some((op:any)=>(artifact as any).filePaths.includes(op.path))) nextSettings.artifacts[key]={...(artifact as any),stale:true,staleFromVersion:project.specVersion};
    }
  }
  const result={kind:action.type,ok:true,message:String(ai?.message || "Remote execution completed."),model:ai?.model?String(ai.model):null,provider:ai?.provider?String(ai.provider):null,diagnosis:ai?.diagnosis&&typeof ai.diagnosis==="object"?ai.diagnosis:null,repairPlan:ai?.repairPlan&&typeof ai.repairPlan==="object"?ai.repairPlan:null,evidence,outputVersion:project.specVersion};
  const finished=buildExecutionSettings(nextSettings,{...action,id:contract.actionId},result,"completed");
  const committed=await commitExecution(project,job.user_id,job,action,executor,"completed",finished,execution.operations,"action_finished",execution.operations.length?"write_file":null,result.message,evidence);
  if (committed?.status==="stale") throw new Error("Project changed while committing the worker result.");
  const transactionId=committed?.transactionId ? String(committed.transactionId) : null;
  const { error: finishError } = await db.rpc("finish_project_job",{p_id:job.id,p_status:"succeeded",p_result:{actionId:contract.actionId,executor,model:result.model,provider:result.provider,diagnosis:result.diagnosis,repairPlan:result.repairPlan,message:result.message,evidence:evidence.slice(0,20),filesChanged:execution.operations.map((op:any)=>op.path),outputVersion:project.specVersion,transactionId},p_error:null,p_retry_seconds:60});
  if (finishError) throw finishError;
  return {id:job.id,status:"succeeded",actionId:contract.actionId,executor,filesChanged:execution.operations.map((op:any)=>op.path),transactionId};
}
async function proxyQueuedJob(token:string,job:any) {
  const controller=new AbortController();
  const seconds=Math.max(10,Math.min(MAX_TIMEOUT_SECONDS,Number(job.timeout_seconds || DEFAULT_TIMEOUT_SECONDS)));
  const timer=setTimeout(()=>controller.abort("queued_job_timeout"),seconds*1000);
  try {
    const response=await fetch(SUPABASE_URL + "/functions/v1/ai",{method:"POST",headers:{"Content-Type":"application/json","X-ProjectX-Worker-Token":token},body:JSON.stringify({action:"runQueuedJob",userId:job.user_id,kind:job.kind,payload:job.payload}),signal:controller.signal});
    const raw=await response.text(); let payload:any={}; try{payload=raw?JSON.parse(raw):{};}catch{payload={raw:raw.slice(0,2000)};}
    if(!response.ok || payload?.ok===false)throw new Error(String(payload?.error || "Queued job failed"));
    const {error}=await db.rpc("finish_project_job",{p_id:job.id,p_status:"succeeded",p_result:payload?.result ?? payload,p_error:null,p_retry_seconds:60}); if(error)throw error;
    return {id:job.id,status:"succeeded"};
  } finally { clearTimeout(timer); }
}
async function run(limit:number,token:string) {
  const {data:jobs,error}=await db.rpc("claim_project_job",{p_worker:"supabase-remote",p_limit:Math.max(1,Math.min(MAX_BATCH,Number(limit||MAX_BATCH)))});
  if(error)throw error;
  const results:any[]=[];
  for(const job of jobs||[]) {
    try { results.push(String(job.kind)==="execution" ? await executeExecutionJob(token,job) : await proxyQueuedJob(token,job)); }
    catch(error) {
      const message=error instanceof Error?error.message:String(error);
      const cancelled=await isCancelled(job.id).catch(()=>false);
      const status=cancelled?"cancelled":"failed";
      const {error:finishError}=await db.rpc("finish_project_job",{p_id:job.id,p_status:status,p_result:{},p_error:message,p_retry_seconds:Math.min(900,30*Math.max(1,Number(job.attempts||1)))});
      results.push({id:job.id,status:finishError?"finish_error":status,error:message});
    }
  }
  return {ok:true,claimed:(jobs||[]).length,results};
}
Deno.serve(async req=>{
  if(req.method==="OPTIONS")return new Response("ok",{headers:corsHeaders});
  try{if(req.method!=="POST" || !(await authorized(req)))return json({ok:false,error:"Unauthorized"},401);const body=await req.json().catch(()=>({}));const limit=Math.max(1,Math.min(MAX_BATCH,Number(body?.limit||MAX_BATCH)));return json({...await run(limit,await workerToken()),requestedLimit:limit});}
  catch(error){return json({ok:false,error:error instanceof Error?error.message:String(error)},500);}
});