/* ProjectX public-page interactions. This module only enhances .px-public;
   the authenticated workspace runtime is not touched. */
(() => {
  'use strict';

  const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
  const wait = ms => new Promise(resolve => window.setTimeout(resolve, ms));

  const lifecycle = {
    intent: ['Intent', 'Start with the outcome the person wants—not a prescribed prompt format.'],
    understand: ['Understand', 'Clarify the goal, intended users, constraints, and what success should look like.'],
    plan: ['Plan', 'Turn the understanding into requirements, decisions, milestones, and a useful route forward.'],
    create: ['Create', 'Build the right kind of deliverable with the project context attached.'],
    verify: ['Verify', 'Inspect the result against observable requirements and identify gaps.'],
    ship: ['Ship', 'Prepare the finished work for the right release or handoff.'],
    improve: ['Improve', 'Use what happened to refine the project and choose the next useful step.']
  };

  const flowDescriptions = {
    intent: 'ProjectX starts by understanding the intended outcome, not by guessing what a prompt should contain.',
    understand: 'It clarifies the goal, users, constraints, and what a successful result means.',
    plan: 'It creates a blueprint with requirements, decisions, dependencies, and milestones.',
    create: 'It produces the right kind of work: software, documents, systems, research, or another deliverable.',
    verify: 'It checks what can actually be inspected and distinguishes verified work from assumptions.',
    ship: 'It prepares a release, export, or practical handoff appropriate to the project.',
    improve: 'It keeps the project context so the next change builds on what came before.'
  };

  const creationDescriptions = {
    website: 'Responsive websites, product pages, portfolios, and content experiences.',
    app: 'Web applications, internal tools, portals, and connected product experiences.',
    agent: 'AI agents with defined capabilities, context, tools, and permission boundaries.',
    automation: 'Workflows, triggers, branching logic, schedules, and integrations.',
    api: 'Backend services, APIs, data contracts, and application interfaces.',
    dashboard: 'Operational dashboards, analytics views, and decision-support tools.',
    game: 'Game concepts, mechanics, progression systems, and interactive experiences.',
    business: 'Business workflows, operating systems, launch plans, and customer processes.',
    research: 'Research questions, evidence organization, comparisons, and decision briefs.',
    documents: 'Specifications, reports, proposals, policies, and structured documents.',
    presentations: 'Presentations and visual narratives built around a clear message.',
    custom: 'A flexible project space for creations that do not fit a predefined category.'
  };

  const brainModules = {
    requirements: {
      title: 'Requirements',
      description: 'The project’s goals, constraints, acceptance criteria, priorities, and current state. Requirements describe what the finished outcome must satisfy.',
      items: ['Goals', 'Constraints', 'Acceptance criteria', 'Priorities']
    },
    decisions: {
      title: 'Decisions',
      description: 'A record of meaningful choices: what was selected, why it was selected, which alternatives were considered, and what consequences follow.',
      items: ['Chosen approach', 'Reasoning summary', 'Alternatives', 'Consequences']
    },
    architecture: {
      title: 'Architecture',
      description: 'The structural map of the project. Explore how major parts connect, then move from a broad system into a specific interface or component.',
      items: []
    },
    capabilities: {
      title: 'Capabilities',
      description: 'The capabilities a project needs and the ones it actually has available. A capability is not treated as active simply because it appears in a design.',
      items: ['Creation', 'Research', 'Agents', 'Testing', 'Deployment', 'Automation']
    },
    resources: {
      title: 'Resources',
      description: 'The assets and external systems a project uses, including files, APIs, repositories, AI models, and connected services.',
      items: ['Files', 'APIs', 'GitHub', 'Models', 'Integrations']
    },
    context: {
      title: 'Context',
      description: 'The relevant understanding that helps ProjectX keep work coherent: intent, preferences, constraints, research findings, and confirmed project facts.',
      items: ['Intent', 'Preferences', 'Constraints', 'Research', 'Confirmed facts']
    },
    history: {
      title: 'History',
      description: 'A connected account of how the project changed: requirements, decisions, versions, builds, tests, fixes, and the current state.',
      items: ['Idea', 'Requirement', 'Decision', 'Version', 'Build', 'Test', 'Fix', 'Current state']
    }
  };

  const architectureTree = {
    Architecture: {
      description: 'The top-level map of the system. Choose a major part to inspect.',
      children: ['Frontend', 'Backend', 'AI', 'Database']
    },
    Frontend: {
      description: 'The user-facing product: public experience, dashboard, workspace, and reusable interface components.',
      children: ['Landing', 'Dashboard', 'Workspace', 'Components']
    },
    Landing: {
      description: 'The public-facing experience that introduces ProjectX and guides a person into their first creation.',
      children: ['Hero', 'Purpose', 'Project Brain', 'Execution Loop']
    },
    Hero: {
      description: 'The first interaction: the message, creation composer, capability controls, and primary action.',
      children: ['Composer', 'Navigation', 'Capability controls']
    },
    Composer: {
      description: 'The intent entry point: a person describes the outcome, chooses a creation direction, and starts the real project flow.',
      children: ['Prompt field', 'Capability controls', 'Send action']
    },
    Backend: {
      description: 'Server-side functions and services that validate requests, protect credentials, coordinate AI, and perform supported operations.',
      children: ['Edge Functions', 'Authentication', 'Execution services']
    },
    AI: {
      description: 'The intelligence layer: model routing, provider adapters, specialist agents, and context-aware orchestration.',
      children: ['Model router', 'Specialists', 'Provider adapters']
    },
    Database: {
      description: 'The persistent project layer: structured project state, requirements, decisions, resources, versions, and activity.',
      children: ['Projects', 'Requirements', 'Decisions', 'Resources']
    },
    Dashboard: {
      description: 'A person’s overview of projects, activity, and their next useful actions.',
      children: ['Project list', 'Activity', 'Workspace entry']
    },
    Workspace: {
      description: 'The working environment that adapts to the selected project and creation type.',
      children: ['Assistant', 'Build tools', 'Preview', 'Files']
    },
    Components: {
      description: 'Reusable interface elements, interaction patterns, accessibility states, and responsive foundations.',
      children: ['Inputs', 'Navigation', 'Panels', 'Feedback']
    }
  };

  function mount(page) {
    if (!page || page.dataset.pxExperienceReady === 'true') return;
    page.dataset.pxExperienceReady = 'true';

    const $ = (selector, scope = page) => scope.querySelector(selector);
    const $$ = (selector, scope = page) => [...scope.querySelectorAll(selector)];

    // Capability shuffle: cycles the active creation direction and updates the composer.
    const capabilityButtons = $$('.pxl-chip-row [data-domain]');
    const input = $('#start-input');
    const shuffle = $('#pxl-shuffle');
    if (shuffle && capabilityButtons.length) {
      let previous = 0;
      shuffle.addEventListener('click', () => {
        let next = Math.floor(Math.random() * capabilityButtons.length);
        if (capabilityButtons.length > 1 && next === previous) next = (next + 1) % capabilityButtons.length;
        previous = next;
        capabilityButtons[next].click();
        shuffle.classList.remove('is-spinning');
        void shuffle.offsetWidth;
        shuffle.classList.add('is-spinning');
      });
    }

    // The seven-step explanation is selectable without navigating away.
    const lifecycleButtons = $$('[data-lifecycle-step]');
    const lifecycleDescription = $('#pxl-lifecycle-description');
    const selectLifecycle = key => {
      const entry = lifecycle[key];
      if (!entry) return;
      lifecycleButtons.forEach(button => button.setAttribute('aria-pressed', String(button.dataset.lifecycleStep === key)));
      if (lifecycleDescription) {
        lifecycleDescription.innerHTML = '<b>' + entry[0].toUpperCase() + '</b><p>' + entry[1] + '</p>';
      }
    };
    lifecycleButtons.forEach(button => button.addEventListener('click', () => selectLifecycle(button.dataset.lifecycleStep)));

    // Creation cards expand in place; they do not unexpectedly send the visitor into the app.
    $$('[data-creation-card]').forEach(button => {
      button.addEventListener('click', () => {
        const wasOpen = button.getAttribute('aria-expanded') === 'true';
        $$('[data-creation-card]').forEach(other => other.setAttribute('aria-expanded', 'false'));
        button.setAttribute('aria-expanded', String(!wasOpen));
      });
    });

    // Selectable explanation for the difference in the ProjectX lifecycle.
    const flowButtons = $$('[data-flow-stage]');
    const flowDescription = $('#pxl-flow-description');
    const selectFlow = key => {
      flowButtons.forEach(button => button.setAttribute('aria-pressed', String(button.dataset.flowStage === key)));
      if (flowDescription) flowDescription.textContent = flowDescriptions[key] || flowDescriptions.intent;
    };
    flowButtons.forEach(button => button.addEventListener('click', () => selectFlow(button.dataset.flowStage)));

    // The Brain modules are meaningful controls, not decorative labels.
    const brainStage = $('#pxl-brain-stage');
    const brainDetail = $('#pxl-brain-detail');
    const brainButtons = $$('[data-brain-module]');
    let activeModule = '';
    let architecturePath = [];

    const escapeHTML = value => String(value).replace(/[&<>"']/g, char => ({
      '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
    })[char]);

    function renderBrainDetail() {
      if (!brainDetail || !activeModule) return;
      const module = brainModules[activeModule];
      if (!module) return;

      let title = module.title;
      let description = module.description;
      let children = module.items;
      let isArchitecture = activeModule === 'architecture';

      if (isArchitecture) {
        const nodeName = architecturePath[architecturePath.length - 1] || 'Architecture';
        const node = architectureTree[nodeName] || { description: nodeName + ' is a nested part of ' + (architecturePath[architecturePath.length - 2] || 'the project architecture') + '. This layer can hold its own requirements, decisions, and resources.', children: [] };
        title = nodeName;
        description = node.description;
        children = node.children;
      }

      const breadcrumb = isArchitecture
        ? ['Architecture', ...architecturePath].join(' / ')
        : module.title;
      const childButtons = (children || []).map(child => {
        if (isArchitecture) return '<button type="button" data-brain-path="' + escapeHTML(child) + '">' + escapeHTML(child) + ' <span aria-hidden="true">↗</span></button>';
        return '<span class="pxl-brain-tag">' + escapeHTML(child) + '</span>';
      }).join('');

      brainDetail.innerHTML =
        '<div class="pxl-brain-detail-copy">' +
          '<span class="pxl-brain-detail-label">' + escapeHTML(breadcrumb.toUpperCase()) + '</span>' +
          '<h3>' + escapeHTML(title) + '</h3>' +
          '<p>' + escapeHTML(description) + '</p>' +
          '<div class="pxl-brain-drill">' + childButtons + '</div>' +
        '</div>' +
        (isArchitecture && architecturePath.length
          ? '<button class="pxl-brain-back" type="button" data-brain-back>← Back one layer</button>'
          : '<button class="pxl-brain-back" type="button" data-brain-reset>Return to Core</button>');
    }

    function selectBrainModule(key) {
      if (!brainModules[key]) return;
      activeModule = key;
      architecturePath = [];
      if (brainStage) {
        brainStage.classList.add('has-selection');
        brainStage.dataset.selected = key;
      }
      brainButtons.forEach(button => {
        const selected = button.dataset.brainModule === key;
        button.classList.toggle('is-selected', selected);
        button.setAttribute('aria-pressed', String(selected));
      });
      renderBrainDetail();
    }

    brainButtons.forEach(button => button.addEventListener('click', () => selectBrainModule(button.dataset.brainModule)));

    if (brainDetail) {
      brainDetail.addEventListener('click', event => {
        const pathButton = event.target.closest('[data-brain-path]');
        if (pathButton && activeModule === 'architecture') {
          architecturePath.push(pathButton.dataset.brainPath);
          renderBrainDetail();
          return;
        }
        if (event.target.closest('[data-brain-back]')) {
          architecturePath.pop();
          renderBrainDetail();
          return;
        }
        if (event.target.closest('[data-brain-reset]')) {
          activeModule = '';
          architecturePath = [];
          if (brainStage) {
            brainStage.classList.remove('has-selection');
            delete brainStage.dataset.selected;
          }
          brainButtons.forEach(button => {
            button.classList.remove('is-selected');
            button.setAttribute('aria-pressed', 'false');
          });
          brainDetail.innerHTML = '<div class="pxl-brain-detail-copy"><span class="pxl-brain-detail-label">PROJECT BRAIN / CORE</span><h3>Explore the project structure.</h3><p>Select a module to reveal what it contains. Architecture can be explored level by level.</p></div><span class="pxl-brain-detail-label">7 CONNECTED MODULES</span>';
        }
      });
    }

    // Cursor influence is intentionally tiny. Touch and reduced-motion users get stable geometry.
    if (!reducedMotion && window.matchMedia?.('(pointer:fine)').matches && brainStage) {
      brainStage.addEventListener('pointermove', event => {
        const rect = brainStage.getBoundingClientRect();
        const nx = (event.clientX - rect.left) / rect.width - .5;
        const ny = (event.clientY - rect.top) / rect.height - .5;
        brainStage.style.transform = 'perspective(1200px) rotateX(' + (-ny * 2.2).toFixed(2) + 'deg) rotateY(' + (nx * 3.2).toFixed(2) + 'deg)';

      }, { passive:true });
      brainStage.addEventListener('pointerleave', () => {
        brainStage.style.transform = '';

      });
    }

    // Execution loop: selectable stages, with an optional single guided pass.
    const loopButtons = $$('[data-loop-stage]');
    const loopDescription = $('#pxl-loop-description');
    const playLoop = $('#pxl-play-loop');
    const loopDescriptions = [
      'Create the first useful version of the intended outcome.',
      'Run the available checks against the result.',
      'Identify observable issues and missing requirements.',
      'Apply a targeted change to address the diagnosed issue.',
      'Run the affected checks again after the change.',
      'Confirm which requirements are satisfied and what remains uncertain.',
      'Prepare the appropriate release, export, or handoff.',
      'Use feedback and new information to choose the next improvement.'
    ];
    let playing = false;
    const selectLoopStage = index => {
      loopButtons.forEach((button, i) => {
        button.setAttribute('aria-pressed', String(i === index));
        button.classList.toggle('is-current', i === index);
      });
      if (loopDescription) loopDescription.textContent = loopDescriptions[index] || loopDescriptions[0];
    };
    loopButtons.forEach(button => button.addEventListener('click', () => {
      if (!playing) selectLoopStage(Number(button.dataset.loopStage));
    }));

    if (playLoop) {
      playLoop.addEventListener('click', async () => {
        if (playing) return;
        playing = true;
        playLoop.disabled = true;
        playLoop.textContent = reducedMotion ? 'Loop completed' : 'Playing the loop…';
        if (reducedMotion) {
          selectLoopStage(loopButtons.length - 1);
        } else {
          for (let index = 0; index < loopButtons.length; index++) {
            selectLoopStage(index);
            await wait(620);
          }
        }
        playLoop.disabled = false;
        playLoop.textContent = 'Play loop again';
        playing = false;
      });
    }


    // Reference-faithful entrance motion: each section reveals once as it enters the viewport.
    const revealTargets = $$('.pxl-reveal-up, .pxl-reveal-stagger');
    if (reducedMotion || !('IntersectionObserver' in window)) {
      revealTargets.forEach(el => el.classList.add('px-in-view'));
    } else {
      const revealObserver = new IntersectionObserver(entries => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            entry.target.classList.add('px-in-view');
            revealObserver.unobserve(entry.target);
          }
        });
      }, { threshold: .12, rootMargin: '0px 0px -8% 0px' });
      revealTargets.forEach(el => revealObserver.observe(el));
    }

    // Small pointer response on the hero glow keeps the otherwise-static composition alive.
    if (!reducedMotion && window.matchMedia?.('(pointer:fine)').matches) {
      const hero = $('.pxl-hero');
      const glow = $('.pxl-hero-glow');
      if (hero && glow) {
        hero.addEventListener('pointermove', event => {
          const rect = hero.getBoundingClientRect();
          const x = ((event.clientX - rect.left) / rect.width - .5) * 18;
          const y = ((event.clientY - rect.top) / rect.height - .5) * 10;
          glow.style.marginLeft = x.toFixed(1) + 'px';
          glow.style.marginTop = y.toFixed(1) + 'px';
        }, { passive:true });
        hero.addEventListener('pointerleave', () => { glow.style.marginLeft='0'; glow.style.marginTop='0'; });
      }
    }

    // Scroll-linked active navigation gives the continuous page a quiet sense of place.
    const sectionIds = ['pxl-hero','pxl-purpose','pxl-create','pxl-difference','pxl-experience','pxl-brain','pxl-execution','pxl-final'];
    const navLinks = $$('.pxl-links a');
    if ('IntersectionObserver' in window) {
      const sectionObserver = new IntersectionObserver(entries => {
        const visible = entries.filter(entry => entry.isIntersecting).sort((a,b) => b.intersectionRatio-a.intersectionRatio)[0];
        if (!visible) return;
        navLinks.forEach(link => link.classList.toggle('is-current', link.getAttribute('href') === '#' + visible.target.id));
      }, { threshold:[.18,.35,.55,.75], rootMargin:'-18% 0px -48% 0px' });
      sectionIds.map(id => $('#' + id)).filter(Boolean).forEach(section => sectionObserver.observe(section));
    }

    // Native anchor behavior is retained; this adds a small guard for empty fragments.
    page.addEventListener('click', event => {
      const link = event.target.closest('a[href^="#"]');
      if (!link) return;
      const target = page.querySelector(link.getAttribute('href'));
      if (!target) return;
      event.preventDefault();
      target.scrollIntoView({ behavior: reducedMotion ? 'auto' : 'smooth', block: 'start' });
      history.replaceState(null, '', link.getAttribute('href'));
    });
  }

  function scan() {
    const page = document.querySelector('#px-app.px-public .pxl-page');
    if (page) mount(page);
  }

  const observer = new MutationObserver(scan);
  observer.observe(document.documentElement, { childList:true, subtree:true });
  scan();
})();
