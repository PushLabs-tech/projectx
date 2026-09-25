import assert from 'node:assert/strict';
import {
  sanitizeTransactionPath,
  validateTransactionOperations,
  createExecutionTransaction,
  applyTransaction,
  rollbackTransaction,
  transactionDigest
} from '../projectx-transaction.js';

const project={
  specVersion:9,
  files:{
    'index.html':'<html><body>before</body></html>',
    'app.js':'console.log("before")'
  }
};
const contract={type:'repair',targetId:'diag-1',targetVersion:9,repairPaths:['index.html','app.js']};

assert.equal(sanitizeTransactionPath(' /src/app.js '),'src/app.js');
assert.equal(sanitizeTransactionPath('../secret'),null);
assert.equal(sanitizeTransactionPath('https://example.com/x'),null);
assert.equal(sanitizeTransactionPath(''),null);

const validated=validateTransactionOperations(project,contract,[
  {op:'write',path:'index.html',content:'<html><body>after</body></html>'},
  {op:'write',path:'app.js',content:'console.log("after")'}
]);
assert.equal(validated.ok,true);
assert.equal(validated.summary.filesChanged,2);

const tx=createExecutionTransaction(project,contract,[
  {op:'write',path:'index.html',content:'<html><body>after</body></html>'},
  {op:'write',path:'app.js',content:'console.log("after")'}
],{transactionId:'tx-test-1',jobId:'job-test'});
assert.equal(tx.ok,true);
assert.equal(tx.transaction.status,'prepared');
assert.equal(tx.transaction.transactionId,'tx-test-1');
assert.equal(tx.transaction.inverseOperations.length,2);
assert.equal(transactionDigest(tx.transaction),transactionDigest({...tx.transaction}));

const applied=applyTransaction(project,tx.transaction);
assert.equal(applied.files['index.html'],'<html><body>after</body></html>');
assert.equal(applied.files['app.js'],'console.log("after")');

const rolled=rollbackTransaction(applied,tx.transaction);
assert.equal(rolled.ok,true);
assert.equal(rolled.project.files['index.html'],project.files['index.html']);
assert.equal(rolled.project.files['app.js'],project.files['app.js']);

const conflict=rollbackTransaction({...applied,files:{...applied.files,'app.js':'changed-later'}},tx.transaction);
assert.equal(conflict.ok,false);
assert.equal(conflict.reason,'rollback_conflict');
assert.deepEqual(conflict.conflicts,[{path:'app.js',reason:'current_file_differs_from_transaction_output'}]);

const noop=validateTransactionOperations(project,contract,[
  {op:'write',path:'index.html',content:project.files['index.html']}
]);
assert.equal(noop.ok,true);
assert.equal(noop.noop,true);
assert.equal(noop.operations.length,0);

const outside=validateTransactionOperations(project,contract,[
  {op:'write',path:'README.md',content:'not allowed'}
]);
assert.equal(outside.ok,false);
assert.equal(outside.reason,'outside_action_contract');

const duplicate=validateTransactionOperations(project,contract,[
  {op:'write',path:'index.html',content:'a'},
  {op:'write',path:'index.html',content:'b'}
]);
assert.equal(duplicate.ok,false);
assert.equal(duplicate.reason,'duplicate_path');

console.log('PASS: transaction paths are sanitized and contract scoped');
console.log('PASS: transaction diffs capture changed paths and inverse operations');
console.log('PASS: local transaction apply/rollback is deterministic');
console.log('PASS: rollback refuses to overwrite later file changes');
console.log('PASS: no-op and duplicate transactions are rejected safely');
console.log('PROJECTX TRANSACTIONAL EXECUTION CONTRACT PASSED');

const addedProject={specVersion:9,files:{}}; 
const addedTx=createExecutionTransaction(addedProject,{...contract,repairPaths:['new.js']},[
  {op:'write',path:'new.js',content:'export const ok=true;'}
]);
assert.equal(addedTx.ok,true);
assert.deepEqual(addedTx.transaction.inverseOperations,[{op:'delete',path:'new.js'}]);
const deletedTx=createExecutionTransaction(project,{...contract,repairPaths:['app.js']},[
  {op:'delete',path:'app.js'}
]);
assert.equal(deletedTx.ok,true);
assert.deepEqual(deletedTx.transaction.inverseOperations,[{op:'write',path:'app.js',content:project.files['app.js']}]);
