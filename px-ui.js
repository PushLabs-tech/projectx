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
      <a class="pxl-brand" href="./" aria-label="ProjectX home"><span class="pxl-brand-mark">P<span>×</span></span><span>ProjectX</span></a>
      <nav class="pxl-links" aria-label="Main navigation">
        <a href="#pxl-capabilities">Platform</a><a href="#pxl-workflow">How it works</a><a href="#px-examples">Explore ideas</a>
      </nav>
      <div class="pxl-nav-actions"><button class="pxl-signin" id="public-signin" type="button">Sign in</button><button class="pxl-button pxl-button-dark pxl-button-small" id="public-workspace" type="button">Start building <span aria-hidden="true">↗</span></button></div>
    </header>

    <main>
      <section class="pxl-hero">
        <div class="pxl-hero-copy">
          <div class="pxl-eyebrow"><span class="pxl-live-dot"></span> YOUR IDEA, IN MOTION</div>
          <h1>Make the thing<br>you <em>have in mind.</em></h1>
          <p class="pxl-lead">From a rough idea to a real outcome. ProjectX helps you understand the goal, plan the work, build what you need, and keep every next step connected.</p>
          <div class="pxl-hero-actions"><button class="pxl-button pxl-button-dark" id="public-start" type="button">Start with your idea <span aria-hidden="true">↗</span></button><button class="pxl-text-link" id="public-examples" type="button">See what you can make <span aria-hidden="true">↓</span></button></div>
          <div class="pxl-proof"><span class="pxl-proof-mark">P×</span><p><strong>Not just another AI chat.</strong><br>A workspace for moving real work forward.</p></div>
        </div>

        <div class="pxl-composer-wrap">
          <div class="pxl-composer">
            <div class="pxl-composer-top"><span class="pxl-composer-kicker">NEW PROJECT</span><span class="pxl-composer-status"><i></i> READY WHEN YOU ARE</span></div>
            <label class="pxl-prompt-label" for="public-prompt">What are you trying to make happen?</label>
            <textarea id="public-prompt" rows="3" placeholder="Build a website for my sneaker-cleaning business…"></textarea>
            <div class="pxl-chip-row" aria-label="Example starting points">
              <button type="button" data-example="Build a polished landing page for a local service business.">Website <span>↗</span></button>
              <button type="button" data-example="Build a useful web app that solves a real problem.">Web app <span>↗</span></button>
              <button type="button" data-example="Help me launch a small business with a practical plan.">Business <span>↗</span></button>
              <button type="button" data-example="Research a topic and turn the findings into a clear decision brief.">Research <span>↗</span></button>
            </div>
            <div class="pxl-composer-foot"><span>Start with the outcome. Details can come later.</span><button class="pxl-send" id="public-start-arrow" type="button" aria-label="Start a project">↗</button></div>
          </div>
          <div class="pxl-composer-note"><span>01</span> Tell it what you want to accomplish <span class="pxl-note-line"></span> ProjectX helps with the next step</div>
        </div>
      </section>

      <section class="pxl-feature-band" id="pxl-capabilities">
        <div class="pxl-band-intro"><div class="pxl-section-label">ONE IDEA. MANY POSSIBILITIES.</div><h2>From “what if?”<br>to <em>what’s next.</em></h2><p>Software is one kind of outcome. ProjectX is designed to help organize the whole journey around the thing you want to achieve.</p></div>
        <div class="pxl-feature-grid">
          <article class="pxl-feature-card pxl-feature-chat"><div class="pxl-card-label">01 / THINK IT THROUGH</div><h3>Turn the fog<br>into a plan.</h3><p>Clarify what you mean, surface missing decisions, and turn a big goal into manageable work.</p><div class="pxl-plan-preview"><div><span>01</span><b>Define the outcome</b><i>Done</i></div><div><span>02</span><b>Map the work</b><i>Next</i></div><div><span>03</span><b>Check the result</b><i>Later</i></div></div></article>
          <article class="pxl-feature-card pxl-feature-build"><div class="pxl-card-label">02 / MAKE IT REAL</div><h3>Build beyond<br>the conversation.</h3><p>Keep project context, tasks, files, and deliverables together as the work takes shape.</p><div class="pxl-build-preview"><div class="pxl-build-top"><span>PROJECT / WEBSITE</span><span>● ● ●</span></div><div class="pxl-build-hero"><small>YOUR NEXT BIG THING</small><b>A first version,<br>ready to refine.</b><span></span></div><div class="pxl-build-bottom"><i></i><i></i><i></i><i></i></div></div></article>
          <article class="pxl-feature-card pxl-feature-control"><div class="pxl-card-label">03 / KEEP CONTROL</div><h3>Progress you<br>can actually see.</h3><p>Track what is clear, what is in progress, and what still needs a decision or a test.</p><div class="pxl-progress-preview"><div class="pxl-progress-head"><span>PROJECT HEALTH</span><b>IN PROGRESS</b></div><div class="pxl-progress-bar"><span></span></div><div class="pxl-progress-stats"><span><b>03</b> steps mapped</span><span><b>01</b> next action</span></div></div></article>
        </div>
      </section>

      <section class="pxl-workflow" id="pxl-workflow">
        <div class="pxl-section-label">A BETTER WAY TO GET FROM A TO B</div>
        <div class="pxl-workflow-head"><h2>Less scattered effort.<br><em>More forward motion.</em></h2><p>Your decisions and progress should not vanish into a long chat. ProjectX keeps the work organized around the outcome.</p></div>
        <div class="pxl-steps">
          <article><span>01</span><h3>Understand</h3><p>Describe the outcome, constraints, and what success should look like.</p></article>
          <article><span>02</span><h3>Organize</h3><p>Turn ambiguity into a plan, clear tasks, and useful deliverables.</p></article>
          <article><span>03</span><h3>Create</h3><p>Build and refine the work while keeping the context connected.</p></article>
          <article><span>04</span><h3>Verify</h3><p>Inspect what is done, find gaps, and choose the next best action.</p></article>
        </div>
      </section>

      <section class="pxl-examples">
        <div class="pxl-examples-head"><div><div class="pxl-section-label">START ANYWHERE</div><h2>Different goals.<br><em>One place to move them forward.</em></h2></div><p>Pick an example to start with. Make it yours as you go.</p></div>
        <div class="pxl-example-grid" id="px-examples" aria-label="Project examples">
          <button class="pxl-example-card pxl-example-orange" data-example="Build a polished landing page for my new product, with responsive design and a clear call to action." type="button"><span class="pxl-example-index">01 / WEB</span><strong>Launch a website</strong><span>Shape the story, design the experience, and prepare it to publish.</span><b class="pxl-example-art pxl-art-window">↗<i></i><i></i><i></i></b></button>
          <button class="pxl-example-card pxl-example-cream" data-example="Help me launch a sneaker-cleaning business, from pricing and marketing to a practical launch checklist." type="button"><span class="pxl-example-index">02 / BUSINESS</span><strong>Start a business</strong><span>Work through the offer, costs, launch plan, and first customers.</span><b class="pxl-example-art pxl-art-orbit">P<span>×</span></b></button>
          <button class="pxl-example-card pxl-example-green" data-example="Research a topic, compare credible evidence, and produce a concise brief with recommendations." type="button"><span class="pxl-example-index">03 / RESEARCH</span><strong>Make a hard decision</strong><span>Bring evidence together and turn it into a clear next move.</span><b class="pxl-example-art pxl-art-bars"><i></i><i></i><i></i><i></i><i></i></b></button>
          <button class="pxl-example-card pxl-example-lilac" data-example="Plan a small software product from the user problem through features, interface, testing, and release." type="button"><span class="pxl-example-index">04 / PRODUCT</span><strong>Create a product</strong><span>Connect user needs, design, build tasks, and verification.</span><b class="pxl-example-art pxl-art-squares"><i></i><i></i><i></i><i></i></b></button>
          <button class="pxl-example-card pxl-example-dark" data-example="Create a pitch deck for a student startup, with a clear problem, solution, market, and roadmap." type="button"><span class="pxl-example-index">05 / STORY</span><strong>Pitch an idea</strong><span>Turn a promising thought into a story people can understand.</span><b class="pxl-example-art pxl-art-type">MAKE<br>IT<br>MATTER.</b></button>
          <button class="pxl-example-card pxl-example-blue" data-example="Plan a personal learning project with milestones, resources, practice tasks, and measurable outcomes." type="button"><span class="pxl-example-index">06 / LEARNING</span><strong>Learn by making</strong><span>Set milestones and turn curiosity into a tangible result.</span><b class="pxl-example-art pxl-art-target"><i></i><i></i><i></i></b></button>
        </div>
      </section>

      <section class="pxl-bottom-cta"><div><div class="pxl-section-label">YOUR NEXT STEP STARTS HERE</div><h2>Bring the idea.<br>Build the <em>momentum.</em></h2></div><div><p>You do not need the perfect prompt. Start with the outcome you want, and refine the details as you go.</p><button class="pxl-button pxl-button-light" id="public-signup" type="button">Create your workspace <span aria-hidden="true">↗</span></button></div></section>
    </main>

    <footer class="pxl-footer"><a class="pxl-brand" href="./"><span class="pxl-brand-mark">P<span>×</span></span><span>ProjectX</span></a><span>Turn intention into action.</span><div><a href="./privacy.html">Privacy</a><a href="./terms.html">Terms</a><a href="./billing.html">Plans</a><a href="#login" id="public-footer-signin">Sign in</a></div></footer>
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
          <strong>${title}</strong>
          <span class="px-project-status"><span class="px-live-dot"></span>${status ? esc(status) : 'Ready'}</span>
        </div>
        <div class="px-center-actions">
          <button class="ghost ${(nav||active)==='build'?'active':''}" data-project-tool="build">Build</button>
          <button class="ghost ${(nav||active)==='preview'?'active':''}" data-project-tool="preview">Preview</button>
          <button class="ghost ${(nav||active)==='files'?'active':''}" data-project-tool="files">Code</button>
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
  const hasFiles=Object.keys(project.files||{}).length>0;
  const summary=String(project.understanding?.summary||project.intent||'').trim();
  return `<div class="px-replit-project">
    <div class="px-workspace-title">
      <div class="px-workspace-title-main">
        <span class="px-workspace-kicker">PROJECT</span>
        <strong>${esc(project.title)}</strong>
        <span class="px-workspace-desc">${esc(summary||'Build, preview, and refine your project.')}</span>
      </div>
      <div class="px-workspace-actions">
        <button class="ghost" data-project-tool="build">Build</button>
        <button class="ghost" data-project-tool="preview">Preview</button>
        <button class="ghost" data-project-tool="files">Code</button>
      </div>
    </div>
    <div class="px-stage" id="px-project-stage">
      <div class="px-stage-bar">
        <div class="px-stage-left">
          <span class="px-stage-title">${hasFiles ? 'Live app' : 'Build workspace'}</span>
          <span class="px-stage-sub">${hasFiles ? 'Interact with the current artifact' : 'Ask Agent to start building'}</span>
        </div>
        <div class="px-stage-tools">
          <button class="ghost" data-project-tool="preview">Open preview</button>
        </div>
      </div>
      <div id="project-body" class="body px-project-body"></div>
    </div>
  </div>`;
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
