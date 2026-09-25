const clone = value => JSON.parse(JSON.stringify(value ?? null));
const arr = value => Array.isArray(value) ? value : [];
const text = value => String(value ?? '').trim();
const slug = value => text(value).toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'').slice(0,80) || 'failure';
const digest = value => {
  const s = typeof value === 'string' ? value : JSON.stringify(value ?? null);
  let h = 2166136261;
  for (let i=0;i<s.length;i++) { h ^= s.charCodeAt(i); h = Math.imul(h,16777619); }
  return (h>>>0).toString(16);
};

const CATEGORY_RULES = [
  ['security', /security|credential|javascript url|shell execution|eval constructor|insecure http|unsafe file path/i],
  ['runtime', /browser runtime|runtime error|crash|exception|undefined is not|cannot read|is not a function/i],
  ['structure', /entry file|html structure|document deliverable|deliverable exists|missing .* document|missing index.html/i],
  ['placeholder', /placeholder|todo|fixme|coming soon/i],
  ['content', /deliverable has substance|too short|empty output/i],
  ['dependency', /module|import|dependency|package|library/i]
];

function categoryForFailure(failure={}) {
  const value = [failure.category,failure.checkType,failure.name,failure.detail].map(text).join(' ');
  return CATEGORY_RULES.find(([,rx])=>rx.test(value))?.[0] || 'unknown';
}

function severityForFailure(failure={}) {
  if (failure.severity === 'critical' || failure.blockBuild) return 'critical';
  const category = categoryForFailure(failure);
  if (category === 'security' || category === 'runtime') return 'high';
  if (!failure.pass && failure.required) return 'high';
  return 'medium';
}

function hintedFiles(failure={}, files={}) {
  const listed = [...arr(failure.affectedFiles), ...arr(failure.files)].map(text).filter(Boolean);
  const detail = [text(failure.detail),text(failure.message)].join(' ');
  const keys = Object.keys(files||{});
  const matches = [];
  for (const path of keys) {
    if (listed.includes(path) || detail.includes(path)) matches.push(path);
  }
  if (matches.length) return [...new Set(matches)].slice(0,20);
  const category = categoryForFailure(failure);
  if (category === 'security') {
    const textCorpus = Object.entries(files||{})
      .filter(([,value])=>String(value||'').length)
      .filter(([,value])=>{
        const valueText=String(value||'');
        if(/shell execution/i.test(failure.name||'')) return /child_process|Deno\.Command|Bun\.spawn|process\.exec\(/i.test(valueText);
        if(/eval constructors/i.test(failure.name||'')) return /\b(?:eval|new Function)\s*\(/i.test(valueText);
        if(/javascript url/i.test(failure.name||'')) return /javascript\s*:/i.test(valueText);
        if(/insecure http/i.test(failure.name||'')) return /(?:src|href|fetch\s*\()[^\n]{0,80}http:\/\//i.test(valueText);
        if(/credential/i.test(failure.name||'')) return /(?:api[_-]?key|secret|token|password)\s*[:=]\s*['"][^'"]{16,}['"]/i.test(valueText);
        return true;
      }).map(([p])=>p);
    if (textCorpus.length) return textCorpus.slice(0,20);
  }
  if (category === 'structure' || category === 'runtime' || category === 'placeholder') {
    const software = Object.keys(files||{}).some(p=>/\.html?$/i.test(p));
    if (software) {
      const html = Object.keys(files||{}).filter(p=>/\.html?$/i.test(p));
      if (failure.name && /entry|html structure|browser runtime/i.test(failure.name)) return html.slice(0,6);
      const marker = /\b(TODO|FIXME|coming soon)\b/i;
      if (category === 'placeholder') return html.filter(p=>marker.test(String(files[p]||''))).slice(0,20);
      return (files['index.html']||files['src/index.html']) ? [files['index.html']?'index.html':'src/index.html'] : html.slice(0,6);
    }
    return Object.keys(files||{}).filter(p=>/\.(md|txt|csv|json)$/i.test(p)).slice(0,20);
  }
  return [];
}

export function normalizeFailureEvidence(failures=[], files={}) {
  return arr(failures).filter(f=>f && f.pass===false).map((failure,index)=>{
    const affectedFiles=hintedFiles(failure,files);
    return {
      id:String(failure.id||('failure-'+index+'-'+digest([failure.name,failure.detail]))),
      name:text(failure.name)||('Verification failure '+(index+1)),
      detail:text(failure.detail||failure.message).slice(0,1200),
      checkType:text(failure.checkType||'local')||'local',
      severity:severityForFailure(failure),
      category:categoryForFailure(failure),
      blockBuild:Boolean(failure.blockBuild),
      required:Boolean(failure.required),
      affectedFiles,
      evidence:clone(failure.evidence||{})
    };
  });
}

export function diagnoseFailures(project={}, failures=[], options={}) {
  const normalized=normalizeFailureEvidence(failures,project.files||{});
  const ranked=[...normalized].sort((a,b)=>{
    const weight={critical:4,high:3,medium:2,low:1};
    return (weight[b.severity]||0)-(weight[a.severity]||0);
  });
  const primary=ranked[0]||null;
  const categories=[...new Set(normalized.map(f=>f.category))];
  const affectedFiles=[...new Set(normalized.flatMap(f=>f.affectedFiles))].slice(0,20);
  const repairPaths=affectedFiles.length
    ? affectedFiles
    : Object.keys(project.files||{}).filter(p=>/\.(html?|css|js|mjs|ts|md|txt|csv|json)$/i.test(p)).slice(0,8);
  const category=primary?.category||'unknown';
  const routingTask=category==='security'?'repair':category==='runtime'?'repair':category==='dependency'?'repair':'repair';
  return {
    version:1,
    diagnosisId:'diag-'+digest({version:project.specVersion,failures:normalized.map(f=>({id:f.id,category:f.category,files:f.affectedFiles}))}),
    targetVersion:Number(project.specVersion||1),
    status:primary?'actionable':'no-failure',
    category,
    summary:primary
      ? (categories.length>1 ? 'Multiple verification failures require a bounded repair pass.' : primary.name+' requires a bounded repair pass.')
      : 'No failing verification evidence was supplied.',
    rootCauseCandidates:ranked.slice(0,8).map(f=>({
      failureId:f.id,
      category:f.category,
      statement:f.detail||f.name,
      affectedFiles:f.affectedFiles
    })),
    affectedFiles,
    repairPaths,
    constraints:[
      'Modify only files listed in repairPaths.',
      'Preserve unrelated behavior and project requirements.',
      'Do not add dependencies or external assets.',
      'Produce a complete replacement for each changed file.',
      'Verification must pass against the same Project Brain version.'
    ],
    routing:{agent:'repairer',task:routingTask},
    evidence:normalized.slice(0,12),
    repairScope:options.scope||'minimal',
    createdAt:new Date().toISOString()
  };
}

export function createRepairContract(project={},diagnosis={},action={},policy={}) {
  const repairPaths=[...new Set(arr(diagnosis.repairPaths||diagnosis.affectedFiles).map(text).filter(Boolean))].slice(0,12);
  const targetVersion=Number(diagnosis.targetVersion??project.specVersion??1);
  return {
    version:1,
    actionId:String(action.id||''),
    type:'repair',
    phase:'apply',
    targetVersion,
    executor:'builder-repair-ai',
    agent:'repairer',
    capability:'files.repair',
    boundary:'workspace-local',
    risk:'medium',
    diagnosisId:String(diagnosis.diagnosisId||''),
    failureCategory:String(diagnosis.category||'unknown'),
    failureEvidence:arr(diagnosis.evidence).slice(0,12).map(clone),
    rootCauseCandidates:arr(diagnosis.rootCauseCandidates).slice(0,8).map(clone),
    repairPaths,
    preconditions:[
      {id:'project-version',check:'project.specVersion === queue.targetVersion',required:true},
      {id:'action-ready',check:'repair action is pending',required:true},
      {id:'diagnosis-present',check:'repair diagnosis targets the current version',required:true},
      {id:'paths-present',check:'every repair path exists in the project file set',required:repairPaths.length>0}
    ],
    reads:repairPaths.map(p=>'files:'+p),
    writes:repairPaths.map(p=>'file:'+p),
    outputs:['repair-patch','diagnosis'],
    verification:['runtime','structure','security','target-files'],
    idempotencyKey:'px:repair:'+targetVersion+':'+String(action.id||diagnosis.diagnosisId||''),
    retryPolicy:{
      maxAttempts:Math.min(Number(policy.maxAttemptsPerAction||2),2),
      maxRepairCycles:Number(policy.maxRepairCycles||1),
      autoRepair:false
    },
    humanReviewRequired:false,
    autoExecute:Number(policy.maxRepairCycles||0)>0,
    limits:{
      maxActions:Number(policy.maxActions||16),
      maxRepairCycles:Number(policy.maxRepairCycles||1),
      maxAttemptsPerAction:Math.min(Number(policy.maxAttemptsPerAction||2),2)
    }
  };
}

export function createRepairAction(project={},verifyAction={},diagnosis={},cycle=1) {
  const id='repair:'+digest({verifyId:verifyAction.id,diagnosisId:diagnosis.diagnosisId,cycle});
  return {
    id,
    targetId:String(diagnosis.diagnosisId||id),
    type:'repair',
    phase:'apply',
    label:'Repair: '+String(diagnosis.summary||'Verification failure').slice(0,180),
    reason:'Repair verification failure '+String(verifyAction.label||verifyAction.id||'').slice(0,120),
    confidence:Math.max(0.2,Math.min(0.95,Number(verifyAction.confidence||0.7))),
    status:'pending',
    attempts:0,
    dependsOn:[],
    createdAt:new Date().toISOString(),
    updatedAt:new Date().toISOString(),
    result:null,
    error:null,
    verificationRequired:true,
    repairCycle:cycle,
    diagnosis:clone(diagnosis),
    repairPaths:clone(diagnosis.repairPaths||[])
  };
}

export function scheduleRepairCycle(project={},verifyActionId='',failures=[],policy={}) {
  const queue=project?.executionState?.reconciliationQueue;
  if(!queue)return {scheduled:false,reason:'queue_missing'};
  const verify=queue.actions?.find(a=>a.id===verifyActionId);
  if(!verify)return {scheduled:false,reason:'verification_action_missing'};
  const cycle=Number(queue.execution?.repairCycles||0)+1;
  if(cycle>Number(policy.maxRepairCycles||0))return {scheduled:false,reason:'repair_limit_reached'};
  const diagnosis=diagnoseFailures(project,failures,{});
  if(diagnosis.status!=='actionable'||!diagnosis.repairPaths.length)return {scheduled:false,reason:'insufficient_failure_evidence',diagnosis};
  const action=createRepairAction(project,verify,diagnosis,cycle);
  const existing=queue.actions.find(a=>a.id===action.id);
  if(!existing)queue.actions.push(action);
  verify.failureHistory=Array.isArray(verify.failureHistory)?verify.failureHistory:[];
  verify.failureHistory.push({
    cycle,
    diagnosisId:diagnosis.diagnosisId,
    category:diagnosis.category,
    affectedFiles:diagnosis.affectedFiles,
    detail:diagnosis.summary,
    evidence:diagnosis.evidence
  });
  verify.status='pending';
  verify.error=null;
  verify.result=null;
  verify.dependsOn=[action.id];
  verify.updatedAt=new Date().toISOString();
  queue.status='pending';
  queue.completedAt=null;
  queue.updatedAt=new Date().toISOString();
  queue.execution={
    ...(queue.execution||{}),
    repairCycles:cycle,
    lastRepairActionId:action.id,
    lastDiagnosis:clone(diagnosis)
  };
  project.executionState={
    ...(project.executionState||{}),
    reconciliationQueue:queue,
    status:'reconciling',
    repairHistory:[
      ...(Array.isArray(project.executionState?.repairHistory)?project.executionState.repairHistory:[]),
      {cycle,diagnosisId:diagnosis.diagnosisId,category:diagnosis.category,affectedFiles:diagnosis.affectedFiles,repairActionId:action.id,createdAt:new Date().toISOString()}
    ].slice(-20)
  };
  return {scheduled:true,cycle,diagnosis,repairAction:action,queue};
}
