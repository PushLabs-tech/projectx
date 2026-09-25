const TASK_FAMILIES: Record<string, string[]> = {
  discuss: [
    "chat",
    "general",
    "flash",
    "mini",
    "haiku",
    "sonnet",
    "gpt",
    "gemini",
    "qwen"
  ],

  plan: [
    "reason",
    "thinking",
    "reasoning",
    "pro",
    "sonnet",
    "opus",
    "gemini",
    "gpt",
    "qwen",
    "deepseek"
  ],

  build: [
    "code",
    "coding",
    "coder",
    "dev",
    "sonnet",
    "opus",
    "gpt",
    "qwen",
    "deepseek",
    "gemini",
    "nemotron"
  ],

  visual: [
    "vision",
    "multimodal",
    "image",
    "gemini",
    "gpt",
    "claude"
  ],

  research: [
    "research",
    "reason",
    "pro",
    "sonnet",
    "opus",
    "gemini",
    "gpt",
    "qwen",
    "deepseek"
  ]
};


/*
 * These modalities must never be selected for ordinary text/code
 * generation. Visual requests are handled separately.
 */
const HARD_EXCLUDE = /tts|text-to-speech|audio|speech|embedding|embed|transcri|video|music|moderation|rerank|whisper/i;

const VISUAL_MODALITY = /image|vision|multimodal/i;

const TEXT_TASKS = new Set(["chat", "text"]);

const VISUAL_TASKS = new Set([
  "image",
  "vision",
  "multimodal",
  "visual"
]);


function normalizedTask(model: any) {
  return String(model?.task || "chat").trim().toLowerCase();
}


function normalizedId(model: any) {
  return String(model?.id || "").trim().toLowerCase();
}


/**
 * Determines whether a model can safely be used for the requested agent.
 *
 * Important:
 * - Text/code agents must NEVER receive image/audio/TTS/embedding models.
 * - Visual requests may use image/vision/multimodal models.
 * - Visual models are not accidentally rejected before the visual
 *   exception is evaluated.
 */
export function isCompatibleModel(model: any, agent: string) {
  if (!model?.id) return false;

  const id = normalizedId(model);
  const task = normalizedTask(model);
  const mode = String(agent || "discuss").trim().toLowerCase();

  const isVisualAgent = mode === "visual";

  /*
   * Visual tasks are intentionally allowed to use visual models.
   * We still reject clearly unrelated modalities such as TTS,
   * embeddings, audio-only and transcription models.
   */
  if (isVisualAgent) {
    if (
      /tts|text-to-speech|audio|speech|embedding|embed|transcri|video|music|moderation|rerank|whisper/i.test(id)
    ) {
      return false;
    }

    if (
      VISUAL_MODALITY.test(id) ||
      VISUAL_TASKS.has(task)
    ) {
      return true;
    }

    /*
     * Some providers expose multimodal-capable models as generic
     * chat/text models without putting "vision" in the ID.
     * Keep those eligible.
     */
    return TEXT_TASKS.has(task);
  }

  /*
   * Every non-visual agent must use a text/chat model.
   *
   * This is the critical protection against the old issue where a
   * request such as "make Flappy Bird" could accidentally consume
   * an image-generation model.
   */
  if (!TEXT_TASKS.has(task)) {
    return false;
  }

  if (HARD_EXCLUDE.test(id)) {
    return false;
  }

  return true;
}


function scoreModel(
  model: any,
  agent: string,
  index: number
) {
  const id = normalizedId(model);
  const task = normalizedTask(model);
  const mode = String(agent || "discuss").trim().toLowerCase();

  let score = Math.max(0, 400 - index);

  for (const token of (
    TASK_FAMILIES[mode] ||
    TASK_FAMILIES.discuss
  )) {
    if (id.includes(token) || task.includes(token)) {
      score += 80;
    }
  }

  /*
   * Prefer faster/smaller models for discussion.
   */
  if (/flash|mini|haiku|small|lite/.test(id)) {
    score += mode === "discuss" ? 35 : 8;
  }

  /*
   * Prefer stronger reasoning/coding models for complex work.
   */
  if (/pro|opus|sonnet|max|large/.test(id)) {
    score += ["plan", "build", "research"].includes(mode)
      ? 32
      : 5;
  }

  /*
   * Free/trial models are useful fallbacks but are not allowed
   * to dominate the deterministic ranking.
   */
  if (/free|trial/.test(id)) {
    score += 3;
  }

  /*
   * Explicitly reward visual models for visual work.
   */
  if (mode === "visual") {
    if (/vision|multimodal|image/.test(id)) {
      score += 180;
    }

    if (VISUAL_TASKS.has(task)) {
      score += 120;
    }
  }

  return score;
}


/**
 * Deterministic candidate selection.
 *
 * Ordering is stable:
 * 1. Explicitly selected compatible model.
 * 2. Highest-scoring compatible models.
 * 3. Original provider/model ordering breaks score ties.
 *
 * Health/cooldown state is handled by the execution layer.
 */
export function deterministicCandidates(
  models: any[],
  agent: string,
  selected?: string
) {
  const input = Array.isArray(models) ? models : [];

  const available = input.filter(model =>
    isCompatibleModel(model, agent)
  );

  const manual =
    selected &&
    selected !== "auto"
      ? available.find(
          model => String(model.id) === String(selected)
        )
      : null;

  const rest = available
    .filter(model => !manual || model.id !== manual.id)
    .map((model, index) => ({
      model,
      score: scoreModel(model, agent, index),
      index
    }))
    .sort((a, b) => {
      if (b.score !== a.score) {
        return b.score - a.score;
      }

      return a.index - b.index;
    })
    .map(item => item.model);

  return manual
    ? [manual, ...rest]
    : rest;
}
