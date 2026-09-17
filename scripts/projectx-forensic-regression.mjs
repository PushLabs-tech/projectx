import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createProject, applyProjectMutation, applySpecChange, validateSpec, serializeForPersistence, projectArtifactKind, normalizeSections } from '../projectx-core.js';

const runtime = fs.readFileSync(new URL('../px-final.js', import.meta.url), 'utf8');
const edge = fs.readFileSync(new URL('../supabase/functions/ai/index.ts', import.meta.url), 'utf8');

const game = createProject({
  title: 'Monkey game',
  type: 'Game',
  spec: {
    goal: 'A browser monkey game that dodges obstacles',
    users: ['players'],
    requirements: ['Avoid obstacles'],
    deliverables: ['Playable browser game'],
    platform: 'Web',
    game: { loop: 'jump and dodge' }
  }
});

assert.equal(projectArtifactKind(game.type), 'software');
assert.equal(game.sections.length, 1, 'an empty AI workspace must not create canned sections');
assert.equal(game.sections[0].id, 'chat');
assert.equal(normalizeSections([], 'Game').map(s => s.id).join(','), 'chat');
assert.equal(normalizeSections([], 'Website').map(s => s.id).join(','), 'chat');
assert.equal(normalizeSections([], 'Business').map(s => s.id).join(','), 'chat');
assert.equal(normalizeSections([], 'Research').map(s => s.id).join(','), 'chat');

const planned = normalizeSections([
  { name: 'Customer Research', kind: 'research', purpose: 'Research the actual customer problem.' },
  { name: 'Prototype Review', kind: 'workspace', purpose: 'Review the proposed prototype.' },
  { name: 'Evidence', kind: 'research', purpose: 'Track evidence and sources.' }
], 'Other');
assert.equal(planned[0].id, 'chat');
assert.equal(planned.length, 4);
assert.equal(planned[1].name, 'Customer Research');
assert.equal(planned[2].name, 'Prototype Review');
assert.equal(planned[3].name, 'Evidence');

const before = game.specVersion;
applySpecChange(game, { features: { add: ['Shop'] } });
assert.equal(game.specVersion, before + 1);
assert.deepEqual(game.spec.features, ['Shop']);
assert.equal(game.tests.status, 'stale');

const v2 = game.specVersion;
applySpecChange(game, { features: { remove: ['Shop'] } });
assert.equal(game.specVersion, v2 + 1);
assert.deepEqual(game.spec.features, []);

const fileBefore = game.specVersion;
applyProjectMutation(game, { fileOperations: [{ op: 'write', path: 'index.html', content: '<!doctype html><html><body>monkey</body></html>' }] });
assert.equal(game.specVersion, fileBefore + 1);
assert.equal(game.tests.status, 'stale');
assert.equal(game.files['index.html'].includes('monkey'), true);

const contradiction = validateSpec({ goal: 'Build a study app for students', users: ['students'], requirements: ['cloud account sync'], constraints: ['no backend'], deliverables: ['working app'], platform: 'mobile' }, 'Mobile');
assert.equal(contradiction.valid, false);
assert.ok(contradiction.contradictions.length > 0);

const persisted = serializeForPersistence(game);
for (const key of ['files', 'artifacts', 'outputs', 'sectionContent', 'tests', 'research', 'agents', 'resources', 'executionState', 'versions']) assert.ok(Object.hasOwn(persisted, key), `missing persisted ${key}`);
assert.match(runtime, /Project Chat/);
assert.match(edge, /projectContext/);
assert.doesNotMatch(runtime, /Game over.*Flappy|ctx\.arc\(bird\.x/);

assert.equal(fs.existsSync(new URL('../projectx-output.js', import.meta.url)), false, 'hardcoded universal output runtime must be absent');

console.log('PASS: canonical core mutation/version invalidation');
console.log('PASS: semantic array deltas');
console.log('PASS: file-only mutations invalidate state');
console.log('PASS: contradiction-aware validation');
console.log('PASS: complete persistence shape');
console.log('PASS: empty AI workspace produces Chat only');
console.log('PASS: AI-supplied workspace sections are preserved without canned additions');
console.log('PASS: hardcoded universal output runtime removed');
