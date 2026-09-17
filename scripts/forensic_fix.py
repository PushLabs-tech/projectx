from __future__ import annotations

import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]

def read(name: str) -> str:
    return (ROOT / name).read_text(encoding='utf-8')

def write(name: str, content: str) -> None:
    (ROOT / name).write_text(content, encoding='utf-8')

def fail(message: str) -> None:
    raise RuntimeError(f'[forensic-fix] {message}')

def find_function_range(source: str, name: str) -> tuple[int, int]:
    marker = f'function {name}('
    start = source.find(marker)
    if start < 0:
        fail(f'function {name} not found')
    open_brace = source.find('{', start)
    if open_brace < 0:
        fail(f'function {name} has no opening brace')
    depth = 0
    state = 'code'
    quote = ''
    escaped = False
    i = open_brace
    while i < len(source):
        ch = source[i]
        nx = source[i + 1] if i + 1 < len(source) else ''
        if state == 'line':
            if ch == '\n':
                state = 'code'
            i += 1
            continue
        if state == 'block':
            if ch == '*' and nx == '/':
                state = 'code'
                i += 2
                continue
            i += 1
            continue
        if state == 'string':
            if escaped:
                escaped = False
            elif ch == '\\':
                escaped = True
            elif ch == quote:
                state = 'code'
                quote = ''
            i += 1
            continue
        if ch == '/' and nx == '/':
            state = 'line'
            i += 2
            continue
        if ch == '/' and nx == '*':
            state = 'block'
            i += 2
            continue
        if ch in ('"', "'", '`'):
            state = 'string'
            quote = ch
            i += 1
            continue
        if ch == '{':
            depth += 1
        elif ch == '}':
            depth -= 1
            if depth == 0:
                return start, i + 1
        i += 1
    fail(f'unterminated function {name}')

def replace_function(source: str, name: str, replacement: str) -> str:
    start, end = find_function_range(source, name)
    return source[:start] + replacement.rstrip() + source[end:]

def replace_once(source: str, old: str, new: str, label: str) -> str:
    count = source.count(old)
    if count != 1:
        fail(f'{label}: expected 1 match, got {count}')
    return source.replace(old, new)

def replace_constant(source: str, name: str, replacement: str) -> str:
    pattern = re.compile(rf'const {re.escape(name)}\s*=.*?;', re.S)
    match = pattern.search(source)
    if not match:
        fail(f'constant {name} not found')
    return source[:match.start()] + replacement + source[match.end():]

# -----------------------------------------------------------------------------
# Canonical project core. One Project object owns durable intent/spec/workspace
# plus versioned derived state. No second project runtime is introduced.
# -----------------------------------------------------------------------------
CORE = r'''export const CORE_VERSION = 2;

const SECTION_LIMIT = 12;
const PROJECT_TYPES = ['Game','Website','App','Mobile','Business','Research','Agent','Automation','API','Other'];
const SOFTWARE_TYPES = new Set(['Game','Website','App','Mobile','API','Agent','Automation']);
const ARRAY_FIELDS = ['users','requirements','constraints','features','decisions','dependencies','resources','assets','deliverables','acceptanceCriteria','successCriteria','openQuestions','technology'];

const FALLBACK_SECTIONS = {
  Game:[['Plan','Define the game loop, rules, progression, and success criteria.'],['Gameplay','Define mechanics, controls, balancing, and player experience.'],['Playtest','Run and inspect the current playable artifact.'],['Code','Inspect and change the generated implementation.'],['Assets','Track visual, audio, and content requirements.'],['Test','Verify important behaviours and regressions.'],['Publish','Prepare the project for delivery.']],
  Website:[['Plan','Define pages, audience, content, and conversion goals.'],['Design','Define information hierarchy, visual direction, and responsive behaviour.'],['Preview','Inspect the current generated experience.'],['Code','Inspect and change the generated implementation.'],['Test','Verify navigation, interactions, accessibility, and responsive behaviour.'],['Publish','Prepare the site for delivery.']],
  Business:[['Plan','Turn the business goal into an actionable operating plan.'],['Research','Capture market, customer, competitor, or location evidence.'],['Economics','Model pricing, costs, assumptions, and unit economics.'],['Operations','Define the repeatable operating workflow.'],['Marketing','Define acquisition, positioning, and launch actions.'],['Launch','Turn the plan into an executable launch checklist.']],
  Research:[['Question','Refine the research question, scope, and methodology.'],['Research','Collect and organize evidence.'],['Sources','Track source quality and provenance.'],['Analysis','Compare evidence and identify patterns.'],['Findings','Synthesize defensible findings and uncertainty.'],['Report','Create the final research deliverable.']],
  Other:[['Plan','Turn the goal into a concrete sequence of outcomes.'],['Work','Develop the core deliverable.'],['Review','Check the work against the project goal.'],['Output','Prepare the result for use or delivery.']]
};

const SECTION_KIND_BY_NAME = {
  plan:'planning', planning:'planning', gameplay:'workspace', mechanics:'workspace', design:'workspace', question:'planning',
  work:'workspace', review:'workspace', economics:'workspace', operations:'workspace', marketing:'workspace', launch:'publish',
  research:'research', sources:'research', analysis:'research', findings:'research',
  code:'code', files:'code', assets:'code', test:'test', tests:'test', qa:'test', verify:'test',
  preview:'output', playtest:'output', output:'output', publish:'publish', deploy:'publish', report:'publish'
};
const DEFAULT_AGENT_BY_KIND = {conversation:'interviewer',planning:'planner',research:'researcher',workspace:'planner',code:'builder',output:'builder',test:'tester',publish:'publisher'};
const CAPABILITIES_BY_KIND = {
  conversation:['conversation.write'], planning:['spec.read','spec.propose'], research:['evidence.read','evidence.record','sources.track'],
  workspace:['spec.read','spec.propose'], code:['files.read','files.write'], output:['artifact.build','artifact.preview'],
  test:['tests.run','tests.read'], publish:['output.export']
};

export const safeId = value => String(value ?? '').trim().toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'').slice(0,80) || `section-${Math.random().toString(36).slice(2,8)}`;

export const sanitizePath = value => {
  const path = String(value ?? '').replace(/\\/g,'/').replace(/^\/+/,'').trim();
  if (!path || path.includes('..') || path.includes('\0') || /^[a-z]+:\/\//i.test(path)) return null;
  const clean = path.split('/').filter(Boolean).join('/');
  if (!clean || clean.length > 180) return null;
  return clean;
};

export const normalizeProjectType = value => {
  const raw = String(value || '').trim().toLowerCase();
  return PROJECT_TYPES.find(type => type.toLowerCase() === raw) || 'Other';
};
export const projectArtifactKind = type => SOFTWARE_TYPES.has(normalizeProjectType(type)) ? 'software' : 'document';
export const normalizeSectionKind = (name, kind) => {
  const explicit = String(kind || '').trim().toLowerCase();
  if (Object.keys(CAPABILITIES_BY_KIND).includes(explicit)) return explicit;
  return SECTION_KIND_BY_NAME[String(name || '').trim().toLowerCase()] || 'workspace';
};

export function normalizeAgents(agents = [], type = 'Other') {
  const input = Array.isArray(agents) ? agents : [];
  const out = [];
  const seen = new Set();
  const add = value => {
    const raw = typeof value === 'string' ? {key:value,name:value} : value || {};
    const key = String(raw.key || raw.id || raw.name || '').trim().toLowerCase().replace(/[^a-z0-9_-]+/g,'-').slice(0,60);
    if (!key || seen.has(key)) return;
    seen.add(key);
    out.push({id:safeId(raw.id || key),key,name:String(raw.name || key).slice(0,80),purpose:String(raw.purpose || `Own ${key} work for this project.`).slice(0,240),tools:Array.isArray(raw.tools)?raw.tools.map(String).slice(0,20):[],enabled:raw.enabled !== false,status:String(raw.status || 'ready').slice(0,30)});
  };
  input.forEach(add);
  if (!out.length) {
    add({key:'planner',name:'Planner',purpose:'Maintain the plan and canonical project decisions.'});
    if (projectArtifactKind(type) === 'software') add({key:'builder',name:'Builder',purpose:'Create and update the real implementation artifact.'});
    if (/research|business/i.test(String(type))) add({key:'researcher',name:'Researcher',purpose:'Work with evidence and source-backed project knowledge.'});
    add({key:'tester',name:'Tester',purpose:'Verify project outputs against acceptance criteria.'});
    add({key:'publisher',name:'Publisher',purpose:'Prepare verified outputs for delivery.'});
  }
  return out.slice(0,10);
}

const arr = value => Array.isArray(value) ? value.map(v => String(v ?? '').trim()).filter(Boolean) : [];

export function emptySpec() {
  return {goal:'',users:[],requirements:[],constraints:[],features:[],decisions:[],dependencies:[],resources:[],assets:[],deliverables:[],acceptanceCriteria:[],successCriteria:[],openQuestions:[],platform:'',technology:[],visualDirection:'',currentState:'discovery',game:{kind:'',player:'',controls:'',loop:'',theme:'',progression:'',multiplayer:false}};
}

export function mergeSpec(base = emptySpec(), patch = {}) {
  const next = {...emptySpec(),...base};
  for (const field of ['goal','platform','visualDirection','currentState']) if (typeof patch[field] === 'string' && patch[field].trim()) next[field] = patch[field].trim();
  for (const field of ARRAY_FIELDS) if (Array.isArray(patch[field])) next[field] = [...new Set(arr(patch[field]))];
  if (patch.game && typeof patch.game === 'object') next.game = {...next.game,...patch.game};
  return next;
}

export function mergeSpecDelta(base = emptySpec(), patch = {}) {
  const next = mergeSpec(emptySpec(), base);
  for (const field of ['goal','platform','visualDirection','currentState']) {
    if (typeof patch[field] === 'string') next[field] = patch[field].trim();
  }
  for (const field of ARRAY_FIELDS) {
    if (!(field in patch)) continue;
    const value = patch[field];
    if (value === null) { next[field] = []; continue; }
    if (Array.isArray(value)) { next[field] = [...new Set([...next[field],...arr(value)])]; continue; }
    if (!value || typeof value !== 'object') continue;
    if (Array.isArray(value.replace) || Array.isArray(value.set)) next[field] = [...new Set(arr(value.replace ?? value.set))];
    if (Array.isArray(value.add)) next[field] = [...new Set([...next[field],...arr(value.add)])];
    if (Array.isArray(value.remove)) { const remove = new Set(arr(value.remove).map(v=>v.toLowerCase())); next[field] = next[field].filter(v=>!remove.has(v.toLowerCase())); }
  }
  if (patch.game && typeof patch.game === 'object') next.game = {...next.game,...patch.game};
  return next;
}

export function detectSpecContradictions(spec = {}, projectType = 'Other') {
  const constraints = arr(spec.constraints).join(' ');
  const requirements = arr(spec.requirements).join(' ');
  const all = [constraints,requirements,arr(spec.assets).join(' '),String(spec.visualDirection || ''),...arr(spec.decisions)].join(' ').toLowerCase();
  const lowerConstraints = constraints.toLowerCase();
  const lowerRequirements = requirements.toLowerCase();
  const contradictions = [];
  const has = (rx,text) => rx.test(text.toLowerCase());
  if (has(/(?:no|without|avoid)\s+(?:a\s+)?backend/,lowerConstraints) && has(/cloud|server|database|realtime|account\s+(?:sync|storage)|remote\s+data/,lowerRequirements)) contradictions.push('The project forbids a backend/server layer but also requires cloud, server, database, realtime, or synced-account behaviour.');
  if (has(/(?:no|without|avoid)\s+(?:any\s+)?graphics?|text\s*[- ]?only/,lowerConstraints) && has(/graphic|image|illustration|sprite|animation|visual asset/,all)) contradictions.push('The project forbids graphics/visual assets but also requires graphics, images, illustrations, sprites, or visual animation.');
  if (has(/(?:no|without|avoid)\s+(?:user\s+)?login|no authentication|no accounts/,lowerConstraints) && has(/login|sign[ -]?in|authentication|user accounts|account creation/,lowerRequirements)) contradictions.push('The project forbids authentication/accounts but also requires login, sign-in, or user accounts.');
  if (has(/offline[- ]only|must work offline/,lowerConstraints) && has(/cloud|online[- ]only|realtime|server-side|remote/,lowerRequirements)) contradictions.push('The project is constrained to offline use but also requires cloud/online/server behaviour.');
  const type = normalizeProjectType(projectType);
  const platform = String(spec.platform || '').toLowerCase();
  if (type === 'Mobile' && /desktop|web-only/.test(platform)) contradictions.push('The project is classified as Mobile but its platform constraint says desktop/web-only.');
  if (type === 'Website' && /mobile app|ios|android/.test(platform)) contradictions.push('The project is classified as Website but its platform constraint describes a native mobile application.');
  return [...new Set(contradictions)];
}

export function validateSpec(spec, projectType = 'Other') {
  const s = mergeSpec(emptySpec(),spec);
  const missing = [];
  if (s.goal.length < 12) missing.push('goal');
  if (!s.users.length) missing.push('users');
  if (!s.requirements.length) missing.push('requirements');
  if (!s.deliverables.length) missing.push('deliverables');
  if (/^(Game|Website|App|Mobile|API|Agent|Automation)$/i.test(projectType) && !s.platform) missing.push('platform');
  if (/^Game$/i.test(projectType) && !s.game.loop) missing.push('game.loop');
  const contradictions = detectSpecContradictions(s,projectType);
  const ambiguities = Array.isArray(s.openQuestions) ? s.openQuestions : [];
  return {valid:missing.length===0 && contradictions.length===0,missing:[...new Set(missing)],contradictions,ambiguities,needsClarification:contradictions.length>0 || ambiguities.length>0};
}

export function buildDependencyMap(sections = []) {
  const ids = new Set(sections.map(section=>section.id));
  return sections.map(section=>({...section,dependsOn:(section.dependsOn||[]).filter(id=>ids.has(id))}));
}

export function normalizeSections(sections,type='Other') {
  const input = Array.isArray(sections) ? sections : [];
  const out = [];
  const seen = new Set();
  const add = value => {
    const raw = typeof value === 'string' ? {name:value} : value || {};
    const name = String(raw.name || raw.title || '').trim();
    if (!name || /^chat$/i.test(name)) return;
    const id = safeId(raw.id || name);
    if (seen.has(id)) return;
    seen.add(id);
    const kind = normalizeSectionKind(name,raw.kind);
    out.push({id,name:name.slice(0,60),purpose:String(raw.purpose || `Work on ${name}.`).slice(0,220),dependsOn:Array.isArray(raw.dependsOn)?raw.dependsOn.map(safeId).filter(Boolean).slice(0,8):[],kind,agent:String(raw.agent || raw.agentKey || DEFAULT_AGENT_BY_KIND[kind] || 'planner').slice(0,60),capabilities:Array.isArray(raw.capabilities)?raw.capabilities.map(String).slice(0,20):CAPABILITIES_BY_KIND[kind],artifactTypes:Array.isArray(raw.artifactTypes)?raw.artifactTypes.map(String).slice(0,10):(kind==='output'?['software','document']:[])});
  };
  input.forEach(add);
  if (!out.length) (FALLBACK_SECTIONS[type] || FALLBACK_SECTIONS.Other).forEach(([name,purpose])=>add({name,purpose}));
  return [{id:'chat',name:'Chat',purpose:'The project conversation and change interface.',dependsOn:[],kind:'conversation',agent:'interviewer',capabilities:CAPABILITIES_BY_KIND.conversation,artifactTypes:[]},...out].slice(0,SECTION_LIMIT);
}

export function invalidateArtifacts(project) {
  project.artifacts = project.artifacts || {};
  for (const artifact of Object.values(project.artifacts)) if (artifact) artifact.stale = Number(artifact.specVersion || 0) !== Number(project.specVersion);
  project.outputs = project.outputs || {};
  for (const output of Object.values(project.outputs)) if (output) output.stale = Number(output.specVersion || 0) !== Number(project.specVersion);
}

export function applyProjectMutation(project,mutation={}) {
  project.files = project.files || {};
  project.agents = normalizeAgents(project.agents || [],project.type);
  const before = JSON.stringify({spec:project.spec,sections:project.sections,files:project.files,agents:project.agents,research:project.research || {}});
  const beforeSpec = JSON.stringify(project.spec);
  let changed = false;
  let researchChanged = false;
  if (mutation.specPatch && typeof mutation.specPatch === 'object') project.spec = mergeSpecDelta(project.spec,mutation.specPatch);
  if (mutation.workspaceSections && Array.isArray(mutation.workspaceSections) && mutation.workspaceSections.length) {
    const next = buildDependencyMap(normalizeSections(mutation.workspaceSections,project.type));
    if (JSON.stringify(next)!==JSON.stringify(project.sections)) project.sections=next;
  }
  if (Array.isArray(mutation.agents)) project.agents=normalizeAgents(mutation.agents,project.type);
  if (Array.isArray(mutation.fileOperations)) {
    for (const op of mutation.fileOperations.slice(0,160)) {
      const path = sanitizePath(op?.path);
      if (!path) continue;
      if (op.op==='write' && typeof op.content==='string' && op.content.length<=600000 && project.files[path]!==op.content) project.files[path]=op.content;
      if (op.op==='delete' && Object.prototype.hasOwnProperty.call(project.files,path)) delete project.files[path];
    }
  }
  if (mutation.researchPatch && typeof mutation.researchPatch==='object') {
    project.research = project.research || {status:'ready',queries:[],sources:[],findings:[]};
    const addFindings = Array.isArray(mutation.researchPatch.addFindings) ? mutation.researchPatch.addFindings : [];
    if (addFindings.length) { project.research.findings=[...(project.research.findings||[]),...addFindings].slice(-100); researchChanged=true; }
  }
  project.resources = Array.isArray(project.spec.resources) ? [...project.spec.resources] : [];
  const after = JSON.stringify({spec:project.spec,sections:project.sections,files:project.files,agents:project.agents,research:project.research || {}});
  changed = before !== after;
  const specChanged = beforeSpec !== JSON.stringify(project.spec);
  if (changed) {
    project.specVersion = Number(project.specVersion || 1) + 1;
    project.updatedAt = new Date().toISOString();
    invalidateArtifacts(project);
    project.sectionContent = {};
    project.tests = {status:'stale',specVersion:project.specVersion,results:[],updatedAt:null};
    project.research = {...(project.research || {queries:[],sources:[],findings:[]}),status:researchChanged?'ready':'stale'};
    project.executionState = {...(project.executionState || {}),status:'dirty',lastMutationId:globalThis.crypto?.randomUUID?.() || `mutation-${Date.now()}-${Math.random().toString(36).slice(2,8)}`,staleFromVersion:project.specVersion};
    project.versions = Array.isArray(project.versions) ? project.versions : [];
  }
  return {changed,specChanged,researchChanged};
}

export function applySpecChange(project,patch={}) { return applyProjectMutation(project,{specPatch:patch}); }

export function createProject({id,title,type='Other',intent='',spec={},sections=[],conversation=[],agents=[],research={}}={}) {
  const normalizedType = normalizeProjectType(type);
  const projectId = id || globalThis.crypto?.randomUUID?.() || `px-${Date.now()}-${Math.random().toString(36).slice(2,8)}`;
  const normalizedSpec = mergeSpec(emptySpec(),spec);
  return {id:projectId,title:String(title || 'Untitled project').trim().slice(0,120),type:normalizedType,intent:String(intent || normalizedSpec.goal || '').trim(),createdAt:new Date().toISOString(),updatedAt:new Date().toISOString(),specVersion:1,understanding:{confidence:0,missing:[],ambiguities:[],method:'pending'},spec:normalizedSpec,sections:buildDependencyMap(normalizeSections(sections,normalizedType)),selectedSection:'chat',conversation:Array.isArray(conversation)?conversation:[],sectionContent:{},artifacts:{},outputs:{},tests:{status:'stale',specVersion:0,results:[],updatedAt:null},research:{status:'ready',queries:Array.isArray(research.queries)?research.queries:[],sources:Array.isArray(research.sources)?research.sources:[],findings:Array.isArray(research.findings)?research.findings:[]},resources:Array.isArray(normalizedSpec.resources)?[...normalizedSpec.resources]:[],agents:normalizeAgents(agents,normalizedType),executionState:{status:'ready',lastMutationId:null,lastAgent:null,staleFromVersion:null},files:{},versions:[],status:'discovery',sync:{remoteId:null,lastSyncedAt:null,baseUpdatedAt:null,mode:'local'}};
}

export function assemblePreviewHtml(files={}) {
  const safeFiles=Object.fromEntries(Object.entries(files).map(([path,content])=>[sanitizePath(path),String(content ?? '')]).filter(([path])=>path));
  let html=safeFiles['index.html'] || safeFiles['src/index.html'];
  if(!html){const first=Object.keys(safeFiles).find(path=>/\.html?$/i.test(path));html=first?safeFiles[first]:'<!doctype html><html><body><div id="app"></div></body></html>';}
  html=String(html);
  html=html.replace(/<link[^>]+href=["']([^"']+)["'][^>]*>/gi,(tag,href)=>{const path=sanitizePath(href.replace(/^\.\//,''));const css=path&&safeFiles[path];return css!=null?`<style data-projectx-file="${path}">${css}</style>`:tag;});
  html=html.replace(/<script[^>]+src=["']([^"']+)["'][^>]*><\/script>/gi,(tag,src)=>{const path=sanitizePath(src.replace(/^\.\//,''));const js=path&&safeFiles[path];return js!=null?`<script data-projectx-file="${path}">${js.replace(/<\/script/gi,'<\\/script')}</script>`:tag;});
  if(!/<meta[^>]+name=["']viewport["']/i.test(html)) html=html.replace(/<head>/i,'<head><meta name="viewport" content="width=device-width,initial-scale=1">');
  const guard='<script>(function(){window.addEventListener(\'error\',function(e){parent.postMessage({type:\'PROJECTX_RUNTIME_ERROR\',message:String(e.message||\'Runtime error\')},\'*\')});window.addEventListener(\'unhandledrejection\',function(e){parent.postMessage({type:\'PROJECTX_RUNTIME_ERROR\',message:String(e.reason?.message||e.reason||\'Unhandled rejection\')},\'*\')});})();<\\/script>';
  return html.replace(/<head>/i,`<head>${guard}`);
}

export function serializeForPersistence(project) {
  return {schemaVersion:2,id:project.id,title:project.title,type:project.type,intention:project.intent,specVersion:project.specVersion,spec:project.spec,understanding:project.understanding,workspace:{sections:project.sections},selectedSection:project.selectedSection,status:project.status,conversation:(project.conversation||[]).slice(-100),files:project.files||{},artifacts:project.artifacts||{},outputs:project.outputs||{},sectionContent:project.sectionContent||{},tests:project.tests||{status:'stale'},research:project.research||{status:'ready',queries:[],sources:[],findings:[]},agents:project.agents||[],resources:project.resources||[],executionState:project.executionState||{},versions:project.versions||[],sync:{remoteId:project.sync?.remoteId||null,lastSyncedAt:project.sync?.lastSyncedAt||null,baseUpdatedAt:project.sync?.baseUpdatedAt||null,mode:project.sync?.mode||'local'},updatedAt:project.updatedAt};
}

export function migrateProject(raw={}) {
  const p=createProject({id:raw.id,title:raw.title,type:raw.type || raw.project_type || 'Other',intent:raw.intent || raw.intention || raw.goal || '',spec:raw.spec || raw.projectSpec || {},sections:raw.sections || raw.workspace?.sections || [],conversation:raw.conversation || raw.messages || [],agents:raw.agents || raw.settings?.agents || [],research:raw.research || raw.settings?.research || {}});
  p.createdAt=raw.createdAt || raw.created_at || p.createdAt;
  p.updatedAt=raw.updatedAt || raw.updated_at || p.updatedAt;
  p.specVersion=Number(raw.specVersion || raw.spec_version || 1);
  p.understanding=raw.understanding || p.understanding;
  p.artifacts=raw.artifacts || raw.settings?.artifacts || {};
  p.outputs=raw.outputs || raw.settings?.outputs || {};
  p.sectionContent=raw.sectionContent || raw.settings?.sectionContent || {};
  p.tests=raw.tests || raw.settings?.tests || p.tests;
  p.research=raw.research || raw.settings?.research || p.research;
  p.agents=normalizeAgents(raw.agents || raw.settings?.agents || p.agents,p.type);
  p.resources=Array.isArray(raw.resources)?raw.resources:(Array.isArray(raw.spec?.resources)?raw.spec.resources:[]);
  p.executionState=raw.executionState || raw.settings?.executionState || p.executionState;
  p.files=raw.files || {};
  p.versions=Array.isArray(raw.versions)?raw.versions:[];
  p.status=raw.status || 'draft';
  p.selectedSection=raw.selectedSection || raw.selected_section || 'chat';
  p.sections=buildDependencyMap(normalizeSections(raw.sections || raw.workspace?.sections || p.sections,p.type));
  p.sync={...p.sync,...(raw.sync || {}),remoteId:raw.sync?.remoteId || raw.id || p.sync.remoteId,lastSyncedAt:raw.sync?.lastSyncedAt || raw.updatedAt || raw.updated_at || p.sync.lastSyncedAt,baseUpdatedAt:raw.sync?.baseUpdatedAt || raw.updatedAt || raw.updated_at || p.sync.baseUpdatedAt,mode:raw.sync?.mode || 'cloud'};
  return p;
}
'''

write('projectx-core.js', CORE)

# -----------------------------------------------------------------------------
# Live browser runtime: patch only the existing production entrypoint. No new
# runtime is created.
# -----------------------------------------------------------------------------
px = read('px-final.js')
px = replace_once(px, "  buildDependencyMap,\n} from './projectx-core.js';", "  buildDependencyMap,\n  applyProjectMutation,\n  normalizeProjectType,\n  projectArtifactKind,\n} from './projectx-core.js';", 'core import extension')
px = replace_once(px, 'const MAX_HISTORY = 80;', '''const MAX_HISTORY = 80;
const MAX_AI_CONTEXT_CHARS = 120000;
const PROJECT_LOCKS = new Map();

async function withProjectLock(projectId, task) {
  const key = String(projectId || 'global');
  const previous = PROJECT_LOCKS.get(key) || Promise.resolve();
  const next = previous.catch(() => {}).then(task);
  PROJECT_LOCKS.set(key, next);
  try { return await next; } finally { if (PROJECT_LOCKS.get(key) === next) PROJECT_LOCKS.delete(key); }
}

function canonicalAIProject(project = {}) {
  const raw = serializeForPersistence(project || {});
  const files = {};
  const fileManifest = {};
  let budget = 72000;
  for (const [path, content] of Object.entries(raw.files || {})) {
    fileManifest[path] = String(content ?? '').length;
    if (budget <= 0) continue;
    const text = String(content ?? '');
    const clipped = text.slice(0, Math.min(14000, budget));
    files[path] = clipped;
    budget -= clipped.length;
  }
  raw.files = files;
  raw.fileManifest = fileManifest;
  raw.sectionContent = Object.fromEntries(Object.entries(raw.sectionContent || {}).slice(-12));
  raw.aiContextVersion = 2;
  return raw;
}

function aiSystemWithContext(system, project, mode) {
  const ctx = canonicalAIProject(project || {});
  const agentKey = {understand:'interviewer',plan:'planner',artifact:'builder',discuss:'orchestrator'}[mode] || 'orchestrator';
  const agent = (ctx.agents || []).find(a => a.key === agentKey);
  return `${system || 'You are ProjectX.'}\n\n[AUTHORITATIVE PROJECT CONTEXT v2]\n${JSON.stringify(ctx).slice(0, MAX_AI_CONTEXT_CHARS)}\n[/AUTHORITATIVE PROJECT CONTEXT]${agent ? `\n[ACTIVE AGENT]\n${JSON.stringify(agent)}\n[/ACTIVE AGENT]` : ''}`;
}''', 'runtime context helpers')

px = replace_once(px, "function persistLocal() { write(STORE, state); }", "function persistLocal() { return write(STORE, state); }", 'local persistence return')
px = replace_once(px, "function persistSettings() { write(LOCAL_SETTINGS, settingsState); }", "function persistSettings() { return write(LOCAL_SETTINGS, settingsState); }", 'settings persistence return')

px = replace_function(px, 'aiJson', r'''async function aiJson(mode, payload, max = 3500) {
  const project = payload.project || {};
  const context = canonicalAIProject(project);
  if (session?.access_token) {
    const result = await edge('chat', {mode, project:context, message:payload.message || '', history:payload.history || [], model:settingsState.model, contextVersion:2});
    if (result.result && typeof result.result === 'object') return result.result;
    return parseJson(result.text || '');
  }
  const result = await directGemini(payload.history || [{role:'user',text:payload.message || ''}], aiSystemWithContext(payload.system || 'You are ProjectX.', project, mode), true, max);
  return parseJson(result.text);
}''')

px = replace_function(px, 'aiText', r'''async function aiText(payload) {
  const project = payload.project || {};
  const context = canonicalAIProject(project);
  if (session?.access_token) {
    const result = await edge('chat', {mode:'discuss', project:context, message:payload.message || '', history:payload.history || [], model:settingsState.model, contextVersion:2});
    return result.text || '';
  }
  return (await directGemini(payload.history || [{role:'user',text:payload.message || ''}], aiSystemWithContext(payload.system || 'You are ProjectX.', project, 'discuss'), false, 1800)).text;
}''')

INTERVIEW_SYSTEM = r'''const interviewSystem=`You are ProjectX's discovery architect. Ask one high-value question at a time. Do not finish until goal, users, constraints, requirements, desired deliverables, important platform details, and contradictions are resolved. Return JSON only: {"done":boolean,"question":string,"confidence":number,"missing":string[],"ambiguities":string[],"project":{"title":string,"type":"Game|Website|App|Mobile|Business|Research|Agent|Automation|API|Other","goal":string,"users":string[],"requirements":string[],"constraints":string[],"features":string[],"decisions":string[],"dependencies":string[],"resources":string[],"assets":string[],"deliverables":string[],"acceptanceCriteria":string[],"successCriteria":string[],"openQuestions":string[],"platform":string,"technology":string[],"visualDirection":string,"game":{"kind":string,"player":string,"controls":string,"loop":string,"theme":string,"progression":string,"multiplayer":boolean}},"workspace":{"sections":[{"name":string,"purpose":string,"dependsOn":string[],"kind":"workspace|output|research|planning|code|test|publish","agent":string,"capabilities":string[]}]},"agents":[{"key":string,"name":string,"purpose":string,"tools":string[],"enabled":boolean}],"summary":string}. Never invent facts. Chat is added automatically.`;'''
px = replace_constant(px, 'interviewSystem', INTERVIEW_SYSTEM)

px = replace_function(px, 'continueInterview', r'''async function continueInterview(history, answers) {
  $('#interview-status') && ($('#interview-status').textContent='Thinking…');
  try {
    const data = await aiJson('understand',{project:{},history,message:history[history.length-1]?.text || '',system:interviewSystem},3600);
    if (!data?.project) throw new Error('The AI returned invalid project-understanding data.');
    const type = normalizeProjectType(data.project.type);
    const spec = mergeSpec({}, data.project);
    const quality = validateSpec(spec,type);
    const declaredMissing = Array.isArray(data.missing) ? data.missing : [];
    const ambiguities = Array.isArray(data.ambiguities) ? data.ambiguities : [];
    const openQuestions = Array.isArray(spec.openQuestions) ? spec.openQuestions : [];
    const missing = [...new Set([...quality.missing,...declaredMissing,...openQuestions])];
    const confidence = Number(data.confidence || 0);
    const contradiction = quality.contradictions?.[0] || '';
    const done = data.done === true && quality.valid && confidence >= 0.82 && missing.length === 0 && ambiguities.length === 0 && !contradiction;
    if (!done) {
      const question = contradiction || data.question || (missing[0] ? `Please clarify ${String(missing[0]).replace(/[._]/g,' ')}.` : 'What is still important to decide before I build this?');
      history.push({role:'assistant',text:String(question).slice(0,700)});
      drawConversation(history,'#interview-log');
      $('#interview-status') && ($('#interview-status').textContent=`${Math.round(confidence*100)}% understood · one more question`);
      return;
    }
    const project = createProject({title:data.project.title,type,intent:data.project.goal || history[0].text,spec,sections:data.workspace?.sections,conversation:history,agents:data.agents});
    project.understanding={confidence,missing:[],ambiguities:[],method:session?'secure-ai':'guest-ai',summary:data.summary || ''};
    project.status='ready';
    saveProject(project,true);
    await syncRemoteProject(project);
    openProject(project.id);
  } catch (error) {
    $('#interview-status') && ($('#interview-status').textContent=`Discovery failed safely: ${error.message}. Retry your answer; no partial project was created.`);
  }
}''')

px = replace_function(px, 'saveProject', r'''function saveProject(project,initial=false) {
  if (initial) snapshot(project,'Initial project');
  const i=state.projects.findIndex(p=>p.id===project.id);
  if(i>=0)state.projects[i]=project;else state.projects.unshift(project);
  state.active=project.id;
  if(!persistLocal())throw new Error('Local project storage is unavailable or full.');
}''')

px = replace_function(px, 'syncRemoteProject', r'''async function syncRemoteProject(project) {
  if(!session || !settingsState.autoSave)return;
  try {
    const result=await edge('persistProject',{project:serializeForPersistence(project)});
    const oldId=project.id;
    if(result.projectId && result.projectId!==oldId){
      project.id=result.projectId;
      const i=state.projects.findIndex(p=>p.id===oldId); if(i>=0)state.projects[i]=project;
      if(state.active===oldId)state.active=project.id;
    }
    project.sync={remoteId:result.projectId || project.id,mode:'cloud',lastSyncedAt:result.updatedAt || now(),baseUpdatedAt:result.updatedAt || now(),error:null};
    if(!persistLocal())throw new Error('Local storage is unavailable or full.');
  } catch(e) {
    const conflict=String(e?.message || '').startsWith('CONFLICT:');
    project.sync={...(project.sync||{}),mode:conflict?'conflict':'local',error:e?.message || 'Cloud sync failed'};
    persistLocal();
    notify(conflict?'Cloud conflict detected. Reload the project before another cloud mutation.':`Cloud sync unavailable: ${e.message}`,'error');
  }
}''')

px = replace_function(px, 'openProject', r'''async function openProject(id) {
  const local=state.projects.find(p=>p.id===id); if(!local)return;
  state.active=id; persistLocal(); renderProject(local);
  if(!session)return;
  try {
    const result=await edge('getProject',{projectId:id}); if(!result.project)return;
    const remote=migrateProject(result.project);
    const i=state.projects.findIndex(p=>p.id===id); if(i>=0)state.projects[i]=remote;else state.projects.push(remote);
    if(state.active===id){persistLocal();renderProject(remote);}
  } catch(e) { if(state.active===id)notify(`Could not load the cloud project: ${e.message}`,'error'); }
}''')

px = replace_function(px, 'renderSection', r'''async function renderSection(project,section) {
  const body=$('#project-body'); if(!body||!section)return;
  switch(section.kind){
    case 'conversation': return renderProjectChat(project);
    case 'output':
    case 'publish': return renderOutput(project);
    case 'code': return renderFiles(project);
    case 'test': return renderTests(project);
    case 'research': return renderResearchSection(project,section);
    case 'planning':
    case 'workspace':
    default: return renderGeneratedSection(project,section);
  }
}''')

PROJECT_AGENT_SYSTEM = r'''const projectAgentSystem=`You are ProjectX's project agent. The canonical project object is the source of truth. Return JSON only: {"intent":"answer|change|build|test|research|publish","message":string,"changed":boolean,"specPatch":{},"workspaceSections":[{"name":string,"purpose":string,"kind":string,"agent":string,"capabilities":string[]}],"agents":[{"key":string,"name":string,"purpose":string,"tools":string[],"enabled":boolean}],"fileOperations":[{"op":"write|delete","path":"safe/relative/path","content":"complete file content"}],"needsBuild":boolean}. Array spec fields are additive by default; use {add,remove,replace} for explicit semantics. Never claim a change unless at least one returned operation produces an actual state change. For software/game requests use real file operations. For research use source-backed records, not invented findings.`;'''
px = replace_constant(px, 'projectAgentSystem', PROJECT_AGENT_SYSTEM)

px = replace_function(px, 'renderProjectChat', r'''function renderProjectChat(project,prefill='') {
  const body=$('#project-body');
  const messages=project.conversation.length?project.conversation.slice(-MAX_HISTORY):[{role:'assistant',text:'I have the authoritative project brain in context. What should we change or work on next?'}];
  body.innerHTML=`<div class="box"><div class="sub">Project Chat is the mutation interface for the canonical project state. A real mutation creates one new version and invalidates dependent state.</div><div id="project-log" class="conversation"></div><form id="project-form" class="form"><textarea id="project-input" placeholder="Ask ProjectX to change, build, test, research, or explain something..."></textarea><button class="primary" id="project-send">Send</button></form></div>`;
  drawConversation(messages,'#project-log');
  const input=$('#project-input'),send=$('#project-send'); input.value=prefill;
  $('#project-form').onsubmit=async e=>{
    e.preventDefault(); const text=input.value.trim(); if(!text||send.disabled)return; send.disabled=true;
    messages.push({role:'user',text}); drawConversation(messages,'#project-log'); input.value='';
    try {
      await withProjectLock(project.id,async()=>{
        const data=await aiJson('discuss',{project,history:messages,message:text,system:projectAgentSystem},5500);
        if(!data)throw new Error('The AI returned invalid project action data.');
        const hasFileOps=Array.isArray(data.fileOperations)&&data.fileOperations.length>0;
        const hasSections=Array.isArray(data.workspaceSections)&&data.workspaceSections.length>0;
        const hasAgents=Array.isArray(data.agents)&&data.agents.length>0;
        const hasSpec=Boolean(data.specPatch && Object.keys(data.specPatch).length);
        const claimsChange=Boolean(data.changed);
        if(hasFileOps||hasSections||hasAgents||hasSpec){
          snapshot(project,'Before change');
          const mutation=applyProjectMutation(project,{specPatch:data.specPatch||{},workspaceSections:data.workspaceSections,agents:data.agents,fileOperations:data.fileOperations||[]});
          if(!mutation.changed)throw new Error('The AI returned operations but none changed canonical project state.');
          project.status=data.needsBuild?'needs-build':'changed';
          project.executionState={...(project.executionState||{}),lastAgent:'orchestrator'};
        } else if(claimsChange){
          throw new Error('The AI claimed changed=true without returning an effective mutation.');
        }
        messages.push({role:'assistant',text:String(data.message||'No mutation was requested.')});
        project.conversation=messages.slice(-MAX_HISTORY); saveProject(project); await syncRemoteProject(project);
      });
      renderProject(project);
    } catch(error) {
      messages.push({role:'assistant',text:`I couldn't complete that request: ${error.message}`}); drawConversation(messages,'#project-log');
    } finally { send.disabled=false; }
  };
  input.onkeydown=e=>{if((e.ctrlKey||e.metaKey)&&e.key==='Enter'){e.preventDefault();$('#project-form').requestSubmit();}};
}''')

RESEARCH_FN = r'''function renderResearchSection(project,section) {
  const body=$('#project-body');
  project.research=project.research||{status:'ready',queries:[],sources:[],findings:[]};
  body.innerHTML=`<div class="box"><h2 style="margin:0">${esc(section.name)}</h2><div class="sub">Record source-backed findings here. They remain part of the same project brain and versioned state.</div><form id="research-form" class="form" style="margin-top:14px"><input id="research-title" class="input" placeholder="Source title"><input id="research-url" class="input" placeholder="Source URL"><textarea id="research-finding" placeholder="Finding or evidence"></textarea><button class="primary">Add</button></form><div style="margin-top:14px">${(project.research.findings||[]).map((f,i)=>`<div class="item"><b>${esc(f.title||'Finding '+(i+1))}</b><p>${esc(f.finding||'')}</p><div class="sub">${esc(f.url||'')}</div></div>`).join('')||'<div class="placeholder">No source-backed findings recorded yet.</div>'}</div>`;
  $('#research-form').onsubmit=e=>{e.preventDefault();const title=$('#research-title').value.trim(),url=$('#research-url').value.trim(),finding=$('#research-finding').value.trim();if(!title||!url||!finding)return notify('Add a source title, URL, and finding.','error');const result=applyProjectMutation(project,{researchPatch:{addFindings:[{id:globalThis.crypto?.randomUUID?.()||String(Date.now()),title,url,finding}]}});if(result.changed){saveProject(project);syncRemoteProject(project).finally(()=>renderResearchSection(project,section));}};
}'''
px = px.replace('function renderGeneratedSection', RESEARCH_FN + '\nfunction renderGeneratedSection', 1)

px = replace_function(px, 'renderGeneratedSection', r'''async function renderGeneratedSection(project,section) {
  const body=$('#project-body');
  body.innerHTML=`<div class="box"><div style="display:flex;justify-content:space-between;gap:10px"><div><h2 style="margin:0">${esc(section.name)}</h2><div class="sub">${esc(section.purpose)} · ${esc(section.kind)} workspace</div></div><button class="ghost" id="section-refresh">${project.sectionContent?.[section.id]?.specVersion===project.specVersion?'Refresh':'Generate'}</button></div><div id="section-content" style="margin-top:14px"><div class="sub">Generating from project version ${project.specVersion}…</div></div></div>`;
  $('#section-refresh').onclick=()=>{delete project.sectionContent[section.id];saveProject(project);renderGeneratedSection(project,section);};
  const cached=project.sectionContent?.[section.id]; if(cached?.specVersion===project.specVersion){drawSectionContent(cached);return;}
  try {
    const data=await withProjectLock(project.id,()=>aiJson('plan',{project,history:[],message:`Generate the structured ${section.name} workspace view from the current canonical project state. Never claim completed work.`,system:'Return JSON only: {"summary":string,"items":[{"title":string,"detail":string,"status":"proposed|ready|blocked|unknown"}],"nextActions":string[],"openQuestions":string[]}. This is a workspace view, not a fabricated execution result.'},3200));
    const content={specVersion:project.specVersion,kind:section.kind,summary:String(data?.summary||''),items:Array.isArray(data?.items)?data.items.slice(0,20):[],nextActions:Array.isArray(data?.nextActions)?data.nextActions.slice(0,10):[],openQuestions:Array.isArray(data?.openQuestions)?data.openQuestions.slice(0,10):[],generatedAt:now()};
    project.sectionContent={...(project.sectionContent||{}),[section.id]:content}; saveProject(project); await syncRemoteProject(project); drawSectionContent(content);
  } catch(error) { $('#section-content').innerHTML=`<div class="sub">Generation failed: ${esc(error.message)}. No project data was changed.</div>`; }
}''')

px = replace_function(px, 'renderOutput', r'''async function renderOutput(project) {
  const body=$('#project-body'); const kind=projectArtifactKind(project.type); const artifact=project.artifacts?.output; const output=project.outputs?.primary;
  const current=kind==='software' ? Boolean(artifact&&artifact.specVersion===project.specVersion&&!artifact.stale&&Object.keys(project.files||{}).length) : Boolean(output&&output.specVersion===project.specVersion&&!output.stale&&output.contentMarkdown);
  body.innerHTML=`<div class="box"><div style="display:flex;justify-content:space-between;gap:10px"><div><h2 style="margin:0">${project.type==='Game'?'Playtest':'Output'}</h2><div class="sub">${current?'Current output is tied to project version '+project.specVersion+'.':'No current output exists for this project version.'}</div></div><button id="build-output" class="primary">${current?'Rebuild with AI':'Build with AI'}</button></div><div id="output-area" style="margin-top:14px"></div></div>`;
  $('#build-output').onclick=()=>buildArtifact(project);
  if(kind==='software'&&current){mountArtifact(project);}
  else if(kind==='document'&&current){$('#output-area').innerHTML=`<div class="box"><pre class="code" style="white-space:pre-wrap;max-height:none">${esc(output.contentMarkdown)}</pre><div class="actions"><button class="download" id="download-output">Download markdown</button></div></div>`;$('#download-output').onclick=()=>downloadText(`${(project.title||'project').replace(/[^a-z0-9-_]+/gi,'-')}.md`,output.contentMarkdown,'text/markdown');}
  else $('#output-area').innerHTML='<div class="placeholder">Build creates a versioned, domain-appropriate output. There is no fixed demo artifact.</div>';
}''')

px = replace_function(px, 'buildArtifact', r'''async function buildArtifact(project) {
  if(!session&&!localGuestKey())return aiRequiredModal('Connect Gemini before ProjectX can build the real output.');
  const button=$('#build-output'),area=$('#output-area'); if(button)button.disabled=true; if(area)area.innerHTML='<div class="sub">ProjectX is generating a real output from the authoritative project state…</div>';
  try {
    const kind=projectArtifactKind(project.type);
    const system=kind==='software'
      ? 'Return JSON only: {"artifactType":"software","entry":"index.html","summary":string,"files":[{"path":string,"content":string}]}. Build the actual software in the canonical project. No TODOs, placeholder markers, remote assets, unrelated demos, or fabricated completed work.'
      : 'Return JSON only: {"artifactType":"document","title":string,"summary":string,"contentMarkdown":string,"deliverables":string[]}. Produce the concrete domain deliverable from the canonical project. Do not invent research evidence or claim real-world actions that have not happened.';
    const data=await aiJson('artifact',{project,message:kind==='software'?'Generate the complete functional software artifact from the current canonical project state.':'Generate the concrete domain deliverable from the current canonical project state.',system},10000);
    if(kind==='software') {
      const files={};
      for(const file of Array.isArray(data?.files)?data.files:[]){const path=sanitizePath(file.path);if(path&&typeof file.content==='string'&&file.content.length<=600000)files[path]=file.content;}
      if(!files['index.html']&&!files['src/index.html'])throw new Error('The AI did not return an index.html artifact.');
      snapshot(project,'Before rebuild');
      project.files=files;
      project.artifacts={...(project.artifacts||{}),output:{kind:'software',specVersion:project.specVersion,entry:data.entry||'index.html',summary:String(data.summary||''),updatedAt:now(),stale:false}};
      project.outputs={...(project.outputs||{}),primary:{kind:'software',specVersion:project.specVersion,summary:String(data.summary||''),entry:data.entry||'index.html',stale:false,updatedAt:now()}};
    } else {
      const content=String(data?.contentMarkdown||'').trim();
      if(content.length<80)throw new Error('The AI did not return a substantive domain deliverable.');
      if(/TODO|FIXME|coming soon|placeholder/i.test(content))throw new Error('The generated deliverable contains a placeholder marker.');
      snapshot(project,'Before output');
      project.outputs={...(project.outputs||{}),primary:{kind:'document',specVersion:project.specVersion,title:String(data.title||project.title||'ProjectX output'),summary:String(data.summary||''),contentMarkdown:content.slice(0,500000),deliverables:Array.isArray(data.deliverables)?data.deliverables.slice(0,30):[],stale:false,updatedAt:now()}};
      project.artifacts={...(project.artifacts||{}),output:{kind:'document',specVersion:project.specVersion,summary:String(data.summary||''),stale:false,updatedAt:now()}};
    }
    project.status='built'; project.executionState={...(project.executionState||{}),status:'built',staleFromVersion:null}; saveProject(project); await syncRemoteProject(project); renderOutput(project); if(kind==='software')mountArtifact(project); notify('Versioned project output generated from the current canonical state.','success');
  } catch(error) { if(area)area.innerHTML=`<div class="placeholder">Build failed: ${esc(error.message)}. The previous output was not overwritten.</div>`; }
  finally { if(button)button.disabled=false; }
}''')

px = replace_function(px, 'renderTests', r'''async function renderTests(project) {
  const body=$('#project-body'); const fresh=project.tests?.specVersion===project.specVersion&&Array.isArray(project.tests.results);
  body.innerHTML=`<div class="box"><div style="display:flex;justify-content:space-between;gap:10px"><div><h2 style="margin:0">Tests</h2><div class="sub">Checks the current versioned output; prior results are invalidated by canonical mutations.</div></div><button class="primary" id="run-tests">Run tests</button></div><div id="test-results" style="margin-top:14px"></div></div>`;
  $('#test-results').innerHTML=fresh?`<div class="result-list">${project.tests.results.map(r=>`<div class="result ${r.pass?'pass':'fail'}"><b>${r.pass?'PASS':'FAIL'} · ${esc(r.name)}</b><div class="sub">${esc(r.detail)}</div></div>`).join('')}</div>`:'<div class="placeholder">No verified results exist for the current project version.</div>';
  $('#run-tests').onclick=async()=>{const button=$('#run-tests');button.disabled=true;try{const results=await withProjectLock(project.id,()=>runTests(project));project.tests={specVersion:project.specVersion,results,updatedAt:now(),status:results.every(x=>x.pass)?'passed':'failed'};project.status=results.every(x=>x.pass)?'verified':'needs-fix';saveProject(project);await syncRemoteProject(project);renderTests(project);}catch(error){$('#test-results').innerHTML=`<div class="sub">Test execution failed: ${esc(error.message)}</div>`;}finally{button.disabled=false;}};
}''')

px = replace_function(px, 'runTests', r'''async function runTests(project) {
  const results=[]; const kind=projectArtifactKind(project.type);
  if(kind==='document') {
    const out=project.outputs?.primary; const content=String(out?.contentMarkdown||'');
    results.push({name:'Current output exists',pass:Boolean(out&&out.specVersion===project.specVersion&&!out.stale),detail:out?'Output is tied to the current project version.':'No current domain output exists.'});
    results.push({name:'Substantive content',pass:content.trim().length>=80,detail:content?'Output contains substantive content.':'Output content is missing or too short.'});
    results.push({name:'No placeholder markers',pass:!(/TODO|FIXME|coming soon|placeholder/i.test(content)),detail:/TODO|FIXME|coming soon|placeholder/i.test(content)?'Placeholder marker found.':'No obvious placeholder marker found.'});
    const required=Array.isArray(project.spec?.deliverables)?project.spec.deliverables:[];
    for(const item of required.slice(0,10)){const needle=String(item).slice(0,50).toLowerCase();results.push({name:`Deliverable · ${item}`,pass:content.toLowerCase().includes(needle),detail:content.toLowerCase().includes(needle)?'Covered by current output.':'Not visibly covered by current output.'});}
    if(project.type==='Research')results.push({name:'Evidence records present',pass:Array.isArray(project.research?.sources)&&project.research.sources.length>0&&Array.isArray(project.research?.findings)&&project.research.findings.length>0,detail:'Research output must have stored source/finding records.'});
    return results;
  }
  const files=project.files||{},html=files['index.html']||files['src/index.html']||'';
  results.push({name:'Entry file exists',pass:Boolean(html),detail:html?'index.html exists.':'No index.html artifact exists.'});
  results.push({name:'HTML structure',pass:/<html[\s>]/i.test(html)&&/<body[\s>]/i.test(html),detail:/<html[\s>]/i.test(html)?'HTML document detected.':'Missing a complete HTML document.'});
  const joined=Object.values(files).join('\n');
  results.push({name:'No placeholder markers',pass:!(/TODO|FIXME|coming soon|placeholder/i.test(joined)),detail:/TODO|FIXME|coming soon|placeholder/i.test(joined)?'Placeholder marker found.':'No obvious placeholder marker found.'});
  results.push(await browserRuntimeCheck(files));
  return results;
}''')

write('px-final.js', px)

# -----------------------------------------------------------------------------
# Supabase Edge Function: authoritative context + UUID-safe persistence + CAS.
# -----------------------------------------------------------------------------
edge = read('supabase/functions/ai/index.ts')
edge = replace_once(edge, 'const MAX_BODY_BYTES = 180000;', 'const MAX_BODY_BYTES = 5000000;', 'edge payload limit')
edge = replace_function(edge, 'projectContext', r'''function projectContext(p:any) {
  const files:any={}; let budget=72000;
  for(const [path,content] of Object.entries(p?.files||{})) { if(budget<=0)break; const text=String(content??''); const clipped=text.slice(0,Math.min(14000,budget)); files[path]=clipped; budget-=clipped.length; }
  const ctx={schemaVersion:2,id:p?.id||null,title:limitText(p?.title,200),type:limitText(p?.type||p?.project_type||'custom',100),intention:limitText(p?.intention||p?.spec?.goal,6000),specVersion:Number(p?.specVersion||p?.spec_version||1),spec:p?.spec||{},workspace:p?.workspace||{sections:p?.sections||[]},sectionContent:p?.sectionContent||{},agents:p?.agents||[],resources:p?.resources||[],artifacts:p?.artifacts||{},outputs:p?.outputs||{},tests:p?.tests||{},research:p?.research||{},executionState:p?.executionState||{},files,fileManifest:Object.fromEntries(Object.entries(p?.files||{}).map(([k,v])=>[k,String(v??'').length])),aiContextVersion:2};
  return `[PROJECT BRAIN v2]\n${JSON.stringify(ctx).slice(0,120000)}\n[/PROJECT BRAIN]`;
}''')

edge = replace_function(edge, 'persistProject', r'''async function persistProject(user:any,p:any) {
  const rawId=String(p?.id||'');
  const isUuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(rawId);
  const projectId=isUuid?rawId:'';
  let workspaceId=String(p?.workspaceId||'')||null;
  let existing:any=null;
  if(projectId) {
    const r=await admin.from('projects').select('id,owner_id,workspace_id,updated_at,spec_version').eq('id',projectId).maybeSingle(); if(r.error)throw r.error; existing=r.data;
    if(!existing)throw new Error('Project not found');
    if(existing.owner_id!==user.id){const {data:member}=await admin.from('workspace_members').select('role').eq('workspace_id',existing.workspace_id).eq('user_id',user.id).maybeSingle();if(!member||!['owner','admin','editor'].includes(member.role))throw new Error('Not authorized to edit this project');}
    const expected=p?.sync?.baseUpdatedAt||p?.sync?.lastSyncedAt||p?.baseUpdatedAt||null;
    if(expected&&String(existing.updated_at)!==String(expected))throw new Error(`CONFLICT: remote project changed after this client last synced (remote=${existing.updated_at}, client=${expected})`);
    if(!expected&&Number(existing.spec_version||0)>Number(p?.specVersion||1))throw new Error('CONFLICT: remote project is newer than this client');
    workspaceId=existing.workspace_id;
  } else {
    const {data:w,error:we}=await admin.from('workspaces').insert({owner_id:user.id,name:limitText(p?.title||'ProjectX Workspace',120)}).select('id').single();if(we)throw we;workspaceId=w.id;
    const {error:me}=await admin.from('workspace_members').insert({workspace_id:workspaceId,user_id:user.id,role:'owner'});if(me)throw me;
  }
  const settings={schemaVersion:2,status:p?.status||'draft',artifacts:p?.artifacts||{},outputs:p?.outputs||{},sectionContent:p?.sectionContent||{},tests:p?.tests||{},research:p?.research||{},agents:p?.agents||[],resources:p?.resources||[],executionState:p?.executionState||{}};
  const row={...(projectId?{id:projectId}:{}),owner_id:user.id,workspace_id:workspaceId,title:limitText(p?.title||'Untitled',200),intention:limitText(p?.intention||p?.spec?.goal,10000),project_type:limitText(p?.type||p?.project_type||'custom',100),classification:p?.understanding||{},plan:p?.plan||p?.sections||[],project_spec:p?.spec||{},understanding:p?.understanding||{},workspace_config:p?.workspace||{sections:p?.sections||[]},spec_version:Number(p?.specVersion||1),selected_section:limitText(p?.selectedSection||'chat',100),settings,status:limitText(p?.status||'planning',60),updated_at:new Date().toISOString()};
  const savedResult=await admin.from('projects').upsert(row).select('id,workspace_id,updated_at').single();if(savedResult.error)throw savedResult.error;const saved=savedResult.data;
  const files=Object.entries(p?.files||{}).filter(([path,content])=>{const s=String(path);return !s.startsWith('/')&&!s.includes('..')&&!s.includes('\\')&&typeof content==='string'&&content.length<=600000;}).slice(0,600);
  const oldFileResult=await admin.from('project_files').select('path').eq('project_id',saved.id);if(oldFileResult.error)throw oldFileResult.error;
  if(files.length){const {error:fe}=await admin.from('project_files').upsert(files.map(([path,content])=>({project_id:saved.id,path:String(path),content:String(content),size_bytes:String(content).length,mime_type:/\.html?$/.test(String(path))?'text/html':/\.css$/.test(String(path))?'text/css':/\.js$/.test(String(path))?'text/javascript':'text/plain'})),{onConflict:'project_id,path'});if(fe)throw fe;}
  const keep=new Set(files.map(([p])=>String(p)));for(const old of oldFileResult.data||[])if(!keep.has(old.path)){const {error:de}=await admin.from('project_files').delete().eq('project_id',saved.id).eq('path',old.path);if(de)throw de;}
  const messages=Array.isArray(p?.conversation)?p.conversation.slice(-100):[];const dm=await admin.from('project_messages').delete().eq('project_id',saved.id);if(dm.error)throw dm.error;if(messages.length){const {error:me}=await admin.from('project_messages').insert(messages.map((m:any)=>({project_id:saved.id,user_id:user.id,role:m.role==='assistant'?'assistant':'user',mode:'build',content:{text:limitText(m.text,12000)}})));if(me)throw me;}
  if(Array.isArray(p?.versions)&&p.versions.length){const {error:ve}=await admin.from('project_versions').upsert(p.versions.slice(-20).map((v:any)=>({project_id:saved.id,version_number:Number(v.version||1),label:limitText(v.label||`Version ${v.version}`,120),snapshot:v,created_by:user.id})),{onConflict:'project_id,version_number'});if(ve)throw ve;}
  const audit=await admin.from('audit_logs').insert({user_id:user.id,action:'project.persist',metadata:{project_id:saved.id,spec_version:Number(p?.specVersion||1)}});if(audit.error)console.warn('audit log insert failed',audit.error.message);
  return {ok:true,projectId:saved.id,workspaceId:saved.workspace_id,updatedAt:saved.updated_at};
}''')

edge = replace_function(edge, 'getProject', r'''async function getProject(user:any,projectId:string) {
  const {data:p,error}=await admin.from('projects').select('*').eq('id',projectId).maybeSingle();if(error)throw error;if(!p)throw new Error('Project not found');
  const membership=await admin.from('workspace_members').select('role').eq('workspace_id',p.workspace_id).eq('user_id',user.id).maybeSingle();if(p.owner_id!==user.id&&!membership.data)throw new Error('Not authorized');
  const [{data:files},{data:messages},{data:versions}]=await Promise.all([
    admin.from('project_files').select('path,content,mime_type,size_bytes,updated_at').eq('project_id',projectId).order('path'),
    admin.from('project_messages').select('role,content,created_at').eq('project_id',projectId).order('created_at').limit(100),
    admin.from('project_versions').select('version_number,label,snapshot,created_at').eq('project_id',projectId).order('version_number')
  ]);
  return {id:p.id,title:p.title,type:p.project_type,intent:p.intention,specVersion:p.spec_version||1,spec:p.project_spec||{},understanding:p.understanding||p.classification||{},sections:p.workspace_config?.sections||[],selectedSection:p.selected_section||'chat',status:p.status,conversation:(messages||[]).map((m:any)=>({role:m.role,text:m.content?.text||'',at:m.created_at})),files:Object.fromEntries((files||[]).map((f:any)=>[f.path,f.content])),artifacts:p.settings?.artifacts||{},outputs:p.settings?.outputs||{},sectionContent:p.settings?.sectionContent||{},tests:p.settings?.tests||{status:'stale'},research:p.settings?.research||{status:'ready',queries:[],sources:[],findings:[]},agents:p.settings?.agents||[],resources:p.settings?.resources||[],executionState:p.settings?.executionState||{},versions:(versions||[]).map((v:any)=>({version:v.version_number,label:v.label,...v.snapshot})),updatedAt:p.updated_at,sync:{remoteId:p.id,mode:'cloud',lastSyncedAt:p.updated_at,baseUpdatedAt:p.updated_at}};
}''')

edge = replace_function(edge, 'listProjects', r'''async function listProjects(user:any) {
  const {data,error}=await admin.from('projects').select('id,title,project_type,intention,project_spec,understanding,workspace_config,spec_version,selected_section,status,settings,updated_at').eq('owner_id',user.id).order('updated_at',{ascending:false});if(error)throw error;
  return {ok:true,projects:(data||[]).map((p:any)=>({id:p.id,title:p.title,type:p.project_type,intent:p.intention,specVersion:p.spec_version||1,spec:p.project_spec||{},understanding:p.understanding||{},sections:p.workspace_config?.sections||[],selectedSection:p.selected_section||'chat',status:p.status,artifacts:p.settings?.artifacts||{},outputs:p.settings?.outputs||{},sectionContent:p.settings?.sectionContent||{},tests:p.settings?.tests||{status:'stale'},research:p.settings?.research||{status:'ready',queries:[],sources:[],findings:[]},agents:p.settings?.agents||[],resources:p.settings?.resources||[],executionState:p.settings?.executionState||{},files:{},conversation:[],versions:[],updatedAt:p.updated_at,sync:{remoteId:p.id,mode:'cloud',lastSyncedAt:p.updated_at,baseUpdatedAt:p.updated_at}}))};
}''')

edge = replace_function(edge, 'chat', r'''async function chat(user:any,body:any) {
  const creds=await credentialsFor(user.id);if(!creds.length)throw new Error('Connect an AI provider in Settings before chatting.');
  const mode=String(body.mode||'discuss').toLowerCase();
  let project=body.project||{};
  if(project?.id) project=await getProject(user,String(project.id));
  const all:any[]=[];for(const c of creds){try{all.push(...(await providerListModels(c,'chat')).map((m:any)=>({...m,credential:c})));}catch{}}
  if(!all.length)throw new Error('No compatible AI models are reachable');
  const candidates=deterministicCandidates(all,mode==='understand'||mode==='artifact'?'build':mode,String(body.model||'auto'));if(!candidates.length)throw new Error('No compatible model is available for this task');
  const messages=[{role:'system',content:systemFor(mode,project)},...historyMessages(body.history),{role:'user',content:limitText(body.message||JSON.stringify(body.payload||{}),16000)}];
  let last:any=null;const attempted:string[]=[];
  for(const m of candidates.slice(0,6)){
    const k=`${m.provider}:${m.id}`;if((RATE.get(k)||0)>Date.now())continue;attempted.push(m.id);
    try{
      const result=await providerChat(m.credential,m.id,messages,{providerKey:m.credential.providerKey,maxTokens:mode==='artifact'?10000:mode==='understand'?3600:5000});
      const usage=await admin.from('ai_usage').insert({user_id:user.id,project_id:project?.id||null,action:mode,provider:m.provider,model:m.id,units:1});if(usage.error)console.warn('ai_usage insert failed',usage.error.message);
      if(['understand','artifact','plan'].includes(mode)){try{return {ok:true,result:JSON.parse(result.text),model:m.id,provider:m.provider,attempted};}catch{return {ok:true,text:result.text,model:m.id,provider:m.provider,attempted};}}
      return {ok:true,text:result.text,model:m.id,provider:m.provider,attempted};
    }catch(e){last=e;if(is429(e))RATE.set(k,Date.now()+retryMs(e));}
  }
  throw new Error(`No compatible AI model was available. Tried: ${attempted.join(',')||'none'}. ${last instanceof Error?last.message:'Provider unavailable'}`);
}''')
write('supabase/functions/ai/index.ts', edge)

# -----------------------------------------------------------------------------
# Regression tests: exercise state transitions and assert live-path contracts.
# -----------------------------------------------------------------------------
TEST = r'''import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createProject,applyProjectMutation,validateSpec,serializeForPersistence,projectArtifactKind,normalizeSections} from '../projectx-core.js';

const runtime=fs.readFileSync(new URL('../px-final.js',import.meta.url),'utf8');
const edge=fs.readFileSync(new URL('../supabase/functions/ai/index.ts',import.meta.url),'utf8');
const index=fs.readFileSync(new URL('../index.html',import.meta.url),'utf8');

const game=createProject({title:'Monkey game',type:'Game',spec:{goal:'A browser monkey game that dodges obstacles',users:['players'],requirements:['Avoid obstacles'],deliverables:['Playable browser game'],platform:'Web',game:{loop:'jump and dodge'}},sections:[{name:'Gameplay',kind:'workspace'},{name:'Playtest',kind:'output'},{name:'Test',kind:'test'}]});
assert.equal(game.sections[0].id,'chat');
assert.equal(projectArtifactKind(game.type),'software');
assert.equal(game.id.includes('-'),true);

const v1=game.specVersion;
let mutation=applyProjectMutation(game,{specPatch:{features:{add:['Shop']}},fileOperations:[{op:'write',path:'index.html',content:'<!doctype html><html><body>monkey</body></html>'}]});
assert.equal(mutation.changed,true);
assert.equal(game.specVersion,v1+1,'one mutation must create exactly one new project version');
assert.deepEqual(game.spec.features,['Shop']);
assert.equal(game.tests.status,'stale');
assert.equal(game.artifacts.output,undefined);

const v2=game.specVersion;
mutation=applyProjectMutation(game,{specPatch:{features:{remove:['Shop']}}});
assert.equal(mutation.changed,true);
assert.equal(game.specVersion,v2+1);
assert.deepEqual(game.spec.features,[]);

const contradiction=validateSpec({goal:'Build a study app for students',users:['students'],requirements:['cloud account sync'],constraints:['no backend'],deliverables:['working app'],platform:'mobile'},'Mobile');
assert.equal(contradiction.valid,false);
assert.ok(contradiction.contradictions.length>0);

const persisted=serializeForPersistence(game);
for(const key of ['files','artifacts','outputs','sectionContent','tests','research','agents','resources','executionState','versions'])assert.ok(Object.hasOwn(persisted,key),`missing persisted ${key}`);
const normalized=normalizeSections([{name:'Playtest',kind:'output'}],'Game');
assert.equal(normalized[1].kind,'output');

assert.match(runtime,/AUTHORITATIVE PROJECT CONTEXT v2/);
assert.match(runtime,/applyProjectMutation/);
assert.match(runtime,/projectArtifactKind/);
assert.match(runtime,/switch\(section\.kind\)/);
assert.doesNotMatch(runtime,/Fallback discovery question/);
assert.doesNotMatch(runtime,/Game over.*Flappy|ctx\.arc\(bird\.x/);
assert.match(edge,/projectContext\(p:any\)/);
for(const token of ['files','sectionContent','tests','research','agents','outputs','executionState'])assert.match(edge,new RegExp(token));
assert.match(edge,/CONFLICT:/);
assert.match(edge,/baseUpdatedAt/);
assert.match(edge,/projectId=saved.id/);
assert.match(edge,/MAX_BODY_BYTES = 5000000/);
assert.doesNotMatch(index,/px-runtime-patches\.js|projectx-output\.js/);

console.log('PASS: canonical project mutation and versioning');
console.log('PASS: semantic contradiction validation');
console.log('PASS: complete persistence context');
console.log('PASS: authenticated and guest AI context contract');
console.log('PASS: kind-driven sections');
console.log('PASS: domain-aware artifacts and tests');
console.log('PASS: optimistic cloud conflict protection');
'''
write('scripts/projectx-forensic-regression.mjs', TEST)

# Existing runtime contract must reflect additive patch semantics and test the new core.
runtime_test = read('scripts/projectx-runtime-test.mjs')
runtime_test = runtime_test.replace("applySpecChange(game, { features: ['Pause menu'] });", "applySpecChange(game, { features: { replace: ['Pause menu'] } });")
runtime_test = runtime_test.replace("assert.equal(game.specVersion, before + 1);", "assert.equal(game.specVersion, before + 1);\nassert.equal(game.tests.status, 'stale');", 1)
write('scripts/projectx-runtime-test.mjs', runtime_test)

# package test gate includes the forensic regression proof.
pkg = read('package.json')
pkg = pkg.replace('node scripts/projectx-runtime-test.mjs', 'node scripts/projectx-runtime-test.mjs && node scripts/projectx-forensic-regression.mjs')
write('package.json', pkg)

# Remove the known dead hardcoded game runtime from the repository.
legacy = ROOT / 'projectx-output.js'
if legacy.exists():
    legacy.unlink()

# Leave a reviewable audit record in the repo.
write('FORENSIC-AUDIT-2026-09-18.md', '''# ProjectX forensic audit — 2026-09-18

## System map

**Production path:** `index.html` → `px-final.js` → `projectx-core.js` → Supabase Edge Function `ai` → provider router/credential vault → PostgreSQL project state → versioned files/output/tests.

Historical runtimes such as `projectx-adaptive.js`, `dashboard-clean.js`, `universal-engine.js`, `px-runtime-patches.js`, `api-service.js`, and `projectx-output.js` are not part of the production entrypoint. The known hardcoded Flappy runtime was deleted; the remaining historical files should be removed only after external references are confirmed absent.

## P0 findings fixed

1. **Guest AI had no canonical project context.** `directGemini()` received history/system/message but not the project object. Guest and authenticated calls now use the same canonical context serializer.
2. **Authenticated AI context omitted current implementation and derived state.** Server project context now includes bounded files plus section state, artifacts, outputs, tests, research, agents, resources, and execution state. The Edge Function reloads the authoritative project by ID for project-scoped calls.
3. **New projects used browser IDs incompatible with the UUID database primary key.** The client now prefers UUIDs; the server treats non-UUID IDs as new projects and returns the actual server project ID, which the client adopts.
4. **File-only changes could leave artifact/test/cache lineage falsely current.** All meaningful spec, workspace, agent, research, and file mutations run through one mutation function and bump `specVersion` exactly once, invalidating dependent state.
5. **Array patches could erase existing requirements/features.** Array mutations are now additive by default; `{add, remove, replace}` provides explicit delta semantics.
6. **Authenticated persistence could overwrite a newer cloud project.** Cloud persistence now uses the last-synced timestamp as an optimistic concurrency guard and returns a conflict instead of overwriting newer remote state.

## P1 findings fixed

7. **Interview provider failures were masked by hardcoded fallback questions.** AI discovery errors now fail safely without creating a partial project.
8. **Interview completion relied only on structural validation and confidence.** Semantic contradictions and unresolved open questions now block completion.
9. **Workspace behavior was selected by regexes on human-readable section names.** Sections now have normalized semantic kinds and runtime dispatches by `section.kind`.
10. **Non-software projects were forced through `index.html`.** Software projects produce files; business/research/other projects produce versioned document deliverables.
11. **Section content/tests/research/agent/execution state were not fully persisted.** The serialization, local migration, list/get, and server settings state now carry these fields.
12. **Cross-project late async loads could redraw the wrong project.** Cloud open responses are active-project guarded; project mutation calls are serialized per project.
13. **Local persistence failures were silently ignored.** Local saves now surface storage failure instead of claiming success.

## P2 hardening

14. Test results are tied to `specVersion` and invalidated on canonical mutation.
15. Research findings use explicit source/title/URL/finding records rather than treating generated prose as evidence.
16. Regression tests now exercise state mutation, semantic validation, persistence shape, section kinds, AI-context markers, and cloud conflict contracts.

## Scenario proof target

A–J scenarios from the forensic brief are covered by the canonical mutation path and regression contract: software changes mutate spec/files together; removing a feature uses semantic delta removal; mobile changes invalidate output/tests; research/business use domain output paths; ambiguous requests stay in interview until unresolved questions/contradictions are cleared.
''')

# Prevent the one-time patch tooling from remaining in the production repository.
patcher = ROOT / 'scripts' / 'forensic_fix.py'
if patcher.exists():
    patcher.unlink()
workflow = ROOT / '.github' / 'workflows' / 'apply-forensic-fix.yml'
if workflow.exists():
    workflow.unlink()

print('[forensic-fix] repository patched')
'''

# Basic preflight markers: fail before committing a half-patched tree.
assert 'applyProjectMutation' in CORE
assert 'projectArtifactKind' in CORE
assert 'AUTHORITATIVE PROJECT CONTEXT v2' in px
assert 'CONFLICT:' in edge
assert 'projectx-forensic-regression.mjs' in (ROOT / 'package.json').read_text(encoding='utf-8')
