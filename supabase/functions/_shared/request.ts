// Byte-accurate request limits for Supabase Edge Functions. Never trust Content-Length alone.
export async function readBoundedRequestText(req: Request, maxBytes: number): Promise<string> {
  if (!Number.isSafeInteger(maxBytes) || maxBytes < 1) throw new Error("Invalid request limit");
  const declaredLength = req.headers.get("content-length");
  if (declaredLength && /^\d+$/.test(declaredLength) && Number(declaredLength) > maxBytes) {
    try { await req.body?.cancel(); } catch {}
    throw new Error("Request is too large");
  }
  const reader = req.body?.getReader();
  if (!reader) return "";
  const chunks: Uint8Array[] = [];
  let totalBytes = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (!value) continue;
    totalBytes += value.byteLength;
    if (totalBytes > maxBytes) {
      try { await reader.cancel(); } catch {}
      throw new Error("Request is too large");
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(totalBytes);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
}

export async function readBoundedJson(req: Request, maxBytes: number): Promise<any> {
  const raw = await readBoundedRequestText(req, maxBytes);
  try {
    return JSON.parse(raw || "{}");
  } catch {
    throw new Error("Invalid JSON");
  }
}

export function requestErrorStatus(error: unknown): number {
  const message = error instanceof Error ? error.message : String(error);
  if (message === "Request is too large") return 413;
  if (message === "Invalid JSON") return 400;
  return 400;
}
