export const APP_TOOLS = [
  ['home', 'Home'],
  ['projects', 'Projects'],
  ['assistant', 'Assistant'],
  ['analytics', 'Activity'],
  ['settings', 'Settings']
];

export const PROJECT_NAV = [
  ['overview', 'Overview'],
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

export const CORE_NAV = ['overview', 'assistant', 'build', 'design', 'files', 'preview', 'tasks', 'artifacts', 'brain', 'settings'];

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
  ['palette-brain', 'Open Brain', 'brain'],
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
  return `<div class="px-site">
    <header class="px-public-nav">
      <a href="./" class="logo px-mark"><span class="px-mark-badge">X</span> ProjectX</a>
      <nav class="px-cta">
        <a class="ghost" href="#px-how">How it works</a>
        <a class="ghost" href="#px-examples">Examples</a>
        <button class="ghost" id="public-signin">Log in</button>
        <button class="primary" id="public-signup">Sign up</button>
      </nav>
    </header>
    <section class="px-hero">
      <div>
        <div class="kicker">PROJECTX</div>
        <h1>An AI workspace that keeps the project, not just the chat.</h1>
        <p class="lead">Describe an outcome. ProjectX builds a durable brain, files, preview, and tasks you can inspect — then you approve what lands.</p>
        <div class="px-cta">
          <button class="primary" id="public-signup-hero">Create a free account</button>
          <button class="ghost" id="public-workspace">Open workspace</button>
        </div>
        <p class="sub">Email sign-in via Supabase. Google login is not connected. Isolated cloud VMs are not claimed.</p>
      </div>
      <div class="px-product-shot" aria-hidden="true">
        <div class="px-shot-col">Files<br><span class="sub">index.html</span><br><span class="sub">app.js</span><br><span class="sub">styles.css</span></div>
        <div class="px-shot-col px-shot-main"><b>Preview</b><div class="sub">Sandboxed iframe</div><div class="px-shot-status">Agent · Working on homepage</div></div>
        <div class="px-shot-col">Agent<br><span class="sub">Plan</span><br><span class="sub">Build</span><br><span class="sub">Awaiting approval</span></div>
      </div>
    </section>
    <section class="px-how" id="px-how">
      <div class="kicker">HOW IT WORKS</div>
      <ol>
        <li><b>Describe</b> the outcome in your own words.</li>
        <li><b>Discover</b> one decision at a time (4 options + your own words).</li>
        <li><b>Work</b> in files, preview, and tasks while the brain stays canonical.</li>
        <li><b>Approve</b> before anything replaces the main project.</li>
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
      <details open><summary>Is this Replit?</summary><p>No. ProjectX is a separate product. It is an AI workspace with a project brain, files, and a sandboxed preview. It does not copy Replit’s product, branding, or hosting.</p></details>
      <details><summary>How do I log in?</summary><p>Use email and password on the Log in screen. Accounts are stored in your Supabase project. Social OAuth is not enabled.</p></details>
      <details><summary>Do I need an AI key?</summary><p>You can browse the workspace without one. Discovery and Agent need a connected provider, a guest Gemini key in this browser, or a signed-in vault. One key is enough for testing.</p></details>
      <details><summary>Does ProjectX run a cloud VM?</summary><p>No. Previews run in a sandboxed iframe in your browser. Export is available until a host is connected.</p></details>
    </section>
    <footer class="px-footer">
      <a href="./privacy.html">Privacy</a>
      <a href="./terms.html">Terms</a>
      <a href="./billing.html">Plans</a>
      <span>ProjectX · keep the context</span>
    </footer>
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

export function chrome({esc, session, recents, active, body, project, nav, right, status, email, execNote}) {
  const tools = project ? navForProject(project) : APP_TOOLS;
  const left = tools.map(([id, name]) => {
    const on = (nav || active) === id;
    if (project) return `<button class="px-tool ${on ? 'active' : ''}" data-project-tool="${esc(id)}" data-search="${esc(name)}">${esc(name)}</button>`;
    return `<button class="${id === active ? 'active' : ''}" data-nav="${esc(id)}" data-search="${esc(name)}">${esc(name)}</button>`;
  }).join('');
  const recent = recents.map(p => `<button data-open="${esc(p.id)}"><span class="px-repl-dot"></span>${esc(p.title)}</button>`).join('') || '<div class="sub" style="padding:6px 10px">No projects yet</div>';
  const title = project ? esc(project.title) : 'ProjectX';
  const sync = project?.sync?.mode === 'cloud' ? 'Synced' : session ? 'Account' : 'Local';
  const rightPane = right != null ? right : `<div class="label">Agent</div><div class="sub" style="padding:12px">Open a project to work with the Agent.</div>`;
  const extra = project ? `<button class="ghost px-add-tool" data-cmd="add-tool">Add tool</button>` : '';
  const queueNote = execNote || 'No isolated cloud workers are connected. Independent tasks can be queued; execution is sequential through the Assistant.';
  const initial = esc(String(email || 'G').trim().charAt(0).toUpperCase() || 'G');
  return `<div class="px-shell ${project ? '' : 'no-right px-dash-shell'}" id="px-shell">
    <aside class="px-left side" id="px-left">
      <button class="logo px-mark" data-nav="home" title="Home"><span class="px-mark-badge">X</span> ProjectX</button>
      <button class="new" data-nav="home" id="px-create">+ Create</button>
      <button class="ghost px-switcher" id="px-project-switch" type="button">${project ? esc(project.title) : 'My projects'} ▾</button>
      <div class="px-switch-list" id="px-switch-list" hidden>${recent}</div>
      <input class="input px-side-search" id="px-side-search" placeholder="Search" aria-label="Search project">
      <nav class="nav" id="px-tool-nav">${left}${extra}</nav>
      <div class="divider"></div>
      <div class="label">Projects</div>
      <div class="recent px-repl-list">${recent}</div>
      <div class="acct"><span class="px-avatar">${initial}</span><div><div>${email ? esc(String(email).split('@')[0]) : 'Guest'}</div><div class="sub">${session ? 'Cloud' : 'Local'} · ${esc(sync)}</div></div></div>
    </aside>
    <header class="px-topbar top">
      <button class="ghost px-nav-toggle" id="px-nav-toggle" aria-label="Open navigation">Menu</button>
      <strong class="px-top-title">${title}</strong>
      ${project ? `<span class="px-pill">${esc(project.type || 'project')}</span>` : ''}
      <span class="px-dot ${session ? '' : 'warn'}" title="${esc(sync)}"></span>
      <span style="flex:1"></span>
      <button class="ghost" data-cmd="palette" title="Command palette">Search</button>
      ${project ? '<button class="ghost" data-project-tool="preview">Run</button><button class="ghost" data-cmd="toggle-assistant">Agent</button><button class="ghost" data-cmd="share">Invite</button><button class="primary" data-project-tool="deploy">Deploy</button>' : ''}
      ${session ? '<button class="ghost" data-action="signout">Sign out</button>' : '<button class="primary" data-action="signin">Sign in</button>'}
    </header>
    <main class="px-center main">${body}</main>
    ${project ? '<div class="px-split" id="px-split-right" data-split="right" title="Resize assistant"></div>' : ''}
    <aside class="px-right" id="px-assistant-dock">${rightPane}</aside>
    <div class="px-bottom" id="px-bottom" hidden>
      <div class="label">Console</div>
      <div class="sub" style="padding:8px 12px">${esc(queueNote)}</div>
      <div id="px-bottom-log" class="conversation"></div>
    </div>
    <footer class="px-statusbar" id="px-statusbar"><button class="ghost" data-cmd="toggle-bottom" type="button">Console</button><span>${status || 'Ready'} · ${session ? 'Signed in' : 'Guest'} · ${esc((project && project.status) || 'idle')}</span><span style="flex:1"></span><span class="sub">⌘K · ⌘S · ⌘B · ⌘J</span></footer>
  </div>
  <div class="px-palette" id="px-palette" hidden>
    <div class="px-palette-box">
      <input id="px-palette-input" placeholder="Search commands, projects, surfaces…" aria-label="Command palette">
      <div class="px-palette-list" id="px-palette-list"></div>
    </div>
  </div>
  <div class="px-ctx" id="px-ctx" hidden></div>
  <div class="px-share" id="px-share" hidden>
    <div class="px-share-box">
      <div class="label">Invite</div>
      <p class="sub">Copy the workspace URL. This does not publish hosting or create OAuth invites.</p>
      <input class="input full" id="px-share-url" readonly>
      <div class="actions"><button class="ghost" data-cmd="share-close">Close</button><button class="primary" data-cmd="share-copy">Copy link</button></div>
    </div>
  </div>`;
}

export function launcherMarkup({esc, session, projects, guestReady}) {
  const rows = projects.map(p => {
    const files = Object.keys(p.files || {}).length;
    const updated = String(p.updatedAt || p.createdAt || '').slice(0, 10);
    return `<button class="px-repl-row" data-open="${esc(p.id)}"><span class="px-repl-icon">${esc((p.title || 'P').charAt(0).toUpperCase())}</span><span class="px-repl-meta"><b>${esc(p.title)}</b><span class="sub">${esc(p.type)} · ${files} files · ${esc(p.status || 'idle')}</span></span><span class="sub px-repl-when">${esc(updated)}</span></button>`;
  }).join('') || '<div class="px-empty">No projects yet. Create one above.</div>';
  return `<div class="px-dash">
    <div class="px-dash-create">
      <div class="px-dash-create-head">
        <b>Create a project</b>
        <span class="sub">${session ? 'AI connected' : guestReady ? 'Guest Gemini ready' : 'Connect AI in Settings to run Agent'}</span>
      </div>
      <div class="px-create-box">
        <textarea id="start-input" placeholder="Describe what you want built…"></textarea>
        <button class="primary" id="start-send">Create</button>
      </div>
      <div class="px-template-row" id="home-templates">${TEMPLATES.map(t=>`<button type="button" class="chip" data-template="${t.id}">${esc(t.title)}</button>`).join('')}</div>
    </div>
    <div class="px-dash-list">
      <div class="px-dash-list-head"><b>My projects</b><span class="sub">${projects.length}</span></div>
      <div id="home-projects">${rows}</div>
    </div>
  </div>`;
}

export function interviewMarkup() {
  return `<div class="interview poll-interview">
    <div class="kicker">DISCOVERY</div>
    <div id="px-agent-status" class="sub">Thinking</div>
    <div id="interview-understanding" class="understanding"></div>
    <div id="interview-poll" class="discovery-poll" aria-live="polite"></div>
    <div id="interview-status" class="poll-status" aria-live="polite"></div>
  </div>`;
}

export function projectHead({esc, project}) {
  return `<div class="project px-work">
    <div class="px-work-tabs sections">${project.sections.map(s => `<button class="tab ${project.selectedSection === s.id ? 'active' : ''}" data-section="${esc(s.id)}">${esc(s.name)}</button>`).join('')}</div>
    <div id="project-body" class="body"></div>
  </div>`;
}

export function assistantDock({esc, project, actions}) {
  const status = project?.pendingMutation ? 'Awaiting approval' : (project?.status || 'Ready');
  return `<div class="px-assist-head">
    <div class="label">Agent</div>
    <div class="sub" id="px-agent-status">${esc(status)} · ${esc(settingsSafe(project))}</div>
  </div>
  <div id="assistant-dock-log" class="conversation" role="log" aria-live="polite"></div>
  <div class="px-assist-actions">${(actions || CONTEXT_ACTIONS.default).map(a => `<button type="button" class="chip" data-assist-action="${esc(a)}">${esc(a)}</button>`).join('')}</div>
  <form id="assistant-dock-form" class="form">
    <textarea id="assistant-dock-input" placeholder="Ask about this project…"></textarea>
    <button class="primary" id="assistant-dock-send" type="submit">Send</button>
  </form>
  <form id="plan-dock-form" class="form" style="margin:0 8px 8px">
    <textarea id="plan-dock-input" placeholder="Queue another task while work continues…"></textarea>
    <button class="ghost" id="plan-dock-send" type="submit">Queue</button>
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
