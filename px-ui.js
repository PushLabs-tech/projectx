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

export const CORE_NAV = ['overview', 'assistant', 'build', 'design', 'files', 'preview', 'tasks', 'artifacts', 'brain', 'impact', 'settings'];

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

export function chrome({esc, session, recents, active, body, project, nav, right, status, email, execNote}) {
  const tools = project ? navForProject(project) : APP_TOOLS;
  const left = tools.map(([id, name]) => {
    const on = (nav || active) === id;
    if (project) return `<button class="px-tool ${on ? 'active' : ''}" data-project-tool="${esc(id)}" data-search="${esc(name)}">${esc(name)}</button>`;
    return `<button class="${id === active ? 'active' : ''}" data-nav="${esc(id)}" data-search="${esc(name)}">${esc(name)}</button>`;
  }).join('');
  const recent = recents.map(p => `<button data-open="${esc(p.id)}">${esc(p.title)}</button>`).join('') || '<div class="sub" style="padding:6px 10px">No projects yet</div>';
  const title = project ? esc(project.title) : 'ProjectX';
  const sync = project?.sync?.mode === 'cloud' ? 'Synced' : session ? 'Account' : 'Local';
  const rightPane = right != null ? right : `<div class="label">Assistant</div><div class="sub" style="padding:12px">Open Assistant to work on the current project, file, or selection.</div>`;
  const extra = project ? `<button class="ghost px-add-tool" data-cmd="add-tool">Add tool</button>` : '';
  const queueNote = execNote || 'No isolated cloud workers are connected. Independent tasks can be queued; execution is sequential through the Assistant.';
  return `<div class="px-shell ${project ? '' : 'no-right'}" id="px-shell">
    <aside class="px-left side" id="px-left">
      <button class="logo" data-nav="home" title="Home">ProjectX</button>
      <button class="ghost px-switcher" id="px-project-switch" type="button">${project ? esc(project.title) : 'Projects'} ▾</button>
      <div class="px-switch-list" id="px-switch-list" hidden>${recent}</div>
      <button class="new" data-nav="home">New project</button>
      <input class="input px-side-search" id="px-side-search" placeholder="Search tools and files" aria-label="Search project">
      <nav class="nav" id="px-tool-nav">${left}${extra}</nav>
      <div class="divider"></div>
      <div class="label">Recent</div>
      <div class="recent">${recent}</div>
      <div class="acct">${email ? `Signed in as ${esc(email)}` : 'Guest workspace'}<div class="sub">${session ? 'Cloud vault available' : 'Local session'}</div></div>
    </aside>
    <header class="px-topbar top">
      <button class="ghost px-nav-toggle" id="px-nav-toggle" aria-label="Open navigation">Menu</button>
      <strong style="min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${title}</strong>
      <span class="sub">${esc(project?.type || '')}</span>
      <span class="px-dot ${session ? '' : 'warn'}" title="${esc(sync)}"></span>
      <span class="sub">${esc(sync)}</span>
      <span style="flex:1"></span>
      <button class="ghost" data-cmd="palette" title="Command palette">⌘K</button>
      ${project ? '<button class="ghost" data-cmd="toggle-assistant" title="Hide assistant">Agent</button><button class="ghost" data-cmd="share">Share</button><button class="ghost" data-project-tool="preview">Preview</button><button class="ghost" data-project-tool="deploy">Deploy</button>' : ''}
      ${session ? '<button data-action="signout">Sign out</button>' : '<button data-action="signin">Sign in</button>'}
    </header>
    <main class="px-center main">${body}</main>
    ${project ? '<div class="px-split" id="px-split-right" data-split="right" title="Resize assistant"></div>' : ''}
    <aside class="px-right" id="px-assistant-dock">${rightPane}</aside>
    <div class="px-bottom" id="px-bottom" hidden>
      <div class="label">Queue</div>
      <div class="sub" style="padding:8px 12px">${esc(queueNote)}</div>
      <div id="px-bottom-log" class="conversation"></div>
    </div>
    <footer class="px-statusbar" id="px-statusbar"><button class="ghost" data-cmd="toggle-bottom" type="button">Output</button><span>${status || 'Ready'} · ${session ? 'Signed in' : 'Guest'} · ${esc((project && project.status) || 'idle')}</span><span style="flex:1"></span><span class="sub">⌘K command · ⌘S save · ⌘B nav · ⌘J output</span></footer>
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
      <div class="label">Share</div>
      <p class="sub">Copy the workspace URL. This does not publish hosting or create OAuth invites.</p>
      <input class="input full" id="px-share-url" readonly>
      <div class="actions"><button class="ghost" data-cmd="share-close">Close</button><button class="primary" data-cmd="share-copy">Copy link</button></div>
    </div>
  </div>`;
}

export function launcherMarkup({esc, session, projects, guestReady}) {
  const cards = projects.slice(0, 8).map(p => `<button class="box" data-open="${esc(p.id)}" style="text-align:left;cursor:pointer"><b>${esc(p.title)}</b><div class="sub">${esc(p.type)} · ${esc(p.status)}</div><div class="sub">${esc(String(p.intent || p.spec?.goal || '').slice(0,140))}</div></button>`).join('') || '<div class="px-empty">No projects yet. Describe an outcome to create one.</div>';
  const recentFiles = projects.flatMap(p => Object.keys(p.files || {}).slice(0, 2).map(f => `${p.title} · ${f}`)).slice(0, 4);
  return `<div class="panel">
    <div class="kicker">WORKSPACE</div>
    <h1 class="hero-title" style="font-size:36px">Continue the work.</h1>
    <p class="sub">Describe a new outcome, or open a project that already has a brain.</p>
    <div class="composer">
      <textarea id="start-input" placeholder="Example: Build a landing page for my sneaker-cleaning business…"></textarea>
      <div class="composer-foot">
        <span class="sub">${session ? 'Signed in · AI connection available' : guestReady ? 'Free Gemini key ready' : 'AI connection needed to begin'}</span>
        <button class="send" id="start-send" aria-label="Start project">→</button>
      </div>
    </div>
    <div class="label">Templates</div>
    <div class="grid" id="home-templates">${TEMPLATES.map(t=>`<button class="box" data-template="${t.id}" style="text-align:left;cursor:pointer"><b>${esc(t.title)}</b><div class="sub">${esc(t.intent)}</div></button>`).join('')}</div>
    <div class="label">Projects</div>
    <div class="grid" id="home-projects">${cards}</div>
    <div class="grid" style="margin-top:12px">
      <div class="box"><b>Recent artifacts</b><div class="sub">${projects.filter(p=>p.artifacts?.output).length ? projects.filter(p=>p.artifacts?.output).slice(0,3).map(p=>esc(p.title)).join(' · ') : 'None yet — build from a project.'}</div></div>
      <div class="box"><b>Agent activity</b><div class="sub">${projects.reduce((n,p)=>n+(p.executionState?.tasks||[]).length,0)} tasks across projects</div></div>
      <div class="box"><b>Files</b><div class="sub">${recentFiles.length ? esc(recentFiles.join(' · ')) : 'No generated files yet.'}</div></div>
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
  const category = project.category || project.understanding?.category || project.type || 'PROJECT';
  const summary = String(project.understanding?.summary || project.intent || '').trim();
  return `<div class="project px-work">
    <div class="px-work-head">
      <div class="kicker">PROJECT · ${esc(category)}</div>
      <h1 class="project-title">${esc(project.title)}</h1>
      <div class="project-context"><span>${esc(summary || 'Working from the current project brain.')}</span></div>
    </div>
    <div class="sections">${project.sections.map(s => `<button class="tab ${project.selectedSection === s.id ? 'active' : ''}" data-section="${esc(s.id)}">${esc(s.name)}</button>`).join('')}</div>
    <div id="project-body" class="body"></div>
  </div>`;
}

export function assistantDock({esc, project, actions}) {
  const status = project?.pendingMutation ? 'Awaiting approval' : (project?.status || 'Ready');
  return `<div class="px-assist-head">
    <div class="label">Assistant</div>
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
