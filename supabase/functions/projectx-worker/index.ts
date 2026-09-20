const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-projectx-worker-token",
  "Access-Control-Allow-Methods": "POST, OPTIONS"
};

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const db = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false }
});

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...cors, "Content-Type": "application/json" }
  });
}

async function authorized(req: Request) {
  const token = req.headers.get("X-ProjectX-Worker-Token") || "";
  if (!token) return false;
  const { data, error } = await db.rpc("projectx_worker_token_valid", { p_token: token });
  return !error && data === true;
}

async function run() {
  const { data: jobs, error } = await db.rpc("claim_project_job", {
    p_worker: "supabase-cron",
    p_limit: 10
  });
  if (error) throw error;

  const results = [];
  for (const job of jobs || []) {
    try {
      const response = await fetch(`${SUPABASE_URL}/functions/v1/ai`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-ProjectX-Worker-Token": Deno.env.get("PROJECTX_WORKER_TOKEN") || ""
        },
        body: JSON.stringify({
          action: "runQueuedJob",
          userId: job.user_id,
          kind: job.kind,
          payload: job.payload
        })
      });
      const text = await response.text();
      let payload: any = {};
      try { payload = JSON.parse(text); } catch { payload = { raw: text.slice(0, 2000) }; }

      if (!response.ok || payload?.ok === false) {
        throw new Error(String(payload?.error || `AI worker returned HTTP ${response.status}`));
      }

      const { error: finishError } = await db.rpc("finish_project_job", {
        p_id: job.id,
        p_status: "succeeded",
        p_result: payload?.result ?? payload,
        p_error: null,
        p_retry_seconds: 60
      });
      if (finishError) throw finishError;
      results.push({ id: job.id, status: "succeeded" });
    } catch (error) {
      const { error: finishError } = await db.rpc("finish_project_job", {
        p_id: job.id,
        p_status: "failed",
        p_result: {},
        p_error: error instanceof Error ? error.message : String(error),
        p_retry_seconds: Math.min(900, 30 * Math.max(1, Number(job.attempts || 1)))
      });
      results.push({
        id: job.id,
        status: finishError ? "finish_error" : "failed"
      });
    }
  }
  return { ok: true, claimed: (jobs || []).length, results };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    if (req.method !== "POST" || !(await authorized(req))) return json({ ok: false, error: "Unauthorized" }, 401);

    // The worker token is only fetched inside the function process; it is never
    // committed to source control. This lets the worker authenticate to the AI
    // function without exposing a user session.
    const { data: secret, error: secretError } = await db.rpc("projectx_worker_token_get");
    if (secretError || !secret) throw new Error("Worker secret unavailable");
    Deno.env.set("PROJECTX_WORKER_TOKEN", String(secret));

    const body = await req.json().catch(() => ({}));
    const limit = Math.max(1, Math.min(10, Number(body?.limit || 10)));
    const result = await run(limit);
    return json({ ...result, requestedLimit: limit });
  } catch (error) {
    return json({ ok: false, error: error instanceof Error ? error.message : String(error) }, 500);
  }
});
