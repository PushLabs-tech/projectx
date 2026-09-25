import { diagnoseFailures, createRepairContract as createRepairActionContract, scheduleRepairCycle } from './projectx-repair.js';
const EXECUTOR_DEFS = {
  rebuild: {
    key:'builder-local-ai',
    agent:'builder',
    capability:'artifact.build',
    boundary:'workspace-local',
    risk:'medium',
    maxAttempts:2,
    autoModes:['Fast','Balanced','Powerful','Mostly Automatic','Autonomous'],
    writes:['files','artifacts'],
    outputs:['artifact'],
    verifies:['runtime','structure','security']
  },
  update: {
    key:'builder-targeted-ai',
    agent:'builder',
    capability:'files.write',
    boundary:'workspace-local',
    risk:'medium',
    maxAttempts:2,
    autoModes:['Balanced','Powerful','Mostly Automatic','Autonomous'],
    writes:['target-file','artifacts','tests'],
    outputs:['file'],
    verifies:['target-file','runtime','security']
  },
  repair: {
    key:'builder-repair-ai',
    agent:'repairer',
    capability:'files.repair',
    boundary:'workspace-local',
    risk:'medium',
    maxAttempts:2,
    autoModes:['Balanced','Powerful','Mostly Automatic','Autonomous'],
    writes:['repair-files','tests'],
    outputs:['repair-patch','diagnosis'],
    verifies:['runtime','structure','security','target-files']
  },
  verify: {
    key:'tester-local-sandbox',
    agent:'tester',
    capability:'tests.run',
    boundary:'browser-sandbox',
    risk:'low',
    maxAttempts:2,
    autoModes:['Fast','Balanced','Powerful','Mostly Automatic','Autonomous'],
    writes:['tests','execution-status'],
    outputs:['verification'],
    verifies:['runtime','security','version']
  },
  replan: {
    key:'planner-human-gate',
    agent:'planner',
    capability:'spec.propose',
    boundary:'human-review',
    risk:'high',
    maxAttempts:1,
    autoModes:[],
    writes:['plan'],
    outputs:['plan'],
    verifies:['human-review']
  },
  'review-decision': {
    key:'planner-human-gate',
    agent:'planner',
    capability:'spec.propose',
    boundary:'human-review',
    risk:'high',
    maxAttempts:1,
    autoModes:[],
    writes:[],
    outputs:['review'],
    verifies:['human-review']
  },
  'review-task': {
    key:'planner-human-gate',
    agent:'planner',
    capability:'spec.propose',
    boundary:'human-review',
    risk:'high',
    maxAttempts:1,
    autoModes:[],
    writes:[],
    outputs:['review'],
    verifies:['human-review']
  },
  'reevaluate-evidence': {
    key:'researcher-human-gate',
    agent:'researcher',
    capability:'evidence.record',
    boundary:'human-review',
    risk:'high',
    maxAttempts:1,
    autoModes:[],
    writes:['research'],
    outputs:['evidence-review'],
    verifies:['human-review']
  },
  review: {
    key:'orchestrator-human-gate',
    agent:'orchestrator',
    capability:'spec.propose',
    boundary:'human-review',
    risk:'high',
    maxAttempts:1,
    autoModes:[],
    writes:[],
    outputs:['review'],
    verifies:['human-review']
  }
};

const MODE_POLICIES = {
  Fast:{maxActions:8,maxRepairCycles:0,maxAttemptsPerAction:1},
  Balanced:{maxActions:16,maxRepairCycles:1,maxAttemptsPerAction:2},
  Powerful:{maxActions:24,maxRepairCycles:2,maxAttemptsPerAction:2},
  'Ask Me':{maxActions:24,maxRepairCycles:0,maxAttemptsPerAction:1},
  'Mostly Automatic':{maxActions:24,maxRepairCycles:2,maxAttemptsPerAction:2},
  Autonomous:{maxActions:40,maxRepairCycles:2,maxAttemptsPerAction:3}
};

const HUMAN_TYPES = new Set(['replan','review-decision','review-task','reevaluate-evidence','review']);

const clone = value => JSON.parse(JSON.stringify(value ?? null));
const bounded = (value,min,max,fallback) => Math.max(min,Math.min(max,Number(value ?? fallback)||fallback));

export function getExecutionPolicy(mode='Mostly Automatic'){
  const key=String(mode||'Mostly Automatic');
  const base=MODE_POLICIES[key]||MODE_POLICIES['Mostly Automatic'];
  return {mode:key,...base};
}

export function getExecutorDefinition(type){
  return clone(EXECUTOR_DEFS[String(type||'')]) || null;
}

export function selectExecutor(project={},action={}){
  const type=String(action?.type||'');
  const definition=getExecutorDefinition(type);
  if(!definition)return {selected:false,reason:'executor_not_registered'};
  const agents=Array.isArray(project?.agents)?project.agents:[];
  const configured=agents.find(a=>String(a?.key||a?.id||'')===definition.agent);
  if(definition.agent!=='orchestrator' && configured && configured.enabled===false){
    return {selected:false,reason:'executor_agent_disabled',definition};
  }
  return {selected:true,definition,agent:configured||{key:definition.agent,name:definition.agent}};
}

export function createActionContract(project={},action={},options={}){
  const policy=getExecutionPolicy(options.mode);
  const selected=selectExecutor(project,action);
  const definition=selected.definition||{};
  const targetVersion=Number(options.targetVersion??project?.specVersion??1);
  const actionTarget=String(action?.targetId||'');
  const preconditions=[
    {id:'project-version',check:'project.specVersion === queue.targetVersion',required:true},
    {id:'action-ready',check:'action.status === pending',required:true},
    {id:'executor-available',check:selected.selected,required:true}
  ];
  if(action.type==='update')preconditions.push({id:'target-file',check:'target file exists in project.files',required:true});
  if(action.type==='rebuild')preconditions.push({id:'build-surface',check:'artifact build surface is mounted',required:true});
  if(action.type==='verify')preconditions.push({id:'verification-input',check:'current project output or deliverable exists',required:true});
  const humanGate=HUMAN_TYPES.has(action.type)||definition.boundary==='human-review';
  const autoAllowed=!humanGate&&definition.autoModes?.includes(policy.mode);
  return {
    version:1,
    actionId:String(action?.id||''),
    type:String(action?.type||''),
    phase:String(action?.phase||'review'),
    targetId:actionTarget,
    targetVersion,
    executor:selected.selected?definition.key:null,
    agent:selected.selected?definition.agent:null,
    capability:definition.capability||null,
    boundary:definition.boundary||'unknown',
    risk:definition.risk||'high',
    preconditions,
    reads:action.type==='update'&&actionTarget
      ?['files:'+actionTarget]
      :action.type==='repair'
        ?(Array.isArray(action.repairPaths)?action.repairPaths.slice(0,12).map(p=>'files:'+p):['repair:'+String(action.targetId||'')])
        :['project:'+targetVersion],
    writes:action.type==='repair' ? (Array.isArray(action.repairPaths)?action.repairPaths.slice(0,12).map(p=>'file:'+p):[]) : (definition.writes||[]).slice(0,12),
    outputs:(definition.outputs||[]).slice(0,12),
    verification:(definition.verifies||[]).slice(0,12),
    idempotencyKey:'px:'+targetVersion+':'+String(action?.id||''),
    retryPolicy:{
      maxAttempts:Math.min(policy.maxAttemptsPerAction,Number(definition.maxAttempts||1)),
      maxRepairCycles:policy.maxRepairCycles,
      autoRepair:!humanGate&&['rebuild','update','verify'].includes(action.type)
    },
    diagnosisId:action.type==='repair' ? String(action?.diagnosis?.diagnosisId||'') : null,
    repairPaths:action.type==='repair' ? (Array.isArray(action?.repairPaths)?action.repairPaths.slice(0,12):[]) : [],
    humanReviewRequired:humanGate||!selected.selected,
    autoExecute: Boolean(autoAllowed&&selected.selected),
    limits:{
      maxActions:policy.maxActions,
      maxRepairCycles:policy.maxRepairCycles,
      maxAttemptsPerAction:Math.min(policy.maxAttemptsPerAction,Number(definition.maxAttempts||1))
    }
  };
}

export function createExecutionPlan(project={},queue={},options={}){
  const policy=getExecutionPolicy(options.mode);
  const actions=Array.isArray(queue?.actions)?queue.actions:[];
  const contracts=actions.slice(0,policy.maxActions).map(action=>createActionContract(project,action,{...options,mode:policy.mode,targetVersion:queue?.targetVersion}));
  return {
    version:1,
    queueId:String(queue?.id||''),
    mode:policy.mode,
    targetVersion:Number(queue?.targetVersion??project?.specVersion??1),
    maxActions:policy.maxActions,
    maxRepairCycles:policy.maxRepairCycles,
    generatedAt:new Date().toISOString(),
    contracts
  };
}

export function appendExecutionJournal(project={},entry={}){
  const current=Array.isArray(project?.executionState?.executionJournal)?project.executionState.executionJournal:[];
  const journal={
    id:String(entry?.id||('ej-'+Date.now()+'-'+Math.random().toString(36).slice(2,8))),
    at:new Date().toISOString(),
    actionId:entry?.actionId?String(entry.actionId):null,
    event:String(entry?.event||'execution'),
    status:entry?.status?String(entry.status):null,
    executor:entry?.executor?String(entry.executor):null,
    message:String(entry?.message||'').slice(0,800),
    evidence:Array.isArray(entry?.evidence)?entry.evidence.slice(0,12).map(clone):[],
    outputVersion:entry?.outputVersion==null?Number(project?.specVersion||1):Number(entry.outputVersion)
  };
  project.executionState={
    ...(project.executionState||{}),
    executionJournal:[...current,journal].slice(-120)
  };
  return journal;
}

export function canExecuteAction(contract={},context={}){
  if(!contract?.actionId)return {allowed:false,reason:'missing_action'};
  if(context?.projectVersion!=null&&Number(context.projectVersion)!==Number(contract.targetVersion))return {allowed:false,reason:'project_version_changed'};
  if(context?.actionStatus&&context.actionStatus!=='pending')return {allowed:false,reason:'action_not_pending'};
  if(context?.actionAttempts!=null&&Number(context.actionAttempts)>=Number(contract.retryPolicy?.maxAttempts||1))return {allowed:false,reason:'attempt_limit_reached'};
  if(contract.humanReviewRequired&&!context?.humanApproval)return {allowed:false,reason:'human_review_required'};
  if(contract.executor==null)return {allowed:false,reason:'executor_unavailable'};
  return {allowed:true};
}

export function shouldRepairAfterFailure(action={},contract={},policyOrMode='Mostly Automatic'){
  const policy=typeof policyOrMode==='string'?getExecutionPolicy(policyOrMode):getExecutionPolicy(policyOrMode?.mode);
  if(!contract?.retryPolicy?.autoRepair)return false;
  if(action?.type!=='verify')return false;
  const cycle=Number(action?.repairCycles||0);
  return cycle<policy.maxRepairCycles;
}

export function prepareReconciliationRepair(project={},actionId='',options={}){
  const queue=project?.executionState?.reconciliationQueue;
  if(!queue)return {reset:false,reason:'queue_missing'};
  const failed=queue.actions?.find(a=>a.id===actionId);
  if(!failed)return {reset:false,reason:'action_missing'};
  const policy=getExecutionPolicy(options.mode);
  const cycle=Number(queue?.execution?.repairCycles||0)+1;
  if(cycle>policy.maxRepairCycles)return {reset:false,reason:'repair_limit_reached'};
  const repairCandidates=queue.actions
    .filter(a=>a.status==='completed'&&['rebuild','update'].includes(a.type))
    .filter(a=>Number(a.attempts||0)<Math.min(policy.maxAttemptsPerAction,Number(getExecutorDefinition(a.type)?.maxAttempts||1)))
    .sort((a,b)=>Number(b.completedAt?new Date(b.completedAt).getTime():0)-Number(a.completedAt?new Date(a.completedAt).getTime():0));
  const repair=repairCandidates.find(a=>a.type==='rebuild')||repairCandidates[0];
  if(!repair)return {reset:false,reason:'no_repair_executor'};
  failed.status='pending';failed.error=null;failed.result=null;failed.repairCycles=cycle;failed.updatedAt=new Date().toISOString();
  repair.status='pending';repair.error=null;repair.result=null;repair.repairCycles=cycle;repair.completedAt=null;repair.updatedAt=new Date().toISOString();
  queue.status='pending';
  queue.completedAt=null;
  queue.updatedAt=new Date().toISOString();
  queue.execution={...(queue.execution||{}),repairCycles:cycle,lastRepairActionId:repair.id};
  project.executionState={...(project.executionState||{}),reconciliationQueue:queue,status:'reconciling'};
  appendExecutionJournal(project,{event:'repair_scheduled',actionId:failed.id,status:'pending',message:'Verification failed; a bounded repair cycle was scheduled.',evidence:[{failedAction:failed.id,repairAction:repair.id,cycle}],outputVersion:project.specVersion});
  return {reset:true,cycle,repairAction:repair,failedAction:failed};
}

export { HUMAN_TYPES };


export { diagnoseFailures, createRepairActionContract, scheduleRepairCycle };
