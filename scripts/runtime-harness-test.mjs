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

// The host application may persist its own state, but generated preview/game runtime
// must not depend on iframe localStorage, which can be unavailable in sandboxed frames.
const previewSections = app.match(/(?:createGameEngine|PREVIEW_READY|srcdoc|preview)[\s\S]{0,50000}/gi) || [];
for (const section of previewSections) {
  assert.doesNotMatch(section, /localStorage\s*\.\s*(getItem|setItem|removeItem)/);
}

console.log('PASS engine source contract');
console.log('PASS preview/runtime integration markers');
console.log('PASS generated runtime storage safety');
console.log('RUNTIME HARNESS CHECKS PASSED');
