const OPS = new Set(["add","replace","remove","mark_uncertain"]);
const PATH_CLASSES = new Map([
  ["identity.title","identity"],["identity.type","identity"],
  ["context.intent","context"],["context.resources","context"],["context.discoveryAnswers","context"],
  ["classification.work_shape","classification"],["classification.domains","classification"],
  ["classification.outputs","classification"],["classification.execution_mode","classification"],
  ["classification.risk_level","classification"],["classification.confidence","classification"],
  ["classification.provenance","classification"],["classification.group","classification"],
  ["classification.label","classification"],["classification.reason","classification"],
  ["requirements.requirements","requirements"],["requirements.constraints","requirements"],
  ["requirements.assumptions","requirements"],["requirements.decisions","requirements"],
  ["requirements.openQuestions","requirements"],["requirements.dependencies","requirements"],
  ["requirements.deliverables","requirements"],["requirements.acceptanceCriteria","requirements"],
  ["requirements.successCriteria","requirements"],["workspace.sections","workspace"],
  ["execution.state","execution"],["execution.status","execution"],
  ["plan","plan"]
]);
const ARRAY_FIELDS = new Set([
  "requirements","constraints","assumptions","decisions","openQuestions",
  "dependencies","deliverables","acceptanceCriteria","successCriteria","users",
  "features","assets","technology"
]);
const clone = v => v === undefined ? undefined : JSON.parse(JSON.stringify(v));
const arr = v => Array.isArray(v) ? v : (v == null ? [] : [v]);
const uniq = xs => [...new Map(xs.map(v => [JSON.stringify(v), v])).values()];
function setNested(root,path,value){
  const parts=path.split(".");
  let cur=root;
  for(let i=0;i<parts.length-1;i++){
    const k=parts[i];
    if(!cur[k] || typeof cur[k] !== "object" || Array.isArray(cur[k])) cur[k]={};
    cur=cur[k];
  }
  cur[parts.at(-1)] = clone(value);
}
function getNested(root,path){
  return path.split(".").reduce((v,k)=>v==null?undefined:v[k],root);
}
function removeNested(root,path){
  const parts=path.split(".");
  let cur=root;
  for(let i=0;i<parts.length-1;i++){cur=cur?.[parts[i]]; if(!cur||typeof cur!=="object")return;}
  delete cur[parts.at(-1)];
}
function applyValue(current,kind,value){
  if(kind==="replace") return clone(value);
  if(kind==="add"){
    if(Array.isArray(current)) return uniq([...current,...arr(clone(value))]);
    return clone(value);
  }
  if(kind==="remove"){
    if(Array.isArray(current)){
      const removes=new Set(arr(value).map(v=>JSON.stringify(v)));
      return current.filter(v=>!removes.has(JSON.stringify(v)));
    }
    return undefined;
  }
  return current;
}
export function buildBrainSnapshot(project){
  return {
    identity:{title:project.title||"",goal:project.spec?.goal||project.intent||project.intention||"",desired_outcome:project.spec?.goal||""},
    context:{
      users:project.spec?.users||[],
      audience:project.spec?.users||[],
      current_situation:project.spec?.currentState||"",
      intent:project.intent||project.intention||project.spec?.goal||"",
      discoveryAnswers:project.understanding?.discoveryAnswers||[]
    },
    classification:project.understanding?.classification||project.classification||{},
    requirements:{
      functional:project.spec?.requirements||[],
      content:project.spec?.deliverables||[],
      quality:project.spec?.acceptanceCriteria||[]
    },
    constraints:project.spec?.constraints||[],
    assumptions:project.spec?.openQuestions||[],
    decisions:project.spec?.decisions||[],
    open_questions:project.spec?.openQuestions||[],
    dependencies:project.spec?.dependencies||[],
    deliverables:project.spec?.deliverables||[],
    acceptance_criteria:project.spec?.acceptanceCriteria||[],
    success_criteria:project.spec?.successCriteria||[],
    workspace:project.workspace||{sections:project.sections||[]},
    execution:{
      status:project.status||"draft",
      state:project.executionState||{},
      current_plan_version:project.specVersion||1,
      next_action:project.executionState?.nextAction||"",
      blockers:project.executionState?.blockers||[]
    },
    plan:Array.isArray(project.plan)?project.plan:[],
    risks:project.executionState?.risks||[],
    integrations:project.executionState?.integrations||[]
  };
}
export function validateBrainMutation(mutation, actor={}){
  const role=String(actor.role||"viewer").toLowerCase();
  if(!["owner","admin","editor"].includes(role)) return {ok:false,reason:"forbidden"};
  const ops=Array.isArray(mutation?.operations)?mutation.operations.slice(0,80):[];
  if(!ops.length) return {ok:false,reason:"missing_operations"};
  if(JSON.stringify(mutation).length>120000) return {ok:false,reason:"payload_too_large"};
  const invalid=[];
  for(const op of ops){
    const kind=String(op?.op||"");
    const path=String(op?.path||"");
    if(!OPS.has(kind)||!PATH_CLASSES.has(path)) invalid.push({op:kind,path});
  }
  return invalid.length?{ok:false,reason:"invalid_operation",invalid}:{ok:true};
}
export function applyBrainMutationToProject(project, mutation, actor={}){
  const check=validateBrainMutation(mutation,actor);
  if(!check.ok) return {applied:false,...check,project};
  const before=JSON.stringify(project);
  const next=clone(project);
  next.spec=clone(next.spec||{});
  next.understanding=clone(next.understanding||{});
  next.executionState=clone(next.executionState||{});
  for(const op of mutation.operations.slice(0,80)){
    const kind=String(op.op), path=String(op.path), value=clone(op.value);
    if(kind==="mark_uncertain"){
      const list=Array.isArray(next.executionState.uncertainties)?next.executionState.uncertainties:[];
      list.push({path,value,reason:String(op.reason||"Marked uncertain.").slice(0,300),provenance:clone(mutation.provenance||{})});
      next.executionState.uncertainties=list.slice(-80);
      continue;
    }
    if(path==="identity.title"){ if(kind!=="remove") next.title=String(value||"").slice(0,120); else next.title=""; continue; }
    if(path==="identity.type"){ if(kind!=="remove") next.type=String(value||"Other").slice(0,100); else next.type="Other"; continue; }
    if(path==="context.intent"){
      const v=kind==="remove"?"":String(value||"").slice(0,10000);
      next.intent=v; next.intention=v; next.spec.goal=v; continue;
    }
    if(path==="context.discoveryAnswers"){
      next.understanding.discoveryAnswers=kind==="remove"?[]:Array.isArray(value)?value.map(String).slice(0,100):[String(value||"")];
      continue;
    }
    if(path.startsWith("classification.")){
      const key=path.split(".").slice(1).join(".");
      const cur=next.understanding.classification||{};
      const out=applyValue(cur[key],kind,value);
      if(out===undefined) delete cur[key]; else cur[key]=out;
      next.understanding.classification=cur;
      continue;
    }
    if(path.startsWith("requirements.")){
      const map={
        "requirements.requirements":"requirements",
        "requirements.constraints":"constraints",
        "requirements.assumptions":"openQuestions",
        "requirements.decisions":"decisions",
        "requirements.openQuestions":"openQuestions",
        "requirements.dependencies":"dependencies",
        "requirements.deliverables":"deliverables",
        "requirements.acceptanceCriteria":"acceptanceCriteria",
        "requirements.successCriteria":"successCriteria"
      };
      const field=map[path], current=next.spec[field]||[];
      const out=applyValue(current,kind,value);
      next.spec[field]=Array.isArray(out)?out:[out].filter(v=>v!==undefined&&v!==null);
      continue;
    }
    if(path==="workspace.sections"){
      next.sections=kind==="remove"?[]:(Array.isArray(value)?value.slice(0,12):[]);
      next.workspace={...(next.workspace||{}),sections:next.sections};
      continue;
    }
    if(path==="execution.status"){
      next.status=kind==="remove"?"draft":String(value||"draft").slice(0,60);
      continue;
    }
    if(path==="execution.state"){
      next.executionState=kind==="remove"?{}:(value&&typeof value==="object"?clone(value):{});
      continue;
    }
    if(path==="plan"){
      next.plan=kind==="remove"?[]:(Array.isArray(value)?clone(value).slice(0,80):[]);
      continue;
    }
  }
  const changed=JSON.stringify(next)!==before;
  if(changed) next.specVersion=Number(project.specVersion||1)+1;
  if(mutation.provenance){
    next.understanding.provenance={...(next.understanding.provenance||{}),lastMutation:clone(mutation.provenance)};
  }
  return {applied:changed,changed,project:next,newVersion:next.specVersion||project.specVersion};
}
export function snapshotForPersistence(project){
  return {
    id:project.id,title:project.title,type:project.type,
    intention:project.intention||project.intent||project.spec?.goal||"",
    spec:clone(project.spec||{}),
    understanding:clone(project.understanding||{}),
    workspace:clone(project.workspace||{sections:project.sections||[]}),
    plan:clone(project.plan||[]),
    selectedSection:project.selectedSection||"chat",
    status:project.status||"planning",
    settings:{
      artifacts:clone(project.artifacts||{}),
      tests:clone(project.tests||{}),
      research:clone(project.research||{}),
      agents:clone(project.agents||[]),
      executionState:clone(project.executionState||{}),
      outputs:clone(project.outputs||{}),
      sectionContent:clone(project.sectionContent||{})
    },
    files:clone(project.files||{}),
    resources:clone(project.resources||[]),
    versions:clone(project.versions||[])
  };
}
