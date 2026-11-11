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
  return "<div class=\"pxl-page\" id=\"pxl-top\">\n<header class=\"pxl-nav\">\n  <a class=\"pxl-brand\" href=\"./\" aria-label=\"ProjectX home\"><span class=\"pxl-brand-mark\">P<span>×</span></span><span>ProjectX</span></a>\n  <nav class=\"pxl-links\" aria-label=\"Main navigation\"><a href=\"#pxl-purpose\">Product</a><a href=\"./billing.html\">Pricing</a><a href=\"#pxl-experience\">Docs</a><a href=\"#pxl-brain\">Resources</a></nav>\n  <div class=\"pxl-nav-actions\"><button class=\"pxl-signin\" id=\"public-signin\" type=\"button\">Log in</button><button class=\"pxl-button pxl-button-dark pxl-button-small\" id=\"public-workspace\" type=\"button\">Get Started <span aria-hidden=\"true\">→</span></button></div>\n</header>\n<main>\n  <section class=\"pxl-hero\" id=\"pxl-hero\" aria-labelledby=\"pxl-hero-title\">\n    <div class=\"pxl-hero-copy\"><div class=\"pxl-eyebrow\"><span class=\"pxl-live-dot\"></span> THE UNIVERSAL CREATION ENGINE</div><h1 id=\"pxl-hero-title\">Turn any idea into a<br><em>real product.</em></h1><p class=\"pxl-lead\">From the first thought to something you can actually ship. ProjectX helps you understand the goal, plan the work, create the right outcome, and keep improving it.</p></div>\n    <div class=\"pxl-composer\" role=\"group\" aria-label=\"Start a ProjectX creation\">\n      <div class=\"pxl-composer-top\"><span class=\"pxl-composer-kicker\">START WITH AN IDEA</span><span class=\"pxl-composer-status\"><i></i> READY WHEN YOU ARE</span></div>\n      <label class=\"pxl-prompt-label\" for=\"start-input\">What do you want to create?</label>\n      <textarea id=\"start-input\" rows=\"2\" data-domain=\"web\" placeholder=\"What do you want to create?\" aria-label=\"Describe what you want to create\"></textarea>\n      <div class=\"pxl-chip-row\" role=\"group\" aria-label=\"Choose a creation type\">\n        <button type=\"button\" class=\"active\" aria-pressed=\"true\" data-domain=\"web\" data-placeholder=\"Describe the website or web experience you want to create.\">Website</button>\n        <button type=\"button\" aria-pressed=\"false\" data-domain=\"app\" data-placeholder=\"Describe the app or product you want to create.\">App</button>\n        <button type=\"button\" aria-pressed=\"false\" data-domain=\"agent\" data-placeholder=\"Describe what your AI agent should help accomplish.\">Agent</button>\n        <button type=\"button\" aria-pressed=\"false\" data-domain=\"automation\" data-placeholder=\"Describe the workflow you want to automate.\">Automation</button>\n        <button type=\"button\" class=\"pxl-shuffle\" id=\"pxl-shuffle\" aria-label=\"Choose a creation type at random\" title=\"Shuffle creation type\">↻</button>\n      </div>\n      <div class=\"pxl-composer-foot\"><span>Start with the outcome. The details can come later.</span><button class=\"pxl-send\" id=\"public-start-arrow\" type=\"button\" aria-label=\"Start creating\">↑</button></div>\n    </div>\n    <div class=\"pxl-hero-under\"><button class=\"pxl-button pxl-button-dark\" id=\"public-start\" type=\"button\">Start with your idea <span aria-hidden=\"true\">→</span></button><button class=\"pxl-text-link\" id=\"public-examples\" type=\"button\">Explore what you can create <span aria-hidden=\"true\">↓</span></button></div>\n    <div class=\"pxl-hero-note\">One intention. A connected path to a real outcome.</div>\n  </section>\n\n  <section class=\"pxl-section pxl-purpose-section px-reveal-up\" id=\"pxl-purpose\">\n    <div class=\"pxl-section-intro\"><div class=\"pxl-section-label\">02 / THE PURPOSE</div><h2>Your idea is only<br>the <em>beginning.</em></h2><p>ProjectX turns human intent into real, working, measurable outcomes — from the first thought to something you can actually ship. The process adapts to the kind of result you are trying to create.</p></div>\n    <div class=\"pxl-purpose-flow\" role=\"group\" aria-label=\"Explore the ProjectX creation lifecycle\">\n      <button type=\"button\" data-lifecycle-step=\"intent\" aria-pressed=\"true\"><small>01</small><span>Intent</span></button><button type=\"button\" data-lifecycle-step=\"understand\" aria-pressed=\"false\"><small>02</small><span>Understand</span></button><button type=\"button\" data-lifecycle-step=\"plan\" aria-pressed=\"false\"><small>03</small><span>Plan</span></button><button type=\"button\" data-lifecycle-step=\"create\" aria-pressed=\"false\"><small>04</small><span>Create</span></button><button type=\"button\" data-lifecycle-step=\"verify\" aria-pressed=\"false\"><small>05</small><span>Verify</span></button><button type=\"button\" data-lifecycle-step=\"ship\" aria-pressed=\"false\"><small>06</small><span>Ship</span></button><button type=\"button\" data-lifecycle-step=\"improve\" aria-pressed=\"false\"><small>07</small><span>Improve</span></button>\n    </div>\n    <div class=\"pxl-stage-explainer\" id=\"pxl-lifecycle-description\" aria-live=\"polite\"><b>INTENT</b><p>Start with the outcome the person wants—not a prescribed prompt format.</p></div>\n  </section>\n\n  <section class=\"pxl-section pxl-creation-section px-reveal-up\" id=\"pxl-create\">\n    <div class=\"pxl-section-intro\"><div class=\"pxl-section-label\">03 / WHAT YOU CAN CREATE</div><h2>One engine.<br><em>Almost any creation.</em></h2><p>ProjectX is designed around the outcome, not one file type or one category of software. Select a capability to see the kinds of work it can contain.</p></div>\n    <div class=\"pxl-creation-grid px-reveal-stagger\" aria-label=\"Creation types\">\n      <button class=\"pxl-creation-card\" type=\"button\" data-creation-card=\"website\" aria-expanded=\"false\"><span class=\"pxl-creation-icon\" aria-hidden=\"true\">↗</span><strong>Websites</strong><small>Pages, product sites, and experiences</small><span class=\"pxl-card-detail\">Structure the message, design the interface, and prepare a responsive site.</span></button>\n      <button class=\"pxl-creation-card\" type=\"button\" data-creation-card=\"app\" aria-expanded=\"false\"><span class=\"pxl-creation-icon\" aria-hidden=\"true\">▦</span><strong>Applications</strong><small>Products, portals, and internal tools</small><span class=\"pxl-card-detail\">Connect user flows, interface, data, and application behavior.</span></button>\n      <button class=\"pxl-creation-card\" type=\"button\" data-creation-card=\"agent\" aria-expanded=\"false\"><span class=\"pxl-creation-icon\" aria-hidden=\"true\">◎</span><strong>AI Agents</strong><small>Specialists, tools, and context</small><span class=\"pxl-card-detail\">Define an agent’s role, knowledge, capabilities, and permission boundaries.</span></button>\n      <button class=\"pxl-creation-card\" type=\"button\" data-creation-card=\"automation\" aria-expanded=\"false\"><span class=\"pxl-creation-icon\" aria-hidden=\"true\">↻</span><strong>Automations</strong><small>Workflows, triggers, and integrations</small><span class=\"pxl-card-detail\">Map the steps, conditions, data, and connected services behind a workflow.</span></button>\n      <button class=\"pxl-creation-card\" type=\"button\" data-creation-card=\"api\" aria-expanded=\"false\"><span class=\"pxl-creation-icon\" aria-hidden=\"true\">⌘</span><strong>APIs</strong><small>Services and system connections</small><span class=\"pxl-card-detail\">Plan endpoints, data contracts, validation, and service boundaries.</span></button>\n      <button class=\"pxl-creation-card\" type=\"button\" data-creation-card=\"dashboard\" aria-expanded=\"false\"><span class=\"pxl-creation-icon\" aria-hidden=\"true\">▤</span><strong>Dashboards</strong><small>Analytics and operational views</small><span class=\"pxl-card-detail\">Turn useful information into clear monitoring and decision surfaces.</span></button>\n      <button class=\"pxl-creation-card\" type=\"button\" data-creation-card=\"game\" aria-expanded=\"false\"><span class=\"pxl-creation-icon\" aria-hidden=\"true\">◇</span><strong>Games</strong><small>Mechanics, logic, and progression</small><span class=\"pxl-card-detail\">Shape game loops, controls, systems, and the playable experience.</span></button>\n      <button class=\"pxl-creation-card\" type=\"button\" data-creation-card=\"business\" aria-expanded=\"false\"><span class=\"pxl-creation-icon\" aria-hidden=\"true\">⌂</span><strong>Business systems</strong><small>Operations and business workflows</small><span class=\"pxl-card-detail\">Organize offers, processes, customer workflows, and operating plans.</span></button>\n      <button class=\"pxl-creation-card\" type=\"button\" data-creation-card=\"research\" aria-expanded=\"false\"><span class=\"pxl-creation-icon\" aria-hidden=\"true\">⌕</span><strong>Research</strong><small>Evidence and decision briefs</small><span class=\"pxl-card-detail\">Define questions, gather evidence, compare options, and document findings.</span></button>\n      <button class=\"pxl-creation-card\" type=\"button\" data-creation-card=\"documents\" aria-expanded=\"false\"><span class=\"pxl-creation-icon\" aria-hidden=\"true\">▧</span><strong>Documents</strong><small>Reports, specifications, and plans</small><span class=\"pxl-card-detail\">Create structured material with a clear purpose and useful organization.</span></button>\n      <button class=\"pxl-creation-card\" type=\"button\" data-creation-card=\"presentations\" aria-expanded=\"false\"><span class=\"pxl-creation-icon\" aria-hidden=\"true\">▱</span><strong>Presentations</strong><small>Visual stories and pitch decks</small><span class=\"pxl-card-detail\">Build a narrative, organize the evidence, and communicate the central idea.</span></button>\n      <button class=\"pxl-creation-card\" type=\"button\" data-creation-card=\"custom\" aria-expanded=\"false\"><span class=\"pxl-creation-icon\" aria-hidden=\"true\">＋</span><strong>Custom projects</strong><small>Something that does not fit a box</small><span class=\"pxl-card-detail\">Start with the intended outcome and let the project structure adapt.</span></button>\n    </div>\n  </section>\n\n  <section class=\"pxl-section pxl-difference-section px-reveal-up\" id=\"pxl-difference\">\n    <div class=\"pxl-section-intro\"><div class=\"pxl-section-label\">04 / WHY PROJECTX IS DIFFERENT</div><h2>It doesn’t just generate.<br><em>It understands.</em></h2><p>Generation is one moment in a much larger process. ProjectX is organized to preserve context, connect decisions to work, and make progress inspectable.</p></div>\n    <div class=\"pxl-compare-columns\">\n      <div class=\"pxl-compare-panel\"><span class=\"pxl-compare-kicker\">A COMMON AI FLOW</span><h3>Prompt in. Output out.</h3><div class=\"pxl-compare-simple\"><span>Prompt</span><i></i><span>Generate</span><i></i><span>Done</span></div><p class=\"pxl-flow-description\">Useful for a quick answer or one-off output, but the wider project often has to be managed separately.</p></div>\n      <div class=\"pxl-compare-panel pxl-compare-projectx\"><span class=\"pxl-compare-kicker\">THE PROJECTX DIRECTION</span><h3>A connected creation lifecycle.</h3><div class=\"pxl-flow-steps\" role=\"group\" aria-label=\"Select a ProjectX lifecycle stage\">\n        <button type=\"button\" data-flow-stage=\"intent\" aria-pressed=\"true\">Intent</button><button type=\"button\" data-flow-stage=\"understand\" aria-pressed=\"false\">Understand</button><button type=\"button\" data-flow-stage=\"plan\" aria-pressed=\"false\">Plan</button><button type=\"button\" data-flow-stage=\"create\" aria-pressed=\"false\">Create</button><button type=\"button\" data-flow-stage=\"verify\" aria-pressed=\"false\">Test &amp; verify</button><button type=\"button\" data-flow-stage=\"ship\" aria-pressed=\"false\">Ship</button><button type=\"button\" data-flow-stage=\"improve\" aria-pressed=\"false\">Improve</button>\n      </div><p class=\"pxl-flow-description\" id=\"pxl-flow-description\" aria-live=\"polite\">ProjectX starts by understanding the intended outcome, not by guessing what a prompt should contain.</p></div>\n    </div>\n  </section>\n\n  <section class=\"pxl-section pxl-experience-section px-reveal-up\" id=\"pxl-experience\">\n    <div class=\"pxl-section-intro\"><div class=\"pxl-section-label\">05 / THE PRODUCT EXPERIENCE</div><h2>From first thought<br>to <em>finished work.</em></h2><p>A short walkthrough will live here once the actual ProjectX product is ready to demonstrate. It will show the real experience—not a fabricated interface.</p></div>\n    <div class=\"pxl-video-placeholder\" role=\"group\" aria-label=\"Future ProjectX product walkthrough placeholder\"><div class=\"pxl-video-copy\"><div class=\"pxl-video-mark\" aria-hidden=\"true\">P×</div><h3>The ProjectX walkthrough</h3><p>This space is reserved for a real product video, created after the workspace and creation flow are properly built.</p><div class=\"pxl-video-stages\"><span>Understand</span><span>Plan</span><span>Create</span><span>Test</span><span>Ship</span></div></div></div>\n  </section>\n\n  <section class=\"pxl-section pxl-brain-section px-reveal-up\" id=\"pxl-brain\">\n    <div class=\"pxl-brain-layout\">\n      <div class=\"pxl-brain-copy\"><div class=\"pxl-section-label\">06 / PROJECT INTELLIGENCE</div><h2>One project.<br><em>One persistent brain.</em></h2><p>A project should not have to explain itself again every time work continues. Project Brain connects its requirements, decisions, architecture, capabilities, resources, context, and history.</p><p class=\"pxl-brain-hint\">Select a physical layer around the Core. Architecture can be explored one level at a time.</p></div>\n      <div class=\"pxl-brain-explorer\">\n        <div class=\"pxl-brain-stage\" id=\"pxl-brain-stage\"><div class=\"pxl-brain-scene\">\n          <div class=\"pxl-brain-orbit\" aria-hidden=\"true\"></div><div class=\"pxl-brain-orbit pxl-brain-orbit--inner\" aria-hidden=\"true\"></div>\n          <div class=\"pxl-brain-core\" aria-hidden=\"true\"><div class=\"pxl-core-layer pxl-core-layer--outer\"><span>INTENTION</span></div><div class=\"pxl-core-layer pxl-core-layer--middle\"><span>KNOWLEDGE</span></div><div class=\"pxl-core-layer pxl-core-layer--inner\"><span>EXECUTION</span></div><span class=\"pxl-core-x\">X</span></div>\n          <button class=\"pxl-brain-module\" type=\"button\" data-brain-module=\"history\" aria-pressed=\"false\" style=\"--module-x:50%;--module-y:9%\"><span class=\"pxl-module-shape pxl-shape--history\" aria-hidden=\"true\"><i></i><i></i><i></i><i></i></span><span class=\"pxl-brain-module-name\">History</span></button>\n          <button class=\"pxl-brain-module\" type=\"button\" data-brain-module=\"context\" aria-pressed=\"false\" style=\"--module-x:18%;--module-y:25%\"><span class=\"pxl-module-shape pxl-shape--context\" aria-hidden=\"true\"></span><span class=\"pxl-brain-module-name\">Context</span></button>\n          <button class=\"pxl-brain-module\" type=\"button\" data-brain-module=\"resources\" aria-pressed=\"false\" style=\"--module-x:82%;--module-y:25%\"><span class=\"pxl-module-shape pxl-shape--resources\" aria-hidden=\"true\"><i></i><i></i><i></i><i></i><i></i></span><span class=\"pxl-brain-module-name\">Resources</span></button>\n          <button class=\"pxl-brain-module\" type=\"button\" data-brain-module=\"requirements\" aria-pressed=\"false\" style=\"--module-x:9%;--module-y:54%\"><span class=\"pxl-module-shape pxl-shape--requirements\" aria-hidden=\"true\"><i></i><i></i><i></i></span><span class=\"pxl-brain-module-name\">Requirements</span></button>\n          <button class=\"pxl-brain-module\" type=\"button\" data-brain-module=\"capabilities\" aria-pressed=\"false\" style=\"--module-x:91%;--module-y:54%\"><span class=\"pxl-module-shape pxl-shape--capabilities\" aria-hidden=\"true\"><i></i><i></i><i></i><i></i><i></i></span><span class=\"pxl-brain-module-name\">Capabilities</span></button>\n          <button class=\"pxl-brain-module\" type=\"button\" data-brain-module=\"decisions\" aria-pressed=\"false\" style=\"--module-x:25%;--module-y:88%\"><span class=\"pxl-module-shape pxl-shape--decisions\" aria-hidden=\"true\"><i></i><i></i><i></i><i></i><i></i></span><span class=\"pxl-brain-module-name\">Decisions</span></button>\n          <button class=\"pxl-brain-module\" type=\"button\" data-brain-module=\"architecture\" aria-pressed=\"false\" style=\"--module-x:75%;--module-y:88%\"><span class=\"pxl-module-shape pxl-shape--architecture\" aria-hidden=\"true\"><i></i><i></i></span><span class=\"pxl-brain-module-name\">Architecture</span></button>\n        </div></div>\n        <div class=\"pxl-brain-detail\" id=\"pxl-brain-detail\" aria-live=\"polite\"><div class=\"pxl-brain-detail-copy\"><span class=\"pxl-brain-detail-label\">PROJECT BRAIN / CORE</span><h3>Explore the project structure.</h3><p>Select a module to reveal what it contains. Architecture can be explored level by level.</p></div><span class=\"pxl-brain-detail-label\">7 CONNECTED MODULES</span></div>\n      </div>\n    </div>\n  </section>\n\n  <section class=\"pxl-section pxl-execution-section px-reveal-up\" id=\"pxl-execution\">\n    <div class=\"pxl-section-intro\"><div class=\"pxl-section-label\">07 / THE EXECUTION LOOP</div><h2>Build it. Test it.<br><em>Make it better.</em></h2><p>Creation does not end with the first output. ProjectX is designed around a repeatable improvement loop that checks work and uses the results to guide the next change.</p></div>\n    <div class=\"pxl-loop-grid px-reveal-stagger\" role=\"group\" aria-label=\"Select an execution stage\">\n      <button class=\"pxl-loop-step\" type=\"button\" data-loop-stage=\"0\" aria-pressed=\"true\"><span>01</span><strong>Build</strong><small>Create the first useful version</small></button><button class=\"pxl-loop-step\" type=\"button\" data-loop-stage=\"1\" aria-pressed=\"false\"><span>02</span><strong>Test</strong><small>Run the available checks</small></button><button class=\"pxl-loop-step\" type=\"button\" data-loop-stage=\"2\" aria-pressed=\"false\"><span>03</span><strong>Diagnose</strong><small>Identify observable issues</small></button><button class=\"pxl-loop-step\" type=\"button\" data-loop-stage=\"3\" aria-pressed=\"false\"><span>04</span><strong>Fix</strong><small>Apply a targeted correction</small></button><button class=\"pxl-loop-step\" type=\"button\" data-loop-stage=\"4\" aria-pressed=\"false\"><span>05</span><strong>Retest</strong><small>Check the affected work again</small></button><button class=\"pxl-loop-step\" type=\"button\" data-loop-stage=\"5\" aria-pressed=\"false\"><span>06</span><strong>Verify</strong><small>Confirm what is satisfied</small></button><button class=\"pxl-loop-step\" type=\"button\" data-loop-stage=\"6\" aria-pressed=\"false\"><span>07</span><strong>Ship</strong><small>Prepare the right release</small></button><button class=\"pxl-loop-step\" type=\"button\" data-loop-stage=\"7\" aria-pressed=\"false\"><span>08</span><strong>Improve</strong><small>Choose the next iteration</small></button>\n    </div>\n    <div class=\"pxl-loop-controls\"><p class=\"pxl-loop-description\" id=\"pxl-loop-description\" aria-live=\"polite\">Create the first useful version of the intended outcome.</p><button class=\"pxl-button pxl-button-dark\" type=\"button\" id=\"pxl-play-loop\">Play loop once <span aria-hidden=\"true\">↗</span></button></div>\n  </section>\n\n  <section class=\"pxl-section pxl-final-section px-reveal-up\" id=\"pxl-final\"><div class=\"pxl-cta\"><div><div class=\"pxl-section-label\">08 / YOUR NEXT STEP</div><h2>Turn it into<br>something <em>real.</em></h2></div><div><p>Bring the idea as it is. ProjectX gives you a place to understand it, shape it, create it, and keep moving.</p><button class=\"pxl-button pxl-button-coral\" id=\"public-signup\" type=\"button\">Get Started <span aria-hidden=\"true\">→</span></button></div></div></section>\n</main>\n<footer class=\"pxl-footer\">\n  <a class=\"pxl-brand\" href=\"./\" aria-label=\"ProjectX home\"><span class=\"pxl-brand-mark\">P<span>×</span></span><span>ProjectX</span></a><span>Turn intention into action.</span>\n  <div class=\"pxl-footer-links\"><a href=\"#pxl-purpose\">Product</a><a href=\"./billing.html\">Pricing</a><a href=\"#pxl-brain\">Resources</a><a href=\"./privacy.html\">Privacy</a><a href=\"./terms.html\">Terms</a><a href=\"#login\" id=\"public-footer-signin\">Log in</a></div>\n</footer>\n</div>";
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
