import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createProject, normalizeSections, validateSpec, applySpecChange, applyProjectMutation, restoreProjectSnapshot, normalizeResources, projectArtifactKind, serializeForPersistence, assemblePreviewHtml, sanitizePath, applyBrainMutation, createProjectFromIntent, generateDiscoveryPoll, createPlan, startAgentRun, approveAction, createArtifactVersion, runVerification, getUsageSummary } from '../projectx-core.js';

const runtime = fs.readFileSync(new URL('../px-final.js', import.meta.url), 'utf8');
const appShellCss = fs.readFileSync(new URL('../px-app.css', import.meta.url), 'utf8');
const shellSource = runtime + appShellCss;
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
for (const type of ['Document','Presentation','Data','Dashboard','Internal tool','Business system','Creative project']) {
  const p=createProject({title:type,type,spec:{goal:'Create '+type.toLowerCase()+' output',deliverables:['Finished '+type.toLowerCase()]}});
  assert.equal(p.type,type);
}
assert.equal(validateSpec({goal:'Create a dashboard',deliverables:['Dashboard'],requirements:['Show project metrics'],platform:'Web'},'Dashboard').valid,true);
assert.equal(validateSpec({goal:'Write a report',deliverables:['Report']},'Document').valid,true);
assert.equal(sanitizePath('../secret.txt'), null);
assert.equal(sanitizePath('/absolute/path'), 'absolute/path');
assert.equal(normalizeSections([{ name: 'Custom Mechanics', purpose: 'Project-specific mechanics.' }], 'Game')[1].name, 'Custom Mechanics');
assert.equal(serializeForPersistence(game).schemaVersion,4);

const before = game.specVersion;
applySpecChange(game, { features: { add: ['Pause menu'] } });
assert.equal(game.specVersion, before + 1);
assert.deepEqual(game.spec.features, ['Pause menu']);
assert.equal(game.tests.status, 'stale');
const planBefore=game.specVersion;
const planMutation=applyProjectMutation(game,{plan:[{title:'Build playable loop',steps:['Implement loop','Run tests'],status:'proposed'}]});
assert.equal(planMutation.changed,true);
assert.equal(game.specVersion,planBefore+1);
assert.equal(game.plan[0].title,'Build playable loop');

const beforeRemove = game.specVersion;
applySpecChange(game, { features: { remove: ['Pause menu'] } });
assert.equal(game.specVersion, beforeRemove + 1);
assert.deepEqual(game.spec.features, []);

const researchProject = createProject({
  title: 'EV Market Research', type: 'Research',
  spec: { goal: 'Research the EV market for a school project', deliverables: ['Research brief'] },
  sections: [{ name: 'Sources', kind: 'research', purpose: 'Track source-backed evidence.' }]
});
const researchMutation = applyProjectMutation(researchProject, {
  researchPatch: {
    query: 'EV adoption',
    addSources: [{ url: 'https://example.com/report', title: 'Example report' }],
    addFindings: [{ finding: 'Example finding', sourceUrl: 'https://example.com/report', confidence: 0.9 }]
  }
});
assert.equal(researchMutation.researchChanged, true);
assert.deepEqual(researchProject.research.queries, ['EV adoption']);
assert.equal(researchProject.research.sources[0].url, 'https://example.com/report');
assert.equal(researchProject.research.findings[0].confidence, 0.9);
const resources = normalizeResources([{name:'notes.md',type:'text/markdown',content:'Project context',size:14},{name:'https://example.com',type:'url',url:'https://example.com'}]);
assert.equal(resources.length,2);
assert.equal(resources[0].name,'notes.md');
assert.equal(resources[1].url,'https://example.com');
assert.equal(projectArtifactKind('Presentation'),'software');
const createdFromIntent = createProjectFromIntent({title:'Solar pitch',type:'Business',goal:'Create a solar prototype and investor pitch',deliverables:['Pitch deck']});
assert.equal(createdFromIntent.title,'Solar pitch');
assert.equal(createdFromIntent.spec.goal,'Create a solar prototype and investor pitch');
assert.equal(generateDiscoveryPoll('Preferred scope',['Hardware prototype','Pilot proposal','Investor deck','Hybrid plan']).options.length,4);

const transformed = createProject({title:'Original',type:'Website',spec:{goal:'Build a useful website',deliverables:['Working website']}});
const typeMutation = applyProjectMutation(transformed,{projectType:'API',projectTitle:'Transformed API'});
assert.equal(typeMutation.typeChanged,true);
assert.equal(transformed.type,'API');
assert.equal(transformed.title,'Transformed API');
const restoreSource = {title:'Restore me',type:'Research',spec:{goal:'Research something',deliverables:['Brief']},files:{'brief.md':'source version'}};
const restoreTarget = createProject({title:'Changed',type:'Website',spec:{goal:'Build a site',deliverables:['Site']},files:{'index.html':'changed'}});
const restored = restoreProjectSnapshot(restoreTarget,restoreSource);
assert.equal(restored.changed,true);
assert.equal(restoreTarget.type,'Research');
assert.equal(restoreTarget.title,'Restore me');
assert.equal(restoreTarget.files['brief.md'],'source version');
assert.equal(restoreTarget.tests.status,'stale');
const brainProject = createProject({
  title:'Cafe website',type:'Website',
  spec:{goal:'Build a cafe website',deliverables:['Live website'],requirements:['Menu page'],platform:'Web'}
});
const staleBrain = applyBrainMutation(brainProject,{id:'m-stale',baseVersion:999,operations:[{op:'replace',path:'context.intent',value:'Mismatch'}]},{role:'editor'});
assert.equal(staleBrain.applied,false);
assert.equal(staleBrain.stale,true);
const appliedBrain = applyBrainMutation(brainProject,{
  id:'m-1',
  baseVersion:brainProject.specVersion,
  provenance:{source:'user',sourceId:'intent:cafe',confidence:0.9,userConfirmed:true},
  operations:[
    {op:'replace',path:'context.intent',value:'Launch a cafe website with ordering and events'},
    {op:'add',path:'requirements.requirements',value:['Online ordering','Events calendar']},
    {op:'mark_uncertain',path:'requirements.assumptions',value:'Delivery radius',reason:'Customer delivery boundary is undecided.'}
  ]
},{role:'editor',allowedClasses:['context','requirements']});
assert.equal(appliedBrain.applied,true);
assert.equal(brainProject.intent,'Launch a cafe website with ordering and events');
assert.equal(brainProject.spec.requirements.includes('Online ordering'),true);
assert.equal(Array.isArray(brainProject.executionState.uncertainties),true);
assert.equal(brainProject.executionState.mutationAudit.at(-1).kind,'applied');
const plannedResult = createPlan(brainProject,[{title:'Ship MVP',status:'pending',steps:['Finalize scope']}]);
assert.equal(plannedResult.changed,true);
const run = startAgentRun(brainProject,{agent:'planner',task:'Draft sprint tasks',requiresApproval:true,approvalAction:'publish-plan'});
assert.equal(run.status,'in_progress');
assert.equal(brainProject.executionState.pendingApproval.runId,run.id);
const approved = approveAction(brainProject,{runId:run.id,approver:'reviewer@example.com'});
assert.equal(approved.approved,true);
const artifactVersion = createArtifactVersion(brainProject,{key:'brief',kind:'document',summary:'Cafe launch brief'});
assert.equal(artifactVersion.verification.status,'not_checked');
const verification = runVerification(brainProject,[{name:'Manual review',status:'human_review',requiredHumanReview:true}]);
assert.equal(verification.status,'human_review');
const usage = getUsageSummary(brainProject);
assert.equal(usage.status,'human_review');
assert.ok(usage.specVersion >= 1);

const files = { 'index.html': '<!doctype html><html><head><link rel="stylesheet" href="styles.css"></head><body><script src="app.js"></script></body></html>', 'styles.css': 'body{font-family:system-ui}', 'app.js': 'document.body.dataset.ready="1";' };
const preview = assemblePreviewHtml(files);
assert.match(preview, /body\{font-family/);
assert.match(preview, /dataset\.ready/);
assert.match(preview, /PROJECTX_RUNTIME_ERROR/);

assert.match(runtime, /canonical project/i);
assert.match(runtime, /REAL_WORLD\\|NON_REAL_WORLD/);
assert.match(runtime, /interview-understanding/);
assert.match(runtime, /mergeDiscoveryProject/);
assert.match(runtime, /understanding-known/);
assert.match(runtime, /project-tools/);
assert.match(runtime, /renderBrain/);
assert.match(runtime, /Capture a decision/);
assert.match(runtime, /renderArchitecture/);
assert.match(runtime, /renderSimulation/);
assert.match(runtime, /run-full-verification/);
assert.match(runtime, /renderExplain/);
assert.match(runtime, /renderMakeGreat/);
assert.match(runtime, /renderOptimize/);
assert.match(runtime, /renderTransform/);
assert.match(runtime, /restoreProjectSnapshot/);
assert.match(runtime, /Visual edit/);
assert.match(shellSource, /preview-mobile/);
assert.match(runtime, /preview-file/);
assert.match(runtime, /resource-file/);
assert.match(runtime, /Fork current project/);
assert.match(runtime, /Compare/);
assert.match(runtime, /renderVersions/);
assert.match(runtime, /renderResources/);
assert.match(runtime, /renderProjectSecurity/);
assert.match(runtime, /renderDelivery/);
assert.match(runtime, /restoreProjectSnapshot/);
assert.match(runtime, /provider-id/);
assert.match(runtime, /save-provider/);
assert.match(runtime, /listModels/);
assert.match(runtime, /agentModels/);
assert.match(runtime, /renderAgentSettings/);
assert.match(runtime, /subscribeProjectRealtime/);
assert.match(runtime, /classification=data\.classification/);
assert.match(runtime, /specVersion/);
assert.match(runtime, /Build with AI/);
assert.match(runtime, /Open Settings/);
assert.match(runtime, /listProjects/);
assert.match(runtime, /persistProject/);
assert.match(runtime, /getProject/);
assert.match(runtime, /intent==='build'\|\|data.needsBuild/);
assert.match(runtime, /intent==='test'/);
assert.match(runtime, /project.tests=/);
assert.match(runtime, /rebuild-from-tests/);
assert.match(runtime, /executionMode==='Autonomous'/);
assert.match(runtime, /APPROVAL REQUIRED/);
assert.match(runtime, /approve-pending/);
assert.match(runtime, /renderResources/);
assert.match(runtime, /resource-file/);
assert.match(runtime, /for\(let cycle=0;cycle<2/);
assert.match(runtime, /status==='passed'\?'verified':'needs-fix'/);
assert.match(runtime, /projectArtifactKind/);
assert.match(runtime, /renderResearchSection/);
assert.match(runtime, /edge\('research'/);
assert.match(runtime, /source-backed research/);
assert.match(runtime, /Generate deliverable/);
assert.match(runtime, /document-output/);
assert.match(runtime, /Deliverable exists/);
assert.match(runtime, /projectArtifactKind\(project\.type\)/);
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
