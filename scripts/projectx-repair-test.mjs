import assert from 'node:assert/strict';
import {
  diagnoseFailures,
  createRepairContract,
  createRepairAction,
  scheduleRepairCycle
} from '../projectx-repair.js';
import {
  createActionContract,
  getExecutionPolicy
} from '../projectx-execution.js';

const project={
  specVersion:4,
  type:'Website',
  files:{
    'index.html':'<html><body><script>eval("x")</script></body></html>',
    'app.js':'console.log("ok")',
    'README.md':'Project'
  },
  executionState:{
    reconciliationQueue:{
      id:'rq-4',
      baseVersion:4,
      targetVersion:4,
      status:'pending',
      actions:[{
        id:'reconcile:test-browser',
        targetId:'test:browser',
        type:'verify',
        phase:'verify',
        label:'Browser runtime',
        confidence:0.9,
        status:'failed',
        attempts:1,
        dependsOn:[],
        result:null,
        error:'runtime',
        createdAt:new Date().toISOString(),
        updatedAt:new Date().toISOString()
      }],
      execution:{repairCycles:0},
      summary:''
    }
  }
};

const failures=[
  {name:'Browser runtime',checkType:'local',status:'fail',pass:false,detail:'Runtime error in index.html',affectedFiles:['index.html']},
  {name:'No eval constructors',checkType:'security',status:'fail',pass:false,blockBuild:true,detail:'Generated files are scanned for eval/new Function.',affectedFiles:['index.html']}
];
const diagnosis=diagnoseFailures(project,failures,{});
assert.equal(diagnosis.status,'actionable');
assert.equal(diagnosis.category,'security');
assert.deepEqual(diagnosis.affectedFiles,['index.html']);
assert.deepEqual(diagnosis.repairPaths,['index.html']);
assert.equal(diagnosis.targetVersion,4);
assert.match(diagnosis.constraints.join(' '),/Modify only files/);

const action=createRepairAction(project,project.executionState.reconciliationQueue.actions[0],diagnosis,1);
assert.equal(action.type,'repair');
assert.deepEqual(action.repairPaths,['index.html']);
assert.equal(action.repairCycle,1);

const contract=createRepairContract(project,diagnosis,action,getExecutionPolicy('Mostly Automatic'));
assert.equal(contract.type,'repair');
assert.equal(contract.executor,'builder-repair-ai');
assert.equal(contract.agent,'repairer');
assert.equal(contract.failureCategory,'security');
assert.deepEqual(contract.repairPaths,['index.html']);
assert.equal(contract.humanReviewRequired,false);

const executionContract=createActionContract(project,action,{mode:'Mostly Automatic',targetVersion:4});
assert.equal(executionContract.executor,'builder-repair-ai');
assert.equal(executionContract.agent,'repairer');
assert.deepEqual(executionContract.repairPaths,['index.html']);
assert.equal(executionContract.writes[0],'file:index.html');

const scheduled=scheduleRepairCycle(project,'reconcile:test-browser',failures,getExecutionPolicy('Mostly Automatic'));
assert.equal(scheduled.scheduled,true);
assert.equal(scheduled.cycle,1);
assert.equal(scheduled.diagnosis.category,'security');
assert.equal(scheduled.repairAction.type,'repair');
assert.equal(project.executionState.reconciliationQueue.status,'pending');
assert.equal(project.executionState.reconciliationQueue.execution.repairCycles,1);

const queue=project.executionState.reconciliationQueue;
const repair=queue.actions.find(a=>a.type==='repair');
const verify=queue.actions.find(a=>a.id==='reconcile:test-browser');
assert.ok(repair);
assert.deepEqual(verify.dependsOn,[repair.id]);
assert.equal(verify.status,'pending');
assert.equal(verify.failureHistory.length,1);
assert.equal(project.executionState.repairHistory.length,1);

const blocked=scheduleRepairCycle(project,'reconcile:test-browser',failures,{...getExecutionPolicy('Mostly Automatic'),maxRepairCycles:1});
assert.equal(blocked.scheduled,false);
assert.equal(blocked.reason,'repair_limit_reached');

console.log('PASS: verifier failures become structured, file-scoped diagnoses');
console.log('PASS: repair contracts declare explicit paths, executor, evidence, and verification');
console.log('PASS: repair actions are inserted before verification with dependency ordering');
console.log('PASS: repair history preserves prior failure evidence without losing the verification gate');
console.log('PASS: repair cycles respect execution-mode limits');
console.log('PROJECTX SELF-HEALING CONTRACT PASSED');
