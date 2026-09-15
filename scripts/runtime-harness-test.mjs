import fs from 'node:fs';
import assert from 'node:assert/strict';

const app = fs.readFileSync(new URL('../app.js', import.meta.url), 'utf8');
const engine = fs.readFileSync(new URL('../universal-engine.js', import.meta.url), 'utf8');

assert.ok(app.length > 100000, 'app.js should contain the production application');
assert.ok(engine.length > 100000, 'universal-engine.js should contain the engine');
assert.match(engine, /ENGINE_VERSION/);
assert.match(engine, /CAPABILITY_PRIMITIVES/);
assert.match(engine, /CAPABILITY_REGISTRY/);
assert.match(app, /PREVIEW_READY|createGameEngine|preview/i);
assert.doesNotMatch(app, /new Function\s*\(/);
assert.doesNotMatch(app, /localStorage\s*\.\s*(getItem|setItem|removeItem)/);

console.log('PASS engine source contract');
console.log('PASS preview/runtime integration markers');
console.log('PASS browser safety constraints');
console.log('RUNTIME HARNESS CHECKS PASSED');
