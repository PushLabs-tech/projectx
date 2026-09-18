import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createProject, normalizeSections, validateSpec, applySpecChange, assemblePreviewHtml, sanitizePath } from '../projectx-core.js';

const runtime = fs.readFileSync(new URL('../px-final.js', import.meta.url), 'utf8');
const index = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const vite = fs.readFileSync(new URL('../vite.config.js', import.meta.url), 'utf8');

assert.match(index, /config\.js/);
assert.match(index, /@supabase\/supabase-js@2/);
assert.match(index, /px-final\.js/);
assert.doesNotMatch(index, /dashboard-clean\.js|projectx-adaptive\.js|projectx-output\.js|px-runtime-patches\.js/);
assert.match(vite, /base:\s*['"]\/projectx\//);

const game = createProject({
  title: 'Monkey Flight', type: 'Game', intent: 'A browser game about a monkey dodging obstacles',
  spec: { goal: 'A browser game about a monkey dodging obstacles', users: ['players'], requirements: ['Avoid obstacles', 'Score points'], deliverables: ['Playable browser game'], platform: 'Web', game: { loop: 'jump and avoid obstacles' } },
  sections: [{ name: 'Gameplay', purpose: 'Define the loop.' }, { name: 'Playtest', purpose: 'Run the game.' }, { name: 'Code', purpose: 'Inspect files.' }]
});

assert.equal(game.sections[0].name, 'Chat');
assert.equal(validateSpec(game.spec, game.type).valid, true);
assert.equal(sanitizePath('../secret.txt'), null);
assert.equal(sanitizePath('/absolute/path'), 'absolute/path');
assert.equal(normalizeSections([{ name: 'Custom Mechanics', purpose: 'Project-specific mechanics.' }], 'Game')[1].name, 'Custom Mechanics');

const before = game.specVersion;
applySpecChange(game, { features: { add: ['Pause menu'] } });
assert.equal(game.specVersion, before + 1);
assert.deepEqual(game.spec.features, ['Pause menu']);
assert.equal(game.tests.status, 'stale');

const beforeRemove = game.specVersion;
applySpecChange(game, { features: { remove: ['Pause menu'] } });
assert.equal(game.specVersion, beforeRemove + 1);
assert.deepEqual(game.spec.features, []);

const files = { 'index.html': '<!doctype html><html><head><link rel="stylesheet" href="styles.css"></head><body><script src="app.js"></script></body></html>', 'styles.css': 'body{font-family:system-ui}', 'app.js': 'document.body.dataset.ready="1";' };
const preview = assemblePreviewHtml(files);
assert.match(preview, /body\{font-family/);
assert.match(preview, /dataset\.ready/);
assert.match(preview, /PROJECTX_RUNTIME_ERROR/);

assert.match(runtime, /canonical project/i);
assert.match(runtime, /REAL_WORLD\\|NON_REAL_WORLD/);
assert.match(runtime, /interview-understanding/);
assert.match(runtime, /specVersion/);
assert.match(runtime, /Build with AI/);
assert.match(runtime, /Open Settings/);
assert.match(runtime, /listProjects/);
assert.match(runtime, /persistProject/);
assert.match(runtime, /getProject/);
assert.match(runtime, /sessionStorage/);
assert.match(runtime, /PROJECTX_RUNTIME_ERROR/);
assert.doesNotMatch(runtime, /ctx\.arc\(bird\.x|Game over.*Flappy|Mode: \$\{kind\}/);
assert.doesNotMatch(runtime, /window\.ProjectXAI/);

console.log('PASS: single runtime entrypoint');
console.log('PASS: canonical project model');
console.log('PASS: semantic add/remove mutation');
console.log('PASS: spec version invalidation');
console.log('PASS: real artifact assembly and runtime error bridge');
console.log('PASS: cloud persistence hooks');
console.log('PASS: no hardcoded game runtime in canonical shell');
console.log('PROJECTX RUNTIME CONTRACT PASSED');
