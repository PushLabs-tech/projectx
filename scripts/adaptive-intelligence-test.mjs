import assert from 'node:assert';
import {
  ENGINE_VERSION,
  CAPABILITY_PRIMITIVES,
  classifyIntent,
  decomposeIntent,
  resolveIntentAndCapabilities,
  discoverCapabilities,
  getWorkspaceViewConfig,
  createProject,
  buildArtifact,
  createTemporaryTool,
  collapseTemporaryTool,
  handleAmbiguousIntent,
  handleNoIdea,
  analyzeResource,
  createErrorIntelligenceObject,
  runUniversalErrorRecoveryLoop,
  createGuidedDiagnosticQuestions,
  diagnoseBuilderHealth,
  rollbackToRecoveryPoint,
  computeProjectPulse,
  getIntelligentActions,
  resolveUniversalCommand,
  getCapabilityLens,
  recordIntentEvolution,
  generateChangePreview,
  generateLivingDocumentation,
  explainProject,
  assessConfidenceAndUncertainty,
  selfHeal
} from '../universal-engine.js';

console.log('Testing Universal Adaptive Intelligence Architecture…');

// 1. Primitive validation
assert.strictEqual(CAPABILITY_PRIMITIVES.length, 14, 'Has 14 universal primitives');
assert(CAPABILITY_PRIMITIVES.includes('INPUT'));
assert(CAPABILITY_PRIMITIVES.includes('TRANSFORM'));
assert(CAPABILITY_PRIMITIVES.includes('SIMULATE'));
assert(CAPABILITY_PRIMITIVES.includes('VERIFY'));
console.log('  PASS: Primitives verified');

// 2. Multi-domain classification & decomposition
const intent = 'Create an interactive map that teaches children astronomy while adapting lessons based on their performance';
const decomp = decomposeIntent(intent);
assert(decomp.domains.includes('astronomy'), 'Detected astronomy domain');
assert(decomp.domains.includes('education'), 'Detected education domain');
assert(decomp.domains.includes('adaptive_learning'), 'Detected adaptive learning domain');
assert(decomp.primitives.includes('VISUALIZE'), 'Mapped VISUALIZE primitive');
assert(decomp.primitives.includes('SIMULATE'), 'Mapped SIMULATE primitive');
assert.strictEqual(decomp.executionPlan.length, 9, 'Generated 9-step execution plan');
console.log('  PASS: Multi-domain decomposition verified');

// 3. Contextual view transformation
const astroProj = createProject(intent);
assert.strictEqual(astroProj.kind, 'astronomy', 'Classified as astronomy project');
const astroViews = getWorkspaceViewConfig(astroProj);
assert(astroViews.tabs.includes('explore'), 'Includes explore tab');
assert(astroViews.tabs.includes('sky-map'), 'Includes sky-map tab');
assert(astroViews.tabs.includes('lessons'), 'Includes lessons tab');
assert(astroViews.tabs.includes('adaptive'), 'Includes adaptive tab');
assert.strictEqual(astroViews.defaultTab, 'sky-map', 'Defaults to sky-map tab');
console.log('  PASS: Contextual Interface Transformation verified for astronomy');

// 4. Artifact generation for Astronomy & Education
assert(astroProj.artifacts['index.html'].includes('INTERACTIVE ASTRONOMY & ADAPTIVE LAB'), 'Generated astronomy app title');
assert(astroProj.artifacts['index.html'].includes('skyCanvas'), 'Contains star map canvas');
assert(astroProj.artifacts['app.js'].includes('constellations'), 'Contains constellation engine');
console.log('  PASS: Astronomy interactive artifact verified');

// 5. Temporary Tools (Section 6-8)
const tool = createTemporaryTool(astroProj, 'comparison', { fileA: 'index.html', fileB: 'backup.html' });
assert.strictEqual(astroProj.temporaryTools.length, 1, 'Temporary tool created');
const viewsWithTool = getWorkspaceViewConfig(astroProj);
assert(viewsWithTool.tabs.includes('temporary'), 'Temporary tab appeared');
collapseTemporaryTool(astroProj, tool.id);
assert.strictEqual(astroProj.temporaryTools.length, 0, 'Temporary tool collapsed');
const viewsCollapsed = getWorkspaceViewConfig(astroProj);
assert(!viewsCollapsed.tabs.includes('temporary'), 'Temporary tab vanished after completion');
console.log('  PASS: Temporary tool lifecycle verified');

// 6. Universal Error Recovery Loop & Error Intelligence (Section 30-33)
const errorData = {
  error: 'Script syntax error or missing closing tag',
  location: 'index.html',
  category: 'syntax',
  severity: 'high'
};
const recoveryResult = runUniversalErrorRecoveryLoop(astroProj, errorData);
assert(recoveryResult.loopId, 'Generated recovery loop ID');
assert(recoveryResult.recoveryPointId, 'Snapshot created before fix');
assert(recoveryResult.repaired, 'Repaired successfully');
assert.strictEqual(recoveryResult.errorIntelligence.finalStatus, 'verified', 'Error intelligence status verified');
assert(astroProj.recoveryPoints.length >= 1, 'Recovery points history maintained');
console.log('  PASS: Universal Error Recovery Loop verified');

// 7. Intelligent Action Bar & Project Pulse (Section 11-12)
const pulse = computeProjectPulse(astroProj);
assert(pulse.overallHealth >= 80, 'Health score computed');
assert(pulse.recommendations.length > 0, 'Computed recommendations');

const actions = getIntelligentActions(astroProj);
assert(actions.length >= 2 && actions.length <= 4, 'Provides between 2 and 4 contextual actions');
assert(actions.some(a => a.primary), 'Has a primary action');
console.log('  PASS: Intelligent action bar & pulse verified');

// 8. Command Center (⌘K) resolutions
const cmdResult = resolveUniversalCommand(astroProj, 'why is this broken?');
assert.strictEqual(cmdResult.action, 'runTroubleshoot', 'Resolved troubleshooting action');
const cmdLens = resolveUniversalCommand(astroProj, 'capability lens');
assert.strictEqual(cmdLens.view, 'lens', 'Resolved capability lens view');
console.log('  PASS: Universal Command Center resolution verified');

// 9. Capability Lens & Living Documentation
const lens = getCapabilityLens(astroProj);
assert(lens.primitives.length >= 5, 'Mapped capability lens primitives');
const livingDocs = generateLivingDocumentation(astroProj);
assert(livingDocs.projectName, 'Generated living documentation');
console.log('  PASS: Capability lens & living documentation verified');

console.log('All Universal Adaptive Intelligence tests passed successfully!');
