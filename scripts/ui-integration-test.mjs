import assert from "node:assert/strict";
import fs from "node:fs";
import * as Engine from "../universal-engine.js";

console.log("Running UI & Universal Adaptive Intelligence Integration Tests...\n");

// 1. Verify app.js contains the dynamic calls to Engine
const appSource = fs.readFileSync("app.js", "utf8");

assert(appSource.includes("Engine.getWorkspaceViewConfig(p)"), "app.js must call Engine.getWorkspaceViewConfig(p)");
assert(appSource.includes("Engine.getIntelligentActions(p)"), "app.js must call Engine.getIntelligentActions(p)");
assert(appSource.includes("Engine.computeProjectPulse(p)"), "app.js must call Engine.computeProjectPulse(p)");
assert(appSource.includes("Engine.runUniversalErrorRecoveryLoop(p)"), "app.js must call Engine.runUniversalErrorRecoveryLoop(p)");
assert(appSource.includes("Engine.resolveUniversalCommand(p, text)"), "app.js must call Engine.resolveUniversalCommand(p, text)");
assert(appSource.includes("PREVIEW_RUNTIME_ERROR"), "app.js must have PREVIEW_RUNTIME_ERROR listener");
console.log("  PASS: app.js contains all dynamic Engine wiring points");

// 2. Test contextualPanels dynamic resolution across various domains
const astronomyProject = Engine.createProject("Interactive celestial map with astronomy lessons and night sky observation simulator");
const astronomyView = Engine.getWorkspaceViewConfig(astronomyProject);
assert(astronomyView.tabs.includes("sky-map"), "Astronomy project must have sky-map tab");
assert(astronomyView.tabs.includes("lessons"), "Astronomy project must have lessons tab");
assert(astronomyView.tabs.includes("adaptive"), "Astronomy project must have adaptive tab");
assert(astronomyView.tabs.includes("troubleshoot"), "Astronomy project must include troubleshoot tab");
console.log("  PASS: Astronomy contextual panels properly derived");

const gameProject = Engine.createProject("2D space physics arcade game with fluid collisions and powerups");
const gameView = Engine.getWorkspaceViewConfig(gameProject);
assert(gameView.tabs.includes("scene"), "Game project must have scene tab");
assert(gameView.tabs.includes("troubleshoot"), "Game project must include troubleshoot tab");
console.log("  PASS: Game contextual panels properly derived");

const novelProject = Engine.createProject("Write an epic fantasy novel with worldbuilding bible and chapter arcs");
const novelView = Engine.getWorkspaceViewConfig(novelProject);
assert(novelView.tabs.includes("manuscript"), "Novel project must have manuscript tab");
assert(novelView.tabs.includes("chapters"), "Novel project must have chapters tab");
console.log("  PASS: Novel contextual panels properly derived");

// 3. Test Intelligent Action Bar and Pulse computation
const pulseHealthy = Engine.computeProjectPulse(astronomyProject);
assert(pulseHealthy.overallHealth >= 80, "Initial project should be healthy");
assert(pulseHealthy.statusLabel === "Production Ready", "Status label should be Production Ready");

const actions = Engine.getIntelligentActions(astronomyProject);
assert(Array.isArray(actions) && actions.length >= 2, "Intelligent actions should provide recommendations");
console.log("  PASS: Intelligent Action Bar & Pulse computed successfully");

// 4. Test Error Intelligence & Recovery Loop
astronomyProject.artifacts["index.html"] = "<html><body>Broken unclosed script <script>alert(1);";
const recoveryResult = Engine.runUniversalErrorRecoveryLoop(astronomyProject);
assert(recoveryResult.status === "resolved" && recoveryResult.repaired === true, "Recovery loop should fix the defect and verify");
assert(recoveryResult.errorIntelligence, "Error intelligence object must be populated");
assert(recoveryResult.recoveryPointId, "Recovery point id must be created before repair");
console.log("  PASS: Universal Error Recovery Loop executed and verified");

// 5. Test Universal Command Center (⌘K) resolution
const troubleshootCmd = Engine.resolveUniversalCommand(astronomyProject, "Why is this broken?");
assert.equal(troubleshootCmd.type, "action");
assert.equal(troubleshootCmd.action, "runTroubleshoot");

const lensCmd = Engine.resolveUniversalCommand(astronomyProject, "Show capability lens");
assert.equal(lensCmd.type, "view");
assert.equal(lensCmd.view, "lens");

const docsCmd = Engine.resolveUniversalCommand(astronomyProject, "Living documentation");
assert.equal(docsCmd.type, "view");
assert.equal(docsCmd.view, "living_docs");
console.log("  PASS: Universal Command Center resolution verified");

// 6. Test Temporary Tools
const tool = Engine.createTemporaryTool(astronomyProject, {
  title: "Stellar Spectral Data Comparison",
  intent: "Compare star luminosity classes",
  data: { O: 30000, B: 20000, A: 8500, F: 6500, G: 5700, K: 4500, M: 3200 }
});
assert(astronomyProject.temporaryTools.length === 1, "Temporary tool should be registered in project");

const collapsed = Engine.collapseTemporaryTool(astronomyProject, tool.id);
assert(collapsed === true, "Tool should be collapsed");
assert(astronomyProject.temporaryTools.length === 0, "Temporary tools list should be empty after collapse");
console.log("  PASS: Temporary tool creation and collapse lifecycle verified");

console.log("\nAll UI & Universal Adaptive Intelligence Integration Tests Passed!");
