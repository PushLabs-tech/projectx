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
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    throw new Error("Invalid request encoding");
  }
}

export function parseJsonText(raw: string, emptyAsObject = true): any {
  try {
    return JSON.parse(emptyAsObject ? (raw || "{}") : raw);
  } catch {
    throw new Error("Invalid JSON");
  }
}

export async function readBoundedJson(req: Request, maxBytes: number): Promise<any> {
  return parseJsonText(await readBoundedRequestText(req, maxBytes));
}

const REQUEST_ERROR_STATUS: Record<string, number> = Object.freeze({
  "Missing session": 401,
  "Invalid session": 401,
  "Webhook secret is not configured": 503,
  "Payment provider is not configured": 503,
  "Unsupported plan": 400,
  "Subscription id required": 400,
  "Unknown payment action": 400,
  "Request is too large": 413,
  "FILE_TOO_LARGE": 413,
  "Invalid JSON": 400,
  "Invalid request encoding": 400,
  "Unknown action": 400,
  "WORKSPACE_AND_EMAIL_REQUIRED": 400,
  "WORKSPACE_REQUIRED": 400,
  "INVITE_TOKEN_REQUIRED": 400,
  "INVALID_EMAIL": 400,
  "Provider token required": 400,
  "Unsupported deployment provider": 400,
  "Invalid repository path": 400,
  "Invalid repository": 400,
  "No files to push": 400,
  "SIGN_IN_REQUIRED": 401,
  "INVALID_SESSION": 401,
  "FORBIDDEN": 403,
  "INVITATION_EMAIL_MISMATCH": 403,
  "PROJECT_NOT_FOUND": 404,
  "DEPLOYMENT_NOT_FOUND": 404,
  "PREVIOUS_DEPLOYMENT_NOT_FOUND": 404,
  "BUILD_RUN_NOT_FOUND": 404,
  "INVITATION_NOT_FOUND": 404,
  "INVITATION_EXPIRED": 410,
  "Invalid or expired OAuth state": 410,
  "NO_PREVIOUS_DEPLOYMENT": 409,
  "ROLLBACK_PROVIDER_MISMATCH": 409,
  "VERCEL_ROLLBACK_REQUIRES_PROVIDER_PROMOTION": 409,
  "NETLIFY_ROLLBACK_TARGET_MISSING": 409,
  "BUILD_WORKFLOW_PATH_OCCUPIED": 409,
  "GITHUB_NOT_CONNECTED": 409,
  "DEPLOYMENT_TARGET_NOT_CONFIGURED": 503,
  "GitHub OAuth is not configured": 503
});

export function requestErrorStatus(error: unknown): number {
  const message = error instanceof Error ? error.message : String(error);
  if (Object.prototype.hasOwnProperty.call(REQUEST_ERROR_STATUS, message)) {
    return REQUEST_ERROR_STATUS[message];
  }
  // Do not hide database, provider, or programming failures as client request errors.
  return 500;
}
