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

// Host application state may use localStorage. Generated game/runtime code must not.
// The engine currently stores the canonical game runtime in a large template region.
const gameMarker = engine.indexOf("const GAME_RUNTIME = \"");
const gameMarkerAlt = engine.indexOf("'game.js': `");
const runtimeStart = gameMarker >= 0 ? gameMarker : gameMarkerAlt;
assert.ok(runtimeStart >= 0, 'canonical generated game runtime marker should exist');

const runtimeEndA = engine.indexOf('`;', runtimeStart + 16);
const runtimeEndB = engine.indexOf("`,", runtimeStart + 16);
const runtimeEnd = [runtimeEndA, runtimeEndB].filter((n) => n > runtimeStart).sort((a,b) => a-b)[0];
assert.ok(Number.isInteger(runtimeEnd), 'canonical generated game runtime should have a bounded template region');
const generatedRuntime = engine.slice(runtimeStart, runtimeEnd + 2);
assert.doesNotMatch(generatedRuntime, /localStorage\s*\.\s*(getItem|setItem|removeItem)/);
assert.match(generatedRuntime, /requestAnimationFrame|createGameEngine/);

// The host preview must expose a concrete integration point and error/ready signaling.
assert.match(app, /preview/i);
assert.match(app, /srcdoc|PREVIEW_READY|PREVIEW_RUNTIME_ERROR|previewFrame/i);

console.log('PASS engine source contract');
console.log('PASS preview integration markers');
console.log('PASS generated runtime storage safety');
console.log('RUNTIME HARNESS CHECKS PASSED');
