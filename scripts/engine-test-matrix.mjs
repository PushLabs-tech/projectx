import {
  createProject,
  discoverCapabilities,
  addRequirement,
  addDecision,
  indexResource,
  retrieveResources,
  assembleAgents,
  executeAgents,
  buildArtifact,
  staticSandboxCheck,
  browserTest,
  syntheticUsers,
  runSyntheticUsers,
  verify,
  repair,
  selfHeal,
  transform,
  deploy,
  compile,
  collaborate,
  observe,
  routeAI,
  handle429,
  cooldownActive,
  analyzeChangeImpact
} from '../universal-engine.js';

let passedCount = 0;
let failedCount = 0;

function assert(condition, message) {
  if (condition) {
    passedCount++;
    console.log(`  PASS: ${message}`);
  } else {
    failedCount++;
    console.error(`  FAIL: ${message}`);
  }
}

console.log('\n========================================');
console.log('UNIVERSAL CREATION ENGINE - TEST MATRIX');
console.log('========================================\n');

// 1. Simple landing page
console.log('--- 1. Simple landing page ---');
const landingProj = createProject('Make a modern landing page for a SaaS platform');
assert(landingProj.kind === 'web', 'Classified as web');
assert(Boolean(landingProj.artifacts['index.html']), 'Generated index.html');
const landingTests = browserTest(landingProj);
assert(landingTests.every(t => t.status === 'passed' || t.status === 'warn'), 'All browser tests pass');

// 2. Ecommerce store
console.log('\n--- 2. Ecommerce store ---');
const storeProj = createProject('Build a premium sneaker store with inventory and cart');
assert(storeProj.kind === 'commerce', 'Classified as commerce');
assert(storeProj.artifacts['index.html'].includes('Cart'), 'Includes cart UI');
assert(storeProj.artifacts['app.js'].includes('checkoutModal'), 'Includes checkout modal');
const storeUsers = runSyntheticUsers(storeProj, syntheticUsers(storeProj, 3));
assert(storeUsers.every(u => u.completed), 'Synthetic shoppers completed journeys');

// 3. Game
console.log('\n--- 3. Game ---');
const gameProj = createProject('Make a playable Flappy Bird arcade game');
assert(gameProj.kind === 'game', 'Classified as game');
assert(Boolean(gameProj.artifacts['game.js']), 'Includes dedicated game.js loop');
assert(gameProj.artifacts['index.html'].includes('canvas'), 'Includes canvas tag');

// 4. AI agent
console.log('\n--- 4. AI agent ---');
const agentProj = createProject('Create an autonomous AI customer support agent');
assert(agentProj.kind === 'agent', 'Classified as agent');
assert(agentProj.artifacts['index.html'].includes('chat-container'), 'Includes chat UI');
assert(agentProj.artifacts['app.js'].includes('resetChat'), 'Includes memory reset handler');

// 5. Research application
console.log('\n--- 5. Research application ---');
const researchProj = createProject('Build a medical research platform for clinical papers');
assert(researchProj.kind === 'research', 'Classified as research');
assert(researchProj.artifacts['index.html'].includes('Citations'), 'Includes citation viewer');
assert(researchProj.artifacts['app.js'].includes('exportBibtex'), 'Includes BibTeX export handler');

// 6. CSV/data application
console.log('\n--- 6. CSV/data application ---');
const dataProj = createProject('Turn this CSV into an interactive analytics dashboard');
assert(dataProj.kind === 'data', 'Classified as data');
assert(dataProj.artifacts['index.html'].includes('metricChart'), 'Includes SVG metric chart');
assert(dataProj.artifacts['app.js'].includes('exportCsv'), 'Includes CSV export');

// 7. Unknown request
console.log('\n--- 7. Unknown request ---');
const unknownProj = createProject('I do not know what I need. Figure it out.');
assert(unknownProj.capabilities.length >= 4, 'Discovered and composed dynamic capabilities');
assert(Boolean(unknownProj.artifacts['index.html']), 'Generated working outcome despite ambiguous intent');

// 8. Resource ingestion
console.log('\n--- 8. Resource ingestion ---');
const res = indexResource(storeProj, {
  name: 'products.csv',
  content: 'sku,name,price\nSKU-1,Running Shoe,120\nSKU-2,Trail Shoe,140'
});
assert(res.parsedData.rowCount === 2, 'Parsed CSV rows accurately');
const found = retrieveResources(storeProj, 'running');
assert(found.length > 0 && found[0].name === 'products.csv', 'Indexed and retrieved resource by keyword');

// 9. Transformation
console.log('\n--- 9. Transformation ---');
const transformed = transform(storeProj, 'mobile');
assert(transformed.kind === 'mobile', 'Transformed kind to mobile');
assert(transformed.transformation.status === 'verified', 'Transformation verified');

// 10. Self-healing
console.log('\n--- 10. Self-healing ---');
const buggyProj = createProject('A simple webpage');
// Inject deliberate errors
buggyProj.artifacts['index.html'] = '<html><body>Missing doctype and title <a href="http://insecure.com">link</a></body></html>';
delete buggyProj.artifacts['app.js'];
const healResult = selfHeal(buggyProj);
assert(healResult.passed, 'Self-healing resolved all injected defects');
assert(buggyProj.artifacts['index.html'].startsWith('<!doctype html>'), 'Repaired missing doctype');
assert(buggyProj.artifacts['index.html'].includes('https://insecure.com'), 'Repaired insecure http protocol');

// 11. Regression testing
console.log('\n--- 11. Regression testing ---');
const regressionCheck = browserTest(buggyProj);
assert(regressionCheck.every(c => c.status === 'passed' || c.status === 'warn'), 'Zero regressions after repair');

// 12. Export
console.log('\n--- 12. Export ---');
assert(Object.keys(storeProj.artifacts).length >= 3, 'Export artifacts bundle complete');

// 13. Persistence
console.log('\n--- 13. Persistence ---');
const impact = analyzeChangeImpact(storeProj, 'Add multiplayer chat');
assert(impact.capabilities.includes('realtime'), 'Impact analysis detected affected realtime capability');

// 14. RLS & Sandbox isolation
console.log('\n--- 14. Sandbox isolation ---');
const sandbox = staticSandboxCheck(storeProj);
assert(sandbox.isolated && sandbox.network === 'disabled', 'Sandbox is strictly isolated');

// 15. Collaboration
console.log('\n--- 15. Collaboration ---');
const col = collaborate(storeProj, { user: 'tester', action: 'comment', text: 'Looks great' });
assert(col.id && storeProj.collaboration.length > 0, 'Recorded collaboration event');

// 16. Deployment lifecycle
console.log('\n--- 16. Deployment lifecycle ---');
const dep = await deploy(storeProj);
assert(dep.status === 'verified' && dep.deployment.rollbackToken, 'Deployment verified with rollback token');

// Failure tests
console.log('\n--- Failure handling tests ---');

// Fail 1: Invalid model / task
const routedEmpty = routeAI('invalid_task', []);
assert(routedEmpty.length === 0, 'Handles empty model registry gracefully');

// Fail 2: 429 Cooldown
const state = {};
handle429(state, 'gpt-4', 2000);
assert(cooldownActive(state, 'gpt-4'), 'Rate limit 429 triggers active cooldown');

// Fail 3: Security Secret leak detection
const leakProj = createProject('Secret test');
leakProj.artifacts['app.js'] = 'const key = "sk-live12345678901234567890";';
const leakCheck = staticSandboxCheck(leakProj);
assert(leakCheck.errors.includes('secret-like-content'), 'Catches secret API key leak');

// Fail 4: Insecure HTTP detection
leakProj.artifacts['index.html'] = '<!doctype html><html><head><title>Test</title></head><body><img src="http://example.com/a.png"></body></html>';
const httpCheck = staticSandboxCheck(leakProj);
assert(httpCheck.errors.includes('insecure-http'), 'Catches insecure HTTP resource');

// Fail 5: Malformed HTML structure
const badHtmlProj = createProject('Bad HTML');
badHtmlProj.artifacts['index.html'] = '<not-html>Unclosed';
const badHtmlTest = browserTest(badHtmlProj);
assert(badHtmlTest.some(t => t.name === 'load' && t.status === 'failed'), 'Catches missing doctype/title');

// Fail 6: Deployment blocked on failing project
const failingProj = createProject('Failing app');
failingProj.artifacts['index.html'] = 'broken';
const blockedDep = await deploy(failingProj);
assert(blockedDep.status === 'blocked', 'Blocks deployment if project fails verification');

// Fail 7: Corrupted resource ingestion
const emptyRes = indexResource(storeProj, { name: 'corrupted.txt', content: null });
assert(emptyRes.size === 0, 'Handles null or corrupted resource content gracefully');

console.log('\n========================================');
console.log(`TEST SUMMARY: ${passedCount} PASSED, ${failedCount} FAILED`);
console.log('========================================\n');

process.exitCode = failedCount > 0 ? 1 : 0;
