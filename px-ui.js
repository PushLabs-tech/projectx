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
    <div class="pxl-centered-intro"><div class="pxl-section-label"><span></span> THE IDEA TO OUTCOME</div><h2>Your idea is only the <em>beginning.</em></h2><p>ProjectX turns human intent into real, working, measurable outcomes — from the first thought to something you can actually ship.</p></div>
    <div class="pxl-purpose-flow" role="group" aria-label="ProjectX creation lifecycle">
      <button type="button" data-lifecycle-step="intent" aria-pressed="true"><span class="purpose-icon">◎</span><strong>Intent</strong><small>Name the outcome</small></button>
      <button type="button" data-lifecycle-step="understand" aria-pressed="false"><span class="purpose-icon">✳</span><strong>Understand</strong><small>Clarify the goal</small></button>
      <button type="button" data-lifecycle-step="plan" aria-pressed="false"><span class="purpose-icon">≡</span><strong>Plan</strong><small>Map the work</small></button>
      <button type="button" data-lifecycle-step="create" aria-pressed="false"><span class="purpose-icon">⌘</span><strong>Create</strong><small>Make it real</small></button>
      <button type="button" data-lifecycle-step="verify" aria-pressed="false"><span class="purpose-icon">✓</span><strong>Verify</strong><small>Check the result</small></button>
      <button type="button" data-lifecycle-step="ship" aria-pressed="false"><span class="purpose-icon">↗</span><strong>Ship</strong><small>Put it to use</small></button>
      <button type="button" data-lifecycle-step="improve" aria-pressed="false"><span class="purpose-icon">↻</span><strong>Improve</strong><small>Keep evolving</small></button>
    </div>
    <div class="pxl-stage-explainer" id="pxl-lifecycle-description" aria-live="polite"><b>INTENT</b><p>Name the outcome and start from what you actually want to accomplish.</p></div>
    <div class="pxl-section-note">One connected journey — from the first thought to the next meaningful result.</div>
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
    <div class="pxl-difference-head"><div class="pxl-section-label"><span></span> THE PROJECTX APPROACH</div><h2>It doesn’t just generate.<br>It <em>understands.</em></h2><p>A prompt is only the starting point. ProjectX works toward the outcome — keeping the goal, decisions, creation, and verification connected.</p></div>
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
    <div class="pxl-centered-intro"><div class="pxl-section-label"><span></span> THE EXECUTION LOOP</div><h2>Build it. Test it.<br>Make it <em>better.</em></h2><p>A connected cycle that helps turn an idea into a usable outcome — then improves it with evidence and feedback.</p></div>
    <div class="pxl-loop" role="group" aria-label="Execution loop">
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
