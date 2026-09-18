import {
  createProject,
  migrateProject,
  normalizeSections,
  mergeSpec,
  validateSpec,
  applyProjectMutation,
  sanitizePath,
  assemblePreviewHtml,
  serializeForPersistence,
  buildDependencyMap,
} from './projectx-core.js';

const STORE = 'projectx_runtime_v6';
const LOCAL_KEY = 'projectx_guest_gemini_key';
const LOCAL_STATUS = 'projectx_guest_gemini_status';
const LOCAL_SETTINGS = 'projectx_settings_v6';
const MODELS = ['gemini-3.5-flash-lite', 'gemini-3.5-flash'];
const MAX_HISTORY = 80;

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));
const read = (k, fallback) => { try { return JSON.parse(localStorage.getItem(k) || 'null') ?? fallback; } catch { return fallback; } };
const write = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch { return false; } };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const now = () => new Date().toISOString();

const DEFAULT_SETTINGS = {
  model: MODELS[0], responseStyle: 'balanced', autoSave: true, confirmDelete: true,
  theme: 'light', language: 'English', timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
  agents: { interviewer: true, planner: true, builder: true, tester: true, researcher: true },
  notifications: { build: true, test: true, deploy: true, credits: true, security: true }
};

let state = read(STORE, { version: 6, projects: [], active: null });
if (!Array.isArray(state.projects)) state = { version: 6, projects: [], active: null };
let settingsState = { ...DEFAULT_SETTINGS, ...read(LOCAL_SETTINGS, {}) };
let supa = null;
let session = null;
let currentModal = null;
let runtimeTestCleanup = null;

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

async function signOut() { try { await ensureSupabase()?.auth.signOut(); } catch {} session = null; }

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
        const body = { systemInstruction: { parts: [{ text: system }] }, contents: messages.slice(-MAX_HISTORY).map(m => ({ role: m.role === 'assistant' ? 'model' : 'user', parts: [{ text: String(m.text ?? '').slice(0, 12000) }] })), generationConfig: { temperature: settingsState.responseStyle === 'concise' ? 0.15 : 0.25, maxOutputTokens } };
        if (jsonMode) body.generationConfig.responseMimeType = 'application/json';
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

const parseJson = text => { try { return JSON.parse(text); } catch { const m = String(text).match(/\{[\s\S]*\}/); if (m) { try { return JSON.parse(m[0]); } catch {} } return null; } };

async function aiJson(mode, payload, max = 3500) {
  if (session?.access_token) {
    const result = await edge('chat', { mode, project: serializeForPersistence(payload.project || {}), message: payload.message || '', history: payload.history || [], model: settingsState.model });
    if (result.result && typeof result.result === 'object') return result.result;
    return parseJson(result.text || '');
  }
  const result = await directGemini(payload.history || [{ role: 'user', text: payload.message || JSON.stringify(payload) }], payload.system || 'You are ProjectX.', true, max);
  return parseJson(result.text);
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

const CSS = `#px-app{position:fixed;inset:0;z-index:2147483000;background:#fff;color:#171a1f;font:14px system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;overflow:hidden}#px-app *{box-sizing:border-box}#px-app button,#px-app input,#px-app textarea,#px-app select{font:inherit}#px-app .side{position:fixed;inset:0 auto 0 0;width:240px;background:#fafbfc;border-right:1px solid #e5e8eb;padding:24px 14px;display:flex;flex-direction:column;overflow:auto}.logo{font-size:21px;font-weight:800;letter-spacing:-.04em;padding:0 10px 24px}.new,.primary{border:0;border-radius:8px;background:#171a1f;color:#fff;cursor:pointer}.new{height:38px;font-size:12px;font-weight:700}.nav{display:grid;gap:2px;margin-top:12px}.nav button,.recent button,.assist-btn{border:1px solid transparent;background:transparent;color:#68717d;text-align:left;padding:9px 10px;border-radius:8px;font-size:11px;cursor:pointer}.nav button.active,.nav button:hover,.recent button:hover,.assist-btn:hover{background:#eef0f3;color:#171a1f}.label{font-size:9px;letter-spacing:.15em;text-transform:uppercase;color:#9aa2ad;padding:0 10px 8px}.divider{height:1px;background:#e5e8eb;margin:18px 7px}.acct{margin-top:auto;border:1px solid #dde1e5;border-radius:10px;background:#fff;padding:9px;font-size:11px}.main{margin-left:240px;height:100%;overflow:auto}.top{height:58px;border-bottom:1px solid #eceef1;display:flex;justify-content:flex-end;align-items:center;gap:7px;padding:0 28px}.top button,.ghost,.download{border:1px solid #dfe3e7;background:#fff;color:#505966;border-radius:7px;padding:8px 11px;font-size:11px;cursor:pointer}.wrap,.interview,.panel,.project{width:min(1080px,calc(100% - 48px));margin:auto;padding:48px 0}.center{text-align:center}.kicker{font-size:9px;letter-spacing:.16em;text-transform:uppercase;color:#a0a7b0}.hero-title,.project-title{font-size:clamp(38px,5vw,60px);line-height:1.02;letter-spacing:-.06em;margin:12px 0}.sub{color:#78818d;line-height:1.55;font-size:13px}.composer{border:1px solid #d7dce2;border-radius:12px;max-width:900px;margin:26px auto 0;overflow:hidden}.composer textarea{width:100%;min-height:140px;border:0;outline:0;resize:vertical;padding:18px}.composer-foot{border-top:1px solid #edf0f2;display:flex;justify-content:space-between;align-items:center;padding:7px}.send{width:39px;height:39px;border:0;border-radius:8px;background:#171a1f;color:#fff;cursor:pointer}.send:disabled,.primary:disabled{opacity:.45;cursor:wait}.chips{display:flex;gap:7px;flex-wrap:wrap;justify-content:center;margin:16px 0}.chip{border:1px solid #dfe3e7;background:#fff;border-radius:999px;padding:7px 10px;font-size:10px;color:#68717d;cursor:pointer}.conversation{display:grid;gap:9px;max-height:58vh;overflow:auto;margin:20px 0}.msg{max-width:84%;padding:11px 14px;border-radius:13px;white-space:pre-wrap;font-size:13px;line-height:1.5}.msg.ai{background:#f3f4f5}.msg.user{background:#171a1f;color:#fff;justify-self:end}.form{display:flex;gap:7px;border:1px solid #d7dce2;border-radius:12px;padding:7px}.form textarea{flex:1;min-height:45px;border:0;outline:0;resize:none;padding:9px}.form button{border:0;border-radius:8px;background:#171a1f;color:#fff;padding:0 16px;cursor:pointer}.project-context{display:flex;gap:9px;align-items:center;flex-wrap:wrap;margin:8px 0 4px;color:#6f7884;font-size:11px}.context-group{font-size:9px;letter-spacing:.12em;font-weight:800;color:#171a1f}.project-context+.sections{margin-top:10px}.sections{display:flex;overflow:auto;border-bottom:1px solid #e6e9ec;justify-content:center}.tab{border:0;background:transparent;padding:12px 13px;color:#7b8490;font-size:11px;font-weight:700;white-space:nowrap;border-bottom:2px solid transparent;cursor:pointer}.tab.active{color:#171a1f;border-bottom-color:#171a1f}.body{padding-top:24px}.box{border:1px solid #e1e5e9;border-radius:11px;background:#fff;padding:16px}.grid{display:grid;grid-template-columns:repeat(3,1fr);gap:10px}.section-block{padding:11px 12px;margin:10px 0;border:1px solid #edf0f2;border-radius:9px;background:#fbfcfd}.section-block b{font-size:12px}.section-block p{margin:4px 0 0;color:#6f7884;font-size:12px;line-height:1.5}.item{border-top:1px solid #edf0f2;padding:12px 0}.item:first-child{border-top:0}.item b{font-size:12px}.item p{margin:4px 0;color:#6f7884;font-size:12px;line-height:1.5}.files{display:grid;grid-template-columns:220px 1fr;min-height:470px}.file-list{border-right:1px solid #e7eaed;padding-right:10px;overflow:auto}.file-list button{width:100%;border:0;background:transparent;text-align:left;padding:8px;border-radius:6px;font-size:11px;color:#65707c;cursor:pointer}.file-list button.active,.file-list button:hover{background:#f0f2f4;color:#171a1f}.code{margin:0;background:#f7f8f9;border-radius:8px;padding:14px;white-space:pre-wrap;overflow:auto;max-height:560px;font:11px/1.55 ui-monospace,SFMono-Regular,Consolas,monospace}.artifact iframe{width:100%;height:620px;border:1px solid #dfe3e7;border-radius:9px;background:#fff}.result-list{display:grid;gap:8px}.result{border:1px solid #e1e5e9;border-radius:9px;padding:11px}.result.pass{border-color:#cde8d5}.result.fail{border-color:#efcaca}.settings{display:grid;grid-template-columns:190px 1fr;gap:25px}.settings-nav{display:grid;align-content:start;gap:2px;border-right:1px solid #e5e8eb;padding-right:12px}.settings-nav button{border:0;background:transparent;text-align:left;padding:9px 10px;border-radius:7px;color:#68717d;font-size:11px;cursor:pointer}.settings-nav button.active,.settings-nav button:hover{background:#eef0f3;color:#171a1f}.input,.select{height:35px;border:1px solid #d9dee3;border-radius:7px;padding:0 9px;outline:0;background:#fff;font-size:11px}.input.full{width:100%}.row{display:flex;justify-content:space-between;gap:12px;align-items:center;padding:11px 0}.row+.row{border-top:1px solid #edf0f2}.status{font-size:10px;font-weight:700}.ok{color:#287a45}.bad{color:#a33a3a}.warn{color:#8f6b11}.placeholder{border:1px dashed #d9dee3;border-radius:8px;padding:12px;color:#8a939d;font-size:11px;line-height:1.5}.modal-bg{position:fixed;inset:0;z-index:2147483600;background:rgba(15,19,24,.34);display:grid;place-items:center;padding:20px}.modal{width:min(540px,100%);background:#fff;border-radius:14px;padding:22px;box-shadow:0 18px 70px rgba(0,0,0,.18)}.modal h2{margin:0 0 7px;font-size:22px;letter-spacing:-.04em}.actions{display:flex;justify-content:flex-end;gap:7px;margin-top:17px}.actions button{height:35px;padding:0 11px;border-radius:7px;border:1px solid #d9dee3;background:#fff;cursor:pointer;font-size:10px}.actions .primary{background:#171a1f;color:#fff;border-color:#171a1f}.understanding{max-width:900px;margin:18px auto 0}.understanding-main{display:flex;gap:12px;align-items:flex-start;border:1px solid #dfe3e7;border-radius:11px;padding:13px 14px;background:#fbfcfd}.understanding-group{font-size:10px;letter-spacing:.12em;font-weight:800;white-space:nowrap}.understanding-copy{min-width:0}.understanding-copy b{font-size:12px}.understanding-category{display:inline-block;margin-top:7px;font-size:10px;color:#6f7884}.understanding-meta{display:flex;gap:10px;flex-wrap:wrap;margin-top:7px;font-size:10px;color:#6f7884}.notice{position:fixed;left:50%;bottom:20px;transform:translateX(-50%);z-index:2147483700;background:#171a1f;color:#fff;padding:10px 14px;border-radius:10px;font-size:12px;max-width:calc(100vw - 28px);box-shadow:0 10px 30px rgba(0,0,0,.14)}.notice.error{background:#8e2d2d}.notice.success{background:#1f6d3c}@media(max-width:820px){#px-app .side{inset:0 0 auto;width:auto;height:58px;flex-direction:row;align-items:center;padding:7px 10px;overflow:hidden}.logo{padding:0 8px;font-size:19px}.new{height:34px;padding:0 10px;margin-right:7px}.nav{display:flex;flex:1;justify-content:center;margin:0}.nav span,.divider,.label,.assist-btn,.recent{display:none}.acct{margin:0}.main{margin-left:0;padding-top:58px}.top{height:50px;padding:0 12px}.wrap,.interview,.panel,.project{width:calc(100% - 28px);padding:38px 0}.grid{grid-template-columns:1fr}.settings{grid-template-columns:1fr}.settings-nav{display:flex;overflow:auto;border-right:0;border-bottom:1px solid #e5e8eb;padding-bottom:8px}.files{grid-template-columns:1fr}.file-list{border-right:0;border-bottom:1px solid #e7eaed;padding-right:0;padding-bottom:8px}.sections{justify-content:flex-start}.msg{max-width:92%}}
`;
function installCss(){if($('#px-style'))return;const style=document.createElement('style');style.id='px-style';style.textContent=CSS;document.head.appendChild(style);}
function ensureShell(){installCss();let root=$('#px-app');if(!root){root=document.createElement('div');root.id='px-app';document.body.appendChild(root);}return root;}
function shell(body, active='home'){const root=ensureShell();const recents=state.projects.slice(0,6);root.innerHTML=`<aside class="side"><div class="logo">ProjectX</div><button class="new" data-nav="home">+ New project</button><nav class="nav"><button data-nav="home" class="${active==='home'?'active':''}">Home</button><button data-nav="projects" class="${active==='projects'?'active':''}">Projects</button><button data-nav="settings" class="${active==='settings'?'active':''}">Settings</button></nav><div class="divider"></div><div class="label">Recent</div><div class="recent">${recents.map(p=>`<button data-open="${esc(p.id)}">${esc(p.title)}</button>`).join('')||'<div class="sub" style="padding:6px 10px">No projects yet</div>'}</div><div class="acct">${session?.user?.email?`Signed in as ${esc(session.user.email)}`:'Guest workspace'}<div class="sub" style="font-size:10px;margin-top:2px">${session?'Cloud sync enabled':'Local sync enabled'}</div></div></aside><main class="main"><div class="top"><button data-nav="home">Home</button>${session?'<button data-action="signout">Sign out</button>':'<button data-action="signin">Sign in</button>'}</div>${body}</main>`;root.onclick=async e=>{const nav=e.target.closest('[data-nav]')?.dataset.nav;if(nav)return navigate(nav);const open=e.target.closest('[data-open]')?.dataset.open;if(open)return openProject(open);const action=e.target.closest('[data-action]')?.dataset.action;if(action==='signin')return authModal();if(action==='signout'){await signOut();home();}};return root;}
function home(){shell(`<div class="wrap"><div class="center"><div class="kicker">PROJECT X</div><h1 class="hero-title">What do you want to accomplish?</h1><p class="sub" style="max-width:680px;margin:0 auto">Start with one conversation. ProjectX first determines whether your request is real-world or non-real-world, then asks only what is missing and creates the workspace the project actually needs.</p><div class="composer"><textarea id="start-input" placeholder="Tell ProjectX what you want to accomplish..."></textarea><div class="composer-foot"><span class="sub">${session?'AI account connected':localGuestKey()?`Gemini connected ${guestStatus()?.hint||''}`:'AI key required to start'}</span><button class="send" id="start-send">→</button></div></div></div></div>`,'home');const input=$('#start-input');$('#start-send').onclick=()=>beginCreation(input.value);input.onkeydown=e=>{if((e.ctrlKey||e.metaKey)&&e.key==='Enter'){e.preventDefault();$('#start-send').click();}};}
async function beginCreation(text){const intent=String(text||'').trim();if(!intent)return;if(!session&&!localGuestKey())return aiRequiredModal('ProjectX needs an AI connection. You can use a free-tier Gemini key in this browser, or sign in and use a server-side provider connection.');const history=[{role:'user',text:intent}],meta={answers:[],brain:null};renderInterview(history,meta);await continueInterview(history,meta.answers,meta);}
function renderInterview(history,meta){shell(`<div class="interview"><div class="kicker">PROJECT X · ONE CHAT</div><h1 class="hero-title" style="font-size:46px">Let’s understand it.</h1><p class="sub">Stay in this one conversation until the project is sufficiently understood.</p><div id="interview-understanding" class="understanding" aria-live="polite"></div><div id="interview-log" class="conversation"></div><form id="interview-form" class="form"><textarea id="interview-input" placeholder="Answer in your own words..."></textarea><button id="interview-send">Send</button></form><div id="interview-status" class="sub" style="text-align:center;margin-top:8px">Thinking…</div></div>`,'home');drawConversation(history,'#interview-log');$('#interview-form').onsubmit=async e=>{e.preventDefault();const input=$('#interview-input'),send=$('#interview-send'),text=input.value.trim();if(!text||send.disabled)return;send.disabled=true;history.push({role:'user',text});meta.answers.push(text);input.value='';drawConversation(history,'#interview-log');try{await continueInterview(history,meta.answers,meta);}finally{send.disabled=false;}};$('#interview-input').onkeydown=e=>{if((e.ctrlKey||e.metaKey)&&e.key==='Enter'){e.preventDefault();$('#interview-form').requestSubmit();}};}
function drawConversation(history,selector){const el=$(selector);if(!el)return;el.innerHTML=history.map(m=>`<div class="msg ${m.role==='user'?'user':'ai'}">${esc(m.text)}</div>`).join('');el.scrollTop=el.scrollHeight;}
function mergeDiscoveryProject(previous={},next={}){
  const out={...(previous||{})};
  const scalar=['title','goal','type','platform','visualDirection','currentState'];
  for(const key of scalar) if(next&&typeof next[key]==='string'&&next[key].trim()) out[key]=next[key].trim();
  for(const key of ['users','requirements','constraints','features','decisions','dependencies','assets','deliverables','acceptanceCriteria','successCriteria','technology']){
    if(Array.isArray(next?.[key])) out[key]=[...new Set([...(Array.isArray(out[key])?out[key]:[]),...next[key].map(v=>String(v??'').trim()).filter(Boolean)])];
  }
  if(Array.isArray(next?.openQuestions)) out.openQuestions=next.openQuestions.map(v=>String(v??'').trim()).filter(Boolean);
  if(next?.game&&typeof next.game==='object') out.game={...(out.game||{}),...Object.fromEntries(Object.entries(next.game).filter(([k,v])=>typeof v==='boolean'?true:String(v??'').trim()))};
  return out;
}
function renderInterviewUnderstanding(data){
  const root=$('#interview-understanding');
  if(!root)return;
  const group=String(data?.classification?.group||'').toUpperCase();
  if(group!=='REAL_WORLD'&&group!=='NON_REAL_WORLD'){root.innerHTML='';return;}
  const label=group==='REAL_WORLD'?'REAL-WORLD':'NON-REAL-WORLD';
  const category=String(data?.category||'').trim();
  const reason=String(data?.classification?.reason||'').trim();
  const summary=String(data?.summary||'').trim();
  const missing=Array.isArray(data?.missing)?data.missing.slice(0,4):[];
  root.innerHTML=`<div class="understanding-main"><div class="understanding-group">${label}</div><div class="understanding-copy"><b>What ProjectX understands</b><div class="sub">${esc(summary||reason||'Classification established from your request.')}</div><div class="understanding-meta">${category?`<span>Category · ${esc(category)}</span>`:''}${missing.length?`<span>Still needed · ${esc(missing.join(', '))}</span>`:''}</div></div></div>`;
}
const interviewSystem = "You are ProjectX's discovery architect. The user's original request is the source of truth. Follow this order exactly: (1) classify the request as REAL_WORLD or NON_REAL_WORLD before deciding any lower-level category; (2) visibly explain the classification in the returned data; (3) infer the most useful AI-derived category only after that classification; (4) ask exactly one high-value question at a time, specific to what the user already said; (5) continue until the intent, target users, concrete requirements, constraints, desired deliverables, relevant platform/domain details, and important ambiguities are understood. REAL_WORLD means an actual real-world objective, activity, organization, plan, decision, business, event, research effort, or problem. NON_REAL_WORLD means a fictional, digital, creative, software, simulated, or virtual creation. Do not force a lower category from a fixed list. Return JSON only: {\"done\":boolean,\"question\":string,\"confidence\":number,\"missing\":string[],\"ambiguities\":string[],\"classification\":{\"group\":\"REAL_WORLD|NON_REAL_WORLD\",\"label\":string,\"reason\":string},\"category\":string,\"project\":{\"title\":string,\"type\":\"Game|Website|App|Mobile|Business|Research|Agent|Automation|API|Other\",\"goal\":string,\"users\":string[],\"requirements\":string[],\"constraints\":string[],\"features\":string[],\"decisions\":string[],\"dependencies\":string[],\"assets\":string[],\"deliverables\":string[],\"acceptanceCriteria\":string[],\"successCriteria\":string[],\"openQuestions\":string[],\"platform\":string,\"technology\":string[],\"visualDirection\":string,\"game\":{\"kind\":string,\"player\":string,\"controls\":string,\"loop\":string,\"theme\":string,\"progression\":string,\"multiplayer\":boolean}},\"workspace\":{\"sections\":[{\"name\":string,\"purpose\":string,\"dependsOn\":string[],\"kind\":\"workspace|output|research|planning|code|test|publish\",\"agent\":string,\"capabilities\":string[]}]},\"summary\":string}. The classification must be present on every response. When done, workspace.sections must contain 2-8 genuinely relevant sections derived from this specific project. Never use generic fallback section sets. Do not add Code, Files, Preview, Playtest, Research, or Business sections unless the user's project actually requires that work. Chat is added by the runtime. Never invent facts.";
async function continueInterview(history, answers, meta={}){
  $('#interview-status')&&($('#interview-status').textContent='Thinking…');
  try{
    const discoveryProject=meta.brain?.project||{};
    const discoveryUnderstanding=meta.brain?.understanding||{};
    const data=await aiJson('understand',{project:{...discoveryProject,understanding:discoveryUnderstanding},history,message:history[history.length-1]?.text||'',system:interviewSystem},3600);
    if(!data||!data.project)throw new Error('The AI returned no usable project-understanding result.');
    const group=String(data.classification?.group||discoveryUnderstanding.group||'').trim().toUpperCase();
    if(group!=='REAL_WORLD'&&group!=='NON_REAL_WORLD')throw new Error('The AI did not return a valid REAL_WORLD/NON_REAL_WORLD classification.');
    const mergedProject=mergeDiscoveryProject(discoveryProject,data.project);
    const priorWorkspace=Array.isArray(meta.brain?.workspace)?meta.brain.workspace:[];
    const workspaceCandidate=Array.isArray(data.workspace?.sections)&&data.workspace.sections.length?data.workspace.sections:priorWorkspace;
    const category=String(data.category||discoveryUnderstanding.category||'').trim();
    const summary=String(data.summary||discoveryUnderstanding.summary||'').trim();
    meta.brain={project:mergedProject,workspace:workspaceCandidate,understanding:{confidence:Number(data?.confidence||0),missing:Array.isArray(data?.missing)?data.missing:[],ambiguities:Array.isArray(data?.ambiguities)?data.ambiguities:[],group,category,summary}};

    renderInterviewUnderstanding({...data,project:mergedProject,category,summary});
    const type=normalizeProjectType(mergedProject.type||data.project.type||'Other');
    const safeCategory=category.slice(0,120);
    const spec=mergeSpec({},mergedProject);
    const quality=validateSpec(spec,type);
    const declaredMissing=Array.isArray(data.missing)?data.missing:[];
    const ambiguities=Array.isArray(data.ambiguities)?data.ambiguities:[];
    const missing=[...new Set([...quality.missing,...declaredMissing,...(Array.isArray(spec.openQuestions)?spec.openQuestions:[])])];
    const confidence=Number(data.confidence||0);
    const workspace=(Array.isArray(workspaceCandidate)?workspaceCandidate:[]).filter(s=>s&&String(s.name||'').trim()).slice(0,8);
    const done=data.done===true&&quality.valid&&confidence>=.82&&missing.length===0&&ambiguities.length===0&&workspace.length>=2;
    if(!done){
      const question=String(data.question||'').trim();
      if(!question)throw new Error('The AI did not return a discovery question.');
      history.push({role:'assistant',text:question.slice(0,800)});
      drawConversation(history,'#interview-log');
      $('#interview-status')&&($('#interview-status').textContent=String(Math.round(confidence*100))+'% understood · refining from your input');
      return;
    }
    const project=createProject({title:mergedProject.title||data.project.title,type,intent:mergedProject.goal||history[0].text,spec,sections:workspace,conversation:history,agents:data.agents});
    project.category=safeCategory||type;
    project.understanding={confidence,missing:[],ambiguities:[],method:session?'secure-ai':'guest-ai',group,groupLabel:group==='REAL_WORLD'?'REAL-WORLD':'NON-REAL-WORLD',category:safeCategory||type,executionType:type,classification:data.classification||{group,label:group==='REAL_WORLD'?'REAL-WORLD':'NON-REAL-WORLD',reason:'Classification established from the request.'},summary:summary||''};
    project.status='ready';
    saveProject(project,true);
    await syncRemoteProject(project);
    openProject(project.id);
  }catch(error){
    $('#interview-status')&&($('#interview-status').textContent='Discovery failed safely: '+String(error.message||error)+'. No project was created from partial or fallback data.');
  }
}
function saveProject(project,initial=false){if(initial)snapshot(project,'Initial project');const i=state.projects.findIndex(p=>p.id===project.id);if(i>=0)state.projects[i]=project;else state.projects.unshift(project);state.active=project.id;persistLocal();}
function snapshot(project,label){project.versions=Array.isArray(project.versions)?project.versions:[];project.versions.push({version:project.specVersion,label,at:now(),spec:JSON.parse(JSON.stringify(project.spec)),files:JSON.parse(JSON.stringify(project.files||{})),artifacts:JSON.parse(JSON.stringify(project.artifacts||{}))});if(project.versions.length>20)project.versions.splice(0,project.versions.length-20);}
async function syncRemoteProjects(){await refreshSession();if(!session)return;try{const result=await edge('listProjects');for(const remoteRaw of result.projects||[]){const remote=migrateProject(remoteRaw);const local=state.projects.find(p=>p.id===remote.id);if(!local||new Date(remote.updatedAt)>new Date(local.updatedAt||0)){const i=state.projects.findIndex(p=>p.id===remote.id);if(i>=0)state.projects[i]=remote;else state.projects.push(remote);}}persistLocal();}catch(e){notify(`Cloud sync unavailable: ${e.message}`,'error');}}
async function syncRemoteProject(project){if(!session||!settingsState.autoSave)return;try{const result=await edge('persistProject',{project:serializeForPersistence(project)});project.sync={remoteId:result.projectId||project.id,mode:'cloud',lastSyncedAt:now()};persistLocal();}catch(e){project.sync={remoteId:null,mode:'local',lastSyncedAt:project.sync?.lastSyncedAt||null,error:e.message};persistLocal();}}
async function openProject(id){const project=state.projects.find(p=>p.id===id);if(!project)return;state.active=id;persistLocal();renderProject(project);if(session){try{const result=await edge('getProject',{projectId:id});if(result.project){const remote=migrateProject(result.project);const i=state.projects.findIndex(p=>p.id===id);if(i>=0)state.projects[i]=remote;else state.projects.push(remote);state.active=id;persistLocal();renderProject(remote);}}catch{}}}
function renderProject(project){const group=project.understanding?.group;const groupLabel=group==='REAL_WORLD'?'REAL-WORLD':group==='NON_REAL_WORLD'?'NON-REAL-WORLD':'PROJECT';const category=project.category||project.understanding?.category||project.type||'PROJECT';const summary=String(project.understanding?.summary||project.intent||'').trim();shell(`<div class="project"><div class="kicker">${groupLabel} · ${esc(category)}</div><h1 class="project-title">${esc(project.title)}</h1><div class="project-context"><span class="context-group">${groupLabel}</span><span>${esc(summary||'ProjectX is working from the current project brain.')}</span></div><div class="sections">${project.sections.map(s=>`<button class="tab ${project.selectedSection===s.id?'active':''}" data-section="${esc(s.id)}">${esc(s.name)}</button>`).join('')}</div><div id="project-body" class="body"></div></div>`,'projects');$$('.tab',$('#px-app')).forEach(button=>button.onclick=()=>{project.selectedSection=button.dataset.section;saveProject(project);renderProject(project)});renderSection(project,project.sections.find(s=>s.id===project.selectedSection)||project.sections[0]);}
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
    case 'research':
    case 'workspace':
    default: return renderGeneratedSection(project,section);
  }
}
const projectAgentSystem=`You are ProjectX's project agent. The canonical project specification is the source of truth. Return JSON only: {"intent":"answer|change|build|test|research|publish","message":string,"changed":boolean,"specPatch":{},"workspaceSections":[],"fileOperations":[{"op":"write|delete","path":"safe/relative/path","content":"complete file content"}],"needsBuild":boolean}. Only set changed=true for real project changes. Never claim a file, artifact, build, test, research result, or deployment exists without returning the corresponding operation or verified result. For software/game changes prefer real file operations.`;
function renderProjectChat(project,prefill=''){
  const body=$('#project-body');
  const messages=project.conversation.length?project.conversation.slice(-MAX_HISTORY):[{role:'assistant',text:'I have the canonical project state in context. What should we change or work on next?'}];
  body.innerHTML='<div class="box"><div class="sub">Project Chat changes the canonical project state. Real mutations create a new version and invalidate dependent output.</div><div id="project-log" class="conversation"></div><form id="project-form" class="form"><textarea id="project-input" placeholder="Ask ProjectX to change, build, research, test, or explain something..."></textarea><button class="primary" id="project-send">Send</button></form></div>';
  drawConversation(messages,'#project-log');
  const input=$('#project-input'),send=$('#project-send');
  input.value=prefill;
  $('#project-form').onsubmit=async e=>{
    e.preventDefault();
    const text=input.value.trim();
    if(!text||send.disabled)return;
    send.disabled=true;
    messages.push({role:'user',text});
    drawConversation(messages,'#project-log');
    input.value='';
    try{
      const data=await aiJson('discuss',{project,history:messages,message:text,system:projectAgentSystem},5500);
      if(!data)throw new Error('The AI returned invalid project action data.');
      const wantsMutation=Boolean(
        data.changed||
        (data.specPatch&&typeof data.specPatch==='object'&&Object.keys(data.specPatch).length)||
        (Array.isArray(data.workspaceSections)&&data.workspaceSections.length)||
        (Array.isArray(data.fileOperations)&&data.fileOperations.length)||
        (Array.isArray(data.agents)&&data.agents.length)
      );
      if(wantsMutation){
        snapshot(project,'Before change');
        const mutation=applyProjectMutation(project,{
          specPatch:data.specPatch||{},
          workspaceSections:Array.isArray(data.workspaceSections)?data.workspaceSections:undefined,
          agents:Array.isArray(data.agents)?data.agents:undefined,
          fileOperations:Array.isArray(data.fileOperations)?data.fileOperations:[]
        });
        if(!mutation.changed)throw new Error('The AI requested a mutation but nothing in the canonical project state changed.');
        project.status=data.needsBuild?'needs-build':'changed';
        project.executionState={...(project.executionState||{}),lastAgent:'orchestrator'};
      }
      if(data.changed&&!wantsMutation)throw new Error('The AI claimed a change without returning an executable mutation.');
      messages.push({role:'assistant',text:String(data.message||'Done.')});
      project.conversation=messages.slice(-MAX_HISTORY);
      saveProject(project);
      await syncRemoteProject(project);

      const intent=String(data.intent||'answer').toLowerCase();
      if(intent==='build'||data.needsBuild){
        renderOutput(project);
        await buildArtifact(project);
        return;
      }
      if(intent==='test'){
        renderTests(project);
        const results=await runTests(project);
        const resultsNode=$('#test-results');
        if(resultsNode)resultsNode.innerHTML=`<div class="result-list">${results.map(result=>`<div class="result ${result.pass?'pass':'fail'}"><b>${result.pass?'PASS':'FAIL'} · ${esc(result.name)}</b><div class="sub">${esc(result.detail)}</div></div>`).join('')}</div>`;
        project.tests={status:results.every(x=>x.pass)?'passed':'failed',specVersion:project.specVersion,results,updatedAt:now()};
        project.status=results.every(x=>x.pass)?'verified':'needs-fix';
        saveProject(project);
        await syncRemoteProject(project);
        return;
      }
      renderProject(project);
    }catch(error){
      messages.push({role:'assistant',text:`I couldn't complete that request: ${error.message}`});
      drawConversation(messages,'#project-log');
    }finally{send.disabled=false;}
  };
  input.onkeydown=e=>{if((e.ctrlKey||e.metaKey)&&e.key==='Enter'){e.preventDefault();$('#project-form').requestSubmit();}};
}
function applyFileOperations(project,operations){project.files=project.files||{};for(const op of operations){const path=sanitizePath(op.path);if(!path)continue;if(op.op==='write'&&typeof op.content==='string'&&op.content.length<=600000)project.files[path]=op.content;if(op.op==='delete')delete project.files[path];}if(Object.keys(project.files).length)project.artifacts={...(project.artifacts||{}),manifest:{specVersion:project.specVersion,files:Object.keys(project.files)}};}
async function renderGeneratedSection(project,section){
  const body=$('#project-body');
  body.innerHTML=`<div class="box"><div style="display:flex;justify-content:space-between;gap:10px"><div><h2 style="margin:0">${esc(section.name)}</h2><div class="sub">${esc(section.purpose)}</div></div><button class="ghost" id="section-refresh">${project.sectionContent?.[section.id]?.specVersion===project.specVersion?'Refresh':'Generate'}</button></div><div id="section-content" style="margin-top:14px"><div class="sub">Generating from project spec v${project.specVersion}…</div></div></div>`;
  $('#section-refresh').onclick=()=>{delete project.sectionContent[section.id];saveProject(project);renderGeneratedSection(project,section)};
  const cached=project.sectionContent?.[section.id];
  if(cached?.specVersion===project.specVersion){drawSectionContent(cached);return;}
  try{
    const instruction={section:{name:section.name,purpose:section.purpose,kind:section.kind,capabilities:section.capabilities||[]},rule:'Work only on this section. Use the project brain as context, but do not restate the whole project or invent work.',task:`Produce the useful content a person would actually need inside the "${section.name}" section.`};
    const system='Return JSON only: {"summary":string,"blocks":[{"heading":string,"text":string}],"items":[{"title":string,"detail":string,"status":"proposed|ready|blocked|unknown"}],"nextActions":string[],"openQuestions":string[]}. Tailor every field to the exact section name and purpose. Do not create generic filler, repeat the same content across sections, or claim completed work without evidence.';
    const data=await aiJson('plan',{project,history:[],message:JSON.stringify(instruction),system},3600);
    const content={specVersion:project.specVersion,summary:String(data?.summary||''),blocks:Array.isArray(data?.blocks)?data.blocks.filter(x=>x&&String(x.heading||x.text||'').trim()).slice(0,8).map(x=>({heading:String(x.heading||'').slice(0,100),text:String(x.text||'').slice(0,900)})):[],items:Array.isArray(data?.items)?data.items.slice(0,20):[],nextActions:Array.isArray(data?.nextActions)?data.nextActions.slice(0,10):[],openQuestions:Array.isArray(data?.openQuestions)?data.openQuestions.slice(0,10):[]};
    project.sectionContent={...(project.sectionContent||{}),[section.id]:content};
    saveProject(project);await syncRemoteProject(project);drawSectionContent(content);
  }catch(error){$('#section-content').innerHTML=`<div class="sub">Generation failed: ${esc(error.message)}. No project data was changed.</div>`;}
}
function drawSectionContent(data){
  $('#section-content').innerHTML=`<div class="sub">${esc(data.summary)}</div>${(data.blocks||[]).map(block=>`<div class="section-block"><b>${esc(block.heading||'')}</b><p>${esc(block.text||'')}</p></div>`).join('')}${(data.items||[]).map(item=>`<div class="item"><b>${esc(item.title||'Item')}</b><p>${esc(item.detail||'')} <span class="status ${item.status==='ready'?'ok':item.status==='blocked'?'bad':'warn'}">${esc(item.status||'unknown')}</span></p></div>`).join('')}<div class="grid">${data.nextActions?.length?`<div class="box"><b>Next actions</b>${data.nextActions.map(x=>`<div class="sub">• ${esc(x)}</div>`).join('')}</div>`:''}${data.openQuestions?.length?`<div class="box"><b>Open questions</b>${data.openQuestions.map(x=>`<div class="sub">• ${esc(x)}</div>`).join('')}</div>`:''}</div>`;
}
async function renderOutput(project){const body=$('#project-body'),current=project.artifacts?.output?.specVersion===project.specVersion&&Object.keys(project.files||{}).length>0;body.innerHTML=`<div class="box"><div style="display:flex;justify-content:space-between;gap:10px"><div><h2 style="margin:0">${project.type==='Game'?'Playtest':'Output'}</h2><div class="sub">${current?'Live output from the current project artifact.':'No current artifact exists yet.'}</div></div><button id="build-output" class="primary">${current?'Rebuild with AI':'Build with AI'}</button></div><div id="output-area" style="margin-top:14px"></div></div>`;$('#build-output').onclick=()=>buildArtifact(project);if(current)mountArtifact(project);else $('#output-area').innerHTML='<div class="placeholder">ProjectX will build the real output from the current specification. There is no fixed demo here.</div>';}
async function buildArtifact(project){
  if(!session&&!localGuestKey())return aiRequiredModal('Connect Gemini before ProjectX can build the real artifact.');
  const button=$('#build-output'),area=$('#output-area');
  button.disabled=true;
  area.innerHTML='<div class="sub">ProjectX is generating and validating the real artifact…</div>';
  try{
    const data=await aiJson('artifact',{project,message:'Generate the complete functional project artifact from the canonical spec. Return only files needed for this exact project.'},10000);
    const files={};
    for(const file of Array.isArray(data?.files)?data.files:[]){
      const path=sanitizePath(file.path);
      if(path&&typeof file.content==='string'&&file.content.length<=600000)files[path]=file.content;
    }
    if(!files['index.html']&&!files['src/index.html'])throw new Error('The AI did not return a valid index.html artifact.');

    const html=files['index.html']||files['src/index.html']||'';
    const structural=[
      {name:'Entry file exists',pass:Boolean(html),detail:html?'index.html exists.':'No index.html artifact exists.'},
      {name:'HTML structure',pass:/<html[\\s>]/i.test(html)&&/<body[\\s>]/i.test(html),detail:/<html[\\s>]/i.test(html)?'HTML document detected.':'Missing a complete HTML document.'},
      {name:'No obvious placeholder markers',pass:!(/\\b(TODO|FIXME|coming soon)\\b/i.test(Object.values(files).join('\\n'))),detail:/\\b(TODO|FIXME|coming soon)\\b/i.test(Object.values(files).join('\\n'))?'Placeholder marker found.':'No obvious placeholder marker found.'}
    ];
    if(!structural.every(x=>x.pass))throw new Error(structural.filter(x=>!x.pass).map(x=>x.detail).join(' '));
    const runtime=await browserRuntimeCheck(files);
    if(!runtime.pass)throw new Error(runtime.detail||'The generated artifact reported a browser runtime error.');

    snapshot(project,'Before rebuild');
    project.files=files;
    project.artifacts={...(project.artifacts||{}),output:{
      specVersion:project.specVersion,
      entry:data.entry||'index.html',
      summary:String(data.summary||''),
      tests:[...structural,runtime].slice(0,20),
      updatedAt:now()
    }};
    project.tests={status:'passed',specVersion:project.specVersion,results:[...structural,runtime],updatedAt:now()};
    project.status='built';
    saveProject(project);
    await syncRemoteProject(project);
    renderOutput(project);
    mountArtifact(project);
    notify('Real project output generated and runtime-checked from the current canonical spec.','success');
  }catch(error){
    area.innerHTML=`<div class="placeholder">Build failed: ${esc(error.message)}. Your previous artifact was kept.</div>`;
  }finally{button.disabled=false;}
}
function mountArtifact(project){const area=$('#output-area');if(!area)return;area.innerHTML='<div class="artifact"><iframe id="project-frame" sandbox="allow-scripts" title="Project output"></iframe></div>';const frame=$('#project-frame');frame.srcdoc=assemblePreviewHtml(project.files||{});runtimeTestCleanup?.();const onMessage=e=>{if(e.data?.type==='PROJECTX_RUNTIME_ERROR')notify(`Project runtime error: ${e.data.message}`,'error');};window.addEventListener('message',onMessage);runtimeTestCleanup=()=>window.removeEventListener('message',onMessage);}
function renderFiles(project){const paths=Object.keys(project.files||{}).sort(),first=paths[0]||null;const body=$('#project-body');body.innerHTML=`<div class="box"><div class="files"><div class="file-list">${paths.map((path,i)=>`<button class="${i===0?'active':''}" data-file="${esc(path)}">${esc(path)}</button>`).join('')||'<div class="sub">No generated files yet.</div>'}</div><div style="padding-left:14px"><div class="row"><b id="file-name">${esc(first||'No file selected')}</b>${first?'<button class="download" id="download-file">Download</button>':''}</div><pre id="file-code" class="code">${esc(first?project.files[first]:'Build the project to create real files.')}</pre></div></div></div>`;$$('[data-file]',body).forEach(button=>button.onclick=()=>{$$('[data-file]',body).forEach(x=>x.classList.remove('active'));button.classList.add('active');const path=button.dataset.file;$('#file-name').textContent=path;$('#file-code').textContent=project.files[path];});$('#download-file')?.addEventListener('click',()=>downloadText(first,project.files[first]));}
function downloadText(name,content,type='text/plain'){const url=URL.createObjectURL(new Blob([content],{type}));const a=document.createElement('a');a.href=url;a.download=name.split('/').pop();a.click();setTimeout(()=>URL.revokeObjectURL(url),500);}
async function renderTests(project){
  const body=$('#project-body');
  const saved=project.tests?.specVersion===project.specVersion&&Array.isArray(project.tests?.results)?project.tests.results:[];
  const drawResults=(results,status)=>{
    const passed=results.every(x=>x.pass);
    $('#test-results').innerHTML=`<div class="sub" style="margin-bottom:9px">Last run: ${status|| (passed?'passed':'failed')}.</div><div class="result-list">${results.map(result=>`<div class="result ${result.pass?'pass':'fail'}"><b>${result.pass?'PASS':'FAIL'} · ${esc(result.name)}</b><div class="sub">${esc(result.detail)}</div></div>`).join('')}</div>${passed?'':'<div class="actions" style="margin-top:12px"><button class="ghost" id="rebuild-from-tests">Rebuild with AI</button></div>'}`;
    $('#rebuild-from-tests')?.addEventListener('click',()=>{renderOutput(project);buildArtifact(project);});
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
async function runTests(project){const results=[],files=project.files||{},html=files['index.html']||files['src/index.html']||'';results.push({name:'Entry file exists',pass:Boolean(html),detail:html?'index.html exists.':'No index.html artifact exists.'});results.push({name:'HTML structure',pass:/<html[\s>]/i.test(html)&&/<body[\s>]/i.test(html),detail:/<html[\s>]/i.test(html)?'HTML document detected.':'Missing a complete HTML document.'});const hasPlaceholderMarker=/\b(TODO|FIXME|coming soon)\b/i.test(Object.values(files).join('\n'));
results.push({name:'No obvious placeholder markers',pass:!hasPlaceholderMarker,detail:hasPlaceholderMarker?'TODO/FIXME/coming-soon marker found.':'No obvious placeholder marker found.'});results.push(await browserRuntimeCheck(files));return results;}
function browserRuntimeCheck(files){return new Promise(resolve=>{const frame=document.createElement('iframe');frame.setAttribute('sandbox','allow-scripts');frame.style.cssText='position:fixed;left:-99999px;width:800px;height:600px;opacity:0';document.body.appendChild(frame);let settled=false;const finish=result=>{if(settled)return;settled=true;window.removeEventListener('message',onMessage);clearTimeout(timer);frame.remove();resolve(result);};const onMessage=e=>{if(e.source===frame.contentWindow&&e.data?.type==='PROJECTX_RUNTIME_ERROR')finish({name:'Browser runtime',pass:false,detail:e.data.message||'Runtime error reported by output.'});};window.addEventListener('message',onMessage);const timer=setTimeout(()=>finish({name:'Browser runtime',pass:true,detail:'No runtime error was reported during the validation window.'}),2200);frame.srcdoc=assemblePreviewHtml(files);});}
function renderDelivery(project){const body=$('#project-body');body.innerHTML=`<div class="box"><h2 style="margin:0">Delivery</h2><p class="sub">Package the current project without claiming an external deployment.</p><div class="grid"><div class="box"><b>Download output</b><div class="sub">Save the current playable/document artifact.</div><button class="download" id="download-output" style="margin-top:9px">Download</button></div><div class="box"><b>Export project</b><div class="sub">Save the canonical project brain and files.</div><button class="download" id="export-project" style="margin-top:9px">Export JSON</button></div><div class="box"><b>Deployment</b><div class="placeholder">Deployment integrations are intentionally inactive until a real account-level provider connection exists.</div></div></div></div>`;$('#download-output').onclick=()=>downloadText('projectx-output.html',assemblePreviewHtml(project.files||{}),'text/html');$('#export-project').onclick=()=>downloadText(`${project.title.replace(/[^a-z0-9]+/gi,'-').toLowerCase()||'project'}-project.json`,JSON.stringify(serializeForPersistence(project),null,2),'application/json');}
function projectsPage(){shell(`<div class="panel"><div class="kicker">PROJECTS</div><h1 class="hero-title" style="font-size:44px">Your projects</h1><p class="sub">One canonical project brain per creation.</p><div style="display:grid;gap:10px;margin-top:20px">${state.projects.map(p=>`<button class="box" data-open="${esc(p.id)}" style="text-align:left;cursor:pointer"><b>${esc(p.title)}</b><div class="sub">${esc(p.type)} · spec v${p.specVersion} · ${esc(p.status)}</div></button>`).join('')||'<div class="box">No projects yet.</div>'}</div></div>`,'projects');}
function analyticsPage(){shell(`<div class="panel"><div class="kicker">PROJECT X</div><h1 class="hero-title" style="font-size:44px">Analytics</h1><div class="grid"><div class="box"><b>Projects</b><div class="sub">${state.projects.length}</div></div><div class="box"><b>AI</b><div class="sub">${session?'Secure account connected':localGuestKey()?'Local session key configured':'Not connected'}</div></div><div class="box"><b>Outputs</b><div class="sub">${state.projects.filter(p=>p.artifacts?.output).length}</div></div></div></div>`,'analytics');}
async function assistantPage(){shell(`<div class="panel"><div class="kicker">PROJECT X</div><h1 class="hero-title" style="font-size:44px">Assistant X</h1><div class="box"><div id="assistant-log" class="conversation"></div><form id="assistant-form" class="form"><textarea id="assistant-input" placeholder="Ask a general ProjectX question..."></textarea><button class="primary">Send</button></form></div></div>`,'assistant');const messages=[{role:'assistant',text:'What do you need help with?'}];drawConversation(messages,'#assistant-log');$('#assistant-form').onsubmit=async e=>{e.preventDefault();const text=$('#assistant-input').value.trim();if(!text)return;messages.push({role:'user',text});drawConversation(messages,'#assistant-log');$('#assistant-input').value='';try{messages.push({role:'assistant',text:await aiText({message:text,history:messages,project:activeProject()||{},system:'You are Assistant X for ProjectX. Be concise and practical. Never claim actions you did not perform.'})});}catch(error){messages.push({role:'assistant',text:`AI unavailable: ${error.message}`});}drawConversation(messages,'#assistant-log');};}
const SETTINGS=[['general','General'],['ai','AI'],['agents','Agents'],['integrations','Integrations'],['defaults','Project Defaults'],['appearance','Appearance'],['notifications','Notifications'],['security','Security & Privacy'],['git','Git & Deployment'],['storage','Storage'],['billing','Billing & Usage'],['advanced','Advanced']];
function settingsPage(which='general'){shell(`<div class="panel"><div class="kicker">PROJECT X</div><h1 class="hero-title" style="font-size:44px">Settings</h1><div class="settings"><nav class="settings-nav">${SETTINGS.map(([id,name])=>`<button class="${id===which?'active':''}" data-setting="${id}">${name}</button>`).join('')}</nav><div id="settings-body"></div></div></div>`,'settings');$$('[data-setting]').forEach(button=>button.onclick=()=>settingsPage(button.dataset.setting));renderSettings(which);}
async function renderSettings(which){const body=$('#settings-body');if(!body)return;const p=settingsState;if(which==='general')body.innerHTML=`<h2>General</h2><p class="sub">Core ProjectX preferences.</p><div class="box"><div class="row"><div><b>Auto-save</b><div class="sub">Save successful project changes automatically.</div></div><button class="ghost" id="toggle-autosave">${p.autoSave?'On':'Off'}</button></div><div class="row"><div><b>Confirm destructive actions</b></div><button class="ghost" id="toggle-confirm">${p.confirmDelete?'On':'Off'}</button></div><div class="row"><b>Language</b><select class="select" id="language"><option>English</option></select></div><div class="row"><b>Timezone</b><input class="input" id="timezone" value="${esc(p.timezone)}"></div></div>`;
else if(which==='ai')return renderAiSettings(body);
else if(which==='agents')body.innerHTML=`<h2>Agents</h2><p class="sub">Every enabled role uses the same canonical project brain.</p><div class="box">${Object.entries(p.agents).map(([id,on])=>`<div class="row"><div><b>${esc(id)}</b><div class="sub">${esc({interviewer:'Discovery and ambiguity reduction.',planner:'Plans from the project brain.',builder:'Creates real files and outputs.',tester:'Validates current artifacts.',researcher:'Structures evidence when research is relevant.'}[id]||'Project role.')}</div></div><button class="ghost" data-agent="${id}">${on?'Enabled':'Disabled'}</button></div>`).join('')}</div>`;
else if(which==='integrations')body.innerHTML=`<h2>Integrations</h2><div class="box"><div class="row"><div><b>Supabase</b><div class="sub">${ensureSupabase()?'Configured':'Not configured'}</div></div><span class="status ${ensureSupabase()?'ok':'warn'}">${ensureSupabase()?'READY':'PLACEHOLDER'}</span></div><div class="row"><div><b>GitHub</b><div class="sub">Repository automation requires OAuth integration.</div></div><span class="status warn">PLACEHOLDER</span></div></div>`;
else if(which==='defaults')body.innerHTML=`<h2>Project Defaults</h2><div class="box"><div class="row"><b>Default model</b><select class="select" id="default-model">${MODELS.map(m=>`<option ${p.model===m?'selected':''}>${m}</option>`).join('')}</select></div><div class="row"><b>Response style</b><select class="select" id="response-style"><option ${p.responseStyle==='concise'?'selected':''}>concise</option><option ${p.responseStyle==='balanced'?'selected':''}>balanced</option><option ${p.responseStyle==='detailed'?'selected':''}>detailed</option></select></div></div>`;
else if(which==='appearance')body.innerHTML=`<h2>Appearance</h2><div class="box"><div class="row"><b>Theme</b><span class="sub">Light workspace is currently implemented.</span></div><div class="placeholder">Dark/system styling remains a placeholder and is not falsely marked active.</div></div>`;
else if(which==='notifications')body.innerHTML=`<h2>Notifications</h2><div class="box">${Object.entries(p.notifications).map(([id,on])=>`<div class="row"><b>${esc(id)}</b><button class="ghost" data-notification="${id}">${on?'On':'Off'}</button></div>`).join('')}</div>`;
else if(which==='security')body.innerHTML=`<h2>Security & Privacy</h2><div class="box"><div class="row"><div><b>AI credential storage</b><div class="sub">${session?'Server-side encrypted vault':'Local browser session'}</div></div><span class="status ${session?'ok':'warn'}">${session?'SECURE':'LOCAL'}</span></div><div class="row"><div><b>Account</b><div class="sub">${session?esc(session.user?.email||'Signed in'):'Not signed in'}</div></div>${session?'<button class="ghost" id="security-signout">Sign out</button>':'<button class="ghost" id="security-signin">Sign in</button>'}</div><div class="placeholder">Client-side guest mode never syncs credentials to ProjectX. Sign in to use the encrypted server-side vault.</div></div>`;
else if(which==='git')body.innerHTML=`<h2>Git & Deployment</h2><div class="box"><div class="placeholder">GitHub OAuth, repository automation, branch creation, and deployment are placeholders until their real account-level integrations are configured.</div></div>`;
else if(which==='storage')body.innerHTML=`<h2>Storage</h2><div class="box"><div class="row"><b>Projects</b><span class="sub">${state.projects.length}</span></div><div class="row"><b>Generated files</b><span class="sub">${state.projects.reduce((count,project)=>count+Object.keys(project.files||{}).length,0)}</span></div></div>`;
else if(which==='billing')body.innerHTML=`<h2>Billing & Usage</h2><div class="box"><div class="row"><b>Plan</b><span class="sub">Free prototype</span></div><div class="placeholder">Billing, credits, invoices, and payment controls stay inactive until the payment provider is connected.</div></div>`;
else body.innerHTML=`<h2>Advanced</h2><div class="box"><button class="ghost" id="export-state">Export local state</button><button class="ghost" id="clear-state" style="margin-left:7px">Clear local cache</button><div class="placeholder" style="margin-top:12px">Experimental options are intentionally inactive until implemented.</div></div>`;bindSettings(which);}
async function renderAiSettings(body){let server=[];if(session){try{server=(await edge('listCredentials')).providers||[]}catch{}}const guest=Boolean(localGuestKey());body.innerHTML=`<h2>AI</h2><p class="sub">Configure the provider used for discovery, project Chat, section generation, and artifact building.</p><div class="box"><div class="row"><div><b>Google Gemini</b><div class="sub">${session?'Secure account vault':guest?`Local session ${guestStatus()?.hint||''}`:'Not connected'}</div></div><span class="status ${session||guest?'ok':'bad'}">${session||guest?'CONNECTED':'NOT CONNECTED'}</span></div><div class="row"><input id="gemini-key" class="input full" type="password" placeholder="Paste Gemini API key"><button id="save-gemini" class="primary">${server.length?'Replace key':'Save key'}</button></div><div class="sub">${session?'The key is encrypted server-side and is never returned to the browser.':guest?'Guest mode keeps the key for this browser session only. Sign in for encrypted server-side storage.':'No key configured.'}</div><div class="row"><b>Default model</b><select id="ai-model" class="select">${MODELS.map(m=>`<option ${settingsState.model===m?'selected':''}>${m}</option>`).join('')}</select></div><div class="actions"><button class="ghost" id="test-gemini">Test connection</button><button class="ghost" id="account-ai">${session?'Sign out':'Use secure account storage'}</button></div><div id="ai-test" class="sub" style="margin-top:8px"></div></div><div class="box" style="margin-top:10px"><b>Other providers</b><div class="placeholder" style="margin-top:8px">OpenAI, Anthropic, OpenRouter, NVIDIA, and OpenAI-compatible providers are reserved as real integration slots. ProjectX will only show them as connected when a server-side adapter is configured.</div></div>`;$('#save-gemini').onclick=async()=>{const key=$('#gemini-key').value.trim();if(!key)return notify('Paste a Gemini API key first.','error');try{if(session){await edge('testCredential',{provider:'google',apiKey:key});await edge('saveCredential',{provider:'google',apiKey:key,label:'ProjectX Gemini'});}else{setGuestKey(key);setGuestStatus(key);}settingsPage('ai');notify(session?'Gemini key saved securely.':'Gemini key saved for this browser session.','success');}catch(error){notify(`Could not save the key: ${error.message}`,'error');}};$('#test-gemini').onclick=async()=>{const status=$('#ai-test');status.textContent='Testing…';try{if(session){const key=$('#gemini-key').value.trim();if(key)await edge('testCredential',{provider:'google',apiKey:key});else await edge('listCredentials');}else{if(!localGuestKey())throw new Error('No Gemini key is configured.');await directGemini([{role:'user',text:'Reply with exactly OK.'}],'Reply only with OK.',false,5);}status.textContent='Connected and responding.';status.className='sub ok';}catch(error){status.textContent=error.message;status.className='sub bad';}};$('#account-ai').onclick=()=>session?signOut().then(()=>settingsPage('ai')):authModal();}
function bindSettings(which){$('#toggle-autosave')?.addEventListener('click',()=>{settingsState.autoSave=!settingsState.autoSave;persistSettings();renderSettings(which)});$('#toggle-confirm')?.addEventListener('click',()=>{settingsState.confirmDelete=!settingsState.confirmDelete;persistSettings();renderSettings(which)});$('#language')?.addEventListener('change',e=>{settingsState.language=e.target.value;persistSettings()});$('#timezone')?.addEventListener('change',e=>{settingsState.timezone=e.target.value;persistSettings()});$('#default-model')?.addEventListener('change',e=>{settingsState.model=e.target.value;persistSettings()});$('#ai-model')?.addEventListener('change',e=>{settingsState.model=e.target.value;persistSettings()});$$('[data-agent]').forEach(button=>button.onclick=()=>{const id=button.dataset.agent;settingsState.agents[id]=!settingsState.agents[id];persistSettings();renderSettings('agents')});$$('[data-notification]').forEach(button=>button.onclick=()=>{const id=button.dataset.notification;settingsState.notifications[id]=!settingsState.notifications[id];persistSettings();renderSettings('notifications')});$('#security-signin')?.addEventListener('click',authModal);$('#security-signout')?.addEventListener('click',()=>signOut().then(()=>settingsPage('security')));$('#export-state')?.addEventListener('click',()=>downloadText('projectx-state.json',JSON.stringify(state,null,2),'application/json'));$('#clear-state')?.addEventListener('click',()=>{if(settingsState.confirmDelete&&!confirm('Clear local project cache? Cloud projects remain in your account.'))return;state={version:6,projects:[],active:null};persistLocal();home();});}
function authModal(){closeModal();const modal=document.createElement('div');modal.className='modal-bg';modal.innerHTML=`<div class="modal"><div class="kicker">PROJECT X ACCOUNT</div><h2>Use secure project storage</h2><p class="sub">Sign in to sync projects and store AI credentials in the encrypted server-side vault.</p><div style="display:flex;gap:7px;margin:12px 0"><button class="ghost" id="auth-signin-mode">Sign in</button><button class="ghost" id="auth-signup-mode">Create account</button></div><input id="auth-email" class="input full" type="email" placeholder="Email"><input id="auth-password" class="input full" type="password" placeholder="Password" style="margin-top:7px"><div id="auth-status" class="sub" style="margin-top:8px"></div><div class="actions"><button class="ghost" id="auth-cancel">Cancel</button><button class="primary" id="auth-submit">Continue</button></div></div>`;document.body.appendChild(modal);currentModal=modal;let mode='signin';const setMode=m=>{mode=m;$('#auth-signin-mode').classList.toggle('active',m==='signin');$('#auth-signup-mode').classList.toggle('active',m==='signup');};$('#auth-signin-mode').onclick=()=>setMode('signin');$('#auth-signup-mode').onclick=()=>setMode('signup');$('#auth-cancel').onclick=closeModal;$('#auth-submit').onclick=async()=>{const email=$('#auth-email').value.trim(),password=$('#auth-password').value;if(!email||password.length<6){$('#auth-status').textContent='Enter an email and a password with at least 6 characters.';return;}const button=$('#auth-submit');button.disabled=true;try{await authAction(mode,email,password);closeModal();await syncRemoteProjects();settingsPage('ai');notify('Secure account connected.','success');}catch(error){$('#auth-status').textContent=error.message;}finally{button.disabled=false;}};}
function closeModal(){currentModal?.remove();currentModal=null;}
function aiRequiredModal(message){closeModal();const modal=document.createElement('div');modal.className='modal-bg';modal.innerHTML=`<div class="modal"><div class="kicker">AI CONNECTION REQUIRED</div><h2>Connect your AI</h2><p class="sub">${esc(message)}</p><div class="actions"><button class="ghost" id="ai-close">Cancel</button><button class="primary" id="ai-settings">Open Settings</button></div></div>`;document.body.appendChild(modal);currentModal=modal;$('#ai-close').onclick=closeModal;$('#ai-settings').onclick=()=>{closeModal();settingsPage('ai');};}
function navigate(route){if(route==='home')home();else if(route==='projects')projectsPage();else if(route==='analytics')analyticsPage();else if(route==='assistant')assistantPage();else if(route==='settings')settingsPage('general');}
window.addEventListener('beforeunload',()=>runtimeTestCleanup?.());
async function boot(){installCss();await refreshSession();if(!state.projects.length){const legacy=read('px_adaptive_v1',null)||read('builder_universal_v14',null);if(legacy?.projects?.length){state.projects=legacy.projects.map(migrateProject);persistLocal();}}await syncRemoteProjects();home();}
window.ProjectX={state:()=>state,settings:()=>settingsState,openProject,refresh:boot};
boot();
