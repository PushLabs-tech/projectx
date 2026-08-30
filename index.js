const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Access-Control-Allow-Methods": "POST, OPTIONS"
};

const PROFILE_MODELS = {
  Auto: "gemini-2.5-flash",
  Fast: "gemini-2.5-flash-lite",
  Reasoning: "gemini-2.5-pro",
  Builder: "gemini-2.5-flash",
  Premium: "gemini-2.5-pro"
};

const SYSTEM = `You are the intelligence engine for Project X, an ambition-to-execution platform.
Your job is to turn a user's real-world ambition into a practical, ready-to-use project system.
Do not merely give generic advice. Think in terms of goals, systems, software, assets, tasks, milestones, launch requirements, and next actions.
When asked to build, propose concrete things the platform can create. Never claim an external action was completed when it was not.
Prefer a minimum useful system first, then expansion.
For blueprint requests, return ONLY valid JSON matching the requested schema.`;

function json(data, status=200) {
  return new Response(JSON.stringify(data), { status, headers: { "Content-Type":"application/json", ...CORS }});
}

function cleanJson(text) {
  const s = String(text || "").trim();
  try { return JSON.parse(s); } catch {}
  const fenced = s.match(/```(?:json)?\\s*([\\s\\S]*?)```/i);
  if (fenced) { try { return JSON.parse(fenced[1]); } catch {} }
  const first = s.indexOf("{");
  const last = s.lastIndexOf("}");
  if (first >= 0 && last > first) { try { return JSON.parse(s.slice(first,last+1)); } catch {} }
  return null;
}

function buildPrompt(body) {
  const mode = body.mode || "Build";
  const profile = body.model || "Auto";
  const ambition = body.prompt || "";
  const project = body.project || {};
  const attachments = Array.isArray(body.attachments) ? body.attachments : [];
  const attachmentText = attachments.map(a => `- ${a.name || "file"} (${a.kind || "file"}, ${a.size || 0} bytes)`).join("\\n");

  if (body.action === "blueprint") {
    return `${SYSTEM}\n\nReturn ONLY JSON in this exact shape:\n{\n  "name":"string",\n  "type":"string",\n  "goal":"string",\n  "summary":"string",\n  "systems":[{"name":"string","purpose":"string","outputs":["string"]}],\n  "milestones":[{"name":"string","detail":"string"}],\n  "tasks":[{"text":"string","priority":"High|Medium|Low","tag":"string"}],\n  "assets":[{"name":"string","type":"string"}],\n  "pages":["string"],\n  "dataTables":[{"name":"string","fields":["string"]}],\n  "automations":[{"name":"string","trigger":"string","action":"string"}],\n  "launchRequirements":[{"name":"string","internal":true,"done":false,"instruction":"string"}],\n  "nextAction":"string",\n  "insight":"string"\n}\n\nUser ambition:\n${ambition}\n\nCurrent project context:\n${JSON.stringify(project)}\n\nAttached files:\n${attachmentText || "None"}\n\nChoose a useful project type and design the smallest complete system that can move the user toward the goal. Include software pieces when useful, but do not assume everything is an app.`;
  }

  return `${SYSTEM}\n\nMode: ${mode}\nModel profile: ${profile}\nUser request: ${ambition}\nProject context: ${JSON.stringify(project)}\nAttached files: ${attachmentText || "None"}\n\nGive a practical response. If mode is Build, explicitly state what would be changed or created. If mode is Fix, diagnose first. If mode is Execute, distinguish actions this platform can take from actions requiring an external account or human approval.`;
}

async function callGemini(env, body) {
  const key = env.GEMINI_API_KEY;
  if (!key) throw new Error("GEMINI_API_KEY is not configured");
  const model = PROFILE_MODELS[body.model] || PROFILE_MODELS.Auto;
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(key)}`;
  const prompt = buildPrompt(body);
  const contents = [{ role: "user", parts: [{ text: prompt }] }];
  const r = await fetch(url, {
    method: "POST",
    headers: { "Content-Type":"application/json" },
    body: JSON.stringify({ contents, generationConfig: { temperature: 0.55, maxOutputTokens: body.action === "blueprint" ? 5000 : 2200 } })
  });
  const data = await r.json();
  if (!r.ok) throw new Error(data?.error?.message || `Gemini request failed (${r.status})`);
  const text = data?.candidates?.[0]?.content?.parts?.map(p=>p.text||"").join("") || "";
  return { text, model };
}

async function callWorkersAI(env, body) {
  if (!env.AI) throw new Error("Workers AI binding is not configured");
  const model = "@cf/zai-org/glm-4.7-flash";
  const prompt = buildPrompt(body);
  const result = await env.AI.run(model, { prompt, max_tokens: body.action === "blueprint" ? 3500 : 1600 });
  const text = result?.response || result?.text || JSON.stringify(result);
  return { text, model };
}

export default {
  async fetch(request, env) {
    if (request.method === "OPTIONS") return new Response(null, { headers: CORS });
    const url = new URL(request.url);
    if (url.pathname === "/api/health") return json({ ok:true, service:"project-x-ai", providers:{gemini:!!env.GEMINI_API_KEY, workersAI:!!env.AI} });
    if (url.pathname !== "/api/ai" || request.method !== "POST") {
      if (env.ASSETS) return env.ASSETS.fetch(request);
      return new Response("Not found", { status:404 });
    }

    try {
      const body = await request.json();
      let result;
      try { result = await callGemini(env, body); }
      catch (e) {
        if (!env.AI) throw e;
        result = await callWorkersAI(env, body);
      }
      const parsed = body.action === "blueprint" ? cleanJson(result.text) : null;
      return json({ ok:true, provider: result.model.startsWith("gemini") ? "gemini" : "workers-ai", model: result.model, text: result.text, blueprint: parsed });
    } catch (e) {
      return json({ ok:false, error:e?.message || "AI request failed" }, 500);
    }
  }
};
