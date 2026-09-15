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

// Host state may legitimately use localStorage. Generated preview/runtime must not.
// Extract only the canonical generated game-runtime region rather than scanning the
// entire universal engine, which also contains the host application state adapter.
const gameMarkers = [
  engine.indexOf("'game.js': `"),
  engine.indexOf('const GAME_RUNTIME = "')
].filter(index => index >= 0);
assert.ok(gameMarkers.length > 0, 'canonical game runtime marker should exist');

const runtimeStart = Math.min(...gameMarkers);
const runtimeEndCandidates = [
  engine.indexOf("`,", runtimeStart + 12),
  engine.indexOf('`;', runtimeStart + 12)
].filter(index => index > runtimeStart);
const runtimeEnd = Math.min(...runtimeEndCandidates);
assert.ok(Number.isFinite(runtimeEnd), 'canonical game runtime region should be delimited');
const generatedRuntime = engine.slice(runtimeStart, runtimeEnd + 2);

assert.doesNotMatch(generatedRuntime, /localStorage\s*\.\s*(getItem|setItem|removeItem)/);
assert.match(generatedRuntime, /createGameEngine|requestAnimationFrame/);

// Verify the preview integration references the generated game runtime and controller.
assert.match(app, /gameJs/);
assert.match(app, /src=["']game\.js["']/i);
assert.match(app, /src=["']app\.js["']/i);
assert.match(app, /PREVIEW_READY/);

console.log('PASS engine source contract');
console.log('PASS preview/runtime integration markers');
console.log('PASS generated runtime storage safety');
console.log('RUNTIME HARNESS CHECKS PASSED');
