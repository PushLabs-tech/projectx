export const APP_TOOLS = [
  ['home', 'Home'],
  ['projects', 'Projects'],
  ['assistant', 'Assistant'],
  ['analytics', 'Activity'],
  ['settings', 'Settings']
];

export const PROJECT_NAV = [
  ['overview', 'Overview'],
  ['runs', 'Runs'],
  ['assistant', 'Assistant'],
  ['build', 'Build'],
  ['design', 'Design'],
  ['files', 'Files'],
  ['preview', 'Preview'],
  ['tasks', 'Tasks'],
  ['artifacts', 'Artifacts'],
  ['database', 'Database'],
  ['research', 'Research'],
  ['brain', 'Brain'],
  ['impact', 'Impact'],
  ['tests', 'Tests'],
  ['security', 'Security'],
  ['storage', 'Storage'],
  ['integrations', 'Integrations'],
  ['deploy', 'Deploy'],
  ['git', 'Versions'],
  ['secrets', 'Secrets'],
  ['seo', 'SEO'],
  ['terminal', 'Output'],
  ['collab', 'Members'],
  ['settings', 'Settings']
];

export const CORE_NAV = ['overview', 'build', 'design', 'preview', 'files', 'settings'];
export const ADVANCED_NAV = PROJECT_NAV.filter(([id]) => !CORE_NAV.includes(id));

export const TEMPLATES = [
  {id:'website',title:'Website',intent:'Build a polished landing page for a local service business.',type:'Website',deliverables:['Working website']},
  {id:'app',title:'Web app',intent:'Build a polished expense tracker web app.',type:'Website',deliverables:['Working web app']},
  {id:'game',title:'Game',intent:'Build a mobile horror game with progression, enemies, and a shop.',type:'Game',deliverables:['Playable game']},
  {id:'research',title:'Research',intent:'Create a research report comparing battery technologies for a solar prototype.',type:'Research',deliverables:['Research brief']},
  {id:'business',title:'Business',intent:'Help me launch a sneaker cleaning business.',type:'Business',deliverables:['Launch plan']},
  {id:'deck',title:'Pitch',intent:'Create a pitch deck for a student startup.',type:'Presentation',deliverables:['Pitch deck']}
];

export const COMMANDS = [
  ['home', 'Go home', 'home'],
  ['projects', 'Open projects', 'projects'],
  ['settings', 'Open settings', 'settings'],
  ['assistant', 'Open assistant', 'assistant'],
  ['new', 'New project', 'home'],
  ['palette-files', 'Open files', 'files'],
  ['palette-preview', 'Open preview', 'preview'],
  ['palette-runs', 'Open execution runs', 'runs'],
  ['palette-brain', 'Open Brain', 'brain'],
  ['palette-impact', 'Open Impact Engine', 'impact'],
  ['palette-tasks', 'Open tasks', 'tasks'],
  ['palette-design', 'Open design canvas', 'design'],
  ['palette-deploy', 'Open deploy', 'deploy'],
  ['palette-research', 'Open research', 'research'],
  ['palette-tests', 'Open tests', 'tests'],
  ['palette-database', 'Open database', 'database'],
  ['palette-artifacts', 'Open artifacts', 'artifacts'],
  ['palette-security', 'Open security', 'security'],
  ['palette-integrations', 'Open integrations', 'integrations'],
  ['palette-git', 'Open versions', 'git'],
  ['palette-build', 'Open build', 'build'],
  ['palette-toggle-agent', 'Toggle assistant', 'toggle-assistant'],
  ['palette-toggle-nav', 'Toggle navigation', 'toggle-nav'],
  ['palette-toggle-output', 'Toggle output queue', 'toggle-bottom']
];

export const CONTEXT_ACTIONS = {
  files: ['Explain', 'Fix', 'Refactor', 'Review'],
  preview: ['Inspect', 'Fix', 'Improve', 'Make responsive'],
  design: ['Design', 'Generate variants', 'Improve selection', 'Apply'],
  database: ['Explain schema', 'Generate query', 'Fix query'],
  tests: ['Diagnose', 'Fix', 'Rerun'],
  deploy: ['Diagnose', 'Explain'],
  brain: ['Clarify', 'Update', 'Review assumptions'],
  default: ['Ask', 'Plan', 'Build', 'Research']
};

export function navForProject(project) {
  const hidden = new Set(project?.uiHiddenTools || []);
  const order = Array.isArray(project?.uiToolOrder) && project.uiToolOrder.length ? project.uiToolOrder : CORE_NAV;
  const byId = Object.fromEntries(PROJECT_NAV);
  const seen = new Set();
  const out = [];
  for (const id of order) {
    if (!byId[id] || hidden.has(id) || seen.has(id)) continue;
    seen.add(id);
    out.push([id, byId[id]]);
  }
  for (const [id, name] of PROJECT_NAV) {
    if (hidden.has(id) || seen.has(id)) continue;
    if (CORE_NAV.includes(id) || order.includes(id)) {
      seen.add(id);
      out.push([id, name]);
    }
  }
  return out;
}

export function publicMarkup() {
  return `<div class="pxl-page" id="pxl-top">
<header class="pxl-nav">
  <a class="pxl-brand" href="./" aria-label="ProjectX home"><span class="pxl-brand-mark" aria-hidden="true"><i></i><i></i></span><span>Project<span class="pxl-brand-x">X</span></span></a>
  <nav class="pxl-links" aria-label="Main navigation">
    <a href="#pxl-purpose">Product</a><a href="./billing.html">Pricing</a><a href="#pxl-experience">Docs</a><a href="#pxl-brain">Resources</a>
  </nav>
  <div class="pxl-nav-actions"><button class="pxl-signin" id="public-signin" type="button">Log in</button><button class="pxl-button pxl-button-dark pxl-button-small" id="public-workspace" type="button">Get Started <span>→</span></button></div>
</header>

<main>
  <section class="pxl-hero pxl-reveal-up px-reveal-up" id="pxl-hero" aria-labelledby="pxl-hero-title">
    <div class="pxl-hero-glow" aria-hidden="true"></div>
    <div class="pxl-hero-copy">
      <div class="pxl-eyebrow"><span class="pxl-x-mini">×</span> The Universal Creation Engine</div>
      <h1 id="pxl-hero-title">Turn any idea into<br>a <em>real product.</em></h1>
      <p class="pxl-lead">An AI platform that understands your intent, plans, builds,<br class="pxl-desktop"> executes, and helps you ship — <strong>anything.</strong></p>
    </div>

    <div class="pxl-composer" role="group" aria-label="Start a ProjectX creation">
      <textarea id="start-input" rows="1" data-domain="web" placeholder="What do you want to create?" aria-label="Describe what you want to create"></textarea>
      <div class="pxl-composer-actions">
        <button class="pxl-icon-button" type="button" aria-label="Attach context" title="Attach context"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8.5 12.5 15 6a4 4 0 1 1 5.7 5.6l-8.2 8.2a5.2 5.2 0 0 1-7.4-7.4l8-8a3.5 3.5 0 1 1 5 5l-7.2 7.2a1.8 1.8 0 0 1-2.5-2.5l6.4-6.4"/></svg></button>
        <button class="pxl-icon-button" type="button" aria-label="Creation settings" title="Creation settings"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M4 17h16M9 7v0M15 17v0"/><circle cx="9" cy="7" r="2"/><circle cx="15" cy="17" r="2"/></svg></button>
        <button class="pxl-send" id="public-start-arrow" type="button" aria-label="Start creating">↑</button>
      </div>
    </div>

    <div class="pxl-chip-row" role="group" aria-label="Choose a creation type">
      <button type="button" class="active" aria-pressed="true" data-domain="web" data-placeholder="Describe the website or web experience you want to create."><span class="chip-icon">▱</span>Website</button>
      <button type="button" aria-pressed="false" data-domain="app" data-placeholder="Describe the app or product you want to create."><span class="chip-icon">◌</span>App</button>
      <button type="button" aria-pressed="false" data-domain="agent" data-placeholder="Describe what your AI agent should help accomplish."><span class="chip-icon">✧</span>Agent</button>
      <button type="button" aria-pressed="false" data-domain="automation" data-placeholder="Describe the workflow you want to automate."><span class="chip-icon">ϟ</span>Automation</button>
      <button class="pxl-shuffle" id="pxl-shuffle" type="button" aria-label="Choose a creation type at random" title="Shuffle creation type">↻</button>
    </div>
  </section>

  <section class="pxl-section pxl-purpose-section pxl-reveal-up px-reveal-up" id="pxl-purpose">
    <div class="pxl-split-layout">
      <div class="pxl-split-copy">
        <div class="pxl-section-label"><span></span> PROJECTX</div>
        <h2>Your idea is only<br>the <em>beginning.</em></h2>
        <p>ProjectX turns human intent into real, working, measurable outcomes — from the first thought to something you can actually ship.</p>
        <button class="pxl-outline-action" type="button" data-purpose-focus>How it works <span>→</span></button>
      </div>
      <div class="pxl-purpose-visual" aria-label="ProjectX creation lifecycle">
        <div class="pxl-visual-aura"></div>
        <svg class="pxl-purpose-lines" viewBox="0 0 700 470" aria-hidden="true"><path d="M92 240 C170 220 196 120 274 110"/><path d="M274 110 C340 92 372 84 430 72"/><path d="M430 72 C500 98 542 150 598 188"/><path d="M598 188 C560 238 560 300 604 350"/><path d="M604 350 C526 376 472 394 400 402"/><path d="M400 402 C320 392 252 368 178 346"/><path d="M178 346 C132 320 112 278 92 240"/></svg>
        <button class="pxl-purpose-node n1" type="button" data-lifecycle-step="intent" aria-pressed="true"><span>◎</span><b>Intent</b></button>
        <button class="pxl-purpose-node n2" type="button" data-lifecycle-step="understand" aria-pressed="false"><span>⌁</span><b>Understand</b></button>
        <button class="pxl-purpose-node n3" type="button" data-lifecycle-step="plan" aria-pressed="false"><span>≡</span><b>Plan</b></button>
        <button class="pxl-purpose-node n4" type="button" data-lifecycle-step="create" aria-pressed="false"><span>⌘</span><b>Create</b></button>
        <button class="pxl-purpose-node n5" type="button" data-lifecycle-step="verify" aria-pressed="false"><span>◌</span><b>Verify</b></button>
        <button class="pxl-purpose-node n6" type="button" data-lifecycle-step="ship" aria-pressed="false"><span>↗</span><b>Ship</b></button>
        <button class="pxl-purpose-node n7" type="button" data-lifecycle-step="improve" aria-pressed="false"><span>▥</span><b>Improve</b></button>
        <div class="pxl-stack-core" aria-hidden="true"><div class="pxl-stack-layer layer-a"></div><div class="pxl-stack-layer layer-b"></div><div class="pxl-stack-layer layer-c"></div><div class="pxl-stack-mark">×</div></div>
      </div>
    </div>
    <div class="pxl-stage-explainer" id="pxl-lifecycle-description" aria-live="polite"><b>INTENT</b><p>Name the outcome and start from what you actually want to accomplish.</p></div>
  </section>

  <section class="pxl-section pxl-creation-section pxl-reveal-up px-reveal-up" id="pxl-create">
    <div class="pxl-create-head"><div><div class="pxl-section-label"><span></span> ONE ENGINE / MANY OUTCOMES</div><h2>One engine.<br>Almost <em>any creation.</em></h2></div><p>Start with what you want to accomplish. ProjectX adapts to the kind of work, tools, and deliverables your goal requires.</p></div>
    <div class="pxl-creation-grid pxl-reveal-stagger px-reveal-stagger" aria-label="Creation types">
      <button class="pxl-creation-card" type="button" data-creation-card="website" aria-expanded="false"><span class="pxl-card-icon">▧</span><span class="pxl-card-number">01</span><strong>Websites</strong><small>Landing pages, sites and portals</small><span class="pxl-card-detail">Design, structure and prepare a responsive web experience.</span></button>
      <button class="pxl-creation-card" type="button" data-creation-card="app" aria-expanded="false"><span class="pxl-card-icon">▦</span><span class="pxl-card-number">02</span><strong>Apps</strong><small>Web, mobile and desktop apps</small><span class="pxl-card-detail">Connect interface, data and application behavior around a goal.</span></button>
      <button class="pxl-creation-card" type="button" data-creation-card="agent" aria-expanded="false"><span class="pxl-card-icon">✧</span><span class="pxl-card-number">03</span><strong>AI Agents</strong><small>Task-driven, specialist agents</small><span class="pxl-card-detail">Define roles, context, tools and permission boundaries.</span></button>
      <button class="pxl-creation-card" type="button" data-creation-card="automation" aria-expanded="false"><span class="pxl-card-icon">ϟ</span><span class="pxl-card-number">04</span><strong>Automations</strong><small>Workflows and integrations</small><span class="pxl-card-detail">Map triggers, conditions, steps and connected services.</span></button>
      <button class="pxl-creation-card" type="button" data-creation-card="api" aria-expanded="false"><span class="pxl-card-icon">&lt;›</span><span class="pxl-card-number">05</span><strong>APIs</strong><small>Build, connect and deploy</small><span class="pxl-card-detail">Plan endpoints, data contracts and service boundaries.</span></button>
      <button class="pxl-creation-card" type="button" data-creation-card="dashboard" aria-expanded="false"><span class="pxl-card-icon">▥</span><span class="pxl-card-number">06</span><strong>Dashboards</strong><small>Data, analytics and operations</small><span class="pxl-card-detail">Turn useful information into clear monitoring surfaces.</span></button>
      <button class="pxl-creation-card" type="button" data-creation-card="game" aria-expanded="false"><span class="pxl-card-icon">♧</span><span class="pxl-card-number">07</span><strong>Games</strong><small>Interactive digital experiences</small><span class="pxl-card-detail">Shape game loops, mechanics and playable systems.</span></button>
      <button class="pxl-creation-card" type="button" data-creation-card="business" aria-expanded="false"><span class="pxl-card-icon">▣</span><span class="pxl-card-number">08</span><strong>Business Systems</strong><small>Processes, tools and CRM</small><span class="pxl-card-detail">Organize offers, processes, customers and operations.</span></button>
      <button class="pxl-creation-card" type="button" data-creation-card="research" aria-expanded="false"><span class="pxl-card-icon">⌕</span><span class="pxl-card-number">09</span><strong>Research</strong><small>Analysis, evidence and insights</small><span class="pxl-card-detail">Frame questions, gather evidence and compare options.</span></button>
      <button class="pxl-creation-card" type="button" data-creation-card="documents" aria-expanded="false"><span class="pxl-card-icon">▤</span><span class="pxl-card-number">10</span><strong>Documents</strong><small>Write, structure and format</small><span class="pxl-card-detail">Create useful reports, specifications and plans.</span></button>
      <button class="pxl-creation-card" type="button" data-creation-card="presentations" aria-expanded="false"><span class="pxl-card-icon">▧</span><span class="pxl-card-number">11</span><strong>Presentations</strong><small>Pitch, explain and visualize</small><span class="pxl-card-detail">Build a narrative and communicate the central idea.</span></button>
      <button class="pxl-creation-card" type="button" data-creation-card="custom" aria-expanded="false"><span class="pxl-card-icon">＋</span><span class="pxl-card-number">12</span><strong>Custom Projects</strong><small>Anything you can imagine</small><span class="pxl-card-detail">Start with the intended outcome and let the structure adapt.</span></button>
    </div>
  </section>

  <section class="pxl-section pxl-difference-section pxl-reveal-up px-reveal-up" id="pxl-difference">
    <div class="pxl-split-layout">
      <div class="pxl-split-copy"><div class="pxl-section-label"><span></span> THE DIFFERENCE</div><h2>It doesn’t just<br>generate. It <em>understands.</em></h2><p>A prompt is only the starting point. ProjectX works toward the outcome — keeping the goal, decisions, creation, and verification connected.</p></div>
      <div class="pxl-compare">
      <div class="pxl-compare-card">
        <span class="pxl-compare-label">A SIMPLE PROMPT-TO-OUTPUT FLOW</span><h3>Ask. Generate. Receive.</h3>
        <div class="pxl-simple-flow"><span><b>01</b>Prompt</span><span><b>02</b>Generate</span><span><b>03</b>Response</span></div>
        <p>Useful for quick answers and individual tasks.</p>
      </div>
      <div class="pxl-compare-arrow" aria-hidden="true">→</div>
      <div class="pxl-compare-card pxl-projectx-card">
        <span class="pxl-compare-label">THE PROJECTX DIRECTION</span><h3>Work toward the whole outcome.</h3>
        <div class="pxl-projectx-flow" role="group" aria-label="ProjectX lifecycle">
          <button type="button" data-flow-stage="intent" aria-pressed="true"><b>01</b>Intent</button>
          <button type="button" data-flow-stage="understand" aria-pressed="false"><b>02</b>Understand</button>
          <button type="button" data-flow-stage="plan" aria-pressed="false"><b>03</b>Plan</button>
          <button type="button" data-flow-stage="create" aria-pressed="false"><b>04</b>Create</button>
          <button type="button" data-flow-stage="verify" aria-pressed="false"><b>05</b>Verify</button>
          <button type="button" data-flow-stage="improve" aria-pressed="false"><b>06</b>Improve</button>
        </div>
        <p id="pxl-flow-description" class="pxl-flow-description">Context stays connected as the work moves forward.</p>
      </div>
      </div>
    </div>
  </section>

  <section class="pxl-section pxl-experience-section pxl-reveal-up px-reveal-up" id="pxl-experience">
    <div class="pxl-experience-layout">
      <div class="pxl-experience-copy"><div class="pxl-section-label"><span></span> THE PRODUCT EXPERIENCE</div><h2>From<br>conversation to<br><em>creation.</em></h2><p>Describe the outcome, refine the plan, work on the deliverable, and keep the moving pieces together in one workspace.</p><ul><li>Keep the goal and decisions in context</li><li>Plan and refine work in one place</li><li>Inspect files, changes, and previews</li><li>See what needs attention next</li></ul></div>
      <div class="pxl-workspace-preview" aria-label="ProjectX workspace preview">
        <div class="pxl-preview-sidebar"><strong>Project<span>X</span></strong><span class="active">Overview</span><span>Projects</span><span>Build</span><span>Design</span><span>Preview</span><span>Files</span><span>Brain</span></div>
        <div class="pxl-preview-main"><div class="pxl-preview-top"><span>WORKSPACE　/　PROJECTS　/　PORTFOLIO WEBSITE</span><b>•••</b></div><div class="pxl-preview-title"><div><h3>Portfolio website</h3><p>A clean personal site to present selected work.</p></div><span>IN PROGRESS</span></div><div class="pxl-preview-tabs"><b>Overview</b><span>Plan</span><span>Build</span><span>Preview</span></div><div class="pxl-preview-grid"><div class="pxl-preview-panel"><strong>PROJECT CHECKLIST</strong><p><i>✓</i>Clarify the portfolio goal <small>Done</small></p><p><i>✓</i>Map the page structure <small>Done</small></p><p><i>✓</i>Build the first version <small>Next</small></p><p><i>✓</i>Review responsive layouts <small>Later</small></p></div><div class="pxl-preview-panel"><strong>LIVE PREVIEW</strong><div class="pxl-mini-browser"><div>•••</div><article><small>SELECTED WORK / 2026</small><b>Designing<br>what’s next.</b><hr></article></div><em>A project preview at a glance</em></div></div></div></div>
    </div>
  </section>

  <section class="pxl-section pxl-brain-section pxl-reveal-up px-reveal-up" id="pxl-brain">
    <div class="pxl-brain-layout">
      <div class="pxl-brain-copy"><div class="pxl-section-label"><span></span> PROJECT BRAIN</div><h2>One project.<br>One <em>persistent brain.</em></h2><p>ProjectX keeps the context of your project — goals, requirements, decisions, resources, and progress — so you can continue without starting over.</p><ul><li>Remember why decisions were made</li><li>Keep important project context connected</li><li>Build on previous work as the project evolves</li></ul></div>
      <div class="pxl-brain-visual" id="pxl-brain-stage">
        <svg class="pxl-brain-connectors" viewBox="0 0 760 520" aria-hidden="true"><path d="M120 84 C260 84 292 170 366 240"/><path d="M120 260 C260 260 292 260 366 260"/><path d="M120 436 C260 436 292 350 366 280"/><path d="M640 84 C500 84 468 170 394 240"/><path d="M640 260 C500 260 468 260 394 260"/><path d="M640 436 C500 436 468 350 394 280"/><path d="M380 88 C380 142 380 168 380 200"/></svg>
        <button class="pxl-brain-module brain-left brain-top" type="button" data-brain-module="requirements" aria-pressed="false"><span>≡</span><b>Requirements</b></button>
        <button class="pxl-brain-module brain-left brain-mid" type="button" data-brain-module="decisions" aria-pressed="false"><span>◇</span><b>Decisions</b></button>
        <button class="pxl-brain-module brain-left brain-bottom" type="button" data-brain-module="context" aria-pressed="false"><span>▤</span><b>Context</b></button>
        <button class="pxl-brain-module brain-right brain-top" type="button" data-brain-module="architecture" aria-pressed="false"><span>✧</span><b>Architecture</b></button>
        <button class="pxl-brain-module brain-right brain-mid" type="button" data-brain-module="resources" aria-pressed="false"><span>▣</span><b>Resources</b></button>
        <button class="pxl-brain-module brain-right brain-bottom" type="button" data-brain-module="history" aria-pressed="false"><span>↻</span><b>History</b></button>
        <button class="pxl-brain-module brain-extra" type="button" data-brain-module="capabilities" aria-pressed="false"><span>⌘</span><b>Capabilities</b></button>
        <div class="pxl-brain-core" aria-hidden="true"><div class="pxl-brain-layer layer-outer"></div><div class="pxl-brain-layer layer-mid"></div><div class="pxl-brain-layer layer-inner"></div><span class="pxl-brain-core-x">×</span><small>PROJECT BRAIN</small></div>
      </div>
    </div>
    <div class="pxl-brain-detail" id="pxl-brain-detail"><div class="pxl-brain-detail-copy"><span class="pxl-brain-detail-label">PROJECT BRAIN / CORE</span><h3>Explore the project structure.</h3><p>Select a module to reveal what it contains. Architecture can be explored level by level.</p></div><span class="pxl-brain-detail-label">7 CONNECTED MODULES</span></div>
  </section>

  <section class="pxl-section pxl-execution-section pxl-reveal-up px-reveal-up" id="pxl-execution">
    <div class="pxl-split-layout">
      <div class="pxl-split-copy"><div class="pxl-section-label"><span></span> THE EXECUTION LOOP</div><h2>Build it. Test it.<br>Make it <em>better.</em></h2><p>A connected cycle that helps turn an idea into a usable outcome — then improves it with evidence and feedback.</p></div>
      <div class="pxl-loop-wrap"><div class="pxl-loop" role="group" aria-label="Execution loop">
      <div class="pxl-loop-line" aria-hidden="true"></div>
      <button class="pxl-loop-step" type="button" data-loop-stage="0" aria-pressed="true"><span>◎</span><b>Understand</b><small>Clarify the outcome</small></button>
      <button class="pxl-loop-step" type="button" data-loop-stage="1" aria-pressed="false"><span>≡</span><b>Plan</b><small>Map the work</small></button>
      <button class="pxl-loop-step" type="button" data-loop-stage="2" aria-pressed="false"><span>⌘</span><b>Create</b><small>Build a first version</small></button>
      <button class="pxl-loop-step" type="button" data-loop-stage="3" aria-pressed="false"><span>⌁</span><b>Test</b><small>Check behaviour</small></button>
      <button class="pxl-loop-step" type="button" data-loop-stage="4" aria-pressed="false"><span>✓</span><b>Verify</b><small>Confirm the result</small></button>
      <button class="pxl-loop-step" type="button" data-loop-stage="5" aria-pressed="false"><span>◇</span><b>Secure</b><small>Review key risks</small></button>
      <button class="pxl-loop-step" type="button" data-loop-stage="6" aria-pressed="false"><span>↗</span><b>Ship</b><small>Make it available</small></button>
      <button class="pxl-loop-step" type="button" data-loop-stage="7" aria-pressed="false"><span>↻</span><b>Improve</b><small>Learn and iterate</small></button>
    </div>
        <div class="pxl-loop-bottom"><span>DELIVER</span><b>↻</b><span>LEARN</span><b>↻</b><span>IMPROVE</span><b>↻</b><span>REPEAT</span></div>
        <div class="pxl-loop-controls"><p id="pxl-loop-description">Clarify the outcome and make sure the project is solving the right problem.</p><button class="pxl-button pxl-button-dark" id="pxl-play-loop" type="button">Play loop ↗</button></div>
  </section>

  <section class="pxl-section pxl-final-section pxl-reveal-up px-reveal-up" id="pxl-final">
    <div class="pxl-final-card">
      <div class="pxl-final-x">×</div><div class="pxl-section-label"><span></span> YOUR NEXT IDEA STARTS HERE</div>
      <h2>Have an idea?<br>Turn it into something <em>real.</em></h2><p>Start with the outcome you have in mind. Refine the details as you go.</p>
      <div class="pxl-final-actions"><button class="pxl-button pxl-button-dark" id="public-final-start" type="button">Get Started <span>→</span></button><a class="pxl-button pxl-button-light" href="#pxl-purpose">Explore Product</a></div>
    </div>
    <footer class="pxl-footer"><div class="pxl-footer-brand"><a class="pxl-brand" href="./"><span class="pxl-brand-mark" aria-hidden="true"><i></i><i></i></span><span>Project<span class="pxl-brand-x">X</span></span></a><p>The Universal Creation Engine.<br>From human intent to real outcomes.</p></div><div class="pxl-footer-column"><b>Product</b><a href="#pxl-purpose">Overview</a><a href="#pxl-create">Creation types</a><a href="#pxl-difference">How it works</a><a href="./billing.html">Pricing</a></div><div class="pxl-footer-column"><b>Resources</b><a href="#pxl-experience">Documentation</a><a href="#pxl-brain">Guides</a><a href="#pxl-create">Examples</a><a href="#pxl-execution">Support</a></div><div class="pxl-footer-column"><b>Company</b><a href="#pxl-final">About</a><a href="#pxl-final">Contact</a><a href="#pxl-final">Updates</a><a href="#pxl-final">Community</a></div><div class="pxl-footer-bottom"><span>© 2026 ProjectX. All rights reserved.</span><span><a href="./privacy.html">Privacy</a><a href="./terms.html">Terms</a><a href="./security.html">Security</a></span></div></footer>
  </section>
</main>
</div>`;
}
export function authMarkup({mode}) {
  const signup = mode === 'signup';
  return `<div class="px-auth">
    <a class="logo px-mark" id="auth-home" href="./"><span class="px-mark-badge">X</span> ProjectX</a>
    <div class="px-auth-card">
      <div class="kicker">${signup ? 'CREATE ACCOUNT' : 'LOG IN'}</div>
      <h1>${signup ? 'Start your workspace' : 'Welcome back'}</h1>
      <p class="sub">${signup ? 'Email and password. Projects sync to your Supabase account.' : 'Sign in to sync projects and the encrypted AI vault.'}</p>
      <div class="px-cta" style="margin:14px 0">
        <button class="ghost ${signup ? '' : 'active'}" id="auth-signin-mode" type="button">Log in</button>
        <button class="ghost ${signup ? 'active' : ''}" id="auth-signup-mode" type="button">Sign up</button>
      </div>
      <label class="sub" for="auth-email">Email</label>
      <input id="auth-email" class="input full" type="email" placeholder="you@email.com" autocomplete="username">
      <label class="sub" for="auth-password" style="margin-top:10px;display:block">Password</label>
      <input id="auth-password" class="input full" type="password" placeholder="At least 6 characters" style="margin-top:6px" autocomplete="${signup ? 'new-password' : 'current-password'}">
      <div id="auth-status" class="sub" style="margin-top:10px"></div>
      <button class="primary px-auth-submit" id="auth-submit" type="button">${signup ? 'Create account' : 'Log in'}</button>
      <div class="px-auth-links">
        <button class="ghost" id="auth-recover" type="button">Forgot password</button>
        <button class="ghost" id="auth-guest" type="button">Continue as guest</button>
      </div>
      <p class="sub">Google and GitHub login are not connected. Payments can stay off while you test with one API key.</p>
    </div>
  </div>`;
}

function projectIcon(id){
  const icons={
    build:'<svg viewBox="0 0 24 24"><path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8L12 3Z"/></svg>',
    preview:'<svg viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M8 20h8M9 8l6 4-6 4V8Z"/></svg>',
    files:'<svg viewBox="0 0 24 24"><path d="M3 6.5A2.5 2.5 0 0 1 5.5 4H10l2 2h6.5A2.5 2.5 0 0 1 21 8.5v8A2.5 2.5 0 0 1 18.5 19h-13A2.5 2.5 0 0 1 3 16.5v-10Z"/></svg>',
    settings:'<svg viewBox="0 0 24 24"><path d="M9.5 3h5l.8 2.3 2 .9 2.2-.9 2.1 3.6-1.8 1.6.1 2.2 1.7 1.6-2.1 3.6-2.1-.9-2 .9L14.5 21h-5l-.8-2.3-2-.9-2.2.9-2.1-3.6 1.8-1.6-.1-2.2-1.7-1.6 2.1-3.6 2.1.9 2-.9L9.5 3Z"/><circle cx="12" cy="12" r="3"/></svg>',
    more:'<svg viewBox="0 0 24 24"><circle cx="5" cy="12" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="19" cy="12" r="1.5"/></svg>',
    home:'<svg viewBox="0 0 24 24"><path d="M4 10.5 12 4l8 6.5V20H4v-9.5Z"/><path d="M9 20v-5h6v5"/></svg>'
  };
  return icons[id] || icons.more;
}

export function chrome({esc, session, recents, active, body, project, nav, right, status, email, execNote}) {
  const title = project ? esc(project.title) : 'ProjectX';
  if(project){
    const tools = navForProject(project);
    const visible = tools.filter(([id])=>['build','design','preview','files','settings'].includes(id));
    const rail = visible.map(([id,name])=>`<button class="px-rail-tool ${(nav||active)===id?'active':''}" data-project-tool="${esc(id)}" title="${esc(name)}" aria-label="${esc(name)}">${projectIcon(id)}<span class="px-rail-label">${esc(name)}</span></button>`).join('');
    const recent = recents.map(p => `<button data-open="${esc(p.id)}"><b>${esc(p.title)}</b><span>${esc(p.type)}</span></button>`).join('') || '<div class="sub" style="padding:8px 10px">No projects yet</div>';
    const agentPane = right ? `<aside class="px-right replit-agent" id="px-right">
      <div class="px-agent-bar">
        <div><div class="kicker">AGENT</div><strong>Build with ProjectX</strong></div>
        <button class="ghost px-icon-btn" data-cmd="toggle-assistant" aria-label="Hide Agent panel">×</button>
      </div>
      <div class="px-agent-body">${right}</div>
    </aside>` : '';
    return `<div class="px-shell replit-shell actual-replit-shell" id="px-shell">
      <aside class="px-left replit-rail" id="px-left">
        <button class="px-brand-mini" data-nav="home" title="ProjectX home" aria-label="ProjectX home"><span class="px-brand-mark">X</span></button>
        <button class="px-project-mini" id="px-project-switch" type="button" title="Switch project" aria-label="Switch project"><span>${projectIcon('home')}</span></button>
        <div class="px-switch-list" id="px-switch-list" hidden>${recent}</div>
        <button class="px-new-mini" data-nav="home" title="New project" aria-label="New project">+</button>
        <div class="px-rail-divider"></div>
        <nav class="px-rail-nav" id="px-tool-nav">${rail}</nav>
        <button class="px-rail-tool px-more-tool" data-cmd="more-tools" title="More tools" aria-label="More tools">${projectIcon('more')}</button>
        <div class="px-rail-spacer"></div>
        <button class="px-rail-tool" data-cmd="palette" title="Command menu" aria-label="Command menu"><span class="px-rail-command">⌘</span></button>
        <div class="px-account-dot" title="${email ? esc(email) : 'Guest workspace'}">${email ? esc(email.slice(0,1).toUpperCase()) : 'G'}</div>
      </aside>
      <header class="px-topbar actual-replit-topbar">
        <button class="ghost px-nav-toggle" id="px-nav-toggle" aria-label="Open navigation">Menu</button>
        <div class="px-project-titlebar">
          <button type="button" class="px-project-name-edit" data-project-title-edit title="Rename project">${title} <span aria-hidden="true">✎</span></button>
          <span class="px-domain-badge">${esc(project.domain||project.kind||project.type||'Project')}</span>
          <span class="px-project-status"><span class="px-live-dot"></span>${status ? esc(status) : 'Ready'}</span>
        </div>
        <div class="px-center-actions px-mode-switch" role="group" aria-label="Workspace mode">
          <button type="button" data-workspace-mode="studio" aria-pressed="${['build','design','preview'].includes(nav||active)?'true':'false'}">Studio</button>
          <button type="button" data-workspace-mode="canvas" aria-pressed="${['overview','tasks','artifacts'].includes(nav||active)?'true':'false'}">Canvas</button>
          <button type="button" data-workspace-mode="console" aria-pressed="${['files','git','terminal'].includes(nav||active)?'true':'false'}">Console</button>
        </div>
        <div class="px-center-actions px-mode-quicklinks">
          <button class="ghost ${(nav||active)==='preview'?'active':''}" data-project-tool="preview">Preview</button>
          <button class="ghost ${(nav||active)==='files'?'active':''}" data-project-tool="files">Files</button>
        </div>
      <span style="flex:1"></span>
        <button class="ghost" data-cmd="palette" title="Command palette">⌘K</button>
        <button class="ghost" data-cmd="share">Share</button>
        <button class="primary px-agent-toggle" data-cmd="toggle-assistant">Agent</button>
      </header>
      <main class="px-center main actual-replit-center">${body}</main>
      ${agentPane}
      <div class="px-bottom" id="px-bottom" hidden>
        <div class="label">Activity</div>
        <div id="px-bottom-log" class="conversation"></div>
      </div>
    </div>
    <div class="px-palette" id="px-palette" hidden>
      <div class="px-palette-box">
        <input id="px-palette-input" placeholder="Search…" aria-label="Command palette">
        <div class="px-palette-list" id="px-palette-list"></div>
      </div>
    </div>`;
  }

  const tools = APP_TOOLS;
  const left = tools.map(([id, name]) => `<button class="${id === active ? 'active' : ''}" data-nav="${esc(id)}" data-search="${esc(name)}">${esc(name)}</button>`).join('');
  const recent = recents.map(p => `<button data-open="${esc(p.id)}"><b>${esc(p.title)}</b><span>${esc(p.type)}</span></button>`).join('') || '<div class="sub" style="padding:8px 10px">No projects yet</div>';
  return `<div class="px-shell no-right" id="px-shell">
    <aside class="px-left side" id="px-left">
      <button class="logo" data-nav="home" title="Home">ProjectX</button>
      <button class="ghost px-switcher" id="px-project-switch" type="button">Projects ▾</button>
      <div class="px-switch-list" id="px-switch-list" hidden>${recent}</div>
      <button class="new" data-nav="home">New project</button>
      <input class="input px-side-search" id="px-side-search" placeholder="Search" aria-label="Search workspace">
      <nav class="nav" id="px-tool-nav">${left}</nav>
      <div class="divider"></div>
      <div class="label">Recent</div>
      <div class="recent">${recent}</div>
      <div class="acct">${email ? esc(email) : 'Guest workspace'}<div class="sub">${session ? 'Cloud workspace' : 'Local workspace'}</div></div>
    </aside>
    <header class="px-topbar top">
      <button class="ghost px-nav-toggle" id="px-nav-toggle" aria-label="Open navigation">Menu</button>
      <strong>ProjectX</strong><span style="flex:1"></span>
      <button class="ghost" data-cmd="palette" title="Command palette">⌘K</button>
      ${session ? '<button data-action="signout">Sign out</button>' : '<button data-action="signin">Sign in</button>'}
    </header>
    <main class="px-center main">${body}</main>
  </div>
  <div class="px-palette" id="px-palette" hidden>
    <div class="px-palette-box">
      <input id="px-palette-input" placeholder="Search…" aria-label="Command palette">
      <div class="px-palette-list" id="px-palette-list"></div>
    </div>
  </div>`;
}
export function launcherMarkup({esc, session, projects, guestReady}) {
  const cards = projects.slice(0, 6).map(p => `<button class="px-recent-card" data-open="${esc(p.id)}"><div class="px-recent-card-title">${esc(p.title)}</div><div class="px-recent-card-meta">${esc(p.type)} · ${esc(p.status)}</div><div class="sub">${esc(String(p.intent || p.spec?.goal || '').slice(0,110))}</div></button>`).join('');
  return `<div class="px-home-builder">
    <div class="px-home-builder-inner">
      <div class="px-home-eyebrow">PROJECTX / NEW PROJECT</div>
      <h1>What are you building?</h1>
      <p class="px-home-lead">Start with the outcome. Then give ProjectX enough visual direction to avoid the generic AI look.</p>

      <div class="px-home-grid">
        <div class="px-home-primary">
          <div class="px-home-composer composer">
            <textarea id="start-input" placeholder="Build a website for my sneaker-cleaning business…"></textarea>
            <div class="px-home-composer-foot">
              <div class="px-home-shortcuts">
                <button class="px-shortcut" data-template="website">Website</button>
                <button class="px-shortcut" data-template="app">Web app</button>
                <button class="px-shortcut" data-template="game">Game</button>
                <button class="px-shortcut" data-template="business">Business</button>
                <button class="px-shortcut" data-template="research">Research</button>
                <button class="px-shortcut" data-template="deck">Deck</button>
              </div>
              <button class="send px-home-send" id="start-send" aria-label="Start project">→</button>
            </div>
          </div>
          <div class="px-home-hint"><span>${session ? 'Cloud workspace connected' : guestReady ? 'Guest AI ready' : 'Connect AI when you need it'}</span><span>⌘ Enter to start</span></div>
        </div>

        <section class="px-design-panel">
          <div class="px-design-panel-head">
            <div><b>Design direction</b><span>Optional, but recommended</span></div>
            <span class="px-design-badge">VISUAL CONTRACT</span>
          </div>
          <div class="px-design-grid">
            <label><span>Visual character</span><select id="design-character">
              <option value="">Let ProjectX decide</option>
              <option>Editorial / typographic</option><option>Minimal / product-led</option><option>Technical / precise</option>
              <option>Playful / expressive</option><option>Luxury / restrained</option><option>Brutalist / raw</option><option>Dark / cinematic</option>
            </select></label>
            <label><span>Reference sites</span><input id="design-references" placeholder="Linear, Apple, labs.google…"></label>
            <label><span>Typography</span><input id="design-type" placeholder="Grotesk + mono, serif editorial…"></label>
            <label><span>Color direction</span><input id="design-colors" placeholder="Bone + ink + electric blue…"></label>
            <label class="px-design-wide"><span>Avoid</span><input id="design-banned" placeholder="Purple gradients, glassmorphism, excessive cards…"></label>
            <label class="px-design-wide"><span>Distinctive idea</span><textarea id="design-distinctive" rows="2" placeholder="What should people remember about the interface?"></textarea></label>
          </div>
          <div class="px-design-note"><strong>ProjectX rule</strong><span>References become tokens, layout rules, component decisions, and constraints before generation.</span></div>
        </section>
      </div>
    </div>

    <section class="px-home-recent">
      <div class="px-section-head"><div><strong>Recent projects</strong><div class="sub">Jump back into something you've been building.</div></div></div>
      <div class="px-recent-grid">${cards||'<div class="px-empty">No projects yet.</div>'}</div>
    </section>
  </div>`;
}

export function interviewMarkup() {
  return `<div class="interview poll-interview px-creation-chat">
    <div class="px-creation-top">
      <div>
        <div class="kicker">LET'S BUILD IT</div>
        <h1 class="px-creation-title">A few quick questions, then I'll start.</h1>
        <p class="sub">You can answer in your own words. I'll handle the technical details.</p>
      </div>
      <div class="px-creation-step" id="interview-step">Step 1</div>
    </div>
    <div id="interview-understanding" class="understanding"></div>
    <div id="interview-poll" class="discovery-poll" aria-live="polite"></div>
    <div id="interview-status" class="poll-status" aria-live="polite"></div>
  </div>`;
}

export function projectHead({esc, project}) {
 const hasFiles=Object.keys(project.files||{}).length>0,summary=String(project.understanding?.summary||project.intent||'').trim(),mode=project.uiMode||'studio';
 return `<div class="px-replit-project px-tri-workspace" data-ui-mode="${esc(mode)}">
 <div class="px-workspace-title px-workspace-topbar"><div class="px-workspace-title-main"><span class="px-workspace-kicker">PROJECT / ${esc(String(project.domain||project.kind||'UNIVERSAL').toUpperCase())}</span><strong>${esc(project.title)}</strong><span class="px-workspace-desc">${esc(summary||'Build, preview, and refine your project.')} <i class="px-sync-state">● ${esc(project.sync?.mode==='cloud'?'Synced to cloud':project.sync?.mode==='pending'?'Sync pending':'Local state')}</i></span></div>
 <div class="px-workspace-actions"><button class="ghost" data-workspace-action="tests" type="button">Run tests</button><button class="ghost" data-workspace-action="preview" type="button">Preview ↗</button></div></div>
 <div class="px-stage" id="px-project-stage"><div class="px-stage-bar"><div class="px-stage-left"><span class="px-stage-title">${mode==='canvas'?'Outcome canvas':mode==='console'?'Code console':hasFiles?'Live app':'Build workspace'}</span><span class="px-stage-sub">${mode==='canvas'?'Goals, milestones, artifacts, and verification':mode==='console'?'Files, changes, and developer tools':hasFiles?'Interact with the current artifact':'Ask Agent to start building'}</span></div><div class="px-stage-tools"><button class="ghost" data-project-tool="preview" type="button">Open preview</button></div></div><div id="project-body" class="body px-project-body"></div></div></div>`;
}

export function assistantDock({esc, project, actions}) {
  const status = project?.pendingMutation ? 'Awaiting approval' : (project?.status || 'Ready');
  return `<div class="px-assist-head">
    <div>
      <div class="kicker">PROJECT AGENT</div>
      <div class="px-agent-title">Build with me</div>
    </div>
    <div class="sub" id="px-agent-status">${esc(status)} · ${esc(settingsSafe(project))}</div>
  </div>
  <div class="px-agent-context">Ask for a new feature, a fix, a design change, or an explanation. ProjectX keeps the project context.</div>
  <div id="assistant-dock-log" class="conversation" role="log" aria-live="polite"></div>
  <div class="px-assist-actions">${(actions || CONTEXT_ACTIONS.default).map(a => `<button type="button" class="chip" data-assist-action="${esc(a)}">${esc(a)}</button>`).join('')}</div>
  <form id="assistant-dock-form" class="form px-agent-form">
    <textarea id="assistant-dock-input" placeholder="Ask Agent to build, change, or fix something…"></textarea>
    <button class="primary" id="assistant-dock-send" type="submit">Send</button>
  </form>
  <form id="plan-dock-form" class="form px-agent-plan" style="margin:0">
    <textarea id="plan-dock-input" placeholder="Queue another task while this runs…"></textarea>
    <button class="ghost" id="plan-dock-send" type="submit">Queue task</button>
  </form>`;
}

function settingsSafe(project) {
  return project?.executionState?.lastAgent || 'orchestrator';
}

export function unavailable(title, detail, next) {
  return `<div class="box"><h2 style="margin:0 0 8px">${title}</h2><p class="sub">${detail}</p><div class="placeholder" style="margin-top:12px">${next}</div></div>`;
}

export function taskBoard(tasks, esc) {
  const cols = { draft: [], active: [], ready: [], done: [] };
  for (const t of tasks) {
    const s = String(t.status || 'draft').toLowerCase();
    if (s === 'done' || s === 'cancelled') cols.done.push(t);
    else if (s === 'awaiting approval' || s === 'ready') cols.ready.push(t);
    else if (s === 'active' || s === 'in_progress' || s === 'blocked') cols.active.push(t);
    else cols.draft.push(t);
  }
  const col = (key, label) => `<div class="px-col"><h3>${label}</h3>${cols[key].map(t => `<div class="px-task" data-task="${esc(t.id)}"><b>${esc(t.title)}</b><div class="sub">${esc(t.agent || 'orchestrator')} · ${esc(t.status)}</div></div>`).join('') || '<div class="sub">Empty</div>'}</div>`;
  return `<div class="px-kanban">${col('draft', 'Drafts')}${col('active', 'Active')}${col('ready', 'Ready')}${col('done', 'Done')}</div>`;
}
