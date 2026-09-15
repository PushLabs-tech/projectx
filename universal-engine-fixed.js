import * as Legacy from './universal-engine.js?legacy';

export * from './universal-engine.js?legacy';

export const ENGINE_VERSION = '15.0.0';
export const RUNTIME_CONTRACT_VERSION = '1.0.0';

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
}

function safeTitle(value) {
  return escapeHtml(value || 'ProjectX Creation');
}

/**
 * Canonical sandbox-safe game artifact.
 *
 * Important invariants:
 * - classic script, not ESM
 * - no localStorage/sessionStorage dependency
 * - parent page can load game.js before app.js
 * - exposes window.createGameEngine
 * - deterministic state lifecycle: start -> input -> stop
 */
export function buildGameArtifact(title = 'ProjectX Game') {
  const safe = safeTitle(title);
  return {
    'index.html': `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${safe}</title>
<link rel="stylesheet" href="styles.css">
</head>
<body>
<main class="game-container" id="game-app">
<header class="game-header"><h1 class="game-title">${safe}</h1><div class="game-stats"><span>Score: <b id="score">0</b></span><span>Best: <b id="best">0</b></span></div></header>
<div class="canvas-wrap">
<canvas id="gameCanvas" width="400" height="560" aria-label="Interactive playable game"></canvas>
<div class="overlay" id="overlay"><h2>Ready to Play</h2><p>Press Space, ArrowUp, click or tap to jump</p><button id="startBtn" class="btn-primary" type="button">Start Game</button></div>
</div>
<footer class="game-footer"><p>Controls: Space · ArrowUp · Click · Tap</p></footer>
</main>
<script src="game.js"></script>
<script src="app.js"></script>
</body>
</html>`,

    'styles.css': `*{box-sizing:border-box}body{margin:0;min-height:100vh;padding:16px;background:#0f172a;color:#f8fafc;font-family:system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;display:grid;place-items:center}.game-container{width:min(440px,100%);padding:20px;background:#1e293b;border:1px solid #334155;border-radius:16px;box-shadow:0 20px 50px rgba(0,0,0,.35)}.game-header{display:flex;justify-content:space-between;align-items:center;gap:12px;margin-bottom:12px}.game-title{margin:0;font-size:18px}.game-stats{display:flex;gap:12px;font-size:13px}.game-stats b{color:#f59e0b}.canvas-wrap{position:relative;overflow:hidden;border-radius:12px;background:#70c5ce}.canvas-wrap canvas{display:block;width:100%;height:auto}.overlay{position:absolute;inset:0;display:flex;flex-direction:column;justify-content:center;align-items:center;gap:12px;padding:20px;text-align:center;background:rgba(15,23,42,.82)}.overlay.hidden{display:none}.btn-primary{border:0;border-radius:999px;padding:11px 18px;background:#38bdf8;color:#0f172a;font-weight:700;cursor:pointer}.game-footer{text-align:center;color:#94a3b8;font-size:12px;margin-top:10px}`,

    'game.js': `(() => {
  "use strict";
  function createGameEngine(canvas, onScoreUpdate, onGameOver) {
    if (!canvas) throw new Error("Game canvas is required");
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("2D canvas context is unavailable");

    const state = {
      running: false,
      score: 0,
      birdY: canvas.height / 2,
      velocity: 0,
      gravity: 0.35,
      jump: -6.5,
      pipes: [],
      width: canvas.width,
      height: canvas.height
    };

    let frame = 0;
    let rafId = null;

    function reset() {
      state.running = true;
      state.score = 0;
      state.birdY = state.height / 2;
      state.velocity = 0;
      state.pipes = [];
      frame = 0;
      onScoreUpdate?.(0);
    }

    function flap() {
      if (state.running) state.velocity = state.jump;
    }

    function stop() {
      state.running = false;
      if (rafId != null) cancelAnimationFrame(rafId);
      rafId = null;
    }

    function gameOver() {
      stop();
      onGameOver?.(state.score);
    }

    function tick() {
      if (!state.running) return;
      frame += 1;
      state.velocity += state.gravity;
      state.birdY += state.velocity;

      if (frame % 90 === 0) {
        const gap = 130;
        const minTop = 50;
        const maxTop = Math.max(minTop, state.height - gap - minTop * 2);
        const top = minTop + Math.random() * (maxTop - minTop);
        state.pipes.push({ x: state.width, top, bottom: state.height - (top + gap), passed: false });
      }

      for (let i = state.pipes.length - 1; i >= 0; i -= 1) {
        const pipe = state.pipes[i];
        pipe.x -= 2.5;
        if (!pipe.passed && pipe.x < 70) {
          pipe.passed = true;
          state.score += 1;
          onScoreUpdate?.(state.score);
        }
        if (pipe.x < -60) state.pipes.splice(i, 1);
      }

      if (state.birdY < 0 || state.birdY > state.height - 20) return gameOver();
      for (const pipe of state.pipes) {
        const overlapsX = 56 > pipe.x && 34 < pipe.x + 50;
        if (overlapsX && (state.birdY - 12 < pipe.top || state.birdY + 12 > state.height - pipe.bottom)) {
          return gameOver();
        }
      }

      ctx.clearRect(0, 0, state.width, state.height);
      ctx.fillStyle = '#70c5ce';
      ctx.fillRect(0, 0, state.width, state.height);
      ctx.fillStyle = '#22c55e';
      for (const pipe of state.pipes) {
        ctx.fillRect(pipe.x, 0, 50, pipe.top);
        ctx.fillRect(pipe.x, state.height - pipe.bottom, 50, pipe.bottom);
      }
      ctx.fillStyle = '#ded895';
      ctx.fillRect(0, state.height - 20, state.width, 20);
      ctx.fillStyle = '#f59e0b';
      ctx.beginPath();
      ctx.arc(56, state.birdY, 14, 0, Math.PI * 2);
      ctx.fill();

      rafId = requestAnimationFrame(tick);
    }

    return {
      start() {
        stop();
        reset();
        rafId = requestAnimationFrame(tick);
      },
      flap,
      stop,
      getState() {
        return { ...state, pipes: state.pipes.map((pipe) => ({ ...pipe })) };
      }
    };
  }

  window.createGameEngine = createGameEngine;
  window.ProjectXGameRuntime = { version: '1.0.0', createGameEngine };
})();`,

    'app.js': `(() => {
  "use strict";
  const canvas = document.getElementById("gameCanvas");
  const scoreEl = document.getElementById("score");
  const bestEl = document.getElementById("best");
  const overlay = document.getElementById("overlay");
  const startBtn = document.getElementById("startBtn");
  let engine = null;
  let bestScore = 0;

  function renderBest() { if (bestEl) bestEl.textContent = String(bestScore); }
  function setOverlay(title, detail, buttonText) {
    if (!overlay) return;
    overlay.classList.remove("hidden");
    const heading = overlay.querySelector("h2");
    const copy = overlay.querySelector("p");
    if (heading) heading.textContent = title;
    if (copy) copy.textContent = detail;
    if (startBtn) startBtn.textContent = buttonText;
  }

  function onScore(score) {
    if (scoreEl) scoreEl.textContent = String(score);
    if (score > bestScore) bestScore = score;
    renderBest();
  }

  function onGameOver(score) {
    setOverlay("Game Over", `Score: ${score} · Best: ${bestScore}`, "Play Again");
  }

  function start() {
    if (!engine && window.createGameEngine) engine = window.createGameEngine(canvas, onScore, onGameOver);
    if (!engine) throw new Error("Game runtime failed to initialize");
    overlay?.classList.add("hidden");
    engine.start();
  }

  startBtn?.addEventListener("click", start);
  canvas?.addEventListener("pointerdown", (event) => { event.preventDefault(); engine?.flap(); });
  window.addEventListener("keydown", (event) => {
    if (event.code === "Space" || event.code === "ArrowUp") {
      event.preventDefault();
      if (overlay?.classList.contains("hidden")) engine?.flap(); else start();
    }
  });

  renderBest();
})();`
  };
}

export function createProject(intent = 'Create something') {
  const project = Legacy.createProject(intent);
  if (project?.kind === 'game') {
    project.artifacts = buildGameArtifact(project.title || intent);
    project.files = { ...project.artifacts };
    project.stage = 'built';
    project.runtime = { ...(project.runtime || {}), kind: 'game_canvas', status: 'ready', supportsPreview: true };
  }
  return project;
}

export function buildArtifact(project, prompt = '') {
  if (project?.kind === 'game' || /\b(flappy|game|playable|platformer|arcade|pong|tetris)\b/i.test(String(project?.intent || prompt))) {
    const files = buildGameArtifact(project.intent || project.title || 'ProjectX Game');
    project.artifacts = files;
    project.files = { ...files };
    project.stage = 'built';
    project.progress = Math.max(Number(project.progress || 0), 75);
    project.readiness = Math.max(Number(project.readiness || 0), 80);
    project.updatedAt = Date.now();
    project.history = Array.isArray(project.history) ? project.history : [];
    project.history.push({ id: `hist_${Date.now()}`, event: 'canonical_game_artifact_built', ts: Date.now() });
    return files;
  }
  return Legacy.buildArtifact(project, prompt);
}

export function sandboxRun(project) {
  const result = typeof Legacy.sandboxRun === 'function' ? Legacy.sandboxRun(project) : { ok: true, errors: [] };
  const files = project?.artifacts || {};
  const game = String(files['game.js'] || '');
  const checks = [];
  if (project?.kind === 'game' || game) {
    checks.push({ name: 'canonical-game-runtime', status: /window\.createGameEngine\s*=/.test(game) && /requestAnimationFrame/.test(game) ? 'passed' : 'failed' });
    checks.push({ name: 'game-no-storage-dependency', status: /\blocalStorage\b|\bsessionStorage\b/.test(game) ? 'failed' : 'passed' });
    checks.push({ name: 'game-classic-script', status: /export\s+(?:default\s+)?function/.test(game) ? 'failed' : 'passed' });
  }
  return { ...result, runtimeChecks: checks, ok: Boolean(result.ok) && checks.every((c) => c.status === 'passed') };
}

export function browserTest(project, runner = null) {
  if (typeof runner === 'function') return runner(project);
  return sandboxRun(project).runtimeChecks?.map((check) => ({ ...check, verificationMode: 'static-runtime-contract' })) || [];
}
