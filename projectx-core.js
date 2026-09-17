export const CORE_VERSION = 1;

const SECTION_LIMIT = 12;

const FALLBACK_SECTIONS = {
  Game: [
    ['Plan', 'Define the game loop, rules, progression, and success criteria.'],
    ['Gameplay', 'Define mechanics, controls, balancing, and player experience.'],
    ['Playtest', 'Run and inspect the current playable artifact.'],
    ['Code', 'Inspect and change the generated implementation.'],
    ['Assets', 'Track visual, audio, and content requirements.'],
    ['Test', 'Verify important behaviours and regressions.'],
    ['Publish', 'Prepare the project for delivery.']
  ],
  Website: [
    ['Plan', 'Define pages, audience, content, and conversion goals.'],
    ['Design', 'Define information hierarchy, visual direction, and responsive behaviour.'],
    ['Preview', 'Inspect the current generated experience.'],
    ['Code', 'Inspect and change the generated implementation.'],
    ['Test', 'Verify navigation, interactions, accessibility, and responsive behaviour.'],
    ['Publish', 'Prepare the site for delivery.']
  ],
  Business: [
    ['Plan', 'Turn the business goal into an actionable operating plan.'],
    ['Research', 'Capture market, customer, competitor, or location evidence.'],
    ['Economics', 'Model pricing, costs, assumptions, and unit economics.'],
    ['Operations', 'Define the repeatable operating workflow.'],
    ['Marketing', 'Define acquisition, positioning, and launch actions.'],
    ['Launch', 'Turn the plan into an executable launch checklist.']
  ],
  Research: [
    ['Question', 'Refine the research question, scope, and methodology.'],
    ['Research', 'Collect and organize evidence.'],
    ['Sources', 'Track source quality and provenance.'],
    ['Analysis', 'Compare evidence and identify patterns.'],
    ['Findings', 'Synthesize defensible findings and uncertainty.'],
    ['Report', 'Create the final research deliverable.']
  ],
  Other: [
    ['Plan', 'Turn the goal into a concrete sequence of outcomes.'],
    ['Work', 'Develop the core deliverable.'],
    ['Review', 'Check the work against the project goal.'],
    ['Output', 'Prepare the result for use or delivery.']
  ]
};

export const safeId = value => String(value ?? '')
  .trim()
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-+|-+$/g, '')
  .slice(0, 80) || `section-${Math.random().toString(36).slice(2, 8)}`;

export const sanitizePath = value => {
  const path = String(value ?? '').replace(/\\/g, '/').replace(/^\/+/, '').trim();
  if (!path || path.includes('..') || path.includes('\0') || /^[a-z]+:\/\//i.test(path)) return null;
  const clean = path.split('/').filter(Boolean).join('/');
  if (!clean || clean.length > 180) return null;
  return clean;
};

export function normalizeSections(sections, type = 'Other') {
  const input = Array.isArray(sections) ? sections : [];
  const out = [];
  const seen = new Set();
  const add = value => {
    const raw = typeof value === 'string' ? { name: value } : value || {};
    const name = String(raw.name || raw.title || '').trim();
    if (!name || /^chat$/i.test(name)) return;
    const id = safeId(raw.id || name);
    if (seen.has(id)) return;
    seen.add(id);
    out.push({
      id,
      name: name.slice(0, 60),
      purpose: String(raw.purpose || `Work on ${name}.`).slice(0, 220),
      dependsOn: Array.isArray(raw.dependsOn) ? raw.dependsOn.map(safeId).filter(Boolean).slice(0, 8) : [],
      kind: String(raw.kind || 'workspace').slice(0, 30)
    });
  };
  input.forEach(add);
  if (!out.length) (FALLBACK_SECTIONS[type] || FALLBACK_SECTIONS.Other).forEach(([name, purpose]) => add({ name, purpose }));
  return [
    { id: 'chat', name: 'Chat', purpose: 'The project conversation and change interface.', dependsOn: [], kind: 'conversation' },
    ...out
  ].slice(0, SECTION_LIMIT);
}

const arr = value => Array.isArray(value) ? value.map(v => String(v ?? '').trim()).filter(Boolean) : [];

export function emptySpec() {
  return {
    goal: '',
    users: [],
    requirements: [],
    constraints: [],
    features: [],
    decisions: [],
    dependencies: [],
    assets: [],
    deliverables: [],
    acceptanceCriteria: [],
    successCriteria: [],
    openQuestions: [],
    platform: '',
    technology: [],
    visualDirection: '',
    currentState: 'discovery',
    game: { kind: '', player: '', controls: '', loop: '', theme: '', progression: '', multiplayer: false }
  };
}

export function mergeSpec(base = emptySpec(), patch = {}) {
  const next = { ...emptySpec(), ...base };
  for (const field of ['goal', 'platform', 'visualDirection', 'currentState']) {
    if (typeof patch[field] === 'string' && patch[field].trim()) next[field] = patch[field].trim();
  }
  for (const field of ['users', 'requirements', 'constraints', 'features', 'decisions', 'dependencies', 'assets', 'deliverables', 'acceptanceCriteria', 'successCriteria', 'openQuestions', 'technology']) {
    if (Array.isArray(patch[field])) next[field] = [...new Set(arr(patch[field]))];
  }
  if (patch.game && typeof patch.game === 'object') next.game = { ...next.game, ...patch.game };
  return next;
}

export function validateSpec(spec, projectType = 'Other') {
  const s = mergeSpec(emptySpec(), spec);
  const missing = [];
  if (s.goal.length < 12) missing.push('goal');
  if (!s.users.length) missing.push('users');
  if (!s.requirements.length) missing.push('requirements');
  if (!s.deliverables.length) missing.push('deliverables');
  if (/^(Game|Website|App|Mobile|API|Agent|Automation)$/i.test(projectType) && !s.platform) missing.push('platform');
  if (projectType === 'Game' && !s.game.loop) missing.push('game.loop');
  return { valid: missing.length === 0, missing };
}

export function buildDependencyMap(sections = []) {
  const ids = new Set(sections.map(s => s.id));
  return sections.map(section => ({
    ...section,
    dependsOn: (section.dependsOn || []).filter(id => ids.has(id))
  }));
}

export function invalidateArtifacts(project) {
  const artifacts = project.artifacts || {};
  for (const [path, artifact] of Object.entries(artifacts)) {
    if (artifact && Number(artifact.specVersion || 0) !== Number(project.specVersion)) artifact.stale = true;
  }
  project.artifacts = artifacts;
}

export function createProject({ id, title, type = 'Other', intent = '', spec = {}, sections = [], conversation = [] } = {}) {
  const normalizedSections = normalizeSections(sections, type);
  return {
    id: id || `px-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    title: String(title || 'Untitled project').trim().slice(0, 120),
    type: String(type || 'Other'),
    intent: String(intent || spec.goal || '').trim(),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    specVersion: 1,
    understanding: { confidence: 0, missing: [], ambiguities: [], method: 'pending' },
    spec: mergeSpec(emptySpec(), spec),
    sections: buildDependencyMap(normalizedSections),
    selectedSection: 'chat',
    conversation: Array.isArray(conversation) ? conversation : [],
    sectionContent: {},
    artifacts: {},
    versions: [],
    status: 'discovery',
    sync: { remoteId: null, lastSyncedAt: null, mode: 'local' }
  };
}

export function applySpecChange(project, patch) {
  const before = JSON.stringify(project.spec);
  project.spec = mergeSpec(project.spec, patch);
  if (JSON.stringify(project.spec) !== before) {
    project.specVersion += 1;
    project.updatedAt = new Date().toISOString();
    invalidateArtifacts(project);
    project.sectionContent = {};
    project.versions = Array.isArray(project.versions) ? project.versions : [];
  }
  return project;
}

export function assemblePreviewHtml(files = {}) {
  const safeFiles = Object.fromEntries(Object.entries(files).map(([path, content]) => [sanitizePath(path), String(content ?? '')]).filter(([path]) => path));
  let html = safeFiles['index.html'] || safeFiles['src/index.html'];
  if (!html) {
    const first = Object.keys(safeFiles).find(p => /\.html?$/i.test(p));
    html = first ? safeFiles[first] : '<!doctype html><html><body><div id="app"></div></body></html>';
  }
  html = String(html);
  html = html.replace(/<link[^>]+href=["']([^"']+)["'][^>]*>/gi, (tag, href) => {
    const path = sanitizePath(href.replace(/^\.\//, ''));
    const css = path && safeFiles[path];
    return css != null ? `<style data-projectx-file="${path}">${css}</style>` : tag;
  });
  html = html.replace(/<script[^>]+src=["']([^"']+)["'][^>]*><\/script>/gi, (tag, src) => {
    const path = sanitizePath(src.replace(/^\.\//, ''));
    const js = path && safeFiles[path];
    return js != null ? `<script data-projectx-file="${path}">${js.replace(/<\/script/gi, '<\\/script')}</script>` : tag;
  });
  if (!/<meta[^>]+name=["']viewport["']/i.test(html)) {
    html = html.replace(/<head>/i, '<head><meta name="viewport" content="width=device-width,initial-scale=1">');
  }
  const guard = `<script>(function(){window.addEventListener('error',function(e){parent.postMessage({type:'PROJECTX_RUNTIME_ERROR',message:String(e.message||'Runtime error')},'*')});window.addEventListener('unhandledrejection',function(e){parent.postMessage({type:'PROJECTX_RUNTIME_ERROR',message:String(e.reason?.message||e.reason||'Unhandled rejection')},'*')});})();<\/script>`;
  return html.replace(/<head>/i, `<head>${guard}`);
}

export function serializeForPersistence(project) {
  return {
    id: project.id,
    title: project.title,
    type: project.type,
    intention: project.intent,
    specVersion: project.specVersion,
    spec: project.spec,
    understanding: project.understanding,
    workspace: { sections: project.sections },
    selectedSection: project.selectedSection,
    status: project.status,
    conversation: project.conversation.slice(-100),
    files: project.files || {},
    artifacts: project.artifacts || {},
    versions: project.versions || [],
    updatedAt: project.updatedAt
  };
}

export function migrateProject(raw = {}) {
  const p = createProject({
    id: raw.id,
    title: raw.title,
    type: raw.type || raw.project_type || 'Other',
    intent: raw.intent || raw.intention || raw.goal || '',
    spec: raw.spec || raw.projectSpec || {},
    sections: raw.sections || raw.workspace?.sections || [],
    conversation: raw.conversation || raw.messages || []
  });
  p.specVersion = Number(raw.specVersion || 1);
  p.understanding = raw.understanding || p.understanding;
  p.artifacts = raw.artifacts || {};
  p.versions = Array.isArray(raw.versions) ? raw.versions : [];
  p.status = raw.status || 'draft';
  return p;
}
