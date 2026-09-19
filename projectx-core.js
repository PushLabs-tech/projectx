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
const BRAIN_MUTATION_OPS = new Set(['add','replace','remove','mark_uncertain']);
const BRAIN_MUTATION_PATHS = new Map([
  ['identity.title','identity'],
  ['identity.type','identity'],
  ['context.intent','context'],
  ['context.resources','context'],
  ['context.discoveryAnswers','context'],
  ['classification.work_shape','classification'],
  ['classification.domains','classification'],
  ['classification.outputs','classification'],
  ['classification.execution_mode','classification'],
  ['classification.risk_level','classification'],
  ['classification.confidence','classification'],
  ['classification.provenance','classification'],
  ['classification.group','classification'],
  ['classification.label','classification'],
  ['classification.reason','classification'],
  ['requirements.requirements','requirements'],
  ['requirements.constraints','requirements'],
  ['requirements.assumptions','requirements'],
  ['requirements.decisions','requirements'],
  ['requirements.openQuestions','requirements'],
  ['requirements.dependencies','requirements'],
  ['requirements.deliverables','requirements'],
  ['requirements.acceptanceCriteria','requirements'],
  ['requirements.successCriteria','requirements'],
  ['workspace.sections','workspace'],
  ['execution.state','execution'],
  ['execution.status','execution'],
  ['plan','plan']
]);
const arr = value => Array.isArray(value) ? value.map(v=>String(v ?? '').trim()).filter(Boolean) : [];
const clone = value => JSON.parse(JSON.stringify(value ?? null));
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
  const before = JSON.stringify({title:project.title,type:project.type,status:project.status,plan:project.plan||[],spec:project.spec,understanding:project.understanding || {},sections:project.sections,files:project.files,agents:project.agents,research:project.research || {},executionState:project.executionState || {}});
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
  if (mutation.plan && Array.isArray(mutation.plan)) {
    project.plan = mutation.plan.slice(0,50).map(item => typeof item === 'string' ? {title:item,status:'proposed',steps:[]} : item).filter(Boolean);
  }
  if (mutation.projectType || mutation.projectTitle || mutation.plan) project.agents = normalizeAgents(project.agents || [], project.type);
  if (mutation.understandingPatch && typeof mutation.understandingPatch === 'object') project.understanding = {...(project.understanding || {}),...mutation.understandingPatch};
  if (typeof mutation.status === 'string' && mutation.status.trim()) project.status = mutation.status.trim().slice(0,60);
  if (mutation.executionStatePatch && typeof mutation.executionStatePatch === 'object') project.executionState = {...(project.executionState || {}),...mutation.executionStatePatch};
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
  if (typeof project.spec?.goal === 'string' && project.spec.goal.trim()) project.intent = project.spec.goal.trim();
  const after = JSON.stringify({title:project.title,type:project.type,status:project.status,plan:project.plan||[],spec:project.spec,understanding:project.understanding || {},sections:project.sections,files:project.files,agents:project.agents,research:project.research || {},executionState:project.executionState || {}});
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

function appendMutationAudit(project, entry) {
  const execution = project.executionState || {};
  const current = Array.isArray(execution.mutationAudit) ? execution.mutationAudit : [];
  project.executionState = {...execution,mutationAudit:[...current,{...entry,at:new Date().toISOString()}].slice(-80)};
}

const BRAIN_ARRAY_FIELD = {
  'requirements.requirements':'requirements',
  'requirements.constraints':'constraints',
  'requirements.assumptions':'openQuestions',
  'requirements.decisions':'decisions',
  'requirements.openQuestions':'openQuestions',
  'requirements.dependencies':'dependencies',
  'requirements.deliverables':'deliverables',
  'requirements.acceptanceCriteria':'acceptanceCriteria',
  'requirements.successCriteria':'successCriteria'
};

export function applyBrainMutation(project, mutation = {}, actor = {}) {
  const role = String(actor.role || 'viewer').toLowerCase();
  if (!['owner','admin','editor'].includes(role)) {
    const rejected = {kind:'rejected',reason:'forbidden',role,mutationId:String(mutation?.id || '')};
    appendMutationAudit(project, rejected);
    return {applied:false,reason:'forbidden',rejected:[rejected],stale:false};
  }
  const baseVersion = Number(mutation?.baseVersion);
  const currentVersion = Number(project?.specVersion || 1);
  if (!Number.isFinite(baseVersion) || baseVersion !== currentVersion) {
    const stale = {kind:'stale',reason:'base_version_mismatch',baseVersion,currentVersion,mutationId:String(mutation?.id || '')};
    appendMutationAudit(project, stale);
    return {applied:false,reason:'stale',rejected:[],stale:true,currentVersion};
  }
  const operations = Array.isArray(mutation?.operations) ? mutation.operations.slice(0,80) : [];
  const payloadSize = JSON.stringify(mutation || {}).length;
  if (!operations.length || payloadSize > 120000) {
    const rejected = {kind:'rejected',reason:operations.length ? 'payload_too_large' : 'missing_operations',payloadSize,mutationId:String(mutation?.id || '')};
    appendMutationAudit(project, rejected);
    return {applied:false,reason:rejected.reason,rejected:[rejected],stale:false};
  }
  const provenanceInput = mutation?.provenance && typeof mutation.provenance === 'object' ? mutation.provenance : {};
  const provenance = {
    source:['user','import','agent','system','verification'].includes(String(provenanceInput.source || '').toLowerCase()) ? String(provenanceInput.source).toLowerCase() : 'agent',
    sourceId:String(provenanceInput.sourceId || '').slice(0,120) || null,
    capturedAt:typeof provenanceInput.capturedAt === 'string' ? provenanceInput.capturedAt : new Date().toISOString(),
    confidence:Math.max(0, Math.min(1, Number(provenanceInput.confidence ?? 0.7) || 0.7)),
    userConfirmed:Boolean(provenanceInput.userConfirmed)
  };
  const patch = {};
  const understandingPatch = {};
  const executionUncertainties = [];
  const rejected = [];
  let projectType;
  let projectTitle;
  let workspaceSections;
  let status;
  for (const opRaw of operations) {
    const op = opRaw && typeof opRaw === 'object' ? opRaw : {};
    const kind = String(op.op || '').trim();
    const path = String(op.path || '').trim();
    const actionClass = BRAIN_MUTATION_PATHS.get(path);
    if (!BRAIN_MUTATION_OPS.has(kind) || !actionClass) { rejected.push({reason:'invalid_operation',op:kind,path}); continue; }
    const allowedClasses = Array.isArray(actor.allowedClasses) ? new Set(actor.allowedClasses.map(v => String(v))) : null;
    if (allowedClasses && !allowedClasses.has(actionClass)) { rejected.push({reason:'action_class_forbidden',op:kind,path,actionClass}); continue; }
    if (kind === 'mark_uncertain') {
      executionUncertainties.push({path,value:clone(op.value),reason:String(op.reason || 'Marked uncertain by mutation boundary.').slice(0,240),provenance});
      continue;
    }
    if (path === 'identity.title') { projectTitle = String(op.value || '').trim().slice(0,120); continue; }
    if (path === 'identity.type') { projectType = normalizeProjectType(op.value); continue; }
    if (path === 'context.intent') { patch.goal = String(op.value || '').trim().slice(0,5000); continue; }
    if (path === 'context.resources') { patch.resources = kind === 'remove' ? {remove:Array.isArray(op.value)?op.value:[op.value]} : (kind === 'add' ? {add:Array.isArray(op.value)?op.value:[op.value]} : {replace:Array.isArray(op.value)?op.value:[]}); continue; }
    if (path === 'context.discoveryAnswers') {
      const existing = Array.isArray(project?.understanding?.discoveryAnswers) ? project.understanding.discoveryAnswers : [];
      understandingPatch.discoveryAnswers = kind === 'remove' ? [] : kind === 'add' ? [...new Set([...existing,...(Array.isArray(op.value)?op.value:[op.value]).map(v=>String(v||'').trim()).filter(Boolean)])].slice(-100) : (Array.isArray(op.value)?op.value.map(v=>String(v||'').trim()).filter(Boolean):[String(op.value||'').trim()].filter(Boolean));
      continue;
    }
    if (path.startsWith('classification.')) {
      const key = path.split('.').slice(1).join('.');
      const value = clone(op.value);
      understandingPatch.classification = {...(understandingPatch.classification || {})};
      if (kind === 'remove') delete understandingPatch.classification[key];
      else understandingPatch.classification[key] = Array.isArray(value) ? value.slice(0,20) : (value && typeof value === 'object' ? value : String(value ?? '').slice(0,400));
      continue;
    }
    if (path in BRAIN_ARRAY_FIELD) {
      const field = BRAIN_ARRAY_FIELD[path];
      if (kind === 'replace') patch[field] = {replace:Array.isArray(op.value) ? op.value : [op.value]};
      if (kind === 'add') patch[field] = {...(patch[field] || {}),add:[...((patch[field] || {}).add || []),...(Array.isArray(op.value) ? op.value : [op.value])]};
      if (kind === 'remove') patch[field] = {...(patch[field] || {}),remove:[...((patch[field] || {}).remove || []),...(Array.isArray(op.value) ? op.value : [op.value])]};
      continue;
    }
    if (path === 'plan') {
      if (kind === 'remove') patch.plan = [];
      else patch.plan = Array.isArray(op.value) ? op.value.slice(0,80) : [];
      continue;
    }
    if (path === 'workspace.sections') { workspaceSections = Array.isArray(op.value) ? op.value : []; continue; }
    if (path === 'execution.state' || path === 'execution.status') { status = String(op.value || '').trim().slice(0,60) || status; continue; }
  }
  if (rejected.length) {
    rejected.forEach(item => appendMutationAudit(project, {kind:'rejected',...item,mutationId:String(mutation?.id || '')}));
    if (!Object.keys(patch).length && !Object.keys(understandingPatch).length && !executionUncertainties.length && !workspaceSections && !status && !projectType && !projectTitle) {
      return {applied:false,reason:'rejected',rejected,stale:false};
    }
  }
  const mutationId = String(mutation?.id || `brain-${Date.now()}-${Math.random().toString(36).slice(2,8)}`);
  const boundaryMutation = {
    projectType,
    projectTitle,
    specPatch:patch,
    workspaceSections,
    understandingPatch:{
      ...understandingPatch,
      provenance:{...(project.understanding?.provenance || {}),lastMutation:{id:mutationId,...provenance}}
    },
    status,
    executionStatePatch:executionUncertainties.length ? {uncertainties:[...(Array.isArray(project.executionState?.uncertainties) ? project.executionState.uncertainties : []),...executionUncertainties].slice(-80)} : {}
  };
  const outcome = applyProjectMutation(project, boundaryMutation);
  if (!outcome.changed) {
    appendMutationAudit(project, {kind:'rejected',reason:'no_effective_change',mutationId,provenance});
    return {applied:false,reason:'no_effective_change',rejected,stale:false};
  }
  appendMutationAudit(project, {kind:'applied',mutationId,baseVersion,version:project.specVersion,operations:operations.length,rejected:rejected.length,provenance});
  return {applied:true,mutationId,newVersion:project.specVersion,rejected,stale:false,outcome};
}

export function createProjectFromIntent(intent = {}, options = {}) {
  const spec = mergeSpec(emptySpec(), {
    goal:String(intent.goal || intent.intent || '').trim(),
    users:intent.users,
    requirements:intent.requirements,
    constraints:intent.constraints,
    deliverables:intent.deliverables,
    acceptanceCriteria:intent.acceptanceCriteria,
    successCriteria:intent.successCriteria,
    openQuestions:intent.openQuestions,
    platform:intent.platform
  });
  return createProject({title:intent.title || options.title || 'Untitled project',type:intent.type || options.type || 'Other',intent:spec.goal,spec,sections:Array.isArray(intent.sections)?intent.sections:[],agents:Array.isArray(intent.agents)?intent.agents:[]});
}

export function generateDiscoveryPoll(decision = '', options = [], customOption = 'Describe in your own words') {
  const selected = [...new Set((Array.isArray(options) ? options : []).map(v => String(v || '').trim()).filter(Boolean))].slice(0,4);
  return {decision:String(decision || '').trim(),options:selected,customOption:String(customOption || 'Describe in your own words')};
}

export function createPlan(project, plan = []) {
  return applyProjectMutation(project, { plan: Array.isArray(plan) ? plan : [] });
}

export function startAgentRun(project, run = {}) {
  const id = String(run.id || `run-${Date.now()}-${Math.random().toString(36).slice(2,8)}`);
  const runs = Array.isArray(project.executionState?.runs) ? project.executionState.runs : [];
  const entry = {id,agent:String(run.agent || 'planner').slice(0,60),status:'in_progress',startedAt:new Date().toISOString(),task:String(run.task || '').slice(0,240),requiresApproval:Boolean(run.requiresApproval)};
  applyProjectMutation(project, { executionStatePatch:{runs:[...runs,entry].slice(-30),status:'in_progress',lastAgent:entry.agent,pendingApproval:entry.requiresApproval ? {runId:id,action:String(run.approvalAction || 'review').slice(0,80)} : null} });
  return entry;
}

export function approveAction(project, approval = {}) {
  const pending = project.executionState?.pendingApproval;
  if (!pending) return {approved:false,reason:'no_pending_approval'};
  if (approval.runId && approval.runId !== pending.runId) return {approved:false,reason:'approval_mismatch'};
  const approver = String(approval.approver || 'human-reviewer').slice(0,120);
  applyProjectMutation(project, { executionStatePatch:{pendingApproval:null,lastApproval:{runId:pending.runId,action:pending.action,approver,approvedAt:new Date().toISOString()}} });
  return {approved:true,runId:pending.runId};
}

export function createArtifactVersion(project, artifact = {}) {
  const key = String(artifact.key || 'primary').trim() || 'primary';
  const current = project.artifacts || {};
  const entry = {kind:String(artifact.kind || projectArtifactKind(project.type)).slice(0,40),specVersion:Number(project.specVersion || 1),summary:String(artifact.summary || '').slice(0,500),deliverables:Array.isArray(artifact.deliverables)?artifact.deliverables.slice(0,30):[],stale:false,updatedAt:new Date().toISOString(),verification:{status:'not_checked'}};
  applyProjectMutation(project, { executionStatePatch:{status:'artifact_updated'} });
  project.artifacts = {...current,[key]:entry};
  return entry;
}

export function runVerification(project, checks = []) {
  const normalized = (Array.isArray(checks) ? checks : []).map(check => ({name:String(check?.name || 'Unnamed check').slice(0,120),status:['passed','not_checked','blocked','human_review'].includes(String(check?.status || 'not_checked')) ? String(check.status) : 'not_checked',evidence:String(check?.evidence || '').slice(0,500),requiredHumanReview:Boolean(check?.requiredHumanReview)}));
  const hasBlocker = normalized.some(check => check.status === 'blocked');
  const passed = normalized.length > 0 && normalized.every(check => check.status === 'passed');
  const status = hasBlocker ? 'blocked' : passed ? 'passed' : normalized.some(check => check.status === 'human_review' || check.requiredHumanReview) ? 'human_review' : 'not_checked';
  project.tests = {specVersion:project.specVersion,results:normalized,updatedAt:new Date().toISOString(),status};
  project.status = status === 'passed' ? 'verified' : status;
  return project.tests;
}

export function getUsageSummary(project) {
  const conversation = Array.isArray(project.conversation) ? project.conversation.length : 0;
  const files = Object.keys(project.files || {}).length;
  const findings = Array.isArray(project.research?.findings) ? project.research.findings.length : 0;
  const deliverables = Array.isArray(project.spec?.deliverables) ? project.spec.deliverables.length : 0;
  const runs = Array.isArray(project.executionState?.runs) ? project.executionState.runs.length : 0;
  return {projectId:project.id,specVersion:Number(project.specVersion || 1),conversation,files,findings,deliverables,runs,status:String(project.status || 'draft')};
}

export function createProject({id,title,type='Other',intent='',spec={},sections=[],conversation=[],agents=[],research={},plan=[]} = {}) {
  const normalizedType = normalizeProjectType(type), projectId = id || globalThis.crypto?.randomUUID?.() || `px-${Date.now()}-${Math.random().toString(36).slice(2,8)}`, normalizedSpec = mergeSpec(emptySpec(),spec);
  return {id:projectId,title:String(title || 'Untitled project').trim().slice(0,120),type:normalizedType,intent:String(intent || normalizedSpec.goal || '').trim(),createdAt:new Date().toISOString(),updatedAt:new Date().toISOString(),specVersion:1,understanding:{confidence:0,missing:[],ambiguities:[],method:'pending'},plan:Array.isArray(plan)?plan.slice(0,50):[],spec:normalizedSpec,sections:buildDependencyMap(normalizeSections(sections,normalizedType)),selectedSection:'chat',conversation:Array.isArray(conversation)?conversation:[],sectionContent:{},artifacts:{},outputs:{},tests:{status:'stale',specVersion:0,results:[],updatedAt:null},research:{status:'ready',queries:Array.isArray(research.queries)?research.queries:[],sources:Array.isArray(research.sources)?research.sources:[],findings:Array.isArray(research.findings)?research.findings:[]},resources:Array.isArray(normalizedSpec.resources)?[...normalizedSpec.resources]:[],agents:normalizeAgents(agents,normalizedType),executionState:{status:'ready',lastMutationId:null,lastAgent:null,staleFromVersion:null},files:{},versions:[],status:'discovery',sync:{remoteId:null,lastSyncedAt:null,baseUpdatedAt:null,mode:'local'}};
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
  return {schemaVersion:4,id:project.id,title:project.title,type:project.type,intention:project.intent,specVersion:project.specVersion,spec:project.spec,understanding:project.understanding,workspace:{sections:project.sections},plan:Array.isArray(project.plan)?project.plan:[],selectedSection:project.selectedSection,status:project.status,conversation:(project.conversation || []).slice(-100),files:project.files || {},artifacts:project.artifacts || {},outputs:project.outputs || {},sectionContent:project.sectionContent || {},tests:project.tests || {status:'stale'},research:project.research || {status:'ready',queries:[],sources:[],findings:[]},agents:project.agents || [],resources:project.resources || [],executionState:project.executionState || {},versions:project.versions || [],sync:{remoteId:project.sync?.remoteId || null,lastSyncedAt:project.sync?.lastSyncedAt || null,baseUpdatedAt:project.sync?.baseUpdatedAt || null,mode:project.sync?.mode || 'local'},updatedAt:project.updatedAt};
}

export function migrateProject(raw = {}) {
  const p = createProject({id:raw.id,title:raw.title,type:raw.type || raw.project_type || 'Other',intent:raw.intent || raw.intention || raw.goal || '',spec:raw.spec || raw.projectSpec || {},sections:raw.sections || raw.workspace?.sections || [],conversation:raw.conversation || raw.messages || [],agents:raw.agents || raw.settings?.agents || [],research:raw.research || raw.settings?.research || {}});
  p.createdAt = raw.createdAt || raw.created_at || p.createdAt; p.updatedAt = raw.updatedAt || raw.updated_at || p.updatedAt; p.specVersion = Number(raw.specVersion || raw.spec_version || 1); p.understanding = raw.understanding || p.understanding; p.plan = Array.isArray(raw.plan)?raw.plan:(Array.isArray(raw.workspace?.plan)?raw.workspace.plan:[]); p.category = raw.category || p.understanding?.category || p.category || ''; p.artifacts = raw.artifacts || raw.settings?.artifacts || {}; p.outputs = raw.outputs || raw.settings?.outputs || {}; p.sectionContent = raw.sectionContent || raw.settings?.sectionContent || {}; p.tests = raw.tests || raw.settings?.tests || p.tests; p.research = raw.research || raw.settings?.research || p.research; p.agents = normalizeAgents(raw.agents || raw.settings?.agents || p.agents,p.type); p.resources = Array.isArray(raw.resources)?raw.resources:(Array.isArray(raw.spec?.resources)?raw.spec.resources:[]); p.executionState = raw.executionState || raw.settings?.executionState || p.executionState; p.files = raw.files || {}; p.versions = Array.isArray(raw.versions)?raw.versions:[]; p.status = raw.status || 'draft'; p.selectedSection = raw.selectedSection || raw.selected_section || 'chat'; p.sections = buildDependencyMap(normalizeSections(raw.sections || raw.workspace?.sections || [],p.type)); p.sync = {...p.sync,...(raw.sync || {}),remoteId:raw.sync?.remoteId || raw.id || p.sync.remoteId,lastSyncedAt:raw.sync?.lastSyncedAt || raw.updatedAt || raw.updated_at || p.sync.lastSyncedAt,baseUpdatedAt:raw.sync?.baseUpdatedAt || raw.updatedAt || raw.updated_at || p.sync.baseUpdatedAt,mode:raw.sync?.mode || (raw.id && raw.workspace_id ? 'cloud' : 'local')}; return p;
}
