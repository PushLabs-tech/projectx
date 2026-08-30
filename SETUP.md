# Project X v3 — real AI prototype

This package keeps the v2 UI, adds a secure `/api/ai` Worker route, and serves the frontend as static assets. The browser never needs the Gemini key.

## Fastest setup

1. Install Node.js 18+.
2. Open this folder in VS Code.
3. In the terminal run:

   npm install

4. For local AI, create a `.dev.vars` file using `.dev.vars.example` and put your Gemini key there.
5. Run:

   npm run dev

6. Open the local URL Wrangler prints.

## Cloudflare deployment

1. Log in:

   npx wrangler login

2. Add the Gemini secret server-side:

   npx wrangler secret put GEMINI_API_KEY

   Paste your key when prompted.

3. Deploy:

   npm run deploy

The Worker serves `/api/*` and the `public/` frontend together.

## No paid backend required for the prototype

The project also declares a Workers AI binding. If Gemini is not configured, the Worker can fall back to Cloudflare Workers AI where the selected model/account is available. Check Cloudflare's current model and free-allocation limits before relying on it for public traffic.

## Important

Never put a real API key into `public/app.js`, `index.html`, or any other browser-delivered file.
