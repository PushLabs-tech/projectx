import {
  createProject,
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
  model: MODELS[0], responseStyle: 'balanced', executionMode: 'Mostly Automatic', autoSave: true, confirmDelete: true,
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

function effectiveMaxTokens(max){
  const mode=String(settingsState.executionMode||'Mostly Automatic');
  if(mode==='Fast')return Math.min(max,2200);
  if(mode==='Powerful')return Math.min(Math.max(max,4200),12000);
  return max;
}
async function aiJson(mode, payload, max = 3500) {
  max=effectiveMaxTokens(max);
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
const CSS = `#px-app{position:fixed;inset:0;z-index:2147483000;background:#fff;color:#171a1f;font:14px system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;overflow:hidden}#px-app *{box-sizing:border-box}#px-app button,#px-app input,#px-app textarea,#px-app select{font:inherit}#px-app button:focus-visible,#px-app input:focus-visible,#px-app textarea:focus-visible,#px-app select:focus-visible{outline:2px solid #2674ff;outline-offset:2px}#px-app button:disabled{opacity:.55;cursor:not-allowed}@media (prefers-reduced-motion: reduce){#px-app *,#px-app *::before,#px-app *::after{scroll-behavior:auto!important;transition:none!important;animation:none!important}}#px-app .side{position:fixed;inset:0 auto 0 0;width:240px;background:#fafbfc;border-right:1px solid #e5e8eb;padding:24px 14px;display:flex;flex-direction:column;overflow:auto}.logo{font-size:21px;font-weight:800;letter-spacing:-.04em;padding:0 10px 24px}.new,.primary{border:0;border-radius:8px;background:#171a1f;color:#fff;cursor:pointer}.new{height:38px;font-size:12px;font-weight:700}.nav{display:grid;gap:2px;margin-top:12px}.nav button,.recent button,.assist-btn{border:1px solid transparent;background:transparent;color:#68717d;text-align:left;padding:9px 10px;border-radius:8px;font-size:11px;cursor:pointer}.nav button.active,.nav button:hover,.recent button:hover,.assist-btn:hover{background:#eef0f3;color:#171a1f}.label{font-size:9px;letter-spacing:.15em;text-transform:uppercase;color:#9aa2ad;padding:0 10px 8px}.divider{height:1px;background:#e5e8eb;margin:18px 7px}.acct{margin-top:auto;border:1px solid #dde1e5;border-radius:10px;background:#fff;padding:9px;font-size:11px}.main{margin-left:240px;height:100%;overflow:auto}.top{height:58px;border-bottom:1px solid #eceef1;display:flex;justify-content:flex-end;align-items:center;gap:7px;padding:0 28px}.top button,.ghost,.download{border:1px solid #dfe3e7;background:#fff;color:#505966;border-radius:7px;padding:8px 11px;font-size:11px;cursor:pointer}.wrap,.interview,.panel,.project{width:min(1080px,calc(100% - 48px));margin:auto;padding:48px 0}.center{text-align:center}.kicker{font-size:9px;letter-spacing:.16em;text-transform:uppercase;color:#a0a7b0}.hero-title,.project-title{font-size:clamp(38px,5vw,60px);line-height:1.02;letter-spacing:-.06em;margin:12px 0}.sub{color:#78818d;line-height:1.55;font-size:13px}.composer{border:1px solid #d7dce2;border-radius:12px;max-width:900px;margin:26px auto 0;overflow:hidden}.composer textarea{width:100%;min-height:140px;border:0;outline:0;resize:vertical;padding:18px}.composer-foot{border-top:1px solid #edf0f2;display:flex;justify-content:space-between;align-items:center;padding:7px}.send{width:39px;height:39px;border:0;border-radius:8px;background:#171a1f;color:#fff;cursor:pointer}.send:disabled,.primary:disabled{opacity:.45;cursor:wait}.chips{display:flex;gap:7px;flex-wrap:wrap;justify-content:center;margin:16px 0}.chip{border:1px solid #dfe3e7;background:#fff;border-radius:999px;padding:7px 10px;font-size:10px;color:#68717d;cursor:pointer}.conversation{display:grid;gap:9px;max-height:58vh;overflow:auto;margin:20px 0}.msg{max-width:84%;padding:11px 14px;border-radius:13px;white-space:pre-wrap;font-size:13px;line-height:1.5}.msg.ai{background:#f3f4f5}.msg.user{background:#171a1f;color:#fff;justify-self:end}.form{display:flex;gap:7px;border:1px solid #d7dce2;border-radius:12px;padding:7px}.form textarea{flex:1;min-height:45px;border:0;outline:0;resize:none;padding:9px}.form button{border:0;border-radius:8px;background:#171a1f;color:#fff;padding:0 16px;cursor:pointer}.project-context{display:flex;gap:9px;align-items:center;flex-wrap:wrap;margin:8px 0 4px;color:#6f7884;font-size:11px}.project-tools{display:flex;gap:6px;overflow:auto;padding:10px 0 6px}.tool-btn{border:1px solid #e1e5e9;background:#fff;border-radius:999px;padding:6px 9px;color:#66707c;font-size:10px;white-space:nowrap;cursor:pointer}.tool-btn:hover,.tool-btn:focus{border-color:#aeb6bf;color:#171a1f}.brain-group{padding:12px 0;border-top:1px solid #edf0f2}.brain-group:first-child{border-top:0;padding-top:0}.brain-row{padding:7px 0;color:#3e4650;font-size:12px;line-height:1.45}.preview-toolbar{display:flex;gap:6px;justify-content:center;margin-bottom:9px}.code-editor{width:100%;min-height:560px;margin-top:10px;border:1px solid #e1e5e9;border-radius:8px;padding:12px;background:#fbfcfd;color:#252a30;font:12px/1.5 ui-monospace,SFMono-Regular,Consolas,monospace;resize:vertical;box-sizing:border-box}.preview-toolbar .ghost.active{background:#171a1f;color:#fff}.artifact{display:flex;justify-content:center;border:1px solid #e1e5e9;border-radius:10px;background:#f6f7f8;overflow:auto;padding:12px}.artifact iframe{border:0;background:#fff;min-height:620px;box-shadow:0 1px 3px rgba(0,0,0,.08);transition:width .2s ease}.preview-desktop iframe{width:100%}.preview-tablet iframe{width:768px;max-width:100%}.preview-mobile iframe{width:390px;max-width:100%}.architecture-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}.architecture-node{border:1px solid #e5e8eb;border-radius:10px;padding:12px;background:#fbfcfd}.simulation-score{font-size:24px;letter-spacing:-.03em;margin-bottom:14px}.version-row{display:flex;justify-content:space-between;align-items:center;gap:10px;padding:11px 0;border-top:1px solid #edf0f2}.version-row:first-child{border-top:0}.project-context+.project-tools{margin-top:2px}.project-tools+.sections{margin-top:4px}.context-group{font-size:9px;letter-spacing:.12em;font-weight:800;color:#171a1f}.project-context+.sections{margin-top:10px}.sections{display:flex;overflow:auto;border-bottom:1px solid #e6e9ec;justify-content:center}.tab{border:0;background:transparent;padding:12px 13px;color:#7b8490;font-size:11px;font-weight:700;white-space:nowrap;border-bottom:2px solid transparent;cursor:pointer}.tab.active{color:#171a1f;border-bottom-color:#171a1f}.body{padding-top:24px}.box{border:1px solid #e1e5e9;border-radius:11px;background:#fff;padding:16px}.grid{display:grid;grid-template-columns:repeat(3,1fr);gap:10px}.section-block{padding:11px 12px;margin:10px 0;border:1px solid #edf0f2;border-radius:9px;background:#fbfcfd}.document-output{border:1px solid #e1e5e9;border-radius:10px;background:#fbfcfd;overflow:auto;max-height:650px}.document-text{margin:0;padding:18px;white-space:pre-wrap;font:13px/1.65 ui-monospace,SFMono-Regular,Consolas,monospace;color:#252a30}.section-block b{font-size:12px}.section-block p{margin:4px 0 0;color:#6f7884;font-size:12px;line-height:1.5}.item{border-top:1px solid #edf0f2;padding:12px 0}.item:first-child{border-top:0}.item b{font-size:12px}.item p{margin:4px 0;color:#6f7884;font-size:12px;line-height:1.5}.files{display:grid;grid-template-columns:220px 1fr;min-height:470px}.file-list{border-right:1px solid #e7eaed;padding-right:10px;overflow:auto}.file-list button{width:100%;border:0;background:transparent;text-align:left;padding:8px;border-radius:6px;font-size:11px;color:#65707c;cursor:pointer}.file-list button.active,.file-list button:hover{background:#f0f2f4;color:#171a1f}.code{margin:0;background:#f7f8f9;border-radius:8px;padding:14px;white-space:pre-wrap;overflow:auto;max-height:560px;font:11px/1.55 ui-monospace,SFMono-Regular,Consolas,monospace}.artifact iframe{width:100%;height:620px;border:1px solid #dfe3e7;border-radius:9px;background:#fff}.result-list{display:grid;gap:8px}.result{border:1px solid #e1e5e9;border-radius:9px;padding:11px}.result.pass{border-color:#cde8d5}.result.fail{border-color:#efcaca}.settings{display:grid;grid-template-columns:190px 1fr;gap:25px}.settings-nav{display:grid;align-content:start;gap:2px;border-right:1px solid #e5e8eb;padding-right:12px}.settings-nav button{border:0;background:transparent;text-align:left;padding:9px 10px;border-radius:7px;color:#68717d;font-size:11px;cursor:pointer}.settings-nav button.active,.settings-nav button:hover{background:#eef0f3;color:#171a1f}.input,.select{height:35px;border:1px solid #d9dee3;border-radius:7px;padding:0 9px;outline:0;background:#fff;font-size:11px}.input.full{width:100%}.row{display:flex;justify-content:space-between;gap:12px;align-items:center;padding:11px 0}.row+.row{border-top:1px solid #edf0f2}.status{font-size:10px;font-weight:700}.ok{color:#287a45}.bad{color:#a33a3a}.warn{color:#8f6b11}.placeholder{border:1px dashed #d9dee3;border-radius:8px;padding:12px;color:#8a939d;font-size:11px;line-height:1.5}.modal-bg{position:fixed;inset:0;z-index:2147483600;background:rgba(15,19,24,.34);display:grid;place-items:center;padding:20px}.modal{width:min(540px,100%);background:#fff;border-radius:14px;padding:22px;box-shadow:0 18px 70px rgba(0,0,0,.18)}.modal h2{margin:0 0 7px;font-size:22px;letter-spacing:-.04em}.actions{display:flex;justify-content:flex-end;gap:7px;margin-top:17px}.actions button{height:35px;padding:0 11px;border-radius:7px;border:1px solid #d9dee3;background:#fff;cursor:pointer;font-size:10px}.actions .primary{background:#171a1f;color:#fff;border-color:#171a1f}.understanding{max-width:900px;margin:18px auto 0}.understanding-main{display:flex;gap:12px;align-items:flex-start;border:1px solid #dfe3e7;border-radius:11px;padding:13px 14px;background:#fbfcfd}.understanding-group{font-size:10px;letter-spacing:.12em;font-weight:800;white-space:nowrap}.understanding-copy{min-width:0}.understanding-copy b{font-size:12px}.understanding-category{display:inline-block;margin-top:7px;font-size:10px;color:#6f7884}.understanding-known{display:flex;gap:6px;flex-wrap:wrap;margin-top:8px}.understanding-known span{font-size:10px;color:#4f5863;background:#f4f6f8;border:1px solid #e3e6e9;border-radius:999px;padding:4px 7px}.understanding-meta{display:flex;gap:10px;flex-wrap:wrap;margin-top:7px;font-size:10px;color:#6f7884}.notice{position:fixed;left:50%;bottom:20px;transform:translateX(-50%);z-index:2147483700;background:#171a1f;color:#fff;padding:10px 14px;border-radius:10px;font-size:12px;max-width:calc(100vw - 28px);box-shadow:0 10px 30px rgba(0,0,0,.14)}.notice.error{background:#8e2d2d}.notice.success{background:#1f6d3c}.analytics-banner{position:fixed;left:18px;right:18px;bottom:18px;z-index:2147483690;display:flex;justify-content:space-between;gap:15px;align-items:center;border:1px solid #d7dce2;border-radius:12px;background:#fff;padding:12px 14px;box-shadow:0 10px 30px rgba(0,0,0,.1)}@media(max-width:720px){.analytics-banner{align-items:flex-start;flex-direction:column}}@media(max-width:820px){#px-app .side{inset:0 0 auto;width:auto;height:58px;flex-direction:row;align-items:center;padding:7px 10px;overflow:hidden}.logo{padding:0 8px;font-size:19px}.new{height:34px;padding:0 10px;margin-right:7px}.nav{display:flex;flex:1;justify-content:center;margin:0}.nav span,.divider,.label,.assist-btn,.recent{display:none}.acct{margin:0}.main{margin-left:0;padding-top:58px}.top{height:50px;padding:0 12px}.wrap,.interview,.panel,.project{width:calc(100% - 28px);padding:38px 0}.grid{grid-template-columns:1fr}.settings{grid-template-columns:1fr}.settings-nav{display:flex;overflow:auto;border-right:0;border-bottom:1px solid #e5e8eb;padding-bottom:8px}.files{grid-template-columns:1fr}.file-list{border-right:0;border-bottom:1px solid #e7eaed;padding-right:0;padding-bottom:8px}.sections{justify-content:flex-start}.msg{max-width:92%}}
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
  const project=data?.project||{};
  const known=[
    project.goal&&`Goal: ${project.goal}`,
    Array.isArray(project.users)&&project.users.length&&`Users: ${project.users.slice(0,3).join(', ')}`,
    Array.isArray(project.requirements)&&project.requirements.length&&`Requirements: ${project.requirements.slice(0,2).join('; ')}`,
    Array.isArray(project.deliverables)&&project.deliverables.length&&`Deliverable: ${project.deliverables.slice(0,2).join('; ')}`
  ].filter(Boolean).slice(0,4);
  root.innerHTML=`<div class="understanding-main"><div class="understanding-group">${label}</div><div class="understanding-copy"><b>What ProjectX understands</b><div class="sub">${esc(summary||reason||'Classification established from your request.')}</div>${category?`<div class="understanding-category">Category · ${esc(category)}</div>`:''}${known.length?`<div class="understanding-known">${known.map(x=>`<span>${esc(x)}</span>`).join('')}</div>`:''}${missing.length?`<div class="understanding-meta"><span>Still needed · ${esc(missing.join(', '))}</span></div>`:''}</div></div>`;
}
const interviewSystem = "You are ProjectX's discovery architect. The user's original request is the source of truth. Follow this order exactly: (1) classify the request as REAL_WORLD or NON_REAL_WORLD before deciding any lower-level category; (2) visibly explain the classification in the returned data; (3) infer the most useful AI-derived category only after that classification; (4) ask exactly one high-value question at a time, specific to what the user already said; (5) continue until the intent, target users, concrete requirements, constraints, desired deliverables, relevant platform/domain details, and important ambiguities are understood. REAL_WORLD means an actual real-world objective, activity, organization, plan, decision, business, event, research effort, or problem. NON_REAL_WORLD means a fictional, digital, creative, software, simulated, or virtual creation. Do not force a lower category from a fixed list. Return JSON only: {\"done\":boolean,\"question\":string,\"confidence\":number,\"missing\":string[],\"ambiguities\":string[],\"classification\":{\"group\":\"REAL_WORLD|NON_REAL_WORLD\",\"label\":string,\"reason\":string},\"category\":string,\"project\":{\"title\":string,\"type\":\"Game|Website|App|Mobile|Business|Business system|Research|Document|Presentation|Data|Dashboard|Internal tool|Agent|Automation|API|Creative project|Other\",\"goal\":string,\"users\":string[],\"requirements\":string[],\"constraints\":string[],\"features\":string[],\"decisions\":string[],\"dependencies\":string[],\"assets\":string[],\"deliverables\":string[],\"acceptanceCriteria\":string[],\"successCriteria\":string[],\"openQuestions\":string[],\"platform\":string,\"technology\":string[],\"visualDirection\":string,\"game\":{\"kind\":string,\"player\":string,\"controls\":string,\"loop\":string,\"theme\":string,\"progression\":string,\"multiplayer\":boolean}},\"workspace\":{\"sections\":[{\"name\":string,\"purpose\":string,\"dependsOn\":string[],\"kind\":\"workspace|output|research|planning|code|test|publish\",\"agent\":string,\"capabilities\":string[]}]},\"agents\":[{\"key\":string,\"name\":string,\"purpose\":string,\"tools\":string[]}],\"summary\":string}. The classification must be present on every response. When done, workspace.sections must contain 2-8 genuinely relevant sections derived from this specific project. Never use generic fallback section sets. Do not add Code, Files, Preview, Playtest, Research, or Business sections unless the user's project actually requires that work. Chat is added by the runtime. Never invent facts.";
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
    const project=createProject({title:mergedProject.title||data.project.title,type,intent:mergedProject.goal||history[0].text,spec,sections:workspace,conversation:history,agents:Array.isArray(data.agents)?data.agents:[]});
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
function snapshot(project,label){project.versions=Array.isArray(project.versions)?project.versions:[];project.versions.push({version:project.specVersion,label,at:now(),title:project.title,type:project.type,understanding:JSON.parse(JSON.stringify(project.understanding||{})),sections:JSON.parse(JSON.stringify(project.sections||[])),spec:JSON.parse(JSON.stringify(project.spec)),files:JSON.parse(JSON.stringify(project.files||{})),artifacts:JSON.parse(JSON.stringify(project.artifacts||{})),research:JSON.parse(JSON.stringify(project.research||{}))});if(project.versions.length>20)project.versions.splice(0,project.versions.length-20);}
async function syncRemoteProjects(){await refreshSession();if(!session)return;try{const result=await edge('listProjects');for(const remoteRaw of result.projects||[]){const remote=migrateProject(remoteRaw);const local=state.projects.find(p=>p.id===remote.id);if(!local||new Date(remote.updatedAt)>new Date(local.updatedAt||0)){const i=state.projects.findIndex(p=>p.id===remote.id);if(i>=0)state.projects[i]=remote;else state.projects.push(remote);}}persistLocal();}catch(e){notify(`Cloud sync unavailable: ${e.message}`,'error');}}
async function syncRemoteProject(project){if(!session||!settingsState.autoSave)return;try{const result=await edge('persistProject',{project:serializeForPersistence(project)});project.sync={remoteId:result.projectId||project.id,mode:'cloud',lastSyncedAt:now(),baseUpdatedAt:result.updatedAt||now()};persistLocal();}catch(e){project.sync={remoteId:project.sync?.remoteId||project.id,mode:'local',lastSyncedAt:project.sync?.lastSyncedAt||null,baseUpdatedAt:project.sync?.baseUpdatedAt||null,error:e.message};persistLocal();}}
async function openProject(id){const project=state.projects.find(p=>p.id===id);if(!project)return;state.active=id;persistLocal();renderProject(project);if(session){try{const result=await edge('getProject',{projectId:id});if(result.project){const remote=migrateProject(result.project);const i=state.projects.findIndex(p=>p.id===id);if(i>=0)state.projects[i]=remote;else state.projects.push(remote);state.active=id;persistLocal();renderProject(remote);}}catch{}}}
function renderProject(project){
  const group=project.understanding?.group;const groupLabel=group==='REAL_WORLD'?'REAL-WORLD':group==='NON_REAL_WORLD'?'NON-REAL-WORLD':'PROJECT';
  const category=project.category||project.understanding?.category||project.type||'PROJECT';const summary=String(project.understanding?.summary||project.intent||'').trim();
  const tools=[['brain','Brain'],['architecture','Architecture'],['simulation','Outcome'],['improve','Make it Great'],['optimize','Optimize'],['transform','Transform'],['versions','Versions'],['resources','Resources'],['security','Security'],['delivery','Delivery']];
  shell('<div class="project"><div class="kicker">'+groupLabel+' · '+esc(category)+'</div><h1 class="project-title">'+esc(project.title)+'</h1><div class="project-context"><span class="context-group">'+groupLabel+'</span><span>'+esc(summary||'ProjectX is working from the current project brain.')+'</span></div><div class="project-tools">'+tools.map(t=>'<button class="tool-btn" data-project-tool="'+esc(t[0])+'">'+esc(t[1])+'</button>').join('')+'</div><div class="sections">'+project.sections.map(s=>'<button class="tab '+(project.selectedSection===s.id?'active':'')+'" data-section="'+esc(s.id)+'">'+esc(s.name)+'</button>').join('')+'</div><div id="project-body" class="body"></div></div>','projects');
  $$('.tab',$('#px-app')).forEach(button=>button.onclick=()=>{project.selectedSection=button.dataset.section;saveProject(project);renderProject(project)});
  $$('[data-project-tool]',$('#px-app')).forEach(button=>button.onclick=()=>renderProjectTool(project,button.dataset.projectTool));
  renderSection(project,project.sections.find(s=>s.id===project.selectedSection)||project.sections[0]);
}
async function renderProjectTool(project,tool){
  const map={brain:renderBrain,architecture:renderArchitecture,simulation:renderSimulation,improve:renderMakeGreat,optimize:renderOptimize,transform:renderTransform,versions:renderVersions,resources:renderResources,security:renderProjectSecurity,delivery:renderDelivery};
  return (map[tool]||renderBrain)(project);
}
function toolShell(kicker,title,description,body){
  const root=$('#project-body');if(!root)return;
  root.innerHTML='<div class="box"><div class="kicker">'+esc(kicker)+'</div><h2 style="margin:4px 0 6px">'+esc(title)+'</h2><div class="sub">'+esc(description)+'</div><div style="margin-top:16px">'+body+'</div></div>';
}
function brainList(title,items){
  const values=(items||[]).filter(Boolean);
  return '<div class="brain-group"><b>'+esc(title)+'</b>'+(values.length?values.map(x=>'<div class="brain-row">'+esc(x)+'</div>').join(''):'<div class="sub">Nothing recorded yet.</div>')+'</div>';
}
function renderBrain(project){
  const u=project.understanding||{},s=project.spec||{};
  const rows=[
    u.group?'Classification: '+(u.group==='REAL_WORLD'?'REAL-WORLD':'NON-REAL-WORLD'):'',
    u.category?'Category: '+u.category:'',
    u.summary?'Summary: '+u.summary:'',
    Number(u.confidence)?'Confidence: '+Math.round(Number(u.confidence)*100)+'%':''
  ];
  const html=brainList('Understanding',rows)+brainList('Requirements',s.requirements)+brainList('Constraints',s.constraints)+brainList('Decisions',s.decisions)+brainList('Deliverables',s.deliverables)+brainList('Success criteria',s.successCriteria)+brainList('Dependencies',s.dependencies)+brainList('Known resources',s.resources)+
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
function renderSimulation(project){
  const checks=simulationState(project),passed=checks.filter(x=>x.pass).length;
  toolShell('OUTCOME SIMULATION','Outcome readiness','A deterministic readiness simulation based on the current project state — not a promise about real-world results.','<div class="simulation-score"><b>'+passed+'/'+checks.length+' checks ready</b></div><div class="result-list">'+checks.map(x=>'<div class="result '+(x.pass?'pass':'fail')+'"><b>'+ (x.pass?'READY':'NOT READY')+' · '+esc(x.name)+'</b><div class="sub">'+esc(x.detail)+'</div></div>').join('')+'</div>');
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
  const targets=[['Website','Website'],['App','Web app'],['API','API'],['Agent','AI agent'],['Automation','Automation'],['Business','Business system'],['Research','Research project'],['Other','Custom creation']];
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
  toolShell('VERSIONS','Project history','Restore an earlier project state while preserving the current state as a new version.',versions.length?versions.map((v,i)=>'<div class="version-row"><div><b>v'+esc(v.version||'?')+' · '+esc(v.label||'Snapshot')+'</b><div class="sub">'+esc(v.at||'')+'</div></div><div class="actions"><button class="ghost" data-compare="'+i+'">Compare</button><button class="ghost" data-restore="'+i+'">Restore</button></div></div>').join(''):'<div class="placeholder">No snapshots yet.</div>');
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
function renderProjectSecurity(project){
  const files=project.files||{},text=Object.entries(files).map(([p,v])=>'FILE '+p+'\n'+v).join('\n');
  const checks=[
    {name:'No shell execution APIs',pass:!(/(?:child_process|Deno\.Command|Bun\.spawn|process\.exec\()/i.test(text)),detail:'Generated project files are scanned for direct command execution APIs.'},
    {name:'No eval constructors',pass:!(/\b(?:eval|new Function)\s*\(/i.test(text)),detail:'Generated files are scanned for eval/new Function.'},
    {name:'No javascript URLs',pass:!(/javascript\s*:/i.test(text)),detail:'Generated files are scanned for javascript: URLs.'},
    {name:'Safe relative file paths',pass:Object.keys(files).every(p=>sanitizePath(p)===p),detail:'Generated file paths stay within the project file namespace.'}
  ];
  toolShell('SECURITY','Project security checks','Fast local checks on generated files. This does not replace a full security review.','<div class="result-list">'+checks.map(x=>'<div class="result '+(x.pass?'pass':'fail')+'"><b>'+ (x.pass?'PASS':'FAIL')+' · '+esc(x.name)+'</b><div class="sub">'+esc(x.detail)+'</div></div>').join('')+'</div>');
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
const projectAgentSystem=`You are ProjectX's project agent. The canonical project specification is the source of truth. Return JSON only: {"intent":"answer|change|build|test|research|publish","message":string,"changed":boolean,"specPatch":{},"workspaceSections":[],"agents":[{"key":string,"name":string,"purpose":string,"tools":string[]}],"fileOperations":[{"op":"write|delete","path":"safe/relative/path","content":"complete file content"}],"researchQuery":string,"researchUrls":string[],"needsBuild":boolean}. For research, only return URLs explicitly supplied by the user; never invent sources. Never claim a file, artifact, build, test, research result, or deployment exists without returning the corresponding operation or verified result. For software/game changes prefer real file operations.`;
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
      if(intent==='research'){
        const query=String(data.researchQuery||'').trim();
        const urls=Array.isArray(data.researchUrls)?data.researchUrls.map(x=>String(x||'').trim()).filter(Boolean).slice(0,5):[];
        if(!session){aiRequiredModal('Sign in to use source-backed research.');renderProject(project);return;}
        if(!query||!urls.length){messages.push({role:'assistant',text:'Send the research question together with one or more source URLs I should analyze.'});project.conversation=messages.slice(-MAX_HISTORY);saveProject(project);drawConversation(messages,'#project-log');return;}
        const result=await edge('research',{projectId:project.id,query,urls});
        const mutation=applyProjectMutation(project,{researchPatch:{query,addSources:result.sources||urls.map(url=>({url})),addFindings:result.findings||[]}});
        if(mutation.changed){project.executionState={...(project.executionState||{}),lastAgent:'researcher'};saveProject(project);await syncRemoteProject(project);}
        messages.push({role:'assistant',text:String(result.summary||'Research added to the project evidence store.')});
        project.conversation=messages.slice(-MAX_HISTORY);saveProject(project);drawConversation(messages,'#project-log');renderProject(project);return;
      }
      if((intent==='build'||data.needsBuild)&&settingsState.executionMode!=='Ask Me'){
        renderOutput(project);
        await buildArtifact(project);
        if(settingsState.executionMode==='Autonomous'){
          const results=await runTests(project);
          const status=results.every(x=>x.pass)?'verified':'needs-fix';
          project.tests={status:results.every(x=>x.pass)?'passed':'failed',specVersion:project.specVersion,results,updatedAt:now()};
          project.status=status;saveProject(project);await syncRemoteProject(project);
        }
        return;
      }
      if((intent==='build'||data.needsBuild)&&settingsState.executionMode==='Ask Me'){
        messages.push({role:'assistant',text:'The build is ready to run. Open Output and start it when you are ready.'});
        project.conversation=messages.slice(-MAX_HISTORY);saveProject(project);drawConversation(messages,'#project-log');renderProject(project);return;
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
    const data=await aiJson('plan',{project,history:[],message:JSON.stringify(instruction),system},3600);
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
  const title=software?(project.type==='Game'?'Playtest':'Output'):'Deliverable';
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
    const data=await aiJson('artifact',{project,message:software?'Generate the complete functional software artifact for this exact project. Return only files needed for this project.'+(repairContext||''):'Generate the complete deliverable for this exact project. For a real-world objective, prefer a well-structured Markdown document unless another format is clearly required. Return only files needed for this deliverable.'+(repairContext||'')},10000);
    const files={};
    for(const file of Array.isArray(data?.files)?data.files:[]){
      const path=sanitizePath(file.path);
      if(path&&typeof file.content==='string'&&file.content.length<=600000)files[path]=file.content;
    }
    if(!Object.keys(files).length)throw new Error('The AI returned no usable deliverable files.');

    if(software){
      if(!files['index.html']&&!files['src/index.html'])throw new Error('The AI did not return a valid index.html artifact.');
      const html=files['index.html']||files['src/index.html']||'';
      const structural=[
        {name:'Entry file exists',pass:Boolean(html),detail:html?'index.html exists.':'No index.html artifact exists.'},
        {name:'HTML structure',pass:/<html[\s>]/i.test(html)&&/<body[\s>]/i.test(html),detail:/<html[\s>]/i.test(html)?'HTML document detected.':'Missing a complete HTML document.'},
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
    saveProject(project);
    await syncRemoteProject(project);
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
  const onMessage=e=>{if(e.source===frame.contentWindow&&e.data?.type==='PROJECTX_RUNTIME_ERROR')notify('Project runtime error: '+String(e.data.message||'Runtime error'),'error');};
  window.addEventListener('message',onMessage);runtimeTestCleanup=()=>window.removeEventListener('message',onMessage);
  $('[data-viewport]').forEach(btn=>btn.onclick=()=>{const value=btn.dataset.viewport;$('[data-viewport]').forEach(x=>x.classList.toggle('active',x===btn));const artifact=$('.artifact');artifact.className='artifact preview-'+value;});
}
function renderFiles(project){
  const paths=Object.keys(project.files||{}).sort(),first=paths[0]||null,body=$('#project-body');
  body.innerHTML='<div class="box"><div class="files"><div class="file-list">'+(paths.map((path,i)=>'<button class="'+(i===0?'active':'')+'" data-file="'+esc(path)+'">'+esc(path)+'</button>').join('')||'<div class="sub">No generated files yet.</div>')+'</div><div style="padding-left:14px"><div class="row"><b id="file-name">'+esc(first||'No file selected')+'</b><div class="actions">'+(first?'<button class="ghost" id="save-file">Save</button><button class="download" id="download-file">Download</button>':'')+'</div></div><textarea id="file-code-editor" class="code-editor" spellcheck="false">'+esc(first?project.files[first]:'Build the project to create real files.')+'</textarea></div></div></div>';
  let currentPath=first;
  const selectFile=path=>{$$('[data-file]',body).forEach(x=>x.classList.toggle('active',x.dataset.file===path));currentPath=path;$('#file-name').textContent=path;$('#file-code-editor').value=project.files[path]||'';};
  $$('[data-file]',body).forEach(button=>button.onclick=()=>selectFile(button.dataset.file));
  $('#save-file')?.addEventListener('click',async()=>{
    if(!currentPath||!Object.hasOwn(project.files,currentPath))return;
    const content=$('#file-code-editor').value;
    if(project.files[currentPath]===content)return notify('No file changes to save.','info');
    snapshot(project,'Before file edit');
    const mutation=applyProjectMutation(project,{fileOperations:[{op:'write',path:currentPath,content}]});
    if(!mutation.changed)return;
    project.status='needs-build';saveProject(project);await syncRemoteProject(project);notify('File saved. Generated output is now stale until rebuilt and verified.','success');
  });
  $('#download-file')?.addEventListener('click',()=>currentPath&&downloadText(currentPath,project.files[currentPath]));
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
  const kindLabel=software?'playable':'document';
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

function analyticsPage(){shell(`<div class="panel"><div class="kicker">PROJECT X</div><h1 class="hero-title" style="font-size:44px">Analytics</h1><div class="grid"><div class="box"><b>Projects</b><div class="sub">${state.projects.length}</div></div><div class="box"><b>AI</b><div class="sub">${session?'Secure account connected':localGuestKey()?'Local session key configured':'Not connected'}</div></div><div class="box"><b>Outputs</b><div class="sub">${state.projects.filter(p=>p.artifacts?.output).length}</div></div></div></div>`,'analytics');}
async function assistantPage(){shell(`<div class="panel"><div class="kicker">PROJECT X</div><h1 class="hero-title" style="font-size:44px">Assistant X</h1><div class="box"><div id="assistant-log" class="conversation"></div><form id="assistant-form" class="form"><textarea id="assistant-input" placeholder="Ask a general ProjectX question..."></textarea><button class="primary">Send</button></form></div></div>`,'assistant');const messages=[{role:'assistant',text:'What do you need help with?'}];drawConversation(messages,'#assistant-log');$('#assistant-form').onsubmit=async e=>{e.preventDefault();const text=$('#assistant-input').value.trim();if(!text)return;messages.push({role:'user',text});drawConversation(messages,'#assistant-log');$('#assistant-input').value='';try{messages.push({role:'assistant',text:await aiText({message:text,history:messages,project:activeProject()||{},system:'You are Assistant X for ProjectX. Be concise and practical. Never claim actions you did not perform.'})});}catch(error){messages.push({role:'assistant',text:`AI unavailable: ${error.message}`});}drawConversation(messages,'#assistant-log');};}
const SETTINGS=[['general','General'],['ai','AI'],['agents','Agents'],['integrations','Integrations'],['defaults','Project Defaults'],['appearance','Appearance'],['notifications','Notifications'],['security','Security & Privacy'],['git','Git & Deployment'],['storage','Storage'],['billing','Billing & Usage'],['advanced','Advanced']];
function settingsPage(which='general'){shell(`<div class="panel"><div class="kicker">PROJECT X</div><h1 class="hero-title" style="font-size:44px">Settings</h1><div class="settings"><nav class="settings-nav">${SETTINGS.map(([id,name])=>`<button class="${id===which?'active':''}" data-setting="${id}">${name}</button>`).join('')}</nav><div id="settings-body"></div></div></div>`,'settings');$$('[data-setting]').forEach(button=>button.onclick=()=>settingsPage(button.dataset.setting));renderSettings(which);}
async function renderSettings(which){const body=$('#settings-body');if(!body)return;const p=settingsState;if(which==='general')body.innerHTML=`<h2>General</h2><p class="sub">Core ProjectX preferences.</p><div class="box"><div class="row"><div><b>Working mode</b><div class="sub">Choose how much automation ProjectX should use. Provider details stay hidden from normal project work.</div></div><select class="select" id="execution-mode">${['Fast','Balanced','Powerful','Ask Me','Mostly Automatic','Autonomous'].map(m=>'<option '+(p.executionMode===m?'selected':'')+'>'+m+'</option>').join('')}</select></div><div class="row"><div><b>Auto-save</b><div class="sub">Save successful project changes automatically.</div></div><button class="ghost" id="toggle-autosave">${p.autoSave?'On':'Off'}</button></div><div class="row"><div><b>Confirm destructive actions</b></div><button class="ghost" id="toggle-confirm">${p.confirmDelete?'On':'Off'}</button></div><div class="row"><b>Language</b><select class="select" id="language"><option>English</option></select></div><div class="row"><b>Timezone</b><input class="input" id="timezone" value="${esc(p.timezone)}"></div></div>`;
else if(which==='ai')return renderAiSettings(body);
else if(which==='agents')body.innerHTML=`<h2>Agents</h2><p class="sub">Every enabled role uses the same canonical project brain.</p><div class="box">${Object.entries(p.agents).map(([id,on])=>`<div class="row"><div><b>${esc(id)}</b><div class="sub">${esc({interviewer:'Discovery and ambiguity reduction.',planner:'Plans from the project brain.',builder:'Creates real files and outputs.',tester:'Validates current artifacts.',researcher:'Structures evidence when research is relevant.'}[id]||'Project role.')}</div></div><button class="ghost" data-agent="${id}">${on?'Enabled':'Disabled'}</button></div>`).join('')}</div>`;
else if(which==='integrations')body.innerHTML=`<h2>Integrations</h2><div class="box"><div class="row"><div><b>Supabase</b><div class="sub">${ensureSupabase()?'Configured':'Not configured'}</div></div><span class="status ${ensureSupabase()?'ok':'warn'}">${ensureSupabase()?'READY':'PLACEHOLDER'}</span></div><div class="row"><div><b>GitHub</b><div class="sub">Repository automation requires OAuth integration.</div></div><span class="status warn">PLACEHOLDER</span></div></div>`;
else if(which==='defaults')body.innerHTML=`<h2>Project Defaults</h2><div class="box"><div class="row"><b>Default model</b><select class="select" id="default-model">${MODELS.map(m=>`<option ${p.model===m?'selected':''}>${m}</option>`).join('')}</select></div><div class="row"><b>Response style</b><select class="select" id="response-style"><option ${p.responseStyle==='concise'?'selected':''}>concise</option><option ${p.responseStyle==='balanced'?'selected':''}>balanced</option><option ${p.responseStyle==='detailed'?'selected':''}>detailed</option></select></div></div>`;
else if(which==='appearance')body.innerHTML=`<h2>Appearance</h2><div class="box"><div class="row"><b>Theme</b><span class="sub">Light workspace is currently implemented.</span></div><div class="placeholder">Dark/system styling remains a placeholder and is not falsely marked active.</div></div>`;
else if(which==='notifications')body.innerHTML=`<h2>Notifications</h2><div class="box">${Object.entries(p.notifications).map(([id,on])=>`<div class="row"><b>${esc(id)}</b><button class="ghost" data-notification="${id}">${on?'On':'Off'}</button></div>`).join('')}</div>`;
else if(which==='security')body.innerHTML=`<h2>Security & Privacy</h2><div class="box"><div class="row"><div><b>AI credential storage</b><div class="sub">${session?'Server-side encrypted vault':'Local browser session'}</div></div><span class="status ${session?'ok':'warn'}">${session?'SECURE':'LOCAL'}</span></div><div class="row"><div><b>Account</b><div class="sub">${session?esc(session.user?.email||'Signed in'):'Not signed in'}</div></div>${session?'<button class="ghost" id="security-signout">Sign out</button>':'<button class="ghost" id="security-signin">Sign in</button>'}</div><div class="placeholder">Client-side guest mode never syncs credentials to ProjectX. Sign in to use the encrypted server-side vault.</div></div><div class="box" style="margin-top:10px"><div class="row"><div><b>Security events</b><div class="sub">Recent security events recorded for this account.</div></div><button class="ghost" id="load-security-events">${session?'Load':'Sign in'}</button></div><div id="security-events" class="sub" style="margin-top:10px">No events loaded.</div></div>`;
else if(which==='git')body.innerHTML=`<h2>Git & Deployment</h2><div class="box"><div class="placeholder">GitHub OAuth, repository automation, branch creation, and deployment are placeholders until their real account-level integrations are configured.</div></div>`;
else if(which==='storage')body.innerHTML=`<h2>Storage</h2><div class="box"><div class="row"><b>Projects</b><span class="sub">${state.projects.length}</span></div><div class="row"><b>Generated files</b><span class="sub">${state.projects.reduce((count,project)=>count+Object.keys(project.files||{}).length,0)}</span></div></div>`;
else if(which==='billing')body.innerHTML=`<h2>Billing & Usage</h2><div class="box"><div class="row"><div><b>Plan</b><div class="sub">Billing controls remain inactive until a payment merchant is connected.</div></div><span class="status warn">NOT CONNECTED</span></div><div class="grid" style="margin-top:10px"><div class="box"><b>30-day requests</b><div id="usage-total" class="hero-title" style="font-size:28px;margin:6px 0">—</div></div><div class="box"><b>30-day units</b><div id="usage-units" class="hero-title" style="font-size:28px;margin:6px 0">—</div></div><div class="box"><b>Top actions</b><div id="usage-actions" class="sub" style="margin-top:7px">Loading…</div></div></div><div class="box" style="margin-top:10px"><b>Recent AI usage</b><div id="usage-recent" style="margin-top:8px">Loading…</div></div></div>`;
else body.innerHTML=`<h2>Advanced</h2><div class="box"><button class="ghost" id="export-state">Export local state</button><button class="ghost" id="clear-state" style="margin-left:7px">Clear local cache</button><div class="placeholder" style="margin-top:12px">Experimental options are intentionally inactive until implemented.</div></div>`;bindSettings(which);}
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
    '<div class="box" style="margin-top:10px"><b>Guest Gemini</b><div class="sub">For quick local use without an account. The key is kept in session storage and is not synced.</div><div class="row"><input id="guest-gemini-key" class="input full" type="password" placeholder="Paste Gemini API key"><button id="save-gemini" class="ghost">Save guest key</button></div></div>';
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
  if(which==='billing'&&session)loadUsagePanel();
  $('#execution-mode')?.addEventListener('change',e=>{settingsState.executionMode=e.target.value;persistSettings();});$('#toggle-autosave')?.addEventListener('click',()=>{settingsState.autoSave=!settingsState.autoSave;persistSettings();renderSettings(which)});$('#toggle-confirm')?.addEventListener('click',()=>{settingsState.confirmDelete=!settingsState.confirmDelete;persistSettings();renderSettings(which)});$('#language')?.addEventListener('change',e=>{settingsState.language=e.target.value;persistSettings()});$('#timezone')?.addEventListener('change',e=>{settingsState.timezone=e.target.value;persistSettings()});$('#default-model')?.addEventListener('change',e=>{settingsState.model=e.target.value;persistSettings()});$('#ai-model')?.addEventListener('change',e=>{settingsState.model=e.target.value;persistSettings()});$$('[data-agent]').forEach(button=>button.onclick=()=>{const id=button.dataset.agent;settingsState.agents[id]=!settingsState.agents[id];persistSettings();renderSettings('agents')});$$('[data-notification]').forEach(button=>button.onclick=()=>{const id=button.dataset.notification;settingsState.notifications[id]=!settingsState.notifications[id];persistSettings();renderSettings('notifications')});$('#security-signin')?.addEventListener('click',authModal);$('#security-signout')?.addEventListener('click',()=>signOut().then(()=>settingsPage('security')));$('#export-state')?.addEventListener('click',()=>downloadText('projectx-state.json',JSON.stringify(state,null,2),'application/json'));$('#clear-state')?.addEventListener('click',()=>{if(settingsState.confirmDelete&&!confirm('Clear local project cache? Cloud projects remain in your account.'))return;state={version:6,projects:[],active:null};persistLocal();home();});}
function authModal(){closeModal();const modal=document.createElement('div');modal.className='modal-bg';modal.innerHTML=`<div class="modal"><div class="kicker">PROJECT X ACCOUNT</div><h2>Use secure project storage</h2><p class="sub">Sign in to sync projects and store AI credentials in the encrypted server-side vault.</p><div style="display:flex;gap:7px;margin:12px 0"><button class="ghost" id="auth-signin-mode">Sign in</button><button class="ghost" id="auth-signup-mode">Create account</button></div><input id="auth-email" class="input full" type="email" placeholder="Email"><input id="auth-password" class="input full" type="password" placeholder="Password" style="margin-top:7px"><div id="auth-status" class="sub" style="margin-top:8px"></div><div class="actions"><button class="ghost" id="auth-cancel">Cancel</button><button class="primary" id="auth-submit">Continue</button></div></div>`;document.body.appendChild(modal);currentModal=modal;let mode='signin';const setMode=m=>{mode=m;$('#auth-signin-mode').classList.toggle('active',m==='signin');$('#auth-signup-mode').classList.toggle('active',m==='signup');};$('#auth-signin-mode').onclick=()=>setMode('signin');$('#auth-signup-mode').onclick=()=>setMode('signup');$('#auth-cancel').onclick=closeModal;$('#auth-submit').onclick=async()=>{const email=$('#auth-email').value.trim(),password=$('#auth-password').value;if(!email||password.length<6){$('#auth-status').textContent='Enter an email and a password with at least 6 characters.';return;}const button=$('#auth-submit');button.disabled=true;try{await authAction(mode,email,password);closeModal();await syncRemoteProjects();settingsPage('ai');notify('Secure account connected.','success');}catch(error){$('#auth-status').textContent=error.message;}finally{button.disabled=false;}};}
function closeModal(){currentModal?.remove();currentModal=null;}
function aiRequiredModal(message){closeModal();const modal=document.createElement('div');modal.className='modal-bg';modal.innerHTML=`<div class="modal"><div class="kicker">AI CONNECTION REQUIRED</div><h2>Connect your AI</h2><p class="sub">${esc(message)}</p><div class="actions"><button class="ghost" id="ai-close">Cancel</button><button class="primary" id="ai-settings">Open Settings</button></div></div>`;document.body.appendChild(modal);currentModal=modal;$('#ai-close').onclick=closeModal;$('#ai-settings').onclick=()=>{closeModal();settingsPage('ai');};}
function navigate(route){if(route==='home')home();else if(route==='projects')projectsPage();else if(route==='analytics')analyticsPage();else if(route==='assistant')assistantPage();else if(route==='settings')settingsPage('general');}
window.addEventListener('beforeunload',()=>runtimeTestCleanup?.());
async function boot(){installCss();installOptionalAnalytics();await refreshSession();if(!state.projects.length){const legacy=read('px_adaptive_v1',null)||read('builder_universal_v14',null);if(legacy?.projects?.length){state.projects=legacy.projects.map(migrateProject);persistLocal();}}await syncRemoteProjects();home();}
window.ProjectX={state:()=>state,settings:()=>settingsState,openProject,refresh:boot};
boot();
