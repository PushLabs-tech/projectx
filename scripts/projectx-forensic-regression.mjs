import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createProject, applyProjectMutation, applySpecChange, validateSpec, serializeForPersistence, projectArtifactKind, normalizeSections } from '../projectx-core.js';

const runtime = fs.readFileSync(new URL('../px-final.js', import.meta.url), 'utf8');
const edge = fs.readFileSync(new URL('../supabase/functions/ai/index.ts', import.meta.url), 'utf8');

const game = createProject({ title: 'Monkey game', type: 'Game', spec: { goal: 'A browser monkey game that dodges obstacles', users: ['players'], requirements: ['Avoid obstacles'], deliverables: ['Playable browser game'], platform: 'Web', game: { loop: 'jump and dodge' } } });
assert.equal(projectArtifactKind(game.type), 'software');
assert.equal(game.tests.status, 'stale');

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
assert.equal(normalizeSections([{ name: 'Playtest', kind: 'output' }], 'Game')[1].kind, 'output');

// These two assertions deliberately document the remaining production-path gap.
// They must be flipped to positive assertions when px-final.js and the Edge
// Function consume the v2 canonical contract.
assert.doesNotMatch(runtime, /applyProjectMutation/);
assert.doesNotMatch(edge, /AI_CONTEXT_V2_CANONICAL_FILES/);

console.log('PASS: canonical core mutation/version invalidation');
console.log('PASS: semantic array deltas');
console.log('PASS: file-only mutations invalidate state');
console.log('PASS: contradiction-aware validation');
console.log('PASS: complete canonical persistence shape');
console.log('KNOWN GAP: browser runtime and Edge Function still use the pre-v2 execution/context path');
