const TASK_FAMILIES: Record<string, string[]> = {
  discuss: ["chat","general","flash","mini","haiku","sonnet","gpt","gemini","qwen"],
  plan: ["reason","thinking","reasoning","pro","sonnet","opus","gemini","gpt","qwen","deepseek"],
  build: ["code","coding","coder","dev","sonnet","opus","gpt","qwen","deepseek","gemini","nemotron"],
  visual: ["vision","multimodal","gemini","gpt","claude"],
  research: ["research","reason","pro","sonnet","opus","gemini","gpt","qwen","deepseek"]
};
const HARD_EXCLUDE = /image|tts|text-to-speech|audio|speech|embedding|embed|transcri|video|music|moderation|rerank|whisper/i;

export function isCompatibleModel(model:any, agent:string) {
  if (!model?.id) return false;
  const id=String(model.id).toLowerCase();
  const task=String(model.task||"chat").toLowerCase();
  if (task !== "chat" && task !== "text") return false;
  if (HARD_EXCLUDE.test(id)) return false;
  if (agent === "visual" && /image|vision|multimodal/.test(id)) return true;
  return true;
}

function scoreModel(model:any, agent:string, index:number) {
  const id=String(model.id||"").toLowerCase(); const task=String(model.task||"").toLowerCase();
  let score=Math.max(0,400-index);
  for(const token of TASK_FAMILIES[agent]||TASK_FAMILIES.discuss) if(id.includes(token)||task.includes(token)) score+=80;
  if(/flash|mini|haiku|small|lite/.test(id)) score += agent === "discuss" ? 35 : 8;
  if(/pro|opus|sonnet|max|large/.test(id)) score += ["plan","build","research"].includes(agent) ? 32 : 5;
  if(/free|trial/.test(id)) score += 3;
  return score;
}

export function deterministicCandidates(models:any[], agent:string, selected?:string) {
  const available=models.filter(m=>isCompatibleModel(m,agent));
  const manual=selected && selected!=="auto" ? available.find(m=>m.id===selected) : null;
  const rest=available.filter(m=>!manual||m.id!==manual.id).map((m,i)=>({m,score:scoreModel(m,agent,i)})).sort((a,b)=>b.score-a.score).map(x=>x.m);
  return manual?[manual,...rest]:rest;
}
