(() => {
  'use strict';
  if (window.__pxGeminiGuardInstalled) return;
  window.__pxGeminiGuardInstalled = true;

  const GENERATE_RE = /generativelanguage\.googleapis\.com\/v1beta\/models\/([^:]+):generateContent/;
  const FALLBACK_MODELS = ['gemini-3.5-flash-lite', 'gemini-2.5-flash-lite', 'gemini-2.5-flash'];
  const MIN_GAP_MS = 900;
  const RETRY_DELAYS = [1200, 2500];
  let lastRequestAt = 0;
  let queue = Promise.resolve();

  const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

  function isGeminiRequest(input) {
    const url = typeof input === 'string' ? input : input?.url || '';
    return GENERATE_RE.test(url);
  }

  function modelFrom(url) {
    const match = String(url).match(GENERATE_RE);
    return match ? match[1] : '';
  }

  function urlForModel(url, model) {
    return String(url).replace(GENERATE_RE, `generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`);
  }

  async function spacedRequest(originalFetch, input, init, bodyText, modelOverride) {
    const sourceUrl = typeof input === 'string' ? input : input?.url || '';
    const model = modelOverride || modelFrom(sourceUrl);
    const requestUrl = modelOverride ? urlForModel(sourceUrl, modelOverride) : sourceUrl;

    const now = Date.now();
    const waitForGap = Math.max(0, MIN_GAP_MS - (now - lastRequestAt));
    if (waitForGap) await sleep(waitForGap);
    lastRequestAt = Date.now();

    return originalFetch(requestUrl, {
      ...(init || {}),
      body: bodyText,
    });
  }

  function trimBody(bodyText) {
    try {
      const body = JSON.parse(bodyText);
      if (Array.isArray(body.contents)) {
        body.contents = body.contents.slice(-10).map(item => {
          const next = {...item};
          if (Array.isArray(next.parts)) {
            next.parts = next.parts.map(part => {
              const p = {...part};
              if (typeof p.text === 'string' && p.text.length > 6000) p.text = p.text.slice(-6000);
              return p;
            });
          }
          return next;
        });
      }
      if (body.generationConfig) {
        body.generationConfig = {...body.generationConfig, maxOutputTokens: Math.min(body.generationConfig.maxOutputTokens || 4096, 4096)};
      }
      return JSON.stringify(body);
    } catch {
      return bodyText;
    }
  }

  function showRateLimitNotice() {
    const existing = document.getElementById('px-ai-rate-notice');
    if (existing) return;
    const el = document.createElement('div');
    el.id = 'px-ai-rate-notice';
    el.style.cssText = 'position:fixed;left:50%;bottom:22px;transform:translateX(-50%);z-index:2147483646;background:#171a1f;color:#fff;border-radius:10px;padding:10px 14px;font:12px/1.4 system-ui,sans-serif;box-shadow:0 8px 28px rgba(0,0,0,.18);max-width:min(520px,calc(100vw - 28px));text-align:center';
    el.textContent = 'Gemini is temporarily rate-limited. ProjectX is retrying with a lighter model; your API key is still connected.';
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 6500);
  }

  const originalFetch = window.fetch.bind(window);

  window.fetch = function guardedFetch(input, init = {}) {
    if (!isGeminiRequest(input)) return originalFetch(input, init);

    queue = queue.then(async () => {
      const originalBody = init?.body;
      const bodyText = typeof originalBody === 'string' ? trimBody(originalBody) : originalBody;
      const originalUrl = typeof input === 'string' ? input : input.url;
      const originalModel = modelFrom(originalUrl);
      const attempted = new Set();
      let response = await spacedRequest(originalFetch, input, init, bodyText);

      if (response.ok || response.status !== 429) return response;

      showRateLimitNotice();

      for (const delay of RETRY_DELAYS) {
        await sleep(delay);
        response = await spacedRequest(originalFetch, input, init, bodyText);
        if (response.ok || response.status !== 429) return response;
      }

      attempted.add(originalModel);
      for (const fallbackModel of FALLBACK_MODELS) {
        if (attempted.has(fallbackModel)) continue;
        attempted.add(fallbackModel);
        response = await spacedRequest(originalFetch, input, init, bodyText, fallbackModel);
        if (response.ok || response.status !== 429) return response;
      }

      return response;
    });

    return queue;
  };
})();
