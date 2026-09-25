const MAX_FILE_BYTES = 600000;
const MAX_TOOL_CALLS = 24;
const MAX_PATH_LENGTH = 180;

const clone = (value: any) => JSON.parse(JSON.stringify(value ?? null));

function sanitizePath(value: unknown): string | null {
  const path = String(value ?? "").replace(/\\/g, "/").replace(/^\/+/, "").trim();
  if (!path || path.includes("..") || path.includes("\0") || /^[a-z][a-z0-9+.-]*:\/\//i.test(path)) return null;
  const clean = path.split("/").filter(Boolean).join("/");
  return clean && clean.length <= MAX_PATH_LENGTH ? clean : null;
}

function text(value: unknown, max = 1200) {
  return String(value ?? "").slice(0, max);
}

function allowedWrite(contract: any, path: string) {
  const writes = Array.isArray(contract?.writes) ? contract.writes.map((x: any) => String(x)) : [];
  const target = String(contract?.targetId || "").replace(/^file:/, "");
  if (contract?.type === "update") return path === target;
  return writes.includes("files") || writes.includes("target-file");
}

export function executionToolDefinitions() {
  return [
    { name: "list_files", readOnly: true, description: "List existing project file paths." },
    { name: "read_file", readOnly: true, description: "Read one existing project file." },
    { name: "write_file", write: true, description: "Propose a complete replacement for one project file." },
    { name: "delete_file", write: true, description: "Delete one existing project file." },
    { name: "verify_output", readOnly: true, description: "Run deterministic structural checks on the current working file set." }
  ];
}

export function createWorkingProject(project: any) {
  return {
    ...project,
    files: Object.fromEntries(Object.entries(project?.files || {}).map(([path, content]) => [String(path), String(content ?? "")]))
  };
}

export function executeToolCalls(project: any, contract: any, toolCalls: any[]) {
  const working = createWorkingProject(project);
  const operations: any[] = [];
  const evidence: any[] = [];
  const calls = Array.isArray(toolCalls) ? toolCalls.slice(0, MAX_TOOL_CALLS) : [];
  const errors: any[] = [];

  const getContent = (path: string) => {
    if (Object.prototype.hasOwnProperty.call(working.files, path)) return String(working.files[path] ?? "");
    return null;
  };

  for (let i = 0; i < calls.length; i++) {
    const call = calls[i] || {};
    const tool = String(call.tool || "").trim();
    try {
      if (tool === "list_files") {
        evidence.push({ tool, ok: true, files: Object.keys(working.files).sort().slice(0, 600) });
        continue;
      }

      if (tool === "read_file") {
        const path = sanitizePath(call.path);
        if (!path) throw new Error("Unsafe file path.");
        const content = getContent(path);
        if (content === null) throw new Error("File does not exist: " + path);
        evidence.push({ tool, ok: true, path, content: content.slice(0, 20000) });
        continue;
      }

      if (tool === "write_file") {
        const path = sanitizePath(call.path);
        if (!path) throw new Error("Unsafe file path.");
        if (!allowedWrite(contract, path)) throw new Error("Write is outside the action contract.");
        const content = String(call.content ?? "");
        if (content.length > MAX_FILE_BYTES) throw new Error("File exceeds the 600KB execution limit.");
        const changed = getContent(path) !== content;
        working.files[path] = content;
        const existing = operations.findIndex(op => op.path === path);
        const op = { op: "write", path, content };
        if (existing >= 0) operations[existing] = op; else operations.push(op);
        evidence.push({ tool, ok: true, path, changed, bytes: content.length });
        continue;
      }

      if (tool === "delete_file") {
        const path = sanitizePath(call.path);
        if (!path) throw new Error("Unsafe file path.");
        if (!allowedWrite(contract, path)) throw new Error("Delete is outside the action contract.");
        if (!Object.prototype.hasOwnProperty.call(working.files, path)) throw new Error("File does not exist: " + path);
        delete working.files[path];
        const existing = operations.findIndex(op => op.path === path);
        const op = { op: "delete", path };
        if (existing >= 0) operations[existing] = op; else operations.push(op);
        evidence.push({ tool, ok: true, path, deleted: true });
        continue;
      }

      if (tool === "verify_output") {
        const files = working.files;
        const allText = Object.values(files).map(String).join("\n");
        const entry = files["index.html"] || files["src/index.html"] || "";
        const structural = {
          entryFile: Boolean(entry),
          htmlStructure: !String(contract?.risk || "").match(/never/) && /<html[\s>]/i.test(entry) && /<body[\s>]/i.test(entry),
          placeholders: !/\b(TODO|FIXME|coming soon)\b/i.test(allText)
        };
        const document = Object.keys(files).some(path => /\.(md|txt|csv|json)$/i.test(path));
        const pass = contract?.type === "rebuild"
          ? (String(project?.type || "").toLowerCase() === "document" ? document && structural.placeholders : structural.entryFile && structural.htmlStructure && structural.placeholders)
          : structural.placeholders;
        evidence.push({ tool, ok: true, pass, checks: structural });
        continue;
      }

      throw new Error("Tool is not registered: " + (tool || "unknown"));
    } catch (error) {
      errors.push({ index: i, tool, error: error instanceof Error ? error.message : String(error) });
      evidence.push({ tool, ok: false, error: errors.at(-1).error });
      break;
    }
  }

  if (errors.length) return { ok: false, operations, evidence, errors, files: working.files };
  if (!calls.length) return { ok: false, operations, evidence, errors: [{ error: "No tool calls returned." }], files: working.files };
  return { ok: true, operations, evidence, errors: [], files: working.files };
}

export function buildExecutionSettings(settings: any, action: any, result: any, status: string, nowIso = new Date().toISOString()) {
  const next = clone(settings || {});
  next.executionState = { ...(next.executionState || {}) };
  const queue = next.executionState.reconciliationQueue;
  if (queue?.actions && action?.id) {
    const target = queue.actions.find((item: any) => item.id === action.id);
    if (target) {
      target.status = status;
      target.updatedAt = nowIso;
      if (status === "running") target.attempts = Number(target.attempts || 0) + 1;
      if (["completed","failed","blocked","skipped"].includes(status)) target.completedAt = nowIso;
      if (result) {
        target.result = {
          kind: String(result.kind || action.type || "execution"),
          ok: result.ok !== false,
          message: text(result.message, 800),
          model: result.model ? text(result.model, 240) : null,
          provider: result.provider ? text(result.provider, 80) : null,
          evidence: Array.isArray(result.evidence) ? result.evidence.slice(0, 20).map(clone) : [],
          outputVersion: Number(result.outputVersion ?? queue.targetVersion ?? 1),
          recordedAt: nowIso
        };
      }
      target.error = result?.error ? text(result.error, 500) : null;
    }
    const failed = queue.actions.some((item: any) => item.status === "failed");
    const blocked = queue.actions.some((item: any) => item.status === "blocked");
    const remaining = queue.actions.some((item: any) => !["completed","failed","blocked","skipped"].includes(item.status));
    queue.status = failed ? "failed" : blocked ? "blocked" : remaining ? "in_progress" : "complete";
    queue.updatedAt = nowIso;
    if (queue.status === "complete") queue.completedAt = nowIso;
  }
  next.executionState.status = status === "completed" ? "reconciling" : status === "failed" ? "needs-fix" : "reconciling";
  return next;
}
