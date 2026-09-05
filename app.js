(() => {
"use strict";

/* ============================== config / backend ============================== */
const CFG = window.BUILDER_CONFIG || {};
const CONFIGURED = !!(CFG.SUPABASE_URL && !/YOUR_PROJECT/.test(CFG.SUPABASE_URL) && CFG.SUPABASE_PUBLISHABLE_KEY && !/YOUR_/.test(CFG.SUPABASE_PUBLISHABLE_KEY));
const sb = (CONFIGURED && window.supabase) ? window.supabase.createClient(CFG.SUPABASE_URL, CFG.SUPABASE_PUBLISHABLE_KEY) : null;

async function callAI(action, payload) {
  if (!CONFIGURED || !sb) {
    throw new Error("No backend connected yet. Add your Supabase project URL and key to config.js, deploy the ai function with a Gemini key, then this will give real answers. See SETUP-AI.md.");
  }
  const { data: { session: sess } } = await sb.auth.getSession();
  if (!sess) throw new Error("Your session expired — sign in again.");
  const res = await fetch(`${CFG.SUPABASE_URL}/functions/v1/ai`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Authorization": `Bearer ${sess.access_token}`, "apikey": CFG.SUPABASE_PUBLISHABLE_KEY },
    body: JSON.stringify({ action, ...payload }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data.ok === false) throw new Error(data.error || `Request failed (${res.status})`);
  return data;
}

/* ============================== helpers ============================== */
const uid = () => Math.random().toString(36).slice(2, 10);
const now = () => Date.now();
const timeAgo = (ts) => {
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 10) return "just now";
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60); if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60); if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
};
const esc = (v) => String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const safePath = (p) => !!p && typeof p === "string" && !p.startsWith("/") && !p.includes("..");
const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

const MODES = [
  { id: "discuss", label: "Discuss", icon: "&#128172;", hint: "Free — just talk" },
  { id: "plan", label: "Plan", icon: "&#128506;", hint: "Uses 1 integration credit" },
  { id: "build", label: "Build", icon: "&#128296;", hint: "Uses 1 build credit" },
  { id: "visual", label: "Visual edit", icon: "&#10024;", hint: "Uses 1 build credit" },
  { id: "research", label: "Research", icon: "&#127760;", hint: "Uses 1 integration credit" },
];
const AGENT_META = {
  discuss: { name: "Discuss agent", color: "#3654FF", desc: "Talks through ideas. Never touches files.", letter: "D" },
  plan: { name: "Plan agent", color: "#B7791F", desc: "Maps out phases and names real resources.", letter: "P" },
  build: { name: "Build agent", color: "#1F9D55", desc: "Writes real file changes to the project.", letter: "B" },
  visual: { name: "Visual agent", color: "#A24FE0", desc: "Adjusts layout, color and copy.", letter: "V" },
  research: { name: "Research agent", color: "#0E9AA7", desc: "Searches the live web for answers.", letter: "R" },
};
const THINKING_STEPS = {
  discuss: ["Reading the project", "Thinking it through"],
  plan: ["Reviewing the project", "Mapping phases", "Finding real resources"],
  build: ["Reading the files", "Writing the change", "Checking it's safe"],
  visual: ["Inspecting the design", "Adjusting styles"],
  research: ["Searching the web", "Reading sources", "Summarizing"],
};

function classify(text) {
  const x = text.toLowerCase(); const a = [];
  const add = (q) => { if (!a.includes(q)) a.push(q); };
  if (/\b(app|software|saas|platform|website|web app|mobile|dashboard)\b/.test(x)) add("Software");
  if (/\b(cafe|coffee|restaurant|shop|store|salon|clinic|business|brand)\b/.test(x)) add("Local business");
  if (/\b(product|hardware|device|desk|machine|physical)\b/.test(x)) add("Physical product");
  if (/\b(game|roblox|minecraft|unity)\b/.test(x)) add("Game");
  if (/\b(youtube|creator|content|instagram|podcast)\b/.test(x)) add("Creator");
  if (/\b(research|study|experiment|paper)\b/.test(x)) add("Research");
  if (/\b(automation|workflow|agent)\b/.test(x)) add("Automation");
  if (/\b(agency|freelance|service)\b/.test(x)) add("Service business");
  if (!a.length) add("Custom goal");
  return a;
}
function starterFiles(title) {
  return {
    "index.html": `<!doctype html>\n<html>\n<head>\n<meta charset="utf-8">\n<title>${title}</title>\n<link rel="stylesheet" href="styles.css">\n</head>\n<body>\n<main class="hero">\n  <h1>${title}</h1>\n  <p>This preview updates live as the Build agent makes changes.</p>\n  <button id="cta">Get started</button>\n</main>\n<script src="app.js"></script>\n</body>\n</html>`,
    "styles.css": `body{margin:0;font-family:system-ui,sans-serif;background:#0f1115;color:#f4f4f5}\n.hero{min-height:100vh;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;gap:14px;padding:32px}\n.hero h1{font-size:2.1rem;margin:0}\n.hero p{color:#a7abb4;max-width:360px;margin:0}\n#cta{background:#3654ff;color:#fff;border:none;padding:12px 22px;border-radius:8px;font-size:.95rem;cursor:pointer}`,
    "app.js": `document.getElementById('cta')?.addEventListener('click',()=>{alert('This is where the real action would happen.');});`,
  };
}
function renderPreviewDoc(files) {
  if (!files["index.html"]) return `<!doctype html><html><body style="font:14px system-ui;color:#888;display:flex;align-items:center;justify-content:center;height:100vh;margin:0">No index.html yet — ask Build to create one.</body></html>`;
  let html = files["index.html"]; const css = files["styles.css"] || ""; const js = files["app.js"] || "";
  html = html.includes('<link rel="stylesheet" href="styles.css">') ? html.replace('<link rel="stylesheet" href="styles.css">', `<style>${css}</style>`) : html.replace("</head>", `<style>${css}</style></head>`);
  html = html.includes('<script src="app.js"></script>') ? html.replace('<script src="app.js"></script>', `<script>${js}<\/script>`) : html.replace("</body>", `<script>${js}<\/script></body>`);
  return html;
}
function computeTests(files) {
  const hasHtml = !!files["index.html"], hasCss = !!files["styles.css"];
  const linksCss = hasHtml && /href=["']styles\.css["']/.test(files["index.html"]);
  const hasHeading = hasHtml && /<h1[\s>]/.test(files["index.html"]);
  let validJs = true; try { if (files["app.js"]) new Function(files["app.js"]); } catch { validJs = false; }
  return [["index.html exists", hasHtml ? "passed" : "failed"], ["styles.css is linked", linksCss ? "passed" : hasCss ? "warn" : "failed"], ["Page has a heading", hasHeading ? "passed" : "warn"], ["app.js has valid syntax", validJs ? "passed" : "failed"]];
}
function computeSecurity(files) {
  const combined = Object.values(files).join("\n");
  const hasSecret = /(sk-[a-zA-Z0-9]{10,}|AIza[0-9A-Za-z_-]{10,}|BEGIN (RSA |EC )?PRIVATE KEY|service_role)/i.test(combined);
  const usesEval = /\beval\(/.test(combined);
  return [["No embedded API keys or secrets", hasSecret ? "failed" : "passed"], ["No eval() usage", usesEval ? "warn" : "passed"], ["All files reviewed", "passed"]];
}

/* ============================== state ============================== */
const STORE_KEY = "builder_grand_finale_v4";
function seed() { return { route: "home", projectId: null, mode: "discuss", panel: "overview", mobilePreview: false, credits: { build: 50, integration: 200 }, activity: [], projects: [], demoSession: null }; }
function load() { try { return { ...seed(), ...JSON.parse(localStorage.getItem(STORE_KEY) || "{}") }; } catch { return seed(); } }
function save() { try { localStorage.setItem(STORE_KEY, JSON.stringify(state)); } catch {} }
let state = load();
let session = CONFIGURED ? null : state.demoSession; // {name,email}
let ui = { composerText: "", attachment: null, thinkingMode: null, thinkStep: 0, thinkTimer: null, sidebarOpen: false, authMode: "signin", authError: "", authFields: { name: "", email: "", password: "" } };

function patch(p) { state = { ...state, ...(typeof p === "function" ? p(state) : p) }; save(); render(); }
function updateProject(id, fn) { state = { ...state, projects: state.projects.map((p) => (p.id === id ? fn(p) : p)) }; save(); render(); }
function logActivity(line) { state.activity = [{ id: uid(), line, ts: now() }, ...state.activity].slice(0, 40); }
function project() { return state.projects.find((p) => p.id === state.projectId); }

function toast(text) {
  const el = document.createElement("div"); el.className = "toast"; el.textContent = text;
  $("#toast").appendChild(el); setTimeout(() => el.remove(), 2600);
}

/* ============================== auth ============================== */
async function initAuth() {
  if (CONFIGURED && sb) {
    const { data: { session: sess } } = await sb.auth.getSession();
    if (sess?.user) session = { name: sess.user.user_metadata?.name || sess.user.email.split("@")[0], email: sess.user.email };
    sb.auth.onAuthStateChange((_evt, sess2) => {
      session = sess2?.user ? { name: sess2.user.user_metadata?.name || sess2.user.email.split("@")[0], email: sess2.user.email } : null;
      render();
    });
  }
  render();
}

async function submitAuth() {
  const { name, email, password } = ui.authFields;
  if (!/^\S+@\S+\.\S+$/.test(email.trim())) { ui.authError = "Enter a valid email address."; return render(); }
  if (password.length < 6) { ui.authError = "Password needs at least 6 characters."; return render(); }
  if (ui.authMode === "signup" && !name.trim()) { ui.authError = "Tell us your name."; return render(); }
  ui.authError = "";

  if (!CONFIGURED) {
    session = { name: ui.authMode === "signup" ? name.trim() : email.split("@")[0], email: email.trim() };
    patch({ demoSession: session });
    toast(`Welcome, ${session.name}`);
    return;
  }
  try {
    if (ui.authMode === "signup") {
      const { data, error } = await sb.auth.signUp({ email: email.trim(), password, options: { data: { name: name.trim() } } });
      if (error) throw error;
      if (data.user && !data.session) { ui.authError = "Check your email to confirm your account, then sign in."; ui.authMode = "signin"; return render(); }
    } else {
      const { error } = await sb.auth.signInWithPassword({ email: email.trim(), password });
      if (error) throw error;
    }
  } catch (e) {
    ui.authError = e.message || "Something went wrong."; render();
  }
}
async function signOut() {
  if (CONFIGURED && sb) await sb.auth.signOut();
  else { session = null; patch({ demoSession: null }); }
  toast("Signed out");
}

/* ============================== project actions ============================== */
function createProject(text, mode) {
  const types = classify(text); const isSoftware = types[0] === "Software";
  const title = text.length < 48 ? text : "New project";
  const p = {
    id: "p_" + uid(), title, intention: text, type: types[0], capabilities: types,
    progress: 8, readiness: 15, stage: mode === "build" ? "Build" : "Plan",
    plan: [{ title: "Understand the goal", detail: "Define the outcome and constraints.", resources: [] }],
    chat: [], files: isSoftware ? starterFiles(title) : {}, activeFile: isSoftware ? "index.html" : null,
    tests: [], security: [], versions: [],
  };
  patch((s) => ({ projects: [p, ...s.projects], route: "project", projectId: p.id, mode, panel: "overview" }));
  logActivity(`Created "${title}"`); toast("Project created"); closeModal();
}

async function sendMessage() {
  const p = project(); const mode = state.mode; const text = ui.composerText.trim(); const att = ui.attachment;
  if (!p || (!text && !att)) return;
  const costsBuild = mode === "build" || mode === "visual";
  const costsIntegration = mode === "plan" || mode === "research";
  if (costsBuild && state.credits.build <= 0) return toast("Out of build credits");
  if (costsIntegration && state.credits.integration <= 0) return toast("Out of integration credits");

  const userMsg = { id: uid(), mode, role: "user", text, image: att, ts: now() };
  updateProject(p.id, (proj) => ({ ...proj, chat: [...proj.chat, userMsg] }));
  ui.composerText = ""; ui.attachment = null;
  startThinking(mode);

  const ctx = { title: p.title, intention: p.intention, type: p.type, files: Object.keys(p.files), plan: p.plan.map((x) => x.title) };
  const history = p.chat.filter((m) => m.mode === mode).slice(-6).map((m) => ({ role: m.role, text: m.text }));

  try {
    let assistantText = "";
    if (mode === "discuss") {
      const r = await callAI("discuss", { project: ctx, message: text, history, image: att });
      assistantText = r.text;
      updateProject(p.id, (proj) => ({ ...proj, chat: [...proj.chat, { id: uid(), mode, role: "assistant", text: assistantText, ts: now() }] }));
    } else if (mode === "research") {
      const r = await callAI("research", { project: ctx, message: text, history, image: att });
      assistantText = r.text + (r.sources?.length ? "\n\nSources:\n" + r.sources.map((s) => `• ${s.title} — ${s.url}`).join("\n") : "");
      updateProject(p.id, (proj) => ({ ...proj, chat: [...proj.chat, { id: uid(), mode, role: "assistant", text: assistantText, ts: now() }] }));
    } else if (mode === "plan") {
      const r = await callAI("plan", { project: ctx, message: text, history });
      const result = r.result || {};
      updateProject(p.id, (proj) => ({
        ...proj, plan: result.plan?.length ? result.plan : proj.plan, readiness: Math.min(100, proj.readiness + 6),
        chat: [...proj.chat, { id: uid(), mode, role: "assistant", text: result.reply || "Plan updated.", ts: now() }],
      }));
      patch((s) => ({ credits: { ...s.credits, integration: s.credits.integration - 1 } }));
      logActivity(`Updated the plan for "${p.title}"`);
    } else if (mode === "build" || mode === "visual") {
      const fullFiles = mode === "visual" ? { "styles.css": p.files["styles.css"] || "", "index.html": p.files["index.html"] || "" } : p.files;
      const r = await callAI(mode, { project: { ...ctx, files: fullFiles }, message: text, history });
      const result = r.result || {};
      updateProject(p.id, (proj) => {
        const files = { ...proj.files };
        for (const op of result.operations || []) {
          if (!safePath(op.path)) continue;
          if (op.op === "write_file") files[op.path] = String(op.content ?? "");
          else if (op.op === "delete_file") delete files[op.path];
        }
        return {
          ...proj, files, tests: computeTests(files), security: computeSecurity(files),
          progress: Math.min(100, proj.progress + 8), readiness: Math.min(100, proj.readiness + 5),
          versions: [{ id: uid(), label: "Requirement implemented", ts: now(), files }, ...proj.versions],
          chat: [...proj.chat, { id: uid(), mode, role: "assistant", text: result.reply || "Done.", ts: now() }],
        };
      });
      patch((s) => ({ credits: { ...s.credits, build: s.credits.build - 1 } }));
      toast(mode === "build" ? "Build applied" : "Design updated");
      logActivity(`${mode === "build" ? "Built" : "Restyled"} something in "${p.title}"`);
    }
  } catch (e) {
    updateProject(p.id, (proj) => ({ ...proj, chat: [...proj.chat, { id: uid(), mode, role: "assistant", error: true, text: e.message || "Something went wrong. Try again.", ts: now() }] }));
  } finally {
    stopThinking();
  }
}

function startThinking(mode) {
  stopThinking();
  ui.thinkingMode = mode; ui.thinkStep = 0; render();
  ui.thinkTimer = setInterval(() => {
    ui.thinkStep = (ui.thinkStep + 1) % (THINKING_STEPS[mode] || ["Thinking"]).length;
    const el = $("#thinkingText"); if (el) el.textContent = THINKING_STEPS[mode][ui.thinkStep];
  }, 900);
}
function stopThinking() { if (ui.thinkTimer) clearInterval(ui.thinkTimer); ui.thinkTimer = null; ui.thinkingMode = null; render(); }

function runTests() { const p = project(); updateProject(p.id, (proj) => ({ ...proj, tests: computeTests(proj.files) })); toast("Tests run"); }
function runSecurity() { const p = project(); updateProject(p.id, (proj) => ({ ...proj, security: computeSecurity(proj.files) })); toast("Security scan run"); }
function snapshot() { const p = project(); updateProject(p.id, (proj) => ({ ...proj, versions: [{ id: uid(), label: "Manual snapshot", ts: now(), files: { ...proj.files } }, ...proj.versions] })); toast("Snapshot saved"); }
function restoreVersion(vid) {
  const p = project(); const v = p.versions.find((x) => x.id === vid); if (!v) return;
  updateProject(p.id, (proj) => ({ ...proj, files: { ...v.files }, tests: computeTests(v.files), security: computeSecurity(v.files) }));
  toast(`Restored "${v.label}"`);
}
function exportProject() {
  const p = project(); const blob = new Blob([JSON.stringify(p, null, 2)], { type: "application/json" });
  const a = document.createElement("a"); a.href = URL.createObjectURL(blob);
  a.download = p.title.toLowerCase().replace(/[^a-z0-9]+/g, "-") + "-builder.json"; a.click(); URL.revokeObjectURL(a.href);
  toast("Export downloaded");
}
function onAttachFile(file) {
  if (!file) return;
  if (!file.type.startsWith("image/")) return toast("Only images can be attached right now");
  const reader = new FileReader();
  reader.onload = () => { ui.attachment = { mimeType: file.type, base64: String(reader.result || "").split(",")[1], name: file.name }; render(); };
  reader.readAsDataURL(file);
}

let modal = null;
function openModal(name) { modal = name; render(); }
function closeModal() { modal = null; render(); }

/* ============================== rendering ============================== */
function render() {
  if (!session) { renderAuth(); $("#appRoot").classList.add("hidden"); $("#authRoot").innerHTML = authHTML(); bindAuthEvents(); return; }
  $("#authRoot").innerHTML = ""; $("#appRoot").classList.remove("hidden");
  renderShell();
}

function renderAuth() {} // placeholder kept for clarity of render() flow

function authHTML() {
  const f = ui.authFields; const signup = ui.authMode === "signup";
  return `
  <div class="auth-screen"><div class="auth-box">
    <div class="auth-brand"><div class="logo" style="width:34px;height:34px;font-size:15px">B</div><span>Builder</span></div>
    <div class="auth-card">
      <h1>${signup ? "Create your account" : "Welcome back"}</h1>
      <p>${signup ? "Takes about ten seconds." : "Sign in to pick up your projects."}</p>
      ${!CONFIGURED ? `<div class="auth-banner">No backend connected yet — this is a local demo sign-in. Add your Supabase project details to config.js for real accounts (see SETUP-AI.md).</div>` : ""}
      ${signup ? `<input class="auth-field" id="authName" placeholder="Full name" value="${esc(f.name)}">` : ""}
      <input class="auth-field" id="authEmail" placeholder="Email" value="${esc(f.email)}">
      <input class="auth-field" id="authPassword" type="password" placeholder="Password" value="${esc(f.password)}">
      ${ui.authError ? `<div class="auth-error">${esc(ui.authError)}</div>` : ""}
      <button class="auth-submit" id="authSubmit">${signup ? "Create account" : "Sign in"}</button>
      <button class="auth-toggle" id="authToggle">${signup ? "Already have an account? Sign in" : "New here? Create an account"}</button>
    </div>
  </div></div>`;
}
function bindAuthEvents() {
  const nameEl = $("#authName"), emailEl = $("#authEmail"), passEl = $("#authPassword");
  if (nameEl) nameEl.oninput = (e) => (ui.authFields.name = e.target.value);
  if (emailEl) emailEl.oninput = (e) => (ui.authFields.email = e.target.value);
  if (passEl) passEl.oninput = (e) => (ui.authFields.password = e.target.value);
  const onEnter = (e) => { if (e.key === "Enter") submitAuth(); };
  [nameEl, emailEl, passEl].forEach((el) => el && (el.onkeydown = onEnter));
  const submitBtn = $("#authSubmit"); if (submitBtn) submitBtn.onclick = submitAuth;
  const toggle = $("#authToggle"); if (toggle) toggle.onclick = () => { ui.authMode = ui.authMode === "signup" ? "signin" : "signup"; ui.authError = ""; render(); };
}

function renderShell() {
  const initials = (session.name || "?").slice(0, 2).toUpperCase();
  $("#sidebarAvatar").textContent = initials;
  $("#sidebarName").textContent = session.name;
  $$(".sidebar .nav-item[data-view]").forEach((b) => b.classList.toggle("active", state.route === b.dataset.view && !state.projectId));
  $("#sidebar").classList.toggle("open", ui.sidebarOpen);
  $("#recent").innerHTML = state.projects.slice(0, 6).map((p) => `<button class="nav-item ${state.projectId === p.id ? "active" : ""}" data-open-project="${p.id}"><span class="ic">&#128193;</span><span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(p.title)}</span></button>`).join("");
  $("#buildCredits").textContent = state.credits.build;
  $("#integrationCredits").textContent = state.credits.integration;
  $("#buildBar").style.width = Math.min(100, state.credits.build * 2) + "%";
  $("#integrationBar").style.width = Math.min(100, state.credits.integration * 0.5) + "%";
  const crumbLabel = state.projectId ? project()?.title : state.route[0].toUpperCase() + state.route.slice(1);
  $("#crumbs").innerHTML = `<span>Builder</span><em>/</em><b>${esc(crumbLabel || "")}</b>`;

  $("#root").innerHTML = state.route === "project" && project() ? projectViewHTML() : standardViewHTML();
  bindShellEvents();
  renderModal();
}

/* ---------------- standard views ---------------- */
const EXAMPLES = ["Build an AI homework assistant", "Open a coffee shop near my college", "Make a Roblox game", "Design a portable student desk", "Start a one-person automation agency"];

function standardViewHTML() {
  const r = state.route;
  if (r === "home") return homeHTML();
  if (r === "projects") return projectsHTML();
  if (r === "activity") return activityHTML();
  if (r === "research") return infoShell("Research", "Open any project and switch to the Research agent — it searches the live web and names real, specific resources.", ["Finds current tools, prices and options", "Cites real sources, not guesses", "Feeds straight into that project's plan"].map((t) => featureRow(t)).join(""));
  if (r === "integrations") return infoShell("Integrations", "What each project agent is actually connected to right now.", [
    featureRow("Gemini — every agent's reasoning, writing and code generation", true),
    featureRow("Live web search — used by the Research agent", true),
    featureRow("Supabase — accounts and real backend calls", CONFIGURED, CONFIGURED ? "" : "Add details to config.js"),
    featureRow("GitHub — push generated projects to a repo", false, "Needs an OAuth app"),
    featureRow("Cloudflare — one-click hosting for what you build", false, "Needs an API token"),
  ].join(""));
  if (r === "agents") return infoShell("Agents", "Five specialists, each with a different job — not one generic bot wearing different labels.", Object.entries(AGENT_META).map(([id, m]) => `<div class="agent-row"><div class="agent-dot" style="background:${m.color}"></div><div><b>${m.name}</b><p>${m.desc}</p></div></div>`).join(""));
  if (r === "settings") return infoShell("Settings", "Your workspace.", [
    featureRow(`Signed in as ${esc(session.name)} (${esc(session.email)})`, true),
    featureRow("Backend connected", CONFIGURED, CONFIGURED ? "" : "See SETUP-AI.md"),
    featureRow("Payments", false, "Intentionally not connected yet"),
  ].join(""));
  return "";
}

function homeHTML() {
  const recent = state.projects.slice(0, 6);
  return `<div class="home">
    <div class="home-head"><div class="eyebrow">Universal creation engine</div>
      <h1>What are you trying to make real?</h1>
      <p>Describe the outcome in your own words. Builder works out the plan, the research, and the actual build needed to get there.</p></div>
    ${!CONFIGURED ? `<div class="banner">No backend connected yet, so agents can't answer for real until you add Supabase + Gemini details. You can still explore the whole interface. <a href="./SETUP-AI.md" target="_blank">See SETUP-AI.md</a></div>` : ""}
    <div class="composer">
      <textarea id="homeInput" rows="3" placeholder="I want to open a cafe near my college — figure out capital, suppliers, branding and launch...">${esc(ui.composerText)}</textarea>
      <div class="composer-row"><button class="btn btn-primary" id="homeSubmit" ${ui.composerText.trim() ? "" : "disabled"}>Start with Builder &#8593;</button></div>
    </div>
    <div class="examples">${EXAMPLES.map((x) => `<button class="chip" data-example="${esc(x)}">${esc(x)}</button>`).join("")}</div>
    ${recent.length ? `<h2 class="section-title" style="margin-top:52px">Recent projects</h2><div class="grid">${recent.map(projectCard).join("")}</div>` : ""}
  </div>`;
}
function projectsHTML() {
  return `<div class="home" style="max-width:1000px">
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px">
      <h2 style="font-family:var(--font-display);font-size:24px;margin:0">Projects</h2>
      <button class="btn btn-primary" data-action="newProject">&#43; New project</button>
    </div>
    ${state.projects.length ? `<div class="grid">${state.projects.map(projectCard).join("")}</div>` : `<div class="empty">No projects yet. Describe what you want to build and Builder will take it from there.</div>`}
  </div>`;
}
function activityHTML() {
  const rows = state.activity.length ? state.activity.map((a) => `<div class="feature-row"><span>${esc(a.line)}</span><span class="note">${timeAgo(a.ts)}</span></div>`).join("") : `<div class="empty">Nothing yet — activity shows up here as you work.</div>`;
  return infoShell("Activity", "Everything Builder has actually done, in order.", rows);
}
function infoShell(title, sub, body) { return `<div class="shell"><h2>${title}</h2><p class="sub">${sub}</p><div class="shell-body">${body}</div></div>`; }
function featureRow(text, done, note) { return `<div class="feature-row">${done ? `<span style="color:#1F9D55">&#10003;</span>` : `<span class="ring"></span>`}<span>${esc(text)}</span>${note ? `<span class="note">${esc(note)}</span>` : ""}</div>`; }
function projectCard(p) {
  return `<button class="card" data-open-project="${p.id}"><div class="type">${esc(p.type)}</div><h3>${esc(p.title)}</h3><p>${esc(p.intention)}</p>
    <div class="pill-row"><span class="pill">${p.progress}% built</span><span class="pill">${p.plan.length} phases</span><span class="pill">${esc(p.stage)}</span></div></button>`;
}

/* ---------------- project view ---------------- */
function projectViewHTML() {
  const p = project(); const mode = state.mode; const meta = AGENT_META[mode];
  const chatMsgs = p.chat.filter((m) => m.mode === mode);
  return `<div class="project-view">
    <div class="mode-tabs">${MODES.map((m) => {
      const active = mode === m.id; const c = AGENT_META[m.id].color;
      return `<button class="mode-tab ${active ? "active" : ""}" data-set-mode="${m.id}" title="${m.hint}" style="${active ? `border-color:${c};background:${c}14;color:${c}` : ""}">${m.icon} ${m.label}</button>`;
    }).join("")}</div>
    <div class="project-body">
      <section class="chat-pane">
        <div class="chat-head"><span class="agent-chip" style="background:${meta.color}"></span><b>${meta.name}</b><span class="desc">${meta.desc}</span></div>
        <div class="chat-scroll" id="chatScroll">
          ${chatMsgs.length === 0 && ui.thinkingMode !== mode ? `<div class="chat-empty">${emptyHintFor(mode)}</div>` : ""}
          ${chatMsgs.map((m) => msgHTML(m, meta)).join("")}
          ${ui.thinkingMode === mode ? thinkingHTML(mode, meta) : ""}
        </div>
        <div class="composer-bar">
          ${ui.attachment ? `<div class="att-chip">&#128206; ${esc(ui.attachment.name)} <button id="removeAtt">&times;</button></div>` : ""}
          <div class="composer-row2">
            <input type="file" id="fileInput" accept="image/*" style="display:none">
            <button class="icon-btn" id="attachBtn">&#128206;</button>
            <textarea class="chat-input" id="chatInput" rows="1" placeholder="${placeholderFor(mode)}">${esc(ui.composerText)}</textarea>
            <button class="send-btn" id="sendBtn" style="background:${meta.color}" ${ui.thinkingMode === mode ? "disabled" : ""}>&#10148;</button>
          </div>
        </div>
      </section>
      <section class="canvas-pane">
        <div class="panel-tabs">${["overview", "preview", "files", "tests", "security", "versions", "publish"].map((t) => `<button class="panel-tab ${state.panel === t ? "active" : ""}" data-set-panel="${t}">${t[0].toUpperCase() + t.slice(1)}</button>`).join("")}</div>
        <div class="panel-body">${panelHTML(p)}</div>
      </section>
    </div>
  </div>`;
}
function emptyHintFor(mode) {
  return { discuss: "Ask anything about this project — you'll get a real answer, not a checklist.", plan: "Ask for a plan and Builder will map real phases with real resources.", build: "Tell Build what to create or change — it edits real files.", visual: "Describe a look and feel — Builder adjusts the live preview.", research: "Ask a question — this agent actually searches the web." }[mode];
}
function placeholderFor(mode) {
  return { discuss: "Ask a question...", plan: "What should the plan cover?", build: "What should Build create or change?", visual: "Describe the look you want...", research: "What do you want to research?" }[mode];
}
function msgHTML(m, meta) {
  return `<div class="msg">${m.role === "assistant" ? `<div class="msg-avatar" style="background:${meta.color}">${meta.letter}</div>` : ""}
    <div class="bubble ${m.role === "user" ? "user" : m.error ? "error" : "assistant"}">${m.image ? `<div class="att">&#128206; ${esc(m.image.name || "image attached")}</div>` : ""}${esc(m.text)}</div></div>`;
}
function thinkingHTML(mode, meta) {
  const steps = THINKING_STEPS[mode] || ["Thinking"];
  return `<div class="thinking"><div class="thinking-spinner" style="background:${meta.color}"><svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M12 2a10 10 0 1 0 10 10" stroke="#fff" stroke-width="3" stroke-linecap="round"/></svg></div><div class="thinking-text"><span id="thinkingText">${steps[ui.thinkStep] || steps[0]}</span><span class="dots"></span></div></div>`;
}

function panelHTML(p) {
  if (state.panel === "overview") return panelOverview(p);
  if (state.panel === "preview") return panelPreview(p);
  if (state.panel === "files") return panelFiles(p);
  if (state.panel === "tests") return panelChecklist("Testing agent", "Real checks run against your actual files.", p.tests, "runTests", "Run tests");
  if (state.panel === "security") return panelChecklist("Security scan", "Looks for secrets and risky patterns in your files.", p.security, "runSecurity", "Scan");
  if (state.panel === "versions") return panelVersions(p);
  if (state.panel === "publish") return panelPublish(p);
  return "";
}
function panelOverview(p) {
  return `<div class="overview-grid">
    <div><div style="font-size:12px;color:var(--muted2);margin-bottom:4px">Readiness</div>
      <div class="readiness-num">${p.readiness}<span>/100</span></div>
      <div class="track"><span style="width:${p.readiness}%"></span></div>
      <p style="font-size:13px;color:var(--muted);margin-top:14px">${esc(p.intention)}</p></div>
    <div><div style="font-size:12px;color:var(--muted2);margin-bottom:8px">Plan — ${p.plan.length} phase${p.plan.length !== 1 ? "s" : ""}</div>
      ${p.plan.map((ph, i) => `<div class="phase"><div class="phase-num">${i + 1}</div><div><b>${esc(ph.title)}</b><p>${esc(ph.detail)}</p>${ph.resources?.length ? `<div class="pill-row">${ph.resources.map((r) => `<span class="pill">${esc(r)}</span>`).join("")}</div>` : ""}</div></div>`).join("")}
    </div></div>`;
}
function panelPreview(p) {
  const isSoftware = p.type === "Software" || Object.keys(p.files).length > 0;
  if (!isSoftware) return `<div class="empty">This project isn't code — switch to Plan or Files to see what's been generated.</div>`;
  return `<div style="display:flex;flex-direction:column;height:100%">
    <div class="preview-toolbar"><button class="icon-toggle ${!state.mobilePreview ? "active" : ""}" data-set-preview="desktop">&#128421;</button><button class="icon-toggle ${state.mobilePreview ? "active" : ""}" data-set-preview="mobile">&#128241;</button></div>
    <div class="preview-wrap"><iframe sandbox="allow-scripts" style="width:${state.mobilePreview ? "380px" : "100%"}" srcdoc="${esc(renderPreviewDoc(p.files))}"></iframe></div>
  </div>`;
}
function panelFiles(p) {
  const files = Object.keys(p.files); if (!files.length) return `<div class="empty">No files yet — ask the Build agent to create something.</div>`;
  const active = p.activeFile && files.includes(p.activeFile) ? p.activeFile : files[0];
  return `<div class="files-layout">
    <div class="file-list">${files.map((f) => `<button class="file-item ${f === active ? "active" : ""}" data-open-file="${esc(f)}">${esc(f)}</button>`).join("")}</div>
    <div class="file-viewer"><div class="file-viewer-head"><span>${esc(active)}</span><button id="copyFile" title="Copy">&#128203;</button></div><pre class="code" id="fileCode">${esc(p.files[active] || "")}</pre></div>
  </div>`;
}
function panelChecklist(title, sub, rows, runFn, runLabel) {
  return `<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px"><div><b style="font-size:14px">${title}</b><p style="margin:2px 0 0;font-size:12.5px;color:var(--muted2)">${sub}</p></div><button class="btn btn-dark" data-action="${runFn}">${runLabel}</button></div>
    ${!rows?.length ? `<div class="empty">Nothing checked yet — run it once you have files.</div>` : rows.map(([name, status]) => `<div class="check-row">${status === "passed" ? "&#10003;" : status === "warn" ? "&#9888;" : "&#10005;"}<span>${esc(name)}</span><span class="status status-${status}">${status}</span></div>`).join("")}`;
}
function panelVersions(p) {
  return `<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px"><div><b style="font-size:14px">Versions</b><p style="margin:2px 0 0;font-size:12.5px;color:var(--muted2)">Every real change is recoverable.</p></div><button class="btn btn-dark" data-action="snapshot">Snapshot</button></div>
    ${!p.versions.length ? `<div class="empty">No versions yet — build something or take a manual snapshot.</div>` : p.versions.map((v, i) => `<div class="version-row">&#128337;<div><b>${esc(v.label)}</b><div class="ts">${timeAgo(v.ts)}</div></div><button class="btn btn-ghost" style="margin-left:auto" data-restore="${v.id}">${i === 0 ? "Current" : "Restore"}</button></div>`).join("")}`;
}
function panelPublish(p) {
  const testsOk = p.tests.length > 0 && p.tests.every((t) => t[1] === "passed");
  const secOk = p.security.length > 0 && p.security.every((t) => t[1] !== "failed");
  return `<b style="font-size:14px">Publish checklist</b><div style="margin-top:12px">
    ${featureRow("Files exist", Object.keys(p.files).length > 0)}
    ${featureRow("Tests passing", testsOk, testsOk ? "" : "Run the Testing agent")}
    ${featureRow("Security reviewed", secOk, secOk ? "" : "Run a security scan")}
    ${featureRow("Hosting connected", false, "Needs Cloudflare — see SETUP-AI.md")}
    </div>
    <div style="display:flex;gap:8px;margin-top:16px"><button class="btn btn-dark" data-action="exportProject">Export JSON</button><button class="btn btn-ghost" disabled title="Connect GitHub in Integrations first">Push to GitHub</button></div>`;
}

/* ---------------- modals ---------------- */
function renderModal() {
  const host = $("#modal");
  if (!modal) { host.innerHTML = ""; return; }
  if (modal === "new") host.innerHTML = newProjectModalHTML();
  else if (modal === "command") host.innerHTML = commandModalHTML();
  else if (modal === "search") host.innerHTML = searchModalHTML();
  bindModalEvents();
}
function newProjectModalHTML() {
  return `<div class="modal-overlay" data-close-modal><div class="modal" style="width:460px" onclick="event.stopPropagation()"><div class="modal-body">
    <div class="modal-head"><b>New project</b><button data-close-modal>&times;</button></div>
    <label class="field-label">What are you trying to accomplish?</label>
    <textarea class="field" id="npText" rows="3" placeholder="Describe the outcome...">${esc(ui.composerText)}</textarea>
    <label class="field-label">Starting mode</label>
    <select class="field" id="npMode"><option value="plan">Plan first</option><option value="build">Build immediately</option><option value="discuss">Discuss first</option></select>
    <div class="modal-actions"><button class="btn btn-ghost" data-close-modal>Cancel</button><button class="btn btn-primary" id="npCreate">Create project</button></div>
  </div></div></div>`;
}
function commandModalHTML() {
  const items = [["New project", "new"], ["Projects", "projects"], ["Activity", "activity"], ["Research", "research"], ["Settings", "settings"]];
  return `<div class="modal-overlay" data-close-modal><div class="modal" style="width:380px" onclick="event.stopPropagation()"><div style="padding:10px">${items.map(([l, r]) => `<button class="command-item" data-cmd="${r}">${l}</button>`).join("")}</div></div></div>`;
}
function searchModalHTML() {
  const q = ui.searchQuery || "";
  const results = state.projects.filter((p) => !q || p.title.toLowerCase().includes(q.toLowerCase()) || p.intention.toLowerCase().includes(q.toLowerCase()));
  return `<div class="modal-overlay" data-close-modal><div class="modal" style="width:440px" onclick="event.stopPropagation()"><div class="modal-body">
    <input class="field" id="searchInput" placeholder="Search projects..." value="${esc(q)}">
    ${results.length ? results.map((p) => `<button class="search-result" data-open-project="${p.id}"><b>${esc(p.title)}</b><span class="type">${esc(p.type)}</span></button>`).join("") : `<div style="color:var(--faint);font-size:13px;text-align:center;padding:20px">No results</div>`}
  </div></div></div>`;
}
function bindModalEvents() {
  $$("[data-close-modal]").forEach((el) => (el.onclick = closeModal));
  const npCreate = $("#npCreate");
  if (npCreate) npCreate.onclick = () => { const t = $("#npText").value.trim(); const m = $("#npMode").value; if (t) createProject(t, m); };
  const npText = $("#npText"); if (npText) npText.oninput = (e) => (ui.composerText = e.target.value);
  $$("[data-cmd]").forEach((el) => (el.onclick = () => { const v = el.dataset.cmd; closeModal(); if (v === "new") openModal("new"); else patch({ route: v, projectId: null }); }));
  const searchInput = $("#searchInput");
  if (searchInput) { searchInput.oninput = (e) => { ui.searchQuery = e.target.value; renderModal(); const el = $("#searchInput"); el.focus(); el.selectionStart = el.selectionEnd = el.value.length; }; }
  $$("[data-open-project]").forEach((el) => (el.onclick = () => { closeModal(); patch({ route: "project", projectId: el.dataset.openProject, mode: "discuss", panel: "overview" }); }));
}

/* ---------------- global event binding ---------------- */
function bindShellEvents() {
  $$("[data-view]").forEach((el) => (el.onclick = () => patch({ route: el.dataset.view, projectId: null })));
  $$("[data-open-project]").forEach((el) => (el.onclick = () => patch({ route: "project", projectId: el.dataset.openProject, mode: "discuss", panel: "overview" })));
  $$("[data-set-mode]").forEach((el) => (el.onclick = () => patch({ mode: el.dataset.setMode })));
  $$("[data-set-panel]").forEach((el) => (el.onclick = () => patch({ panel: el.dataset.setPanel })));
  $$("[data-set-preview]").forEach((el) => (el.onclick = () => patch({ mobilePreview: el.dataset.setPreview === "mobile" })));
  $$("[data-open-file]").forEach((el) => (el.onclick = () => updateProject(project().id, (p) => ({ ...p, activeFile: el.dataset.openFile }))));
  $$("[data-restore]").forEach((el) => (el.onclick = () => restoreVersion(el.dataset.restore)));
  $$("[data-example]").forEach((el) => (el.onclick = () => { ui.composerText = el.dataset.example; render(); }));
  const runTestsBtn = document.querySelector('[data-action="runTests"]'); if (runTestsBtn) runTestsBtn.onclick = runTests;
  const runSecBtn = document.querySelector('[data-action="runSecurity"]'); if (runSecBtn) runSecBtn.onclick = runSecurity;
  const snapBtn = document.querySelector('[data-action="snapshot"]'); if (snapBtn) snapBtn.onclick = snapshot;
  const expBtn = document.querySelector('[data-action="exportProject"]'); if (expBtn) expBtn.onclick = exportProject;
  const newBtns = document.querySelectorAll('[data-action="newProject"]'); newBtns.forEach((b) => (b.onclick = () => openModal("new")));
  const signOutBtn = document.querySelector('[data-action="signOut"]'); if (signOutBtn) signOutBtn.onclick = signOut;
  const toggleSidebar = document.querySelectorAll('[data-action="toggleSidebar"]'); toggleSidebar.forEach((b) => (b.onclick = () => { ui.sidebarOpen = !ui.sidebarOpen; render(); }));
  const cmdBtn = document.querySelector('[data-action="command"]'); if (cmdBtn) cmdBtn.onclick = () => openModal("command");
  const searchBtn = document.querySelector('[data-action="search"]'); if (searchBtn) searchBtn.onclick = () => openModal("search");
  const copyFile = $("#copyFile"); if (copyFile) copyFile.onclick = () => { navigator.clipboard?.writeText($("#fileCode").textContent); toast("Copied"); };

  const homeInput = $("#homeInput");
  if (homeInput) { homeInput.oninput = (e) => { ui.composerText = e.target.value; const b = $("#homeSubmit"); if (b) b.disabled = !e.target.value.trim(); }; }
  const homeSubmit = $("#homeSubmit"); if (homeSubmit) homeSubmit.onclick = () => { if (ui.composerText.trim()) createProject(ui.composerText.trim(), "plan"); };

  const chatInput = $("#chatInput");
  if (chatInput) {
    chatInput.oninput = (e) => (ui.composerText = e.target.value);
    chatInput.onkeydown = (e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); } };
    chatInput.focus(); chatInput.selectionStart = chatInput.selectionEnd = chatInput.value.length;
  }
  const sendBtn = $("#sendBtn"); if (sendBtn) sendBtn.onclick = sendMessage;
  const attachBtn = $("#attachBtn"); if (attachBtn) attachBtn.onclick = () => $("#fileInput").click();
  const fileInput = $("#fileInput"); if (fileInput) fileInput.onchange = (e) => onAttachFile(e.target.files?.[0]);
  const removeAtt = $("#removeAtt"); if (removeAtt) removeAtt.onclick = () => { ui.attachment = null; render(); };

  const chatScroll = $("#chatScroll"); if (chatScroll) chatScroll.scrollTop = chatScroll.scrollHeight;
}

/* ---------------- keyboard shortcuts ---------------- */
document.addEventListener("keydown", (e) => {
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") { e.preventDefault(); openModal("command"); }
  if (e.key === "Escape" && modal) closeModal();
});

/* ---------------- boot ---------------- */
initAuth();
})();
