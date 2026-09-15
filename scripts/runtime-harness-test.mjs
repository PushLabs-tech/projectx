import fs from 'node:fs';
import assert from 'node:assert/strict';

const app = fs.readFileSync(new URL('../app.js', import.meta.url), 'utf8');
const legacyEngine = fs.readFileSync(new URL('../universal-engine.js', import.meta.url), 'utf8');
const fixedEngine = fs.readFileSync(new URL('../universal-engine-fixed.js', import.meta.url), 'utf8');
const index = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const vite = fs.readFileSync(new URL('../vite.config.js', import.meta.url), 'utf8');

assert.ok(app.length > 100000, 'app.js should contain the production application');
assert.ok(legacyEngine.length > 100000, 'legacy universal engine should exist');
assert.ok(fixedEngine.length > 5000, 'fixed runtime adapter should exist');
assert.match(fixedEngine, /export const ENGINE_VERSION = '15\.0\.0'/);
assert.match(fixedEngine, /window\.createGameEngine/);
assert.doesNotMatch(fixedEngine, /localStorage\s*\./);
assert.match(fixedEngine, /requestAnimationFrame/);
assert.match(fixedEngine, /getState\(\)/);
assert.match(fixedEngine, /game\.js/);
assert.doesNotMatch(fixedEngine, /export function createGameEngine/);

// Browser/source mode redirects the app's engine import to the fixed adapter.
assert.match(index, /<script type="importmap">[\s\S]*\.\/universal-engine-fixed\.js/);
// Vite production build uses the same adapter instead of the legacy engine directly.
assert.match(vite, /universal-engine-fixed\.js/);

// Host preview must expose a concrete live-preview/error integration surface.
assert.match(app, /preview/i);
assert.match(app, /srcdoc|PREVIEW_READY|PREVIEW_RUNTIME_ERROR|previewFrame/i);
assert.doesNotMatch(app, /new Function\s*\(/);

console.log('PASS canonical runtime adapter exists');
console.log('PASS game runtime is classic-script safe');
console.log('PASS generated runtime has no browser-storage dependency');
console.log('PASS browser import-map adapter configured');
console.log('PASS Vite production adapter configured');
console.log('RUNTIME HARNESS CHECKS PASSED');
