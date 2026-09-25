import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders, json } from "../_shared/cors.ts";
import { encryptSecret, decryptSecret } from "../_shared/crypto.ts";

const URL=Deno.env.get("SUPABASE_URL")!;
const ANON=Deno.env.get("SUPABASE_ANON_KEY")||Deno.env.get("SUPABASE_PUBLISHABLE_KEY")!;
const SERVICE=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")||Deno.env.get("SUPABASE_SECRET_KEY")!;
const CLIENT_ID=Deno.env.get("GITHUB_OAUTH_CLIENT_ID")||Deno.env.get("GITHUB_CLIENT_ID")||"";
const CLIENT_SECRET=Deno.env.get("GITHUB_OAUTH_CLIENT_SECRET")||Deno.env.get("GITHUB_CLIENT_SECRET")||"";
const REDIRECT=Deno.env.get("GITHUB_REDIRECT_URI")||"https://homgaryumqbrnjcfkezi.supabase.co/functions/v1/github";
const ORIGIN=(Deno.env.get("APP_ORIGIN")||"https://pushlabs-tech.github.io").replace(/\/$/,"");const BUILD_WORKFLOW_PATH=".github/workflows/projectx-build.yml";
const BUILD_WORKFLOW="name: ProjectX Isolated Build\n\non:\n  repository_dispatch:\n    types: [projectx_build]\n  workflow_dispatch:\n    inputs:\n      commit_sha:\n        description: Commit SHA to verify\n        required: true\n        type: string\n      projectx_run_id:\n        description: ProjectX build-run identifier\n        required: false\n        type: string\n      ref:\n        description: Git ref containing the commit\n        required: false\n        type: string\n        default: main\n\nrun-name: ProjectX build ${{ github.event.client_payload.projectx_run_id || inputs.projectx_run_id || github.run_id }}\n\npermissions:\n  contents: read\n  actions: read\n\nconcurrency:\n  group: projectx-build-${{ github.repository }}-${{ github.event.client_payload.commit_sha || inputs.commit_sha || github.sha }}\n  cancel-in-progress: false\n\njobs:\n  verify:\n    runs-on: ubuntu-latest\n    timeout-minutes: 10\n    steps:\n      - name: Checkout exact ProjectX snapshot\n        uses: actions/checkout@v4\n        with:\n          ref: ${{ github.event.client_payload.commit_sha || inputs.commit_sha || github.event.client_payload.ref || inputs.ref || github.sha }}\n          fetch-depth: 1\n          persist-credentials: false\n\n      - name: Set up Node\n        uses: actions/setup-node@v4\n        with:\n          node-version: 22\n\n      - name: Run isolated build and tests\n        shell: bash\n        env:\n          GITHUB_TOKEN: \"\"\n          GH_TOKEN: \"\"\n          NODE_AUTH_TOKEN: \"\"\n          PROJECTX_BUILD_RUN_ID: ${{ github.event.client_payload.projectx_run_id || inputs.projectx_run_id || github.run_id }}\n          PROJECTX_COMMIT_SHA: ${{ github.event.client_payload.commit_sha || inputs.commit_sha || github.sha }}\n        run: |\n          set +e\n          node --input-type=module <<'NODE'\n          import fs from 'node:fs';\n          import path from 'node:path';\n          import { spawnSync } from 'node:child_process';\n\n          const evidence = {\n            version: 1,\n            runner: 'projectx-github-actions',\n            runId: process.env.PROJECTX_BUILD_RUN_ID || '',\n            commitSha: process.env.PROJECTX_COMMIT_SHA || '',\n            node: process.version,\n            platform: process.platform,\n            startedAt: new Date().toISOString(),\n            packageManager: null,\n            steps: [],\n            failures: []\n          };\n\n          const root = process.cwd();\n          const packagePath = path.join(root, 'package.json');\n          const pkg = fs.existsSync(packagePath) ? JSON.parse(fs.readFileSync(packagePath, 'utf8')) : null;\n          const scripts = pkg?.scripts && typeof pkg.scripts === 'object' ? pkg.scripts : {};\n          const has = name => Object.prototype.hasOwnProperty.call(scripts, name);\n\n          function run(label, command, args, timeout = 240000) {\n            const started = Date.now();\n            const result = spawnSync(command, args, {\n              cwd: root,\n              stdio: 'inherit',\n              shell: false,\n              timeout,\n              env: { ...process.env, GITHUB_TOKEN: '', GH_TOKEN: '', NODE_AUTH_TOKEN: '' }\n            });\n            const timedOut = result.error?.code === 'ETIMEDOUT';\n            const exitCode = timedOut ? 124 : (typeof result.status === 'number' ? result.status : 1);\n            const row = { label, command: [command, ...args].join(' '), exitCode, timedOut, durationMs: Date.now() - started };\n            evidence.steps.push(row);\n            if (exitCode !== 0) evidence.failures.push(row);\n          }\n\n          try {\n            if (pkg) {\n              if (fs.existsSync(path.join(root, 'pnpm-lock.yaml'))) {\n                evidence.packageManager = 'pnpm';\n                run('Enable Corepack', 'corepack', ['enable'], 60000);\n                run('Install dependencies', 'corepack', ['pnpm', 'install', '--frozen-lockfile'], 300000);\n              } else if (fs.existsSync(path.join(root, 'yarn.lock'))) {\n                evidence.packageManager = 'yarn';\n                run('Enable Corepack', 'corepack', ['enable'], 60000);\n                run('Install dependencies', 'corepack', ['yarn', 'install', '--immutable'], 300000);\n              } else {\n                evidence.packageManager = 'npm';\n                run('Install dependencies', 'npm', [fs.existsSync(path.join(root, 'package-lock.json')) ? 'ci' : 'install'], 300000);\n              }\n\n              if (has('build')) run('Build', 'npm', ['run', 'build'], 300000);\n              if (has('test')) run('Test', 'npm', ['test'], 300000);\n              else if (has('check')) run('Check', 'npm', ['run', 'check'], 300000);\n              if (has('e2e')) run('Browser E2E', 'npm', ['run', 'e2e'], 300000);\n            } else {\n              evidence.packageManager = 'none';\n              const indexPath = fs.existsSync(path.join(root, 'index.html')) ? path.join(root, 'index.html') : null;\n              if (!indexPath) evidence.failures.push({ label: 'Static entry', exitCode: 1, detail: 'No package.json or index.html found.' });\n              else {\n                const html = fs.readFileSync(indexPath, 'utf8');\n                const exitCode = /<html[\\s>]/i.test(html) && /<body[\\s>]/i.test(html) ? 0 : 1;\n                evidence.steps.push({ label: 'Static entry', exitCode, detail: 'index.html structural check' });\n                if (exitCode !== 0) evidence.failures.push({ label: 'Static entry', exitCode, detail: 'index.html is not a complete HTML document.' });\n              }\n            }\n          } catch (error) {\n            evidence.failures.push({ label: 'Runner', exitCode: 1, detail: String(error?.message || error) });\n          }\n\n          evidence.finishedAt = new Date().toISOString();\n          evidence.passed = evidence.failures.length === 0;\n          fs.writeFileSync(path.join(root, 'projectx-build-evidence.json'), JSON.stringify(evidence, null, 2));\n          console.log(JSON.stringify(evidence, null, 2));\n          NODE\n\n      - name: Upload build evidence\n        if: always()\n        uses: actions/upload-artifact@v4\n        with:\n          name: projectx-build-evidence\n          path: projectx-build-evidence.json\n          if-no-files-found: error\n          retention-days: 7\n\n      - name: Enforce verification result\n        if: always()\n        run: |\n          node --input-type=module <<'NODE'\n          import fs from 'node:fs';\n          const evidence = JSON.parse(fs.readFileSync('projectx-build-evidence.json', 'utf8'));\n          if (!evidence.passed) process.exit(1);\n          NODE\n";

const admin=createClient(URL,SERVICE,{auth:{persistSession:false,autoRefreshToken:false}});

async function auth(req:Request){const h=req.headers.get("Authorization");if(!h)throw new Error("SIGN_IN_REQUIRED");const c=createClient(URL,ANON,{global:{headers:{Authorization:h}}});const {data,error}=await c.auth.getUser();if(error||!data.user)throw new Error("INVALID_SESSION");return data.user;}
async function sha(value:string){const d=await crypto.subtle.digest("SHA-256",new TextEncoder().encode(value));return [...new Uint8Array(d)].map(x=>x.toString(16).padStart(2,"0")).join("");}
function token(){return crypto.randomUUID().replaceAll("-","")+crypto.randomUUID().replaceAll("-","");}
async function gh(path:string,access:string,init:RequestInit={}){const r=await fetch("https://api.github.com"+path,{...init,headers:{"Authorization":`Bearer ${access}`,"Accept":"application/vnd.github+json","X-GitHub-Api-Version":"2022-11-28","Content-Type":"application/json",...(init.headers||{})}});const t=await r.text();let j:any={};try{j=t?JSON.parse(t):{}}catch{j={raw:t}}if(!r.ok)throw new Error(j?.message||`GitHub HTTP ${r.status}`);return j;}
async function connection(userId:string,workspaceId:string){const {data,error}=await admin.from("github_connections").select("*").eq("user_id",userId).eq("workspace_id",workspaceId).maybeSingle();if(error||!data)throw new Error("GITHUB_NOT_CONNECTED");return {...data,accessToken:await decryptSecret(data.access_token_ciphertext)};}
function safePath(p:string){const s=String(p||"").replaceAll("\\","/").replace(/^\/+/, "");if(!s||s.split("/").some(x=>x===".."||x==="."))throw new Error("Invalid repository path");return s;}
async function resolveWorkspace(userId:string,workspaceId:string,projectId:string){
  if(workspaceId)return workspaceId;
  if(projectId){const {data,error}=await admin.from("projects").select("workspace_id").eq("id",projectId).eq("owner_id",userId).maybeSingle();if(error)throw error;if(data?.workspace_id)return data.workspace_id;}
  throw new Error("WORKSPACE_REQUIRED");
}
async function start(user:any,workspaceId:string,projectId:string){workspaceId=await resolveWorkspace(user.id,workspaceId,projectId);if(!CLIENT_ID||!CLIENT_SECRET||!REDIRECT)throw new Error("GitHub OAuth is not configured");const state=token();const stateHash=await sha(state);const {error}=await admin.from("github_oauth_states").insert({state_hash:stateHash,user_id:user.id,workspace_id:workspaceId,expires_at:new Date(Date.now()+10*60*1000).toISOString()});if(error)throw error;const q=new URLSearchParams({client_id:CLIENT_ID,redirect_uri:REDIRECT,state,scope:"repo workflow read:user user:email"});return {url:`https://github.com/login/oauth/authorize?${q}`};}
async function callback(code:string,state:string){if(!CLIENT_ID||!CLIENT_SECRET||!REDIRECT)throw new Error("GitHub OAuth is not configured");const hash=await sha(state);const {data:s,error:se}=await admin.from("github_oauth_states").select("*").eq("state_hash",hash).maybeSingle();if(se||!s||new Date(s.expires_at).getTime()<Date.now())throw new Error("Invalid or expired OAuth state");await admin.from("github_oauth_states").delete().eq("state_hash",hash);const tr=await fetch("https://github.com/login/oauth/access_token",{method:"POST",headers:{"Accept":"application/json","Content-Type":"application/json"},body:JSON.stringify({client_id:CLIENT_ID,client_secret:CLIENT_SECRET,code,redirect_uri:REDIRECT})});const tj=await tr.json();if(!tr.ok||!tj.access_token)throw new Error(tj.error_description||"GitHub token exchange failed");const me=await gh("/user",tj.access_token);const cipher=await encryptSecret(tj.access_token);await admin.from("github_connections").upsert({user_id:s.user_id,workspace_id:s.workspace_id,github_user_id:String(me.id),github_login:me.login,access_token_ciphertext:cipher,scope:tj.scope||null,updated_at:new Date().toISOString()},{onConflict:"user_id,workspace_id"});return {redirect:`${ORIGIN}/?github=connected&workspace=${encodeURIComponent(s.workspace_id)}`};}
async function status(user:any,workspaceId:string,projectId:string){workspaceId=await resolveWorkspace(user.id,workspaceId,projectId);const {data,error}=await admin.from("github_connections").select("github_login,github_user_id,scope,updated_at").eq("user_id",user.id).eq("workspace_id",workspaceId).maybeSingle();if(error)throw error;return {connected:!!data,githubLogin:data?.github_login||null,githubUserId:data?.github_user_id||null,scope:data?.scope||null,updatedAt:data?.updated_at||null};}
async function repos(user:any,workspaceId:string){const c=await connection(user.id,workspaceId);const data=await gh("/user/repos?per_page=100&sort=updated",c.accessToken);const rows=data.map((r:any)=>({connection_id:c.id,workspace_id:workspaceId,owner_login:r.owner.login,repo_name:r.name,full_name:r.full_name,default_branch:r.default_branch||"main",private:!!r.private,html_url:r.html_url,metadata:{id:r.id}}));if(rows.length)await admin.from("github_repositories").upsert(rows,{onConflict:"connection_id,full_name"});return {repositories:rows};}
async function createRepo(user:any,workspaceId:string,body:any){const c=await connection(user.id,workspaceId);const name=safePath(body.name).split("/").pop()!;const r=await gh("/user/repos",c.accessToken,{method:"POST",body:JSON.stringify({name,description:String(body.description||"").slice(0,350),private:body.private!==false,auto_init:true})});await admin.from("github_repositories").upsert({connection_id:c.id,workspace_id:workspaceId,owner_login:r.owner.login,repo_name:r.name,full_name:r.full_name,default_branch:r.default_branch||"main",private:!!r.private,html_url:r.html_url,metadata:{id:r.id}},{onConflict:"connection_id,full_name"});return {repository:r};}

function repoPath(full:string,path:string){return path.split("/").filter(Boolean).map(encodeURIComponent).join("/");}
async function projectAccess(userId:string,projectId:string){
  const {data,error}=await admin.from("projects").select("id,workspace_id,title,owner_id").eq("id",projectId).maybeSingle();
  if(error||!data)throw new Error("PROJECT_NOT_FOUND");
  if(data.owner_id!==userId){
    const {data:m}=await admin.from("workspace_members").select("role").eq("workspace_id",data.workspace_id).eq("user_id",userId).maybeSingle();
    if(!m||!["owner","admin","editor"].includes(m.role))throw new Error("FORBIDDEN");
  }
  return data;
}
async function ensureBuildWorkflow(access:string,full:string,defaultBranch:string){
  let existing:any=null;
  try{existing=await gh(`/repos/${full}/contents/${repoPath(full,BUILD_WORKFLOW_PATH)}?ref=${encodeURIComponent(defaultBranch)}`,access);}
  catch(e){if(!/HTTP 404/i.test(String(e?.message||e)))throw e;}
  if(existing?.content&&!String(atob(existing.content.replace(/\s/g,""))).includes("ProjectX Isolated Build"))throw new Error("BUILD_WORKFLOW_PATH_OCCUPIED");
  if(existing?.content)return {installed:false,defaultBranch};
  await gh(`/repos/${full}/contents/${repoPath(full,BUILD_WORKFLOW_PATH)}`,access,{method:"PUT",body:JSON.stringify({message:"chore: install ProjectX isolated build runner",content:btoa(BUILD_WORKFLOW),branch:defaultBranch})});
  return {installed:true,defaultBranch};
}
async function headCommit(access:string,full:string,ref:string){
  const value=String(ref||"").trim();
  if(/^[0-9a-f]{40}$/i.test(value))return value;
  const r=await gh(`/repos/${full}/git/ref/heads/${encodeURIComponent(value||"main")}`,access);
  return String(r.object.sha);
}
async function discoverBuildRun(access:string,full:string,row:any){
  const q=await gh(`/repos/${full}/actions/workflows/${encodeURIComponent(BUILD_WORKFLOW_PATH)}/runs?event=repository_dispatch&per_page=20`,access);
  const runs=Array.isArray(q?.workflow_runs)?q.workflow_runs:[];
  const id=String(row.id);
  return runs.find((run:any)=>String(run.name||"").includes(id)||String(run.display_title||"").includes(id))||null;
}
async function syncBuildRun(access:string,row:any){
  const full=String(row.repository_full_name);
  let run:any=null;
  if(row.workflow_run_id){try{run=await gh(`/repos/${full}/actions/runs/${row.workflow_run_id}`,access);}catch{}}
  if(!run)run=await discoverBuildRun(access,full,row);
  if(!run)return {id:row.id,status:row.status,conclusion:row.conclusion||null,htmlUrl:row.html_url||null,commitSha:row.commit_sha,repositoryFullName:full,branch:row.branch,evidence:row.evidence||{},artifactSummary:row.artifact_summary||[],requestedAt:row.requested_at,updatedAt:row.updated_at};
  const [jobs,artifacts]=await Promise.all([
    gh(`/repos/${full}/actions/runs/${run.id}/jobs?per_page=100`,access),
    gh(`/repos/${full}/actions/runs/${run.id}/artifacts?per_page=100`,access)
  ]);
  const jobRows=(jobs?.jobs||[]).map((j:any)=>({id:j.id,name:j.name,status:j.status,conclusion:j.conclusion,startedAt:j.started_at,completedAt:j.completed_at,steps:Array.isArray(j.steps)?j.steps.map((s:any)=>({name:s.name,status:s.status,conclusion:s.conclusion,number:s.number})):[]}));
  const artifactRows=(artifacts?.artifacts||[]).map((a:any)=>({id:a.id,name:a.name,sizeBytes:a.size_in_bytes,expired:a.expired,createdAt:a.created_at,expiresAt:a.expires_at}));
  const status=run.status==="completed"?(run.conclusion==="success"?"success":run.conclusion==="cancelled"?"cancelled":run.conclusion==="timed_out"?"timed_out":run.conclusion==="skipped"?"skipped":"failure"):String(run.status||"unknown");
  const evidence={source:"github-actions",runner:"projectx-github-actions",runId:run.id,runAttempt:run.run_attempt||1,status,conclusion:run.conclusion||null,jobs:jobRows,artifacts:artifactRows};
  const updates={workflow_run_id:run.id,status,conclusion:run.conclusion||null,html_url:run.html_url||null,run_attempt:run.run_attempt||null,started_at:run.run_started_at||run.created_at||null,completed_at:run.status==="completed"?(run.updated_at||new Date().toISOString()):null,updated_at:new Date().toISOString(),evidence,artifact_summary:artifactRows};
  const {error}=await admin.from("projectx_build_runs").update(updates).eq("id",row.id);if(error)throw error;
  return {id:row.id,status,conclusion:run.conclusion||null,htmlUrl:run.html_url||null,commitSha:row.commit_sha,repositoryFullName:full,branch:row.branch,workflowRunId:run.id,runAttempt:run.run_attempt||1,evidence,artifactSummary:artifactRows,requestedAt:row.requested_at,updatedAt:updates.updated_at};
}

async function push(user:any,workspaceId:string,body:any){const c=await connection(user.id,workspaceId);const full=String(body.fullName||"");if(!/^[^/]+\/[^/]+$/.test(full))throw new Error("Invalid repository");const branch=String(body.branch||"main");const files=Array.isArray(body.files)?body.files.slice(0,500):[];if(!files.length)throw new Error("No files to push");const ref=await gh(`/repos/${full}/git/ref/heads/${encodeURIComponent(branch)}`,c.accessToken);const baseSha=ref.object.sha;const base=await gh(`/repos/${full}/git/commits/${baseSha}`,c.accessToken);const treeEntries=[];for(const file of files){const path=safePath(file.path);const content=String(file.content??"");const blob=await gh(`/repos/${full}/git/blobs`,c.accessToken,{method:"POST",body:JSON.stringify({content,encoding:"utf-8"})});treeEntries.push({path,mode:"100644",type:"blob",sha:blob.sha});}const tree=await gh(`/repos/${full}/git/trees`,c.accessToken,{method:"POST",body:JSON.stringify({base_tree:base.tree.sha,tree:treeEntries})});const commit=await gh(`/repos/${full}/git/commits`,c.accessToken,{method:"POST",body:JSON.stringify({message:String(body.message||"Update from ProjectX").slice(0,200),tree:tree.sha,parents:[baseSha]})});await gh(`/repos/${full}/git/refs/heads/${encodeURIComponent(branch)}`,c.accessToken,{method:"PATCH",body:JSON.stringify({sha:commit.sha,force:false})});return {commitSha:commit.sha,htmlUrl:`https://github.com/${full}/commit/${commit.sha}`};}
Deno.serve(async req=>{if(req.method==="OPTIONS")return new Response("ok",{headers:corsHeaders});try{const url=new URL(req.url);if(req.method==="GET" && url.searchParams.get("code") && url.searchParams.get("state")){return new Response("",{status:302,headers:{Location:(await callback(url.searchParams.get("code")!,url.searchParams.get("state")!)).redirect,...corsHeaders}});}const body=await req.json().catch(()=>({}));const action=String(body.action||"");if(action==="callback")return new Response("",{status:302,headers:{Location:(await callback(String(body.code||""),String(body.state||""))).redirect,...corsHeaders}});const u=await auth(req);let ws=String(body.workspaceId||"");if(action==="startOAuth"){return json({ok:true,...await start(u,ws,String(body.projectId||""))});}if(!ws)throw new Error("WORKSPACE_REQUIRED");if(action==="status")return json({ok:true,...await status(u,ws,String(body.projectId||""))});if(action==="listRepos")return json({ok:true,...await repos(u,ws)});if(action==="createRepo")return json({ok:true,...await createRepo(u,ws,body)});if(action==="pushFiles")return json({ok:true,...await push(u,ws,body)});

if(action==="installBuildRunner"){
  const full=String(body.fullName||"");if(!/^[^/]+\/[^/]+$/.test(full))throw new Error("Invalid repository");
  const con=await connection(u.id,ws);const repo=await gh(`/repos/${full}`,con.accessToken);const defaultBranch=String(repo.default_branch||"main");
  return json({ok:true,...await ensureBuildWorkflow(con.accessToken,full,defaultBranch)});
}
if(action==="startBuild"){
  const project=await projectAccess(u.id,String(body.projectId||""));const full=String(body.fullName||"");
  if(!/^[^/]+\/[^/]+$/.test(full))throw new Error("Invalid repository");
  const con=await connection(u.id,project.workspace_id);const repo=await gh(`/repos/${full}`,con.accessToken);const defaultBranch=String(repo.default_branch||"main");
  await ensureBuildWorkflow(con.accessToken,full,defaultBranch);
  const branch=String(body.branch||defaultBranch).trim()||defaultBranch;const commitSha=await headCommit(con.accessToken,full,String(body.commitSha||branch));
  const requestId=String(body.clientRequestId||"").trim()||crypto.randomUUID();
  const existing=await admin.from("projectx_build_runs").select("*").eq("project_id",project.id).eq("client_request_id",requestId).maybeSingle();
  if(existing.data)return json({ok:true,buildRun:await syncBuildRun(con.accessToken,existing.data)});
  const {data:created,error:insertError}=await admin.from("projectx_build_runs").insert({project_id:project.id,user_id:u.id,workspace_id:project.workspace_id,repository_full_name:full,branch,commit_sha:commitSha,client_request_id:requestId,status:"queued"}).select().single();
  if(insertError)throw insertError;
  try{
    await gh(`/repos/${full}/dispatches`,con.accessToken,{method:"POST",body:JSON.stringify({event_type:"projectx_build",client_payload:{projectx_run_id:created.id,commit_sha:commitSha,ref:branch}})});
  }catch(error){
    await admin.from("projectx_build_runs").update({status:"failure",error:String(error?.message||error),updated_at:new Date().toISOString()}).eq("id",created.id);
    throw error;
  }
  return json({ok:true,buildRun:{id:created.id,status:"queued",repositoryFullName:full,branch,commitSha,requestedAt:created.requested_at}});
}
if(action==="buildStatus"){
  const row=await admin.from("projectx_build_runs").select("*").eq("id",String(body.buildRunId||"")).maybeSingle();
  if(row.error||!row.data)throw new Error("BUILD_RUN_NOT_FOUND");
  await projectAccess(u.id,row.data.project_id);const con=await connection(u.id,row.data.workspace_id);
  return json({ok:true,buildRun:await syncBuildRun(con.accessToken,row.data)});
}
if(action==="buildRuns"){
  const project=await projectAccess(u.id,String(body.projectId||""));
  const {data,error}=await admin.from("projectx_build_runs").select("*").eq("project_id",project.id).order("requested_at",{ascending:false}).limit(12);
  if(error)throw error;const con=await connection(u.id,project.workspace_id);const rows=[];for(const row of data||[])rows.push(await syncBuildRun(con.accessToken,row));
  return json({ok:true,buildRuns:rows});
}
if(action==="cancelBuild"){
  const row=await admin.from("projectx_build_runs").select("*").eq("id",String(body.buildRunId||"")).maybeSingle();
  if(row.error||!row.data)throw new Error("BUILD_RUN_NOT_FOUND");await projectAccess(u.id,row.data.project_id);
  if(row.data.workflow_run_id){const con=await connection(u.id,row.data.workspace_id);await gh(`/repos/${row.data.repository_full_name}/actions/runs/${row.data.workflow_run_id}/cancel`,con.accessToken,{method:"POST",body:"{}"});}
  await admin.from("projectx_build_runs").update({status:"cancelled",updated_at:new Date().toISOString()}).eq("id",row.data.id);
  return json({ok:true,status:"cancelled",buildRunId:row.data.id});
}
if(action==="disconnect"){await admin.from("github_connections").delete().eq("user_id",u.id).eq("workspace_id",ws);return json({ok:true});}throw new Error("Unknown action");}catch(e){return json({ok:false,error:e instanceof Error?e.message:String(e)},400);}});