// Kit: the shared drawing library for every scene. Read ANIMATION_GUIDE.md first.
// Coordinates: top-left origin, 1280 x 720 (the core translates the WEBGL canvas for you).
// Every shape goes through p5.brush: flat "wash" fill + wobbly "pen" ink outline.
(function () {
  const W = 1280, H = 720;
  const PAL = {
    ink: '#1d130c', paper: '#f3e6c8',
    clawd: '#d97757', clawdDark: '#b45c3e', clawdLight: '#ec9a78',
    coat: '#fbfaf5', coatShade: '#dcdcd4', skin: '#f1c7a0', hair: '#6b4f3a', pants: '#3a3f58', shoe: '#2a211b',
    wood: '#9a6433', woodLight: '#b97d45', woodDark: '#5f3b1c', rope: '#cfb07a', sail: '#f4ecd8', sailShade: '#ddd2b8',
    sea: '#2f7aa6', seaDeep: '#1f587d', seaLight: '#5aa6c9', foam: '#eef7f4',
    stormSea: '#23405a', stormSeaDeep: '#172b3d', stormSky: '#3d4658', stormSkyLow: '#5b6479',
    skyTop: '#8fcde6', skyLow: '#f7e8c4', sun: '#ffd23f', sunset: '#f7a35c',
    cloud: '#ffffff', cloudStorm: '#6b7285', grass: '#6aa84f', sand: '#ecd29a', rock: '#8a8577',
    yellow: '#ffd83d', red: '#d64545', blue: '#3a6fd8', green: '#58a55c', gull: '#f7f7f2',
  };
  const INK_W = 4; // default pen weight (at brush.scaleBrushes(2.5)) — reads well at 1280x720

  // ---------- deterministic helpers ----------
  function hash(...parts) {
    let h = 2166136261 >>> 0;
    const s = parts.join('|');
    for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; }
    return h;
  }
  // rand(key...) -> stable number in [0,1) for the same key. Never use Math.random() or p5 random().
  const rand = (...k) => hash(...k) / 4294967296;
  const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
  const lerp = (a, b, u) => a + (b - a) * u;
  const inv = (a, b, x) => clamp((x - a) / (b - a)); // 0..1 progress of x between a and b
  const ease = {
    in: u => u * u, out: u => 1 - (1 - u) * (1 - u),
    inOut: u => (u < 0.5 ? 2 * u * u : 1 - Math.pow(-2 * u + 2, 2) / 2),
    outBack: u => { const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(u - 1, 3) + c1 * Math.pow(u - 1, 2); },
    outElastic: u => (u === 0 || u === 1 ? u : Math.pow(2, -10 * u) * Math.sin((u * 10 - 0.75) * (2 * Math.PI / 3)) + 1),
    outBounce: u => { const n = 7.5625, d = 2.75; if (u < 1 / d) return n * u * u; if (u < 2 / d) return n * (u -= 1.5 / d) * u + 0.75; if (u < 2.5 / d) return n * (u -= 2.25 / d) * u + 0.9375; return n * (u -= 2.625 / d) * u + 0.984375; },
  };
  const ping = u => Math.sin(Math.PI * clamp(u)); // 0 -> 1 -> 0
  function hex2rgb(h) { const n = parseInt(h.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }
  function mix(c1, c2, u) {
    const a = hex2rgb(c1), b = hex2rgb(c2);
    return '#' + a.map((v, i) => Math.round(lerp(v, b[i], clamp(u))).toString(16).padStart(2, '0')).join('');
  }

  // ---------- frame state (set by the core) ----------
  const K = { W, H, PAL, INK_W, hash, rand, clamp, lerp, inv, ease, ping, mix, t: 0, boil: 0, _n: 0, _sfx: [], _labels: [], _flash: 0 };
  K.beginFrame = function (t) { K.t = t; K.boil = Math.floor(t * 8); K._n = 0; K._sfx = []; K._labels = []; K._flash = 0; };
  // Outline wobble changes 8 times per second ("line boil"), like hand-drawn cartoons.
  function seedNext() { randomSeed(hash(K._n++, K.boil)); }

  // ---------- primitives ----------
  // opts: { stroke: true, weight: INK_W, ink: PAL.ink, alpha: 255 }
  function style(color, o) {
    if (o.stroke === false) brush.noStroke(); else brush.set('pen', o.ink || PAL.ink, o.weight || INK_W);
    if (color) brush.wash(color, o.alpha === undefined ? 255 : o.alpha); else brush.noWash();
    brush.noFill(); brush.noHatch();
  }
  function done() { brush.noWash(); }

  K.poly = function (pts, color, o = {}) { if (pts.length < 3) return; seedNext(); style(color, o); brush.polygon(pts); done(); };
  K.circle = function (x, y, r, color, o = {}) { seedNext(); style(color, o); brush.circle(x, y, r); done(); };
  K.ellipse = function (x, y, rx, ry, color, o = {}) {
    const pts = [], n = o.segments || 28, rot = o.rot || 0;
    for (let i = 0; i < n; i++) { const a = (i / n) * Math.PI * 2, px = Math.cos(a) * rx, py = Math.sin(a) * ry; pts.push([x + px * Math.cos(rot) - py * Math.sin(rot), y + px * Math.sin(rot) + py * Math.cos(rot)]); }
    K.poly(pts, color, o);
  };
  K.rect = function (x, y, w, h, color, o = {}) {
    const r = Math.min(o.r || 0, Math.abs(w) / 2, Math.abs(h) / 2);
    if (!r) return K.poly([[x, y], [x + w, y], [x + w, y + h], [x, y + h]], color, o);
    const pts = [], seg = 5;
    const corners = [[x + w - r, y + r, -Math.PI / 2], [x + w - r, y + h - r, 0], [x + r, y + h - r, Math.PI / 2], [x + r, y + r, Math.PI]];
    for (const [cx, cy, a0] of corners) for (let i = 0; i <= seg; i++) { const a = a0 + (i / seg) * Math.PI / 2; pts.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]); }
    K.poly(pts, color, o);
  };
  K.line = function (x1, y1, x2, y2, o = {}) { seedNext(); brush.set('pen', o.color || PAL.ink, o.weight || INK_W); brush.line(x1, y1, x2, y2); };
  K.curve = function (pts, o = {}) { seedNext(); brush.set('pen', o.color || PAL.ink, o.weight || INK_W); brush.spline(pts, o.curvature === undefined ? 0.5 : o.curvature); };
  // Fast solid streak without outline (rain, speed lines, rope). Almost free.
  K.streak = function (x1, y1, x2, y2, w, color, alpha = 255) {
    const dx = x2 - x1, dy = y2 - y1, len = Math.hypot(dx, dy) || 1, nx = -dy / len * w / 2, ny = dx / len * w / 2;
    brush.noStroke(); brush.wash(color, alpha); brush.polygon([[x1 + nx, y1 + ny], [x2 + nx, y2 + ny], [x2 - nx, y2 - ny], [x1 - nx, y1 - ny]]); brush.noWash();
  };
  // Watercolor fill (painted texture). ~20 ms each: max 3 per frame. key keeps the texture stable between frames.
  K.paint = function (pts, color, opacity = 200, key = 'paint', o = {}) {
    randomSeed(hash('paint', key));
    brush.noStroke(); brush.noWash(); brush.fill(color, opacity); brush.fillBleed(o.bleed === undefined ? 0.05 : o.bleed); brush.fillTexture(o.texture === undefined ? 0.45 : o.texture, o.border === undefined ? 0.35 : o.border, false);
    brush.polygon(pts); brush.noFill();
  };
  // Vertical gradient with no outline (cheap). Used for skies and water depth.
  K.gradient = function (x, y, w, h, cTop, cBottom, steps = 10) {
    brush.noStroke();
    for (let i = 0; i < steps; i++) { brush.wash(mix(cTop, cBottom, i / (steps - 1)), 255); brush.rect(x, y + (h * i) / steps, w, h / steps + 1.5); }
    brush.noWash();
  };

  // ---------- text overlays (DOM, screen coordinates, not affected by translate/rotate) ----------
  // Comic sound word in big yellow letters. age = seconds since the word appeared. Shown while 0 <= age <= dur.
  K.sfx = function (text, x, y, age, o = {}) {
    const dur = o.dur || 0.9;
    if (age < 0 || age > dur) return;
    K._sfx.push({ text, x, y, age, dur, size: o.size || 110, rot: o.rot === undefined ? -0.12 : o.rot, color: o.color || PAL.yellow });
  };
  // Small hand-lettered label (signs, notebook text). Not yellow; ink colored by default.
  K.label = function (text, x, y, o = {}) {
    K._labels.push({ text, x, y, size: o.size || 26, rot: o.rot || 0, color: o.color || PAL.ink, font: o.font || 'comic', alpha: o.alpha === undefined ? 1 : o.alpha });
  };
  // Full-screen white flash (lightning). a in 0..1. The strongest call in a frame wins.
  K.flash = function (a) { K._flash = Math.max(K._flash, clamp(a)); };

  // ---------- characters ----------
  // CLAWD: orange block, two dot eyes, four stubby legs, two side nubs.
  // (x, y) = point on the ground between the feet. s = body width in px (about 120 on deck, 200 for close-ups).
  // o: { facing: 1|-1, walk: phase (radians, increases while walking; leave 0 to stand), squash: -1..1 (+ = flat),
  //      rot: radians, look: [dx, dy] in -1..1, blink: bool, mood: 'happy'|'surprised'|'scared'|'dizzy'|'determined'|'sleepy',
  //      arms: 'down'|'up'|'out', color }
  K.clawd = function (x, y, s, o = {}) {
    const sq = clamp(o.squash || 0, -1, 1), bw = s * (1 + sq * 0.18), bh = s * 0.72 * (1 - sq * 0.2);
    const legH = s * 0.17, legW = s * 0.13, walk = o.walk || 0, f = o.facing || 1;
    const col = o.color || PAL.clawd, mood = o.mood || 'happy';
    push(); translate(x, y); if (o.rot) rotate(o.rot);
    // legs
    [-0.36, -0.13, 0.13, 0.36].forEach((lx, i) => {
      const lift = walk ? Math.max(0, Math.sin(walk + (i % 2) * Math.PI)) * legH * 0.55 : 0;
      K.rect(lx * bw - legW / 2, -legH - lift, legW, legH, o.legColor || PAL.clawdDark, { weight: INK_W * 0.8 });
    });
    const top = -legH - bh;
    // side nubs (arms)
    const arms = o.arms || 'down';
    for (const side of [-1, 1]) {
      const ax = side * bw / 2, ay = top + bh * 0.52;
      const nw = s * 0.14, nh = s * 0.2;
      if (arms === 'up') K.rect(ax - (side < 0 ? nw * 0.7 : nw * 0.3), ay - nh * 2.2, nw, nh * 1.4, col, { weight: INK_W * 0.8 });
      else if (arms === 'out') K.rect(side < 0 ? ax - nw * 1.2 : ax + nw * 0.2, ay - nh * 0.35, nw, nh * 0.7, col, { weight: INK_W * 0.8 });
      else K.rect(side < 0 ? ax - nw * 0.85 : ax - nw * 0.15, ay, nw, nh, col, { weight: INK_W * 0.8 });
    }
    // body block
    K.rect(-bw / 2, top, bw, bh, col, { r: s * 0.03 });
    // soft shading strip on the lower edge (no outline)
    K.rect(-bw / 2 + 4, top + bh * 0.78, bw - 8, bh * 0.18, PAL.clawdDark, { stroke: false, alpha: 90 });
    // eyes
    const lk = o.look || [0, 0], ex = bw * 0.2, ey = top + bh * 0.38 + lk[1] * bh * 0.06, er = s * 0.05, shift = lk[0] * bw * 0.07 + f * bw * 0.03;
    for (const side of [-1, 1]) {
      const cx = side * ex + shift;
      if (o.blink || mood === 'sleepy') K.line(cx - er, ey, cx + er, ey, { weight: INK_W * 1.1 });
      else if (mood === 'dizzy') { K.line(cx - er, ey - er, cx + er, ey + er, { weight: INK_W }); K.line(cx - er, ey + er, cx + er, ey - er, { weight: INK_W }); }
      else if (mood === 'surprised' || mood === 'scared') { K.circle(cx, ey, er * 1.9, '#ffffff', { weight: INK_W * 0.8 }); K.circle(cx + lk[0] * er * 0.5, ey + lk[1] * er * 0.5, er * 0.8, PAL.ink, { stroke: false }); }
      else K.ellipse(cx, ey, er * 0.85, er * 1.25, PAL.ink, { stroke: false, segments: 14 });
    }
    if (mood === 'determined') for (const side of [-1, 1]) K.line(side * ex + shift - er * 1.6 * side, ey - er * 2.6, side * ex + shift + er * 1.2 * side, ey - er * 1.7, { weight: INK_W });
    if (mood === 'scared') K.ellipse(bw * 0.42, top + bh * 0.2, s * 0.035, s * 0.06, '#9fd8f0', { weight: 2 }); // sweat drop
    pop();
  };

  // SCIENTIST: small, white lab coat, round glasses, messy hair.
  // (x, y) = ground point between the shoes. h = full height in px (about 1.5 x Clawd's s).
  // o: { facing, walk, rot, arms: [left, right] angles in radians (0 = hanging down, PI = straight up, + swings forward),
  //      prop: 'none'|'clipboard'|'telescope'|'pipette'|'notebook'|'ruler'|'pencil' (in the front hand),
  //      hair: 'normal'|'static'|'wet', mood: 'happy'|'surprised'|'squint'|'scared'|'dizzy', look: [dx,dy], blink }
  K.scientist = function (x, y, h, o = {}) {
    const f = o.facing || 1, walk = o.walk || 0, mood = o.mood || 'happy';
    const arms = o.arms || [0.15, 0.15];
    push(); translate(x, y); if (o.rot) rotate(o.rot); scale(f, 1);
    const legH = h * 0.24, hip = -legH, sh = -h * 0.7, headY = -h * 0.84, hr = h * 0.14;
    // legs + shoes
    for (const side of [-1, 1]) {
      const sw = walk ? Math.sin(walk + (side > 0 ? Math.PI : 0)) : 0;
      const fx = side * h * 0.06 + sw * h * 0.07, lift = walk ? Math.max(0, -Math.cos(walk + (side > 0 ? Math.PI : 0))) * h * 0.03 : 0;
      K.streak(side * h * 0.05, hip, fx, -h * 0.03 - lift, h * 0.06, PAL.pants);
      K.ellipse(fx + h * 0.025, -h * 0.02 - lift, h * 0.055, h * 0.025, PAL.shoe, { weight: 2.5, segments: 14 });
    }
    // coat
    K.poly([[-h * 0.14, sh], [h * 0.14, sh], [h * 0.21, hip + h * 0.04], [-h * 0.21, hip + h * 0.04]], PAL.coat);
    K.line(0, sh + h * 0.04, 0, hip + h * 0.02, { weight: 2 });
    K.rect(h * 0.05, sh + h * 0.12, h * 0.07, h * 0.06, null, { weight: 2 }); // pocket
    K.streak(h * 0.065, sh + h * 0.13, h * 0.065, sh + h * 0.09, 3, PAL.blue); K.streak(h * 0.09, sh + h * 0.13, h * 0.09, sh + h * 0.095, 3, PAL.red);
    // arms (back arm first)
    const hands = [];
    [[-1, arms[0]], [1, arms[1]]].forEach(([side, a]) => {
      const ax = side * h * 0.12, ay = sh + h * 0.03, len = h * 0.28;
      const hx = ax + Math.sin(a) * len * (side > 0 ? 1 : 0.9), hy = ay + Math.cos(a) * len;
      K.streak(ax, ay, hx, hy, h * 0.07, PAL.coatShade); K.line(ax, ay, hx, hy, { weight: 2 });
      hands.push([hx, hy, a]);
    });
    for (const [hx, hy] of hands) K.circle(hx, hy, h * 0.03, PAL.skin, { weight: 2 });
    // head
    K.circle(0, headY, hr, PAL.skin);
    // hair
    const hair = o.hair || 'normal';
    if (hair === 'static') {
      for (let i = -4; i <= 4; i++) { const a = -Math.PI / 2 + i * 0.28; const r0 = hr * 0.8, r1 = hr * (2.1 + 0.25 * Math.sin(i * 1.7 + K.boil)); K.streak(Math.cos(a) * r0, headY + Math.sin(a) * r0, Math.cos(a) * r1, headY + Math.sin(a) * r1, h * 0.035, PAL.hair); }
    } else if (hair === 'wet') {
      K.poly([[-hr * 1.05, headY - hr * 0.1], [-hr * 0.8, headY - hr * 0.95], [hr * 0.8, headY - hr * 0.95], [hr * 1.05, headY - hr * 0.1], [hr * 0.9, headY + hr * 0.6], [hr * 0.7, headY - hr * 0.3], [-hr * 0.7, headY - hr * 0.3], [-hr * 0.9, headY + hr * 0.6]], PAL.hair, { weight: 2.5 });
    } else {
      K.poly([[-hr * 1.05, headY - hr * 0.15], [-hr * 1.1, headY - hr * 0.8], [-hr * 0.5, headY - hr * 1.25], [0, headY - hr * 1.05], [hr * 0.55, headY - hr * 1.3], [hr * 1.1, headY - hr * 0.75], [hr * 1.05, headY - hr * 0.15], [hr * 0.6, headY - hr * 0.6], [-hr * 0.6, headY - hr * 0.6]], PAL.hair, { weight: 2.5 });
    }
    // glasses + eyes
    const lk = o.look || [0, 0];
    for (const side of [-1, 1]) {
      const gx = side * hr * 0.42 + hr * 0.12, gy = headY - hr * 0.02;
      K.circle(gx, gy, hr * 0.3, '#eef6fb', { weight: 2.5 });
      if (o.blink || mood === 'squint') K.line(gx - hr * 0.15, gy, gx + hr * 0.15, gy, { weight: 2.5 });
      else if (mood === 'dizzy') K.circle(gx, gy, hr * 0.12, null, { weight: 2 });
      else K.circle(gx + lk[0] * hr * 0.1, gy + lk[1] * hr * 0.1, hr * (mood === 'surprised' || mood === 'scared' ? 0.07 : 0.1), PAL.ink, { stroke: false });
    }
    // mouth
    const my = headY + hr * 0.5;
    if (mood === 'surprised' || mood === 'scared') K.ellipse(hr * 0.12, my, hr * 0.13, hr * 0.17, '#7a2e2e', { weight: 2, segments: 12 });
    else K.curve([[-hr * 0.2 + hr * 0.12, my - hr * 0.05], [hr * 0.12, my + hr * 0.1], [hr * 0.32 + hr * 0.12, my - hr * 0.05]], { weight: 2.5 });
    // prop in the front hand
    const [px, py, pa] = hands[1];
    const prop = o.prop || 'none';
    push(); translate(px, py); rotate(-pa);
    if (prop === 'clipboard') { K.rect(-h * 0.02, -h * 0.02, h * 0.13, h * 0.17, '#b88a52', { weight: 2.5, r: 3 }); K.rect(h * 0.0, h * 0.01, h * 0.09, h * 0.13, '#ffffff', { weight: 1.5 }); }
    else if (prop === 'notebook') { K.rect(-h * 0.02, -h * 0.02, h * 0.14, h * 0.11, '#ffffff', { weight: 2.5 }); K.line(h * 0.05, -h * 0.02, h * 0.05, h * 0.09, { weight: 1.5 }); }
    else if (prop === 'telescope') { K.poly([[0, -h * 0.03], [h * 0.34, -h * 0.05], [h * 0.34, h * 0.05], [0, h * 0.03]], '#c9a13b', { weight: 2.5 }); K.rect(h * 0.1, -h * 0.04, h * 0.03, h * 0.08, PAL.woodDark, { weight: 1.5 }); }
    else if (prop === 'pipette') { K.rect(-h * 0.01, 0, h * 0.02, h * 0.16, '#dff3fb', { weight: 2 }); K.circle(0, -h * 0.005, h * 0.02, PAL.red, { weight: 2 }); }
    else if (prop === 'ruler') { K.rect(-h * 0.015, -h * 0.25, h * 0.03, h * 0.35, PAL.yellow, { weight: 2 }); }
    else if (prop === 'pencil') { K.rect(-h * 0.008, -h * 0.02, h * 0.016, h * 0.1, PAL.yellow, { weight: 1.5 }); }
    pop();
    pop();
  };

  // ---------- props ----------
  // SHIP: local origin = middle of the deck, deck surface at y = 0, bow (front) on the right. s = hull length in px.
  // Draw characters after the ship in the same transform so they stand on the deck (y = 0).
  // o: { t (seconds, for the flag), billow: 0..1 (sail wind), sail: true|false (furled when false), crowsNest: true, name: true }
  K.ship = function (s, o = {}) {
    const t = o.t === undefined ? K.t : o.t, billow = o.billow === undefined ? 0.5 : o.billow;
    const mx = -s * 0.04, mastTop = -s * 0.95;
    // mast + boom + sail
    K.rect(mx - s * 0.018, mastTop, s * 0.036, -mastTop, PAL.woodDark, { weight: 3 });
    if (o.sail !== false) {
      const sx0 = mx - s * 0.3, sx1 = mx + s * 0.3, sy0 = mastTop + s * 0.1, sy1 = -s * 0.28, b = s * 0.08 * billow;
      const pts = [[sx0, sy0], [mx, sy0 - s * 0.02], [sx1, sy0]];
      for (let i = 1; i <= 6; i++) { const u = i / 6; pts.push([sx1 + Math.sin(u * Math.PI) * b, lerp(sy0, sy1, u)]); }
      pts.push([mx, sy1 + b * 0.6]);
      for (let i = 6; i >= 1; i--) { const u = i / 6; pts.push([sx0 - Math.sin(u * Math.PI) * b * 0.4, lerp(sy0, sy1, u)]); }
      K.poly(pts, PAL.sail);
      // Clawd emblem on the sail
      K.rect(mx - s * 0.07, lerp(sy0, sy1, 0.35), s * 0.14, s * 0.1, PAL.clawd, { weight: 3 });
      K.circle(mx - s * 0.03, lerp(sy0, sy1, 0.35) + s * 0.035, s * 0.008, PAL.ink, { stroke: false });
      K.circle(mx + s * 0.03, lerp(sy0, sy1, 0.35) + s * 0.035, s * 0.008, PAL.ink, { stroke: false });
      K.rect(sx0 - s * 0.02, sy0 - s * 0.012, sx1 - sx0 + s * 0.04, s * 0.024, PAL.woodDark, { weight: 2.5 }); // yard
    } else {
      K.rect(mx - s * 0.3, -s * 0.8, s * 0.6, s * 0.05, PAL.sailShade, { weight: 2.5, r: 6 });
    }
    // flag
    const fw = s * 0.14, fh = s * 0.07, wv = Math.sin(t * 7) * s * 0.012;
    K.poly([[mx, mastTop], [mx + fw * 0.5, mastTop + wv], [mx + fw, mastTop - wv * 0.5], [mx + fw, mastTop + fh - wv], [mx + fw * 0.5, mastTop + fh + wv], [mx, mastTop + fh]], PAL.clawd, { weight: 2.5 });
    // crow's nest
    if (o.crowsNest !== false) K.rect(mx - s * 0.06, mastTop + s * 0.2, s * 0.12, s * 0.06, PAL.wood, { weight: 3 });
    // rigging lines
    K.line(mx, mastTop + s * 0.02, s * 0.56, -s * 0.07, { weight: 2, color: PAL.woodDark });
    K.line(mx, mastTop + s * 0.02, -s * 0.47, -s * 0.05, { weight: 2, color: PAL.woodDark });
    // hull
    const hull = [[-s * 0.5, -s * 0.07], [-s * 0.47, s * 0.05], [-s * 0.4, s * 0.2], [s * 0.34, s * 0.2], [s * 0.5, s * 0.03], [s * 0.6, -s * 0.12], [s * 0.52, -s * 0.1], [s * 0.45, 0], [-s * 0.44, 0], [-s * 0.5, -s * 0.07]];
    K.poly(hull, PAL.wood);
    K.poly([[-s * 0.47, s * 0.05], [s * 0.5, s * 0.03], [s * 0.34, s * 0.2], [-s * 0.4, s * 0.2]], PAL.woodDark, { weight: 3 });
    K.line(-s * 0.46, s * 0.1, s * 0.45, s * 0.1, { weight: 2, color: PAL.woodDark });
    for (let i = 0; i < 4; i++) K.circle(-s * 0.3 + i * s * 0.18, s * 0.025, s * 0.018, '#f5e3a1', { weight: 2.5 }); // portholes
    // rail
    K.line(-s * 0.46, -s * 0.06, s * 0.5, -s * 0.06, { weight: 3, color: PAL.woodDark });
    for (let i = 0; i <= 8; i++) { const rx = -s * 0.45 + i * s * 0.118; K.streak(rx, -s * 0.06, rx, 0, 3, PAL.woodDark); }
  };

  // SEA band: fills from the wave line down to the bottom of the screen.
  // waveY gives the surface height at x, so a ship can ride the same wave.
  K.waveY = function (x, t, y0, amp = 14, phase = 0, speed = 1) {
    return y0 + Math.sin(x * 0.012 + t * 1.6 * speed + phase) * amp + Math.sin(x * 0.027 - t * 1.1 * speed + phase * 1.7) * amp * 0.45;
  };
  // o: { amp, phase, speed, foam: true, stroke: true, color2 (lower color, adds depth bands) }
  K.sea = function (t, y0, color, o = {}) {
    const amp = o.amp === undefined ? 14 : o.amp, ph = o.phase || 0, sp = o.speed || 1;
    const pts = [];
    for (let x = -20; x <= W + 20; x += 32) pts.push([x, K.waveY(x, t, y0, amp, ph, sp)]);
    const poly = [...pts, [W + 20, H + 20], [-20, H + 20]];
    K.poly(poly, color, { stroke: o.stroke !== false, weight: 3.5 });
    if (o.color2) K.poly([...pts.map(([x, y]) => [x, y + (H - y0) * 0.35 + amp * 0.3]), [W + 20, H + 20], [-20, H + 20]], o.color2, { stroke: false, alpha: 150 });
    if (o.foam !== false) for (let i = 0; i < pts.length - 1; i += 2) { const [x, y] = pts[i]; K.streak(x - 10, y + 6, x + 14, y + 5, 4, PAL.foam, 200); }
  };

  // CLOUD: puffy union of circles with a single outline. s ~ width.
  K.cloud = function (x, y, s, color = PAL.cloud, o = {}) {
    const puffs = [[-0.32, 0.05, 0.22], [-0.1, -0.12, 0.28], [0.16, -0.06, 0.25], [0.34, 0.07, 0.18], [0.02, 0.1, 0.24]];
    if (o.stroke !== false) for (const [px, py, pr] of puffs) K.circle(x + px * s, y + py * s, pr * s, color, { weight: o.weight || 3.5 });
    for (const [px, py, pr] of puffs) K.circle(x + px * s, y + py * s, pr * s - 1.5, color, { stroke: false });
    if (o.shade) K.ellipse(x, y + s * 0.2, s * 0.4, s * 0.06, o.shade, { stroke: false, alpha: 120 });
  };
  K.sun = function (x, y, r, o = {}) {
    const rot = (o.t === undefined ? K.t : o.t) * 0.4;
    for (let i = 0; i < 12; i++) { const a = rot + i * Math.PI / 6; K.streak(x + Math.cos(a) * r * 1.2, y + Math.sin(a) * r * 1.2, x + Math.cos(a) * r * 1.6, y + Math.sin(a) * r * 1.6, r * 0.14, o.rayColor || '#ffc21f'); }
    K.circle(x, y, r, PAL.sun);
    if (o.face) { K.circle(x - r * 0.3, y - r * 0.1, r * 0.08, PAL.ink, { stroke: false }); K.circle(x + r * 0.3, y - r * 0.1, r * 0.08, PAL.ink, { stroke: false }); K.curve([[x - r * 0.3, y + r * 0.25], [x, y + r * 0.42], [x + r * 0.3, y + r * 0.25]], { weight: 3 }); }
  };
  // GULL: flap = phase in radians. s ~ wingspan.
  K.gull = function (x, y, s, flap = 0, o = {}) {
    const w = Math.sin(flap) * s * 0.18;
    K.curve([[x - s * 0.5, y - w], [x - s * 0.22, y - s * 0.12 - w * 0.4], [x, y]], { weight: o.weight || 4 });
    K.curve([[x, y], [x + s * 0.22, y - s * 0.12 - w * 0.4], [x + s * 0.5, y - w]], { weight: o.weight || 4 });
    if (o.body) { K.ellipse(x, y + s * 0.03, s * 0.12, s * 0.06, PAL.gull, { weight: 2.5 }); K.poly([[x + s * 0.11, y + s * 0.02], [x + s * 0.19, y + s * 0.04], [x + s * 0.11, y + s * 0.06]], PAL.yellow, { weight: 2 }); }
  };
  K.bolt = function (x, y, len, o = {}) { // lightning bolt from (x,y) downwards
    const w = len * 0.12, pts = [[x, y], [x + w, y], [x + w * 0.2, y + len * 0.42], [x + w * 1.1, y + len * 0.42], [x - w * 0.6, y + len], [x - w * 0.05, y + len * 0.52], [x - w * 0.9, y + len * 0.52]];
    K.poly(pts, o.color || PAL.yellow, { weight: 3.5 });
  };
  K.rain = function (t, amount = 60, o = {}) { // slanted streaks across the screen, cheap
    const slant = o.slant === undefined ? 0.35 : o.slant, len = o.len || 38;
    for (let i = 0; i < amount; i++) {
      const sp = 900 + rand('rs', i) * 500, x0 = rand('rx', i) * (W + 300) - 150, y = ((rand('ry', i) * H + t * sp) % (H + 80)) - 40, x = x0 - (y * slant);
      K.streak(x, y, x - len * slant, y + len, 3, o.color || '#cfe3f0', 170);
    }
  };

  window.Kit = K;
  // Scene registry: scenes/partN.js calls Scenes.register(N, { draw(S) { ... } }).
  window.Scenes = { list: [], register(n, scene) { this.list[n - 1] = scene; } };
})();
