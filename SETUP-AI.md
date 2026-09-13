# AI Provider Setup — Builder V7

## Supported providers
- Bytez
- NVIDIA NIM
- OpenRouter
- OpenAI
- Google Gemini (OpenAI-compatible endpoint)
- Anthropic
- Generic OpenAI-compatible

## NVIDIA NIM
NVIDIA NIM uses the OpenAI-compatible endpoint `https://integrate.api.nvidia.com/v1`. Builder validates the key server-side by calling the model catalog before saving it, then discovers models for Auto routing. NVIDIA documents its chat endpoint at `https://integrate.api.nvidia.com/v1/chat/completions`.

If a key fails, Builder now shows the provider error instead of silently storing a broken connection.

## Security
Provider keys are encrypted by the Supabase Edge Function. Do not put provider secrets into `config.js`, frontend JavaScript, GitHub Pages, or `.env` files committed to Git.
