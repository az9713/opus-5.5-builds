// Studio core: timeline, scene switching, transitions, karaoke captions, sound-word overlay,
// paper texture, live preview and the renderFrame(t) hook that render.mjs calls.
const W = 1280, H = 720;
const T = window.TIMING;
const STATE = { t: 0 };
const SCENES = window.Scenes.list; // filled by scenes/partN.js via Scenes.register(n, {draw})
window.SCENE_ERRORS = [];

// ---------- scene context ----------
function partIndexAt(t) {
  for (let i = 0; i < T.parts.length; i++) if (t < T.parts[i].t1) return i;
  return T.parts.length - 1;
}
function makeContext(pi, t) {
  const part = T.parts[pi], lt = t - part.t0;
  let li = -1;
  part.lines.forEach((l, i) => { if (t >= l.t0) li = i; });
  const line = li >= 0 ? part.lines[li] : null;
  let word = -1;
  if (line) line.words.forEach((w, i) => { if (t >= w.t0) word = i; });
  const beat = t / T.beat, beatFrac = beat - Math.floor(beat);
  return {
    t, lt, dur: part.t1 - part.t0, part, lines: part.lines, line, li,
    lp: line ? Kit.clamp((t - line.t0) / (line.t1 - line.t0)) : 0,
    word, beat, beatInBar: Math.floor(beat) % 4, bar: Math.floor(beat / 4), pulse: Math.exp(-beatFrac * 5),
    W, H, events: T.events,
    since(type) { let best = Infinity; for (const e of T.events) if (e.type === type && e.t <= t) best = t - e.t; return best; },
  };
}

function drawScene(pi, t) {
  const scene = SCENES[pi];
  if (!scene) { drawMissing(pi); return; }
  try { push(); scene.draw(makeContext(pi, t)); pop(); }
  catch (e) {
    pop();
    window.SCENE_ERRORS.push(`part ${pi + 1} @ ${t.toFixed(2)}s: ${e && e.stack ? e.stack.split('\n').slice(0, 3).join(' | ') : e}`);
    drawMissing(pi);
  }
}
function drawMissing(pi) {
  Kit.gradient(0, 0, W, H, Kit.PAL.skyTop, Kit.PAL.skyLow);
  Kit.sea(STATE.t, 470, Kit.PAL.sea);
  Kit.label(`Part ${pi + 1}: ${T.parts[pi].name}`, W / 2, 200, { size: 44 });
}

// ---------- transitions between parts ----------
const TRANS_HALF = 0.55;
const TRANS_STYLE = ['wave', 'wave', 'cloud', 'flash', 'sunburst', 'wave']; // boundary before part 2..7
function activeTransition(t) {
  for (let i = 1; i < T.parts.length; i++) {
    const b = T.parts[i].t0;
    if (Math.abs(t - b) < TRANS_HALF) return { style: TRANS_STYLE[i - 1], u: (t - (b - TRANS_HALF)) / (2 * TRANS_HALF), i };
  }
  return null;
}
function drawTransition(tr) {
  const { u } = tr, P = Kit.PAL, e = Kit.ease.inOut(u);
  if (tr.style === 'wave') {
    // A big painted wave rolls across the screen; it covers everything at u = 0.5.
    const cx = Kit.lerp(-W * 1.05, W * 2.05, e), half = W * 0.95;
    const edge = (x0, dir) => { const pts = []; for (let y = -20; y <= H + 20; y += 40) pts.push([x0 + dir * (Math.sin(y * 0.018 + u * 9) * 40 + Math.sin(y * 0.041) * 18), y]); return pts; };
    const right = edge(cx + half, 1), left = edge(cx - half, -1).reverse();
    Kit.poly([...right, ...left], P.seaDeep, { weight: 5 });
    const band = edge(cx + half - 70, 1), bandL = edge(cx + half - 150, 1).reverse();
    Kit.poly([...band, ...bandL], P.sea, { stroke: false });
    for (let y = 0; y < H; y += 60) Kit.circle(cx + half + Math.sin(y * 0.018 + u * 9) * 40 - 8, y + 20, 26, P.foam, { weight: 3 });
  } else if (tr.style === 'cloud') {
    // Storm clouds roll down from the top.
    const cy = Kit.lerp(-H * 1.05, H * 2.05, e), half = H * 0.95;
    Kit.rect(-20, cy - half, W + 40, half * 2, P.stormSky, { stroke: false });
    for (let x = -60; x < W + 100; x += 150) { Kit.cloud(x, cy + half, 260, P.cloudStorm); Kit.cloud(x + 70, cy - half, 260, P.cloudStorm); }
  } else if (tr.style === 'flash') {
    // Lightning: white-out, switch scenes behind it, fade back.
    Kit.flash(Math.pow(Kit.ping(u), 0.6));
    if (u > 0.2 && u < 0.5) Kit.bolt(W * 0.55, -10, H * 0.8);
  } else if (tr.style === 'sunburst') {
    // The sun breaks through: a golden disc grows from the middle, then shrinks away to reveal the new scene.
    const r = Kit.ping(u) * 900;
    for (let i = 0; i < 16; i++) { const a = u * 2 + i * Math.PI / 8; Kit.streak(W / 2, H / 2, W / 2 + Math.cos(a) * r * 1.4, H / 2 + Math.sin(a) * r * 1.4, r * 0.18, '#ffc21f', 220); }
    Kit.circle(W / 2, H / 2, r, P.sun, { weight: 5 });
  }
}

// ---------- DOM overlay: flash, sound words, labels, captions ----------
let dom = {};
function buildOverlay() {
  const stage = document.getElementById('stage');
  const mk = (cls, parent = stage) => { const d = document.createElement('div'); d.className = cls; parent.appendChild(d); return d; };
  dom.paper = mk('paper'); dom.paper.style.backgroundImage = `url(${makePaperTexture()})`;
  dom.vignette = mk('vignette');
  dom.flash = mk('flash');
  dom.labels = mk('layer'); dom.sfx = mk('layer');
  dom.cap = mk('cap'); dom.capLine = mk('capline', dom.cap);
  dom.labelPool = []; dom.sfxPool = []; dom.capKey = null; dom.capSpans = [];
}
function pool(arr, parent, cls, n) { while (arr.length < n) { const d = document.createElement('div'); d.className = cls; parent.appendChild(d); arr.push(d); } return arr; }

function syncOverlay(t) {
  dom.flash.style.opacity = Kit._flash.toFixed(3);
  // sound words
  const sp = pool(dom.sfxPool, dom.sfx, 'sfx', Kit._sfx.length);
  sp.forEach((d, i) => {
    const s = Kit._sfx[i];
    if (!s) { d.style.display = 'none'; return; }
    const pop = s.age < 0.14 ? Kit.ease.outBack(s.age / 0.14) : 1 + 0.04 * Math.sin(s.age * 18);
    const fade = Kit.clamp((s.dur - s.age) / 0.18);
    d.style.display = 'block'; d.textContent = s.text;
    d.style.left = s.x + 'px'; d.style.top = s.y + 'px'; d.style.fontSize = s.size + 'px'; d.style.color = s.color;
    d.style.transform = `translate(-50%,-50%) rotate(${s.rot}rad) scale(${(pop * (0.9 + 0.1 * fade)).toFixed(3)})`;
    d.style.opacity = fade.toFixed(3);
  });
  // labels
  const lp = pool(dom.labelPool, dom.labels, 'label', Kit._labels.length);
  lp.forEach((d, i) => {
    const s = Kit._labels[i];
    if (!s) { d.style.display = 'none'; return; }
    d.style.display = 'block'; d.textContent = s.text; d.className = 'label ' + s.font;
    d.style.left = s.x + 'px'; d.style.top = s.y + 'px'; d.style.fontSize = s.size + 'px'; d.style.color = s.color; d.style.opacity = s.alpha;
    d.style.transform = `translate(-50%,-50%) rotate(${s.rot}rad)`;
  });
  syncCaptions(t);
}

function captionLine(t) {
  const lines = T.parts.flatMap(p => p.lines);
  if (t < T.parts[0].t0 - 0.3) return { key: 'intro', words: [{ w: '~ fiddle intro ~', t0: 1e9, t1: 1e9 }], dim: true };
  if (t >= T.outro.t0 - 0.2) {
    const hey = T.events.find(e => e.type === 'hey').t;
    return { key: 'outro', words: [{ w: 'Stomp!', t0: T.outro.t0, t1: T.outro.t0 + T.beat }, { w: 'Stomp!', t0: T.outro.t0 + T.beat, t1: hey }, { w: 'HEY!', t0: hey, t1: hey + 2 }] };
  }
  let cur = lines[0];
  for (const l of lines) if (t >= l.t0 - 0.3) cur = l;
  return { key: 'L' + cur.index, words: cur.words };
}
function syncCaptions(t) {
  const c = captionLine(t);
  if (dom.capKey !== c.key) {
    dom.capKey = c.key; dom.capLine.replaceChildren(); dom.capSpans = [];
    c.words.forEach(w => { const s = document.createElement('span'); s.textContent = w.w; dom.capLine.appendChild(s); dom.capSpans.push(s); });
    dom.cap.classList.toggle('dim', !!c.dim);
  }
  c.words.forEach((w, i) => {
    const s = dom.capSpans[i], sung = t >= w.t0, current = sung && t < w.t1;
    s.className = current ? 'cur' : sung ? 'sung' : '';
  });
}

// Paper grain + faint brush streaks, generated once; multiplied over the canvas by CSS.
function makePaperTexture() {
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  const g = c.getContext('2d');
  g.fillStyle = '#ffffff'; g.fillRect(0, 0, W, H);
  const img = g.getImageData(0, 0, W, H), d = img.data;
  for (let i = 0; i < d.length; i += 4) { const n = 236 + Kit.rand('grain', i) * 19; d[i] = n; d[i + 1] = n - 2; d[i + 2] = n - 7; }
  g.putImageData(img, 0, 0);
  g.globalAlpha = 0.022;
  for (let i = 0; i < 260; i++) { // dry-brush streaks
    const x = Kit.rand('sx', i) * W, y = Kit.rand('sy', i) * H, len = 60 + Kit.rand('sl', i) * 220, a = -0.3 + Kit.rand('sa', i) * 0.6;
    g.strokeStyle = Kit.rand('sc', i) > 0.5 ? '#8a6a40' : '#5a4a3a'; g.lineWidth = 2 + Kit.rand('sw', i) * 10; g.lineCap = 'round';
    g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(a) * len, y + Math.sin(a) * len); g.stroke();
  }
  g.globalAlpha = 0.06;
  for (let i = 0; i < 40; i++) { // soft blotches
    const x = Kit.rand('bx', i) * W, y = Kit.rand('by', i) * H, r = 40 + Kit.rand('br', i) * 160;
    const gr = g.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, '#7a5a30'); gr.addColorStop(1, 'rgba(122,90,48,0)');
    g.fillStyle = gr; g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
  }
  return c.toDataURL('image/png');
}

// ---------- p5 ----------
function setup() {
  const cnv = createCanvas(W, H, WEBGL);
  cnv.parent('stage');
  pixelDensity(1);
  brush.scaleBrushes(2.5);
  noLoop();
  buildOverlay();
  window.studioReady = true;
  if (!window.RENDER) startPreview();
}
function draw() {
  const t = STATE.t;
  Kit.beginFrame(t);
  background(Kit.PAL.paper);
  push(); translate(-W / 2, -H / 2);
  drawScene(partIndexAt(t), t);
  const tr = activeTransition(t);
  if (tr) drawTransition(tr);
  pop();
}
window.renderFrame = async function (t) {
  STATE.t = t;
  const t0 = performance.now();
  await redraw();
  syncOverlay(t);
  return performance.now() - t0;
};

// ---------- live preview (open studio.html in Chrome) ----------
function startPreview() {
  const ui = document.getElementById('ui'), audio = document.getElementById('audio');
  audio.src = 'assets/shanty.wav'; audio.preload = 'auto'; // loaded only in preview, never while rendering
  ui.style.display = 'flex';
  const q = new URLSearchParams(location.search);
  if (q.has('t')) audio.currentTime = +q.get('t');
  const btn = document.getElementById('play'), bar = document.getElementById('scrub'), lab = document.getElementById('time');
  bar.max = T.duration;
  btn.onclick = () => { if (audio.paused) audio.play(); else audio.pause(); };
  bar.oninput = () => { audio.currentTime = +bar.value; };
  let busy = false;
  const loop = async () => {
    if (!busy) {
      busy = true;
      const t = audio.currentTime;
      await window.renderFrame(t);
      bar.value = t; lab.textContent = t.toFixed(1) + 's'; btn.textContent = audio.paused ? 'Play' : 'Pause';
      busy = false;
    }
    requestAnimationFrame(loop);
  };
  loop();
}
