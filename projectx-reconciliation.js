const INPUT_DEFS = [
  ['goal','Goal','goal'],['users','Users','user'],['requirements','Requirements','requirement'],['constraints','Constraints','constraint'],
  ['features','Features','feature'],['decisions','Decisions','decision'],['dependencies','Dependencies','dependency'],['resources','Resources','resource'],
  ['assets','Assets','asset'],['deliverables','Deliverables','deliverable'],['acceptanceCriteria','Acceptance criteria','acceptance'],
  ['successCriteria','Success criteria','success'],['openQuestions','Open questions','question'],['platform','Platform','platform'],
  ['technology','Technology','technology'],['visualDirection','Visual direction','visual'],['currentState','Current state','state']
];
const SCALAR_FIELDS = new Set(['goal','platform','visualDirection','currentState']);
const ARRAY_FIELDS = new Set(INPUT_DEFS.filter(([field])=>!SCALAR_FIELDS.has(field)).map(([field])=>field));
const KIND_TO_LABEL = Object.fromEntries(INPUT_DEFS.map(([,label,kind])=>[kind,label]));
const slug = value => String(value ?? '').trim().toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'').slice(0,96) || 'item';
const digest = value => {
  const s = typeof value === 'string' ? value : JSON.stringify(value ?? null);
  let h = 2166136261;
  for (let i=0;i<s.length;i++) { h ^= s.charCodeAt(i); h = Math.imul(h,16777619); }
  return s.length+':'+(h>>>0).toString(16);
};
const clone = value => JSON.parse(JSON.stringify(value ?? null));
const arr = value => Array.isArray(value) ? value : [];
const text = value => String(value ?? '').trim();
const meaningful = value => Array.isArray(value) ? value.length > 0 : text(value).length > 0;

function stableItemId(kind, value, index) {
  const raw = value && typeof value === 'object'
    ? (value.id || value.key || value.name || value.title || value.url || value.finding || value.content)
    : value;
  return kind+':'+slug(raw || index);
}

function addNode(map, node) {
  if (!node?.id) return;
  const existing = map.get(node.id);
  if (!existing) map.set(node.id,node);
}

function addEdge(map, from, to, relation, reason, confidence='structural') {
  if (!from || !to || from===to) return;
  const key = from+'|'+to+'|'+relation;
  if (!map.has(key)) map.set(key,{from,to,relation,reason:reason||'Project dependency',confidence});
}

function explicitRefs(value) {
  if (!value || typeof value !== 'object') return [];
  const raw = [
    ...(Array.isArray(value.dependsOn)?value.dependsOn:[]),
    ...(Array.isArray(value.dependencies)?value.dependencies:[]),
    ...(Array.isArray(value.requires)?value.requires:[]),
    ...(Array.isArray(value.relatedTo)?value.relatedTo:[]),
    ...(Array.isArray(value.affectedFiles)?value.affectedFiles:[]),
    ...(Array.isArray(value.affectedArtifacts)?value.affectedArtifacts:[]),
    ...(Array.isArray(value.nodeIds)?value.nodeIds:[]),
    ...(Array.isArray(value.dependencyNodeIds)?value.dependencyNodeIds:[])
  ];
  return raw.map(v=>text(typeof v==='object'?(v.id||v.key||v.name||v.title):v)).filter(Boolean);
}

function buildStateGraph(project={}) {
  const nodes = new Map();
  const edges = new Map();
  const spec = project.spec || {};
  const addCollection = (field,label,kind) => {
    for (const [index,value] of arr(spec[field]).entries()) {
      const id = stableItemId(kind,value,index);
      addNode(nodes,{id,kind,label:typeof value==='string'?value:text(value.name||value.title||value.url||value.finding||value.content||id),source:'spec.'+field,signature:digest(value),value:clone(value),version:Number(project.specVersion||1)});
    }
  };

  for (const [field,label,kind] of INPUT_DEFS) {
    addNode(nodes,{id:'input:'+field,kind:'input',label,source:'spec.'+field,signature:digest(spec[field]),value:clone(spec[field]),version:Number(project.specVersion||1)});
    if (SCALAR_FIELDS.has(field)) {
      if (meaningful(spec[field])) addNode(nodes,{id:'spec:'+field,kind,label:text(spec[field]).slice(0,180),source:'spec.'+field,signature:digest(spec[field]),value:spec[field],version:Number(project.specVersion||1)});
    } else addCollection(field,label,kind);
  }

  // Stable field containers let derived artifacts survive item replacement while still
  // becoming stale whenever the underlying field changes.
  for (const [field] of INPUT_DEFS) {
    const container=nodes.get('input:'+field);
    if (!container) continue;
    const children=[...nodes.values()].filter(n=>n.source==='spec.'+field && n.id!=='input:'+field);
    for (const child of children) addEdge(edges,container.id,child.id,'contains','Field-level project input contains this item.');
  }

  if (text(project.title)) addNode(nodes,{id:'project:title',kind:'projectType',label:'Title: '+text(project.title),source:'project.title',signature:digest(project.title),version:Number(project.specVersion||1)});
  if (text(project.type)) addNode(nodes,{id:'project:type',kind:'projectType',label:'Type: '+text(project.type),source:'project.type',signature:digest(project.type),version:Number(project.specVersion||1)});

  for (const [index,item] of arr(project.plan).entries()) {
    const id='plan:'+(text(item?.id||item?.key)||slug(item?.title||item?.name)||index);
    addNode(nodes,{id,kind:'plan',label:text(item?.title||item?.name||item)||('Plan '+(index+1)),source:'plan',signature:digest(item),value:clone(item),version:Number(project.specVersion||1)});
  }

  for (const [index,item] of arr(project.executionState?.tasks).entries()) {
    const id='task:'+(text(item?.id||item?.key)||slug(item?.title||item?.name)||index);
    addNode(nodes,{id,kind:'task',label:text(item?.title||item?.name||item)||('Task '+(index+1)),source:'executionState.tasks',signature:digest({
      title:item?.title,description:item?.description,dependencies:item?.dependencies,affectedFiles:item?.affectedFiles,affectedArtifacts:item?.affectedArtifacts
    }),value:clone(item),version:Number(project.specVersion||1)});
  }

  const artifacts = project.artifacts || {};
  for (const [key,item] of Object.entries(artifacts)) {
    const id='artifact:'+slug(key);
    addNode(nodes,{id,kind:'artifact',label:text(item?.summary||item?.name||key),source:'artifacts.'+key,signature:digest({
      kind:item?.kind,summary:item?.summary,deliverables:item?.deliverables,filePaths:item?.filePaths,entry:item?.entry,dependencyNodeIds:item?.dependencyNodeIds
    }),value:clone(item),version:Number(item?.specVersion||project.specVersion||1)});
  }
  const outputs = project.outputs || {};
  for (const [key,item] of Object.entries(outputs)) {
    const id='output:'+slug(key);
    addNode(nodes,{id,kind:'output',label:text(item?.summary||item?.name||key),source:'outputs.'+key,signature:digest({
      kind:item?.kind,summary:item?.summary,filePaths:item?.filePaths,dependencyNodeIds:item?.dependencyNodeIds
    }),value:clone(item),version:Number(item?.specVersion||project.specVersion||1)});
  }
  for (const path of Object.keys(project.files || {})) {
    addNode(nodes,{id:'file:'+path,kind:'file',label:path,source:'files.'+path,signature:digest(String(project.files[path]??'')),value:String(project.files[path]??''),version:Number(project.specVersion||1)});
  }
  for (const [index,item] of arr(project.tests?.results).entries()) {
    const id='test:'+slug(item?.id||item?.name||index);
    addNode(nodes,{id,kind:'test',label:text(item?.name)||('Verification '+(index+1)),source:'tests.results',signature:digest({
      name:item?.name,detail:item?.detail,evidence:item?.evidence,requiredHumanReview:item?.requiredHumanReview,checkType:item?.checkType
    }),value:clone(item),version:Number(project.tests?.specVersion||project.specVersion||1)});
  }
  for (const [index,query] of arr(project.research?.queries).entries()) {
    const id='research:'+slug(query||index);
    addNode(nodes,{id,kind:'research',label:text(query)||('Research query '+(index+1)),source:'research.queries',signature:digest(query),value:query,version:Number(project.specVersion||1)});
  }
  for (const [index,item] of arr(project.research?.findings).entries()) {
    const id='evidence:'+slug(item?.id||item?.sourceUrl||item?.url||item?.finding||index);
    addNode(nodes,{id,kind:'evidence',label:text(item?.finding||item?.title||item?.sourceUrl||item?.url)||('Evidence '+(index+1)),source:'research.findings',signature:digest(item),value:clone(item),version:Number(project.specVersion||1)});
  }
  for (const [index,item] of arr(project.executionState?.uncertainties).entries()) {
    const id='uncertainty:'+slug(item?.id||item?.path||index);
    addNode(nodes,{id,kind:'uncertainty',label:text(item?.reason||item?.path)||('Uncertainty '+(index+1)),source:'executionState.uncertainties',signature:digest(item),value:clone(item),version:Number(project.specVersion||1)});
  }

  const idsByKind = kind => [...nodes.values()].filter(n=>n.kind===kind);
  const bySource = source => [...nodes.values()].filter(n=>n.source===source);
  const linkAll = (fromKind,toKind,relation,reason) => {
    for (const from of idsByKind(fromKind)) for (const to of idsByKind(toKind)) addEdge(edges,from.id,to.id,relation,reason);
  };

  // Mission inputs constrain or inform downstream decisions.
  for (const k of ['goal','user','constraint','requirement','feature','dependency','resource','asset','platform','technology','visual','state']) {
    const from = k==='goal' ? nodes.get('spec:goal') : null;
    if (from) {
      for (const to of [...idsByKind('decision'),...idsByKind('requirement'),...idsByKind('constraint'),...idsByKind('deliverable')]) {
        addEdge(edges,from.id,to.id,'influences','Goal shapes project decisions and outputs.');
      }
    }
  }
  linkAll('constraint','decision','constrains','Constraints bound project decisions.');
  linkAll('requirement','decision','requires','Requirements must be satisfied by decisions or work.');
  linkAll('feature','decision','influences','Features influence implementation decisions.');
  // A task with an explicit dependency scope owns its causality; do not also attach the
  // broad decision -> task relationship or unrelated decisions would leak into its impact set.
  for (const decision of idsByKind('decision')) {
    for (const task of idsByKind('task')) {
      const refs=explicitRefs(task.value);
      if (!refs.length) addEdge(edges,decision.id,task.id,'produces','Decisions create or change executable work.');
    }
  }
  // Explicit artifact dependency scopes are authoritative. Only artifacts without an explicit
  // dependency list receive the broader structural decision -> artifact relationship.
  for (const decision of idsByKind('decision')) {
    for (const artifact of [...idsByKind('artifact'),...idsByKind('output')]) {
      const deps=Array.isArray(artifact.value?.dependencyNodeIds)?artifact.value.dependencyNodeIds:[];
      if (!deps.length) addEdge(edges,decision.id,artifact.id,'implements','Decision is reflected in an artifact without an explicit dependency scope.');
    }
  }
  linkAll('deliverable','artifact','produces','Deliverables are represented by artifacts.');
  linkAll('deliverable','output','produces','Deliverables are represented by outputs.');
  linkAll('acceptance','test','verifies','Acceptance criteria define verification checks.');
  linkAll('success','test','verifies','Success criteria define verification checks.');
  for (const requirement of idsByKind('requirement')) {
    for (const task of idsByKind('task')) if (!explicitRefs(task.value).length) addEdge(edges,requirement.id,task.id,'requires','Requirements create necessary work.');
  }
  for (const constraint of idsByKind('constraint')) {
    for (const task of idsByKind('task')) if (!explicitRefs(task.value).length) addEdge(edges,constraint.id,task.id,'constrains','Constraints bound executable work.');
  }
  linkAll('platform','file','requires','Platform choices constrain implementation files.');
  linkAll('technology','file','requires','Technology choices constrain implementation files.');
  linkAll('visual','file','influences','Visual direction influences implementation files.');
  linkAll('artifact','test','verifies','Artifacts should be verified before delivery.');
  linkAll('output','test','verifies','Outputs should be verified before delivery.');
  linkAll('file','test','verifies','Files are covered by runtime or content checks.');
  linkAll('research','evidence','produces','Research queries produce saved evidence.');
  linkAll('research','decision','informs','Research questions inform decisions.');
  linkAll('evidence','decision','supports','Evidence can support project decisions.');
  linkAll('uncertainty','decision','uncertainty_affects','Uncertainties should be resolved before dependent decisions.');

  // Plan-to-task and explicit task/artifact/file links.
  for (const task of idsByKind('task')) {
    const value=task.value||{};
    for (const ref of explicitRefs(value)) {
      if (nodes.has(ref) && /^input:|^spec:|^goal:|^user:|^requirement:|^constraint:|^feature:|^decision:|^dependency:|^resource:|^asset:|^deliverable:|^acceptance:|^success:|^question:|^platform:|^technology:|^visual:|^state:/.test(ref)) {
        addEdge(edges,ref,task.id,'requires','Task explicitly depends on this project input.');
      } else if (ref.startsWith('task:')) addEdge(edges,task.id,ref,'depends_on','Task declares a dependency.');
      else if (ref.startsWith('artifact:')) addEdge(edges,task.id,ref,'implements','Task declares an affected artifact.');
      else if (ref.startsWith('file:')) addEdge(edges,task.id,ref,'implements','Task declares an affected file.');
      else {
        const match=idsByKind('task').find(n=>slug(n.id)===slug(ref)||slug(n.label)===slug(ref));
        if(match) addEdge(edges,task.id,match.id,'depends_on','Task declares a dependency.');
        const file=idsByKind('file').find(n=>n.id==='file:'+ref||n.label===ref);
        if(file) addEdge(edges,task.id,file.id,'implements','Task declares an affected file.');
      }
    }
  }
  for (const plan of idsByKind('plan')) {
    const match=idsByKind('task').filter(task=>{
      const p=slug(plan.label), t=slug(task.label);
      return p && t && (p.includes(t)||t.includes(p));
    });
    for (const task of match.slice(0,6)) addEdge(edges,plan.id,task.id,'requires','Plan item maps to executable task.');
  }
  for (const artifact of [...idsByKind('artifact'),...idsByKind('output')]) {
    const item=artifact.value||{};
    const paths=Array.isArray(item.filePaths)?item.filePaths:[item.entry];
    for (const path of paths.filter(Boolean)) {
      const file=nodes.get('file:'+String(path));
      if(file) addEdge(edges,artifact.id,file.id,'produces','Artifact declares its file output.');
    }
    for (const dep of Array.isArray(item.dependencyNodeIds)?item.dependencyNodeIds:[]) {
      if(nodes.has(dep)) addEdge(edges,dep,artifact.id,'supports','Artifact declares its dependency.');
    }
  }

  for (const test of idsByKind('test')) {
    const refs=Array.isArray(test.value?.dependencyNodeIds)?test.value.dependencyNodeIds:[];
    for(const ref of refs) if(nodes.has(ref)) addEdge(edges,ref,test.id,'verifies','Verification explicitly covers this project node.');
  }

  // Explicit dependency references in decisions/requirements/etc are honored.
  for (const kind of ['decision','requirement','constraint','feature','deliverable']) {
    for (const node of idsByKind(kind)) {
      for (const ref of explicitRefs(node.value)) {
        const target=nodes.get(ref)||[...nodes.values()].find(n=>slug(n.id)===slug(ref)||slug(n.label)===slug(ref));
        if(target) addEdge(edges,target.id,node.id,'depends_on','Explicit project dependency.');
      }
    }
  }

  return {
    version:Number(project.specVersion||1),
    nodes:[...nodes.values()].slice(0,320),
    edges:[...edges.values()].slice(0,640)
  };
}

function nodeMap(graph) { return new Map((graph?.nodes||[]).map(n=>[n.id,n])); }
function edgeList(graph) { return Array.isArray(graph?.edges)?graph.edges:[]; }

export function reconcileChange(beforeProject={}, afterProject={}, options={}) {
  const before=buildStateGraph(beforeProject), after=buildStateGraph(afterProject);
  const bm=nodeMap(before), am=nodeMap(after);
  const allIds=new Set([...bm.keys(),...am.keys()]);
  const changedNodes=[];
  for (const id of allIds) {
    const b=bm.get(id), a=am.get(id);
    if (!b || !a || b.signature!==a.signature) changedNodes.push(id);
  }
  const adjacency=new Map();
  const unionEdges=new Map();
  for (const e of [...edgeList(before),...edgeList(after)]) unionEdges.set(e.from+'|'+e.to+'|'+e.relation,e);
  for (const e of unionEdges.values()) {
    if (!adjacency.has(e.from)) adjacency.set(e.from,[]);
    adjacency.get(e.from).push(e);
  }
  const affectedNodes=[];
  const seen=new Set(changedNodes);
  const queue=changedNodes.map(id=>({id,depth:0,via:null}));
  while(queue.length){
    const current=queue.shift();
    for(const e of adjacency.get(current.id)||[]){
      if(seen.has(e.to)) continue;
      seen.add(e.to);
      const n=am.get(e.to)||bm.get(e.to);
      if(n) affectedNodes.push({id:e.to,depth:current.depth+1,relation:e.relation,reason:e.reason,confidence:e.confidence,node:n});
      queue.push({id:e.to,depth:current.depth+1,via:e});
    }
  }

  const changedSet=new Set(changedNodes);
  const affectedSet=new Set(affectedNodes.map(x=>x.id));
  const staleNodes=affectedNodes.filter(x=>am.has(x.id)&&['artifact','output','file','test','plan'].includes(am.get(x.id).kind));
  const reviewNodes=affectedNodes.filter(x=>am.has(x.id)&&['decision','task','evidence','uncertainty'].includes(am.get(x.id).kind));
  const invalidatedNodes=affectedNodes.filter(x=>am.has(x.id)&&(['task','decision'].includes(am.get(x.id).kind)) && changedNodes.some(id=>!am.has(id)));
  const labelsFor = ids => [...new Set(ids.map(id=>am.get(id)||bm.get(id)).filter(Boolean).map(n=>n.label))].slice(0,80);
  const areas = [...new Set(affectedNodes.map(x=>x.node.kind).filter(Boolean))].slice(0,40);

  const actions=[];
  for(const item of [...staleNodes,...reviewNodes]){
    const n=item.node;
    const type=n.kind==='artifact'||n.kind==='output'?'rebuild':n.kind==='file'?'update':n.kind==='test'?'verify':n.kind==='plan'?'replan':n.kind==='decision'?'review-decision':n.kind==='task'?'review-task':n.kind==='evidence'?'reevaluate-evidence':'review';
    const label= type==='rebuild' ? 'Rebuild '+n.label : type==='verify' ? 'Rerun verification: '+n.label : type==='replan' ? 'Regenerate plan item: '+n.label : type==='review-decision' ? 'Review decision: '+n.label : type==='review-task' ? 'Review task: '+n.label : type==='reevaluate-evidence' ? 'Re-evaluate evidence: '+n.label : 'Update '+n.label;
    if(!actions.some(a=>a.id===n.id)) actions.push({id:n.id,type,label,reason:item.reason,confidence:item.confidence});
  }

  const verification=[];
  for(const n of staleNodes){
    if(n.node.kind==='test') verification.push({type:'rerun-test',targetId:n.id,label:'Rerun '+n.node.label,reason:'Upstream project state changed.',required:true});
    if(n.node.kind==='artifact'||n.node.kind==='output') verification.push({type:'rebuild-artifact',targetId:n.id,label:'Rebuild '+n.node.label,reason:'Artifact depends on changed project state.',required:true});
    if(n.node.kind==='file') verification.push({type:'recheck-file',targetId:n.id,label:'Recheck '+n.node.label,reason:'File depends on changed implementation inputs.',required:true});
  }
  const targetVersion=Number(afterProject.specVersion||1);
  const baseVersion=Number(beforeProject.specVersion||Math.max(1,targetVersion-1));
  const changedLabels=labelsFor(changedNodes);
  const affectedLabels=labelsFor(affectedNodes.map(x=>x.id));
  const staleLabels=labelsFor(staleNodes.map(x=>x.id));
  const invalidatedLabels=labelsFor(invalidatedNodes.map(x=>x.id));
  const changedInputs=[...changedNodes].map(id=>am.get(id)||bm.get(id)).filter(n=>n && (n.source?.startsWith('spec.')||n.kind==='projectType'));
  const summary=changedNodes.length
    ? changedInputs.length
      ? changedInputs.map(n=>n.label).slice(0,5).join(', ')+' changed; '+affectedNodes.length+' downstream nodes require review or reconciliation.'
      : changedNodes.length+' project objects changed; '+affectedNodes.length+' downstream nodes require review or reconciliation.'
    : 'No dependent project state changed.';

  const statusNodes=[...after.nodes].map(n=>{
    const status=changedSet.has(n.id)?'changed':staleNodes.some(x=>x.id===n.id)?'stale':reviewNodes.some(x=>x.id===n.id)?'review':'active';
    return {...n,status};
  });

  return {
    baseVersion,targetVersion,
    changed:changedLabels,
    changedNodes:changedNodes.map(id=>am.get(id)||bm.get(id)).filter(Boolean),
    affected:affectedLabels,
    affectedNodes,
    stale:staleLabels,
    staleNodes,
    invalidated:invalidatedLabels,
    invalidatedNodes,
    reviewNodes,
    suggestedActions:actions.map(a=>a.label),
    actions,
    verification,
    areas,
    nodes:statusNodes,
    edges:after.edges,
    summary,
    generatedAt:new Date().toISOString(),
    version:targetVersion
  };
}

export function markReconciliationState(project={}, reconciliation={}) {
  const staleIds=new Set((reconciliation.staleNodes||[]).map(x=>x.id));
  const reviewIds=new Set((reconciliation.reviewNodes||[]).map(x=>x.id));
  const invalidateById=(collection,prefix)=>{
    if(!collection || typeof collection!=='object') return;
    for(const [key,value] of Object.entries(collection)){
      if(!value || typeof value!=='object') continue;
      const id=prefix+slug(key);
      if(staleIds.has(id)){ value.stale=true; value.staleFromVersion=Number(project.specVersion||1); value.derivedFromVersion=Number(value.specVersion||project.specVersion||1); }
      else if(reviewIds.has(id)) value.needsReview=true;
    }
  };
  invalidateById(project.artifacts,'artifact:');
  invalidateById(project.outputs,'output:');
  if(Array.isArray(project.executionState?.tasks)){
    for(const task of project.executionState.tasks){
      const id='task:'+(text(task?.id||task?.key)||slug(task?.title||task?.name)||'0');
      if(staleIds.has(id)){task.reconciliationStatus='stale';task.reconciliationVersion=Number(project.specVersion||1);}
      else if(reviewIds.has(id)){task.reconciliationStatus='needs_review';task.reconciliationVersion=Number(project.specVersion||1);}
    }
  }
  project.executionState={
    ...(project.executionState||{}),
    reconciliation:{
      baseVersion:reconciliation.baseVersion,targetVersion:reconciliation.targetVersion,
      changedNodeIds:(reconciliation.changedNodes||[]).map(x=>x.id),
      affectedNodeIds:(reconciliation.affectedNodes||[]).map(x=>x.id),
      staleNodeIds:(reconciliation.staleNodes||[]).map(x=>x.id),
      invalidatedNodeIds:(reconciliation.invalidatedNodes||[]).map(x=>x.id),
      generatedAt:reconciliation.generatedAt
    }
  };
  return project;
}


const ACTION_TERMINAL = new Set(['completed','failed','blocked','skipped']);
const EXECUTION_ACTION_TYPES = new Set(['rebuild','update','verify','replan','review-decision','review-task','reevaluate-evidence','review']);
function actionPhase(type){ if(['review-decision','review-task','reevaluate-evidence','review'].includes(type)) return 'review'; if(type==='replan') return 'plan'; if(['update','rebuild'].includes(type)) return 'apply'; if(type==='verify') return 'verify'; return 'review'; }
function actionId(action,index=0){ return 'reconcile:'+slug(action?.id||action?.targetId||action?.label||index); }
export function createReconciliationQueue(reconciliation={},options={}){
  const baseVersion=Number(options.baseVersion??reconciliation.baseVersion??1), targetVersion=Number(options.targetVersion??reconciliation.targetVersion??baseVersion);
  const actions=(Array.isArray(reconciliation.actions)?reconciliation.actions:[]).filter(a=>a&&EXECUTION_ACTION_TYPES.has(a.type)).map((a,i)=>({id:actionId(a,i),targetId:String(a.id||a.targetId||''),type:a.type,phase:actionPhase(a.type),label:String(a.label||a.id||'Reconciliation action').slice(0,240),reason:String(a.reason||'').slice(0,500),confidence:Math.max(0,Math.min(1,Number(a.confidence??0.7)||0.7)),status:'pending',attempts:0,dependsOn:[],createdAt:new Date().toISOString(),updatedAt:new Date().toISOString(),result:null,error:null,verificationRequired:!['review-decision','review-task','review'].includes(a.type)}));
  const out=[],seen=new Set(); for(const a of actions)if(!seen.has(a.id)){seen.add(a.id);out.push(a);}
  for(const a of out)if(a.phase==='verify'){const dep=out.find(x=>x.targetId===a.targetId&&['apply','plan'].includes(x.phase));if(dep)a.dependsOn.push(dep.id);}
  return {id:String(options.queueId||('rq-'+targetVersion+'-'+Date.now())),baseVersion,targetVersion,status:out.length?'pending':'complete',createdAt:new Date().toISOString(),updatedAt:new Date().toISOString(),actions:out,completedAt:null,summary:String(reconciliation.summary||'').slice(0,600)};
}
export function getReconciliationQueue(project={}){return project.executionState?.reconciliationQueue||null;}
export function getReadyReconciliationActions(project={}){const q=getReconciliationQueue(project);if(!q)return [];return q.actions.filter(a=>a.status==='pending'&&a.dependsOn.every(id=>{const d=q.actions.find(x=>x.id===id);return !d||d.status==='completed';}));}
export function updateReconciliationAction(queue,actionIdValue,patch={}){
  if(!queue?.actions)return {updated:false,reason:'queue_missing'};const a=queue.actions.find(x=>x.id===actionIdValue);if(!a)return {updated:false,reason:'action_missing'};
  const status=patch.status==null?a.status:String(patch.status);if(!['pending','running','completed','failed','blocked','skipped'].includes(status))return {updated:false,reason:'invalid_status'};
  a.status=status;if(status==='running')a.attempts=Number(a.attempts||0)+1;a.updatedAt=new Date().toISOString();if('result' in patch)a.result=clone(patch.result);if('error' in patch)a.error=patch.error?String(patch.error).slice(0,500):null;if(ACTION_TERMINAL.has(status))a.completedAt=new Date().toISOString();
  const failed=queue.actions.some(x=>x.status==='failed'),blocked=queue.actions.some(x=>x.status==='blocked'),remaining=queue.actions.some(x=>!ACTION_TERMINAL.has(x.status));queue.status=failed?'failed':blocked?'blocked':remaining?(queue.actions.some(x=>x.status==='running')?'in_progress':'pending'):'complete';if(queue.status==='complete')queue.completedAt=new Date().toISOString();queue.updatedAt=new Date().toISOString();return {updated:true,action:a};
}
export function recordReconciliationResult(project={},queue,actionIdValue,result={}){
  const a=queue?.actions?.find(x=>x.id===actionIdValue);if(!a)return {ok:false,reason:'action_missing'};
  const updated=updateReconciliationAction(queue,actionIdValue,{status:result.status||(result.ok?'completed':'failed'),result:{kind:String(result.kind||a.type),ok:result.ok!==false,message:String(result.message||'').slice(0,700),outputVersion:Number(result.outputVersion??project.specVersion??queue.targetVersion),evidence:Array.isArray(result.evidence)?result.evidence.slice(0,20).map(x=>typeof x==='string'?x:clone(x)):[],recordedAt:new Date().toISOString()},error:result.error||null});
  if(!updated.updated)return updated;project.executionState={...(project.executionState||{}),reconciliationQueue:queue};return {ok:true,queueStatus:queue.status,action:updated.action};
}
export function resetFailedReconciliation(project={}){const q=getReconciliationQueue(project);if(!q)return {reset:false,reason:'queue_missing'};for(const a of q.actions)if(a.status==='failed'){a.status='pending';a.error=null;a.updatedAt=new Date().toISOString();}q.status='pending';q.completedAt=null;q.updatedAt=new Date().toISOString();project.executionState={...(project.executionState||{}),reconciliationQueue:q};return {reset:true,status:q.status};}

export function inputNodeIds(project={}) {
  return buildStateGraph(project).nodes.filter(n => n.kind==='input' || n.kind==='projectType').map(n=>n.id);
}
