const MAX_FILE_BYTES=600000;
const MAX_FILE_COUNT=12;
const MAX_TOTAL_BYTES=4000000;

const clone=value=>JSON.parse(JSON.stringify(value??null));
const text=value=>String(value??'');

export function sanitizeTransactionPath(value){
  const path=text(value).replace(/\\/g,'/').replace(/^\/+/,'').trim();
  if(!path||path.includes('..')||path.includes('\\0')||/^[a-z][a-z0-9+.-]*:\/\//i.test(path)) return null;
  const clean=path.split('/').filter(Boolean).join('/');
  return clean&&clean.length<=180?clean:null;
}

function digest(value){
  const s=typeof value==='string'?value:JSON.stringify(value??null);
  let h=2166136261;
  for(let i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,16777619);}
  return (h>>>0).toString(16).padStart(8,'0');
}

function allowedPath(contract,path){
  const type=text(contract?.type);
  if(type==='update') return path===text(contract?.targetId).replace(/^file:/,'');
  if(type==='repair') return Array.isArray(contract?.repairPaths)&&contract.repairPaths.map(text).includes(path);
  const writes=Array.isArray(contract?.writes)?contract.writes.map(text):[];
  return writes.includes('files')||writes.includes('target-file')||type==='rebuild';
}

export function validateTransactionOperations(project={},contract={},operations=[]){
  const files=project?.files&&typeof project.files==='object'?project.files:{};
  const ops=Array.isArray(operations)?operations:[];
  if(ops.length>MAX_FILE_COUNT) return {ok:false,reason:'too_many_operations'};
  const seen=new Set();
  const normalized=[];
  const inverse=[];
  const changedPaths=[];
  const added=[];
  const deleted=[];
  const modified=[];
  let beforeBytes=0,afterBytes=0;

  for(const raw of ops){
    const op=text(raw?.op);
    const path=sanitizeTransactionPath(raw?.path);
    if(!path)return {ok:false,reason:'unsafe_file_path'};
    if(seen.has(path))return {ok:false,reason:'duplicate_path',path};
    seen.add(path);
    if(!allowedPath(contract,path))return {ok:false,reason:'outside_action_contract',path};

    const beforeExists=Object.prototype.hasOwnProperty.call(files,path);
    const before=beforeExists?text(files[path]):null;
    if(beforeExists)beforeBytes+=before.length;

    if(op==='write'){
      const after=text(raw?.content);
      if(after.length>MAX_FILE_BYTES)return {ok:false,reason:'file_too_large',path};
      afterBytes+=after.length;
      if(beforeExists&&before===after)continue;
      normalized.push({op:'write',path,content:after,before:before,beforeExists});
      inverse.unshift(beforeExists?{op:'write',path,content:before}:{op:'delete',path});
      changedPaths.push(path);
      if(beforeExists)modified.push(path);else added.push(path);
    }else if(op==='delete'){
      if(!beforeExists)return {ok:false,reason:'delete_missing_file',path};
      normalized.push({op:'delete',path,before, beforeExists:true});
      inverse.unshift({op:'write',path,content:before});
      changedPaths.push(path);
      deleted.push(path);
    }else{
      return {ok:false,reason:'unsupported_operation',path};
    }
  }

  const totalBytes=normalized.reduce((sum,op)=>sum+(op.op==='write'?text(op.content).length:0),0);
  if(totalBytes>MAX_TOTAL_BYTES)return {ok:false,reason:'transaction_too_large'};

  return {
    ok:true,
    operations:normalized.map(({before,beforeExists,...op})=>op),
    inverseOperations:inverse,
    changedPaths:[...new Set(changedPaths)],
    summary:{
      filesChanged:changedPaths.length,
      added:added.length,
      modified:modified.length,
      deleted:deleted.length,
      beforeBytes,
      afterBytes,
      deltaBytes:afterBytes-beforeBytes,
      totalWriteBytes:totalBytes
    },
    noop:normalized.length===0
  };
}

export function createExecutionTransaction(project={},contract={},operations=[],meta={}){
  const validation=validateTransactionOperations(project,contract,operations);
  if(!validation.ok)return validation;
  if(validation.noop)return {...validation,transaction:null};
  const targetVersion=Number(contract?.targetVersion??project?.specVersion??1);
  const transaction={
    version:1,
    transactionId:text(meta.transactionId)||('tx:'+text(contract?.actionId||'action')+':'+digest({targetVersion,paths:validation.changedPaths,ops:validation.operations})),
    projectVersion:targetVersion,
    actionId:text(contract?.actionId),
    jobId:meta.jobId?text(meta.jobId):null,
    baseVersion:targetVersion,
    status:'prepared',
    operations:validation.operations.map(clone),
    inverseOperations:validation.inverseOperations.map(clone),
    changedPaths:validation.changedPaths.slice(0,MAX_FILE_COUNT),
    summary:clone(validation.summary),
    createdAt:meta.createdAt||new Date().toISOString(),
    committedAt:null,
    rolledBackAt:null
  };
  return {...validation,transaction};
}

export function applyTransaction(project={},transaction={}){
  const next=clone(project);
  next.files={...(next.files||{})};
  for(const op of Array.isArray(transaction.operations)?transaction.operations:[]){
    if(op.op==='write')next.files[op.path]=text(op.content);
    else if(op.op==='delete')delete next.files[op.path];
  }
  return next;
}

export function rollbackTransaction(project={},transaction={}){
  const conflicts=[];
  const files=project?.files&&typeof project.files==='object'?project.files:{};
  for(const op of Array.isArray(transaction.operations)?transaction.operations:[]){
    if(op.op==='write'){
      const currentExists=Object.prototype.hasOwnProperty.call(files,op.path);
      const current=currentExists?text(files[op.path]):null;
      if(!currentExists||current!==text(op.content)) conflicts.push({path:op.path,reason:'current_file_differs_from_transaction_output'});
    }else if(op.op==='delete'){
      if(!Object.prototype.hasOwnProperty.call(files,op.path)) conflicts.push({path:op.path,reason:'file_already_deleted_or_changed'});
    }
  }
  if(conflicts.length)return {ok:false,reason:'rollback_conflict',conflicts};
  const next=clone(project);
  next.files={...(next.files||{})};
  for(const op of Array.isArray(transaction.inverseOperations)?transaction.inverseOperations:[]){
    if(op.op==='write')next.files[op.path]=text(op.content);
    else if(op.op==='delete')delete next.files[op.path];
  }
  return {ok:true,project:next,changedPaths:Array.isArray(transaction.changedPaths)?transaction.changedPaths.slice():[]};
}

export function transactionDigest(transaction={}){
  return digest({actionId:transaction.actionId,baseVersion:transaction.baseVersion,operations:transaction.operations,inverseOperations:transaction.inverseOperations});
}
