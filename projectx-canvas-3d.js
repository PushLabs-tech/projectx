// ProjectX procedural 3D engine — zero-dependency WebGL with Canvas 2D and SVG fallbacks.
// Renders the hero "Creation Core" and the scroll-driven "Execution Pipeline" visualizer.
// Never throws: any failure degrades gracefully to the next fallback tier.

const REDUCED = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
const isMobile = () => typeof innerWidth === 'number' && innerWidth < 768;
const DPR = () => Math.min(typeof devicePixelRatio === 'number' ? devicePixelRatio : 1, isMobile() ? 1.5 : 2);

const DOMAIN_HUES = {
  web: [0.949, 0.329, 0.176],        // electric flame orange
  games: [0.608, 0.396, 0.965],      // playable violet
  business: [0.063, 0.725, 0.506],   // launch green
  github: [0.392, 0.404, 0.945],     // repository indigo
  research: [0.055, 0.647, 0.914],   // evidence sky
  operations: [0.961, 0.620, 0.043], // ops amber
};
const SELF_HEAL_GREEN = [0.063, 0.725, 0.506];

const lerp = (a, b, t) => a + (b - a) * t;
const lerp3 = (a, b, t) => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
const clamp01 = v => Math.max(0, Math.min(1, v));

// ---------- tiny mat4 helpers ----------
function perspective(fov, aspect, near, far) {
  const f = 1 / Math.tan(fov / 2), nf = 1 / (near - far);
  return [f / aspect, 0, 0, 0, 0, f, 0, 0, 0, 0, (far + near) * nf, -1, 0, 0, 2 * far * near * nf, 0];
}
function multiply(a, b) {
  const o = new Array(16).fill(0);
  for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++)
    for (let k = 0; k < 4; k++) o[c * 4 + r] += a[k * 4 + r] * b[c * 4 + k];
  return o;
}
function rotY(a) { const c = Math.cos(a), s = Math.sin(a); return [c, 0, -s, 0, 0, 1, 0, 0, s, 0, c, 0, 0, 0, 0, 1]; }
function rotX(a) { const c = Math.cos(a), s = Math.sin(a); return [1, 0, 0, 0, 0, c, s, 0, 0, -s, c, 0, 0, 0, 0, 1]; }
function rotZ(a) { const c = Math.cos(a), s = Math.sin(a); return [c, s, 0, 0, -s, c, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]; }
function translate(x, y, z) { return [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, x, y, z, 1]; }
function scaleM(s) { return [s, 0, 0, 0, 0, s, 0, 0, 0, 0, s, 0, 0, 0, 0, 1]; }

// ---------- icosahedron geometry ----------
function icosahedron() {
  const t = (1 + Math.sqrt(5)) / 2;
  const raw = [
    [-1, t, 0], [1, t, 0], [-1, -t, 0], [1, -t, 0],
    [0, -1, t], [0, 1, t], [0, -1, -t], [0, 1, -t],
    [t, 0, -1], [t, 0, 1], [-t, 0, -1], [-t, 0, 1],
  ];
  const verts = raw.map(v => {
    const l = Math.hypot(v[0], v[1], v[2]);
    return [v[0] / l, v[1] / l, v[2] / l];
  });
  const edges = [
    [0, 1], [0, 5], [0, 7], [0, 10], [0, 11], [1, 5], [1, 7], [1, 8], [1, 9],
    [2, 3], [2, 4], [2, 6], [2, 10], [2, 11], [3, 4], [3, 6], [3, 8], [3, 9],
    [4, 5], [4, 9], [4, 11], [5, 9], [5, 11], [6, 7], [6, 8], [6, 10],
    [7, 8], [7, 10], [8, 9], [10, 11],
  ];
  return { verts, edges };
}

// ---------- WebGL mini renderer ----------
const VERT = `
precision mediump float;
attribute vec3 aPos; attribute float aSize; attribute float aAlpha;
uniform mat4 uProj, uModel; uniform float uEnergy;
varying float vAlpha;
void main(){
  gl_Position = uProj * uModel * vec4(aPos, 1.0);
  gl_PointSize = aSize * (1.0 + uEnergy * 0.9);
  vAlpha = aAlpha;
}`;
const FRAG = `
precision mediump float;
uniform vec3 uColor; uniform float uEnergy; uniform float uPoints;
varying float vAlpha;
void main(){
  float a = vAlpha;
  if (uPoints > 0.5) {
    vec2 d = gl_PointCoord - 0.5;
    float r = length(d);
    if (r > 0.5) discard;
    a *= smoothstep(0.5, 0.08, r);
  }
  vec3 c = uColor * (1.0 + uEnergy * 0.6);
  gl_FragColor = vec4(c, a);
}`;

function createGLScene(canvas) {
  const gl = canvas.getContext('webgl', { alpha: true, antialias: true, premultipliedAlpha: false })
    || canvas.getContext('experimental-webgl', { alpha: true, antialias: true });
  if (!gl) throw new Error('webgl unavailable');
  const compile = (type, src) => {
    const sh = gl.createShader(type);
    gl.shaderSource(sh, src); gl.compileShader(sh);
    if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) throw new Error('shader');
    return sh;
  };
  const prog = gl.createProgram();
  gl.attachShader(prog, compile(gl.VERTEX_SHADER, VERT));
  gl.attachShader(prog, compile(gl.FRAGMENT_SHADER, FRAG));
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error('link');
  gl.useProgram(prog);
  gl.enable(gl.BLEND);
  gl.blendFunc(gl.SRC_ALPHA, gl.ONE); // additive glow
  gl.disable(gl.DEPTH_TEST);
  const loc = {
    aPos: gl.getAttribLocation(prog, 'aPos'),
    aSize: gl.getAttribLocation(prog, 'aSize'),
    aAlpha: gl.getAttribLocation(prog, 'aAlpha'),
    uProj: gl.getUniformLocation(prog, 'uProj'),
    uModel: gl.getUniformLocation(prog, 'uModel'),
    uColor: gl.getUniformLocation(prog, 'uColor'),
    uEnergy: gl.getUniformLocation(prog, 'uEnergy'),
    uPoints: gl.getUniformLocation(prog, 'uPoints'),
  };
  const makeBuffer = data => {
    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(data), gl.STATIC_DRAW);
    return { buf, count: data.length / 5 };
  };
  const draw = (buffer, mode, model, color, energy, points) => {
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer.buf);
    gl.enableVertexAttribArray(loc.aPos);
    gl.enableVertexAttribArray(loc.aSize);
    gl.enableVertexAttribArray(loc.aAlpha);
    gl.vertexAttribPointer(loc.aPos, 3, gl.FLOAT, false, 20, 0);
    gl.vertexAttribPointer(loc.aSize, 1, gl.FLOAT, false, 20, 12);
    gl.vertexAttribPointer(loc.aAlpha, 1, gl.FLOAT, false, 20, 16);
    gl.uniformMatrix4fv(loc.uModel, false, model);
    gl.uniform3fv(loc.uColor, color);
    gl.uniform1f(loc.uEnergy, energy);
    gl.uniform1f(loc.uPoints, points ? 1 : 0);
    gl.drawArrays(mode, 0, buffer.count);
  };
  const resize = () => {
    const dpr = DPR();
    const w = Math.max(1, Math.round(canvas.clientWidth * dpr));
    const h = Math.max(1, Math.round(canvas.clientHeight * dpr));
    if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
    gl.viewport(0, 0, w, h);
    gl.uniformMatrix4fv(loc.uProj, false, perspective(Math.PI / 4.2, w / h, 0.1, 100));
  };
  const clear = () => { gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT); };
  return { gl, makeBuffer, draw, resize, clear };
}

// pack [x,y,z,size,alpha] tuples
const p5 = (x, y, z, s, a) => [x, y, z, s, a];

// ---------- shared animation shell ----------
function runLoop(canvas, renderFrame) {
  let raf = 0, last = performance.now(), dead = false;
  const resizeHandler = () => renderFrame(0);
  const frame = now => {
    if (dead) return;
    const dt = Math.min((now - last) / 1000, 0.05);
    last = now;
    try { renderFrame(dt); } catch { stop(); }
    if (!REDUCED) raf = requestAnimationFrame(frame);
  };
  const stop = () => { dead = true; cancelAnimationFrame(raf); removeEventListener('resize', resizeHandler); };
  addEventListener('resize', resizeHandler);
  renderFrame(0);
  if (!REDUCED) raf = requestAnimationFrame(frame);
  return { stop };
}

// ---------- SVG fallback (zero-JS-animation ring) ----------
function svgFallback(canvas) {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 200 200');
  svg.setAttribute('class', 'pxl-core-svg-fallback');
  svg.setAttribute('aria-hidden', 'true');
  svg.innerHTML =
    '<circle cx="100" cy="100" r="70" fill="none" stroke="rgba(242,84,45,.35)" stroke-width="1.5" stroke-dasharray="4 7" class="pxl-svg-spin-a"/>' +
    '<circle cx="100" cy="100" r="52" fill="none" stroke="rgba(242,84,45,.55)" stroke-width="1" stroke-dasharray="2 5" class="pxl-svg-spin-b"/>' +
    '<circle cx="100" cy="100" r="8" fill="rgba(242,84,45,.85)"/>';
  canvas.replaceWith(svg);
  return { pulse() {}, type() {}, setStage() {}, stop() {} };
}

// ---------- Canvas 2D fallbacks ----------
function core2DFallback(canvas) {
  const ctx = canvas.getContext('2d');
  if (!ctx) return svgFallback(canvas);
  const { verts } = icosahedron();
  let rot = 0, tilt = 0, targetTilt = 0, energy = 0;
  let hue = DOMAIN_HUES.web.slice();
  const rgb = c => `rgba(${Math.round(c[0] * 255)},${Math.round(c[1] * 255)},${Math.round(c[2] * 255)}`;
  const onMove = e => { targetTilt = ((e.clientX / innerWidth) - 0.5) * 0.9; };
  addEventListener('pointermove', onMove, { passive: true });
  const loop = runLoop(canvas, dt => {
    const dpr = DPR(), w = canvas.clientWidth * dpr, h = canvas.clientHeight * dpr;
    if (canvas.width !== w) { canvas.width = w; canvas.height = h; }
    ctx.clearRect(0, 0, w, h);
    rot += dt * (0.35 + energy * 1.4);
    tilt = lerp(tilt, targetTilt, 0.06);
    energy *= Math.exp(-dt * 2.2);
    const cx = w / 2, cy = h / 2, R = Math.min(w, h) * 0.26;
    // orbiting particles
    const n = isMobile() ? 60 : 140;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + rot * 0.7;
      const rr = R * (1.35 + 0.12 * Math.sin(i * 3.1));
      const x = cx + Math.cos(a) * rr, y = cy + Math.sin(a) * rr * 0.32 + Math.sin(a * 2 + rot) * 4 * dpr;
      ctx.fillStyle = rgb(hue) + `,${0.14 + 0.2 * Math.sin(i + rot * 2) ** 2 + energy * 0.3})`;
      ctx.beginPath(); ctx.arc(x, y, (1.1 + energy * 1.4) * dpr, 0, 7); ctx.fill();
    }
    // wireframe core
    ctx.strokeStyle = rgb(hue) + `,${0.5 + energy * 0.4})`;
    ctx.lineWidth = dpr;
    ctx.beginPath();
    verts.forEach((v, i) => {
      const x3 = v[0] * Math.cos(rot) - v[2] * Math.sin(rot);
      const z3 = v[0] * Math.sin(rot) + v[2] * Math.cos(rot);
      const y3 = v[1] * Math.cos(tilt) - z3 * Math.sin(tilt);
      const s = 1 / (1 + z3 * 0.18);
      const x = cx + x3 * R * s, y = cy + y3 * R * s;
      i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
    });
    ctx.stroke();
    ctx.fillStyle = rgb(hue) + `,${0.35 + energy * 0.45})`;
    ctx.beginPath(); ctx.arc(cx, cy, R * (0.22 + energy * 0.1), 0, 7); ctx.fill();
  });
  return {
    pulse(domain) { const h = DOMAIN_HUES[domain]; if (h) hue = h; energy = 1; },
    type() { energy = Math.min(1, energy + 0.25); },
    setStage() {},
    stop() { loop.stop(); removeEventListener('pointermove', onMove); },
  };
}

function pipeline2DFallback(canvas) {
  const ctx = canvas.getContext('2d');
  if (!ctx) return svgFallback(canvas);
  let stage = 0, t = 0;
  const nodePos = i => [(i / 4) * 2 - 1, Math.sin((i / 4) * Math.PI * 1.6) * 0.35];
  const loop = runLoop(canvas, dt => {
    const dpr = DPR(), w = canvas.clientWidth * dpr, h = canvas.clientHeight * dpr;
    if (canvas.width !== w) { canvas.width = w; canvas.height = h; }
    ctx.clearRect(0, 0, w, h);
    t = (t + dt * 0.25) % 1;
    const cx = w / 2, cy = h / 2, SX = w * 0.4, SY = h * 0.5;
    const P = i => { const p = nodePos(i); return [cx + p[0] * SX, cy - p[1] * SY]; };
    // splines
    for (let e = 0; e < 4; e++) {
      const active = e < stage;
      ctx.strokeStyle = active ? 'rgba(242,84,45,.7)' : 'rgba(255,255,255,.14)';
      ctx.lineWidth = (active ? 1.6 : 1) * dpr;
      ctx.beginPath();
      for (let s = 0; s <= 24; s++) {
        const f = s / 24, p0 = nodePos(e), p1 = nodePos(e + 1);
        const x = cx + lerp(p0[0], p1[0], f) * SX;
        const y = cy - lerp(p0[1], p1[1], f) * SY - Math.sin(f * Math.PI) * 10 * dpr;
        s ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
      }
      ctx.stroke();
    }
    // traveling pulse
    const seg = Math.min(3, Math.floor(t * 4)), f = t * 4 - seg;
    const p0 = nodePos(seg), p1 = nodePos(seg + 1);
    const px = cx + lerp(p0[0], p1[0], f) * SX, py = cy - lerp(p0[1], p1[1], f) * SY - Math.sin(f * Math.PI) * 10 * dpr;
    ctx.fillStyle = 'rgba(242,84,45,.95)';
    ctx.beginPath(); ctx.arc(px, py, 3.4 * dpr, 0, 7); ctx.fill();
    // nodes
    for (let i = 0; i < 5; i++) {
      const [x, y] = P(i), on = i <= stage, heal = i === 4 && stage >= 4;
      const col = heal ? '16,185,129' : '242,84,45';
      if (on) { ctx.fillStyle = `rgba(${col},.18)`; ctx.beginPath(); ctx.arc(x, y, 13 * dpr, 0, 7); ctx.fill(); }
      ctx.fillStyle = on ? `rgba(${col},1)` : 'rgba(255,255,255,.22)';
      ctx.beginPath(); ctx.arc(x, y, (on ? 5 : 3.5) * dpr, 0, 7); ctx.fill();
      if (heal) {
        const rip = (performance.now() / 1400) % 1;
        ctx.strokeStyle = `rgba(16,185,129,${(1 - rip) * 0.5})`;
        ctx.lineWidth = dpr;
        ctx.beginPath(); ctx.arc(x, y, (8 + rip * 26) * dpr, 0, 7); ctx.stroke();
      }
    }
  });
  return { setStage(i) { stage = Math.max(0, Math.min(4, i | 0)); }, pulse() {}, type() {}, stop() { loop.stop(); } };
}

// ---------- WebGL: Creation Core ----------
function coreGL(canvas) {
  const scene = createGLScene(canvas);
  const { verts, edges } = icosahedron();
  const lineData = [];
  edges.forEach(([a, b]) => { lineData.push(...p5(...verts[a], 1, 0.62), ...p5(...verts[b], 1, 0.62)); });
  const vertData = [];
  verts.forEach(v => vertData.push(...p5(...v, 7, 0.95)));
  const ringData = [];
  const N = isMobile() ? 90 : 220;
  for (let i = 0; i < N; i++) {
    const a = (i / N) * Math.PI * 2, r = 1.55 + (Math.sin(i * 12.9898) * 0.5) * 0.16;
    ringData.push(...p5(Math.cos(a) * r, (Math.sin(i * 78.233) * 0.5) * 0.14, Math.sin(a) * r, 2.4 + (i % 5) * 0.5, 0.28 + (i % 7) * 0.05));
  }
  const lines = scene.makeBuffer(lineData), points = scene.makeBuffer(vertData), ring = scene.makeBuffer(ringData);

  let rot = 0, tiltX = 0, tiltY = 0, targetX = 0, targetY = 0, energy = 0;
  let hue = DOMAIN_HUES.web.slice(), targetHue = hue.slice();
  const onMove = e => {
    targetY = ((e.clientX / innerWidth) - 0.5) * 0.8;
    targetX = ((e.clientY / innerHeight) - 0.5) * 0.5;
  };
  addEventListener('pointermove', onMove, { passive: true });

  const loop = runLoop(canvas, dt => {
    scene.resize();
    scene.clear();
    rot += dt * (0.3 + energy * 1.6);
    tiltX = lerp(tiltX, targetX, 0.055);
    tiltY = lerp(tiltY, targetY, 0.055);
    energy *= Math.exp(-dt * 2.1);
    hue = lerp3(hue, targetHue, 0.045);
    const view = translate(0, 0, -5.6);
    const base = multiply(view, multiply(rotX(tiltX), rotY(rot + tiltY)));
    scene.draw(lines, scene.gl.LINES, base, hue, energy, false);
    scene.draw(points, scene.gl.POINTS, base, hue, energy, true);
    const ringModel = multiply(view, multiply(rotX(0.42 + tiltX * 0.6), multiply(rotY(-rot * 0.55), rotZ(0.2))));
    scene.draw(ring, scene.gl.POINTS, ringModel, hue, energy * 0.8, true);
  });

  return {
    pulse(domain) { const h = DOMAIN_HUES[domain]; if (h) targetHue = h; energy = 1; },
    type() { energy = Math.min(1, energy + 0.22); },
    setStage() {},
    stop() { loop.stop(); removeEventListener('pointermove', onMove); },
  };
}

// ---------- WebGL: Execution Pipeline ----------
function pipelineGL(canvas) {
  const scene = createGLScene(canvas);
  const nodePos = i => {
    const f = i / 4;
    return [lerp(-3.1, 3.1, f), Math.sin(f * Math.PI * 1.55) * 0.85, Math.cos(f * Math.PI) * 0.3];
  };
  // subdivided spline segments between nodes
  const edgeData = [];
  for (let e = 0; e < 4; e++) {
    const p0 = nodePos(e), p1 = nodePos(e + 1);
    for (let s = 0; s < 26; s++) {
      const f0 = s / 26, f1 = (s + 1) / 26;
      const arc = f => Math.sin(f * Math.PI) * 0.28;
      edgeData.push(
        ...p5(lerp(p0[0], p1[0], f0), lerp(p0[1], p1[1], f0) + arc(f0), lerp(p0[2], p1[2], f0), 1, 0.32),
        ...p5(lerp(p0[0], p1[0], f1), lerp(p0[1], p1[1], f1) + arc(f1), lerp(p0[2], p1[2], f1), 1, 0.32));
    }
  }
  const edges = scene.makeBuffer(edgeData);
  const nodeBufs = [];
  for (let i = 0; i < 5; i++) nodeBufs.push(scene.makeBuffer(p5(...nodePos(i), 15, 1)));
  const haloBufs = [];
  for (let i = 0; i < 5; i++) haloBufs.push(scene.makeBuffer(p5(...nodePos(i), 34, 0.16)));
  const pulseBuf = scene.makeBuffer(p5(0, 0, 0, 12, 1));
  // ripple ring (unit circle, scaled per frame)
  const ripData = [];
  for (let s = 0; s < 48; s++) {
    const a0 = (s / 48) * Math.PI * 2, a1 = ((s + 1) / 48) * Math.PI * 2;
    ripData.push(...p5(Math.cos(a0), Math.sin(a0), 0, 1, 0.5), ...p5(Math.cos(a1), Math.sin(a1), 0, 1, 0.5));
  }
  const ripple = scene.makeBuffer(ripData);

  let stage = 0, t = 0, drift = 0;
  const loop = runLoop(canvas, dt => {
    scene.resize();
    scene.clear();
    t = (t + dt * 0.22) % 1;
    drift += dt;
    const view = multiply(translate(0, 0, -7.2), multiply(rotX(-0.24 + Math.sin(drift * 0.3) * 0.02), rotY(Math.sin(drift * 0.22) * 0.05)));
    scene.draw(edges, scene.gl.LINES, view, [0.949, 0.329, 0.176], 0.1, false);
    // traveling pulse along the path
    const seg = Math.min(3, Math.floor(t * 4)), f = t * 4 - seg;
    const p0 = nodePos(seg), p1 = nodePos(seg + 1);
    const pp = [lerp(p0[0], p1[0], f), lerp(p0[1], p1[1], f) + Math.sin(f * Math.PI) * 0.28, lerp(p0[2], p1[2], f)];
    scene.draw(pulseBuf, scene.gl.POINTS, multiply(view, translate(...pp)), [1, 0.62, 0.4], 0.7, true);
    for (let i = 0; i < 5; i++) {
      const on = i <= stage, heal = i === 4 && stage >= 4;
      const col = heal ? SELF_HEAL_GREEN : on ? [0.949, 0.329, 0.176] : [0.55, 0.55, 0.58];
      const breathe = on ? 0.15 + 0.1 * Math.sin(drift * 2 + i) : 0;
      scene.draw(haloBufs[i], scene.gl.POINTS, view, col, breathe, true);
      scene.draw(nodeBufs[i], scene.gl.POINTS, view, col, on ? 0.25 : 0, true);
    }
    if (stage >= 4) {
      const rip = (performance.now() / 1500) % 1;
      const p4 = nodePos(4);
      const m = multiply(view, multiply(translate(...p4), multiply(rotX(-0.24), scaleM(0.25 + rip * 1.1))));
      scene.gl.blendFunc(scene.gl.SRC_ALPHA, scene.gl.ONE);
      scene.draw(ripple, scene.gl.LINES, m, SELF_HEAL_GREEN, (1 - rip) * 0.6, false);
    }
  });
  return { setStage(i) { stage = Math.max(0, Math.min(4, i | 0)); }, pulse() {}, type() {}, stop() { loop.stop(); } };
}

// ---------- public API ----------
export function initCreationCore(canvas) {
  if (!canvas) return null;
  try { return coreGL(canvas); } catch { /* fall through */ }
  try { return core2DFallback(canvas); } catch { /* fall through */ }
  try { return svgFallback(canvas); } catch { return null; }
}

export function initPipeline(canvas) {
  if (!canvas) return null;
  try { return pipelineGL(canvas); } catch { /* fall through */ }
  try { return pipeline2DFallback(canvas); } catch { /* fall through */ }
  try { return svgFallback(canvas); } catch { return null; }
}
