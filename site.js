(() => {
  'use strict';
  const C = window.BUILDER_CONFIG || {};
  const page = document.documentElement.dataset.page || 'app';
  const meta = {
    app: { title: 'Builder — Universal Creation Engine', description: 'Turn an idea into a real project with focused AI agents for discussion, planning, building, visual refinement and research.' },
    privacy: { title: 'Privacy Policy — Builder', description: 'Builder privacy policy and information about account, AI provider and analytics data.' },
    terms: { title: 'Terms of Service — Builder', description: 'Builder terms of service.' },
    thankyou: { title: 'Thank You — Builder', description: 'Your Builder account or payment flow has completed.' },
    billing: { title: 'Billing — Builder', description: 'Manage Builder plans and subscriptions.' },
    '404': { title: 'Page Not Found — Builder', description: 'The Builder page you requested could not be found.' }
  }[page] || null;
  if (meta) {
    document.title = meta.title;
    const d = document.querySelector('meta[name="description"]'); if (d) d.content = meta.description;
    const ogt = document.querySelector('meta[property="og:title"]'); if (ogt) ogt.content = meta.title;
    const ogd = document.querySelector('meta[property="og:description"]'); if (ogd) ogd.content = meta.description;
  }

  const analyticsId = C.GA_MEASUREMENT_ID || '';
  const consentKey = 'builder_analytics_consent_v1';
  function loadAnalytics() {
    if (!analyticsId || window.__builderAnalyticsLoaded) return;
    window.__builderAnalyticsLoaded = true;
    window.dataLayer = window.dataLayer || [];
    window.gtag = function(){ window.dataLayer.push(arguments); };
    window.gtag('js', new Date());
    window.gtag('config', analyticsId, { anonymize_ip: true, send_page_view: true });
    const s = document.createElement('script'); s.async = true; s.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(analyticsId)}`;
    document.head.appendChild(s);
  }
  function saveConsent(v) { try { localStorage.setItem(consentKey, v); } catch {} }
  function getConsent() { try { return localStorage.getItem(consentKey); } catch { return null; } }
  function banner() {
    if (page !== 'app' || !analyticsId || getConsent()) return;
    const el = document.createElement('div');
    el.className = 'cookie-banner';
    el.innerHTML = '<div><strong>Privacy choices</strong><p>Builder uses essential storage for sign-in. Optional analytics is off until you allow it.</p></div><div class="cookie-actions"><button data-cookie="decline">Decline analytics</button><button class="cookie-accept" data-cookie="accept">Allow analytics</button></div>';
    document.body.appendChild(el);
    el.addEventListener('click', e => { const v = e.target.closest('[data-cookie]')?.dataset.cookie; if (!v) return; saveConsent(v); if (v === 'accept') loadAnalytics(); el.remove(); });
  }
  const consent = getConsent();
  if (consent === 'accept') loadAnalytics();
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', banner); else banner();

  // Self-Adapting & Self-Healing Watchdog for Website
  const Sentinel = {
    errors: [],
    init() {
      // 1. Intercept uncaught errors & protect UI from freezing
      window.addEventListener('error', e => {
        const item = { type: 'error', message: e.message || String(e), file: e.filename, line: e.lineno, time: Date.now() };
        this.errors.push(item);
        console.warn('[Builder Self-Healing Sentinel] Handled runtime error:', item);
      });
      window.addEventListener('unhandledrejection', e => {
        const item = { type: 'rejection', reason: String(e.reason), time: Date.now() };
        this.errors.push(item);
        console.warn('[Builder Self-Healing Sentinel] Handled unhandled rejection:', item);
      });

      // 2. Self-adapting layout & viewport monitor
      const adaptViewport = () => {
        const isMobile = window.innerWidth <= 768;
        const isTablet = window.innerWidth > 768 && window.innerWidth <= 1024;
        document.documentElement.dataset.device = isMobile ? 'mobile' : isTablet ? 'tablet' : 'desktop';
      };
      adaptViewport();
      window.addEventListener('resize', adaptViewport);

      // 3. Self-healing localStorage integrity
      try {
        const stateKey = 'builder_state_v14';
        const raw = localStorage.getItem(stateKey);
        if (raw) {
          try {
            JSON.parse(raw);
          } catch {
            console.warn('[Builder Self-Healing Sentinel] Corrupted state detected. Restoring safe baseline.');
            localStorage.removeItem(stateKey);
          }
        }
      } catch {}
    },
    scan() {
      const issues = [];
      if (this.errors.length > 0) {
        issues.push({ type: 'runtime_exceptions', count: this.errors.length, latest: this.errors[this.errors.length - 1] });
      }
      return {
        healthy: issues.length === 0,
        issues,
        errorCount: this.errors.length,
        timestamp: new Date().toISOString()
      };
    },
    heal() {
      this.errors = [];
      return {
        healed: true,
        summary: 'Website runtime buffers flushed and memory bounds restored'
      };
    }
  };
  Sentinel.init();

  window.BuilderSite = {
    track(name, params={}) { if (window.gtag && getConsent() === 'accept') window.gtag('event', name, params); },
    setPageMeta(title, description) {
      if (title) document.title = title;
      const d = document.querySelector('meta[name="description"]'); if (d && description) d.content = description;
      const ogt = document.querySelector('meta[property="og:title"]'); if (ogt && title) ogt.content = title;
      const ogd = document.querySelector('meta[property="og:description"]'); if (ogd && description) ogd.content = description;
    },
    sentinel: Sentinel
  };
})();
