(() => {
  'use strict';

  const C = window.BUILDER_CONFIG || {};
  const page = document.documentElement.dataset.page || 'app';
  const meta = {
    app: { title: 'Project X — Turn an idea, goal, or problem into something real', description: 'Tell Project X what is on your mind. Project X understands, adapts, and builds or guides you to the outcome.' },
    privacy: { title: 'Privacy Policy — Project X', description: 'Project X privacy policy and information about account, AI provider and data privacy.' },
    terms: { title: 'Terms of Service — Project X', description: 'Project X terms of service.' },
    thankyou: { title: 'Thank You — Project X', description: 'Your Project X account or payment flow has completed.' },
    billing: { title: 'Billing & Plans — Project X', description: 'Manage Project X plans, intelligence tiers and usage.' },
    '404': { title: 'Page Not Found — Project X', description: 'The Project X page you requested could not be found.' }
  }[page];

  if (meta) {
    document.title = meta.title;
    const description = document.querySelector('meta[name="description"]');
    if (description) description.content = meta.description;
    const ogTitle = document.querySelector('meta[property="og:title"]');
    if (ogTitle) ogTitle.content = meta.title;
    const ogDescription = document.querySelector('meta[property="og:description"]');
    if (ogDescription) ogDescription.content = meta.description;
  }

  const analyticsId = String(C.GA_MEASUREMENT_ID || '').trim();
  const consentKey = 'builder_analytics_consent_v1';

  function getConsent() {
    try { return localStorage.getItem(consentKey); } catch { return null; }
  }

  function saveConsent(value) {
    try { localStorage.setItem(consentKey, value); } catch {}
  }

  function loadAnalytics() {
    if (!analyticsId || window.__builderAnalyticsLoaded) return;
    window.__builderAnalyticsLoaded = true;
    window.dataLayer = window.dataLayer || [];
    window.gtag = function(){ window.dataLayer.push(arguments); };
    window.gtag('js', new Date());
    window.gtag('config', analyticsId, { anonymize_ip: true, send_page_view: true });
    const script = document.createElement('script');
    script.async = true;
    script.src = 'https://www.googletagmanager.com/gtag/js?id=' + encodeURIComponent(analyticsId);
    document.head.appendChild(script);
  }

  function installAnalyticsConsent() {
    if (page !== 'app' || !analyticsId || getConsent()) return;
    const banner = document.createElement('div');
    banner.className = 'cookie-banner';
    banner.innerHTML = '<div><strong>Privacy choices</strong><p>Project X uses essential storage for sign-in. Optional analytics is off until you allow it.</p></div><div class="cookie-actions"><button data-cookie="decline">Decline analytics</button><button class="cookie-accept" data-cookie="accept">Allow analytics</button></div>';
    document.body.appendChild(banner);
    banner.addEventListener('click', event => {
      const choice = event.target.closest('[data-cookie]')?.dataset.cookie;
      if (!choice) return;
      saveConsent(choice);
      if (choice === 'accept') loadAnalytics();
      banner.remove();
    });
  }

  function installSentinel() {
    const errors = [];
    const push = item => {
      errors.push(item);
      if (errors.length > 50) errors.shift();
      console.warn('[Project X Sentinel]', item);
    };
    window.addEventListener('error', event => push({
      type: 'error',
      message: event.message || String(event.error || 'Runtime error'),
      file: event.filename || '',
      line: event.lineno || 0,
      time: Date.now()
    }));
    window.addEventListener('unhandledrejection', event => push({
      type: 'rejection',
      reason: String(event.reason || 'Unhandled rejection'),
      time: Date.now()
    }));
    window.ProjectXPublicSentinel = {
      scan() {
        return { healthy: errors.length === 0, issues: errors.slice(-10), errorCount: errors.length, timestamp: new Date().toISOString() };
      },
      heal() {
        errors.length = 0;
        return { healed: true, summary: 'Runtime error buffer cleared' };
      }
    };
  }

  installSentinel();
  installAnalyticsConsent();

  window.BuilderSite = {
    track(name, params = {}) {
      if (window.gtag && getConsent() === 'accept') window.gtag('event', name, params);
    },
    setPageMeta(title, description) {
      if (title) document.title = title;
      const descriptionMeta = document.querySelector('meta[name="description"]');
      if (descriptionMeta && description) descriptionMeta.content = description;
      const ogTitle = document.querySelector('meta[property="og:title"]');
      if (ogTitle && title) ogTitle.content = title;
      const ogDescription = document.querySelector('meta[property="og:description"]');
      if (ogDescription && description) ogDescription.content = description;
    },
    sentinel: window.ProjectXPublicSentinel
  };
})();
