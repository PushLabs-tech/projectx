export const SANDBOX_POLICY_VERSION = 2;
export const SANDBOX_CSP = "default-src 'none'; script-src 'unsafe-inline' data: blob:; style-src 'unsafe-inline' data:; img-src data: blob:; font-src data:; media-src data: blob:; connect-src 'none'; frame-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'; worker-src 'none'";
const CAP = 48;
const clampText = (value, max = 900) => String(value ?? '').slice(0, max);
const RUNTIME_SCRIPT = "(function(){\n  const policyVersion = __POLICY__;\n  const strict = __STRICT__;\n  const startedAt = performance.now();\n  const events = [];\n  const emit = (kind, payload) => {\n    if (events.length >= __CAP__) return;\n    const event = { kind, at: Math.round(performance.now() - startedAt), ...payload };\n    events.push(event);\n    try {\n      parent.postMessage({ type: 'PROJECTX_SANDBOX_EVENT', policyVersion, strict, event }, '*');\n    } catch {}\n  };\n  const stringify = value => {\n    try {\n      if (value instanceof Error) return value.message || String(value);\n      if (typeof value === 'string') return value;\n      return JSON.stringify(value);\n    } catch { return String(value); }\n  };\n  const describeNode = node => node && node.tagName ? {\n    tag: String(node.tagName).toLowerCase(),\n    src: String(node.src || '').slice(0, 300),\n    href: String(node.href || '').slice(0, 300)\n  } : {};\n  const safeError = (message, source, line, column) => ({\n    message: String(message || 'Runtime error').slice(0, 1200),\n    source: String(source || '').slice(0, 300),\n    line: Number(line || 0),\n    column: Number(column || 0)\n  });\n\n  window.addEventListener('error', function(e){\n    if (e.target && e.target !== window) emit('resource_error', describeNode(e.target));\n    else emit('runtime_error', safeError(e.message, e.filename, e.lineno, e.colno));\n  }, true);\n\n  window.addEventListener('unhandledrejection', function(e){\n    emit('unhandled_rejection', { message: String(stringify(e.reason)).slice(0, 1200) });\n  });\n\n  ['error','warn'].forEach(name => {\n    const original = console[name];\n    console[name] = function(){\n      const values = Array.from(arguments).slice(0, 6).map(stringify);\n      emit(name === 'error' ? 'console_error' : 'console_warn', {\n        message: values.join(' | ').slice(0, 1200)\n      });\n      try { return original.apply(console, arguments); } catch {}\n    };\n  });\n\n  if (strict && typeof window.fetch === 'function') {\n    const originalFetch = window.fetch.bind(window);\n    window.fetch = function(){\n      const input = arguments[0];\n      const url = typeof input === 'string' ? input : String(input && input.url || '');\n      emit('network_attempt', {\n        method: String(arguments[1] && arguments[1].method || 'GET').toUpperCase(),\n        url: url.slice(0, 500)\n      });\n      return originalFetch.apply(window, arguments);\n    };\n  }\n\n  if (strict && window.XMLHttpRequest) {\n    const open = XMLHttpRequest.prototype.open;\n    XMLHttpRequest.prototype.open = function(method, url){\n      emit('network_attempt', {\n        method: String(method || 'GET').toUpperCase(),\n        url: String(url || '').slice(0, 500)\n      });\n      return open.apply(this, arguments);\n    };\n  }\n\n  if (strict) {\n    window.open = function(url){\n      emit('popup_attempt', { url: String(url || '').slice(0, 400) });\n      return null;\n    };\n    document.addEventListener('submit', () => emit('form_attempt', {}), true);\n    document.addEventListener('click', function(e){\n      const anchor = e.target && e.target.closest ? e.target.closest('a') : null;\n      if (anchor && (anchor.target === '_blank' || (anchor.rel || '').includes('external'))) {\n        emit('external_navigation_attempt', { href: String(anchor.href || '').slice(0, 500) });\n      }\n    }, true);\n  }\n\n  const summarize = phase => ({\n    phase,\n    readyState: String(document.readyState || ''),\n    title: String(document.title || '').slice(0, 200),\n    elementCount: document.querySelectorAll('*').length,\n    bodyTextLength: String(document.body && document.body.innerText || '').trim().length,\n    events: events.length,\n    loadMs: Math.round(performance.now() - startedAt)\n  });\n\n  window.addEventListener('load', () => emit('ready', summarize('load')));\n  setTimeout(() => emit('heartbeat', summarize('post-load')), 1000);\n  if (document.readyState === 'complete') emit('ready', summarize('complete'));\n})();";
export function createSandboxRuntimeScript(options = {}) {
  const strict = Boolean(options.strict);
  const body = RUNTIME_SCRIPT.replaceAll('__POLICY__', String(SANDBOX_POLICY_VERSION)).replace('__STRICT__', strict ? 'true' : 'false').replace('__CAP__', String(CAP));
  const cspTag = strict ? '<meta http-equiv="Content-Security-Policy" content="' + SANDBOX_CSP.replace(/"/g, '&quot;') + '">' : '';
  return cspTag + '<script data-projectx-sandbox="v' + SANDBOX_POLICY_VERSION + '">' + body + '</script>';
}
export function classifySandboxEvent(event = {}) {
  const kind = String(event?.kind || '');
  if (['runtime_error','unhandled_rejection'].includes(kind)) return 'critical';
  if (kind === 'console_error') return 'error';
  if (kind === 'resource_error') {
    const url = String(event?.url || event?.src || event?.href || '');
    return /^https?:\/\//i.test(url) ? 'warning' : 'error';
  }
  if (['network_attempt','popup_attempt','form_attempt','external_navigation_attempt','console_warn'].includes(kind)) return 'warning';
  return 'info';
}
export function summarizeSandboxEvents(events = []) {
  const normalized = (Array.isArray(events) ? events : []).slice(0, CAP).map(event => ({
    kind: String(event?.kind || 'unknown').slice(0, 80),
    severity: classifySandboxEvent(event),
    at: Math.max(0, Number(event?.at || 0)),
    message: clampText(event?.message || '', 1200),
    source: clampText(event?.source || '', 300),
    tag: clampText(event?.tag || '', 80),
    url: clampText(event?.url || event?.src || event?.href || '', 500),
    line: Number(event?.line || 0),
    column: Number(event?.column || 0)
  }));
  const counts = normalized.reduce((acc, event) => { acc[event.kind] = Number(acc[event.kind] || 0) + 1; return acc; }, {});
  const critical = normalized.filter(event => event.severity === 'critical');
  const errors = normalized.filter(event => event.severity === 'error');
  const warnings = normalized.filter(event => event.severity === 'warning');
  return { policyVersion: SANDBOX_POLICY_VERSION, passed: critical.length === 0 && errors.length === 0, eventCount: normalized.length, counts, criticalCount: critical.length, errorCount: errors.length, warningCount: warnings.length, events: normalized.slice(-32) };
}
export function sandboxFrameAttributes() { return { sandbox:'allow-scripts', referrerpolicy:'no-referrer' }; }