function setupIcons() {
  if (window.lucide?.createIcons) {
    window.lucide.createIcons({ icons: window.lucide.icons });
  }
}

function setupReveal() {
  const items = document.querySelectorAll('[data-reveal]');
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches || !('IntersectionObserver' in window)) {
    items.forEach((item) => item.classList.add('is-visible'));
    return;
  }

  const observer = new IntersectionObserver((entries, currentObserver) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add('is-visible');
        currentObserver.unobserve(entry.target);
      }
    });
  }, { threshold: 0.16 });

  items.forEach((item, index) => {
    item.style.setProperty('--reveal-order', String(index % 3));
    observer.observe(item);
  });
}

function setupFormatChips() {
  const chips = [...document.querySelectorAll('[data-format]')];

  chips.forEach((chip) => {
    chip.addEventListener('click', () => {
      const wasSelected = chip.getAttribute('aria-pressed') === 'true';
      chips.forEach((other) => {
        other.setAttribute('aria-pressed', 'false');
        other.classList.remove('is-selected');
      });

      if (!wasSelected) {
        chip.setAttribute('aria-pressed', 'true');
        chip.classList.add('is-selected');
      }
    });
  });

  const refresh = document.querySelector('[data-action="refresh"]');
  const ideaInput = document.querySelector('#idea-input');
  refresh?.addEventListener('click', () => {
    ideaInput.value = '';
    document.querySelector('#idea-status').textContent = '';
    document.querySelector('#idea-status').classList.remove('is-visible');
    try { localStorage.removeItem('projectx_landing_idea'); } catch {}
    chips.forEach((chip) => {
      chip.setAttribute('aria-pressed', 'false');
      chip.classList.remove('is-selected');
    });
    refresh.classList.remove('is-spinning');
    requestAnimationFrame(() => refresh.classList.add('is-spinning'));
    window.setTimeout(() => refresh.classList.remove('is-spinning'), 700);
    ideaInput.focus();
  });
}

function setupIdeaForm() {
  const form = document.querySelector('#idea-form');
  const input = document.querySelector('#idea-input');
  const status = document.querySelector('#idea-status');

  try {
    const saved = JSON.parse(localStorage.getItem('projectx_landing_idea') || 'null');
    if (saved?.idea) {
      input.value = saved.idea;
      const chip = document.querySelector(`[data-format="${CSS.escape(saved.format || '')}"]`);
      chip?.setAttribute('aria-pressed', 'true');
      chip?.classList.add('is-selected');
      status.textContent = 'Restored the idea saved in this browser.';
      status.classList.add('is-visible');
    }
  } catch {}

  form?.addEventListener('submit', (event) => {
    event.preventDefault();
    const idea = input?.value.trim();
    if (!idea) {
      status.textContent = 'Add a short description of your idea first.';
      status.classList.add('is-visible');
      input?.focus();
      return;
    }

    const selectedFormat = document.querySelector('[data-format][aria-pressed="true"]')?.dataset.format || '';
    try {
      localStorage.setItem('projectx_landing_idea', JSON.stringify({ idea, format: selectedFormat, savedAt: new Date().toISOString() }));
      status.textContent = 'Idea saved in this browser. Project creation will connect in the next build step.';
      status.classList.add('is-visible');
    } catch {
      status.textContent = 'This browser could not save the idea. You can keep it in the box for now.';
      status.classList.add('is-visible');
    }
  });
}

function announce(message) {
  let notice = document.querySelector('#site-notice');
  if (!notice) {
    notice = document.createElement('div');
    notice.id = 'site-notice';
    notice.className = 'site-notice';
    notice.setAttribute('role', 'status');
    notice.setAttribute('aria-live', 'polite');
    document.body.append(notice);
  }
  notice.textContent = message;
  notice.classList.add('is-visible');
  window.clearTimeout(notice.hideTimer);
  notice.hideTimer = window.setTimeout(() => notice.classList.remove('is-visible'), 3200);
}

function setupAppActions() {
  const actionMessages = {
    login: 'Sign-in will connect to the ProjectX workspace in a later build step.',
    pricing: 'Pricing details are being prepared.',
    docs: 'ProjectX guides and documentation are part of the next build step.',
    attachment: 'File attachments will be available inside the ProjectX workspace.',
    'prompt-options': 'Prompt options will be available when the workspace is connected.',
    guides: 'ProjectX guides are coming in a later build step.',
    api: 'API documentation is coming in a later build step.',
    about: 'More about ProjectX will be added here.',
    changelog: 'The ProjectX changelog is coming in a later build step.',
    contact: 'Contact options are coming in a later build step.',
    status: 'ProjectX service status will be available when the workspace services are connected.'
  };

  document.querySelectorAll('[data-app-action]').forEach((button) => {
    button.addEventListener('click', () => {
      const action = button.dataset.appAction;
      if (action === 'get-started') {
        document.querySelector('#top')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        window.setTimeout(() => document.querySelector('#idea-input')?.focus({ preventScroll: true }), 350);
        return;
      }
      if (action === 'workspace') {
        document.querySelector('#experience-preview')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        return;
      }
      announce(actionMessages[action] || 'This ProjectX action will be connected in a later build step.');
    });
  });
}

function setupMobileMenu() {
  const toggle = document.querySelector('.menu-toggle');
  const nav = document.querySelector('#main-nav');

  toggle?.addEventListener('click', () => {
    const open = toggle.getAttribute('aria-expanded') !== 'true';
    toggle.setAttribute('aria-expanded', String(open));
    toggle.setAttribute('aria-label', open ? 'Close navigation' : 'Open navigation');
    nav.classList.toggle('is-open', open);
  });

  nav?.querySelectorAll('a, button').forEach((link) => {
    link.addEventListener('click', () => {
      toggle?.setAttribute('aria-expanded', 'false');
      toggle?.setAttribute('aria-label', 'Open navigation');
      nav.classList.remove('is-open');
    });
  });
}

function setupEmailForm() {
  const form = document.querySelector('#email-form');
  const status = document.querySelector('#email-status');

  form?.addEventListener('submit', (event) => {
    event.preventDefault();
    if (!form.reportValidity()) return;
    status.textContent = 'Email signup is not connected yet. No email was sent.';
    form.reset();
  });
}

export function installInteractions() {
  setupIcons();
  setupReveal();
  setupIdeaForm();
  setupAppActions();
  setupFormatChips();
  setupMobileMenu();
  setupEmailForm();
}
