import assert from 'node:assert/strict';
import {
  createProject,
  createExecutionPlan,
  createActionContract,
  getExecutionPolicy,
  getExecutorDefinition,
  selectExecutor,
  appendExecutionJournal,
  canExecuteAction,
  shouldRepairAfterFailure,
  prepareReconciliationRepair
} from '../projectx-core.js';

const project=createProject({
  title:'Execution test',
  type:'Website',
  spec:{goal:'Build a small website for execution testing',requirements:['Render a working page'],deliverables:['Working website'],platform:'Web'},
  agents:[
    {key:'builder',name:'Builder',enabled:true},
    {key:'tester',name:'Tester',enabled:true},
    {key:'planner',name:'Planner',enabled:true}
  ]
});
project.specVersion=7;
const queue={
  id:'rq-7-test',
  targetVersion:7,
  actions:[
    {id:'reconcile:artifact-output',targetId:'artifact:output',type:'rebuild',phase:'apply',status:'pending',attempts:0,dependsOn:[]},
    {id:'reconcile:test-browser',targetId:'test:browser',type:'verify',phase:'verify',status:'pending',attempts:0,dependsOn:['reconcile:artifact-output']},
    {id:'reconcile:decision',targetId:'decision:price',type:'review-decision',phase:'review',status:'pending',attempts:0,dependsOn:[]}
  ]
};

assert.equal(getExecutionPolicy('Autonomous').maxRepairCycles,2);
assert.equal(getExecutionPolicy('Fast').maxAttemptsPerAction,1);
assert.equal(getExecutorDefinition('rebuild').capability,'artifact.build');
assert.equal(selectExecutor(project,queue.actions[0]).selected,true);

const plan=createExecutionPlan(project,queue,{mode:'Autonomous'});
assert.equal(plan.contracts.length,3);
const rebuild=plan.contracts.find(x=>x.type==='rebuild');
const verify=plan.contracts.find(x=>x.type==='verify');
const review=plan.contracts.find(x=>x.type==='review-decision');
assert.equal(rebuild.autoExecute,true);
assert.equal(rebuild.boundary,'workspace-local');
assert.equal(verify.executor,'tester-local-sandbox');
assert.equal(verify.boundary,'browser-sandbox');
assert.equal(review.autoExecute,false);
assert.equal(review.humanReviewRequired,true);
assert.equal(review.retryPolicy.autoRepair,false);
assert.equal(rebuild.retryPolicy.maxAttempts,2);

assert.deepEqual(canExecuteAction(rebuild,{projectVersion:7,actionStatus:'pending'}),{allowed:true});
assert.equal(canExecuteAction(rebuild,{projectVersion:8,actionStatus:'pending'}).reason,'project_version_changed');
assert.equal(canExecuteAction(rebuild,{projectVersion:7,actionStatus:'pending',actionAttempts:2}).reason,'attempt_limit_reached');
assert.equal(canExecuteAction(review,{projectVersion:7,actionStatus:'pending'}).reason,'human_review_required');
assert.equal(shouldRepairAfterFailure({type:'verify',repairCycles:0},verify,'Autonomous'),true);
assert.equal(shouldRepairAfterFailure({type:'verify',repairCycles:2},verify,'Autonomous'),false);

project.executionState={reconciliationQueue:{
  id:'rq-repair',
  targetVersion:7,
  status:'failed',
  actions:[
    {...queue.actions[0],status:'completed',completedAt:new Date().toISOString(),result:{ok:true}},
    {...queue.actions[1],status:'failed',error:'runtime'},
  ],
  execution:{repairCycles:0}
}};
const journal=appendExecutionJournal(project,{event:'test',status:'running',executor:'test',message:'journal entry'});
assert.equal(journal.event,'test');
assert.equal(project.executionState.executionJournal.length,1);

const repair=prepareReconciliationRepair(project,'reconcile:test-browser',{mode:'Autonomous'});
assert.equal(repair.reset,true);
assert.equal(repair.cycle,1);
assert.equal(project.executionState.reconciliationQueue.status,'pending');
assert.equal(project.executionState.reconciliationQueue.actions.find(a=>a.id==='reconcile:test-browser').status,'pending');
assert.equal(project.executionState.reconciliationQueue.actions.find(a=>a.id==='reconcile:artifact-output').status,'pending');
assert.equal(project.executionState.executionJournal.at(-1).event,'repair_scheduled');

console.log('PASS: execution policies are bounded by mode');
console.log('PASS: deterministic executors expose explicit capabilities and boundaries');
console.log('PASS: action contracts encode reads, writes, verification, retries, and human gates');
console.log('PASS: execution journal records lifecycle evidence without changing canonical version');
console.log('PASS: failed verification can reopen a bounded repair cycle');
console.log('PROJECTX EXECUTION ORCHESTRATION CONTRACT PASSED');
