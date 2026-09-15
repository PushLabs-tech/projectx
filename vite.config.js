import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import { handleGenerateCode } from './api-service.js';

const __dirname = fileURLToPath(new URL('.', import.meta.url));

function geminiApiPlugin() {
  const handler = async (req, res, next) => {
    if (req.url?.startsWith('/api/ai/generate') && req.method === 'POST') {
      let body = '';
      req.on('data', chunk => { body += chunk; });
      req.on('end', async () => {
        try {
          const payload = JSON.parse(body || '{}');
          const result = await handleGenerateCode(payload);
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ ok: true, result }));
        } catch (err) {
          console.error('[API Error]', err);
          res.statusCode = 500;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ ok: false, error: err.message || 'AI Generation error' }));
        }
      });
      return;
    }
    if (req.url?.startsWith('/api/ai/ping')) {
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ ok: true, status: 'ready' }));
      return;
    }
    next();
  };

  return {
    name: 'gemini-api-plugin',
    configureServer(server) {
      server.middlewares.use(handler);
    },
    configurePreviewServer(server) {
      server.middlewares.use(handler);
    }
  };
}

export default defineConfig({
  base: '/',
  plugins: [geminiApiPlugin()],
  resolve: {
    alias: [
      {
        find: './universal-engine.js',
        replacement: resolve(__dirname, 'universal-engine-fixed.js')
      }
    ]
  },
  server: {
    host: '0.0.0.0',
    port: 3000,
    allowedHosts: true,
  },
  preview: {
    host: '0.0.0.0',
    port: 3000,
    allowedHosts: true,
  },
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        billing: resolve(__dirname, 'billing.html'),
        privacy: resolve(__dirname, 'privacy.html'),
        terms: resolve(__dirname, 'terms.html'),
        thankyou: resolve(__dirname, 'thank-you.html'),
        notFound: resolve(__dirname, '404.html'),
      },
    },
  },
});

