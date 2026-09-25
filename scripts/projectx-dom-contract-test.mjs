import assert from 'node:assert/strict';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const runtime = fs.readFileSync(new URL('../px-final.js', import.meta.url), 'utf8');
const ui = fs.readFileSync(new URL('../px-ui.js', import.meta.url), 'utf8');
const appCss = fs.readFileSync(new URL('../px-app.css', import.meta.url), 'utf8');
const edge = fs.readFileSync(new URL('../supabase/functions/ai/index.ts', import.meta.url), 'utf8');
const index = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const surface = runtime + ui;

const domIds = [
  'px-app',
  'px-style',
  'interview-poll',
  'interview-status',
  'project-body',
  'project-frame',
];

for (const id of domIds) {
  assert.match(surface, new RegExp(`id="${id}"|id='${id}'|#${id}`), `runtime must reference #${id}`);
}

assert.match(runtime, /function ensureShell\(\)/);
assert.match(runtime, /function installCss\(\)/);
assert.match(runtime, /root\.id='px-app'|id="px-app"/);
assert.match(runtime, /link\.id='px-style'|style\.id='px-style'|id=['"]px-style['"]/);

assert.match(surface, /id="interview-poll"/);
assert.match(surface, /id="interview-status"/);
assert.match(surface, /id="project-body"/);
assert.match(surface, /id="project-frame"/);

assert.match(ui, /id="px-project-switch"/);
assert.match(ui, /id="px-bottom"/);
assert.match(ui, /id="assistant-dock-form"/);
assert.match(ui, /id="plan-dock-form"/);
assert.match(ui, /id="start-input"/);
assert.match(ui, /px-hero|px-product-shot/);
assert.match(ui, /Continue the work/);
assert.match(ui, /CORE_NAV = \['overview', 'build', 'preview', 'files', 'settings'\]/);\nassert.match(ui, /PROJECT AGENT/);\nassert.match(ui, /What are you building\?/);
assert.match(ui, /replit-shell/);
assert.match(ui, /More tools/);
assert.match(runtime, /px-home-hero/);
assert.match(runtime, /Build with AI/);
assert.match(runtime, /function openMoreTools\(/);

assert.doesNotMatch(ui, /ExecutionProvider/);
assert.match(runtime, /applyChromeLayout/);
assert.match(runtime, /px-ide/);
assert.match(appCss, /\.project\.px-work/);

assert.match(runtime, /function validDiscoveryPollLocal/);
assert.match(runtime, /Describe in your own words/);
assert.match(runtime, /options\.length!==4/);
assert.match(runtime, /renderedOptions=\[\.\.\.options,'Describe in your own words'\]/);

assert.match(ui, /export function authMarkup/);
assert.match(ui, /id="auth-email"/);
assert.match(ui, /id="auth-submit"/);
assert.match(ui, /Tell ProjectX what you want to accomplish/);
assert.match(ui, /UNIVERSAL AI WORKSPACE/);
assert.match(runtime, /function publicHome\(/);
assert.match(runtime, /function workspaceHome\(/);
assert.match(runtime, /function authScreen\(/);
assert.match(runtime, /state\.forceWorkspace\|\|state\.projects\.length\)return workspaceHome\(\)/);
assert.match(runtime, /authScreen\('signup'\)/);

assert.match(runtime, /window\.ProjectX=\{/);
assert.match(runtime, /state:\(\)=>state/);
assert.match(runtime, /openProject/);
assert.match(runtime, /refresh:boot/);

assert.match(runtime, /sandbox="allow-scripts"/);
assert.match(runtime, /referrerpolicy="no-referrer"/);
assert.match(runtime, /PROJECTX_SANDBOX_EVENT/);
assert.match(runtime, /runtimeVerification/);

const actionMatch = edge.match(/const ACTIONS = new Set\(\[([\s\S]*?)\]\)/);
assert.ok(actionMatch, 'Edge ACTIONS set must exist');
const actions = actionMatch[1].match(/"([^"]+)"/g).map(s => s.slice(1, -1));
const requiredActions = [
  'chat',
  'research',
  'persistProject',
  'listProjects',
  'getProject',
  'createProjectFromIntent',
  'generateDiscoveryPoll',
  'applyBrainMutation',
  'createPlan',
  'listCredentials',
  'saveCredential',
  'listModels',
];
for (const action of requiredActions) {
  assert.ok(actions.includes(action), `Edge action missing: ${action}`);
assert.ok(actions.includes('rollbackExecutionTransaction'), 'Edge rollback action missing');
}

assert.doesNotMatch(index, /styles\.css/);
assert.match(index, /px-final\.js/);

assert.ok(fs.existsSync(fileURLToPath(new URL('../px-app.css', import.meta.url))), 'px-app.css must exist');
assert.match(appCss, /#px-app\{/, 'px-app.css must contain live shell rules');
assert.match(runtime, /px-app\.css/);
assert.doesNotMatch(runtime, /const CSS = `/);

console.log('PASS DOM id contract anchors');
console.log('PASS extracted px-app.css stylesheet contract');
console.log('PASS discovery poll 4+1 contract');
console.log('PASS public vs signed-in home contract');
console.log('PASS ProjectX window API contract');
console.log('PASS preview sandbox contract');
console.log('PASS Edge action name contract');
console.log('PROJECTX DOM CONTRACT PASSED');
