import { GoogleGenAI } from '@google/genai';

/**
 * Robust code generator that calls Google Gemini via @google/genai.
 * Returns structured files and thoughts directly synthesized from the user's prompt.
 */
export async function handleGenerateCode({
  prompt,
  history = [],
  currentFiles = {},
  projectTitle = '',
  projectType = 'Web',
  mode = 'create'
}) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY environment variable is not configured.');
  }

  const ai = new GoogleGenAI({});

  const systemInstruction = `You are an elite Universal AI Software Engineer, Full-Stack Architect, and Product Developer.
The user is prompting you to build or modify any web application, tool, dashboard, calculator, utility, creative canvas, simulation, or game.

STRICT INSTRUCTIONS:
1. UNIVERSAL BUILD CAPABILITY: You can build ANYTHING the user asks for — dashboards, SaaS tools, productivity apps, e-commerce stores, calculators, data visualizers, interactive games, audio tools, markdown editors, forms, quizzes, simulations, and utilities.
2. NO PLACEHOLDERS: NEVER output comments like "// TODO", "// add code here", truncated code, or dummy stubs. Every single feature requested MUST be fully implemented and 100% working.
3. PRODUCTION-GRADE QUALITY:
   - index.html: Semantic HTML5 structure with viewport meta, linked styles.css, loaded app.js, accessible high-contrast UI, header, action controls, and responsive containers.
   - styles.css: Clean, polished CSS with responsive design (mobile + desktop), modern aesthetic (subtle borders, refined colors, smooth transitions), flexbox/grid, and accessible contrast.
   - app.js: Complete, bug-free, executable JavaScript logic. Include full state management, real event listeners, rich interactive features, and local persistence (localStorage) where appropriate.
4. If the user asks to build, create, or switch to a new concept, generate a fresh, tailored architecture built exclusively for their exact prompt.

OUTPUT FORMAT:
Output your entire response using these exact delimiters:

<<<THINKING>>>
Provide 2-4 sentences explaining your architectural plan, state model, key interactive features, and design choices.
<<<END_THINKING>>>

<<<TITLE>>>
Concise 2-4 word project title (e.g., Markdown Editor, Crypto Dashboard, Expense Tracker, Solar Physics Sim, Space Shooter)
<<<END_TITLE>>>

<<<TYPE>>>
Web, Dashboard, Tool, Commerce, Data, or Game
<<<END_TYPE>>>

<<<REPLY>>>
A clear, friendly explanation of what was built, key features implemented, and how the user can interact with it.
<<<END_REPLY>>>

For each file in the project, output:
<<<FILE:filename.ext>>>
Complete file content here
<<<END_FILE>>>
`;

  let promptContent = `User Request: "${prompt}"\n\n`;
  if (projectTitle) promptContent += `Current Project Title: ${projectTitle}\n`;
  if (projectType) promptContent += `Current Project Type: ${projectType}\n`;

  // Detect if user wants to reset or switch to a new concept
  const isResetOrNew = /\b(clear|make|build|create|switch|new|start|reset)\b/i.test(prompt) &&
    /\b(game|shooter|snake|app|calculator|dashboard|pong|chess|puzzle|tool)\b/i.test(prompt);

  if (!isResetOrNew && currentFiles && Object.keys(currentFiles).length > 0) {
    promptContent += `\nCurrent Existing Files:\n`;
    for (const [path, content] of Object.entries(currentFiles)) {
      const trimmed = String(content || '').slice(0, 3500);
      promptContent += `--- ${path} ---\n${trimmed}\n`;
    }
  }

  if (Array.isArray(history) && history.length > 0) {
    promptContent += `\nRecent Conversation:\n`;
    for (const msg of history.slice(-3)) {
      if (msg && msg.text) {
        promptContent += `${msg.role === 'user' ? 'User' : 'Assistant'}: ${msg.text.slice(0, 300)}\n`;
      }
    }
  }

  // Resilient model fallback chain
  const models = [
    'gemini-flash-latest',
    'gemini-3.8-flash',
    'gemini-3.1-flash-lite',
    'gemini-3.1-pro-preview'
  ];
  let lastError = null;
  let responseText = '';

  for (const model of models) {
    try {
      const res = await ai.models.generateContent({
        model,
        contents: promptContent,
        config: {
          systemInstruction,
        }
      });
      responseText = res.text || '';
      if (responseText && responseText.trim().length > 0) break;
    } catch (err) {
      lastError = err;
      console.warn(`[AI Engine] Model ${model} failed:`, err?.message || err);
      // If resource exhausted or overloaded, pause briefly before next model
      if (err?.message?.includes('resource_exhausted') || err?.message?.includes('overloaded')) {
        await new Promise(r => setTimeout(r, 600));
      }
    }
  }

  if (!responseText) {
    throw new Error(lastError ? lastError.message : 'AI generation failed to produce content.');
  }

  // Extract structured parts
  const thinkingMatch = responseText.match(/<<<THINKING>>>\s*([\s\S]*?)\s*<<<END_THINKING>>>/i);
  const thinking = thinkingMatch ? thinkingMatch[1].trim() : 'Synthesized complete solution architecture.';

  const titleMatch = responseText.match(/<<<TITLE>>>\s*([\s\S]*?)\s*<<<END_TITLE>>>/i);
  const title = titleMatch ? titleMatch[1].trim().replace(/^["']|["']$/g, '') : (projectTitle || 'AI Creation');

  const typeMatch = responseText.match(/<<<TYPE>>>\s*([\s\S]*?)\s*<<<END_TYPE>>>/i);
  const type = typeMatch ? typeMatch[1].trim() : (projectType || 'Web');

  const replyMatch = responseText.match(/<<<REPLY>>>\s*([\s\S]*?)\s*<<<END_REPLY>>>/i);
  const reply = replyMatch ? replyMatch[1].trim() : `Generated ${title} with custom code and live interactive preview.`;

  // Extract files
  const fileRegex = /<<<FILE:([^>]+)>>>\s*([\s\S]*?)\s*<<<END_FILE>>>/gi;
  const operations = [];
  let fileMatch;
  while ((fileMatch = fileRegex.exec(responseText)) !== null) {
    const path = fileMatch[1].trim().replace(/^\/+/,'');
    const content = fileMatch[2].trim();
    if (path && content) {
      operations.push({
        op: 'write_file',
        path,
        content
      });
    }
  }

  // Fallback markdown code fence extraction if no delimiter tags were emitted
  if (operations.length === 0) {
    const htmlMatch = responseText.match(/```(?:html)\s*([\s\S]*?)\s*```/i);
    const cssMatch = responseText.match(/```(?:css)\s*([\s\S]*?)\s*```/i);
    const jsMatch = responseText.match(/```(?:javascript|js)\s*([\s\S]*?)\s*```/i);

    if (htmlMatch) {
      operations.push({ op: 'write_file', path: 'index.html', content: htmlMatch[1].trim() });
    }
    if (cssMatch) {
      operations.push({ op: 'write_file', path: 'styles.css', content: cssMatch[1].trim() });
    }
    if (jsMatch) {
      operations.push({ op: 'write_file', path: 'app.js', content: jsMatch[1].trim() });
    }
  }

  return {
    title,
    type,
    thinking,
    reply,
    operations,
    replaceAllFiles: isResetOrNew || operations.some(o => o.path === 'index.html'),
    rawText: responseText
  };
}
