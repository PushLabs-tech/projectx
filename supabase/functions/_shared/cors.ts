const allowedOrigin = (Deno.env.get('APP_ORIGIN') || 'https://pushlabs-tech.github.io/projectx').trim().replace(/\/$/, '');

export const corsHeaders = {
  'Access-Control-Allow-Origin': allowedOrigin || 'null',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Vary': 'Origin',
  'Content-Type': 'application/json',
};

export function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: corsHeaders });
}
