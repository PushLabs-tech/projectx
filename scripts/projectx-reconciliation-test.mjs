import assert from 'node:assert/strict';
import {
  createProject,
  applyProjectMutation,
  inputNodeIds,
  runVerification,
  createArtifactVersion,
  reconcileProjectChange,
  serializeForPersistence,
  restoreProjectSnapshot,
  createReconciliationRun,
  beginReconciliationAction,
  completeReconciliationAction,
  retryFailedReconciliation
} from '../projectx-core.js';

const project=createProject({
  title:'Sneaker cleaning launch',
  type:'Business',
  spec:{
    goal:'Launch a sneaker-cleaning service within 30 days',
    users:['students'],
    requirements:['Offer affordable cleaning','Provide pickup and drop-off'],
    constraints:['Budget: ₹20,000','Deadline: 30 days'],
    decisions:['Use a premium cleaning kit','Launch price ₹399'],
    deliverables:['Pricing page','Launch plan'],
    acceptanceCriteria:['Total launch cost stays within budget']
  }
});

project.executionState.tasks=[
  {
    id:'equipment-task',
    title:'Purchase premium cleaning kit',
    description:'Buy the selected equipment',
    status:'ready',
    dependencyNodeIds:['input:constraints'],
    affectedFiles:['pricing.html'],
    affectedArtifacts:['artifact:output']
  },
  {
    id:'brand-task',
    title:'Create brand guide',
    description:'Define visual identity',
    status:'done',
    dependencyNodeIds:['input:goal'],
    affectedFiles:['brand.md'],
    affectedArtifacts:['artifact:brand']
  }
];

project.artifacts={
  output:{
    kind:'document',
    summary:'Launch package',
    specVersion:project.specVersion,
    derivedFromVersion:project.specVersion,
    dependencyNodeIds:['input:constraints','input:requirements','input:decisions','input:deliverables'],
    filePaths:['pricing.html','launch-plan.md'],
    stale:false
  },
  brand:{
    kind:'document',
    summary:'Brand guide',
    specVersion:project.specVersion,
    derivedFromVersion:project.specVersion,
    dependencyNodeIds:['input:goal'],
    filePaths:['brand.md'],
    stale:false
  }
};
project.files={
  'pricing.html':'<html><body>₹399</body></html>',
  'launch-plan.md':'Launch plan'
};
project.tests={
  status:'passed',
  specVersion:project.specVersion,
  verifiedAgainstVersion:project.specVersion,
  results:[{
    id:'budget-check',
    name:'Budget feasibility',
    detail:'Cost fits budget',
    status:'passed',
    dependencyNodeIds:['input:constraints']
  }]
};

const beforeVersion=project.specVersion;
const verification=runVerification(project,[{name:'Budget feasibility',status:'passed',evidence:'Calculated total'}]);
assert.equal(verification.verifiedAgainstVersion,beforeVersion);

const artifactVersion=project.specVersion;
const artifact=createArtifactVersion(project,{key:'note',kind:'document',summary:'Decision note',filePaths:['note.md']});
assert.equal(artifact.specVersion,artifactVersion);
assert.equal(project.specVersion,artifactVersion,'artifact metadata must not bump project state version');

const mutation=applyProjectMutation(project,{
  specPatch:{constraints:{replace:['Budget: ₹8,000','Deadline: 30 days']}}
});
assert.equal(mutation.changed,true);
assert.equal(project.specVersion,beforeVersion+1);

const impact=mutation.impact;
assert.ok(impact,'mutation should produce a reconciliation record');
assert.ok(impact.changedNodes.some(n=>n.id==='input:constraints'));
assert.ok(impact.staleNodes.some(n=>n.id==='artifact:output'));
assert.ok(impact.staleNodes.some(n=>n.id==='file:pricing.html'));
assert.ok(impact.staleNodes.some(n=>n.id==='test:budget-feasibility'));
assert.ok(impact.reviewNodes.some(n=>n.id==='decision:launch-price-399'));
assert.ok(impact.invalidatedNodes.some(n=>n.id==='task:equipment-task'));
assert.ok(impact.actions.some(a=>/Rebuild|Review|Rerun/.test(a.label)));
assert.ok(impact.verification.some(v=>/Rebuild|Rerun|Recheck/.test(v.label)));

assert.equal(project.artifacts.output.stale,true,'budget change should stale dependent output');
assert.equal(project.artifacts.brand.stale,false,'brand artifact is scoped only to goal and should remain current');
assert.equal(project.executionState.reconciliation.targetVersion,project.specVersion);
assert.equal(project.tests.status,'stale');
assert.equal(project.tests.verifiedAgainstVersion,null);

const graphBefore=serializeForPersistence(project).impact;
assert.equal(graphBefore.stale.length>0,true);

const explicitPreview=reconcileProjectChange(
  {
    ...project,
    spec:{...project.spec,constraints:['Budget: ₹8,000','Deadline: 30 days']}
  },
  {
    ...project,
    spec:{...project.spec,constraints:['Budget: ₹6,000','Deadline: 30 days']},
    specVersion:project.specVersion+1
  }
);
assert.ok(explicitPreview.changedNodes.some(n=>n.id==='input:constraints'));
assert.ok(explicitPreview.affectedNodes.length>0);

const versionBeforeSecond=project.specVersion;
applyProjectMutation(project,{specPatch:{constraints:{replace:['Budget: ₹12,000','Deadline: 30 days']}}});
assert.equal(project.specVersion,versionBeforeSecond+1);
assert.equal(new Set(project.impact.edges.map(e=>e.from+'|'+e.to+'|'+e.relation)).size,project.impact.edges.length,'reconciliation graph should not duplicate edges');

const snapshot=JSON.parse(JSON.stringify({
  title:project.title,
  type:project.type,
  spec:project.spec,
  files:project.files,
  sections:project.sections,
  research:project.research,
  plan:project.plan,
  agents:project.agents,
  artifacts:project.artifacts,
  outputs:project.outputs,
  tests:project.tests,
  executionState:project.executionState
}));
const restored=restoreProjectSnapshot(project,{...snapshot,spec:{...snapshot.spec,goal:'Updated mission after restore'}});
assert.equal(restored.changed,true);
assert.ok(restored.impact);
assert.equal(project.tests.status,'stale');

console.log('PASS: field-level lineage survives replacements');
console.log('PASS: exact reconciliation reaches dependent work');
console.log('PASS: scoped artifacts can remain current');
console.log('PASS: verification becomes version-stale after mutation');
console.log('PASS: artifact metadata does not mutate project version');
console.log('PASS: repeated mutations do not duplicate graph edges');
console.log('PASS: restore recomputes reconciliation');
console.log('PROJECTX RECONCILIATION CONTRACT PASSED');


const queueRun=createReconciliationRun(project);
assert.ok(queueRun.queue,'a durable queue should exist after mutation');
assert.ok(queueRun.created||queueRun.reason==='queue_exists');
assert.ok(queueRun.queue.actions.length>0);
const firstReady=project.executionState.reconciliationQueue.actions.find(a=>a.status==='pending');
assert.ok(firstReady);
const started=beginReconciliationAction(project,firstReady.id);
assert.equal(started.started,true);
assert.equal(started.action.status,'running');
const finished=completeReconciliationAction(project,firstReady.id,{ok:true,message:'Synthetic reconciliation completed',evidence:['test harness']});
assert.equal(finished.completed,true);
assert.equal(project.executionState.reconciliationQueue.actions.find(a=>a.id===firstReady.id).status,'completed');
const failing=project.executionState.reconciliationQueue.actions.find(a=>a.status==='pending');
if(failing){beginReconciliationAction(project,failing.id);completeReconciliationAction(project,failing.id,{ok:false,error:'synthetic failure'});assert.equal(project.executionState.reconciliationQueue.status,'failed');const retry=retryFailedReconciliation(project);assert.equal(retry.reset,true);assert.equal(failing.status,'pending');}
const duplicate=createReconciliationRun(project);
assert.equal(duplicate.created,false);
console.log('PASS: reconciliation queue is durable and deduplicated');
console.log('PASS: action lifecycle supports execution results');
console.log('PASS: failed reconciliation actions can be retried');


const queueTarget=Number(project.executionState.reconciliationQueue.targetVersion);
const savedVersion=project.specVersion;
project.specVersion=savedVersion+1;
const staleStart=beginReconciliationAction(project,project.executionState.reconciliationQueue.actions.find(a=>a.status==='pending')?.id||'missing');
assert.equal(staleStart.started,false);
assert.equal(staleStart.reason,'queue_stale');
project.specVersion=savedVersion;
assert.equal(Number(project.executionState.reconciliationQueue.targetVersion),queueTarget);
console.log('PASS: stale queues cannot execute against a newer project version');
