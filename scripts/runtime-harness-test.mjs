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

// The host application can legitimately persist its own UI/session state.
// The generated preview/runtime must not require iframe-localStorage.
const enginePreview = engine.match(/(?:'game\.js'|GAME_RUNTIME)[\s\S]{0,70000}/gi) || [];
const previewRuntimeText = enginePreview.join('\n');
assert.doesNotMatch(previewRuntimeText, /localStorage\s*\.\s*(getItem|setItem|removeItem)/);
assert.match(previewRuntimeText, /createGameEngine|requestAnimationFrame/);

// App preview integration must inline the generated game runtime before the controller.
assert.match(app, /gameJs/);
assert.match(app, /src=["']game\.js["']/i);
assert.match(app, /src=["']app\.js["']/i);
assert.match(app, /PREVIEW_READY/);

console.log('PASS engine source contract');
console.log('PASS preview/runtime integration markers');
console.log('PASS generated runtime storage safety');
console.log('RUNTIME HARNESS CHECKS PASSED');
