export type ProviderId = "bytez" | "nvidia" | "openrouter" | "openai" | "google" | "anthropic" | "generic" | "auto";
export type Credential = { provider: ProviderId; label?: string; apiKey: string; providerKey?: string; baseUrl?: string };

const PROVIDERS: Record<Exclude<ProviderId,"auto">, { label: string; baseUrl: string; kind: string }> = {
  bytez: { label: "Bytez", baseUrl: "https://api.bytez.com", kind: "bytez" },
  nvidia: { label: "NVIDIA NIM", baseUrl: "https://integrate.api.nvidia.com/v1", kind: "openai" },
  openrouter: { label: "OpenRouter", baseUrl: "https://openrouter.ai/api/v1", kind: "openai" },
  openai: { label: "OpenAI", baseUrl: "https://api.openai.com/v1", kind: "openai" },
  google: { label: "Google Gemini", baseUrl: "https://generativelanguage.googleapis.com/v1beta/openai", kind: "openai" },
  anthropic: { label: "Anthropic", baseUrl: "https://api.anthropic.com/v1", kind: "anthropic" },
  generic: { label: "OpenAI-compatible", baseUrl: "", kind: "openai" },
};

export function detectProvider(apiKey: string, baseUrl = ""): Exclude<ProviderId,"auto"> {
  const k = apiKey.trim();
  if (/^AIza/i.test(k)) return "google";
  if (/^nvapi-/i.test(k)) return "nvidia";
  if (/^sk-ant-/i.test(k)) return "anthropic";
  if (/^sk-or-/i.test(k)) return "openrouter";
  if (/^sk-/i.test(k) && /openai/i.test(baseUrl)) return "openai";
  if (/bytz/i.test(baseUrl)) return "bytez";
  return baseUrl ? "generic" : "openai";
}

export function providerInfo(id: ProviderId) {
  if (id === "auto") throw new Error("Auto is resolved before provider calls");
  const p = PROVIDERS[id];
  if (!p) throw new Error(`Unsupported provider: ${id}`);
  return p;
}

async function readJson(response: Response) {
  const text = await response.text();
  let data: any = {};
  try { data = text ? JSON.parse(text) : {}; } catch { data = { raw: text }; }
  if (!response.ok) throw new Error(`${response.status}: ${data?.error?.message || data?.error || data?.message || text || "Provider request failed"}`);
  return data;
}

function normalizeOpenAIModels(data: any, provider: string) {
  return (Array.isArray(data?.data) ? data.data : []).map((m: any) => {
    const raw=String(m.id||""); const id=raw.replace(/^models\//i,""); const x=id.toLowerCase();
    const task=/image|vision|tts|audio|speech|embedding|embed|transcri|video/.test(x) ? "non-chat" : "chat";
    return { id, name: String(m.name || id), provider, task, modality: task==="chat"?"text":"other", contextLength: Number(m.context_length || m.context_window || 0) || null };
  }).filter((m: any) => m.id && m.task === "chat");
}

export async function listModels(credential: Credential, task = "chat") {
  const provider = credential.provider === "auto" ? detectProvider(credential.apiKey, credential.baseUrl) : credential.provider;
  const effective = {...credential, provider};
  const info = providerInfo(provider);
  if (provider === "bytez") {
    const url = `${info.baseUrl}/models/v2/list/models?task=${encodeURIComponent(task)}`;
    const res = await fetch(url, { headers: { Authorization: credential.apiKey }, signal: AbortSignal.timeout(20000) });
    const data = await readJson(res);
    return (Array.isArray(data?.output) ? data.output : []).map((m: any) => ({ id: String(m.modelId), name: String(m.modelId), provider: "Bytez", task: String(m.task || task), params: Number(m.params || 0) || null, ramRequired: Number(m.ramRequired || 0) || null, meter: m.meter || null }));
  }
  if (provider === "anthropic") {
    const res = await fetch(`${info.baseUrl}/models`, { headers: { "x-api-key": credential.apiKey, "anthropic-version": "2023-06-01" }, signal: AbortSignal.timeout(20000) });
    const data = await readJson(res);
    return (Array.isArray(data?.data) ? data.data : []).map((m: any) => ({ id: String(m.id), name: String(m.display_name || m.id), provider: "Anthropic", task: "chat" }));
  }
  const base = (credential.baseUrl || info.baseUrl).replace(/\/$/, "");
  const headers: Record<string,string> = { Authorization: `Bearer ${credential.apiKey}` };
  if (provider === "openrouter") { headers["HTTP-Referer"] = "https://builder.local"; headers["X-Title"] = "Builder"; }
  if (provider === "nvidia") { headers["Accept"] = "application/json"; }
  if (provider === "nvidia") { headers["Accept"] = "application/json"; }
  const res = await fetch(`${base}/models`, { headers, signal: AbortSignal.timeout(20000) });
  return normalizeOpenAIModels(await readJson(res), info.label);
}

export async function chat(credential: Credential, model: string, messages: any[], options: { temperature?: number; maxTokens?: number; providerKey?: string } = {}) {
  const provider = credential.provider === "auto" ? detectProvider(credential.apiKey, credential.baseUrl) : credential.provider;
  const effective = {...credential, provider};
  const info = providerInfo(provider);
  if (provider === "bytez") {
    const headers: Record<string,string> = { Authorization: credential.apiKey, "Content-Type": "application/json" };
    if (options.providerKey) headers["provider-key"] = options.providerKey;
    const res = await fetch(`${info.baseUrl}/models/v2/${model}`, { method: "POST", headers, body: JSON.stringify({ messages, stream: false, params: { temperature: options.temperature ?? 0.4, max_new_tokens: options.maxTokens ?? 1400 } }), signal: AbortSignal.timeout(60000) });
    const data = await readJson(res);
    return { text: typeof data?.output === "string" ? data.output : data?.output?.content || data?.response || "", usage: data?.usage || null };
  }
  if (provider === "anthropic") {
    const system = messages.find(m => m.role === "system")?.content;
    const body = { model, max_tokens: options.maxTokens ?? 1400, temperature: options.temperature ?? 0.4, ...(system ? { system } : {}), messages: messages.filter(m => m.role !== "system") };
    const res = await fetch(`${info.baseUrl}/messages`, { method: "POST", headers: { "x-api-key": credential.apiKey, "anthropic-version": "2023-06-01", "content-type": "application/json" }, body: JSON.stringify(body), signal: AbortSignal.timeout(60000) });
    const data = await readJson(res);
    return { text: (data?.content || []).map((x: any) => x?.text || "").join(""), usage: data?.usage || null };
  }
  const base = (credential.baseUrl || info.baseUrl).replace(/\/$/, "");
  const headers: Record<string,string> = { Authorization: `Bearer ${credential.apiKey}`, "Content-Type": "application/json" };
  if (provider === "openrouter") { headers["HTTP-Referer"] = "https://builder.local"; headers["X-Title"] = "Builder"; }
  const res = await fetch(`${base}/chat/completions`, { method: "POST", headers, body: JSON.stringify({ model, messages, temperature: options.temperature ?? 0.4, max_tokens: options.maxTokens ?? 1400 }), signal: AbortSignal.timeout(60000) });
  const data = await readJson(res);
  return { text: data?.choices?.[0]?.message?.content || "", usage: data?.usage || null };
}
