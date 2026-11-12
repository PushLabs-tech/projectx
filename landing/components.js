const icon = (name, extraClass = '') =>
  '<i class="icon ' + extraClass + '" data-lucide="' + name + '" aria-hidden="true"></i>';
const asset = (name) => new URL(`../landing-assets/${name}`, import.meta.url).href;

const createItems = [
  ['Websites', 'layers'],
  ['Apps', 'layout-grid'],
  ['AI Agents', 'sparkles'],
  ['Automations', 'zap'],
  ['APIs', 'code-xml'],
  ['Dashboards', 'chart-no-axes-column-increasing'],
  ['Games', 'gamepad-2'],
  ['Business Systems', 'briefcase-business'],
  ['Research', 'search'],
  ['Documents', 'file-text'],
  ['Presentations', 'presentation'],
  ['Custom Projects', 'layers-3'],
];

const formatButtons = [
  ['Website', 'layers', 'website'],
  ['App', 'layout-grid', 'app'],
  ['Agent', 'sparkles', 'agent'],
  ['Automation', 'zap', 'automation'],
];

const purposeNodes = [
  ['Intent', 'target', 'node-intent'],
  ['Understand', 'lightbulb', 'node-understand'],
  ['Plan', 'list-checks', 'node-plan'],
  ['Create', 'code-xml', 'node-create'],
  ['Verify', 'shield-check', 'node-verify'],
  ['Ship', 'rocket', 'node-ship'],
  ['Improve', 'chart-no-axes-column-increasing', 'node-improve'],
];

const brainNodes = [
  ['Decisions', 'circle-check', 'brain-decisions'],
  ['Requirements', 'list-checks', 'brain-requirements'],
  ['Context', 'layers-3', 'brain-context'],
  ['Resources', 'folder-open', 'brain-resources'],
  ['Architecture', 'sparkles', 'brain-architecture'],
  ['Progress', 'workflow', 'brain-progress'],
  ['History', 'database', 'brain-history'],
  ['Constraints', 'file-lock-2', 'brain-constraints'],
];

const loopSteps = [
  ['Build', 'code-xml', 0, 'loop-build'],
  ['Test', 'flask-conical', 1, 'loop-test'],
  ['Diagnose', 'activity', 2, 'loop-diagnose'],
  ['Fix', 'wrench', 3, 'loop-fix'],
  ['Improve', 'chart-no-axes-column-increasing', 7, 'loop-improve'],
  ['Ship', 'rocket', 6, 'loop-ship'],
  ['Verify', 'shield-check', 5, 'loop-verify'],
  ['Retest', 'refresh-cw', 4, 'loop-retest'],
];

function renderNode([label, iconName, className]) {
  return '<div class="diagram-node ' + className + '">' +
    icon(iconName, 'node-icon') + '<span>' + label + '</span></div>';
}

function renderCreateTile([label, iconName]) {
  return '<article class="create-tile">' + icon(iconName, 'tile-icon') + '<span>' + label + '</span></article>';
}

function renderBrainNode([label, iconName, className]) {
  return '<div class="brain-node ' + className + '">' +
    icon(iconName, 'node-icon') + '<span>' + label + '</span></div>';
}

function renderLoopStep([label, iconName, order, className]) {
  return '<div class="loop-step ' + className + '" style="--flow-order:' + order + '">' +
    '<span class="loop-icon-wrap">' + icon(iconName, 'loop-icon') + '</span>' +
    '<span class="loop-label">' + label + '</span></div>';
}

export function Header() {
  return [
    '<header class="site-header">',
    '<a class="brand" href="#top" aria-label="ProjectX home"><img src="' + asset('projectx-logo.webp') + '" width="190" height="48" alt="ProjectX" /></a>',
    '<button class="menu-toggle" type="button" aria-expanded="false" aria-controls="main-nav" aria-label="Open navigation">' +
      icon('menu', 'menu-open-icon') + icon('x', 'menu-close-icon') +
    '</button>',
    '<nav class="main-nav" id="main-nav" aria-label="Main navigation">',
    '<a href="#create">Product</a>',
    '<button type="button" data-app-action="pricing">Pricing</button>',
    '<button type="button" data-app-action="docs">Docs</button>',
    '<a href="#footer-resources">Resources</a>',
    '<div class="nav-mobile-actions"><button type="button" data-app-action="login">Log in</button>' +
      '<button class="button button-dark" type="button" data-app-action="get-started">Get Started ' + icon('arrow-right') + '</button></div>',
    '</nav>',
    '<div class="header-actions"><button type="button" class="login-button" data-app-action="login">Log in</button>' +
      '<button type="button" class="button button-dark" data-app-action="get-started">Get Started ' + icon('arrow-right') + '</button></div>',
    '</header>',
  ].join('');
}

export function Hero() {
  const chips = formatButtons.map(([label, iconName, kind]) =>
    '<button class="format-chip" type="button" data-format="' + kind + '" aria-pressed="false">' +
      icon(iconName, 'format-icon') + '<span>' + label + '</span></button>'
  ).join('');

  return [
    '<section class="hero-section wave-surface" id="top" aria-labelledby="hero-title">',
    '<div class="hero-content">',
    '<div class="hero-badge" data-reveal><img src="' + asset('projectx-mark.webp') + '" width="24" height="23" alt="" /><span>The Universal Creation Engine</span></div>',
    '<h1 id="hero-title" data-reveal>Turn any idea into<br />a <em>real product.</em></h1>',
    '<p class="hero-description" data-reveal>An AI platform that understands your intent, <strong>plans, builds,</strong><br class="desktop-break" /> executes, and helps you ship — <strong>anything.</strong></p>',
    '<form class="prompt-box" id="idea-form" data-reveal aria-label="Describe your idea">',
    '<input id="idea-input" type="text" placeholder="What do you want to create?" autocomplete="off" />',
    '<div class="prompt-controls">',
    '<button class="icon-button" type="button" aria-label="Attach a file" data-app-action="attachment">' + icon('paperclip') + '</button>',
    '<button class="icon-button" type="button" aria-label="Prompt options" data-app-action="prompt-options">' + icon('sliders-horizontal') + '</button>',
    '<button class="submit-idea" type="submit" aria-label="Save your idea on this page">' + icon('arrow-up') + '</button>',
    '</div></form>',
    '<p class="prompt-status" id="idea-status" role="status" aria-live="polite"></p>',
    '<div class="format-row" data-reveal>' + chips +
      '<button class="refresh-button" type="button" aria-label="Reset idea and selection" data-action="refresh">' + icon('refresh-cw') + '</button></div>',
    '</div></section>',
  ].join('');
}

export function PurposeSection() {
  return [
    '<section class="story-section purpose-section" id="purpose" aria-labelledby="purpose-title">',
    '<div class="section-container split-layout">',
    '<div class="copy-column" data-reveal><p class="eyebrow"><span></span>PROJECTX</p>',
    '<h2 id="purpose-title">Your idea is only<br />the <em>beginning.</em></h2>',
    '<p class="section-copy">ProjectX turns human intent into real, working, measurable outcomes — from the first thought to something you can actually ship.</p>',
    '<a class="button button-outline" href="#loop">How it works ' + icon('arrow-right') + '</a></div>',
    '<div class="purpose-map" data-reveal aria-label="ProjectX creation process">' +
      purposeNodes.map(renderNode).join('') +
      '<img class="stack-art" src="' + asset('projectx-stack.webp') + '" width="420" height="420" alt="A glowing stack of creation layers with the ProjectX mark" />' +
    '</div></div></section>',
  ].join('');
}

export function CreateSection() {
  return [
    '<section class="story-section create-section" id="create" aria-labelledby="create-title">',
    '<div class="section-container split-layout">',
    '<div class="copy-column" data-reveal><p class="eyebrow"><span></span></p>',
    '<h2 id="create-title">One engine.<br />Almost <em>any creation.</em></h2>',
    '<p class="section-copy">From simple tools to full-scale systems, ProjectX adapts to your goal and builds what you need.</p></div>',
    '<div class="create-grid" data-reveal aria-label="Things you can create">' + createItems.map(renderCreateTile).join('') + '</div>',
    '</div></section>',
  ].join('');
}

export function DifferenceSection() {
  const workflow = [
    ['Intent', 'lightbulb'],
    ['Understand', 'brain'],
    ['Plan', 'list-checks'],
    ['Create', 'code-xml'],
    ['Test & Verify', 'badge-check'],
    ['Ship', 'rocket'],
    ['Improve', 'chart-no-axes-column-increasing'],
  ];

  return [
    '<section class="story-section difference-section" id="difference" aria-labelledby="difference-title">',
    '<div class="section-container split-layout">',
    '<div class="copy-column" data-reveal><p class="eyebrow"><span></span>THE DIFFERENCE</p>',
    '<h2 id="difference-title">It doesn’t just<br />generate. It <em>understands.</em></h2>',
    '<p class="section-copy">Most AI tools stop at creating output. ProjectX goes further — it understands your goal, plans the right approach, executes the work, verifies the result, and keeps improving it.</p></div>',
    '<div class="comparison" data-reveal>',
    '<article class="comparison-card tools-card"><h3>Most AI tools</h3><div class="basic-flow">',
    '<div class="basic-flow-step">' + icon('message-circle') + '<span>Prompt</span></div>' + icon('arrow-down', 'flow-arrow'),
    '<div class="basic-flow-step">' + icon('settings-2') + '<span>Generate</span></div>' + icon('arrow-down', 'flow-arrow'),
    '<div class="basic-flow-step">' + icon('circle-check') + '<span>Done</span></div>',
    '</div></article>',
    '<article class="comparison-card projectx-card"><img class="comparison-brand" src="' + asset('projectx-logo.webp') + '" width="128" height="32" alt="ProjectX" />',
    '<ul class="projectx-steps">' + workflow.map(([label, iconName]) =>
      '<li>' + icon(iconName) + '<span>' + label + '</span></li>'
    ).join('') + '</ul></article>',
    '</div></div></section>',
  ].join('');
}

export function ExperienceSection() {
  return [
    '<section class="story-section experience-section" id="experience" aria-labelledby="experience-title">',
    '<div class="section-container split-layout">',
    '<div class="copy-column" data-reveal><p class="eyebrow"><span></span>THE EXPERIENCE</p>',
    '<h2 id="experience-title">From conversation<br />to <em>creation.</em></h2>',
    '<p class="section-copy">Turn your idea into a real project inside a focused workspace — with plan, files, code, preview, and everything in one place.</p>',
    '<button class="button button-outline" type="button" data-app-action="workspace">See the workspace ' + icon('arrow-right') + '</button></div>',
    '<div class="workspace-frame" id="experience-preview" data-reveal><img src="' + asset('projectx-workspace.webp') + '" width="830" height="414" alt="ProjectX workspace showing a productivity app project, its plan, and generated files" /></div>',
    '</div></section>',
  ].join('');
}

export function BrainSection() {
  return [
    '<section class="story-section brain-section" id="brain" aria-labelledby="brain-title">',
    '<div class="section-container split-layout">',
    '<div class="copy-column" data-reveal><p class="eyebrow"><span></span>PROJECT BRAIN</p>',
    '<h2 id="brain-title">One project.<br />One <em>persistent brain.</em></h2>',
    '<p class="section-copy">ProjectX keeps the full context of your project — decisions, requirements, resources, architecture, progress, and history — so you can build, iterate, and scale without losing what matters.</p></div>',
    '<div class="brain-map" data-reveal aria-label="Project knowledge kept together">' +
      brainNodes.map(renderBrainNode).join('') +
      '<img class="stack-art" src="' + asset('projectx-stack.webp') + '" width="420" height="420" alt="A glowing stack of connected project information" />' +
    '</div></div></section>',
  ].join('');
}

export function LoopSection() {
  return [
    '<section class="story-section loop-section" id="loop" aria-labelledby="loop-title">',
    '<div class="section-container split-layout">',
    '<div class="copy-column" data-reveal><p class="eyebrow"><span></span>THE EXECUTION LOOP</p>',
    '<h2 id="loop-title">Build it. Test it.<br />Make it <em>better.</em></h2>',
    '<p class="section-copy">A continuous loop that helps you go from idea to a reliable, real-world outcome.</p></div>',
    '<div class="loop-board" data-reveal aria-label="Build, test, diagnose, fix, retest, verify, ship, improve">',
    loopSteps.map(renderLoopStep).join(''),
    '<span class="loop-arrow arrow-build-test">' + icon('arrow-right') + '</span>',
    '<span class="loop-arrow arrow-test-diagnose">' + icon('arrow-right') + '</span>',
    '<span class="loop-arrow arrow-diagnose-fix">' + icon('arrow-right') + '</span>',
    '<span class="loop-arrow arrow-fix-retest">' + icon('corner-down-left') + '</span>',
    '<span class="loop-arrow arrow-retest-verify">' + icon('arrow-left') + '</span>',
    '<span class="loop-arrow arrow-verify-ship">' + icon('arrow-left') + '</span>',
    '<span class="loop-arrow arrow-ship-improve">' + icon('arrow-left') + '</span>',
    '<span class="loop-arrow arrow-improve-build">' + icon('corner-up-left') + '</span>',
    '</div></div></section>',
  ].join('');
}

export function FinalCTAAndFooter() {
  const footerLink = (label, action) =>
    '<button class="footer-link" type="button" data-app-action="' + action + '">' + label + '</button>';

  return [
    '<section class="closing-section wave-surface" id="final-cta" aria-labelledby="closing-title">',
    '<div class="closing-content" data-reveal>',
    '<div class="closing-badge"><img src="' + asset('projectx-mark.webp') + '" width="16" height="15" alt="" /><span>Have an idea?</span></div>',
    '<h2 id="closing-title">Turn it into something <em>real.</em></h2>',
    '<p>Start creating with ProjectX and take your idea from thought to outcome.</p>',
    '<div class="closing-actions"><button class="button button-dark" type="button" data-app-action="get-started">Get Started ' + icon('arrow-right') + '</button>',
    '<button class="button button-outline" type="button" data-app-action="pricing">See Pricing</button></div></div>',
    '<footer class="site-footer"><div class="footer-grid">',
    '<div class="footer-brand"><a class="brand" href="#top" aria-label="ProjectX home"><img src="' + asset('projectx-logo.webp') + '" width="190" height="48" alt="ProjectX" /></a><p>The Universal Creation Engine.</p></div>',
    '<div class="footer-column"><h3>Product</h3><a href="#top">Overview</a><a href="#experience">Workspace</a><a href="#brain">Project Brain</a></div>',
    '<div class="footer-column" id="footer-resources"><h3>Resources</h3>' + footerLink('Docs', 'docs') + footerLink('Guides', 'guides') + footerLink('API', 'api') + '</div>',
    '<div class="footer-column"><h3>Company</h3>' + footerLink('About', 'about') + footerLink('Changelog', 'changelog') + footerLink('Contact', 'contact') + '</div>',
    '<div class="footer-column footer-updates"><h3>Stay updated</h3>',
    '<form class="email-form" id="email-form"><label class="sr-only" for="email-input">Enter your email</label>',
    '<input id="email-input" name="email" type="email" placeholder="Enter your email" required />',
    '<button type="submit" aria-label="Submit email">' + icon('plus') + '</button></form>',
    '<p class="form-status" id="email-status" role="status" aria-live="polite"></p></div>',
    '</div><div class="footer-bottom"><p>© 2026 ProjectX, All rights reserved.</p>',
    '<div class="legal-links"><a class="footer-link" href="./privacy.html">Privacy</a><a class="footer-link" href="./terms.html">Terms</a>' + footerLink('Status', 'status') + '</div>',
    '</div></footer></section>',
  ].join('');
}
