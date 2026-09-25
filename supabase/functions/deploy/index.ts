import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders, json } from "../_shared/cors.ts";
import { encryptSecret, decryptSecret } from "../_shared/crypto.ts";
const URL=Deno.env.get("SUPABASE_URL")!;
const ANON=Deno.env.get("SUPABASE_ANON_KEY")||Deno.env.get("SUPABASE_PUBLISHABLE_KEY")!;
const SERVICE=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")||Deno.env.get("SUPABASE_SECRET_KEY")!;
const admin=createClient(URL,SERVICE,{auth:{persistSession:false,autoRefreshToken:false}});
async function deploymentUrlHealthCheck(url:string){
  const target=String(url||"").trim();
  if(!/^https:\/\//i.test(target)) return {status:"skipped",detail:"Deployment URL is not HTTPS.",url:target||null};
  const controller=new AbortController();
  const timer=setTimeout(()=>controller.abort(),10000);
  try{
    const response=await fetch(target,{redirect:"follow",headers:{"User-Agent":"ProjectX-HealthCheck/1.0","Accept":"text/html,application/xhtml+xml,application/json;q=0.9,*/*;q=0.8"},signal:controller.signal});
    const finalUrl=response.url||target;
    const sample=(await response.text()).slice(0,1200);
    const ok=response.status>=200&&response.status<400;
    return {status:ok?"passed":"failed",httpStatus:response.status,finalUrl,bytes:sample.length,sample:sample.slice(0,240)};
  }catch(error){
    return {status:"failed",detail:String(error?.message||error),url:target};
  }finally{clearTimeout(timer);}
}
function providerDeploymentStatus(value:string){
  const normalized=String(value||"").toLowerCase();
  if(["ready","promoted","success","succeeded","processed"].includes(normalized))return "ready";
  if(["error","failed","canceled","cancelled","skipped"].includes(normalized))return "failed";
  return "pending";
}
async function fetchProviderDeployment(provider:string,token:string,externalId:string){
  if(provider==="vercel"){
    const r=await fetch("https://api.vercel.com/v13/deployments/"+encodeURIComponent(externalId),{headers:{Authorization:`Bearer ${token}`}});
    const j=await r.json().catch(()=>({}));
    if(!r.ok)throw new Error(j?.error?.message||"Unable to read Vercel deployment status");
    return {state:providerDeploymentStatus(j.readyState),providerState:j.readyState||null,url:j.url?`https://${j.url}`:null,raw:{readyState:j.readyState,alias:j.alias||null,creator:j.creator?.uid||null}};
  }
  const r=await fetch("https://api.netlify.com/api/v1/deploys/"+encodeURIComponent(externalId),{headers:{Authorization:`Bearer ${token}`}});
  const j=await r.json().catch(()=>({}));
  if(!r.ok)throw new Error(j?.message||"Unable to read Netlify deploy status");
  return {state:providerDeploymentStatus(j.state),providerState:j.state||null,url:j.deploy_ssl_url||j.ssl_url||j.url||null,raw:{state:j.state,siteId:j.site_id||null}};
}
async function syncDeployment(row:any,token:string){
  const externalId=String(row.metadata?.externalId||"");
  if(!externalId)return row;
  const providerState=await fetchProviderDeployment(String(row.provider),token,externalId);
  let health=row.metadata?.health||null;
  let status=providerState.state==="ready"?"ready":providerState.state==="failed"?"failed":"pending";
  let url=providerState.url||row.url||null;
  if(status==="ready"&&url&&health?.status!=="passed"){
    health=await deploymentUrlHealthCheck(url);
    if(health.status==="failed")status="unhealthy";
  }
  const metadata={...(row.metadata||{}),providerState:providerState.raw,externalStatus:providerState.providerState,health,externalId};
  const update={status,url,metadata,updated_at:new Date().toISOString()};
  const {data,error}=await admin.from("deployments").update(update).eq("id",row.id).select().single();
  if(error)throw error;
  return data;
}
async function previousSuccessfulDeployment(projectId:string,currentId:string){
  const {data,error}=await admin.from("deployments").select("id,provider,status,url,provider_project,metadata,created_at").eq("project_id",projectId).in("status",["ready"]).neq("id",currentId).order("created_at",{ascending:false}).limit(1);
  if(error)throw error;
  return data?.[0]||null;
}

async function auth(req:Request){const h=req.headers.get("Authorization");if(!h)throw new Error("SIGN_IN_REQUIRED");const c=createClient(URL,ANON,{global:{headers:{Authorization:h}}});const {data,error}=await c.auth.getUser();if(error||!data.user)throw new Error("INVALID_SESSION");return data.user;}
async function resolveWorkspace(userId:string,workspaceId:string,projectId:string){if(workspaceId)return workspaceId;if(projectId){const {data,error}=await admin.from("projects").select("workspace_id").eq("id",projectId).maybeSingle();if(error)throw error;if(data?.workspace_id){const {data:m}=await admin.from("workspace_members").select("role").eq("workspace_id",data.workspace_id).eq("user_id",userId).maybeSingle();if(m)return data.workspace_id;}}throw new Error("WORKSPACE_REQUIRED");}
async function targetStatus(userId:string,workspaceId:string,projectId:string){const ws=await resolveWorkspace(userId,workspaceId,projectId);const {data,error}=await admin.from("deployment_targets").select("provider,label,updated_at").eq("workspace_id",ws);if(error)throw error;const targets:any={vercel:{connected:false},netlify:{connected:false}};for(const row of data||[])if(row.provider in targets)targets[row.provider]={connected:true,label:row.label,updatedAt:row.updated_at};return {workspaceId:ws,targets};}
async function target(userId:string,workspaceId:string,provider:string,label?:string){const {data,error}=await admin.from("deployment_targets").select("*").eq("workspace_id",workspaceId).eq("provider",provider).eq("label",label||"default").maybeSingle();if(error||!data)throw new Error("DEPLOYMENT_TARGET_NOT_CONFIGURED");return {...data,credential:await decryptSecret(data.credential_ciphertext)};}
async function projectAccess(userId:string,projectId:string){const {data,error}=await admin.from("projects").select("id,workspace_id,title").eq("id",projectId).maybeSingle();if(error||!data)throw new Error("PROJECT_NOT_FOUND");const {data:m}=await admin.from("workspace_members").select("role").eq("workspace_id",data.workspace_id).eq("user_id",userId).maybeSingle();if(!m||!["owner","admin","editor"].includes(m.role))throw new Error("FORBIDDEN");return data;}
async function files(projectId:string){const {data,error}=await admin.from("project_files").select("path,content,mime_type,size_bytes").eq("project_id",projectId).limit(2000);if(error)throw error;if(!data?.length)throw new Error("PROJECT_HAS_NO_FILES");return data.map(f=>({path:String(f.path).replace(/^\/+/, ""),content:String(f.content??"")}));}
async function vercelDeploy(token:string,name:string,fs:any[],existingProject?:string){let project=existingProject;if(!project){const pr=await fetch("https://api.vercel.com/v9/projects",{method:"POST",headers:{Authorization:`Bearer ${token}`,"Content-Type":"application/json"},body:JSON.stringify({name})});const pj=await pr.json();if(!pr.ok)throw new Error(pj?.error?.message||"Vercel project creation failed");project=pj.id||pj.name;}const r=await fetch("https://api.vercel.com/v13/deployments",{method:"POST",headers:{Authorization:`Bearer ${token}`,"Content-Type":"application/json"},body:JSON.stringify({name,project,files:fs.map(f=>({file:f.path,data:f.content})),target:"production"})});const j=await r.json();if(!r.ok)throw new Error(j?.error?.message||"Vercel deployment failed");return {providerProject:project,url:j.url?(`https://${j.url}`):null,externalId:j.id,status:j.readyState||"QUEUED",metadata:j};}
async function netlifyDeploy(token:string,name:string,fs:any[],siteId?:string){let site=siteId;if(!site){const r=await fetch("https://api.netlify.com/api/v1/sites",{method:"POST",headers:{Authorization:`Bearer ${token}`,"Content-Type":"application/json"},body:JSON.stringify({name})});const j=await r.json();if(!r.ok)throw new Error(j?.message||"Netlify site creation failed");site=j.id;}const encoder=new TextEncoder();const hash=async(s:string)=>{const d=await crypto.subtle.digest("SHA-1",encoder.encode(s));return [...new Uint8Array(d)].map(x=>x.toString(16).padStart(2,"0")).join("")};const digest:any={};for(const f of fs)digest["/"+f.path]=await hash(f.content);const d=await fetch(`https://api.netlify.com/api/v1/sites/${site}/deploys`,{method:"POST",headers:{Authorization:`Bearer ${token}`,"Content-Type":"application/json"},body:JSON.stringify({files:digest})});const dj=await d.json();if(!d.ok)throw new Error(dj?.message||"Netlify deploy creation failed");for(const f of fs){const h=digest["/"+f.path];if((dj.required||[]).includes(h)){const up=await fetch(`https://api.netlify.com/api/v1/deploys/${dj.id}/files/${encodeURIComponent(f.path)}`,{method:"PUT",headers:{Authorization:`Bearer ${token}`,"Content-Type":"application/octet-stream"},body:encoder.encode(f.content)});if(!up.ok)throw new Error(`Netlify file upload failed: ${f.path}`);}}return {providerProject:site,url:dj.deploy_ssl_url||dj.ssl_url||dj.url||null,externalId:dj.id,status:dj.state||"processing",metadata:dj};}
Deno.serve(async req=>{if(req.method==="OPTIONS")return new Response("ok",{headers:corsHeaders});try{const u=await auth(req);const b=await req.json().catch(()=>({}));const action=String(b.action||"");if(action==="saveTarget"){const ws=await resolveWorkspace(u.id,String(b.workspaceId||""),String(b.projectId||""));const provider=String(b.provider||"");if(!["vercel","netlify"].includes(provider))throw new Error("Unsupported deployment provider");const token=String(b.token||"").trim();if(!token)throw new Error("Provider token required");const {data:m}=await admin.from("workspace_members").select("role").eq("workspace_id",ws).eq("user_id",u.id).maybeSingle();if(!m||!["owner","admin"].includes(m.role))throw new Error("FORBIDDEN");const cipher=await encryptSecret(token);await admin.from("deployment_targets").upsert({workspace_id:ws,provider,label:String(b.label||"default"),credential_ciphertext:cipher,metadata:{siteId:b.siteId||null},updated_at:new Date().toISOString()},{onConflict:"workspace_id,provider,label"});return json({ok:true});}if(action==="statusTargets")return json({ok:true,...await targetStatus(u.id,String(b.workspaceId||""),String(b.projectId||""))});if(action==="deploy"){
  const p=await projectAccess(u.id,String(b.projectId||""));
  const provider=String(b.provider||"vercel");
  if(!["vercel","netlify"].includes(provider))throw new Error("Unsupported deployment provider");
  const t=await target(u.id,p.workspace_id,provider,String(b.label||"default"));
  const fs=await files(p.id);
  if(!fs.length)throw new Error("PROJECT_HAS_NO_FILES");
  const previous=await previousSuccessfulDeployment(p.id,"00000000-0000-0000-0000-000000000000");
  const name=p.title.replace(/[^a-z0-9-]+/gi,"-").toLowerCase().slice(0,50)||"projectx-app";
  const result=provider==="vercel"?await vercelDeploy(t.credential,name,fs,t.metadata?.projectId):await netlifyDeploy(t.credential,name,fs,t.metadata?.siteId);
  const metadata={
    externalId:result.externalId,
    ...(result.metadata||{}),
    deploymentPipeline:{phase:"deployed",health:"pending",sourceSpecVersion:p.spec_version||null,previousDeploymentId:previous?.id||null}
  };
  const {data:d,error}=await admin.from("deployments").insert({
    project_id:p.id,provider,status:result.status,url:result.url,provider_project:result.providerProject,metadata
  }).select().single();
  if(error)throw error;
  return json({ok:true,deployment:d});
}if(action==="status"){
  const projectId=String(b.projectId||"");
  const p=await projectAccess(u.id,projectId);
  const requestedId=String(b.deploymentId||"").trim();
  const {data:d,error}=await admin.from("deployments").select("*").eq("project_id",projectId).order("created_at",{ascending:false}).limit(20);
  if(error)throw error;
  const rows=d||[];
  const targets=rows.filter(x=>!requestedId||x.id===requestedId).slice(0,5);
  for(const row of targets){
    if(["ready","failed","unhealthy"].includes(String(row.status)))continue;
    try{
      const t=await target(u.id,p.workspace_id,String(row.provider),String(b.label||"default"));
      await syncDeployment(row,t.credential);
    }catch(error){
      await admin.from("deployments").update({status:"failed",metadata:{...(row.metadata||{}),pipelineError:String(error?.message||error)},updated_at:new Date().toISOString()}).eq("id",row.id);
    }
  }
  const {data:latest,error:latestError}=await admin.from("deployments").select("*").eq("project_id",projectId).order("created_at",{ascending:false}).limit(20);
  if(latestError)throw latestError;
  return json({ok:true,deployments:latest||[]});
}throw new Error("Unknown action");}catch(e){return json({ok:false,error:e instanceof Error?e.message:String(e)},400);}});