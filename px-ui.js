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
  return `<div class="px-site px-landing">
    <header class="px-public-nav">
      <a href="./" class="logo px-mark"><span class="px-mark-badge">X</span> ProjectX</a>
      <nav class="px-cta">
        <button class="ghost" id="public-signin">Log in</button>
        <button class="ghost" id="public-signup" aria-label="Open menu">Sign up</button>
      </nav>
    </header>
    <main class="px-landing-main">
      <h1>What should we make?</h1>
      <p class="lead">Describe an outcome. ProjectX keeps a project brain while it works.</p>
      <div class="px-composer-lg">
        <textarea id="start-input" placeholder="Describe the outcome you want…"></textarea>
        <div class="px-composer-lg-foot">
          <span class="sub">+</span>
          <button class="send" id="start-send" aria-label="Start">→</button>
        </div>
      </div>
      <div class="px-type-row" id="home-templates">${TEMPLATES.map(t=>`<button type="button" data-template="${t.id}"><span class="px-type-icon">${t.title.charAt(0)}</span>${t.title}</button>`).join('')}</div>
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

export function chrome({esc, session, recents, active, body, project, nav, right, status, email, execNote}) {
  const tools = project ? navForProject(project) : [['home', 'Home'], ['projects', 'Projects'], ['settings', 'Settings']];
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
  const who = email ? esc(String(email).split('@')[0]) : 'Guest';
  return `<div class="px-shell ${project ? '' : 'no-right px-dash-shell'}" id="px-shell">
    <aside class="px-left side" id="px-left">
      <button class="logo px-mark" data-nav="home" title="Home"><span class="px-mark-badge">X</span></button>
      <button class="ghost px-switcher" id="px-project-switch" type="button">${project ? esc(project.title) : 'My workspace'} ▾</button>
      <div class="px-switch-list" id="px-switch-list" hidden>${recent}</div>
      <button class="new" data-nav="home" id="px-create">+ New</button>
      ${project ? `<input class="input px-side-search" id="px-side-search" placeholder="Search" aria-label="Search project"><nav class="nav" id="px-tool-nav">${left}${extra}</nav>` : `<nav class="nav" id="px-tool-nav">${left}</nav>`}
      <div class="divider"></div>
      <div class="label">Recent</div>
      <div class="recent px-repl-list">${recent}</div>
      <div class="acct"><span class="px-avatar">${initial}</span><div><div>${who}</div><div class="sub">${session ? 'Signed in' : 'Guest'}</div></div></div>
    </aside>
    <header class="px-topbar top">
      <button class="ghost px-nav-toggle" id="px-nav-toggle" aria-label="Open navigation">Menu</button>
      <strong class="px-top-title">${title}</strong>
      ${project ? `<span class="px-pill">${esc(project.type || 'project')}</span>` : ''}
      <span style="flex:1"></span>
      ${project ? '<button class="ghost" data-project-tool="preview">Preview</button><button class="ghost" data-cmd="toggle-assistant">Agent</button>' : ''}
      ${session ? '<button class="ghost" data-action="signout">Log out</button>' : '<button class="ghost" data-action="signin">Log in</button>'}
    </header>
    <main class="px-center main">${body}</main>
    ${project ? '<div class="px-split" id="px-split-right" data-split="right" title="Resize assistant"></div>' : ''}
    <aside class="px-right" id="px-assistant-dock">${rightPane}</aside>
    <div class="px-bottom" id="px-bottom" hidden>
      <div class="label">Console</div>
      <div class="sub" style="padding:8px 12px">${esc(queueNote)}</div>
      <div id="px-bottom-log" class="conversation"></div>
    </div>
    <footer class="px-statusbar" id="px-statusbar"><button class="ghost" data-cmd="toggle-bottom" type="button">Console</button><span>${status || 'Ready'}</span></footer>
  </div>
  <div class="px-palette" id="px-palette" hidden>
    <div class="px-palette-box">
      <input id="px-palette-input" placeholder="Search commands, projects, files…" aria-label="Command palette">
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

export function launcherMarkup({esc, session, projects, guestReady, name}) {
  const who = String(name || (session ? 'there' : 'there')).replace(/[<>]/g, '');
  const suggestions = [
    ['Build a polished landing page for a local service business.', 'Build a landing page'],
    ['Build a polished expense tracker web app.', 'Start a simple web app'],
    ['Create a pitch deck for a student startup.', 'Draft a pitch'],
    ['Help me launch a sneaker cleaning business.', 'Plan a small business']
  ];
  return `<div class="px-home-stage">
    <h1>${esc(who)}, what's next?</h1>
    <div class="px-suggest">${suggestions.map(([intent,label])=>`<button type="button" class="chip" data-example="${esc(intent)}">${esc(label)}</button>`).join('')}</div>
    <div class="px-home-dock">
      <div class="px-composer-lg">
        <textarea id="start-input" placeholder="Start chatting or describe a task…"></textarea>
        <div class="px-composer-lg-foot">
          <span class="sub">${session ? 'Signed in' : guestReady ? 'Guest key ready' : 'Connect AI in Settings when you need the Agent'}</span>
          <button class="send" id="start-send" aria-label="Start">→</button>
        </div>
      </div>
    </div>
    <div class="px-home-recent" id="home-projects">${projects.slice(0,6).map(p=>`<button class="px-mini-project" data-open="${esc(p.id)}">${esc(p.title)}</button>`).join('')}</div>
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
