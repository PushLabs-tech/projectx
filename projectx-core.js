export const CORE_VERSION = 3;

const PROJECT_TYPES = ['Game','Website','App','Mobile','Business','Business system','Research','Document','Presentation','Data','Dashboard','Internal tool','Agent','Automation','API','Creative project','Other'];
const SOFTWARE_TYPES = new Set(['Game','Website','App','Mobile','API','Agent','Automation','Business system','Data','Dashboard','Internal tool','Presentation']);
const ARRAY_FIELDS = ['users','requirements','constraints','features','decisions','dependencies','resources','assets','deliverables','acceptanceCriteria','successCriteria','openQuestions','technology'];
const SECTION_CAPABILITIES = {
  conversation:['conversation.write'],
  planning:['spec.read','spec.propose'],
  research:['evidence.read','evidence.record','sources.track'],
  workspace:['spec.read','spec.propose'],
  code:['files.read','files.write'],
  output:['artifact.build','artifact.preview'],
  test:['tests.run','tests.read'],
  publish:['output.export']
};
const SECTION_KIND_BY_NAME = {
  plan:'planning',planning:'planning',gameplay:'workspace',mechanics:'workspace',design:'workspace',question:'planning',work:'workspace',review:'workspace',
  research:'research',sources:'research',analysis:'research',findings:'research',code:'code',files:'code',assets:'code',
  test:'test',tests:'test',qa:'test',verify:'test',preview:'output',playtest:'output',output:'output',publish:'publish',launch:'publish',deploy:'publish',report:'publish'
};
const DEFAULT_AGENT_BY_KIND = {conversation:'interviewer',planning:'planner',research:'researcher',workspace:'planner',code:'builder',output:'builder',test:'tester',publish:'publisher'};
const arr = value => Array.isArray(value) ? value.map(v=>String(v ?? '').trim()).filter(Boolean) : [];
export function normalizeResource(value) {
  if (typeof value === 'string') return value.trim().slice(0,20000);
  const raw=value&&typeof value==='object'?value:{};
  const name=String(raw.name||raw.title||raw.url||'Resource').trim().slice(0,180);
  const type=String(raw.type||'note').trim().slice(0,60);
  const url=String(raw.url||'').trim().slice(0,2000);
  const content=String(raw.content||'').slice(0,20000);
  const size=Number(raw.size||content.length||0);
  return {id:safeId(raw.id||name),name,type,url,content,size};
}
export function normalizeResources(values=[]) {
  return Array.isArray(values) ? values.map(normalizeResource).filter(v => typeof v==='string' ? Boolean(v) : Boolean(v?.name||v?.url||v?.content)).slice(0,100) : [];
}

export const safeId = value => String(value ?? '').trim().toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'').slice(0,80) || `section-${Math.random().toString(36).slice(2,8)}`;
export const sanitizePath = value => {
  const path = String(value ?? '').replace(/\\/g,'/').replace(/^\/+/,'').trim();
  if (!path || path.includes('..') || path.includes('\0') || /^[a-z]+:\/\//i.test(path)) return null;
  const clean = path.split('/').filter(Boolean).join('/');
  return !clean || clean.length > 180 ? null : clean;
};
export const normalizeProjectType = value => {
  const raw = String(value || '').trim().toLowerCase();
  return PROJECT_TYPES.find(t => t.toLowerCase() === raw) || 'Other';
};
export const projectArtifactKind = type => SOFTWARE_TYPES.has(normalizeProjectType(type)) ? 'software' : 'document';
export const normalizeSectionKind = (name, kind) => {
  const explicit = String(kind || '').trim().toLowerCase();
  return SECTION_CAPABILITIES[explicit] ? explicit : SECTION_KIND_BY_NAME[String(name || '').trim().toLowerCase()] || 'workspace';
};

export function normalizeAgents(agents = [], type = 'Other') {
  const out = [], seen = new Set();
  const add = value => {
    const raw = typeof value === 'string' ? {key:value,name:value} : value || {};
    const key = String(raw.key || raw.id || raw.name || '').trim().toLowerCase().replace(/[^a-z0-9_-]+/g,'-').slice(0,60);
    if (!key || seen.has(key)) return;
    seen.add(key);
    out.push({id:safeId(raw.id || key),key,name:String(raw.name || key).slice(0,80),purpose:String(raw.purpose || `Own ${key} work for this project.`).slice(0,240),tools:Array.isArray(raw.tools)?raw.tools.map(String).slice(0,20):[],enabled:raw.enabled!==false,status:String(raw.status || 'ready').slice(0,30)});
  };
  (Array.isArray(agents) ? agents : []).forEach(add);
  if (!out.length) {
    add({key:'planner',name:'Planner',purpose:'Maintain the plan and canonical project decisions.'});
    if (projectArtifactKind(type) === 'software') add({key:'builder',name:'Builder',purpose:'Create and update the real implementation artifact.'});
    if (/research|business/i.test(String(type))) add({key:'researcher',name:'Researcher',purpose:'Work with evidence and source-backed project knowledge.'});
    add({key:'tester',name:'Tester',purpose:'Verify project outputs against acceptance criteria.'});
    add({key:'publisher',name:'Publisher',purpose:'Prepare verified outputs for delivery.'});
  }
  return out.slice(0,10);
}

export function emptySpec() {
  return {goal:'',users:[],requirements:[],constraints:[],features:[],decisions:[],dependencies:[],resources:[],assets:[],deliverables:[],acceptanceCriteria:[],successCriteria:[],openQuestions:[],platform:'',technology:[],visualDirection:'',currentState:'discovery',game:{kind:'',player:'',controls:'',loop:'',theme:'',progression:'',multiplayer:false}};
}
export function mergeSpec(base = emptySpec(), patch = {}) {
  const next = {...emptySpec(),...(base || {})};
  for (const field of ['goal','platform','visualDirection','currentState']) if (typeof patch[field] === 'string' && patch[field].trim()) next[field] = patch[field].trim();
  for (const field of ARRAY_FIELDS) {
    if (!(field in patch)) continue;
    if (field === 'resources') { next.resources = normalizeResources(patch.resources); continue; }
    if (Array.isArray(patch[field])) next[field] = [...new Set(arr(patch[field]))];
  }
  if (patch.game && typeof patch.game === 'object') next.game = {...next.game,...patch.game};
  next.resources = normalizeResources(next.resources);
  return next;
}
export function mergeSpecDelta(base = emptySpec(), patch = {}) {
  const next = mergeSpec(emptySpec(),base);
  for (const field of ['goal','platform','visualDirection','currentState']) if (typeof patch[field] === 'string') next[field] = patch[field].trim();
  for (const field of ARRAY_FIELDS) {
    if (!(field in patch)) continue;
    if (field === 'resources') {
      const value=patch.resources;
      if (value === null) { next.resources=[]; continue; }
      const current=normalizeResources(next.resources);
      const byId=new Map(current.map(v=>[typeof v==='string'?v:('id' in v?v.id:v.name),v]));
      if (Array.isArray(value)) value.forEach(v=>{const n=normalizeResource(v);const k=typeof n==='string'?n:n.id;if(k)byId.set(k,n);});
      else if (value && typeof value==='object') {
        const replacement=Array.isArray(value.replace)?value.replace:Array.isArray(value.set)?value.set:null;
        if(replacement){byId.clear();replacement.forEach(v=>{const n=normalizeResource(v);const k=typeof n==='string'?n:n.id;if(k)byId.set(k,n);});}
        if(Array.isArray(value.add)) value.add.forEach(v=>{const n=normalizeResource(v);const k=typeof n==='string'?n:n.id;if(k)byId.set(k,n);});
        if(Array.isArray(value.remove)){const remove=new Set(value.remove.map(v=>String(typeof v==='object'?(v.id||v.name):v)));for(const k of [...byId.keys()])if(remove.has(String(k)))byId.delete(k);}
      }
      next.resources=[...byId.values()].slice(-100);
      continue;
    }
    const value = patch[field];
    if (value === null) { next[field] = []; continue; }
    if (Array.isArray(value)) { next[field] = [...new Set([...next[field],...arr(value)])]; continue; }
    if (!value || typeof value !== 'object') continue;
    const replacement = Array.isArray(value.replace) ? value.replace : Array.isArray(value.set) ? value.set : null;
    if (replacement) next[field] = [...new Set(arr(replacement))];
    if (Array.isArray(value.add)) next[field] = [...new Set([...next[field],...arr(value.add)])];
    if (Array.isArray(value.remove)) {
      const remove = new Set(arr(value.remove).map(v => v.toLowerCase()));
      next[field] = next[field].filter(v => !remove.has(v.toLowerCase()));
    }
  }
  if (patch.game && typeof patch.game === 'object') next.game = {...next.game,...patch.game};
  return next;
}
export function detectSpecContradictions(spec = {}, projectType = 'Other') {
  const constraints = arr(spec.constraints).join(' '), requirements = arr(spec.requirements).join(' '), all = [constraints,requirements,arr(spec.assets).join(' '),String(spec.visualDirection||''),...arr(spec.decisions)].join(' ').toLowerCase();
  const has = (rx,text) => rx.test(String(text).toLowerCase());
  const contradictions = [];
  if (has(/(?:no|without|avoid)\s+(?:a\s+)?backend/,constraints) && has(/cloud|server|database|realtime|account\s+(?:sync|storage)|remote\s+data/,requirements)) contradictions.push('The project forbids a backend/server layer but also requires cloud, server, database, realtime, or synced-account behaviour.');
  if (has(/(?:no|without|avoid)\s+(?:any\s+)?graphics?|text\s*[- ]?only/,constraints) && has(/graphic|image|illustration|sprite|animation|visual asset/,all)) contradictions.push('The project forbids graphics/visual assets but also requires graphics, images, illustrations, sprites, or visual animation.');
  if (has(/(?:no|without|avoid)\s+(?:user\s+)?login|no authentication|no accounts/,constraints) && has(/login|sign[ -]?in|authentication|user accounts|account creation/,requirements)) contradictions.push('The project forbids authentication/accounts but also requires login, sign-in, or user accounts.');
  if (has(/offline[- ]only|must work offline/,constraints) && has(/cloud|online[- ]only|realtime|server-side|remote/,requirements)) contradictions.push('The project is constrained to offline use but also requires cloud/online/server behaviour.');
  const type = normalizeProjectType(projectType), platform = String(spec.platform || '').toLowerCase();
  if (type === 'Mobile' && /desktop|web-only/.test(platform)) contradictions.push('The project is classified as Mobile but its platform constraint says desktop/web-only.');
  if (type === 'Website' && /mobile app|ios|android/.test(platform)) contradictions.push('The project is classified as Website but its platform constraint describes a native mobile application.');
  return [...new Set(contradictions)];
}
export function validateSpec(spec = {}, projectType = 'Other') {
  const s = mergeSpec(emptySpec(),spec), missing = [];
  if (s.goal.length < 12) missing.push('goal');
  if (!s.deliverables.length) missing.push('deliverables');
  const software = projectArtifactKind(projectType) === 'software';
  if (software && !s.requirements.length) missing.push('requirements');
  if (software && !s.platform) missing.push('platform');
  if (/^Game$/i.test(projectType) && !s.game.loop) missing.push('game.loop');
  const contradictions = detectSpecContradictions(s,projectType), ambiguities = Array.isArray(s.openQuestions) ? s.openQuestions : [];
  return {valid:missing.length === 0 && contradictions.length === 0,missing:[...new Set(missing)],contradictions,ambiguities,needsClarification:contradictions.length>0 || ambiguities.length>0};
}

export function buildDependencyMap(sections = []) {
  const ids = new Set(sections.map(s => s.id));
  return sections.map(s => ({...s,dependsOn:(s.dependsOn || []).filter(id => ids.has(id))}));
}

export function normalizeSections(sections = [], type = 'Other') {
  const input = Array.isArray(sections) ? sections : [], out = [], seen = new Set();
  const add = value => {
    const raw = typeof value === 'string' ? {name:value} : value || {}, name = String(raw.name || raw.title || '').trim();
    if (!name || /^chat$/i.test(name)) return;
    const id = safeId(raw.id || name);
    if (seen.has(id)) return;
    seen.add(id);
    const kind = normalizeSectionKind(name,raw.kind);
    out.push({id,name:name.slice(0,60),purpose:String(raw.purpose || `Work on ${name}.`).slice(0,220),dependsOn:Array.isArray(raw.dependsOn)?raw.dependsOn.map(safeId).filter(Boolean).slice(0,8):[],kind,agent:String(raw.agent || raw.agentKey || DEFAULT_AGENT_BY_KIND[kind] || 'planner').slice(0,60),capabilities:Array.isArray(raw.capabilities)?raw.capabilities.map(String).slice(0,20):SECTION_CAPABILITIES[kind],artifactTypes:Array.isArray(raw.artifactTypes)?raw.artifactTypes.map(String).slice(0,10):(kind === 'output' ? ['software','document'] : [])});
  };
  input.forEach(add);
  return [{id:'chat',name:'Chat',purpose:'The project conversation and change interface.',dependsOn:[],kind:'conversation',agent:'interviewer',capabilities:SECTION_CAPABILITIES.conversation,artifactTypes:[]},...out].slice(0,12);
}

export function invalidateArtifacts(project) {
  project.artifacts = project.artifacts || {};
  for (const artifact of Object.values(project.artifacts)) if (artifact) artifact.stale = Number(artifact.specVersion || 0) !== Number(project.specVersion);
  project.outputs = project.outputs || {};
  for (const output of Object.values(project.outputs)) if (output) output.stale = Number(output.specVersion || 0) !== Number(project.specVersion);
}

export function applyProjectMutation(project, mutation = {}) {
  project.files = project.files || {};
  project.agents = normalizeAgents(project.agents || [], project.type);
  const before = JSON.stringify({title:project.title,type:project.type,spec:project.spec,sections:project.sections,files:project.files,agents:project.agents,research:project.research || {}});
  const beforeSpec = JSON.stringify(project.spec || {});
  const beforeType = project.type;
  const beforeTitle = project.title;
  let researchChanged = false;
  if (typeof mutation.projectType === 'string' && mutation.projectType.trim()) project.type = normalizeProjectType(mutation.projectType);
  if (typeof mutation.projectTitle === 'string' && mutation.projectTitle.trim()) project.title = mutation.projectTitle.trim().slice(0,120);
  if (mutation.specPatch && typeof mutation.specPatch === 'object') project.spec = mergeSpecDelta(project.spec,mutation.specPatch);
  if (Array.isArray(mutation.workspaceSections) && mutation.workspaceSections.length) {
    const next = buildDependencyMap(normalizeSections(mutation.workspaceSections,project.type));
    if (JSON.stringify(next) !== JSON.stringify(project.sections)) project.sections = next;
  }
  if (Array.isArray(mutation.agents)) project.agents = normalizeAgents(mutation.agents,project.type);
  if (Array.isArray(mutation.fileOperations)) for (const op of mutation.fileOperations.slice(0,160)) {
    const path = sanitizePath(op?.path); if (!path) continue;
    if (op.op === 'write' && typeof op.content === 'string' && op.content.length <= 600000 && project.files[path] !== op.content) project.files[path] = op.content;
    if (op.op === 'delete' && Object.prototype.hasOwnProperty.call(project.files,path)) delete project.files[path];
  }
  if (mutation.projectType || mutation.projectTitle) project.agents = normalizeAgents(project.agents || [], project.type);
  if (mutation.researchPatch && typeof mutation.researchPatch === 'object') {
    const research = project.research || {status:'ready',queries:[],sources:[],findings:[]};
    const patch = mutation.researchPatch;
    const query = String(patch.query || '').trim().slice(0,500);
    if (query && !research.queries.includes(query)) { research.queries = [...research.queries,query].slice(-50); researchChanged = true; }
    const addSources = Array.isArray(patch.addSources) ? patch.addSources : [];
    if (addSources.length) {
      const current = Array.isArray(research.sources) ? research.sources : [];
      const seen = new Set(current.map(s => String(s?.url || s?.source_url || '')));
      research.sources = [...current,...addSources.filter(s => {
        const url = String(s?.url || s?.source_url || '').trim();
        if (!url || seen.has(url)) return false;
        seen.add(url); return true;
      })].slice(-100);
      researchChanged = true;
    }
    const addFindings = Array.isArray(patch.addFindings) ? patch.addFindings : [];
    if (addFindings.length) { research.findings = [...(research.findings || []),...addFindings].slice(-100); researchChanged = true; }
    research.status = researchChanged ? 'ready' : (research.status || 'ready');
    project.research = research;
  }
  project.resources = Array.isArray(project.spec?.resources) ? [...project.spec.resources] : [];
  const after = JSON.stringify({title:project.title,type:project.type,spec:project.spec,sections:project.sections,files:project.files,agents:project.agents,research:project.research || {}});
  const changed = before !== after, specChanged = beforeSpec !== JSON.stringify(project.spec || {}), typeChanged = beforeType !== project.type, titleChanged = beforeTitle !== project.title;
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
  return {changed,specChanged,typeChanged,titleChanged,researchChanged};
}
export function restoreProjectSnapshot(project, snapshot = {}) {
  if (!project || !snapshot || typeof snapshot !== 'object') return {changed:false};
  const nextSpec = mergeSpec(emptySpec(), snapshot.spec || {});
  const nextFiles = snapshot.files && typeof snapshot.files === 'object' ? Object.fromEntries(Object.entries(snapshot.files).filter(([p,v]) => sanitizePath(p) && typeof v === 'string')) : {};
  const nextType = normalizeProjectType(snapshot.type || project.type);
  const nextTitle = String(snapshot.title || project.title || 'Untitled project').trim().slice(0,120);
  const changed = JSON.stringify(project.spec) !== JSON.stringify(nextSpec) || JSON.stringify(project.files || {}) !== JSON.stringify(nextFiles) || project.type !== nextType || project.title !== nextTitle;
  if (!changed) return {changed:false};
  project.spec = nextSpec;
  project.files = nextFiles;
  project.type = nextType;
  project.title = nextTitle;
  if (Array.isArray(snapshot.sections) && snapshot.sections.length) project.sections = buildDependencyMap(normalizeSections(snapshot.sections, nextType));
  if (snapshot.understanding && typeof snapshot.understanding === 'object') project.understanding = JSON.parse(JSON.stringify(snapshot.understanding));
  if (snapshot.research && typeof snapshot.research === 'object') project.research = JSON.parse(JSON.stringify(snapshot.research));
  project.specVersion = Number(project.specVersion || 1) + 1;
  project.updatedAt = new Date().toISOString();
  invalidateArtifacts(project);
  project.sectionContent = {};
  project.tests = {status:'stale',specVersion:project.specVersion,results:[],updatedAt:null};
  project.research = {...(project.research || {status:'ready',queries:[],sources:[],findings:[]}),status:(project.research?.findings?.length?'ready':'stale')};
  project.executionState = {...(project.executionState || {}),status:'dirty',lastMutationId:globalThis.crypto?.randomUUID?.() || `restore-${Date.now()}-${Math.random().toString(36).slice(2,8)}`,staleFromVersion:project.specVersion};
  return {changed:true};
}
export function applySpecChange(project,patch = {}) { return applyProjectMutation(project,{specPatch:patch}); }

export function createProject({id,title,type='Other',intent='',spec={},sections=[],conversation=[],agents=[],research={}} = {}) {
  const normalizedType = normalizeProjectType(type), projectId = id || globalThis.crypto?.randomUUID?.() || `px-${Date.now()}-${Math.random().toString(36).slice(2,8)}`, normalizedSpec = mergeSpec(emptySpec(),spec);
  return {id:projectId,title:String(title || 'Untitled project').trim().slice(0,120),type:normalizedType,intent:String(intent || normalizedSpec.goal || '').trim(),createdAt:new Date().toISOString(),updatedAt:new Date().toISOString(),specVersion:1,understanding:{confidence:0,missing:[],ambiguities:[],method:'pending'},spec:normalizedSpec,sections:buildDependencyMap(normalizeSections(sections,normalizedType)),selectedSection:'chat',conversation:Array.isArray(conversation)?conversation:[],sectionContent:{},artifacts:{},outputs:{},tests:{status:'stale',specVersion:0,results:[],updatedAt:null},research:{status:'ready',queries:Array.isArray(research.queries)?research.queries:[],sources:Array.isArray(research.sources)?research.sources:[],findings:Array.isArray(research.findings)?research.findings:[]},resources:Array.isArray(normalizedSpec.resources)?[...normalizedSpec.resources]:[],agents:normalizeAgents(agents,normalizedType),executionState:{status:'ready',lastMutationId:null,lastAgent:null,staleFromVersion:null},files:{},versions:[],status:'discovery',sync:{remoteId:null,lastSyncedAt:null,baseUpdatedAt:null,mode:'local'}};
}

export function assemblePreviewHtml(files = {}) {
  const safeFiles = Object.fromEntries(Object.entries(files).map(([path,content]) => [sanitizePath(path),String(content ?? '')]).filter(([path]) => path));
  let html = safeFiles['index.html'] || safeFiles['src/index.html'];
  if (!html) { const first = Object.keys(safeFiles).find(p => /\.html?$/i.test(p)); html = first ? safeFiles[first] : '<!doctype html><html><body><div id="app"></div></body></html>'; }
  html = String(html);
  html = html.replace(/<link[^>]+href=["']([^"']+)["'][^>]*>/gi,(tag,href) => { const path = sanitizePath(href.replace(/^\.\//,'')); const css = path && safeFiles[path]; return css != null ? `<style data-projectx-file="${path}">${css}</style>` : tag; });
  html = html.replace(/<script[^>]+src=["']([^"']+)["'][^>]*><\/script>/gi,(tag,src) => { const path = sanitizePath(src.replace(/^\.\//,'')); const js = path && safeFiles[path]; return js != null ? `<script data-projectx-file="${path}">${js.replace(/<\/script/gi,'<\\/script')}</script>` : tag; });
  if (!/<meta[^>]+name=["']viewport["']/i.test(html)) html = html.replace(/<head>/i,'<head><meta name="viewport" content="width=device-width,initial-scale=1">');
  const guard = `<script>(function(){window.addEventListener('error',function(e){parent.postMessage({type:'PROJECTX_RUNTIME_ERROR',message:String(e.message||'Runtime error')},'*')});window.addEventListener('unhandledrejection',function(e){parent.postMessage({type:'PROJECTX_RUNTIME_ERROR',message:String(e.reason?.message||e.reason||'Unhandled rejection')},'*')})();<\/script>`;
  return html.replace(/<head>/i,`<head>${guard}`);
}

export function serializeForPersistence(project) {
  return {schemaVersion:3,id:project.id,title:project.title,type:project.type,intention:project.intent,specVersion:project.specVersion,spec:project.spec,understanding:project.understanding,workspace:{sections:project.sections},selectedSection:project.selectedSection,status:project.status,conversation:(project.conversation || []).slice(-100),files:project.files || {},artifacts:project.artifacts || {},outputs:project.outputs || {},sectionContent:project.sectionContent || {},tests:project.tests || {status:'stale'},research:project.research || {status:'ready',queries:[],sources:[],findings:[]},agents:project.agents || [],resources:project.resources || [],executionState:project.executionState || {},versions:project.versions || [],sync:{remoteId:project.sync?.remoteId || null,lastSyncedAt:project.sync?.lastSyncedAt || null,baseUpdatedAt:project.sync?.baseUpdatedAt || null,mode:project.sync?.mode || 'local'},updatedAt:project.updatedAt};
}

export function migrateProject(raw = {}) {
  const p = createProject({id:raw.id,title:raw.title,type:raw.type || raw.project_type || 'Other',intent:raw.intent || raw.intention || raw.goal || '',spec:raw.spec || raw.projectSpec || {},sections:raw.sections || raw.workspace?.sections || [],conversation:raw.conversation || raw.messages || [],agents:raw.agents || raw.settings?.agents || [],research:raw.research || raw.settings?.research || {}});
  p.createdAt = raw.createdAt || raw.created_at || p.createdAt; p.updatedAt = raw.updatedAt || raw.updated_at || p.updatedAt; p.specVersion = Number(raw.specVersion || raw.spec_version || 1); p.understanding = raw.understanding || p.understanding; p.category = raw.category || p.understanding?.category || p.category || ''; p.artifacts = raw.artifacts || raw.settings?.artifacts || {}; p.outputs = raw.outputs || raw.settings?.outputs || {}; p.sectionContent = raw.sectionContent || raw.settings?.sectionContent || {}; p.tests = raw.tests || raw.settings?.tests || p.tests; p.research = raw.research || raw.settings?.research || p.research; p.agents = normalizeAgents(raw.agents || raw.settings?.agents || p.agents,p.type); p.resources = Array.isArray(raw.resources)?raw.resources:(Array.isArray(raw.spec?.resources)?raw.spec.resources:[]); p.executionState = raw.executionState || raw.settings?.executionState || p.executionState; p.files = raw.files || {}; p.versions = Array.isArray(raw.versions)?raw.versions:[]; p.status = raw.status || 'draft'; p.selectedSection = raw.selectedSection || raw.selected_section || 'chat'; p.sections = buildDependencyMap(normalizeSections(raw.sections || raw.workspace?.sections || [],p.type)); p.sync = {...p.sync,...(raw.sync || {}),remoteId:raw.sync?.remoteId || raw.id || p.sync.remoteId,lastSyncedAt:raw.sync?.lastSyncedAt || raw.updatedAt || raw.updated_at || p.sync.lastSyncedAt,baseUpdatedAt:raw.sync?.baseUpdatedAt || raw.updatedAt || raw.updated_at || p.sync.baseUpdatedAt,mode:raw.sync?.mode || 'cloud'}; return p;
}
