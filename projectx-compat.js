(() => {
  'use strict';
  const NEW_KEY = 'px_adaptive_v1';
  const OLD_KEYS = ['builder_universal_v14', 'builder_state_v14'];

  const read = (key, fallback = null) => {
    try {
      const value = localStorage.getItem(key);
      return value ? JSON.parse(value) : fallback;
    } catch {
      return fallback;
    }
  };

  const write = (key, value) => {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch {
      return false;
    }
  };

  const clean = (value, fallback = '') => String(value ?? fallback).trim();

  const classify = (value) => {
    const x = clean(value).toLowerCase();
    if (/\b(game|rpg|arcade|platformer|flappy|roblox)\b/.test(x)) return 'Game';
    if (/\b(cafe|restaurant|shop|store|business|crm|booking|inventory|agency)\b/.test(x)) return 'Business';
    if (/\b(research|study|paper|thesis|market analysis|competitor)\b/.test(x)) return 'Research';
    if (/\b(agent|assistant|copilot|bot)\b/.test(x)) return 'Agent';
    if (/\b(automation|workflow|trigger|schedule)\b/.test(x)) return 'Automation';
    if (/\b(api|endpoint|backend|webhook)\b/.test(x)) return 'API';
    if (/\b(mobile|ios|android)\b/.test(x)) return 'Mobile';
    if (/\b(website|landing page|portfolio|web site)\b/.test(x)) return 'Website';
    return 'App';
  };

  const fallbackSections = {
    Website: ['Chat', 'Plan', 'Design', 'Preview', 'Code', 'Files', 'Test', 'Publish'],
    App: ['Chat', 'Plan', 'Design', 'Data', 'Preview', 'Test', 'Publish'],
    Mobile: ['Chat', 'Plan', 'Screens', 'Data', 'Build', 'Test', 'Publish'],
    Game: ['Chat', 'Plan', 'Gameplay', 'Scenes', 'Assets', 'Code', 'Playtest', 'Publish'],
    Business: ['Chat', 'Plan', 'Research', 'Budget', 'Operations', 'Marketing', 'Checklist', 'Launch'],
    Research: ['Chat', 'Research', 'Sources', 'Analysis', 'Findings', 'Report'],
    Agent: ['Chat', 'Goal', 'Tools', 'Knowledge', 'Testing', 'Deploy'],
    Automation: ['Chat', 'Plan', 'Workflow', 'Integrations', 'Testing', 'Deploy'],
    API: ['Chat', 'Plan', 'Endpoints', 'Data', 'Testing', 'Docs', 'Deploy'],
    Other: ['Chat', 'Plan', 'Research', 'Next steps']
  };

  const current = read(NEW_KEY, null);
  if (current && Array.isArray(current.projects)) {
    window.__PX_COMPAT_READY__ = true;
    return;
  }

  const oldState = OLD_KEYS.map(key => read(key, null)).find(v => v && typeof v === 'object');
  const oldProjects = Array.isArray(oldState?.projects) ? oldState.projects : [];

  const projects = oldProjects.map((old, index) => {
    const intent = clean(old.intent ?? old.intention ?? old.description ?? old.prompt ?? old.title, 'Project');
    const type = clean(old.type, classify(intent)) || classify(intent);
    const sections = Array.isArray(old.sections) && old.sections.length
      ? ['Chat', ...old.sections.filter(s => clean(s) && clean(s).toLowerCase() !== 'chat')]
      : (fallbackSections[type] || fallbackSections.Other);
    const answers = Array.isArray(old.answers) ? old.answers.map(clean).filter(Boolean) : [];
    const messages = Array.isArray(old.messages) ? old.messages : [];
    const title = clean(old.title, intent.split(/\n|[.!?]/)[0]).slice(0, 90) || `Project ${index + 1}`;

    return {
      id: clean(old.id, `px-migrated-${Date.now()}-${index}`),
      title,
      type,
      intent,
      answers,
      summary: clean(old.summary, `Imported from your previous ProjectX workspace.`),
      createdAt: clean(old.createdAt, new Date().toISOString()),
      messages,
      sections: sections.slice(0, 8),
      sectionData: old.sectionData && typeof old.sectionData === 'object' ? old.sectionData : {}
    };
  });

  if (projects.length) {
    write(NEW_KEY, { projects, migratedAt: new Date().toISOString() });
  } else {
    write(NEW_KEY, { projects: [], migratedAt: new Date().toISOString() });
  }

  window.__PX_COMPAT_READY__ = true;
})();
