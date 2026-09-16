(() => {
  'use strict';

  const STORE_KEYS = ['builder_universal_v14', 'builder_state_v14'];
  const examples = [
    'Website for my sneaker store',
    'Local café business plan',
    'A 2D platformer game',
    'AI study assistant',
    'Other idea'
  ];

  function hasProject() {
    try {
      for (const key of STORE_KEYS) {
        const raw = localStorage.getItem(key);
        if (!raw) continue;
        const state = JSON.parse(raw);
        if (state?.projectId) return true;
        if (Array.isArray(state?.projects) && state.projects.length) return true;
      }
    } catch {}
    return false;
  }

  function existingAction(action) {
    return document.querySelector(`[data-action="${action}"]`);
  }

  function startCreation(text = '') {
    const old = document.querySelector('.px-public-home');
    old?.remove();
    document.body.classList.remove('px-public-home-active');

    const newBtn = existingAction('newProject');
    if (newBtn) {
      newBtn.click();
      setTimeout(() => {
        const input = document.querySelector('#heroPrompt, textarea, input[type="text"]');
        if (input && text && !input.value) {
          input.value = text;
          input.dispatchEvent(new Event('input', { bubbles: true }));
        }
      }, 80);
      return;
    }

    const input = document.querySelector('#heroPrompt');
    if (input && text) {
      input.value = text;
      input.dispatchEvent(new Event('input', { bubbles: true }));
    }
  }

  function render() {
    if (document.documentElement.dataset.page !== 'app') return;
    if (document.querySelector('.px-public-home')) return;
    if (hasProject()) return;

    const home = document.createElement('div');
    home.className = 'px-public-home';
    home.innerHTML = `
      <header class="px-public-header">
        <button class="px-brand" type="button" aria-label="ProjectX home">ProjectX</button>
        <nav class="px-public-nav" aria-label="Main navigation">
          <a href="#build">Build</a>
          <a href="#use-cases">Use cases</a>
          <a href="#how-it-works">How it works</a>
          <a href="#pricing">Pricing</a>
        </nav>
        <div class="px-public-actions">
          <button class="px-signin" type="button" data-px-start>Sign in</button>
          <button class="px-get-started" type="button" data-px-start>Get started</button>
        </div>
      </header>

      <main class="px-public-main" id="build">
        <section class="px-public-hero">
          <div class="px-public-kicker">IDEAS TO REALITY</div>
          <h1>What do you want to build?</h1>
          <p>Describe your idea. ProjectX understands, plans, and helps you create it.<br class="px-desktop-only"> Websites, apps, games, business plans, research — anything.</p>

          <form class="px-public-composer" id="pxPublicComposer">
            <textarea id="pxPublicPrompt" rows="2" placeholder="Tell us what you want to create..." aria-label="What do you want to create?"></textarea>
            <div class="px-composer-bottom">
              <button class="px-file-note" type="button" aria-label="File upload is optional">⌕ <span>Add file (optional)</span></button>
              <button class="px-submit" type="submit" aria-label="Start creation">→</button>
            </div>
          </form>

          <div class="px-examples">
            <span>Try an example:</span>
            ${examples.map((x) => `<button type="button" data-example="${x.replace(/"/g, '&quot;')}">${x}</button>`).join('')}
          </div>
        </section>

        <section class="px-public-features" id="how-it-works">
          <article><div class="px-feature-icon">□</div><h2>Understands your idea</h2><p>Asks only what's needed</p></article>
          <article><div class="px-feature-icon">◇</div><h2>Creates a tailored workspace</h2><p>Sections adapt to your project</p></article>
          <article><div class="px-feature-icon">↗</div><h2>Helps you go from idea to real</h2><p>Plan, build, organize, execute</p></article>
        </section>

        <section class="px-trusted" id="use-cases">
          <div>TRUSTED BY CREATORS</div>
          <p><span>Students</span><i></i><span>Builders</span><i></i><span>Researchers</span><i></i><span>Founders</span><i></i><span>Hobbyists</span></p>
        </section>
      </main>
    `;

    document.body.appendChild(home);
    document.body.classList.add('px-public-home-active');

    home.querySelectorAll('[data-px-start]').forEach((button) => button.addEventListener('click', () => startCreation()));
    home.querySelectorAll('[data-example]').forEach((button) => button.addEventListener('click', () => {
      const input = home.querySelector('#pxPublicPrompt');
      input.value = button.dataset.example || '';
      input.focus();
    }));
    home.querySelector('#pxPublicComposer')?.addEventListener('submit', (event) => {
      event.preventDefault();
      const value = home.querySelector('#pxPublicPrompt')?.value.trim() || '';
      startCreation(value);
    });
  }

  function boot() {
    let attempts = 0;
    const tick = () => {
      attempts += 1;
      if (!hasProject()) render();
      if (attempts < 80 && !document.querySelector('.px-public-home')) setTimeout(tick, 250);
    };
    tick();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();
})();
