import {
  createProject,
  createProjectFromIntent,
  migrateProject,
  normalizeSections,
  mergeSpec,
  validateSpec,
  applyProjectMutation,
  restoreProjectSnapshot,
  sanitizePath,
  assemblePreviewHtml,
  serializeForPersistence,
  buildDependencyMap,
  projectArtifactKind,
  normalizeProjectType,
} from './projectx-core.js';
import * as UI from './px-ui.js';
const appStylesheet = new URL('./px-app.css', import.meta.url).href;

const STORE = 'projectx_runtime_v7';
const LOCAL_KEY = 'projectx_guest_gemini_key';
const LOCAL_STATUS = 'projectx_guest_gemini_status';
const LOCAL_SETTINGS = 'projectx_settings_v6';
const GEMINI_KEY_URL = 'https://aistudio.google.com/app/apikey';
const MODELS = ['gemini-3.8-flash', 'gemini-3.5-flash-lite'];
const MAX_HISTORY = 80;
const LOCAL_AI_BUDGET = 'projectx_ai_budget_v1';
const GEMINI_MODEL_MIGRATIONS = new Map([
  ['gemini-2.0-flash', 'gemini-3.8-flash'],
  ['gemini-2.0-flash-lite', 'gemini-3.5-flash-lite'],
  ['gemini-2.5-flash', 'gemini-3.8-flash'],
  ['gemini-2.5-flash-lite', 'gemini-3.5-flash-lite'],
  ['gemini-3-flash-preview', 'gemini-3.8-flash'],
  ['gemini-3.1-flash-lite-preview', 'gemini-3.5-flash-lite']
]);

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));
const read = (k, fallback) => { try { return JSON.parse(localStorage.getItem(k) || 'null') ?? fallback; } catch { return fallback; } };
const write = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch { return false; } };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const now = () => new Date().toISOString();

const DEFAULT_SETTINGS = {
  model: MODELS[0], responseStyle: 'balanced', executionMode: 'Mostly Automatic', autoSave: true, confirmDelete: true,
  theme: 'dark', language: 'English', timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
  agentModels: { interviewer: MODELS[0], planner: MODELS[0], builder: MODELS[0], tester: MODELS[0], researcher: MODELS[0], orchestrator: MODELS[0] },
  agents: { interviewer: true, planner: true, builder: true, tester: true, researcher: true },
  notifications: { build: true, test: true, deploy: true, credits: true, security: true },
  skills: [],
  hideNav: false,
  hideAssistant: false,
  showBottom: false,
  splitFiles: false
};
const ExecutionProvider = {
  kind: 'sequential-local',
  isolatedWorkers: false,
  note: 'No isolated cloud workers are connected. Independent tasks can be queued; execution is sequential through the Assistant.'
};
const DeploymentProvider = {
  kind: 'github-pages-export',
  liveHosting: false,
  note: 'This workspace exports artifacts. GitHub Pages hosts the ProjectX app itself. Project publishing waits for a connected host.'
};

let state = read(STORE, { version: 7, projects: [], active: null });
if (!Array.isArray(state.projects)) state = { version: 7, projects: [], active: null };
else state.projects = state.projects.map(p => { try { return migrateProject(p); } catch { return p; } });
state.version = 7;
let settingsState = { ...DEFAULT_SETTINGS, ...read(LOCAL_SETTINGS, {}) };
if (!Array.isArray(settingsState.skills)) settingsState.skills = [];
settingsState.model = GEMINI_MODEL_MIGRATIONS.get(String(settingsState.model || '').trim().toLowerCase()) || settingsState.model;
if (settingsState.agentModels && typeof settingsState.agentModels === 'object') {
  const migratedAgentModels = {};
  for (const [id, model] of Object.entries(settingsState.agentModels)) {
    const normalized = String(model || '').trim();
    migratedAgentModels[id] = GEMINI_MODEL_MIGRATIONS.get(normalized.toLowerCase()) || normalized;
  }
  settingsState.agentModels = migratedAgentModels;
}
persistSettings();
let supa = null;
let session = null;
let currentModal = null;
let runtimeTestCleanup = null;
let projectRealtimeChannel = null;

function persistLocal() { write(STORE, state); }
function persistSettings() { write(LOCAL_SETTINGS, settingsState); }
function activeProject() { return state.projects.find(p => p.id === state.active) || null; }
function localGuestKey() { try { return sessionStorage.getItem(LOCAL_KEY) || ''; } catch { return ''; } }
function setGuestKey(value) { try { if (value) sessionStorage.setItem(LOCAL_KEY, value); else sessionStorage.removeItem(LOCAL_KEY); } catch {} }
function guestStatus() { return read(LOCAL_STATUS, null); }
function setGuestStatus(value) { write(LOCAL_STATUS, value ? { connected: true, hint: `••••${value.slice(-4)}`, at: now() } : { connected: false }); }

function ensureSupabase() {
  if (supa) return supa;
  const cfg = window.BUILDER_CONFIG;
  const factory = window.supabase?.createClient;
  if (!cfg?.SUPABASE_URL || !cfg?.SUPABASE_PUBLISHABLE_KEY || !factory) return null;
  try { supa = factory(cfg.SUPABASE_URL, cfg.SUPABASE_PUBLISHABLE_KEY, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } }); } catch { supa = null; }
  return supa;
}

async function refreshSession() {
  const client = ensureSupabase();
  if (!client) { session = null; return null; }
  try { const { data } = await client.auth.getSession(); session = data?.session || null; return session; } catch { session = null; return null; }
}

async function authAction(action, email, password) {
  const client = ensureSupabase();
  if (!client) throw new Error('Supabase authentication is not configured.');
  if (action === 'signup') {
    const { data, error } = await client.auth.signUp({ email, password });
    if (error) throw error;
    session = data.session || null;
    return data;
  }
  const { data, error } = await client.auth.signInWithPassword({ email, password });
  if (error) throw error;
  session = data.session || null;
  return data;
}

async function signOut() { try { projectRealtimeChannel&&await ensureSupabase()?.removeChannel(projectRealtimeChannel); } catch {} projectRealtimeChannel=null; try { await ensureSupabase()?.auth.signOut(); } catch {} session = null; }

async function edge(action, payload = {}) {
  const client = ensureSupabase();
  if (!client || !session?.access_token) throw new Error('SIGN_IN_REQUIRED');
  const { data, error } = await client.functions.invoke('ai', {
    body: { action, ...payload }
  });
  if (error) {
    let message = error.message || 'AI service error';
    try {
      const body = await error.context?.json?.();
      if (body?.error) message = body.error;
    } catch {}
    throw new Error(message);
  }
  if (!data || data.ok === false) throw new Error(data?.error || 'AI service error');
  return data;
}

function discoveryBrainOperations(project,data,answers,workspace){
  const ops=[];
  const add=(path,value)=>{if(value!==undefined&&value!==null)ops.push({op:'replace',path,value});};
  add('identity.title',project.title||data?.project?.title||'');
  add('identity.type',project.type||data?.project?.type||'Other');
  add('context.intent',project.goal||'');
  add('context.discoveryAnswers',Array.isArray(answers)?answers:[]);
  for(const field of ['requirements','constraints','decisions','dependencies','deliverables','acceptanceCriteria','successCriteria','openQuestions']){
    if(Array.isArray(project[field]))add('requirements.'+field,project[field].slice(0,100));
  }
  if(Array.isArray(project.resources))add('context.resources',project.resources.slice(-50));
  if(Array.isArray(workspace)&&workspace.length)add('workspace.sections',workspace.slice(0,12));
  const c=data?.classification&&typeof data.classification==='object'?data.classification:{};
  for(const key of ['work_shape','domains','outputs','execution_mode','risk_level','confidence','provenance','group','label','reason']){
    if(c[key]!==undefined)add('classification.'+key,c[key]);
  }
  return ops;
}

async function commitDiscoveryBrain(meta,project,data,answers,workspace){
  if(!session?.access_token||!meta?.remoteId)return null;
  const baseVersion=Number(meta.remoteVersion||1);
  const mutation={
    id:'discovery-'+baseVersion+'-'+Date.now(),
    baseVersion,
    provenance:{source:'agent',sourceId:'discovery',confidence:Math.max(0,Math.min(1,Number(data?.confidence??data?.classification?.confidence??0.7)||0.7)),userConfirmed:false},
    operations:discoveryBrainOperations(project,data,answers,workspace),
    changeSummary:'Update Project Brain from discovery'
  };
  const result=await edge('applyBrainMutation',{projectId:meta.remoteId,baseVersion,mutation,clientRequestId:mutation.id});
  if(result.status==='stale')throw new Error('The discovery draft changed on the server. Please reopen the project to continue.');
  if(result.project){const remote=migrateProject(result.project);meta.remoteVersion=Number(remote.specVersion||result.newVersion||baseVersion);meta.brain={...(meta.brain||{}),project:remote};}
  else if(result.newVersion)meta.remoteVersion=Number(result.newVersion);
  return result;
}

async function directGemini(messages, system, jsonMode = false, maxOutputTokens = 3000) {
  const key = localGuestKey();
  if (!key) throw Object.assign(new Error('Connect an AI provider in Settings before continuing.'), { code: 'NO_KEY' });
  const models = [...new Set([settingsState.model || MODELS[0], ...MODELS])];
  let last = new Error('AI unavailable');
  for (const model of models) {
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        if (attempt) await sleep(1200);
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 20000);
        const isGemini38 = /^gemini-3\\.8-flash$/i.test(String(model).trim());
        const generationConfig = { maxOutputTokens };
        // Gemini 3.8 uses thinking-level controls instead of legacy sampling params.
        if (!isGemini38) generationConfig.temperature = settingsState.responseStyle === 'concise' ? 0.15 : 0.25;
        if (jsonMode) generationConfig.responseMimeType = 'application/json';
        const body = { systemInstruction: { parts: [{ text: system }] }, contents: messages.slice(-MAX_HISTORY).map(m => ({ role: m.role === 'assistant' ? 'model' : 'user', parts: [{ text: String(m.text ?? '').slice(0, 12000) }] })), generationConfig };
        const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key }, body: JSON.stringify(body), signal: controller.signal });
        clearTimeout(timer);
        if (res.ok) {
          const d = await res.json();
          const text = d?.candidates?.[0]?.content?.parts?.map(p => p.text || '').join('').trim();
          if (text) return { text, model };
          last = new Error('Empty AI response.');
          break;
        }
        last = new Error((await res.text().catch(() => '')) || `Gemini ${res.status}`);
        if (res.status === 429 || res.status >= 500) continue;
        if (res.status === 401 || res.status === 403) break;
        break;
      } catch (e) { last = e?.name === 'AbortError' ? new Error('AI request timed out.') : e; }
    }
  }
  throw last;
}

const parseJson = text => {
  const raw = String(text ?? '').trim();
  if (!raw) return null;
  try { return JSON.parse(raw); } catch {}
  const fenced = raw.match(/\\`\\`\\`(?:json)?\\s*([\\s\\S]*?)\\s*\\`\\`\\`/i);
  if (fenced) { try { return JSON.parse(fenced[1]); } catch {} }
  for (let start = 0; start < raw.length; start++) {
    if (raw[start] !== '{') continue;
    let depth = 0, quote = false, escape = false;
    for (let i = start; i < raw.length; i++) {
      const ch = raw[i];
      if (quote) {
        if (escape) { escape = false; continue; }
        if (ch === '\\\\') { escape = true; continue; }
        if (ch === '"') quote = false;
        continue;
      }
      if (ch === '"') { quote = true; continue; }
      if (ch === '{') depth++;
      else if (ch === '}') {
        depth--;
        if (depth === 0) { try { return JSON.parse(raw.slice(start, i + 1)); } catch {} break; }
      }
    }
  }
  return null;
};

function effectiveMaxTokens(max){
  const mode=String(settingsState.executionMode||'Mostly Automatic');
  if(mode==='Fast')return Math.min(max,1800);
  if(mode==='Powerful')return Math.min(Math.max(max,4200),8000);
  return max;
}
function compactHistory(history){
  const mode=String(settingsState.executionMode||'Mostly Automatic');
  const cap=mode==='Fast'?8:mode==='Powerful'?24:12;
  return (Array.isArray(history)?history:[]).filter(m=>m&&m.text).slice(-cap).map(m=>({role:m.role,text:String(m.text).slice(0,mode==='Fast'?2500:6000)}));
}
function compactProject(project, extra={}){
  if(!project||typeof project!=='object')return {};
  const files=project.files&&typeof project.files==='object'?project.files:{};
  const paths=Object.keys(files).slice(0,80);
  const focus=extra.file&&files[extra.file]?{[extra.file]:String(files[extra.file]).slice(0,8000)}:{};
  if(!Object.keys(focus).length){
    for(const k of ['index.html','README.md','brief.md']) if(files[k]) focus[k]=String(files[k]).slice(0,6000);
  }
  const s=project.spec||{};
  const u=project.understanding||{};
  return {
    id:project.id,title:project.title,type:project.type,status:project.status,specVersion:project.specVersion,
    intent:String(project.intent||s.goal||'').slice(0,2000),
    spec:{goal:s.goal,requirements:(s.requirements||[]).slice(0,24),constraints:(s.constraints||[]).slice(0,16),decisions:(s.decisions||[]).slice(0,16),deliverables:(s.deliverables||[]).slice(0,12),platform:s.platform},
    understanding:{summary:u.summary,category:u.category,confidence:u.confidence,group:u.group},
    plan:Array.isArray(project.plan)?project.plan.slice(0,12):[],
    filePaths:paths,
    files:focus,
    tests:project.tests?{status:project.tests.status,specVersion:project.tests.specVersion}:null,
    tasks:(project.executionState?.tasks||[]).slice(0,16).map(t=>({id:t.id,title:t.title,status:t.status,agent:t.agent})),
    uiNav:project.uiNav||extra.nav||null,
    currentFile:extra.file||null
  };
}
function consumeGuestBudget(){
  const hour=Math.floor(Date.now()/3600000);
  const rec=read(LOCAL_AI_BUDGET,{hour:0,count:0});
  const next=rec.hour===hour?{hour,count:rec.count+1}:{hour,count:1};
  write(LOCAL_AI_BUDGET,next);
  return next.count;
}
function setAgentStatus(text){
  const el=$('#px-agent-status');if(el)el.textContent=text;
}
const AGENT_FOR_MODE = { understand:'interviewer', plan:'planner', artifact:'builder', discuss:'orchestrator' };
async function repairDiscoveryPoll(payload, parsed, maxTokens = 2600){
  const base=parsed&&typeof parsed==='object'?parsed:{};
  const repairSystem=`You are ProjectX's discovery poll generator. Return JSON only. Base every poll on the actual project context and the user's latest input. Preserve useful project information. Return poll with a short decision label and exactly four concise, concrete options. The decision is not a question. Options must be genuine candidate choices for the most important missing project detail. Never use generic placeholders, canned fallback phrases, unrelated choices, or question-form options. Do not include 'Describe in your own words'; ProjectX adds it as option five.`;
  try{
    const result=await directGemini(
      [{role:'user',text:`CURRENT PROJECT RESULT:\n${JSON.stringify(base)}\n\nLATEST USER INPUT:\n${String(payload.message||'')}`}],
      repairSystem,
      true,
      Math.min(2600,maxTokens)
    );
    const repaired=parseJson(result.text||'');
    if(repaired&&repaired.project&&validDiscoveryPollLocal(repaired.poll)) return repaired;
  }catch{}
  return null;
}

function validDiscoveryPollLocal(value){
  const decision=String(value?.decision||'').trim();
  const raw=Array.isArray(value?.options)?value.options.map(v=>String(v||'').trim()).filter(Boolean):[];
  const options=[...new Set(raw)].filter(v=>v.toLowerCase()!=='describe in your own words');
  if(!decision||/\?\s*$/.test(decision)||options.length!==4)return false;
  if(options.some(v=>/\?\s*$/.test(v)||v.length>160))return false;
  return true;
}



async function aiJson(mode, payload, max = 3500) {
  max=effectiveMaxTokens(max);
  const agent=String(payload.agent || AGENT_FOR_MODE[mode] || 'orchestrator');
  const preferred=String(settingsState.agentModels?.[agent] || settingsState.model || MODELS[0]);
  const packed=compactProject(payload.project||{},{file:payload.currentFile,nav:payload.project?.uiNav});
  const history=compactHistory(payload.history||[]);
  setAgentStatus('Thinking');
  if (session?.access_token) {
    const result = await edge('chat', { mode, agent, project: packed, message: payload.message || '', history, model: preferred, currentPath: payload.currentFile || null });
    setAgentStatus('Ready');
    if (result.result && typeof result.result === 'object') return result.result;
    const parsed = parseJson(result.text || '');
    if (parsed && typeof parsed === 'object') return parsed;
    if (mode === 'understand') {
      const seed = payload.project && typeof payload.project === 'object' ? payload.project : {};
      const text = String(payload.message || '').trim();
      const lower = text.toLowerCase();
      const type = String(seed.type || (/\\b(game|website|app|application|dashboard|api|software|tool)\\b/i.test(lower) ? 'Website' : 'Other'));
      return {
        done:false,
        question: seed.users?.length ? (seed.requirements?.length ? 'What should ProjectX produce for you at the end?' : 'What are the most important things this needs to do?') : 'Who is this primarily for?',
        confidence:0.4,
        missing: seed.users?.length ? (seed.requirements?.length ? ['deliverables'] : ['requirements']) : ['users'],
        ambiguities:[],
        classification:{group:/\b(game|website|web site|app|application|dashboard|api|software|tool|simulation|digital|virtual|fictional|story)\b/i.test(lower)?'NON_REAL_WORLD':'REAL_WORLD',label:'internal',reason:'internal'},
        category:seed.category || type,
        domainPack:{},
        project:{...seed,goal:String(seed.goal||text)},
        workspace:{sections:Array.isArray(seed.workspace?.sections)?seed.workspace.sections:[]},
        agents:Array.isArray(seed.agents)?seed.agents:[],
        summary:String(seed.summary||'Building the project brief from your request.')
      };
    }
    return null;
  }
  if(consumeGuestBudget()>40) throw Object.assign(new Error('Demo / guest AI usage is temporarily exhausted for this hour. Connect a provider in Settings, or wait and retry.'), { code: 'BUDGET' });
  const compactSystem=(payload.system||'You are ProjectX.')+'\n[PROJECT BRAIN]\n'+JSON.stringify(packed).slice(0,18000)+'\n[/PROJECT BRAIN]'+skillContext();
  const result = await directGemini(history.length?history:[{ role: 'user', text: payload.message || JSON.stringify(payload) }], compactSystem, true, max);
  setAgentStatus('Ready');
  const parsed=parseJson(result.text);
  if(mode==='understand'){
    if(parsed&&parsed.project&&validDiscoveryPollLocal(parsed.poll)) return parsed;
    const repaired=await repairDiscoveryPoll(payload,parsed);
    if(repaired) return repaired;
  }
  return parsed;
}

async function aiText(payload) {
  if (session?.access_token) {
    const result = await edge('chat', { mode: 'discuss', project: serializeForPersistence(payload.project || {}), message: payload.message || '', history: payload.history || [], model: settingsState.model });
    return result.text || '';
  }
  return (await directGemini(payload.history || [{ role: 'user', text: payload.message || '' }], payload.system || 'You are ProjectX.', false, 1800)).text;
}

function notify(message, kind = 'info') {
  $('#px-notice')?.remove();
  const node = document.createElement('div'); node.id = 'px-notice'; node.className = `notice ${kind}`; node.textContent = message; document.body.appendChild(node); setTimeout(() => node.remove(), 4500);
}
function installOptionalAnalytics(){
  const id=String(window.BUILDER_CONFIG?.GA_MEASUREMENT_ID||'').trim(),key='projectx_analytics_consent_v1';
  if(!id||window.__projectxAnalyticsInstalled)return;
  const consent=(()=>{try{return localStorage.getItem(key)}catch{return null}})();
  const load=()=>{if(window.__projectxAnalyticsLoaded)return;window.__projectxAnalyticsLoaded=true;window.dataLayer=window.dataLayer||[];window.gtag=function(){window.dataLayer.push(arguments)};window.gtag('js',new Date());window.gtag('config',id,{anonymize_ip:true,send_page_view:true});const s=document.createElement('script');s.async=true;s.src='https://www.googletagmanager.com/gtag/js?id='+encodeURIComponent(id);document.head.appendChild(s);};
  if(consent==='accept')load();
  if(consent)return;
  const banner=document.createElement('div');banner.className='analytics-banner';banner.innerHTML='<div><b>Privacy choices</b><div class="sub">Optional analytics is off until you allow it.</div></div><div class="actions"><button class="ghost" data-analytics="decline">Decline</button><button class="primary" data-analytics="accept">Allow</button></div>';document.body.appendChild(banner);
  banner.onclick=e=>{const choice=e.target.closest('[data-analytics]')?.dataset.analytics;if(!choice)return;try{localStorage.setItem(key,choice)}catch{}if(choice==='accept')load();banner.remove();};
  window.__projectxAnalyticsInstalled=true;
}

function installCss(){if($('#px-style'))return;const link=document.createElement('link');link.id='px-style';link.rel='stylesheet';link.href=appStylesheet;document.head.appendChild(link);}
function ensureShell(){installCss();let root=$('#px-app');if(!root){root=document.createElement('div');root.id='px-app';document.body.appendChild(root);}return root;}
function applyChromeLayout(){
  const sh=$('#px-shell');if(!sh)return;
  sh.classList.toggle('hide-left',Boolean(settingsState.hideNav));
  sh.classList.toggle('hide-right',Boolean(settingsState.hideAssistant));
  sh.classList.toggle('show-bottom',Boolean(settingsState.showBottom));
  const bottom=$('#px-bottom');if(bottom)bottom.hidden=!settingsState.showBottom;
}
function showShare(){
  const el=$('#px-share');if(!el)return;
  el.hidden=false;
  const input=$('#px-share-url');
  if(input)input.value=location.href;
}
function hideShare(){const el=$('#px-share');if(el)el.hidden=true;}
function copyShareLink(){
  const value=$('#px-share-url')?.value||location.href;
  (navigator.clipboard?.writeText(value)||Promise.reject()).then(()=>notify('Workspace link copied. This is not a published host.','success')).catch(()=>notify('Copy this URL: '+value,'info'));
}
function filterSideSearch(q){
  const query=String(q||'').toLowerCase();
  $$('#px-tool-nav [data-search], #px-tool-nav [data-project-tool]').forEach(btn=>{
    const hay=(btn.dataset.search||btn.textContent||'').toLowerCase();
    btn.hidden=Boolean(query)&&!hay.includes(query);
  });
  const p=activeProject();
  const hits=p&&query?Object.keys(p.files||{}).filter(f=>f.toLowerCase().includes(query)).slice(0,8):[];
  let extra=$('#px-file-hits');
  if(!hits.length){extra?.remove();return;}
  if(!extra){extra=document.createElement('div');extra.id='px-file-hits';extra.className='recent';$('#px-tool-nav')?.after(extra);}
  extra.innerHTML=hits.map(f=>`<button data-project-tool="files" data-open-file="${esc(f)}">${esc(f)}</button>`).join('');
}
function bindChrome(root){
  root.onclick=async e=>{
    const cmd=e.target.closest('[data-cmd]')?.dataset.cmd;
    if(cmd==='palette')return openPalette();
    if(cmd==='add-tool')return addProjectTool(activeProject());
    if(cmd==='toggle-assistant'){settingsState.hideAssistant=!settingsState.hideAssistant;persistSettings();applyChromeLayout();return;}
    if(cmd==='toggle-bottom'){settingsState.showBottom=!settingsState.showBottom;persistSettings();applyChromeLayout();return;}
    if(cmd==='toggle-nav'){settingsState.hideNav=!settingsState.hideNav;persistSettings();applyChromeLayout();return;}
    if(cmd==='share')return showShare();
    if(cmd==='share-close')return hideShare();
    if(cmd==='share-copy')return copyShareLink();
    if(e.target.closest('#px-nav-toggle')) return $('#px-shell')?.classList.toggle('nav-open');
    if(e.target.closest('#px-project-switch')){
      const list=$('#px-switch-list');if(list)list.hidden=!list.hidden;return;
    }
    if(!e.target.closest('#px-switch-list')) {const list=$('#px-switch-list');if(list)list.hidden=true;}
    if(!e.target.closest('#px-ctx')) {const ctx=$('#px-ctx');if(ctx)ctx.hidden=true;}
    if(e.target.closest('#px-share')&&!e.target.closest('.px-share-box')) hideShare();
    const openFile=e.target.closest('[data-open-file]')?.dataset.openFile;
    if(openFile){const p=activeProject();if(p){p.uiFilePath=openFile;p.uiNav='files';saveProject(p);return renderProject(p);}}
    const nav=e.target.closest('[data-nav]')?.dataset.nav;if(nav)return navigate(nav);
    const open=e.target.closest('[data-open]')?.dataset.open;if(open)return openProject(open);
    const action=e.target.closest('[data-action]')?.dataset.action;
    if(action==='signin')return authModal('signin');
    if(action==='signup')return authModal('signup');
    if(action==='signout'){await signOut();home();}
    const example=e.target.closest('[data-example]')?.dataset.example;
    if(example){try{sessionStorage.setItem('projectx_pending_intent',example);}catch{} state.forceWorkspace=true;workspaceHome();const input=$('#start-input');if(input)input.value=example;}
  };
  const search=$('#px-side-search',root);
  if(search&&!search.dataset.bound){search.dataset.bound='1';search.oninput=()=>filterSideSearch(search.value);}
  bindSplit(root);
  applyChromeLayout();
}
function bindSplit(root){
  const split=$('#px-split-right',root);if(!split||split.dataset.bound)return;split.dataset.bound='1';
  split.onpointerdown=e=>{
    const startX=e.clientX,start=parseInt(getComputedStyle(document.documentElement).getPropertyValue('--px-right'))||360;
    const move=ev=>{const w=Math.min(520,Math.max(260,start-(ev.clientX-startX)));document.documentElement.style.setProperty('--px-right',w+'px');};
    const up=()=>{window.removeEventListener('pointermove',move);window.removeEventListener('pointerup',up);};
    window.addEventListener('pointermove',move);window.addEventListener('pointerup',up);
  };
}
function addProjectTool(project){
  if(!project)return;
  const visible=new Set(UI.navForProject(project).map(n=>n[0]));
  const pick=UI.PROJECT_NAV.find(([id])=>!visible.has(id));
  if(!pick)return notify('All tools are already visible.','info');
  project.uiHiddenTools=(project.uiHiddenTools||[]).filter(id=>id!==pick[0]);
  project.uiToolOrder=[...UI.navForProject(project).map(n=>n[0]),pick[0]];
  saveProject(project);renderProject(project);notify(pick[1]+' added to the project sidebar.','success');
}
function shell(body, active='home', opts={}){
  const root=ensureShell();
  root.classList.remove('px-public');
  const recents=state.projects.slice(0,6);
  const project=opts.project||null;
  const right=opts.right;
  root.innerHTML=UI.chrome({esc,session,recents,active,body,project,nav:opts.nav||active,right,status:opts.status,email:session?.user?.email,execNote:ExecutionProvider.note});
  bindChrome(root);
  bindPalette();
  bindDock(opts.project);
  return root;
}
function bindDock(project){
  if(!project)return;
  const form=$('#assistant-dock-form');
  if(form)form.onsubmit=async e=>{e.preventDefault();const text=$('#assistant-dock-input')?.value.trim();if(!text)return;$('#assistant-dock-input').value='';await sendProjectMessage(project,text);};
  const plan=$('#plan-dock-form');
  if(plan)plan.onsubmit=e=>{
    e.preventDefault();
    const text=$('#plan-dock-input')?.value.trim();
    if(!text)return;
    $('#plan-dock-input').value='';
    const task=addTask(project,text,{status:'draft',description:text});
    const log=$('#px-bottom-log');
    if(log)log.insertAdjacentHTML('beforeend',`<div class="msg ai">Queued: ${esc(task.title)}. Execution is sequential through Assistant — no remote worker started.</div>`);
    if(!settingsState.showBottom){settingsState.showBottom=true;persistSettings();applyChromeLayout();}
    notify('Task queued. Work stays sequential.','info');
  };
  $$('[data-assist-action]').forEach(btn=>btn.onclick=()=>{
    const a=btn.dataset.assistAction;
    const input=$('#assistant-dock-input')||$('#project-input');
    if(input){input.value=(input.value?input.value+' ':'')+a+': ';input.focus();}
  });
}
function workspaceHome(){
  shell(UI.launcherMarkup({esc,session,projects:state.projects,guestReady:Boolean(localGuestKey())}),'home');
  const input=$('#start-input');
  try{const pending=sessionStorage.getItem('projectx_pending_intent');if(pending&&input&&!input.value){input.value=pending;sessionStorage.removeItem('projectx_pending_intent');}}catch{}
  $('#start-send').onclick=()=>beginCreation(input.value);
  input.onkeydown=e=>{if((e.ctrlKey||e.metaKey)&&e.key==='Enter'){e.preventDefault();$('#start-send').click();}};
  $$('[data-template]').forEach(btn=>btn.onclick=()=>{
    const t=UI.TEMPLATES.find(x=>x.id===btn.dataset.template);if(!t)return;
    const p=createProjectFromIntent({title:t.title,type:t.type,goal:t.intent,deliverables:t.deliverables});
    p.understanding={summary:t.intent,category:t.type,confidence:0.5};
    saveProject(p);openProject(p.id);
  });
}
function publicHome(){
  const root=ensureShell();
  root.classList.add('px-public');
  root.innerHTML=UI.publicMarkup();
  $('#public-signin').onclick=()=>authModal('signin');
  $('#public-signup').onclick=()=>authModal('signup');
  $('#public-start').onclick=()=>{state.forceWorkspace=true;workspaceHome();};
  $('#public-workspace').onclick=()=>{state.forceWorkspace=true;workspaceHome();};
  $('#public-examples').onclick=()=>$('#px-examples')?.scrollIntoView({behavior:'smooth'});
}

function home(){
  if(session||state.forceWorkspace||state.projects.length)return workspaceHome();
  publicHome();
}
async function beginCreation(text){
  const intent=String(text||'').trim();
  if(!intent)return;
  if(!session&&!localGuestKey()){
    const draft=createProjectFromIntent({title:intent.length>72?intent.slice(0,72).trim()+'…':intent,type:'Other',goal:intent,deliverables:['Project outcome']});
    draft.status='needs-ai';
    draft.understanding={summary:'Local draft. Connect AI to continue discovery.',confidence:0.2};
    saveProject(draft);
    notify('Project created locally. Connect AI in Settings to run discovery.','info');
    return openProject(draft.id);
  }
  const history=[{role:'user',text:intent}];
  const meta={answers:[],brain:null,initialIntent:intent};
  try{
    if(session?.access_token){
      const draft=await edge('createProjectFromIntent',{intent:{
        title:intent.length>72?intent.slice(0,72).trim()+'…':intent,
        type:'Other',
        goal:intent,
        status:'discovery'
      }});
      if(!draft?.projectId)throw new Error('ProjectX could not create the discovery workspace.');
      meta.remoteId=draft.projectId;
      meta.remoteVersion=Number(draft.version||draft.project?.specVersion||1);
      meta.brain={project:draft.project||{},workspace:draft.project?.sections||[],understanding:draft.project?.understanding||{}};
    }
    renderInterview(history,meta);
    await continueInterview(history,meta.answers,meta);
  }catch(error){
    $('#interview-status')&&($('#interview-status').textContent='Could not start discovery: '+String(error.message||error));
  }
}
function renderInterview(history,meta){
  shell(UI.interviewMarkup(),'home');
  meta.initialIntent=String(history?.[0]?.text||'').trim();
}function drawConversation(history,selector){const el=$(selector);if(!el)return;el.innerHTML=history.map(m=>`<div class="msg ${m.role==='user'?'user':'ai'}">${esc(m.text)}</div>`).join('');el.scrollTop=el.scrollHeight;}
function mergeDiscoveryProject(previous={},next={}){
  const out={...(previous||{})};
  const scalar=['title','goal','type','platform','visualDirection','currentState'];
  for(const key of scalar) if(next&&typeof next[key]==='string'&&next[key].trim()) out[key]=next[key].trim();
  for(const key of ['users','requirements','constraints','features','decisions','dependencies','assets','deliverables','acceptanceCriteria','successCriteria','technology']){
    if(Array.isArray(next?.[key])) out[key]=[...new Set([...(Array.isArray(out[key])?out[key]:[]),...next[key].map(v=>String(v??'').trim()).filter(Boolean)])];
  }
  if(Array.isArray(next?.openQuestions)) out.openQuestions=next.openQuestions.map(v=>String(v??'').trim()).filter(Boolean);
  if(next?.game&&typeof next.game==='object') out.game={...(out.game||{}),...Object.fromEntries(Object.entries(next.game).filter(([k,v])=>typeof v==='boolean'?true:String(v??'').trim()))};
  if(Array.isArray(next?.plan)&&next.plan.length) out.plan=next.plan.slice(0,50).map(x=>typeof x==='string'?{title:x,status:'proposed',steps:[]}:x).filter(Boolean);
  if(Array.isArray(next?.agents)&&next.agents.length) out.agents=next.agents.slice(0,12);
  if(next?.domainPack&&typeof next.domainPack==='object') out.domainPack={...(out.domainPack||{}),...next.domainPack};
  return out;
}
function renderDiscoveryPoll(poll,meta,history){
  const root=$('#interview-poll');
  if(!root)return;
  const status=$('#interview-status');
  if(status)status.textContent='';
  const decision=String(poll?.decision||'').trim();
  const aiOptions=Array.isArray(poll?.options)?poll.options.map(v=>String(v||'').trim()).filter(Boolean):[];
  const options=[...new Set(aiOptions)].filter(v=>v.toLowerCase()!=='describe in your own words').slice(0,4);

  if(!decision||/\?\s*$/.test(decision)||options.length!==4||options.some(v=>/\?\s*$/.test(v))){
    root.innerHTML='<div class="poll-card"><div class="poll-title">The AI could not generate a contextual poll.</div><div class="sub" style="margin-top:6px">Nothing generic was substituted. Generate a fresh decision from the current project context.</div><div class="actions"><button type="button" class="ghost" id="poll-retry">Regenerate poll</button></div></div>';
    $('#poll-retry')?.addEventListener('click',async()=>{
      const button=$('#poll-retry'); if(button)button.disabled=true;
      if(status)status.textContent='Generating a new contextual poll…';
      try{await regenerateDiscoveryPoll(history,meta);}
      catch(error){if(status)status.textContent='Could not regenerate the poll: '+String(error?.message||error);if(button)button.disabled=false;}
    });
    return;
  }

  const renderedOptions=[...options,'Describe in your own words'];
  root.innerHTML=`<div class="poll-card">
    <div class="poll-head">
      <div class="poll-eyebrow">PROJECT DECISION</div>
      <div class="poll-title">${esc(decision)}</div>
    </div>
    <div class="poll-options" role="radiogroup" aria-label="${esc(decision)}">
      ${renderedOptions.map((option,i)=>`<button type="button" class="poll-option" data-poll-index="${i}" aria-pressed="false"><span class="poll-radio" aria-hidden="true"></span><span>${esc(option)}</span></button>`).join('')}
    </div>
    <div class="poll-actions actions">
      <button type="button" class="ghost" id="poll-regenerate">Regenerate</button>
    </div>
    <div id="poll-custom" class="poll-custom" hidden>
      <textarea id="poll-custom-input" placeholder="Describe it in your own words..." maxlength="1200"></textarea>
      <button type="button" class="primary" id="poll-custom-send">Continue</button>
    </div>
  </div>`;

  root.querySelectorAll('[data-poll-index]').forEach(button=>{
    button.onclick=async()=>{
      const index=Number(button.dataset.pollIndex||0);
      root.querySelectorAll('[data-poll-index]').forEach(x=>{
        x.classList.remove('selected');
        x.setAttribute('aria-pressed','false');
      });
      button.classList.add('selected');
      button.setAttribute('aria-pressed','true');
      if(index===4){
        $('#poll-custom')?.removeAttribute('hidden');
        $('#poll-custom-input')?.focus();
        return;
      }
      await submitDiscoveryChoice(renderedOptions[index],history,meta);
    };
  });

  $('#poll-regenerate')?.addEventListener('click',async()=>{
    const button=$('#poll-regenerate'); if(button)button.disabled=true;
    root.querySelectorAll('[data-poll-index]').forEach(x=>x.disabled=true);
    if(status)status.textContent='Generating a new contextual poll…';
    try{await regenerateDiscoveryPoll(history,meta);}
    catch(error){if(status)status.textContent='Could not regenerate the poll: '+String(error?.message||error);if(button)button.disabled=false;root.querySelectorAll('[data-poll-index]').forEach(x=>x.disabled=false);}
  });

  $('#poll-custom-send')?.addEventListener('click',async()=>{
    const value=String($('#poll-custom-input')?.value||'').trim();
    if(!value)return;
    await submitDiscoveryChoice(value,history,meta);
  });
  $('#poll-custom-input')?.addEventListener('keydown',e=>{
    if((e.ctrlKey||e.metaKey)&&e.key==='Enter')$('#poll-custom-send')?.click();
  });
}

async function regenerateDiscoveryPoll(history,meta={}){
  const latest=String(history?.[history.length-1]?.text||meta?.initialIntent||'').trim();
  if(!latest)throw new Error('No current project context is available.');
  const instruction=latest+'\n\n[PROJECTX ACTION: Regenerate ONLY the current discovery poll. Do not finish discovery, do not create a project, do not change the underlying project understanding, and return a valid discovery result with done=false and a fresh poll with exactly four new concrete candidate options.]';
  const nextMeta={...meta,messageOverride:instruction,regeneratingPoll:true};
  await continueInterview(history,Array.isArray(meta.answers)?meta.answers:[],nextMeta);
}

async function submitDiscoveryChoice(value,history,meta){
  const text=String(value||'').trim();
  if(!text)return;
  $$('#interview-poll .poll-option').forEach(x=>x.disabled=true);
  $('#poll-custom-send')?.setAttribute('disabled','disabled');

  history.push({role:'user',text});
  meta.answers=Array.isArray(meta.answers)?meta.answers:[];
  meta.answers.push(text);
  try{await continueInterview(history,meta.answers,meta);}
  catch(error){
    const status=$('#interview-status');
    if(status)status.textContent='Could not update the poll: '+String(error?.message||error);
    $$('#interview-poll .poll-option').forEach(x=>x.disabled=false);
    $('#poll-custom-send')?.removeAttribute('disabled');
  }
}
function renderInterviewUnderstanding(data){
  const root=$('#interview-understanding');
  if(!root)return;
  const category=String(data?.category||'').trim();
  const summary=String(data?.summary||'').trim();
  const missing=Array.isArray(data?.missing)?data.missing.slice(0,4):[];
  const project=data?.project||{};
  const known=[
    project.goal&&`Goal: ${project.goal}`,
    Array.isArray(project.users)&&project.users.length&&`Users: ${project.users.slice(0,3).join(', ')}`,
    Array.isArray(project.requirements)&&project.requirements.length&&`Requirements: ${project.requirements.slice(0,2).join('; ')}`,
    Array.isArray(project.deliverables)&&project.deliverables.length&&`Deliverable: ${project.deliverables.slice(0,2).join('; ')}`
  ].filter(Boolean).slice(0,4);
  root.innerHTML=`<div class="understanding-main"><div class="understanding-copy"><div class="understanding-eyebrow">PROJECT BRIEF</div><div class="understanding-title">What ProjectX understands</div><div class="sub understanding-summary">${esc(summary||'Building the project brief from your request.')}</div>${category?`<div class="understanding-category">Focus · ${esc(category)}</div>`:''}${known.length?`<div class="understanding-known">${known.map(x=>`<span>${esc(x)}</span>`).join('')}</div>`:''}${missing.length?`<div class="understanding-meta"><span>Project brief is still being refined</span></div>`:''}</div></div>`;
}
const interviewSystem = "You are ProjectX's discovery architect. Treat the user's original request as the source of truth. Classify multidimensionally with work_shape (build, investigate, create, plan, operate, decide, learn, solve), domains (software, research, business, creative, planning, real_world, education, game, engineering, personal), outputs (app, website, code, report, presentation, document, plan, checklist, campaign, dataset, prototype, physical_steps), execution_mode (digital, physical, mixed), and risk_level (low, consequential, regulated_or_high_impact). Multiple domains are allowed. Never force a single category or a REAL_WORLD/NON_REAL_WORLD binary. Ask only when an answer materially changes workflow, deliverable, scope, risk, tools, acceptance criteria, or next action. Generate exactly one contextual poll at a time with exactly four concrete candidate values; the runtime adds the fifth fixed choice 'Describe in your own words'. Never use generic filler, duplicates, unrelated options, or question-form options. Return JSON only with classification, category, domainPack, project, workspace, agents, confidence, missing, ambiguities, summary, and poll. Project should contain title,type,goal,users,requirements,constraints,features,decisions,dependencies,assets,deliverables,acceptanceCriteria,successCriteria,openQuestions,platform,technology,visualDirection,game,plan. Workspace sections must be genuinely relevant to the actual request. Never invent facts.";async function continueInterview(history, answers, meta={}){
  $('#interview-status')&&($('#interview-status').textContent='Thinking…');
  try{
    const discoveryProject=meta.brain?.project||{};
    const discoveryUnderstanding=meta.brain?.understanding||{};
    const data=await aiJson('understand',{
      project:{...discoveryProject,understanding:discoveryUnderstanding},
      history,
      message:meta.messageOverride||history[history.length-1]?.text||'',
      system:interviewSystem
    },3600);
    if(!data||!data.project)throw new Error('The AI returned no usable project-understanding result.');

    const mergedProject=mergeDiscoveryProject(discoveryProject,data.project);
    const priorWorkspace=Array.isArray(meta.brain?.workspace)?meta.brain.workspace:[];
    const workspaceCandidate=Array.isArray(data.workspace?.sections)&&data.workspace.sections.length?data.workspace.sections:priorWorkspace;
    const classification=data.classification&&typeof data.classification==='object'?data.classification:{};
    const group=String(classification.group||discoveryUnderstanding.group||'').trim().toUpperCase();
    const category=String(data.category||discoveryUnderstanding.category||'').trim();
    const summary=String(data.summary||discoveryUnderstanding.summary||'').trim();

    meta.brain={
      project:mergedProject,
      workspace:workspaceCandidate,
      understanding:{
        ...(discoveryUnderstanding||{}),
        confidence:Number(data?.confidence??classification?.confidence??0),
        missing:Array.isArray(data?.missing)?data.missing:[],
        ambiguities:Array.isArray(data?.ambiguities)?data.ambiguities:[],
        group,category,summary,
        domainPack:data.domainPack||discoveryUnderstanding.domainPack||{},
        classification
      }
    };

    if(session?.access_token&&meta.remoteId){
      await commitDiscoveryBrain(meta,mergedProject,data,Array.isArray(meta.answers)?meta.answers:[],workspaceCandidate);
    }

    const type=normalizeProjectType(mergedProject.type||data.project.type||'Other');
    const safeCategory=category.slice(0,120);
    const spec=mergeSpec({},mergedProject);
    const quality=validateSpec(spec,type);
    const declaredMissing=Array.isArray(data.missing)?data.missing:[];
    const ambiguities=Array.isArray(data.ambiguities)?data.ambiguities:[];
    const missing=[...new Set([...quality.missing,...declaredMissing,...(Array.isArray(spec.openQuestions)?spec.openQuestions:[])])];
    const confidence=Number(data.confidence??classification.confidence??0);
    const workspace=(Array.isArray(workspaceCandidate)?workspaceCandidate:[]).filter(x=>x&&String(x.name||'').trim()).slice(0,8);
    const done=!meta.regeneratingPoll&&data.done===true&&quality.valid&&confidence>=.82&&missing.length===0&&ambiguities.length===0&&workspace.length>=2;
    meta.messageOverride='';

    if(!done){
      if(!validDiscoveryPollLocal(data?.poll)){
        throw new Error('The AI returned invalid contextual poll options. No generic choices were substituted.');
      }
      renderDiscoveryPoll(data.poll,meta,history);
      return;
    }

    const normalizedUnderstanding={
      confidence,missing:[],ambiguities:[],method:session?'secure-ai':'guest-ai',
      group,groupLabel:group==='REAL_WORLD'?'REAL-WORLD':group==='NON_REAL_WORLD'?'NON-REAL-WORLD':'',
      category:safeCategory||type,
      domainPack:data.domainPack||mergedProject.domainPack||{},
      executionType:type,
      classification:classification||{},
      summary:summary||''
    };

    if(session?.access_token&&meta.remoteId){
      const ready=await edge('applyBrainMutation',{
        projectId:meta.remoteId,
        baseVersion:Number(meta.remoteVersion||1),
        mutation:{
          id:'discovery-ready-'+Date.now(),
          baseVersion:Number(meta.remoteVersion||1),
          provenance:{source:'system',sourceId:'discovery-complete',confidence:confidence||0.9,userConfirmed:false},
          operations:[{op:'replace',path:'execution.status',value:'ready'}],
          changeSummary:'Complete discovery brief'
        }
      });
      if(ready.status==='stale')throw new Error('The discovery project changed on the server. Reopen the project before continuing.');
      meta.remoteVersion=Number(ready.newVersion||meta.remoteVersion||1);

      const planned=await edge('createPlan',{projectId:meta.remoteId});
      meta.remoteVersion=Number(planned.newVersion||meta.remoteVersion||1);

      const remoteProject=await edge('getProject',{projectId:meta.remoteId});
      if(remoteProject.project){
        const saved=migrateProject(remoteProject.project);
        saved.category=safeCategory||type;
        saved.understanding=normalizedUnderstanding;
        saveProject(saved,true);
        openProject(saved.id);
        return;
      }
      openProject(meta.remoteId);
      return;
    }

    const project=createProject({
      title:mergedProject.title||data.project.title,
      type,
      intent:mergedProject.goal||history[0].text,
      spec,
      sections:workspace,
      conversation:history,
      agents:Array.isArray(mergedProject.agents)?mergedProject.agents:[],
      plan:Array.isArray(mergedProject.plan)?mergedProject.plan:[]
    });
    project.category=safeCategory||type;
    project.understanding=normalizedUnderstanding;
    project.status='ready';
    saveProject(project,true);
    await syncRemoteProject(project);
    openProject(project.id);
  }catch(error){
    $('#interview-status')&&($('#interview-status').textContent='Discovery failed safely: '+String(error.message||error)+'. No project was created from partial or fallback data.');
  }
}


function saveProject(project,initial=false){if(initial)snapshot(project,'Initial project');const i=state.projects.findIndex(p=>p.id===project.id);if(i>=0)state.projects[i]=project;else state.projects.unshift(project);state.active=project.id;persistLocal();}
function snapshot(project,label){project.versions=Array.isArray(project.versions)?project.versions:[];project.versions.push({version:project.specVersion,label,at:now(),title:project.title,type:project.type,understanding:JSON.parse(JSON.stringify(project.understanding||{})),sections:JSON.parse(JSON.stringify(project.sections||[])),spec:JSON.parse(JSON.stringify(project.spec)),files:JSON.parse(JSON.stringify(project.files||{})),artifacts:JSON.parse(JSON.stringify(project.artifacts||{})),research:JSON.parse(JSON.stringify(project.research||{}))});if(project.versions.length>20)project.versions.splice(0,project.versions.length-20);}
async function syncRemoteProjects(){await refreshSession();if(!session)return;try{const result=await edge('listProjects');for(const remoteRaw of result.projects||[]){const remote=migrateProject(remoteRaw);const local=state.projects.find(p=>p.id===remote.id);if(!local||new Date(remote.updatedAt)>new Date(local.updatedAt||0)){const i=state.projects.findIndex(p=>p.id===remote.id);if(i>=0)state.projects[i]=remote;else state.projects.push(remote);}}persistLocal();}catch(e){notify(`Cloud sync unavailable: ${e.message}`,'error');}}
async function syncRemoteProject(project){if(!session||!settingsState.autoSave)return;try{const result=await edge('persistProject',{project:serializeForPersistence(project)});project.sync={remoteId:result.projectId||project.id,mode:'cloud',lastSyncedAt:now(),baseUpdatedAt:result.updatedAt||now()};persistLocal();}catch(e){project.sync={remoteId:project.sync?.remoteId||project.id,mode:'local',lastSyncedAt:project.sync?.lastSyncedAt||null,baseUpdatedAt:project.sync?.baseUpdatedAt||null,error:e.message};persistLocal();}}
async function subscribeProjectRealtime(projectId){
  if(!session||!ensureSupabase()||!projectId)return;
  try{if(projectRealtimeChannel)await supa.removeChannel(projectRealtimeChannel);}catch{}
  projectRealtimeChannel=supa.channel('projectx-project-'+projectId)
    .on('postgres_changes',{event:'UPDATE',schema:'public',table:'projects',filter:'id=eq.'+projectId},async payload=>{
      const current=activeProject(),remoteUpdated=String(payload?.new?.updated_at||'');
      if(!current||current.id!==projectId||!remoteUpdated)return;
      if(new Date(remoteUpdated).getTime()<=new Date(current.updatedAt||0).getTime())return;
      try{
        const result=await edge('getProject',{projectId});
        if(result.project){
          const remote=migrateProject(result.project);
          const i=state.projects.findIndex(p=>p.id===projectId);
          if(i>=0)state.projects[i]=remote;else state.projects.push(remote);
          state.active=projectId;persistLocal();renderProject(remote);notify('Project updated from another session.','info');
        }
      }catch{}
    }).subscribe();
}
async function openProject(id){const project=state.projects.find(p=>p.id===id);if(!project)return;state.active=id;persistLocal();renderProject(project);if(session){try{const result=await edge('getProject',{projectId:id});if(result.project){const remote=migrateProject(result.project);const i=state.projects.findIndex(p=>p.id===id);if(i>=0)state.projects[i]=remote;else state.projects.push(remote);state.active=id;persistLocal();renderProject(remote);}}catch{} await subscribeProjectRealtime(id);}}
function renderProject(project){
  project.uiNav=project.uiNav||(Object.keys(project.files||{}).length?'files':'assistant');
  const actions=UI.CONTEXT_ACTIONS[project.uiNav]||UI.CONTEXT_ACTIONS.default;
  const assistantDock=UI.assistantDock({esc,project,actions});
  shell(UI.projectHead({esc,project}),'projects',{project,nav:project.uiNav,right:assistantDock,status:'Project v'+project.specVersion+' · '+ExecutionProvider.kind});
  $$('.tab',$('#px-app')).forEach(button=>button.onclick=()=>{project.selectedSection=button.dataset.section;saveProject(project);renderProject(project)});
  $$('[data-project-tool]',$('#px-app')).forEach(button=>button.onclick=()=>{project.uiNav=button.dataset.projectTool;saveProject(project);renderProjectTool(project,button.dataset.projectTool);});
  if(project.uiNav==='overview'||project.uiNav==='assistant'||!project.uiNav){
    renderSection(project,project.sections.find(s=>s.id===project.selectedSection)||project.sections[0]);
  } else {
    renderProjectTool(project,project.uiNav);
  }
  const dockLog=$('#assistant-dock-log');
  if(dockLog&&Array.isArray(project.conversation)){
    dockLog.innerHTML=project.conversation.slice(-MAX_HISTORY).map(m=>`<div class="msg ${m.role==='user'?'user':'ai'}">${esc(m.text)}</div>`).join('');
    dockLog.scrollTop=dockLog.scrollHeight;
  }
}
async function renderProjectTool(project,tool){
  const body=$('#project-body');
  if(!body&&tool!=='settings'){
    project.uiNav=tool;
    return renderProject(project);
  }
  const map={
    brain:renderBrain,architecture:renderArchitecture,simulation:renderSimulation,explain:renderExplain,improve:renderMakeGreat,optimize:renderOptimize,transform:renderTransform,versions:renderVersions,resources:renderResources,security:renderProjectSecurity,delivery:renderDelivery,
    overview:renderOverview,assistant:()=>renderProjectChat(project),build:()=>renderOutput(project),design:()=>renderCanvas(project),files:()=>renderFiles(project),preview:()=>renderOutput(project),tasks:()=>renderTasks(project),artifacts:()=>renderArtifacts(project),database:()=>renderDatabase(project),research:()=>{const section=project.sections.find(s=>s.kind==='research')||{id:'research',name:'Research',purpose:'Source-backed evidence',kind:'research'};return renderResearchSection(project,section);},tests:()=>renderTests(project),storage:()=>renderStorage(project),integrations:()=>renderIntegrations(project),deploy:()=>renderDeploy(project),settings:()=>settingsPage('general'),git:()=>renderVersions(project),secrets:()=>renderSecrets(project),seo:()=>renderSeo(project),terminal:()=>renderTerminal(project),collab:()=>renderCollab(project)
  };
  return (map[tool]||renderBrain)(project);
}
function toolShell(kicker,title,description,body){
  const root=$('#project-body');if(!root)return;
  root.innerHTML='<div class="box"><div class="kicker">'+esc(kicker)+'</div><h2 style="margin:4px 0 6px">'+esc(title)+'</h2><div class="sub">'+esc(description)+'</div><div style="margin-top:16px">'+body+'</div></div>';
}
function brainList(title,items){
  const values=(items||[]).filter(Boolean);
  return '<div class="brain-group"><b>'+esc(title)+'</b>'+(values.length?values.map(x=>'<div class="brain-row">'+esc(typeof x==='string'?x:(x.name||x.title||x.url||x.content||JSON.stringify(x)))+'</div>').join(''):'<div class="sub">Nothing recorded yet.</div>')+'</div>';
}
function renderBrain(project){
  const u=project.understanding||{},s=project.spec||{};
  const rows=[
    u.group?'Classification: '+(u.group==='REAL_WORLD'?'REAL-WORLD':'NON-REAL-WORLD'):'',
    u.category?'Category: '+u.category:'',
    u.summary?'Summary: '+u.summary:'',
    Number(u.confidence)?'Confidence: '+Math.round(Number(u.confidence)*100)+'%':''
  ];
  const domain=project.understanding?.domainPack||{};
  const context=[s.platform?'Platform: '+s.platform:'',Array.isArray(s.technology)&&s.technology.length?'Technology: '+s.technology.join(', '):'',s.currentState?'Current state: '+s.currentState:''].filter(Boolean);
  const domainRows=[domain.name?'Domain: '+domain.name:'',...(Array.isArray(domain.terms)?domain.terms.slice(0,6).map(x=>'Term: '+x):[]),...(Array.isArray(domain.considerations)?domain.considerations.slice(0,5).map(x=>'Consideration: '+x):[]),...(Array.isArray(domain.metrics)?domain.metrics.slice(0,5).map(x=>'Metric: '+x):[])].filter(Boolean);
  const planRows=Array.isArray(project.plan)?project.plan.map(x=>typeof x==='string'?x:(x?.title||'')).filter(Boolean):[];
  const html=brainList('Understanding',rows)+brainList('Domain intelligence',domainRows)+brainList('Project context',context)+brainList('Plan',planRows)+brainList('Requirements',s.requirements)+brainList('Constraints',s.constraints)+brainList('Decisions',s.decisions)+brainList('Deliverables',s.deliverables)+brainList('Success criteria',s.successCriteria)+brainList('Dependencies',s.dependencies)+brainList('Open questions',s.openQuestions)+brainList('Known resources',s.resources)+
    '<div class="brain-group"><b>Capture a decision</b><form id="decision-form" class="form" style="margin-top:8px"><input id="decision-value" class="input full" maxlength="600" placeholder="Record an important project decision"><button class="primary">Save decision</button></form><div class="sub" style="margin-top:6px">Decisions become part of the canonical project brain.</div></div>';
  toolShell('PROJECT BRAIN','Canonical project state','Read-only project knowledge with a quick decision capture. Changes are versioned in the canonical project model.',html);
  $('#decision-form').onsubmit=e=>{e.preventDefault();const value=$('#decision-value').value.trim();if(!value)return;const mutation=applyProjectMutation(project,{specPatch:{decisions:{add:[value]}}});if(mutation.changed){project.status='changed';saveProject(project);syncRemoteProject(project);notify('Decision captured in the project brain.','success');}renderBrain(project);};
}
function renderArchitecture(project){
  const sections=buildDependencyMap(project.sections||[]);
  const cards=sections.map(s=>'<div class="architecture-node"><b>'+esc(s.name)+'</b><div class="sub">'+esc(s.kind)+' · '+esc(s.agent||'planner')+'</div>'+(s.capabilities?.length?'<div class="sub" style="margin-top:5px">Capabilities: '+esc(s.capabilities.join(', '))+'</div>':'')+(s.dependsOn?.length?'<div class="sub" style="margin-top:5px">Depends on: '+esc(s.dependsOn.map(id=>(sections.find(x=>x.id===id)||{}).name||id).join(', '))+'</div>':'')+'</div>').join('');
  const agents=(project.agents||[]).map(a=>'<div class="architecture-node"><b>'+esc(a.name||a.key||a.id)+'</b><div class="sub">'+esc(a.purpose||'Project specialist')+'</div>'+(a.tools?.length?'<div class="sub" style="margin-top:5px">Tools: '+esc(a.tools.join(', '))+'</div>':'')+'</div>').join('');
  toolShell('PROJECT INTELLIGENCE','Live Architecture','Dependency view generated from the current project sections and assembled specialists.','<h3 style="margin:0 0 8px">Workspace graph</h3><div class="architecture-grid">'+(cards||'<div class="placeholder">No architecture nodes yet.</div>')+'</div><h3 style="margin:18px 0 8px">Specialists</h3><div class="architecture-grid">'+(agents||'<div class="placeholder">No project-specific specialists recorded yet.</div>')+'</div>');
}
function simulationState(project){
  const validation=validateSpec(project.spec,project.type),sections=(project.sections||[]).filter(s=>s.id!=='chat');
  const output=project.artifacts?.output,outputCurrent=output?.specVersion===project.specVersion&&Object.keys(project.files||{}).length>0;
  const tests=project.tests?.specVersion===project.specVersion&&project.tests?.status==='passed';
  const evidence=(project.research?.findings||[]).length>0;
  return [
    {name:'Project specification',pass:validation.valid,detail:validation.valid?'Required project information is present.':'Missing: '+(validation.missing.join(', ')||validation.contradictions.join(' ')||'clarification needed')},
    {name:'Relevant workspace',pass:sections.length>=2,detail:sections.length>=2?sections.length+' project-specific sections.':'Fewer than two project-specific sections exist.'},
    {name:'Current output',pass:outputCurrent,detail:outputCurrent?'A current deliverable exists.':'No current output has been generated.'},
    {name:'Verification',pass:tests,detail:tests?'The current output passed saved tests.':'The current output has not passed a current test run.'}
  ].concat(project.sections?.some(s=>s.kind==='research')?[{name:'Research evidence',pass:evidence,detail:evidence?'Source-backed findings exist.':'Research section exists but has no saved findings.'}]:[]);
}
async function renderExplain(project){
  toolShell('EXPLAIN WHY','Project reasoning','A source-of-truth explanation of why ProjectX is in its current state. It does not invent hidden chain-of-thought.', '<div id="explain-content"><div class="sub">Analyzing the canonical project state…</div></div>');
  try{
    const data=await aiJson('plan',{project,history:[],message:'Explain the current project state for the user. Focus on: what is understood, what is still missing, what is blocking progress, why the current workspace sections fit the goal, and what the next concrete step should be. Do not reveal hidden chain-of-thought or private reasoning; provide concise evidence-based rationale from the visible project brain only.',system:'Return JSON only: {"summary":string,"understood":[string],"missing":[string],"blockers":[string],"nextStep":string}'},3200);
    const section=(title,items)=>'<div class="brain-group"><b>'+esc(title)+'</b>'+((items||[]).filter(Boolean).map(x=>'<div class="brain-row">'+esc(x)+'</div>').join('')||'<div class="sub">None recorded.</div>')+'</div>';
    $('#explain-content').innerHTML='<div class="sub">'+esc(data?.summary||'No explanation available.')+'</div>'+section('Understood',data?.understood)+section('Missing',data?.missing)+section('Blockers',data?.blockers)+'<div class="brain-group"><b>Next step</b><div class="brain-row">'+esc(data?.nextStep||'Use Project Chat to continue.')+'</div></div>';
  }catch(error){$('#explain-content').innerHTML='<div class="sub">Explanation failed: '+esc(error.message)+'</div>';}
}
function renderSimulation(project){
  const checks=simulationState(project),passed=checks.filter(x=>x.pass).length;
  toolShell('OUTCOME SIMULATION','Outcome readiness','Deterministic readiness checks from the current project state — not a promise about real-world results.','<div class="simulation-score"><b>'+passed+'/'+checks.length+' checks ready</b></div><div class="result-list">'+checks.map(x=>'<div class="result '+(x.pass?'pass':'fail')+'"><b>'+ (x.pass?'READY':'NOT READY')+' · '+esc(x.name)+'</b><div class="sub">'+esc(x.detail)+'</div></div>').join('')+'</div><div class="actions" style="margin-top:12px"><button class="primary" id="run-full-verification">Run full verification</button></div><div id="verification-status" class="sub" style="margin-top:10px"></div>');
  $('#run-full-verification').onclick=async()=>{
    const button=$('#run-full-verification'),status=$('#verification-status');button.disabled=true;status.textContent='Preparing output…';
    try{
      const output=project.artifacts?.output,current=output?.specVersion===project.specVersion&&Object.keys(project.files||{}).length>0;
      if(!current){renderOutput(project);await buildArtifact(project);}
      status.textContent='Running tests…';
      const results=await runTests(project),testPass=results.every(x=>x.pass);
      project.tests={status:testPass?'passed':'failed',specVersion:project.specVersion,results,updatedAt:now()};
      const security=projectSecurityChecks(project),blocking=security.filter(x=>x.blockBuild&&!x.pass);
      project.status=testPass&&!blocking.length?'verified':'needs-fix';
      if(session?.access_token){
        const verificationChecks=results.map(x=>({
          name:x.name,
          checkType:'local',
          status:x.pass?'pass':'fail',
          severity:x.pass?'info':'error',
          evidence:{detail:x.detail||''},
          verifier:'projectx-local'
        })).concat(security.map(x=>({
          name:x.name,
          checkType:'security',
          status:x.pass?'pass':(x.blockBuild?'fail':'warning'),
          severity:x.pass?'info':(x.blockBuild?'error':'warning'),
          evidence:{detail:x.detail||''},
          verifier:'projectx-security'
        })));
        try{
          await edge('runVerification',{
            projectId:project.id,
            artifactVersion:String(project.artifacts?.output?.specVersion||project.specVersion||1),
            checks:verificationChecks
          });
        }catch(error){
          notify('Verification ran locally, but its durable server record could not be saved: '+String(error.message||error),'error');
        }
      }
      saveProject(project);
      await syncRemoteProject(project);
      status.textContent=testPass&&!blocking.length?'Full verification passed.':'Verification found issues; review Tests and Security.';
      renderSimulation(project);
    }catch(error){status.textContent='Verification failed: '+error.message;button.disabled=false;}
  };
}

async function renderMakeGreat(project){
  toolShell('PROJECT IMPROVEMENT','Make it Great','ProjectX inspects the current project brain and proposes only additive improvements.','<div id="great-content"><div class="sub">Analyzing the current project…</div></div>');
  try{
    const data=await aiJson('plan',{project,history:[],message:'Audit this project for useful missing details, acceptance criteria, dependencies, and workspace improvements. Return JSON with summary, safeAdditions and workspaceSections. Only additive, evidence-free improvements.',system:'Return JSON only: {"summary":string,"safeAdditions":[string],"workspaceSections":[{"name":string,"purpose":string,"kind":string,"agent":string,"capabilities":[string]}]}. Never invent factual research.'},4200);
    const adds=Array.isArray(data?.safeAdditions)?data.safeAdditions.map(x=>String(x||'').trim()).filter(Boolean).slice(0,12):[];
    const sections=Array.isArray(data?.workspaceSections)?data.workspaceSections.slice(0,8):[];
    $('#great-content').innerHTML='<div class="sub">'+esc(data?.summary||'No improvements identified.')+'</div>'+(adds.length?'<div class="brain-group"><b>Safe additions</b>'+adds.map(x=>'<div class="brain-row">'+esc(x)+'</div>').join('')+'</div>':'')+(sections.length?'<div class="brain-group"><b>Workspace improvements</b>'+sections.map(x=>'<div class="brain-row"><b>'+esc(x.name)+'</b><div class="sub">'+esc(x.purpose)+'</div></div>').join('')+'</div>':'')+'<div class="actions"><button class="primary" id="apply-great" '+(adds.length||sections.length?'':'disabled')+'>Apply safe improvements</button></div>';
    $('#apply-great').onclick=()=>{snapshot(project,'Before Make it Great');const existing=(project.sections||[]).filter(s=>s.id!=='chat');const mergedSections=[...existing];const seen=new Set(existing.map(s=>s.id));for(const section of sections){const id=String(section?.id||section?.name||'').trim().toLowerCase().replace(/[^a-z0-9]+/g,'-');if(id&&!seen.has(id)){mergedSections.push(section);seen.add(id);}}const mutation=applyProjectMutation(project,{specPatch:adds.length?{requirements:{add:adds}}:{},workspaceSections:mergedSections});if(mutation.changed){project.status='changed';saveProject(project);syncRemoteProject(project);notify('Safe improvements applied.','success');}else notify('No new improvements needed.','info');renderMakeGreat(project);};
  }catch(error){$('#great-content').innerHTML='<div class="sub">Analysis failed: '+esc(error.message)+'</div>';}
}
async function renderOptimize(project){
  const software=projectArtifactKind(project.type)==='software';
  const staticChecks=[
    {name:'Output exists',pass:Boolean(project.artifacts?.output?.specVersion===project.specVersion&&Object.keys(project.files||{}).length),detail:'Optimization should start from the current generated artifact.'},
    {name:'Verification state',pass:project.tests?.specVersion===project.specVersion&&project.tests?.status==='passed',detail:'The current artifact should pass its tests before optimization.'}
  ];
  toolShell('OPTIMIZE','Optimize','Improve the current output without changing the user’s core goal. ProjectX keeps the current version available for rollback.', '<div class="result-list">'+staticChecks.map(x=>'<div class="result '+(x.pass?'pass':'fail')+'"><b>'+esc(x.pass?'READY':'NOT READY')+' · '+esc(x.name)+'</b><div class="sub">'+esc(x.detail)+'</div></div>').join('')+'</div><div class="actions" style="margin-top:12px"><button class="primary" id="run-optimize" '+(staticChecks.every(x=>x.pass)?'':'disabled')+'>Apply AI optimization</button><button class="ghost" id="open-tests">Tests</button></div><div id="optimize-status" class="sub" style="margin-top:10px"></div>');
  $('#open-tests').onclick=()=>renderTests(project);
  $('#run-optimize').onclick=async()=>{
    if(!software){$('#optimize-status').textContent='Document optimization is handled by Make it Great and the deliverable builder.';return;}
    const button=$('#run-optimize'),status=$('#optimize-status');button.disabled=true;status.textContent='Analyzing the current output and preparing a safe optimization…';
    try{
      snapshot(project,'Before optimization');
      const data=await aiJson('discuss',{project,history:[],message:'Optimize the current generated software artifact for runtime performance, accessibility, and maintainability without changing the core user goal. Return only concrete fileOperations for existing project files or clearly necessary new files. Do not add dependencies, remote assets, fake work, or placeholders.',system:projectAgentSystem},7000);
      const ops=Array.isArray(data?.fileOperations)?data.fileOperations:[];
      if(!ops.length)throw new Error('The optimization model returned no executable file changes.');
      const mutation=applyProjectMutation(project,{fileOperations:ops});
      if(!mutation.changed)throw new Error('The optimization produced no project changes.');
      project.status='needs-build';saveProject(project);await syncRemoteProject(project);
      renderOutput(project);await buildArtifact(project,[{name:'Optimization verification',detail:'Rebuilt after optimization; run the saved tests against the optimized output.'}]);
      status.textContent='Optimization applied and rebuilt. Review the updated verification results.';
    }catch(error){
      status.textContent='Optimization failed: '+error.message;
    }finally{button.disabled=false;}
  };
}
async function renderTransform(project){
  const targets=[['Website','Website'],['App','Web app'],['Mobile','Mobile app'],['Dashboard','Dashboard'],['API','API'],['Agent','AI agent'],['Automation','Automation'],['Business system','Business system'],['Internal tool','Internal tool'],['Data','Data application'],['Document','Document'],['Presentation','Presentation'],['Research','Research project'],['Creative project','Creative project'],['Other','Custom creation']];
  toolShell('TRANSFORM','Transform project','Change the project blueprint for a new creation target while preserving the original intent.','<div class="row"><select class="select" id="transform-target">'+targets.map(x=>'<option value="'+x[0]+'">'+x[1]+'</option>').join('')+'</select><button class="primary" id="transform-run">Transform</button></div><div id="transform-result" style="margin-top:12px"></div>');
  $('#transform-run').onclick=async()=>{
    const button=$('#transform-run'),target=$('#transform-target').value;button.disabled=true;$('#transform-result').innerHTML='<div class="sub">Building transformed blueprint…</div>';
    try{
      const data=await aiJson('plan',{project,history:[],message:'Transform this project into '+target+' while preserving the core goal. Return projectType, title, summary, additive specPatch, and workspaceSections. Do not claim deployed/native implementation.',system:'Return JSON only: {"projectType":string,"title":string,"summary":string,"specPatch":{},"workspaceSections":[]}. Only additive transformations.'},5000);
      const nextType=String(data?.projectType||target),sections=Array.isArray(data?.workspaceSections)?data.workspaceSections.slice(0,8):[];
      snapshot(project,'Before transform to '+target);
      const mutation=applyProjectMutation(project,{projectType:nextType,projectTitle:String(data?.title||project.title),specPatch:data?.specPatch||{},workspaceSections:sections});
      if(!mutation.changed)throw new Error('The transformed blueprint produced no changes.');
      project.understanding={...(project.understanding||{}),summary:String(data?.summary||project.understanding?.summary||''),category:target};
      project.status='changed';saveProject(project);await syncRemoteProject(project);
      $('#transform-result').innerHTML='<div class="sub">Transformed to <b>'+esc(project.type)+'</b>. The original version is saved in Versions.</div>';
    }catch(error){$('#transform-result').innerHTML='<div class="sub">Transform failed: '+esc(error.message)+'</div>';}
    finally{button.disabled=false;}
  };
}
function renderVersions(project){
  const versions=(project.versions||[]).slice().reverse();
  toolShell('VERSIONS','Project history','Restore or fork earlier project states while preserving the current state as a new version.', '<form id="fork-form" class="form"><input id="fork-name" class="input full" maxlength="80" placeholder="Fork name, e.g. mobile direction"><button class="ghost">Fork current project</button></form><div style="margin-top:12px">'+(versions.length?versions.map((v,i)=>'<div class="version-row"><div><b>v'+esc(v.version||'?')+' · '+esc(v.label||'Snapshot')+'</b><div class="sub">'+esc(v.at||'')+'</div></div><div class="actions"><button class="ghost" data-compare="'+i+'">Compare</button><button class="ghost" data-restore="'+i+'">Restore</button></div></div>').join(''):'<div class="placeholder">No snapshots yet.</div>')+'</div>');

  $('#fork-form').onsubmit=async e=>{e.preventDefault();const label=$('#fork-name').value.trim()||'Alternative';const raw=serializeForPersistence(project);delete raw.id;raw.title=project.title+' ('+label+')';raw.status='ready';const fork=migrateProject(raw);fork.sync={remoteId:null,lastSyncedAt:null,baseUpdatedAt:null,mode:'local'};saveProject(fork,true);await syncRemoteProject(fork);openProject(fork.id);notify('Project fork created.','success');};
  $$('[data-compare]','#project-body').forEach(btn=>btn.onclick=()=>{const v=versions[Number(btn.dataset.compare)];if(!v)return;showVersionCompare(project,v);});
  $$('[data-restore]','#project-body').forEach(btn=>btn.onclick=async()=>{const v=versions[Number(btn.dataset.restore)];if(!v)return;if(!confirm('Restore snapshot v'+(v.version||'?')+'? The current state will be saved first.'))return;snapshot(project,'Before restore');const result=restoreProjectSnapshot(project,v);if(result.changed){saveProject(project);await syncRemoteProject(project);notify('Previous project state restored.','success');renderProjectTool(project,'versions');}});
}
function showVersionCompare(project,version){
  const root=$('#project-body');if(!root)return;
  const currentKeys=Object.keys(project.files||{}),oldKeys=Object.keys(version.files||{}),added=currentKeys.filter(k=>!oldKeys.includes(k)),removed=oldKeys.filter(k=>!currentKeys.includes(k)),changed=currentKeys.filter(k=>oldKeys.includes(k)&&project.files[k]!==version.files[k]);
  const specChanged=JSON.stringify(project.spec||{})!==JSON.stringify(version.spec||{}),typeChanged=(project.type||'')!==(version.type||''),titleChanged=(project.title||'')!==(version.title||'');
  const html='<div class="box"><button class="ghost" id="back-versions">← Versions</button><h2>Compare v'+esc(version.version||'?')+'</h2><div class="sub">Current state versus this saved snapshot.</div><div class="brain-group"><b>Project</b><div class="brain-row">'+(titleChanged?'Title changed. ':'')+(typeChanged?'Type changed. ':'')+(!titleChanged&&!typeChanged?'No title/type change.':'')+'</div></div><div class="brain-group"><b>Specification</b><div class="brain-row">'+(specChanged?'Specification differs from this snapshot.':'Specification matches this snapshot.')+'</div></div><div class="brain-group"><b>Files</b><div class="brain-row">Added: '+(added.join(', ')||'none')+'</div><div class="brain-row">Removed: '+(removed.join(', ')||'none')+'</div><div class="brain-row">Changed: '+(changed.join(', ')||'none')+'</div></div></div>';
  root.innerHTML=html;$('#back-versions').onclick=()=>renderVersions(project);
}

function renderResources(project){
  const resources=Array.isArray(project.spec?.resources)?project.spec.resources:[];
  const display=r=>typeof r==='string'?{name:r,type:'note',content:r}:r||{};
  const rows=resources.map(r=>{const x=display(r);const body=x.url||x.content||'';return '<div class="brain-row"><b>'+esc(x.name||'Resource')+'</b><div class="sub">'+esc(x.type||'note')+(x.size?' · '+esc(x.size)+' bytes':'')+'</div>'+((x.url)?'<div class="sub"><a href="'+esc(x.url)+'" target="_blank" rel="noopener noreferrer">'+esc(x.url)+'</a></div>':'')+(x.content?'<div class="sub">'+esc(String(x.content).slice(0,260))+'</div>':'')+'</div>';}).join('');
  toolShell('RESOURCES','Project resources','Attach URLs, notes, and supported text files to the project brain.','<form id="resource-form" class="form"><input id="resource-value" placeholder="Paste a URL or useful note" maxlength="600"><input id="resource-file" class="input" type="file" accept=".txt,.md,.csv,.json,text/plain,text/markdown,text/csv,application/json"><button class="primary">Add resource</button></form><div class="sub" style="margin-top:7px">Text resources are capped before they enter the project brain. Binary/PDF ingestion is reserved for a richer resource pipeline.</div><div id="resource-list" style="margin-top:12px">'+(rows||'<div class="placeholder">No resources attached yet.</div>')+'</div>');
  $('#resource-form').onsubmit=async e=>{e.preventDefault();const input=$('#resource-value'),file=$('#resource-file'),value=input.value.trim();let resource=null;if(file.files?.[0]){const f=file.files[0];if(f.size>200000){notify('Text resource is too large. Limit: 200 KB.','error');return}resource={name:f.name,type:f.type||'text/plain',content:await f.text(),size:f.size};}else if(value){resource=/^https:\/\//i.test(value)?{name:value,type:'url',url:value}:value; }else return;const mutation=applyProjectMutation(project,{specPatch:{resources:{add:[resource]}}});if(mutation.changed){project.status='changed';saveProject(project);await syncRemoteProject(project);notify('Resource added to the project brain.','success');}renderResources(project);};
}
function projectSecurityChecks(project){
  const files=project.files||{},text=Object.entries(files).map(([p,v])=>'FILE '+p+'\n'+v).join('\n');
  return [
    {name:'No shell execution APIs',pass:!(/(?:child_process|Deno\.Command|Bun\.spawn|process\.exec\()/i.test(text)),detail:'Generated project files are scanned for direct command execution APIs.',blockBuild:true},
    {name:'No eval constructors',pass:!(/\b(?:eval|new Function)\s*\(/i.test(text)),detail:'Generated files are scanned for eval/new Function.',blockBuild:true},
    {name:'No javascript URLs',pass:!(/javascript\s*:/i.test(text)),detail:'Generated files are scanned for javascript: URLs.',blockBuild:true},
    {name:'No obvious embedded credentials',pass:!(/(?:api[_-]?key|secret|token|password)\s*[:=]\s*['"][^'"]{16,}['"]/i.test(text)),detail:'Generated files are scanned for credential-like assignments.',blockBuild:false},
    {name:'No insecure HTTP resources',pass:!(/(?:src|href|fetch\s*\()\s*[^\n]{0,80}http:\/\//i.test(text)),detail:'Generated files are scanned for plaintext HTTP resources.',blockBuild:true},
    {name:'Safe relative file paths',pass:Object.keys(files).every(p=>sanitizePath(p)===p),detail:'Generated file paths stay within the project file namespace.',blockBuild:true}
  ];
}
function renderProjectSecurity(project){
  const checks=projectSecurityChecks(project);
  toolShell('SECURITY','Project security checks','Fast local checks on generated files. Credential-like findings are advisory; critical execution and transport checks block a verified build. This does not replace a full security review.','<div class="result-list">'+checks.map(x=>'<div class="result '+(x.pass?'pass':'fail')+'"><b>'+ (x.pass?'PASS':'FAIL')+' · '+esc(x.name)+'</b><div class="sub">'+esc(x.detail)+'</div></div>').join('')+'</div>');
}

async function renderSection(project,section){
  const body=$('#project-body');
  if(!body||!section)return;
  switch(section.kind){
    case 'conversation': return renderProjectChat(project);
    case 'output':
    case 'publish': return renderOutput(project);
    case 'code': return renderFiles(project);
    case 'test': return renderTests(project);
    case 'planning':
    case 'workspace':
    default: return renderGeneratedSection(project,section);
    case 'research': return renderResearchSection(project,section);
  }
}
const projectAgentSystem=`You are ProjectX's project agent. The canonical project specification is the source of truth. Return JSON only: {"intent":"answer|change|plan|build|test|research|publish","message":string,"changed":boolean,"specPatch":{},"plan":[{"title":string,"steps":string[],"status":"proposed|ready|blocked"}],"workspaceSections":[],"agents":[{"key":string,"name":"string","purpose":string,"tools":string[]}],"fileOperations":[{"op":"write|delete","path":"safe/relative/path","content":"complete file content"}],"researchQuery":string,"researchUrls":string[],"needsBuild":boolean}. For research, only return URLs explicitly supplied by the user; never invent sources. Never claim a file, artifact, build, test, research result, or deployment exists without returning the corresponding operation or verified result. For software/game changes prefer real file operations.`;
function skillContext(){
  const skills=(settingsState.skills||[]).filter(s=>s&&s.enabled&&s.name);
  if(!skills.length)return '';
  return ' Enabled skills: '+skills.map(s=>s.name).join(', ')+'.';
}
function refreshConversationViews(project){
  const messages=Array.isArray(project.conversation)?project.conversation.slice(-MAX_HISTORY):[];
  const html=messages.map(m=>`<div class="msg ${m.role==='user'?'user':'ai'}">${esc(m.text)}</div>`).join('');
  const log=$('#project-log');if(log){log.innerHTML=html;log.scrollTop=log.scrollHeight;}
  const dock=$('#assistant-dock-log');if(dock){dock.innerHTML=html;dock.scrollTop=dock.scrollHeight;}
}
async function sendProjectMessage(project,userText){
  const text=String(userText||'').trim();
  if(!text)return;
  const messages=project.conversation.length?project.conversation.slice(-MAX_HISTORY):[{role:'assistant',text:'I have the canonical project state in context. What should we change or work on next?'}];
  messages.push({role:'user',text});
  project.conversation=messages.slice(-MAX_HISTORY);
  refreshConversationViews(project);
  const send=$('#project-send')||$('#assistant-dock-send');
  if(send)send.disabled=true;
  setAgentStatus('Working');
  try{
    const data=await aiJson('discuss',{project,history:messages,message:text,system:projectAgentSystem+skillContext()},5500);if(!data)throw new Error('The AI returned invalid project action data.');
    const wantsMutation=Boolean(data.changed||(data.specPatch&&typeof data.specPatch==='object'&&Object.keys(data.specPatch).length)||(Array.isArray(data.plan)&&data.plan.length)||(Array.isArray(data.workspaceSections)&&data.workspaceSections.length)||(Array.isArray(data.fileOperations)&&data.fileOperations.length)||(Array.isArray(data.agents)&&data.agents.length));
    const intent=String(data.intent||'answer').toLowerCase();
    if(wantsMutation||['build','test','research','plan'].includes(intent)){
      addTask(project,text.slice(0,80),{status:settingsState.executionMode==='Ask Me'&&wantsMutation?'awaiting approval':(wantsMutation?'active':'draft'),agent:intent==='research'?'researcher':intent==='test'?'tester':intent==='build'?'builder':'orchestrator',description:text,affectedFiles:(data.fileOperations||[]).map(x=>x.path).filter(Boolean)});
    }
    if(wantsMutation&&settingsState.executionMode==='Ask Me'){
      project.pendingMutation={...data,message:String(data.message||'Review the proposed change.'),createdAt:now()};
      messages.push({role:'assistant',text:'I prepared the requested change for approval. Nothing has been applied yet.'});project.conversation=messages.slice(-MAX_HISTORY);saveProject(project);renderProjectChat(project);return;
    }
    if(wantsMutation){
      snapshot(project,'Before change');
      const mutation=applyProjectMutation(project,{specPatch:data.specPatch||{},plan:Array.isArray(data.plan)?data.plan:undefined,workspaceSections:Array.isArray(data.workspaceSections)?data.workspaceSections:undefined,agents:Array.isArray(data.agents)?data.agents:undefined,fileOperations:Array.isArray(data.fileOperations)?data.fileOperations:[]});
      if(!mutation.changed)throw new Error('The AI requested a mutation but nothing in the canonical project state changed.');
      project.status=data.needsBuild?'needs-build':'changed';project.executionState={...(project.executionState||{}),lastAgent:'orchestrator'};
      const tasks=ensureTasks(project);if(tasks[0]&&tasks[0].status==='active'){tasks[0].status='ready';tasks[0].updatedAt=now();applyProjectMutation(project,{executionStatePatch:{tasks}});}
    }
    if(data.changed&&!wantsMutation)throw new Error('The AI claimed a change without returning an executable mutation.');
    messages.push({role:'assistant',text:String(data.message||'Done.')});project.conversation=messages.slice(-MAX_HISTORY);saveProject(project);await syncRemoteProject(project);
    if(intent==='research'){
      const query=String(data.researchQuery||'').trim(),urls=Array.isArray(data.researchUrls)?data.researchUrls.map(x=>String(x||'').trim()).filter(Boolean).slice(0,5):[];
      if(!session){aiRequiredModal('Sign in to use source-backed research.');renderProject(project);return;}
      if(!query||!urls.length){messages.push({role:'assistant',text:'Send the research question together with one or more source URLs I should analyze.'});project.conversation=messages.slice(-MAX_HISTORY);saveProject(project);refreshConversationViews(project);return;}
      const result=await edge('research',{projectId:project.id,query,urls});
      const mutation=applyProjectMutation(project,{researchPatch:{query,addSources:result.sources||urls.map(url=>({url})),addFindings:result.findings||[]}});
      if(mutation.changed){project.executionState={...(project.executionState||{}),lastAgent:'researcher'};saveProject(project);await syncRemoteProject(project);}
      messages.push({role:'assistant',text:String(result.summary||'Research added to the project evidence store.')});project.conversation=messages.slice(-MAX_HISTORY);saveProject(project);refreshConversationViews(project);renderProject(project);return;
    }
    if((intent==='build'||data.needsBuild)&&settingsState.executionMode!=='Ask Me'){
      renderOutput(project);await buildArtifact(project);
      if(settingsState.executionMode==='Autonomous'){
        let results=await runTests(project);
        for(let cycle=0;cycle<2&&!results.every(x=>x.pass);cycle++){const failures=results.filter(x=>!x.pass);await buildArtifact(project,failures);results=await runTests(project);}
        const passed=results.every(x=>x.pass),status=passed?'verified':'needs-fix';project.tests={status:passed?'passed':'failed',specVersion:project.specVersion,results,updatedAt:now()};project.status=status;saveProject(project);await syncRemoteProject(project);
      }
      return;
    }
    if((intent==='build'||data.needsBuild)&&settingsState.executionMode==='Ask Me'){messages.push({role:'assistant',text:'The build is ready to run. Open Output and start it when you are ready.'});project.conversation=messages.slice(-MAX_HISTORY);saveProject(project);refreshConversationViews(project);renderProject(project);return;}
    if(intent==='test'){
      renderTests(project);const results=await runTests(project),passed=results.every(x=>x.pass);project.tests={status:passed?'passed':'failed',specVersion:project.specVersion,results,updatedAt:now()};project.status=passed?'verified':'needs-fix';saveProject(project);await syncRemoteProject(project);renderTests(project);return;
    }
    renderProject(project);
  }catch(error){messages.push({role:'assistant',text:'I could not complete that request: '+error.message});project.conversation=messages.slice(-MAX_HISTORY);saveProject(project);refreshConversationViews(project);}
  finally{if(send)send.disabled=false;}
}
function renderProjectChat(project,prefill=''){
  const body=$('#project-body'),messages=project.conversation.length?project.conversation.slice(-MAX_HISTORY):[{role:'assistant',text:'I have the canonical project state in context. What should we change or work on next?'}],pending=project.pendingMutation;
  body.innerHTML='<div class="box"><div class="sub">Project Chat controls the canonical project state. Ask Me pauses mutations for approval; other modes follow their configured automation level.</div><div id="project-log" class="conversation"></div>'+
    (pending?'<div class="approval-card"><div class="kicker">APPROVAL REQUIRED</div><b>ProjectX prepared a change</b><div class="sub">'+esc(pending.message||'Review the proposed project change before applying it.')+'</div><div class="brain-group"><b>Change preview</b><div class="brain-row">'+esc((Object.keys(pending.specPatch||{}).length)+' spec fields · '+(pending.plan||[]).length+' plan items · '+(pending.fileOperations||[]).length+' file operations · '+(pending.workspaceSections||[]).length+' workspace sections · '+(pending.agents||[]).length+' specialists')+'</div><div class="brain-row">Files: '+esc((pending.fileOperations||[]).map(x=>x.path).join(', ')||'None')+'</div></div><div class="actions"><button class="primary" id="approve-pending">Approve and apply</button><button class="ghost" id="reject-pending">Reject</button></div></div>':'')+
    '<form id="project-form" class="form"><textarea id="project-input" placeholder="Ask ProjectX to change, build, research, test, or explain something..."></textarea><button class="primary" id="project-send">Send</button></form></div>';
  drawConversation(messages,'#project-log');
  const approve=$('#approve-pending'),reject=$('#reject-pending');
  if(approve)approve.onclick=async()=>{
    approve.disabled=true;reject.disabled=true;
    try{
      snapshot(project,'Before approved change');
      const mutation=applyProjectMutation(project,{specPatch:pending.specPatch||{},plan:Array.isArray(pending.plan)?pending.plan:undefined,workspaceSections:Array.isArray(pending.workspaceSections)?pending.workspaceSections:undefined,agents:Array.isArray(pending.agents)?pending.agents:undefined,fileOperations:Array.isArray(pending.fileOperations)?pending.fileOperations:[]});
      project.pendingMutation=null;
      if(!mutation.changed)throw new Error('The approved change produced no canonical project mutation.');
      project.status=pending.needsBuild?'needs-build':'changed';project.executionState={...(project.executionState||{}),lastAgent:'orchestrator'};
      messages.push({role:'assistant',text:'Approved. The prepared change has been applied to the canonical project state.'});project.conversation=messages.slice(-MAX_HISTORY);saveProject(project);await syncRemoteProject(project);
      if(pending.needsBuild){renderOutput(project);await buildArtifact(project);return;}
      renderProject(project);
    }catch(error){project.pendingMutation=null;saveProject(project);await syncRemoteProject(project);messages.push({role:'assistant',text:'The approved change could not be applied: '+error.message});project.conversation=messages.slice(-MAX_HISTORY);drawConversation(messages,'#project-log');}
  };
  if(reject)reject.onclick=()=>{project.pendingMutation=null;messages.push({role:'assistant',text:'Rejected. The proposed change was not applied.'});project.conversation=messages.slice(-MAX_HISTORY);saveProject(project);renderProject(project);};
  const input=$('#project-input'),send=$('#project-send');input.value=prefill;
  $('#project-form').onsubmit=async e=>{
    e.preventDefault();const userText=input.value.trim();if(!userText||send.disabled)return;
    input.value='';
    await sendProjectMessage(project,userText);
  };
  input.onkeydown=e=>{if((e.ctrlKey||e.metaKey)&&e.key==='Enter'){e.preventDefault();$('#project-form').requestSubmit();}};
}
function applyFileOperations(project,operations){project.files=project.files||{};for(const op of operations){const path=sanitizePath(op.path);if(!path)continue;if(op.op==='write'&&typeof op.content==='string'&&op.content.length<=600000)project.files[path]=op.content;if(op.op==='delete')delete project.files[path];}if(Object.keys(project.files).length)project.artifacts={...(project.artifacts||{}),manifest:{specVersion:project.specVersion,files:Object.keys(project.files)}};}
async function renderResearchSection(project,section){
  const body=$('#project-body');
  const research=project.research||{status:'ready',queries:[],sources:[],findings:[]};
  const findings=Array.isArray(research.findings)?research.findings.slice(-30).reverse():[];
  body.innerHTML=`<div class="box"><div><h2 style="margin:0">${esc(section.name)}</h2><div class="sub">${esc(section.purpose)} Use sources you trust; ProjectX will extract evidence and label it with the source used.</div></div>
    <form id="research-form" class="form" style="margin-top:14px">
      <input id="research-query" placeholder="What do you need to find out?" required maxlength="500">
      <textarea id="research-urls" placeholder="Source URLs — one per line (https://…)" rows="4" required></textarea>
      <button class="primary" id="research-submit" type="submit">${session?'Research these sources':'Sign in to research'}</button>
    </form>
    <div id="research-status" style="margin-top:10px"></div>
    <div style="margin-top:18px"><b>Evidence</b><div id="research-findings" style="margin-top:10px">${findings.length?findings.map(f=>`<div class="section-block"><b>${esc(f.sourceTitle||f.source_title||'Source')}</b><p>${esc(f.finding||'')}</p><div class="sub">${f.sourceUrl||f.source_url?`<a href="${esc(f.sourceUrl||f.source_url)}" target="_blank" rel="noopener noreferrer">${esc(f.sourceUrl||f.source_url)}</a>`:''} ${f.confidence!=null?` · Confidence ${Math.round(Number(f.confidence)*100)}%`:''}</div></div>`).join(''):'<div class="placeholder">No source-backed findings yet.</div>'}</div></div>
  </div>`;
  const form=$('#research-form'),submit=$('#research-submit'),status=$('#research-status');
  form.onsubmit=async e=>{
    e.preventDefault();
    if(!session){aiRequiredModal('Sign in to use source-backed research.');return;}
    const query=$('#research-query').value.trim();
    const urls=$('#research-urls').value.split(/\n|,/).map(x=>x.trim()).filter(Boolean).slice(0,5);
    if(!query||!urls.length){status.innerHTML='<div class="sub">Add a research question and at least one HTTPS source URL.</div>';return;}
    submit.disabled=true;status.innerHTML='<div class="sub">Reading sources and extracting evidence…</div>';
    try{
      const result=await edge('research',{projectId:project.id,query,urls});
      const sourceList=Array.isArray(result?.sources)?result.sources:urls.map(url=>({url}));
      const newFindings=Array.isArray(result?.findings)?result.findings:[];
      const mutation=applyProjectMutation(project,{researchPatch:{query,addSources:sourceList,addFindings:newFindings}});
      if(mutation.changed){project.executionState={...(project.executionState||{}),lastAgent:'researcher'};saveProject(project);await syncRemoteProject(project);}
      renderResearchSection(project,section);
    }catch(error){status.innerHTML=`<div class="sub">Research failed: ${esc(error.message)}</div>`;submit.disabled=false;}
  };
}
async function renderGeneratedSection(project,section){
  const body=$('#project-body');
  body.innerHTML=`<div class="box"><div style="display:flex;justify-content:space-between;gap:10px"><div><h2 style="margin:0">${esc(section.name)}</h2><div class="sub">${esc(section.purpose)}</div></div><button class="ghost" id="section-refresh">${project.sectionContent?.[section.id]?.specVersion===project.specVersion?'Refresh':'Generate'}</button></div><div id="section-content" style="margin-top:14px"><div class="sub">Generating from project spec v${project.specVersion}…</div></div></div>`;
  $('#section-refresh').onclick=()=>{delete project.sectionContent[section.id];saveProject(project);renderGeneratedSection(project,section)};
  const cached=project.sectionContent?.[section.id];
  if(cached?.specVersion===project.specVersion){drawSectionContent(cached);return;}
  try{
    const instruction={section:{name:section.name,purpose:section.purpose,kind:section.kind,capabilities:section.capabilities||[]},rule:'Work only on this section. Use the project brain as context, but do not restate the whole project or invent work.',task:`Produce the useful content a person would actually need inside the "${section.name}" section.`};
    const system='Return JSON only: {"summary":string,"blocks":[{"heading":string,"text":string}],"items":[{"title":string,"detail":string,"status":"proposed|ready|blocked|unknown"}],"nextActions":string[],"openQuestions":string[]}. Tailor every field to the exact section name and purpose. Do not create generic filler, repeat the same content across sections, or claim completed work without evidence.';
    const data=await aiJson('plan',{project,history:[],message:JSON.stringify(instruction),system,agent:section.agent||'planner'},3600);
    const content={specVersion:project.specVersion,summary:String(data?.summary||''),blocks:Array.isArray(data?.blocks)?data.blocks.filter(x=>x&&String(x.heading||x.text||'').trim()).slice(0,8).map(x=>({heading:String(x.heading||'').slice(0,100),text:String(x.text||'').slice(0,900)})):[],items:Array.isArray(data?.items)?data.items.slice(0,20):[],nextActions:Array.isArray(data?.nextActions)?data.nextActions.slice(0,10):[],openQuestions:Array.isArray(data?.openQuestions)?data.openQuestions.slice(0,10):[]};
    project.sectionContent={...(project.sectionContent||{}),[section.id]:content};
    saveProject(project);await syncRemoteProject(project);drawSectionContent(content);
  }catch(error){$('#section-content').innerHTML=`<div class="sub">Generation failed: ${esc(error.message)}. No project data was changed.</div>`;}
}
function drawSectionContent(data){
  $('#section-content').innerHTML=`<div class="sub">${esc(data.summary)}</div>${(data.blocks||[]).map(block=>`<div class="section-block"><b>${esc(block.heading||'')}</b><p>${esc(block.text||'')}</p></div>`).join('')}${(data.items||[]).map(item=>`<div class="item"><b>${esc(item.title||'Item')}</b><p>${esc(item.detail||'')} <span class="status ${item.status==='ready'?'ok':item.status==='blocked'?'bad':'warn'}">${esc(item.status||'unknown')}</span></p></div>`).join('')}<div class="grid">${data.nextActions?.length?`<div class="box"><b>Next actions</b>${data.nextActions.map(x=>`<div class="sub">• ${esc(x)}</div>`).join('')}</div>`:''}${data.openQuestions?.length?`<div class="box"><b>Open questions</b>${data.openQuestions.map(x=>`<div class="sub">• ${esc(x)}</div>`).join('')}</div>`:''}</div>`;
}
async function renderOutput(project){
  const body=$('#project-body');
  const software=projectArtifactKind(project.type)==='software';
  const output=project.artifacts?.output;
  const current=output?.specVersion===project.specVersion&&Object.keys(project.files||{}).length>0;
  const title=software?(project.type==='Game'?'Playtest':project.type==='Presentation'?'Presentation':'Output'):'Deliverable';
  const description=current?'Current output generated from the project brain.':software?'No current artifact exists yet.':'No document deliverable exists yet.';
  body.innerHTML=`<div class="box"><div style="display:flex;justify-content:space-between;gap:10px"><div><h2 style="margin:0">${title}</h2><div class="sub">${esc(description)}</div></div><div class="actions"><button id="build-output" class="primary">${current?'Rebuild with AI':software?'Build with AI':'Generate deliverable'}</button>${software?'<button id="visual-edit" class="ghost">Visual edit</button>':''}</div></div><div id="output-area" style="margin-top:14px"></div></div>`;
  $('#build-output').onclick=()=>buildArtifact(project);
  $('#visual-edit')?.addEventListener('click',()=>renderProjectChat(project,'Make a visual change: '));
  if(current){
    if(software)mountArtifact(project);
    else{
      const docPath=Object.keys(project.files||{}).find(p=>/\.(md|txt|csv|json)$/i.test(p))||Object.keys(project.files||{})[0];
      $('#output-area').innerHTML=`<div class="document-output"><pre class="document-text">${esc(docPath?project.files[docPath]:'No document content.')}</pre></div>`;
    }
  }else $('#output-area').innerHTML='<div class="placeholder">ProjectX will generate the deliverable from the current canonical specification.</div>';
}
async function buildArtifact(project,repairResults=[]){
  if(!session&&!localGuestKey())return aiRequiredModal('Connect Gemini before ProjectX can build the real artifact.');
  const button=$('#build-output'),area=$('#output-area'),software=projectArtifactKind(project.type)==='software';
  if(!button||!area)return;
  button.disabled=true;
  area.innerHTML='<div class="sub">ProjectX is generating and validating the real deliverable…</div>';
  try{
    const repairContext=Array.isArray(repairResults)&&repairResults.length?' Repair the current artifact against these verified failures: '+repairResults.map(x=>x.name+': '+x.detail).join(' | ')+'. Preserve working behavior and fix the failures; do not introduce placeholders.':'';
    const artifactMessage=project.type==='Presentation'?'Generate a complete self-contained browser presentation for this exact project. Use index.html with slide navigation and keyboard controls, responsive typography, clear slide hierarchy, and no external dependencies. Return only files needed for the presentation.':software?'Generate the complete functional software artifact for this exact project. Return only files needed for this project.':'Generate the complete deliverable for this exact project. For a real-world objective, prefer a well-structured Markdown document unless another format is clearly required. Return only files needed for this deliverable.';
    const data=await aiJson('artifact',{project,message:artifactMessage+(repairContext||'')},10000);
    const files={};
    for(const file of Array.isArray(data?.files)?data.files:[]){
      const path=sanitizePath(file.path);
      if(path&&typeof file.content==='string'&&file.content.length<=600000)files[path]=file.content;
    }
    if(!Object.keys(files).length)throw new Error('The AI returned no usable deliverable files.');

    const securityChecks=projectSecurityChecks({files,type:project.type});
    const blockingSecurity=securityChecks.filter(x=>x.blockBuild&&!x.pass);
    if(blockingSecurity.length)throw new Error(blockingSecurity.map(x=>x.detail).join(' '));
    if(software){
      if(!files['index.html']&&!files['src/index.html'])throw new Error('The AI did not return a valid index.html artifact.');
      const html=files['index.html']||files['src/index.html']||'';
      const structural=[
        {name:'Entry file exists',pass:Boolean(html),detail:html?'index.html exists.':'No index.html artifact exists.'},
        {name:'HTML structure',pass:/<html[\s>]/i.test(html)&&/<body[\s>]/i.test(html),detail:/<html[\s>]/i.test(html)?'HTML document detected.':'Missing a complete HTML document.'},
        ...(project.type==='Presentation'?[{name:'Slide structure',pass:/slide|section/i.test(Object.values(files).join('\n')),detail:/slide|section/i.test(Object.values(files).join('\n'))?'Presentation structure detected.':'No slide or section structure detected.'}]:[]),
        {name:'No obvious placeholder markers',pass:!(/\b(TODO|FIXME|coming soon)\b/i.test(Object.values(files).join('\\n'))),detail:/\b(TODO|FIXME|coming soon)\b/i.test(Object.values(files).join('\\n'))?'Placeholder marker found.':'No obvious placeholder marker found.'}
      ];
      if(!structural.every(x=>x.pass))throw new Error(structural.filter(x=>!x.pass).map(x=>x.detail).join(' '));
      const runtime=await browserRuntimeCheck(files);
      if(!runtime.pass)throw new Error(runtime.detail||'The generated artifact reported a browser runtime error.');
      project.tests={status:'passed',specVersion:project.specVersion,results:[...structural,runtime],updatedAt:now()};
      project.artifacts={...(project.artifacts||{}),output:{specVersion:project.specVersion,entry:data.entry||'index.html',summary:String(data.summary||''),tests:[...structural,runtime],updatedAt:now()}};
    }else{
      const docPaths=Object.keys(files).filter(p=>/\.(md|txt|csv|json)$/i.test(p));
      if(!docPaths.length)throw new Error('The AI did not return a usable document deliverable.');
      const text=docPaths.map(p=>String(files[p])).join('\\n');
      const checks=[
        {name:'Document exists',pass:text.trim().length>40,detail:text.trim().length>40?'Document content is present.':'Document content is too short.'},
        {name:'No obvious placeholder markers',pass:!(/\b(TODO|FIXME|coming soon)\b/i.test(text)),detail:/\b(TODO|FIXME|coming soon)\b/i.test(text)?'Placeholder marker found.':'No obvious placeholder marker found.'}
      ];
      if(!checks.every(x=>x.pass))throw new Error(checks.filter(x=>!x.pass).map(x=>x.detail).join(' '));
      project.tests={status:'passed',specVersion:project.specVersion,results:checks,updatedAt:now()};
      project.artifacts={...(project.artifacts||{}),output:{specVersion:project.specVersion,entry:docPaths[0],summary:String(data.summary||''),tests:checks,updatedAt:now()}};
    }

    snapshot(project,'Before rebuild');
    project.files=files;
    project.status='built';
    if(session?.access_token){
      const committed=await edge('createArtifactVersion',{
        projectId:project.id,
        baseVersion:Number(project.specVersion||1),
        artifact:project.artifacts?.output || {},
        files
      });
      if(committed?.status==='stale') throw new Error('The project changed while the artifact was being saved. Reopen the project and rebuild from the latest Brain.');
      if(committed?.project){
        const remote=migrateProject(committed.project);
        Object.assign(project,remote);
      } else {
        await syncRemoteProject(project);
      }
    }else{
      saveProject(project);
    }
    saveProject(project);
    renderOutput(project);
    if(software)mountArtifact(project);
    notify('Deliverable generated and validated from the current canonical project spec.','success');
  }catch(error){
    area.innerHTML=`<div class="placeholder">Generation failed: ${esc(error.message)}. Your previous deliverable was kept.</div>`;
  }finally{button.disabled=false;}
}
function mountArtifact(project){
  const area=$('#output-area');if(!area)return;
  area.innerHTML='<div class="preview-toolbar"><button class="ghost active" data-viewport="desktop">Desktop</button><button class="ghost" data-viewport="tablet">Tablet</button><button class="ghost" data-viewport="mobile">Mobile</button></div><div class="artifact preview-desktop"><iframe id="project-frame" sandbox="allow-scripts" title="Project output"></iframe></div>';
  const frame=$('#project-frame');frame.srcdoc=assemblePreviewHtml(project.files||{});runtimeTestCleanup?.();
  const onMessage=e=>{if(e.source===frame.contentWindow&&e.data?.type==='PROJECTX_RUNTIME_ERROR'){const msg=String(e.data.message||'Runtime error');notify('Preview failed to load. '+msg+'. Open Assistant to diagnose.','error');setAgentStatus('Failed');const dock=$('#assistant-dock-input');if(dock)dock.value='Fix preview runtime error: '+msg;}};
  window.addEventListener('message',onMessage);runtimeTestCleanup=()=>window.removeEventListener('message',onMessage);
  $$('[data-viewport]').forEach(btn=>btn.onclick=()=>{const value=btn.dataset.viewport;$$('[data-viewport]').forEach(x=>x.classList.toggle('active',x===btn));const artifact=$('.artifact');artifact.className='artifact preview-'+value;});
}
function fileTreeNodes(paths){
  const root={};
  for(const path of paths){
    const parts=String(path).split('/').filter(Boolean);
    let node=root;
    parts.forEach((part,i)=>{
      if(i===parts.length-1){node[part]={__file:path};return;}
      if(!node[part]||node[part].__file)node[part]={};
      node=node[part];
    });
  }
  return root;
}
function fileTreeHtml(node,escFn,current){
  return Object.keys(node).sort().map(key=>{
    const val=node[key];
    if(val&&val.__file){
      const path=val.__file;
      return `<button class="${path===current?'active':''}" data-file="${escFn(path)}">${escFn(key)}</button>`;
    }
    return `<details open class="px-folder"><summary>${escFn(key)}</summary>${fileTreeHtml(val,escFn,current)}</details>`;
  }).join('');
}
function saveOpenFile(project){
  const editor=$('#file-code-editor');
  const path=project.uiFilePath;
  if(!editor||!path||!Object.hasOwn(project.files||{},path))return false;
  const content=editor.value;
  if(project.files[path]===content)return false;
  snapshot(project,'Before file edit');
  const mutation=applyProjectMutation(project,{fileOperations:[{op:'write',path,content}]});
  if(!mutation.changed)return false;
  project.status='needs-build';
  saveProject(project);
  syncRemoteProject(project);
  return true;
}
function refreshFilePreview(project){
  const frame=$('#file-preview-frame');
  if(!frame||!settingsState.splitFiles)return;
  const draft={...(project.files||{})};
  const editor=$('#file-code-editor');
  if(project.uiFilePath&&editor)draft[project.uiFilePath]=editor.value;
  frame.srcdoc=assemblePreviewHtml(draft);
}
function showFileCtx(x,y,path,project){
  const el=$('#px-ctx');if(!el)return;
  el.hidden=false;
  el.style.left=Math.min(x,window.innerWidth-200)+'px';
  el.style.top=Math.min(y,window.innerHeight-160)+'px';
  el.innerHTML=`<button data-ctx="open">Open</button><button data-ctx="ask">Ask Assistant</button><button data-ctx="rename">Rename</button><button data-ctx="download">Download</button><button data-ctx="delete">Delete</button>`;
  el.onclick=ev=>{
    const act=ev.target.closest('[data-ctx]')?.dataset.ctx;if(!act)return;
    el.hidden=true;
    if(act==='open'){project.uiFilePath=path;renderFiles(project);}
    if(act==='ask'){const dock=$('#assistant-dock-input');if(dock){dock.value='Explain '+path+': ';dock.focus();}settingsState.hideAssistant=false;persistSettings();applyChromeLayout();}
    if(act==='rename')$('#rename-file')?.click();
    if(act==='download')downloadText(path,project.files[path]||'');
    if(act==='delete')$('#delete-file')?.click();
  };
}
function renderFiles(project){
  const paths=Object.keys(project.files||{}).sort();
  const first=paths.includes(project.uiFilePath)?project.uiFilePath:(paths[0]||null);
  project.uiFilePath=first;
  project.uiFileTabs=Array.isArray(project.uiFileTabs)?project.uiFileTabs.filter(p=>paths.includes(p)):[];
  if(first&&!project.uiFileTabs.includes(first))project.uiFileTabs.push(first);
  const body=$('#project-body');
  const tree=paths.length?fileTreeHtml(fileTreeNodes(paths),esc,first):'<div class="sub">No generated files yet. Build to create them, or New to add a path.</div>';
  const tabs=project.uiFileTabs.map(p=>`<button class="${p===first?'active':''}" data-file-tab="${esc(p)}">${esc(p.split('/').pop())}</button>`).join('')||'<span class="sub" style="padding:8px">No open file</span>';
  const split=Boolean(settingsState.splitFiles);
  body.innerHTML=`<div class="box"><div class="px-ide" id="px-ide"><div class="px-ide-tree file-list">${tree}<div class="actions" style="margin-top:8px"><button class="ghost" id="new-file">New</button></div></div><div class="px-ide-main"><div class="px-ide-tabs" id="px-file-tabs">${tabs}</div><div class="px-ide-work ${split?'split':''}"><textarea id="file-code-editor" class="code-editor" spellcheck="false">${esc(first?project.files[first]:'Build the project to create real files.')}</textarea><div class="px-ide-preview" ${split?'':'hidden'}><iframe id="file-preview-frame" sandbox="allow-scripts" title="File preview"></iframe></div></div><div class="row"><b id="file-name">${esc(first||'No file selected')}</b><div class="actions"><button class="ghost" id="split-files">${split?'Hide preview':'Split preview'}</button>${first?'<button class="ghost" id="preview-file">Diff hint</button><button class="ghost" id="save-file">Save</button><button class="ghost" id="rename-file">Rename</button><button class="ghost" id="delete-file">Delete</button><button class="download" id="download-file">Download</button>':''}</div></div><div class="sub" id="file-dirty"></div></div></div></div>`;
  let currentPath=first;
  const markDirty=()=>{const dirty=currentPath&&project.files[currentPath]!==$('#file-code-editor').value;$('#file-dirty').textContent=dirty?'Unsaved changes in '+currentPath+' · ⌘S to save':'';$('#file-dirty')?.classList.toggle('file-dirty',Boolean(dirty));$$('[data-file-tab]').forEach(t=>t.classList.toggle('file-dirty',t.dataset.fileTab===currentPath&&dirty));};
  const selectFile=path=>{
    if(!path||!Object.hasOwn(project.files,path))return;
    currentPath=path;project.uiFilePath=path;
    if(!project.uiFileTabs.includes(path))project.uiFileTabs.push(path);
    $$('[data-file]',body).forEach(x=>x.classList.toggle('active',x.dataset.file===path));
    $$('[data-file-tab]',body).forEach(x=>x.classList.toggle('active',x.dataset.fileTab===path));
    $('#file-name').textContent=path;
    $('#file-code-editor').value=project.files[path]||'';
    markDirty();
    refreshFilePreview(project);
  };
  $$('[data-file]',body).forEach(button=>{
    button.onclick=()=>selectFile(button.dataset.file);
    button.oncontextmenu=e=>{e.preventDefault();showFileCtx(e.clientX,e.clientY,button.dataset.file,project);};
  });
  $$('[data-file-tab]',body).forEach(button=>button.onclick=()=>selectFile(button.dataset.fileTab));
  $('#file-code-editor')?.addEventListener('input',()=>{markDirty();if(settingsState.splitFiles)refreshFilePreview(project);});
  $('#split-files')?.addEventListener('click',()=>{settingsState.splitFiles=!settingsState.splitFiles;persistSettings();renderFiles(project);});
  $('#new-file')?.addEventListener('click',()=>{
    const raw=prompt('New file path');const path=sanitizePath(raw||'');
    if(!path)return notify('That path is not allowed.','error');
    snapshot(project,'Before new file');
    applyProjectMutation(project,{fileOperations:[{op:'write',path,content:''}]});
    project.uiFilePath=path;saveProject(project);renderFiles(project);
  });
  $('#preview-file')?.addEventListener('click',()=>{
    if(!currentPath||!Object.hasOwn(project.files,currentPath))return;
    const before=String(project.files[currentPath]||''),after=$('#file-code-editor').value;
    const beforeLines=before?before.split(/\r?\n/).length:0,afterLines=after?after.split(/\r?\n/).length:0;
    notify(before===after?'No changes pending.':currentPath+' · '+Math.abs(afterLines-beforeLines)+' line count delta pending save.','info');
  });
  $('#save-file')?.addEventListener('click',async()=>{
    if(!saveOpenFile(project))return notify('No file changes to save.','info');
    notify('File saved. Generated output is now stale until rebuilt and verified.','success');markDirty();
  });
  $('#rename-file')?.addEventListener('click',async()=>{
    if(!currentPath)return;
    const next=sanitizePath(prompt('Rename to',currentPath)||'');
    if(!next||next===currentPath)return;
    snapshot(project,'Before rename');
    const content=$('#file-code-editor')?.value??project.files[currentPath];
    applyProjectMutation(project,{fileOperations:[{op:'write',path:next,content},{op:'delete',path:currentPath}]});
    project.uiFilePath=next;project.uiFileTabs=(project.uiFileTabs||[]).map(p=>p===currentPath?next:p);
    saveProject(project);await syncRemoteProject(project);renderFiles(project);
  });
  $('#delete-file')?.addEventListener('click',async()=>{
    if(!currentPath)return;
    if(settingsState.confirmDelete&&!confirm('Delete '+currentPath+'?'))return;
    snapshot(project,'Before delete');
    applyProjectMutation(project,{fileOperations:[{op:'delete',path:currentPath}]});
    project.uiFileTabs=(project.uiFileTabs||[]).filter(p=>p!==currentPath);
    project.uiFilePath=project.uiFileTabs[0]||null;
    saveProject(project);await syncRemoteProject(project);renderFiles(project);
  });
  $('#download-file')?.addEventListener('click',()=>currentPath&&downloadText(currentPath,project.files[currentPath]));
  if(split)refreshFilePreview(project);
}
function downloadText(name,content,type='text/plain'){const url=URL.createObjectURL(new Blob([content],{type}));const a=document.createElement('a');a.href=url;a.download=name.split('/').pop();a.click();setTimeout(()=>URL.revokeObjectURL(url),500);}
async function renderTests(project){
  const body=$('#project-body');
  const saved=project.tests?.specVersion===project.specVersion&&Array.isArray(project.tests?.results)?project.tests.results:[];
  const drawResults=(results,status)=>{
    const passed=results.every(x=>x.pass);
    $('#test-results').innerHTML=`<div class="sub" style="margin-bottom:9px">Last run: ${status|| (passed?'passed':'failed')}.</div><div class="result-list">${results.map(result=>`<div class="result ${result.pass?'pass':'fail'}"><b>${result.pass?'PASS':'FAIL'} · ${esc(result.name)}</b><div class="sub">${esc(result.detail)}</div></div>`).join('')}</div>${passed?'':'<div class="actions" style="margin-top:12px"><button class="ghost" id="rebuild-from-tests">Rebuild with AI</button></div>'}`;
    $('#rebuild-from-tests')?.addEventListener('click',()=>{const failures=(project.tests?.results||[]).filter(x=>!x.pass);renderOutput(project);buildArtifact(project,failures);});
  };
  body.innerHTML=`<div class="box"><div style="display:flex;justify-content:space-between;gap:10px"><div><h2 style="margin:0">Tests</h2><div class="sub">Checks the actual generated output and browser runtime.</div></div><button class="primary" id="run-tests">Run tests</button></div><div id="test-results" style="margin-top:14px">${saved.length?'':'<div class="placeholder">Run the checks against the current artifact.</div>'}</div></div>`;
  if(saved.length)drawResults(saved,project.tests.status);
  $('#run-tests').onclick=async()=>{
    const button=$('#run-tests');button.disabled=true;
    try{
      const results=await runTests(project),status=results.every(x=>x.pass)?'passed':'failed';
      drawResults(results,status);
      project.tests={status,specVersion:project.specVersion,results,updatedAt:now()};
      project.status=status==='passed'?'verified':'needs-fix';
      saveProject(project);
      await syncRemoteProject(project);
    }catch(error){
      $('#test-results').innerHTML=`<div class="placeholder">Tests failed to run: ${esc(error.message)}</div>`;
    }finally{button.disabled=false;}
  };
}
async function runTests(project){
  const results=[],files=project.files||{},software=projectArtifactKind(project.type)==='software';
  if(software){
    const html=files['index.html']||files['src/index.html']||'';
    results.push({name:'Entry file exists',pass:Boolean(html),detail:html?'index.html exists.':'No index.html artifact exists.'});
    results.push({name:'HTML structure',pass:/<html[\s>]/i.test(html)&&/<body[\s>]/i.test(html),detail:/<html[\s>]/i.test(html)?'HTML document detected.':'Missing a complete HTML document.'});
    const hasPlaceholderMarker=/\b(TODO|FIXME|coming soon)\b/i.test(Object.values(files).join('\\n'));
    results.push({name:'No obvious placeholder markers',pass:!hasPlaceholderMarker,detail:hasPlaceholderMarker?'TODO/FIXME/coming-soon marker found.':'No obvious placeholder marker found.'});
    results.push(await browserRuntimeCheck(files));
    return results;
  }
  const docEntries=Object.entries(files).filter(([p])=>/\.(md|txt|csv|json)$/i.test(p));
  const text=docEntries.map(([,v])=>String(v)).join('\\n').trim();
  results.push({name:'Deliverable exists',pass:docEntries.length>0,detail:docEntries.length?'A document deliverable file exists.':'No Markdown/text/CSV/JSON deliverable was generated.'});
  results.push({name:'Deliverable has substance',pass:text.length>40,detail:text.length>40?'The deliverable contains substantive content.':'The deliverable is too short to be useful.'});
  const hasPlaceholderMarker=/\b(TODO|FIXME|coming soon)\b/i.test(text);
  results.push({name:'No obvious placeholder markers',pass:!hasPlaceholderMarker,detail:hasPlaceholderMarker?'TODO/FIXME/coming-soon marker found.':'No obvious placeholder marker found.'});
  return results;
}
function browserRuntimeCheck(files){
  return new Promise(resolve=>{
    const frame=document.createElement('iframe');
    frame.setAttribute('sandbox','allow-scripts');
    frame.style.cssText='position:fixed;left:-99999px;width:800px;height:600px;opacity:0';
    document.body.appendChild(frame);
    let settled=false;
    const finish=result=>{if(settled)return;settled=true;window.removeEventListener('message',onMessage);clearTimeout(timer);frame.remove();resolve(result);};
    const onMessage=e=>{if(e.source===frame.contentWindow&&e.data?.type==='PROJECTX_RUNTIME_ERROR')finish({name:'Browser runtime',pass:false,detail:e.data.message||'Runtime error reported by output.'});};
    window.addEventListener('message',onMessage);
    const timer=setTimeout(()=>finish({name:'Browser runtime',pass:true,detail:'No runtime error was reported during the validation window.'}),2200);
    frame.srcdoc=assemblePreviewHtml(files);
  });
}
function renderDelivery(project){
  const body=$('#project-body');
  const software=projectArtifactKind(project.type)==='software';
  const first=Object.keys(project.files||{}).find(p=>software?/\.html?$/i.test(p):/\.(md|txt|csv|json)$/i.test(p))||Object.keys(project.files||{})[0];
  const kindLabel=software?(project.type==='Presentation'?'presentation':'playable'):'document';
  body.innerHTML='<div class="box"><h2 style="margin:0">Delivery</h2><p class="sub">Package the current project without claiming an external deployment.</p><div class="grid"><div class="box"><b>Download output</b><div class="sub">Save the current '+kindLabel+' artifact.</div><button class="download" id="download-output" style="margin-top:9px">Download</button></div><div class="box"><b>Export project</b><div class="sub">Save the canonical project brain and files.</div><button class="download" id="export-project" style="margin-top:9px">Export JSON</button></div><div class="box"><b>Deployment</b><div class="placeholder">Deployment integrations are intentionally inactive until a real account-level provider connection exists.</div></div></div></div>';
  $('#download-output').onclick=()=>{
    if(!first)return;
    if(software)downloadText('projectx-output.html',assemblePreviewHtml(project.files||{}),'text/html');
    else downloadText(first.split('/').pop()||'projectx-deliverable.md',String(project.files[first]||''),'text/plain');
  };
  $('#export-project').onclick=()=>downloadText((project.title.replace(/[^a-z0-9]+/gi,'-').toLowerCase()||'project')+'-project.json',JSON.stringify(serializeForPersistence(project),null,2),'application/json');
}
function projectsPage(){
  shell('<div class="panel"><div class="kicker">PROJECTS</div><h1 class="hero-title" style="font-size:44px">Your projects</h1><p class="sub">One canonical project brain per creation.</p><div class="form" style="margin-top:16px"><input id="project-search" class="input full" placeholder="Search projects by title, type, or goal"><button class="ghost" id="new-project-search">New</button></div><div id="project-list" style="display:grid;gap:10px;margin-top:12px"></div></div>','projects');
  const render=()=>{
    const q=String($('#project-search').value||'').trim().toLowerCase();
    const items=state.projects.filter(p=>!q||[p.title,p.type,p.intent,p.spec?.goal].join(' ').toLowerCase().includes(q));
    $('#project-list').innerHTML=items.map(p=>'<button class="box" data-open="'+esc(p.id)+'" style="text-align:left;cursor:pointer"><b>'+esc(p.title)+'</b><div class="sub">'+esc(p.type)+' · spec v'+p.specVersion+' · '+esc(p.status)+'</div><div class="sub">'+esc(String(p.intent||p.spec?.goal||'').slice(0,180))+'</div></button>').join('')||(q?'<div class="placeholder">No projects match that search.</div>':'<div class="box">No projects yet.</div>');
    $$('[data-open]','#px-app').forEach(btn=>btn.onclick=()=>openProject(btn.dataset.open));
  };
  $('#project-search').oninput=render;
  $('#new-project-search').onclick=home;
  render();
}

function analyticsPage(){
  const tasks=state.projects.reduce((n,p)=>n+(p.executionState?.tasks||[]).length,0);
  const items=state.projects.flatMap(p=>(p.versions||[]).slice(-3).map(v=>({title:p.title,label:v.label,at:v.at})));
  shell(`<div class="panel"><div class="kicker">ACTIVITY</div><h1 class="hero-title" style="font-size:36px">What happened</h1><p class="sub">Project-derived activity only — no invented metrics.</p><div class="grid"><div class="box"><b>Projects</b><div class="sub">${state.projects.length}</div></div><div class="box"><b>Tasks</b><div class="sub">${tasks}</div></div><div class="box"><b>Outputs</b><div class="sub">${state.projects.filter(p=>p.artifacts?.output).length}</div></div></div><div class="box" style="margin-top:12px">${items.length?items.slice().reverse().slice(0,20).map(x=>`<div class="item"><b>${esc(x.title)}</b><div class="sub">${esc(x.label||'Snapshot')} · ${esc(x.at||'')}</div></div>`).join(''):'<div class="placeholder">No snapshots yet.</div>'}</div></div>`,'analytics');
}
async function assistantPage(){shell(`<div class="panel"><div class="kicker">PROJECT X</div><h1 class="hero-title" style="font-size:44px">Assistant X</h1><div class="box"><div id="assistant-log" class="conversation"></div><form id="assistant-form" class="form"><textarea id="assistant-input" placeholder="Ask a general ProjectX question..."></textarea><button class="primary">Send</button></form></div></div>`,'assistant');const messages=[{role:'assistant',text:'What do you need help with?'}];drawConversation(messages,'#assistant-log');$('#assistant-form').onsubmit=async e=>{e.preventDefault();const text=$('#assistant-input').value.trim();if(!text)return;messages.push({role:'user',text});drawConversation(messages,'#assistant-log');$('#assistant-input').value='';try{messages.push({role:'assistant',text:await aiText({message:text,history:messages,project:activeProject()||{},system:'You are Assistant X for ProjectX. Be concise and practical. Never claim actions you did not perform.'})});}catch(error){messages.push({role:'assistant',text:`AI unavailable: ${error.message}`});}drawConversation(messages,'#assistant-log');};}
const SETTINGS=[['general','General'],['ai','AI'],['agents','Agents'],['integrations','Integrations'],['defaults','Project Defaults'],['appearance','Appearance'],['notifications','Notifications'],['security','Security & Privacy'],['git','Git & Deployment'],['storage','Storage'],['billing','Billing & Usage'],['advanced','Advanced']];
function settingsPage(which='general'){shell(`<div class="panel"><div class="kicker">PROJECT X</div><h1 class="hero-title" style="font-size:44px">Settings</h1><div class="settings"><nav class="settings-nav">${SETTINGS.map(([id,name])=>`<button class="${id===which?'active':''}" data-setting="${id}">${name}</button>`).join('')}</nav><div id="settings-body"></div></div></div>`,'settings');$$('[data-setting]').forEach(button=>button.onclick=()=>settingsPage(button.dataset.setting));renderSettings(which);}
async function renderSettings(which){const body=$('#settings-body');if(!body)return;const p=settingsState;if(which==='general')body.innerHTML=`<h2>General</h2><p class="sub">Core ProjectX preferences.</p><div class="box"><div class="row"><div><b>Working mode</b><div class="sub">Choose how much automation ProjectX should use. Provider details stay hidden from normal project work.</div></div><select class="select" id="execution-mode">${['Fast','Balanced','Powerful','Ask Me','Mostly Automatic','Autonomous'].map(m=>'<option '+(p.executionMode===m?'selected':'')+'>'+m+'</option>').join('')}</select></div><div class="row"><div><b>Auto-save</b><div class="sub">Save successful project changes automatically.</div></div><button class="ghost" id="toggle-autosave">${p.autoSave?'On':'Off'}</button></div><div class="row"><div><b>Confirm destructive actions</b></div><button class="ghost" id="toggle-confirm">${p.confirmDelete?'On':'Off'}</button></div><div class="row"><b>Language</b><select class="select" id="language"><option>English</option></select></div><div class="row"><b>Timezone</b><input class="input" id="timezone" value="${esc(p.timezone)}"></div></div>`;
else if(which==='ai')return renderAiSettings(body);
else if(which==='agents')return renderAgentSettings(body);
else if(which==='integrations')body.innerHTML=`<h2>Integrations</h2><div class="box"><div class="row"><div><b>Supabase</b><div class="sub">${ensureSupabase()?'Configured':'Not configured'}</div></div><span class="status ${ensureSupabase()?'ok':'warn'}">${ensureSupabase()?'READY':'PLACEHOLDER'}</span></div><div class="row"><div><b>GitHub</b><div class="sub">Repository automation requires OAuth integration.</div></div><span class="status warn">PLACEHOLDER</span></div></div>`;
else if(which==='defaults')body.innerHTML=`<h2>Project Defaults</h2><div class="box"><div class="row"><b>Default model</b><select class="select" id="default-model">${MODELS.map(m=>`<option ${p.model===m?'selected':''}>${m}</option>`).join('')}</select></div><div class="row"><b>Response style</b><select class="select" id="response-style"><option ${p.responseStyle==='concise'?'selected':''}>concise</option><option ${p.responseStyle==='balanced'?'selected':''}>balanced</option><option ${p.responseStyle==='detailed'?'selected':''}>detailed</option></select></div></div>`;
else if(which==='appearance')body.innerHTML=`<h2>Appearance</h2><div class="box"><div class="row"><b>Theme</b><span class="sub">Workspace uses the ProjectX dark technical theme. The public homepage is light.</span></div></div>`;
else if(which==='notifications')body.innerHTML=`<h2>Notifications</h2><div class="box">${Object.entries(p.notifications).map(([id,on])=>`<div class="row"><b>${esc(id)}</b><button class="ghost" data-notification="${id}">${on?'On':'Off'}</button></div>`).join('')}</div>`;
else if(which==='security')body.innerHTML=`<h2>Security & Privacy</h2><div class="box"><div class="row"><div><b>AI credential storage</b><div class="sub">${session?'Server-side encrypted vault':'Local browser session'}</div></div><span class="status ${session?'ok':'warn'}">${session?'SECURE':'LOCAL'}</span></div><div class="row"><div><b>Account</b><div class="sub">${session?esc(session.user?.email||'Signed in'):'Not signed in'}</div></div>${session?'<button class="ghost" id="security-signout">Sign out</button>':'<button class="ghost" id="security-signin">Sign in</button>'}</div><div class="placeholder">Client-side guest mode never syncs credentials to ProjectX. Sign in to use the encrypted server-side vault.</div></div><div class="box" style="margin-top:10px"><div class="row"><div><b>Security events</b><div class="sub">Recent security events recorded for this account.</div></div><button class="ghost" id="load-security-events">${session?'Load':'Sign in'}</button></div><div id="security-events" class="sub" style="margin-top:10px">No events loaded.</div></div>`;
else if(which==='git')body.innerHTML=`<h2>Git & Deployment</h2><div class="box"><div class="placeholder">GitHub OAuth, repository automation, branch creation, and deployment are placeholders until their real account-level integrations are configured.</div></div>`;
else if(which==='storage')body.innerHTML=`<h2>Storage</h2><div class="box"><div class="row"><b>Projects</b><span class="sub">${state.projects.length}</span></div><div class="row"><b>Generated files</b><span class="sub">${state.projects.reduce((count,project)=>count+Object.keys(project.files||{}).length,0)}</span></div></div>`;
else if(which==='billing')body.innerHTML=`<h2>Billing & Usage</h2><div class="box"><div class="row"><div><b>Plan & checkout</b><div class="sub">Manage Pro and Max subscriptions from the billing page. Checkout becomes active when Razorpay merchant settings are configured.</div></div><button class="ghost" id="open-billing">Open billing</button></div><div class="grid" style="margin-top:10px"><div class="box"><b>30-day requests</b><div id="usage-total" class="hero-title" style="font-size:28px;margin:6px 0">—</div></div><div class="box"><b>30-day units</b><div id="usage-units" class="hero-title" style="font-size:28px;margin:6px 0">—</div></div><div class="box"><b>Top actions</b><div id="usage-actions" class="sub" style="margin-top:7px">Loading…</div></div></div><div class="box" style="margin-top:10px"><b>Recent AI usage</b><div id="usage-recent" style="margin-top:8px">Loading…</div></div></div>`;
else body.innerHTML=`<h2>Advanced</h2><div class="box"><button class="ghost" id="export-state">Export local state</button><button class="ghost" id="clear-state" style="margin-left:7px">Clear local cache</button></div><div class="box" style="margin-top:10px"><b>Skills</b><p class="sub">Only enabled skill names are added to Assistant context.</p><form id="skill-form" class="form"><input id="skill-name" class="input full" placeholder="Skill name"><button class="primary">Add</button></form><div id="skill-list"></div></div>`;bindSettings(which);
  if(which==='advanced'){
    const draw=()=>{$('#skill-list').innerHTML=(settingsState.skills||[]).map((s,i)=>`<div class="row"><b>${esc(s.name)}</b><button class="ghost" data-skill="${i}">${s.enabled?'Enabled':'Disabled'}</button></div>`).join('')||'<div class="placeholder">No skills yet.</div>';$$('[data-skill]').forEach(b=>b.onclick=()=>{settingsState.skills[Number(b.dataset.skill)].enabled=!settingsState.skills[Number(b.dataset.skill)].enabled;persistSettings();draw();});};
    draw();
    $('#skill-form')?.addEventListener('submit',e=>{e.preventDefault();const name=$('#skill-name').value.trim();if(!name)return;settingsState.skills=[...(settingsState.skills||[]),{name,description:'',instructions:'',enabled:true,version:1}];persistSettings();$('#skill-name').value='';draw();});
  }
}
async function renderAgentSettings(body){
  const roles={interviewer:'Discovery and ambiguity reduction.',planner:'Plans from the project brain.',builder:'Creates real files and outputs.',tester:'Validates current artifacts.',researcher:'Structures source-backed evidence.',orchestrator:'Coordinates project actions and execution.'};
  body.innerHTML=`<h2>Agents</h2><p class="sub">Choose specialist models and enable or disable roles. Connected-account model preferences apply to the matching ProjectX specialist.</p><div class="box" id="agent-settings"><div class="sub">Loading available models…</div></div>`;
  let models=[];
  if(session){try{models=(await edge('listModels',{task:'chat'})).models||[]}catch{}}
  if(!models.length)models=[...new Set(MODELS)].map(id=>({id,name:id}));
  const container=$('#agent-settings');
  const optionList=(id)=>models.slice(0,250).map(m=>`<option value="${esc(m.id)}" ${String(settingsState.agentModels?.[id]||settingsState.model)===String(m.id)?'selected':''}>${esc(m.name||m.id)}${m.provider?' · '+esc(m.provider):''}</option>`).join('');
  container.innerHTML=Object.entries(roles).map(([id,purpose])=>`<div class="row"><div><b>${esc(id)}</b><div class="sub">${esc(purpose)}</div></div><div class="actions"><select class="select" data-agent-model="${id}">${optionList(id)}</select><button class="ghost" data-agent-toggle="${id}">${settingsState.agents?.[id]?'Enabled':'Disabled'}</button></div></div>`).join('');
  $$('[data-agent-model]').forEach(select=>select.onchange=e=>{const id=select.dataset.agentModel;settingsState.agentModels={...(settingsState.agentModels||{}),[id]:e.target.value};persistSettings();notify(id+' model preference saved.','success');});
  $$('[data-agent-toggle]').forEach(btn=>btn.onclick=()=>{const id=btn.dataset.agentToggle;settingsState.agents={...settingsState.agents,[id]:!settingsState.agents[id]};persistSettings();renderAgentSettings(body);});
}
async function renderAiSettings(body){
  let server=[];
  if(session){try{server=(await edge('listCredentials')).providers||[]}catch{}}
  const guest=Boolean(localGuestKey());
  const providers=[['google','Google Gemini'],['openai','OpenAI'],['anthropic','Anthropic'],['openrouter','OpenRouter'],['nvidia','NVIDIA NIM'],['bytez','Bytez'],['generic','OpenAI-compatible']];
  body.innerHTML='<h2>AI</h2><p class="sub">Connect an AI provider here. Normal project work stays provider-agnostic.</p><div class="box">'+
    '<div class="row"><div><b>Account storage</b><div class="sub">'+(session?'Connected · encrypted server-side credentials':'Not signed in · Gemini guest key can stay in this browser session')+'</div></div><span class="status '+(session?'ok':'warn')+'">'+(session?'SECURE':'GUEST')+'</span></div>'+
    '<div class="row"><b>Provider</b><select id="provider-id" class="select">'+providers.map(p=>'<option value="'+p[0]+'">'+p[1]+'</option>').join('')+'</select></div>'+
    '<div class="row"><input id="provider-label" class="input" placeholder="Connection label (optional)" maxlength="80"><input id="provider-key" class="input" type="password" placeholder="API key" maxlength="10000"></div>'+
    '<div class="row"><input id="provider-base-url" class="input full" placeholder="Base URL (required for OpenAI-compatible providers)"></div>'+
    '<div class="row"><input id="provider-provider-key" class="input full" type="password" placeholder="Provider key (only when required by this provider)" maxlength="10000"></div>'+
    '<div class="actions"><button class="primary" id="save-provider">Test & save provider</button><button class="ghost" id="refresh-models">Refresh models</button></div>'+
    '<div id="provider-status" class="sub" style="margin-top:8px"></div></div>'+
    '<div class="box" style="margin-top:10px"><b>Connected providers</b><div id="connected-providers" style="margin-top:8px"></div></div>'+
    '<div class="box" style="margin-top:10px"><div class="row"><b>Default model</b><select id="ai-model" class="select"></select></div><div class="sub">ProjectX uses deterministic fallbacks when a selected model is unavailable.</div></div>'+
    '<div class="box" style="margin-top:10px"><b>Guest Gemini</b><div class="sub">Use a free-tier Gemini API key for local browser use. Keys stay in this browser session and are not synced. <a href="'+GEMINI_KEY_URL+'" target="_blank" rel="noopener noreferrer">Create a Gemini key in Google AI Studio</a>.</div><div class="row"><input id="guest-gemini-key" class="input full" type="password" placeholder="Paste Gemini API key"><button id="save-gemini" class="ghost">Save guest key</button></div></div>';
  const status=$('#provider-status');
  const renderConnected=()=>{
    $('#connected-providers').innerHTML=server.length?server.map(x=>'<div class="row"><div><b>'+esc(x.label||x.provider)+'</b><div class="sub">'+esc(x.provider)+' · '+esc(x.keyHint||'masked')+'</div></div><button class="ghost" data-delete-provider="'+esc(x.provider)+'">Remove</button></div>').join(''):'<div class="placeholder">No server-side providers connected.</div>';
    $$('[data-delete-provider]').forEach(btn=>btn.onclick=async()=>{
      if(!session)return;
      btn.disabled=true;
      try{await edge('deleteCredential',{provider:btn.dataset.deleteProvider});server=server.filter(x=>x.provider!==btn.dataset.deleteProvider);renderConnected();status.textContent='Provider removed.';}catch(error){status.textContent=error.message;}finally{btn.disabled=false;}
    });
  };
  const loadModels=async()=>{
    const select=$('#ai-model');select.innerHTML='<option>Loading models…</option>';
    try{
      let models=[];
      if(session){models=(await edge('listModels',{task:'chat'})).models||[];}
      if(!models.length)models=[...new Set(MODELS)].map(id=>({id,name:id}));
      select.innerHTML=models.slice(0,250).map(m=>'<option value="'+esc(m.id)+'">'+esc(m.name||m.id)+(m.provider?' · '+esc(m.provider):'')+'</option>').join('');
      select.value=settingsState.model;
      if(select.value!==settingsState.model&&models[0]){settingsState.model=models[0].id;persistSettings();}
    }catch(error){select.innerHTML='<option value="">Unable to load models</option>';status.textContent=error.message;}
  };
  renderConnected();
  await loadModels();
  $('#save-provider').onclick=async()=>{
    if(!session){status.textContent='Sign in before saving a server-side provider.';return;}
    const provider=$('#provider-id').value,apiKey=$('#provider-key').value.trim(),baseUrl=$('#provider-base-url').value.trim(),providerKey=$('#provider-provider-key').value.trim(),label=$('#provider-label').value.trim()||'ProjectX connection';
    if(!apiKey){status.textContent='Enter an API key.';return;}
    const button=$('#save-provider');button.disabled=true;status.textContent='Testing provider…';
    try{
      const result=await edge('testCredential',{provider,apiKey,baseUrl,providerKey});
      await edge('saveCredential',{provider,apiKey,baseUrl,providerKey,label});
      server=(await edge('listCredentials')).providers||[];
      renderConnected();await loadModels();status.textContent='Connected and model discovery succeeded.';
    }catch(error){status.textContent='Could not connect: '+error.message;}
    finally{button.disabled=false;}
  };
  $('#refresh-models').onclick=loadModels;
  $('#ai-model').onchange=e=>{settingsState.model=e.target.value;persistSettings();};
  $('#save-gemini').onclick=async()=>{
    const key=$('#guest-gemini-key').value.trim();
    if(!key){status.textContent='Enter a Gemini key first.';return;}
    if(session){try{await edge('testCredential',{provider:'google',apiKey:key});await edge('saveCredential',{provider:'google',apiKey:key,label:'ProjectX Gemini'});server=(await edge('listCredentials')).providers||[];renderConnected();await loadModels();status.textContent='Gemini saved to the encrypted account vault.';}catch(error){status.textContent='Gemini connection failed: '+error.message;}}
    else{setGuestKey(key);setGuestStatus(key);status.textContent='Gemini saved for this browser session.';}
  };
}
async function loadUsagePanel(){
  const total=$('#usage-total'),units=$('#usage-units'),actions=$('#usage-actions'),recent=$('#usage-recent');
  if(!total||!units||!actions||!recent)return;
  try{
    const result=await edge('usage');
    total.textContent=String(result.totalRequests||0);
    units.textContent=String(result.totalUnits||0);
    const entries=Object.entries(result.byAction||{}).sort((a,b)=>Number(b[1])-Number(a[1])).slice(0,5);
    actions.innerHTML=entries.length?entries.map(([k,v])=>'<div>'+esc(k)+' · '+esc(v)+'</div>').join(''):'No AI requests yet.';
    const rows=Array.isArray(result.recent)?result.recent:[];
    recent.innerHTML=rows.length?rows.map(x=>'<div class="brain-row"><b>'+esc(x.action||'chat')+'</b><div class="sub">'+esc(x.model||'auto')+' · '+esc(x.provider||'provider')+' · '+esc(x.created_at||'')+'</div></div>').join(''):'No recent AI usage.';
  }catch(error){
    if(total)total.textContent='—';if(units)units.textContent='—';if(actions)actions.textContent=error.message;if(recent)recent.textContent='Usage unavailable.';
  }
}
function bindSettings(which){
  $('#load-security-events')?.addEventListener('click',async()=>{
    if(!session){authModal();return;}
    const node=$('#security-events');node.textContent='Loading…';
    try{const result=await edge('securityEvents');const events=Array.isArray(result.events)?result.events:[];node.innerHTML=events.length?events.map(e=>'<div class="brain-row"><b>'+esc(e.severity||'info')+' · '+esc(e.event_type||'event')+'</b><div class="sub">'+esc(e.created_at||'')+'</div></div>').join(''):'No security events recorded.';}catch(error){node.textContent=error.message;}
  });
  if(which==='billing'&&session)loadUsagePanel();$('#open-billing')?.addEventListener('click',()=>{location.href='./billing.html';});
  $('#execution-mode')?.addEventListener('change',e=>{settingsState.executionMode=e.target.value;persistSettings();});$('#toggle-autosave')?.addEventListener('click',()=>{settingsState.autoSave=!settingsState.autoSave;persistSettings();renderSettings(which)});$('#toggle-confirm')?.addEventListener('click',()=>{settingsState.confirmDelete=!settingsState.confirmDelete;persistSettings();renderSettings(which)});$('#language')?.addEventListener('change',e=>{settingsState.language=e.target.value;persistSettings()});$('#timezone')?.addEventListener('change',e=>{settingsState.timezone=e.target.value;persistSettings()});$('#default-model')?.addEventListener('change',e=>{settingsState.model=e.target.value;persistSettings()});$('#ai-model')?.addEventListener('change',e=>{settingsState.model=e.target.value;persistSettings()});$$('[data-agent]').forEach(button=>button.onclick=()=>{const id=button.dataset.agent;settingsState.agents[id]=!settingsState.agents[id];persistSettings();renderSettings('agents')});$$('[data-notification]').forEach(button=>button.onclick=()=>{const id=button.dataset.notification;settingsState.notifications[id]=!settingsState.notifications[id];persistSettings();renderSettings('notifications')});$('#security-signin')?.addEventListener('click',authModal);$('#security-signout')?.addEventListener('click',()=>signOut().then(()=>settingsPage('security')));$('#export-state')?.addEventListener('click',()=>downloadText('projectx-state.json',JSON.stringify(state,null,2),'application/json'));$('#clear-state')?.addEventListener('click',()=>{if(settingsState.confirmDelete&&!confirm('Clear local project cache? Cloud projects remain in your account.'))return;state={version:6,projects:[],active:null};persistLocal();home();});}
function authModal(initialMode='signin'){closeModal();const modal=document.createElement('div');modal.className='modal-bg';modal.innerHTML=`<div class="modal"><div class="kicker">PROJECT X ACCOUNT</div><h2>Use secure project storage</h2><p class="sub">Sign in to sync projects and store AI credentials in the encrypted server-side vault.</p><div style="display:flex;gap:7px;margin:12px 0"><button class="ghost" id="auth-signin-mode">Sign in</button><button class="ghost" id="auth-signup-mode">Create account</button></div><input id="auth-email" class="input full" type="email" placeholder="Email" autocomplete="username"><input id="auth-password" class="input full" type="password" placeholder="Password" style="margin-top:7px" autocomplete="current-password"><div id="auth-status" class="sub" style="margin-top:8px"></div><div class="actions"><button class="ghost" id="auth-recover">Recover</button><button class="ghost" id="auth-cancel">Cancel</button><button class="primary" id="auth-submit">Continue</button></div></div>`;document.body.appendChild(modal);currentModal=modal;let mode=initialMode==='signup'?'signup':'signin';const setMode=m=>{mode=m;$('#auth-signin-mode').classList.toggle('active',m==='signin');$('#auth-signup-mode').classList.toggle('active',m==='signup');$('#auth-submit').textContent=m==='signup'?'Create account':'Sign in';};setMode(mode);$('#auth-signin-mode').onclick=()=>setMode('signin');$('#auth-signup-mode').onclick=()=>setMode('signup');$('#auth-cancel').onclick=closeModal;$('#auth-recover').onclick=async()=>{const email=$('#auth-email').value.trim();if(!email){$('#auth-status').textContent='Enter your email to send a recovery link.';return;}try{const client=ensureSupabase();if(!client)throw new Error('Auth is not configured.');const {error}=await client.auth.resetPasswordForEmail(email,{redirectTo:location.href.split('#')[0]});if(error)throw error;$('#auth-status').textContent='If that account exists, a recovery email was sent.';}catch(error){$('#auth-status').textContent=error.message;}};$('#auth-submit').onclick=async()=>{const email=$('#auth-email').value.trim(),password=$('#auth-password').value;if(!email||password.length<6){$('#auth-status').textContent='Enter an email and a password with at least 6 characters.';return;}const button=$('#auth-submit');button.disabled=true;try{await authAction(mode,email,password);closeModal();await syncRemoteProjects();home();notify('Secure account connected.','success');}catch(error){$('#auth-status').textContent=error.message;}finally{button.disabled=false;}};}
function closeModal(){currentModal?.remove();currentModal=null;}
function aiRequiredModal(message){closeModal();const modal=document.createElement('div');modal.className='modal-bg';modal.innerHTML=`<div class="modal"><div class="kicker">AI CONNECTION REQUIRED</div><h2>Connect your AI</h2><p class="sub">${esc(message)}</p><p class="sub" style="margin-top:10px"><a href="${GEMINI_KEY_URL}" target="_blank" rel="noopener noreferrer">Create a free-tier Gemini API key</a> in Google AI Studio, then paste it into Settings → AI.</p><div class="actions"><button class="ghost" id="ai-close">Cancel</button><button class="primary" id="ai-settings">Open Settings</button></div></div>`;document.body.appendChild(modal);currentModal=modal;$('#ai-close').onclick=closeModal;$('#ai-settings').onclick=()=>{closeModal();settingsPage('ai');};}
function ensureTasks(project){
  project.executionState=project.executionState||{};
  if(!Array.isArray(project.executionState.tasks)){
    const runs=Array.isArray(project.executionState.runs)?project.executionState.runs:[];
    project.executionState.tasks=runs.map(r=>({id:r.id,title:r.task||r.agent||'Task',description:r.task||'',status:r.status==='in_progress'?'active':(r.status||'draft'),agent:r.agent,createdAt:r.startedAt,updatedAt:r.startedAt,affectedFiles:[],logs:[],result:null,approval:null}));
  }
  return project.executionState.tasks;
}
function addTask(project,title,opts={}){
  const tasks=ensureTasks(project);
  const task={id:crypto.randomUUID?.()||('task-'+Date.now()),title:String(title||'Untitled task').slice(0,160),description:String(opts.description||'').slice(0,2000),status:opts.status||'draft',priority:opts.priority||'normal',agent:opts.agent||'orchestrator',dependencies:opts.dependencies||[],progress:0,createdAt:now(),updatedAt:now(),affectedFiles:opts.affectedFiles||[],affectedArtifacts:[],logs:[],result:null,verification:null,approval:null,error:null};
  tasks.unshift(task);
  applyProjectMutation(project,{executionStatePatch:{tasks,status:'in_progress',lastAgent:task.agent}});
  saveProject(project);syncRemoteProject(project);
  return task;
}
function renderOverview(project){
  const root=$('#project-body');if(!root)return;
  const tasks=ensureTasks(project);
  const files=Object.keys(project.files||{});
  root.innerHTML=`<div class="grid"><div class="box"><b>Brain</b><div class="sub">${esc(project.understanding?.summary||project.intent||'No summary yet.')}</div></div><div class="box"><b>Tasks</b><div class="sub">${tasks.length} recorded</div></div><div class="box"><b>Files</b><div class="sub">${files.length} in workspace</div></div></div><div class="box" style="margin-top:12px"><b>Next</b><div class="sub">Open Assistant to change the project, Design to iterate visually, or Tasks to inspect work.</div><div class="actions"><button class="primary" data-project-tool="assistant">Open Assistant</button><button class="ghost" data-project-tool="tasks">Task board</button></div></div>`;
  $$('[data-project-tool]',root).forEach(b=>b.onclick=()=>renderProjectTool(project,b.dataset.projectTool));
}
function renderTasks(project){
  const root=$('#project-body');if(!root)return;
  const tasks=ensureTasks(project);
  const view=project.uiTaskView||'kanban';
  const list=tasks.map(t=>`<div class="item" data-task="${esc(t.id)}"><b>${esc(t.title)}</b><div class="sub">${esc(t.status)} · ${esc(t.agent||'orchestrator')} · ${esc((t.affectedFiles||[]).join(', ')||'no files yet')}</div></div>`).join('')||'<div class="px-empty">No tasks yet. Add one here or ask the Assistant to start work.</div>';
  toolShell('TASKS','Work board',ExecutionProvider.note,'<div class="actions"><button class="ghost" id="task-view-kanban">Kanban</button><button class="ghost" id="task-view-list">List</button></div><form id="task-form" class="form"><input id="task-title" class="input full" placeholder="New task, e.g. Authentication"><button class="primary">Add task</button></form>'+(view==='list'?list:UI.taskBoard(tasks,esc))+'<div id="task-detail"></div>');
  $('#task-view-kanban').onclick=()=>{project.uiTaskView='kanban';saveProject(project);renderTasks(project);};
  $('#task-view-list').onclick=()=>{project.uiTaskView='list';saveProject(project);renderTasks(project);};
  $('#task-form').onsubmit=e=>{e.preventDefault();const title=$('#task-title').value.trim();if(!title)return;addTask(project,title,{status:'draft'});renderTasks(project);};
  const drawDetail=t=>{
    $('#task-detail').innerHTML=`<div class="box px-task-detail" style="margin-top:12px"><b>${esc(t.title)}</b><div class="sub">${esc(t.status)} · ${esc(t.agent||'orchestrator')} · ${esc(t.updatedAt||'')}</div><p class="sub">${esc(t.description||'No description.')}</p><div class="sub">Files: ${esc((t.affectedFiles||[]).join(', ')||'None')}</div><div class="placeholder">${ExecutionProvider.isolatedWorkers?'Worker attached.':'Queued work runs sequentially through Assistant. This task does not start a remote shell.'}</div><div class="actions"><button class="ghost" data-task-status="active">Start</button><button class="ghost" data-task-status="ready">Mark ready</button><button class="primary" data-task-status="done">Approve / done</button><button class="ghost" data-task-status="cancelled">Cancel</button></div></div>`;
    $$('[data-task-status]').forEach(b=>b.onclick=()=>{t.status=b.dataset.taskStatus;t.updatedAt=now();if(t.status==='done'&&project.pendingMutation)return renderProjectChat(project);applyProjectMutation(project,{executionStatePatch:{tasks}});saveProject(project);renderTasks(project);});
  };
  $$('[data-task]').forEach(el=>el.onclick=()=>{const t=tasks.find(x=>x.id===el.dataset.task);if(t)drawDetail(t);});
}
function renderCanvas(project){
  const root=$('#project-body');if(!root)return;
  project.design=project.design||{x:0,y:0,z:1,frames:[],history:[]};
  const files=project.files||{};
  const html=assemblePreviewHtml(files);
  root.innerHTML=`<div class="box"><div class="kicker">DESIGN CANVAS</div><p class="sub">Pan and zoom. Live frames are the sandboxed artifact. Mock frames are exploratory until you apply them to project files.</p><div class="actions"><button class="ghost" id="canvas-mock">Add mock</button><button class="ghost" id="canvas-variant">Variants A–D</button><button class="ghost" id="canvas-undo">Undo</button><button class="primary" id="canvas-apply">Apply selected</button></div></div><div class="px-canvas" id="px-canvas"><div class="px-canvas-inner" id="px-canvas-inner"></div></div>`;
  const canvas=$('#px-canvas'),inner=$('#px-canvas-inner');
  const pushHistory=()=>{project.design.history=(project.design.history||[]).concat([JSON.stringify(project.design.frames)]).slice(-20);};
  const drawFrames=()=>{
    inner.querySelectorAll('.px-frame').forEach(n=>{if(n.dataset.frame!=='live')n.remove();});
    (project.design.frames||[]).forEach(f=>{
      const el=document.createElement('div');
      el.className='px-frame'+(project.design.selected===f.id?' selected':'');
      el.dataset.frame=f.id;
      el.style.cssText=`left:${f.left}px;top:${f.top}px;width:${f.width}px;height:${f.height}px`;
      el.innerHTML=`<div class="px-frame-label">${esc(f.label)}</div><div class="body" style="padding:12px;color:#111">${esc(f.body||'Mock')}</div><div class="px-frame-resize" data-resize="${esc(f.id)}"></div>`;
      inner.appendChild(el);
    });
  };
  const live=document.createElement('div');
  live.className='px-frame selected';
  live.dataset.frame='live';
  live.style.cssText='left:40px;top:40px;width:720px;height:480px';
  live.innerHTML='<div class="px-frame-label">Live artifact</div>';
  const frame=document.createElement('iframe');
  frame.setAttribute('sandbox','allow-scripts');
  frame.title='Canvas preview';
  frame.srcdoc=html;
  live.appendChild(frame);
  inner.appendChild(live);
  drawFrames();
  let x=project.design.x||0,y=project.design.y||0,z=project.design.z||1,drag=null,resize=null;
  const apply=()=>{inner.style.transform=`translate(${x}px,${y}px) scale(${z})`;project.design.x=x;project.design.y=y;project.design.z=z;};
  apply();
  canvas.onwheel=e=>{e.preventDefault();z=Math.min(2.2,Math.max(.35,z+(e.deltaY<0?.08:-.08)));apply();};
  canvas.onpointerdown=e=>{
    const rz=e.target.closest('[data-resize]');
    if(rz){const f=project.design.frames.find(x=>x.id===rz.dataset.resize);resize={f,sx:e.clientX,sy:e.clientY,w:f.width,h:f.height};canvas.setPointerCapture(e.pointerId);return;}
    const fr=e.target.closest('.px-frame');
    if(fr){project.design.selected=fr.dataset.frame;$$('.px-frame').forEach(n=>n.classList.toggle('selected',n===fr));return;}
    drag={sx:e.clientX-x,sy:e.clientY-y};canvas.setPointerCapture(e.pointerId);
  };
  canvas.onpointermove=e=>{
    if(resize?.f){resize.f.width=Math.max(180,resize.w+(e.clientX-resize.sx)/z);resize.f.height=Math.max(120,resize.h+(e.clientY-resize.sy)/z);drawFrames();live.remove();inner.prepend(live);return;}
    if(!drag)return;x=e.clientX-drag.sx;y=e.clientY-drag.sy;apply();
  };
  canvas.onpointerup=()=>{drag=null;resize=null;saveProject(project);};
  $('#canvas-mock').onclick=()=>{pushHistory();project.design.frames.push({id:'mock-'+Date.now(),label:'Mock',body:String(project.understanding?.summary||project.intent||'Exploratory mock'),left:80+(project.design.frames.length*24),top:540,width:320,height:200});drawFrames();saveProject(project);};
  $('#canvas-variant').onclick=()=>{pushHistory();['A','B','C','D'].forEach((letter,i)=>project.design.frames.push({id:'var-'+letter+Date.now(),label:'Variant '+letter,body:'Direction '+letter+' for '+String(project.title||'project'),left:800,top:40+i*220,width:280,height:200}));drawFrames();saveProject(project);notify('Four variant frames added. Apply writes the selected direction into design files.','info');};
  $('#canvas-undo').onclick=()=>{const last=(project.design.history||[]).pop();if(!last)return;project.design.frames=JSON.parse(last);drawFrames();saveProject(project);};
  $('#canvas-apply').onclick=()=>{
    const id=project.design.selected;
    if(!id||id==='live')return notify('Live frame is already the production artifact. Rebuild from Output to change files.','info');
    const f=(project.design.frames||[]).find(x=>x.id===id);if(!f)return notify('Select a mock or variant frame first.','info');
    snapshot(project,'Before applying canvas direction');
    applyProjectMutation(project,{fileOperations:[{op:'write',path:'design/selected.md',content:'# '+f.label+'\n\n'+String(f.body||'')+'\n'}]});
    project.artifacts={...(project.artifacts||{}),design:{kind:'mockup',specVersion:project.specVersion,summary:f.label,stale:false,updatedAt:now()}};
    saveProject(project);syncRemoteProject(project);notify(f.label+' applied as design/selected.md.','success');
  };
}
function renderArtifacts(project){
  const list=Object.entries(project.artifacts||{});
  toolShell('ARTIFACTS','Project artifacts','One project can hold several related deliverables that share the brain.','<div class="actions"><button class="primary" id="new-artifact">New artifact note</button></div>'+(list.length?list.map(([k,v])=>`<div class="item"><b>${esc(k)}</b><p>${esc(v?.kind||'artifact')} · spec v${esc(v?.specVersion)} · ${v?.stale?'stale':'current'}</p></div>`).join(''):'<div class="px-empty">No artifacts yet. Build from Output to create the first.</div>'));
  $('#new-artifact')?.addEventListener('click',()=>{project.artifacts={...(project.artifacts||{}),['note-'+Date.now()]:{kind:'note',specVersion:project.specVersion,summary:'Workspace note',stale:false,updatedAt:now()}};saveProject(project);renderArtifacts(project);});
}
function renderDatabase(){
  const client=ensureSupabase();
  toolShell('DATABASE','Project data','Reads live rows from your signed-in Supabase client. Table names you type are queried; nothing is invented. Destructive SQL is not run from this panel.','<form id="db-form" class="form"><input id="db-table" class="input full" placeholder="Table name you are allowed to read"><button class="primary">Load rows</button></form><div id="db-results" class="placeholder" style="margin-top:12px">'+(session?(client?'Enter a table name. Results come from Supabase.':'Supabase client is not configured.'):'Sign in to query your project database.')+'</div>');
  $('#db-form')?.addEventListener('submit',async e=>{
    e.preventDefault();
    const table=String($('#db-table').value||'').trim().replace(/[^a-zA-Z0-9_]/g,'').slice(0,64);
    const out=$('#db-results');if(!table){out.textContent='Enter a table name.';return;}
    if(!session||!client){out.textContent='Sign in with a configured Supabase client first.';return;}
    out.textContent='Loading…';
    try{
      const {data,error}=await client.from(table).select('*').limit(50);
      if(error)throw error;
      if(!Array.isArray(data)||!data.length){out.innerHTML='<div class="placeholder">No rows returned. The table may be empty or RLS blocked the read.</div>';return;}
      const keys=Object.keys(data[0]).slice(0,12);
      out.innerHTML='<div class="sub">'+data.length+' row(s)</div><div style="overflow:auto;margin-top:8px"><table class="px-table"><thead><tr>'+keys.map(k=>'<th>'+esc(k)+'</th>').join('')+'</tr></thead><tbody>'+data.slice(0,50).map(row=>'<tr>'+keys.map(k=>'<td>'+esc(row[k]==null?'':typeof row[k]==='object'?JSON.stringify(row[k]):row[k])+'</td>').join('')+'</tr>').join('')+'</tbody></table></div>';
    }catch(error){out.textContent='Query failed: '+(error.message||error)+'. No rows were invented.';}
  });
}
async function renderStorage(){
  const client=ensureSupabase();
  toolShell('STORAGE','Assets','Lists buckets from the signed-in Supabase client. Upload requires a bucket you already control.','<div id="storage-list" class="placeholder">Checking storage…</div>');
  const out=$('#storage-list');
  if(!session||!client){out.textContent=session?'Supabase client is not configured.':'Sign in to list storage buckets.';return;}
  try{
    const {data,error}=await client.storage.listBuckets();
    if(error)throw error;
    if(!data?.length){out.innerHTML='<div class="placeholder">No buckets returned. Create a bucket in the Supabase dashboard, then refresh.</div>';return;}
    out.innerHTML=data.map(b=>`<div class="row"><b>${esc(b.name)}</b><span class="sub">${b.public?'public':'private'}</span></div>`).join('');
  }catch(error){out.textContent='Storage list failed: '+(error.message||error)+'. No files were invented.';}
}
function renderIntegrations(){
  toolShell('INTEGRATIONS','Connectors','Only mark a connector connected after a real OAuth or credential handshake.','<div class="box"><div class="row"><b>GitHub</b><span class="status warn">Not connected</span></div><div class="row"><b>Supabase</b><span class="status '+(ensureSupabase()?'ok':'warn')+'">'+(ensureSupabase()?'Client ready':'Not configured')+'</span></div><div class="row"><b>Stripe</b><span class="status warn">Not connected</span></div></div>');
}
function renderSecrets(project){
  const names=Array.isArray(project.executionState?.secretNames)?project.executionState.secretNames:[];
  toolShell('SECRETS','Environment names','Secret values are never shown in the browser. Names are recorded on the project; values belong in the encrypted account vault.','<form id="secret-form" class="form"><input id="secret-name" class="input full" placeholder="NAME, e.g. STRIPE_KEY"><button class="primary">Add name</button></form>'+(names.map(n=>`<div class="row"><b>${esc(n)}</b><span class="sub">•••• stored server-side if a vault entry exists</span></div>`).join('')||'<div class="placeholder">No secret names recorded.</div>'));
  $('#secret-form')?.addEventListener('submit',e=>{e.preventDefault();const name=String($('#secret-name').value||'').trim().replace(/[^A-Z0-9_]/gi,'').slice(0,48);if(!name)return;const next=[...new Set([...names,name])];applyProjectMutation(project,{executionStatePatch:{secretNames:next}});saveProject(project);renderSecrets(project);});
}
function renderSeo(project){
  const html=String(project.files?.['index.html']||'');
  const title=(html.match(/<title>([^<]*)<\/title>/i)||[])[1];
  const desc=(html.match(/name=["']description["'][^>]*content=["']([^"']*)/i)||html.match(/content=["']([^"']*)["'][^>]*name=["']description["']/i)||[])[1];
  toolShell('SEO','Document metadata','Reads the current artifact only. Search rankings are not invented.','<div class="box"><div class="row"><b>Title</b><span class="sub">'+(title?esc(title):'Not found in index.html')+'</span></div><div class="row"><b>Description</b><span class="sub">'+(desc?esc(desc):'Not found')+'</span></div><div class="row"><b>Canonical HTML</b><span class="sub">'+(html?'Present':'No index.html')+'</span></div></div>');
}
function renderTerminal(){
  toolShell('OUTPUT','Execution provider',ExecutionProvider.note,'<div class="placeholder">Remote terminal is unavailable. '+esc(ExecutionProvider.kind)+' — ProjectX will not pretend a shell command succeeded.</div>');
}
function renderCollab(){
  toolShell('MEMBERS','Collaboration','Presence uses Supabase Realtime when signed in. Additional members appear only after they exist on the project.','<div class="box"><div class="row"><b>'+(session?.user?.email||'Guest')+'</b><span class="sub">Owner</span></div></div>'+(session?'<div class="sub" style="margin-top:8px">Realtime channel is attached while this project is open.</div>':'<div class="placeholder">Sign in to sync collaboration events.</div>'));
}
function renderDeploy(project){
  toolShell('DEPLOY','Publish',DeploymentProvider.note,'<div class="grid"><div class="box"><b>Status</b><div class="sub">Not deployed</div></div><div class="box"><b>Provider</b><div class="sub">'+esc(DeploymentProvider.kind)+'</div></div><div class="box"><b>Domain</b><div class="sub">Add a domain after a host is connected. DNS is not applied automatically.</div></div></div><form id="domain-form" class="form" style="margin-top:12px"><input id="domain-host" class="input full" placeholder="example.com"><button class="ghost">Record domain</button></form><div id="domain-list"></div><div class="actions"><button class="ghost" id="export-deploy">Export artifact</button></div>');
  const names=Array.isArray(project.executionState?.domains)?project.executionState.domains:[];
  $('#domain-list').innerHTML=names.map(d=>`<div class="row"><b>${esc(d.host)}</b><span class="status warn">${esc(d.status)}</span></div>`).join('')||'<div class="placeholder">No domains recorded.</div>';
  $('#domain-form')?.addEventListener('submit',e=>{e.preventDefault();const host=String($('#domain-host').value||'').trim().toLowerCase();if(!host||!/^[a-z0-9.-]+$/.test(host))return notify('Enter a hostname. Verification is manual.','info');const next=[...names.filter(x=>x.host!==host),{host,status:'awaiting DNS'}];applyProjectMutation(project,{executionStatePatch:{domains:next}});saveProject(project);renderDeploy(project);});
  $('#export-deploy')?.addEventListener('click',()=>renderDelivery(project));
}
function openPalette(){
  const pal=$('#px-palette');if(!pal)return;pal.hidden=false;$('#px-palette-input').value='';drawPalette('');$('#px-palette-input').focus();
}
function drawPalette(q){
  const list=$('#px-palette-list');if(!list)return;
  const query=String(q||'').toLowerCase();
  const cmds=UI.COMMANDS.filter(c=>c[1].toLowerCase().includes(query));
  const projects=state.projects.filter(p=>p.title.toLowerCase().includes(query)||String(p.intent||'').toLowerCase().includes(query)).slice(0,8);
  const p=activeProject();
  const files=p?Object.keys(p.files||{}).filter(f=>f.toLowerCase().includes(query)).slice(0,8):[];
  const tasks=p?(p.executionState?.tasks||[]).filter(t=>String(t.title||'').toLowerCase().includes(query)).slice(0,8):[];
  const brain=p&&query?[p.spec?.goal,p.understanding?.summary].filter(Boolean).filter(x=>String(x).toLowerCase().includes(query)):[];
  list.innerHTML=cmds.map(c=>`<button data-cmd-go="${esc(c[2])}">${esc(c[1])}</button>`).join('')
    +projects.map(x=>`<button data-open="${esc(x.id)}">Open ${esc(x.title)}</button>`).join('')
    +files.map(f=>`<button data-cmd-go="files">${esc(f)}</button>`).join('')
    +tasks.map(t=>`<button data-cmd-go="tasks">${esc(t.title)}</button>`).join('')
    +(brain.length?`<button data-cmd-go="brain">Brain match</button>`:'');
  $$('[data-cmd-go]',list).forEach(b=>b.onclick=()=>{closePalette();const id=b.dataset.cmdGo;if(id==='toggle-assistant'||id==='toggle-nav'||id==='toggle-bottom'){if(id==='toggle-assistant')settingsState.hideAssistant=!settingsState.hideAssistant;if(id==='toggle-nav')settingsState.hideNav=!settingsState.hideNav;if(id==='toggle-bottom')settingsState.showBottom=!settingsState.showBottom;persistSettings();applyChromeLayout();return;}const cur=activeProject();if(cur&&UI.PROJECT_NAV.some(n=>n[0]===id)){cur.uiNav=id;saveProject(cur);return renderProjectTool(cur,id);}navigate(id);});
}
function closePalette(){$('#px-palette')&&($('#px-palette').hidden=true);}
function bindPalette(){
  const input=$('#px-palette-input');if(!input||input.dataset.bound)return;input.dataset.bound='1';
  input.oninput=()=>drawPalette(input.value);
  input.onkeydown=e=>{if(e.key==='Escape')closePalette();if(e.key==='Enter'){$('#px-palette-list button')?.click();}};
}

function navigate(route){if(route==='home')home();else if(route==='projects')projectsPage();else if(route==='analytics')analyticsPage();else if(route==='assistant'){const p=activeProject();if(p){p.uiNav='assistant';return renderProjectTool(p,'assistant');}assistantPage();}else if(route==='settings')settingsPage('general');else if(UI.PROJECT_NAV.some(n=>n[0]===route)){const p=activeProject();if(p){p.uiNav=route;saveProject(p);return renderProjectTool(p,route);}projectsPage();}}
window.addEventListener('beforeunload',()=>runtimeTestCleanup?.());
window.addEventListener('keydown',e=>{
  const key=e.key.toLowerCase();
  if((e.metaKey||e.ctrlKey)&&key==='k'){e.preventDefault();openPalette();}
  if((e.metaKey||e.ctrlKey)&&key==='b'){e.preventDefault();settingsState.hideNav=!settingsState.hideNav;persistSettings();applyChromeLayout();}
  if((e.metaKey||e.ctrlKey)&&key==='j'){e.preventDefault();settingsState.showBottom=!settingsState.showBottom;persistSettings();applyChromeLayout();}
  if((e.metaKey||e.ctrlKey)&&key==='\\'){e.preventDefault();settingsState.hideAssistant=!settingsState.hideAssistant;persistSettings();applyChromeLayout();}
  if((e.metaKey||e.ctrlKey)&&key==='s'){
    const p=activeProject();
    if(p&&$('#file-code-editor')){e.preventDefault();if(saveOpenFile(p))notify('File saved.','success');else notify('No file changes to save.','info');}
  }
  if(e.key==='Escape'){closePalette();hideShare();const ctx=$('#px-ctx');if(ctx)ctx.hidden=true;}
});
async function boot(){installCss();installOptionalAnalytics();await refreshSession();if(!state.projects.length){const legacy=read('px_adaptive_v1',null)||read('builder_universal_v14',null);if(legacy?.projects?.length){state.projects=legacy.projects.map(migrateProject);persistLocal();}}await syncRemoteProjects();home();const wantsSignin=location.hash==='#signin'||new URLSearchParams(location.search).get('auth')==='signin';if(wantsSignin){history.replaceState(null,'',location.pathname+location.search);setTimeout(()=>authModal('signin'),0);}const wantsSignup=location.hash==='#signup'||new URLSearchParams(location.search).get('auth')==='signup';if(wantsSignup){history.replaceState(null,'',location.pathname+location.search);setTimeout(()=>authModal('signup'),0);}}
window.ProjectX={state:()=>state,settings:()=>settingsState,openProject,refresh:boot};
boot();
