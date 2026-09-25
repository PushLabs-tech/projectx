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

export const CORE_NAV = ['overview', 'build', 'preview', 'files', 'settings'];
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
  return `<div class="px-public-nav">
    <a href="./" class="logo">ProjectX</a>
    <div class="px-cta">
      <a class="ghost" href="#px-examples">Examples</a>
      <button class="ghost" id="public-workspace">Open workspace</button>
      <button class="ghost" id="public-signin">Sign in</button>
      <button class="primary" id="public-signup">Create account</button>
    </div>
  </div>
  <section class="px-hero">
    <div>
      <div class="kicker">UNIVERSAL AI WORKSPACE</div>
      <h1>Tell ProjectX what you want to accomplish.</h1>
      <p class="lead">ProjectX understands the outcome, organizes the work, builds the artifact, and keeps a durable project brain so you can inspect, approve, test, and ship — without starting over every prompt.</p>
      <div class="px-cta">
        <button class="primary" id="public-start">Start a project</button>
        <button class="ghost" id="public-examples">See examples</button>
      </div>
    </div>
    <div class="px-product-shot" aria-hidden="true">
      <div class="px-shot-col">ProjectX<br><span class="sub">Overview</span><br><span class="sub">Assistant</span><br><span class="sub">Design</span><br><span class="sub">Files</span><br><span class="sub">Preview</span><br><span class="sub">Tasks</span><br><span class="sub">Brain</span></div>
      <div class="px-shot-col px-shot-main"><b>Work surface</b><div class="sub">Live preview · canvas · files</div><div class="px-shot-status">Task · Homepage · Ready for review</div><div class="sub">Nothing lands on the main project until you approve it.</div></div>
      <div class="px-shot-col">Assistant<br><span class="sub">Thinking</span><br><span class="sub">Working</span><br><span class="sub">Awaiting approval</span><br><span class="sub">Approve · Reject</span></div>
    </div>
  </section>
  <section class="px-how">
    <div class="kicker">HOW WORK MOVES</div>
    <ol>
      <li><b>Describe</b> the outcome in your own words.</li>
      <li><b>Understand</b> it as a project brain — requirements, constraints, decisions.</li>
      <li><b>Work</b> as visible tasks while you keep planning.</li>
      <li><b>Review</b> files, designs, and tests before they become the main state.</li>
    </ol>
  </section>
  <div class="px-examples" id="px-examples">
    <button data-example="Build a polished expense tracker web app."><b>Software</b><span class="sub">Expense tracker web app</span></button>
    <button data-example="Build a mobile horror game with progression, enemies, and a shop."><b>Game</b><span class="sub">Mobile horror game</span></button>
    <button data-example="Help me launch a sneaker cleaning business."><b>Business</b><span class="sub">Sneaker cleaning launch</span></button>
    <button data-example="Create a research report comparing battery technologies for a solar prototype."><b>Research</b><span class="sub">Battery technology brief</span></button>
    <button data-example="Create a pitch deck for a student startup."><b>Creative</b><span class="sub">Student startup pitch</span></button>
    <button data-example="Research a market, design a landing page, build it, and prepare a pitch."><b>Hybrid</b><span class="sub">Market, page, and pitch</span></button>
  </div>
  <section class="px-faq" id="px-faq">
    <div class="kicker">FAQ</div>
    <details open><summary>What happens after I describe an outcome?</summary><p>ProjectX opens discovery: one contextual decision at a time, four AI options plus “Describe in your own words.” A project brain is written only after valid discovery.</p></details>
    <details><summary>Do I need an AI key?</summary><p>No, to open the workspace. Discovery and Agent work need a connected provider, a guest Gemini key in this browser, or a signed-in vault. Without AI you can still create a local draft project and inspect files.</p></details>
    <details><summary>Does ProjectX run my app on a cloud VM?</summary><p>Browser-safe previews run in a sandboxed iframe. Connected GitHub repositories can also run an exact snapshot in an ephemeral isolated build runner. Export remains available until a host is connected.</p></details>
  </section>
  <section class="px-how">
    <div class="kicker">FREE STACK</div>
    <p class="lead" style="max-width:62ch">ProjectX is built to run on GitHub Pages, Supabase, Edge Functions, and bring-your-own keys. Demo AI, when configured server-side, is rate-limited and never exposed in the browser.</p>
  </section>
  <footer class="px-footer">
    <a href="./privacy.html">Privacy</a>
    <a href="./terms.html">Terms</a>
    <a href="./billing.html">Plans</a>
    <span>Describe an outcome. ProjectX keeps the context.</span>
  </footer>`;
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
    const visible = tools.filter(([id])=>['build','preview','files','settings'].includes(id));
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
  return `<div class="px-shell" id="px-shell">
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
      <div class="px-home-eyebrow">PROJECTX AGENT</div>
      <h1>What are you building?</h1>
      <p>Describe an idea, product, site, game, or anything you want to bring to life.</p>
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
          <button class="send px-home-send" id="start-send" aria-label="Start project">↑</button>
        </div>
      </div>
      <div class="px-home-hint"><span>${session ? 'Cloud workspace connected' : guestReady ? 'Guest AI ready' : 'Connect AI when you need it'}</span><span>⌘ Enter to start</span></div>
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
