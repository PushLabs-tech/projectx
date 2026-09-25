import assert from 'node:assert/strict';
import { createProject, assemblePreviewHtml } from '../projectx-core.js';
import { createRuntimeSandbox, isRuntimeSandboxMessage, normalizeRuntimeEvent, RUNTIME_SANDBOX_POLICY } from '../projectx-runtime-sandbox.js';

const files={
  'index.html':'<!doctype html><html><head><link rel="stylesheet" href="styles.css"></head><body><button id="go">Go</button><script src="app.js"></script></body></html>',
  'styles.css':'body{font-family:system-ui}',
  'app.js':'document.querySelector("#go").dataset.ready="1";'
};

const raw=assemblePreviewHtml(files,{channelId:'channel-test',sandboxed:true});
assert.match(raw,/Content-Security-Policy/);
assert.match(raw,/connect-src 'none'/);
assert.match(raw,/PROJECTX_RUNTIME_READY/);
assert.match(raw,/PROJECTX_RUNTIME_DONE/);
assert.match(raw,/PROJECTX_RUNTIME_BLOCKED_NETWORK/);
assert.match(raw,/channel-test/);

const sandbox=createRuntimeSandbox(files,{channelId:'channel-test',timeoutMs:4500});
assert.equal(sandbox.channelId,'channel-test');
assert.equal(sandbox.timeoutMs,4500);
assert.equal(sandbox.iframeAttributes.sandbox,'allow-scripts');
assert.equal(sandbox.iframeAttributes.referrerPolicy,'no-referrer');
assert.match(sandbox.srcdoc,/connect-src 'none'/);

const source={};
assert.equal(isRuntimeSandboxMessage({source,data:{type:'PROJECTX_RUNTIME_READY',channelId:'channel-test'}},'channel-test',source),true);
assert.equal(isRuntimeSandboxMessage({source:{},data:{type:'PROJECTX_RUNTIME_READY',channelId:'channel-test'}},'channel-test',source),false);
assert.equal(isRuntimeSandboxMessage({source,data:{type:'PROJECTX_RUNTIME_READY',channelId:'other'}},'channel-test',source),false);

const event=normalizeRuntimeEvent({type:'PROJECTX_RUNTIME_ERROR',message:'boom',stack:'at app.js:1',blockedUrl:'https://example.com',line:'3',column:'4'});
assert.equal(event.type,'PROJECTX_RUNTIME_ERROR');
assert.equal(event.message,'boom');
assert.equal(event.line,3);
assert.equal(event.column,4);

assert.equal(RUNTIME_SANDBOX_POLICY.sameOrigin,false);
assert.equal(RUNTIME_SANDBOX_POLICY.topNavigation,false);
assert.equal(RUNTIME_SANDBOX_POLICY.networkByDefault,false);

const p=createProject({title:'Sandbox test',type:'Website',spec:{goal:'Test isolated browser runtime',deliverables:['Website']}});
assert.ok(p);

console.log('PASS: runtime sandbox injects restrictive CSP and runtime telemetry');
console.log('PASS: preview iframe uses scripts-only sandbox attributes');
console.log('PASS: runtime messages require the expected source and channel');
console.log('PASS: runtime events normalize bounded evidence');
console.log('PASS: sandbox policy denies same-origin, navigation, and network by default');
console.log('PROJECTX RUNTIME SANDBOX CONTRACT PASSED');
