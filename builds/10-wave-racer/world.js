// SPRAYWAVE RALLY — world: renderer, sky, water, track geometry, islands, models, particles.
'use strict';

const V3 = THREE.Vector3;
const W = { t: 0, wave: { amp: 0.6, speed: 1 }, track: null };

function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function hash3(x, y, z) {
  let h = Math.sin(x * 127.1 + y * 311.7 + z * 74.7) * 43758.5453;
  return h - Math.floor(h);
}

// One wave function shared by the water mesh and racer physics.
function waveHeight(x, z, t) {
  const a = W.wave.amp, s = W.wave.speed;
  return a * (0.62 * Math.sin(x * 0.07 + t * 1.3 * s)
            + 0.48 * Math.sin(z * 0.09 - t * 1.1 * s + 1.7)
            + 0.34 * Math.sin((x + z) * 0.045 + t * 0.8 * s));
}
function waveSlope(x, z, t) {
  const e = 1.5;
  return { dx: (waveHeight(x + e, z, t) - waveHeight(x - e, z, t)) / (2 * e),
           dz: (waveHeight(x, z + e, t) - waveHeight(x, z - e, t)) / (2 * e) };
}

// ---------- renderer ----------
function initRenderer() {
  const canvas = document.getElementById('gl');
  W.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  W.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
  W.renderer.setSize(window.innerWidth, window.innerHeight, false);
  W.scene = new THREE.Scene();
  W.camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.5, 5000);
  W.hemi = new THREE.HemisphereLight(0xffffff, 0x2a6fb0, 0.9);
  W.sun = new THREE.DirectionalLight(0xffffff, 1.25);
  W.sun.position.set(300, 400, 200);
  W.scene.add(W.hemi, W.sun);
  window.addEventListener('resize', () => {
    W.renderer.setSize(window.innerWidth, window.innerHeight, false);
    W.camera.aspect = window.innerWidth / window.innerHeight;
    W.camera.updateProjectionMatrix();
  });
  buildSharedAssets();
}

function canvasTex(w, h, draw) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

// ---------- geometry helpers ----------
function jitter(geom, amt, seed) {
  const p = geom.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    const kx = Math.round(x * 50), ky = Math.round(y * 50), kz = Math.round(z * 50);
    p.setXYZ(i, x + (hash3(kx, ky, kz + seed) - 0.5) * amt,
                y + (hash3(ky, kz, kx + seed) - 0.5) * amt * 0.6,
                z + (hash3(kz, kx, ky + seed) - 0.5) * amt);
  }
  return geom;
}

// Collects many small colored parts and merges them into one mesh (few draw calls).
class Merger {
  constructor() { this.pos = []; this.col = []; }
  add(geom, matrix, color) {
    const g = geom.index ? geom.toNonIndexed() : geom.clone();
    g.applyMatrix4(matrix);
    const p = g.attributes.position.array, c = new THREE.Color(color);
    for (let i = 0; i < p.length; i += 3) {
      this.pos.push(p[i], p[i + 1], p[i + 2]);
      const k = 0.92 + hash3(p[i] | 0, p[i + 1] | 0, p[i + 2] | 0) * 0.16; // slight per-vertex tint
      this.col.push(c.r * k, c.g * k, c.b * k);
    }
    g.dispose();
  }
  build() {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.col, 3));
    g.computeVertexNormals();
    return new THREE.Mesh(g, new THREE.MeshPhongMaterial({ vertexColors: true, flatShading: true, shininess: 8 }));
  }
}
const _m4 = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _s = new V3();
function mtx(x, y, z, rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1) {
  _e.set(rx, ry, rz); _q.setFromEuler(_e); _s.set(sx, sy, sz);
  return new THREE.Matrix4().compose(new V3(x, y, z), _q, _s);
}

// ---------- shared assets ----------
const A = {};
function buildSharedAssets() {
  A.crateTex = canvasTex(128, 128, (g, w, h) => {
    const gr = g.createLinearGradient(0, 0, w, h);
    gr.addColorStop(0, '#ff4fd8'); gr.addColorStop(0.35, '#ffd23f'); gr.addColorStop(0.7, '#27d9ff'); gr.addColorStop(1, '#7a5cff');
    g.fillStyle = gr; g.fillRect(0, 0, w, h);
    g.strokeStyle = 'rgba(255,255,255,0.9)'; g.lineWidth = 10; g.strokeRect(5, 5, w - 10, h - 10);
    g.font = 'bold 96px Arial Black, Arial'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.lineWidth = 8; g.strokeStyle = '#10214a'; g.strokeText('?', w / 2, h / 2 + 6);
    g.fillStyle = '#fff'; g.fillText('?', w / 2, h / 2 + 6);
  });
  A.crateGeo = new THREE.BoxGeometry(2.8, 2.8, 2.8);
  A.crateMat = new THREE.MeshPhongMaterial({ map: A.crateTex, shininess: 90, specular: 0xffffff, emissive: 0x222222, transparent: true, opacity: 0.95 });
  A.rampTex = canvasTex(128, 256, (g, w, h) => {
    g.fillStyle = '#ffcf1f'; g.fillRect(0, 0, w, h);
    g.fillStyle = '#ff3b1f';
    for (let y = -20; y < h; y += 64) { g.beginPath(); g.moveTo(10, y + 50); g.lineTo(w / 2, y); g.lineTo(w - 10, y + 50); g.lineTo(w - 10, y + 70); g.lineTo(w / 2, y + 20); g.lineTo(10, y + 70); g.closePath(); g.fill(); }
    g.fillStyle = '#10214a'; g.fillRect(0, 0, 8, h); g.fillRect(w - 8, 0, 8, h);
  });
  A.bannerTex = canvasTex(512, 64, (g, w, h) => {
    for (let x = 0; x < w; x += 16) for (let y = 0; y < h; y += 16) { g.fillStyle = ((x + y) / 16) % 2 ? '#111' : '#fff'; g.fillRect(x, y, 16, 16); }
    g.fillStyle = '#ff5a1f'; g.fillRect(96, 6, 320, 52);
    g.font = 'bold 38px Arial Black, Arial'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillStyle = '#fff'; g.fillText('SPRAYWAVE', w / 2, h / 2 + 2);
  });
  // buoy: one lathe profile
  const prof = [[0, -0.8], [1.0, -0.8], [1.15, 0.2], [1.0, 0.7], [0.45, 1.3], [0.2, 2.4], [0.35, 2.6], [0, 2.7]].map(p => new THREE.Vector2(p[0], p[1]));
  A.buoyGeo = new THREE.LatheGeometry(prof, 8);
  A.buoyMat = new THREE.MeshPhongMaterial({ flatShading: true, shininess: 60 });
  A.shadowGeo = new THREE.CircleGeometry(1.8, 12).rotateX(-Math.PI / 2);
  A.shadowMat = new THREE.MeshBasicMaterial({ color: 0x001030, transparent: true, opacity: 0.35, depthWrite: false });
  A.torpGeo = new THREE.CylinderGeometry(0.45, 0.45, 3.2, 8).rotateX(Math.PI / 2);
  A.torpMat = new THREE.MeshPhongMaterial({ color: 0x9aa7b5, shininess: 80, flatShading: true });
  A.noseGeo = new THREE.ConeGeometry(0.45, 0.9, 8).rotateX(Math.PI / 2);
  A.redMat = new THREE.MeshPhongMaterial({ color: 0xff2020, emissive: 0x550000, flatShading: true });
  A.mineGeo = new THREE.IcosahedronGeometry(1.2, 0);
  A.mineMat = new THREE.MeshPhongMaterial({ color: 0x2b333c, shininess: 40, flatShading: true });
  A.spikeGeo = new THREE.ConeGeometry(0.22, 0.8, 5);
  A.cloudGeo = new THREE.DodecahedronGeometry(1.6, 0);
  A.cloudMat = new THREE.MeshPhongMaterial({ color: 0x4a4a66, flatShading: true, transparent: true, opacity: 0.9 });
}

// ---------- sky ----------
function buildSky(sky) {
  const geo = new THREE.SphereGeometry(3000, 24, 12);
  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: { top: { value: new THREE.Color(sky.top) }, bottom: { value: new THREE.Color(sky.bottom) } },
    vertexShader: 'varying float vy; void main(){ vy = normalize(position).y; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0); }',
    fragmentShader: 'uniform vec3 top; uniform vec3 bottom; varying float vy; void main(){ float k = smoothstep(-0.05, 0.55, vy); gl_FragColor = vec4(mix(bottom, top, k), 1.0); }',
  });
  const g = new THREE.Group();
  g.add(new THREE.Mesh(geo, mat));
  const sun = new THREE.Mesh(new THREE.CircleGeometry(150, 24), new THREE.MeshBasicMaterial({ color: sky.sun, fog: false }));
  sun.position.set(1500, 900, 1200); sun.lookAt(0, 0, 0);
  g.add(sun);
  // puffy low-poly clouds
  const rnd = mulberry32(99), cm = new THREE.MeshBasicMaterial({ color: 0xffffff, fog: false, transparent: true, opacity: 0.9 });
  for (let i = 0; i < 14; i++) {
    const a = rnd() * Math.PI * 2, d = 1700 + rnd() * 600, y = 350 + rnd() * 450;
    const cl = new THREE.Group();
    for (let k = 0; k < 4; k++) {
      const m = new THREE.Mesh(new THREE.IcosahedronGeometry(60 + rnd() * 50, 0), cm);
      m.position.set(k * 70 - 100, rnd() * 30, rnd() * 40); m.scale.y = 0.55; cl.add(m);
    }
    cl.position.set(Math.cos(a) * d, y, Math.sin(a) * d); cl.lookAt(0, y, 0);
    g.add(cl);
  }
  return g;
}

// ---------- water ----------
function buildWater(cx, cz, size, colors) {
  const seg = 110;
  const geo = new THREE.PlaneGeometry(size, size, seg, seg).rotateX(-Math.PI / 2);
  geo.translate(cx, 0, cz);
  const n = geo.attributes.position.count;
  geo.setAttribute('color', new THREE.Float32BufferAttribute(new Float32Array(n * 3), 3));
  const mat = new THREE.MeshPhongMaterial({ vertexColors: true, flatShading: true, shininess: 70, specular: 0x88ccff, transparent: true, opacity: 0.93 });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.userData.deep = new THREE.Color(colors.deep);
  mesh.userData.crest = new THREE.Color(colors.crest);
  const ocean = new THREE.Mesh(new THREE.PlaneGeometry(9000, 9000).rotateX(-Math.PI / 2),
    new THREE.MeshPhongMaterial({ color: colors.deep, shininess: 30 }));
  ocean.position.set(cx, -W.wave.amp * 1.2 - 0.4, cz);
  return { mesh, ocean };
}
function updateWater(water, t) {
  const g = water.geometry, p = g.attributes.position, c = g.attributes.color;
  const pa = p.array, ca = c.array, d = water.userData.deep, cr = water.userData.crest;
  const inv = 1 / (W.wave.amp * 1.44 + 0.001);
  for (let i = 0; i < pa.length; i += 3) {
    const h = waveHeight(pa[i], pa[i + 2], t);
    pa[i + 1] = h;
    let k = h * inv * 0.5 + 0.5; k = k * k * 0.85;
    ca[i] = d.r + (cr.r - d.r) * k; ca[i + 1] = d.g + (cr.g - d.g) * k; ca[i + 2] = d.b + (cr.b - d.b) * k;
  }
  p.needsUpdate = true; c.needsUpdate = true;
  g.computeBoundingSphere();
}

// ---------- track ----------
function buildTrack(def) {
  const tr = { def, group: new THREE.Group(), hw: def.halfWidth };
  W.wave = { amp: def.wave.amp, speed: def.wave.speed };
  const pts = def.points.map(([x, z]) => new V3(x, 0, z));
  const curve = new THREE.CatmullRomCurve3(pts, true, 'centripetal');
  const N = 1000;
  const sp = curve.getSpacedPoints(N);
  tr.N = N;
  tr.px = new Float32Array(N); tr.pz = new Float32Array(N);
  tr.tx = new Float32Array(N); tr.tz = new Float32Array(N);
  tr.lx = new Float32Array(N); tr.lz = new Float32Array(N);
  for (let i = 0; i < N; i++) { tr.px[i] = sp[i].x; tr.pz[i] = sp[i].z; }
  let len = 0;
  for (let i = 0; i < N; i++) {
    const a = (i + N - 1) % N, b = (i + 1) % N;
    let dx = tr.px[b] - tr.px[a], dz = tr.pz[b] - tr.pz[a];
    const l = Math.hypot(dx, dz); dx /= l; dz /= l;
    tr.tx[i] = dx; tr.tz[i] = dz; tr.lx[i] = dz; tr.lz[i] = -dx;
    len += Math.hypot(tr.px[b] - tr.px[i], tr.pz[b] - tr.pz[i]);
  }
  tr.length = len; tr.ds = len / N;
  let minX = 1e9, maxX = -1e9, minZ = 1e9, maxZ = -1e9;
  for (let i = 0; i < N; i++) { minX = Math.min(minX, tr.px[i]); maxX = Math.max(maxX, tr.px[i]); minZ = Math.min(minZ, tr.pz[i]); maxZ = Math.max(maxZ, tr.pz[i]); }
  tr.bounds = { minX, maxX, minZ, maxZ, cx: (minX + maxX) / 2, cz: (minZ + maxZ) / 2 };
  const curv = i => { const a = (i + N - 8) % N, b = (i + 8) % N; return 1 - (tr.tx[a] * tr.tx[b] + tr.tz[a] * tr.tz[b]); };
  const straightNear = (i0, r) => { let best = i0, bv = 9; for (let k = -r; k <= r; k++) { const i = (i0 + k + N) % N, v = curv(i); if (v < bv) { bv = v; best = i; } } return best; };

  // sky, water, fog
  W.scene.background = new THREE.Color(def.sky.bottom);
  W.scene.fog = new THREE.Fog(def.sky.fog, 260, 1100);
  W.hemi.color.set(def.sky.top).lerp(new THREE.Color(0xffffff), 0.6);
  W.sun.color.set(def.sky.sun);
  tr.group.add(buildSky(def.sky));
  const size = Math.max(maxX - minX, maxZ - minZ) + 420;
  const water = buildWater(tr.bounds.cx, tr.bounds.cz, size, def.water);
  tr.water = water.mesh; tr.group.add(water.mesh, water.ocean);

  // buoys along both edges
  const step = Math.max(1, Math.round(10 / tr.ds));
  const buoyPos = [];
  for (let i = 0; i < N; i += step) for (const side of [1, -1]) {
    buoyPos.push({ x: tr.px[i] + tr.lx[i] * (tr.hw + 1.2) * side, z: tr.pz[i] + tr.lz[i] * (tr.hw + 1.2) * side, side, k: (i / step) | 0 });
  }
  const bm = new THREE.InstancedMesh(A.buoyGeo, A.buoyMat, buoyPos.length);
  const cL = [new THREE.Color('#ff3b2f'), new THREE.Color('#ffffff')], cR = [new THREE.Color('#ffd400'), new THREE.Color('#ffffff')];
  buoyPos.forEach((b, i) => bm.setColorAt(i, (b.side > 0 ? cL : cR)[b.k % 2]));
  bm.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  tr.buoys = { mesh: bm, list: buoyPos }; tr.group.add(bm);

  // ramps
  tr.ramps = def.ramps.map((t, n) => {
    const i = straightNear(Math.floor(t * N) % N, 40);
    const lat = [0, -0.35, 0.35][n % 3] * tr.hw;
    const r = { i, len: 16, w: 12, h: 4.2, lat,
      x: tr.px[i] + tr.lx[i] * lat, z: tr.pz[i] + tr.lz[i] * lat, tx: tr.tx[i], tz: tr.tz[i], lx: tr.lx[i], lz: tr.lz[i], y: 0 };
    r.mesh = buildRampMesh(r); tr.group.add(r.mesh);
    return r;
  });

  // item crate rows
  tr.crates = [];
  def.crates.forEach(t => {
    let i = Math.floor(t * N) % N;
    for (const r of tr.ramps) { const d = Math.abs(((i - r.i + N * 1.5) % N) - N / 2); if (d < 30) i = (i + 40) % N; }
    [-0.62, -0.31, 0, 0.31, 0.62].forEach((f, k) => {
      const m = new THREE.Mesh(A.crateGeo, A.crateMat);
      const c = { i, x: tr.px[i] + tr.lx[i] * f * tr.hw, z: tr.pz[i] + tr.lz[i] * f * tr.hw, mesh: m, respawn: 0, phase: k * 0.7 + i };
      m.position.set(c.x, 2, c.z); tr.group.add(m); tr.crates.push(c);
    });
  });

  // decor: islands, palms, huts, rocks, start arch (merged into one mesh)
  const mg = new Merger(), rnd = mulberry32(def.seed);
  const distToTrack = (x, z) => { let md = 1e9; for (let i = 0; i < N; i += 4) { const d = Math.hypot(x - tr.px[i], z - tr.pz[i]); if (d < md) md = d; } return md; };
  const islands = [];
  const pad = 230;
  for (let tries = 0; islands.length < def.islandCount && tries < 900; tries++) {
    const r = 12 + rnd() * 30;
    const x = minX - pad + rnd() * (maxX - minX + pad * 2), z = minZ - pad + rnd() * (maxZ - minZ + pad * 2);
    if (distToTrack(x, z) < tr.hw + r * 1.2 + 14) continue;
    if (islands.some(o => Math.hypot(o.x - x, o.z - z) < o.r + r + 10)) continue;
    islands.push({ x, z, r });
  }
  // guarantee a few islands close to the course so they read from the water
  tr.islands = islands;
  islands.forEach((is, n) => addIsland(mg, is, rnd, n, def));
  const pillars = Math.round(def.rockiness * 26);
  for (let tries = 0, made = 0; made < pillars && tries < 400; tries++) {
    const i = Math.floor(rnd() * N), side = rnd() < 0.5 ? 1 : -1, off = tr.hw + 10 + rnd() * 40;
    const x = tr.px[i] + tr.lx[i] * off * side, z = tr.pz[i] + tr.lz[i] * off * side;
    if (distToTrack(x, z) < tr.hw + 8) continue;
    const hgt = 10 + rnd() * 26 * def.rockiness, rad = 3 + rnd() * 5;
    mg.add(jitter(new THREE.CylinderGeometry(rad * 0.6, rad, hgt, 6, 3), 2.2, made), mtx(x, hgt / 2 - 2, z, 0, rnd() * 3, 0), rnd() < 0.5 ? '#c98b5e' : '#b9774d');
    mg.add(jitter(new THREE.DodecahedronGeometry(rad * 0.8, 0), 1, made), mtx(x, hgt - 1, z), '#3fbf5a');
    made++;
  }
  // start arch at index 0
  {
    const i = 0, px = tr.px[i], pz = tr.pz[i], lx = tr.lx[i], lz = tr.lz[i];
    const yaw = Math.atan2(tr.tx[i], tr.tz[i]);
    for (const s of [1, -1]) {
      const x = px + lx * (tr.hw + 3) * s, z = pz + lz * (tr.hw + 3) * s;
      mg.add(new THREE.CylinderGeometry(2.4, 3, 3, 8), mtx(x, 0, z), '#ffffff');
      mg.add(new THREE.CylinderGeometry(0.9, 1.1, 16, 8), mtx(x, 8, z), '#ff5a1f');
      mg.add(new THREE.SphereGeometry(1.5, 8, 6), mtx(x, 16.5, z), '#ffd23f');
    }
    const banner = new THREE.Mesh(new THREE.BoxGeometry((tr.hw + 3) * 2, 3.4, 0.6),
      [0, 0, 0, 0, 1, 1].map(k => k ? new THREE.MeshBasicMaterial({ map: A.bannerTex }) : new THREE.MeshPhongMaterial({ color: 0x10214a })));
    banner.position.set(px, 14, pz); banner.rotation.y = yaw;
    tr.group.add(banner);
  }
  tr.decor = mg.build(); tr.group.add(tr.decor);
  W.scene.add(tr.group);
  W.track = tr;
  return tr;
}

function addIsland(mg, is, rnd, n, def) {
  const { x, z, r } = is, rot = rnd() * 6;
  const sand = def.id === 'sunset' ? '#f2c38a' : '#f5dc9a', grass = ['#39c24f', '#2fae45', '#56d160'][n % 3];
  mg.add(jitter(new THREE.CylinderGeometry(r, r * 1.2, 4, 9, 1), 1.6, n), mtx(x, -1, z, 0, rot, 0), sand);
  const hh = r * (0.35 + rnd() * 0.5);
  mg.add(jitter(new THREE.ConeGeometry(r * 0.72, hh, 8, 2), 2.4, n + 50), mtx(x + r * 0.08, 1 + hh / 2, z, 0, rot, 0), grass);
  if (def.rockiness > 0.5 && rnd() < 0.6) mg.add(jitter(new THREE.DodecahedronGeometry(r * 0.35, 0), 1.5, n), mtx(x - r * 0.4, 2, z + r * 0.3), '#8f8f9e');
  const palms = 1 + Math.floor(rnd() * Math.min(5, r / 7));
  for (let k = 0; k < palms; k++) {
    const a = rnd() * Math.PI * 2, d = r * (0.55 + rnd() * 0.3);
    addPalm(mg, x + Math.cos(a) * d, 1, z + Math.sin(a) * d, a + Math.PI + (rnd() - 0.5), 0.8 + rnd() * 0.5, rnd);
  }
  if (r > 24 && rnd() < 0.55) {
    const a = rnd() * 6, hx = x + Math.cos(a) * r * 0.45, hz = z + Math.sin(a) * r * 0.45;
    mg.add(new THREE.BoxGeometry(5, 3.5, 5), mtx(hx, 2.8, hz, 0, a, 0), '#c77b3a');
    mg.add(new THREE.ConeGeometry(4.6, 3.4, 4), mtx(hx, 6.2, hz, 0, a + Math.PI / 4, 0), '#e8c55a');
  }
}

function addPalm(mg, x, y, z, lean, sc, rnd) {
  const segs = 5, seg = 2.3 * sc;
  let cx = x, cy = y, cz = z, tilt = 0;
  const dx = Math.cos(lean), dz = Math.sin(lean);
  for (let i = 0; i < segs; i++) {
    tilt += 0.07 + i * 0.02;
    const m = new THREE.Matrix4().compose(new V3(cx, cy + seg / 2, cz), new THREE.Quaternion().setFromAxisAngle(new V3(-dz, 0, dx).normalize(), tilt), new V3(1, 1, 1));
    mg.add(new THREE.CylinderGeometry(0.38 * sc, 0.5 * sc, seg, 5), m, i % 2 ? '#9b6a3c' : '#86592f');
    cx += dx * Math.sin(tilt) * seg; cz += dz * Math.sin(tilt) * seg; cy += Math.cos(tilt) * seg;
  }
  const fr = 7;
  for (let k = 0; k < fr; k++) {
    const a = (k / fr) * Math.PI * 2 + rnd();
    const g = new THREE.ConeGeometry(0.9 * sc, 6 * sc, 4).translate(0, 3 * sc, 0).scale(1, 1, 0.25);
    const m = new THREE.Matrix4().compose(new V3(cx, cy, cz), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, -a, 1.25 + rnd() * 0.35, 'YXZ')), new V3(1, 1, 1));
    mg.add(g, m, k % 2 ? '#2fbf3a' : '#1f9e33');
  }
  for (let k = 0; k < 3; k++) mg.add(new THREE.IcosahedronGeometry(0.35 * sc, 0), mtx(cx + Math.cos(k * 2.1) * 0.5, cy - 0.4, cz + Math.sin(k * 2.1) * 0.5), '#5a3a1a');
}

function buildRampMesh(r) {
  const L = r.len, w = r.w / 2, h = r.h;
  // local: x lateral, y up, z along. Top face textured; body solid.
  const top = new THREE.BufferGeometry();
  top.setAttribute('position', new THREE.Float32BufferAttribute([-w, 0, 0, w, 0, 0, w, h, L, -w, 0, 0, w, h, L, -w, h, L], 3));
  top.setAttribute('uv', new THREE.Float32BufferAttribute([0, 0, 1, 0, 1, 1, 0, 0, 1, 1, 0, 1], 2));
  top.computeVertexNormals();
  const body = new THREE.BufferGeometry();
  body.setAttribute('position', new THREE.Float32BufferAttribute([
    -w, 0, 0, -w, h, L, -w, -1.2, L, -w, 0, 0, -w, -1.2, L, -w, -1.2, 0,
     w, 0, 0, w, -1.2, L, w, h, L, w, 0, 0, w, -1.2, 0, w, -1.2, L,
    -w, h, L, w, h, L, w, -1.2, L, -w, h, L, w, -1.2, L, -w, -1.2, L], 3));
  body.computeVertexNormals();
  const g = new THREE.Group();
  g.add(new THREE.Mesh(top, new THREE.MeshPhongMaterial({ map: A.rampTex, shininess: 30, side: THREE.DoubleSide })));
  g.add(new THREE.Mesh(body, new THREE.MeshPhongMaterial({ color: 0x1b4fd6, flatShading: true, side: THREE.DoubleSide })));
  for (const s of [-1, 1]) { // side pontoons
    const p = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 0.9, L + 2, 8).rotateX(Math.PI / 2), new THREE.MeshPhongMaterial({ color: 0xff5a1f, flatShading: true }));
    p.position.set(s * (w + 0.6), 0, L / 2); g.add(p);
  }
  g.position.set(r.x, 0, r.z);
  g.rotation.y = Math.atan2(r.tx, r.tz);
  return g;
}

function disposeTrack() {
  const tr = W.track; if (!tr) return;
  W.scene.remove(tr.group);
  tr.group.traverse(o => {
    if (o.geometry && !Object.values(A).includes(o.geometry)) o.geometry.dispose();
  });
  W.track = null;
}

function updateTrackFX(tr, t) {
  const bm = tr.buoys.mesh, list = tr.buoys.list;
  for (let i = 0; i < list.length; i++) {
    const b = list[i], y = waveHeight(b.x, b.z, t);
    _e.set(Math.sin(t * 2 + i) * 0.12, i, Math.cos(t * 1.7 + i) * 0.12); _q.setFromEuler(_e);
    _m4.compose(_s.set(b.x, y, b.z), _q, new V3(1, 1, 1));
    bm.setMatrixAt(i, _m4);
  }
  bm.instanceMatrix.needsUpdate = true;
  for (const r of tr.ramps) { r.y = waveHeight(r.x, r.z, t) * 0.6 - 0.2; r.mesh.position.y = r.y; }
  for (const c of tr.crates) {
    c.mesh.visible = c.respawn <= 0;
    c.mesh.position.y = waveHeight(c.x, c.z, t) + 2.4 + Math.sin(t * 2.5 + c.phase) * 0.5;
    c.mesh.rotation.set(0.3, t * 1.6 + c.phase, 0.2);
  }
  updateWater(tr.water, t);
}

// ---------- jet-ski + rider model ----------
function buildJetSki(ch) {
  const root = new THREE.Group(), tilt = new THREE.Group(); root.add(tilt);
  const col = new THREE.Color(ch.color), acc = new THREE.Color(ch.accent);
  const phong = (c, extra) => new THREE.MeshPhongMaterial(Object.assign({ color: c, flatShading: true, shininess: 70 }, extra || {}));
  const shape = new THREE.Shape();
  [[-1.15, -2.4], [1.15, -2.4], [1.25, 0.4], [0.7, 1.9], [0, 2.7], [-0.7, 1.9], [-1.25, 0.4]].forEach((p, i) => i ? shape.lineTo(p[0], p[1]) : shape.moveTo(p[0], p[1]));
  const hullGeo = new THREE.ExtrudeGeometry(shape, { depth: 0.55, bevelEnabled: true, bevelThickness: 0.25, bevelSize: 0.2, bevelSegments: 1 }).rotateX(Math.PI / 2);
  const hull = new THREE.Mesh(hullGeo, phong(col)); hull.position.y = 0.95; tilt.add(hull);
  const keel = new THREE.Mesh(hullGeo, phong(0xffffff)); keel.scale.set(0.9, 0.7, 0.96); keel.position.y = 0.35; tilt.add(keel);
  const stripe = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.18, 3.2), phong(acc)); stripe.position.set(0, 0.62, -0.2); tilt.add(stripe);
  const seat = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.35, 2.0), phong(0x1b1b24)); seat.position.set(0, 1.25, -0.9); tilt.add(seat);
  const cowl = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.5, 1.0), phong(col)); cowl.position.set(0, 1.3, 0.9); cowl.rotation.x = -0.35; tilt.add(cowl);
  const shield = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.6, 0.08), phong(0x9fe8ff, { transparent: true, opacity: 0.7 })); shield.position.set(0, 1.75, 1.25); shield.rotation.x = -0.6; tilt.add(shield);
  const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 1.6, 5).rotateZ(Math.PI / 2), phong(0x222222)); bar.position.set(0, 1.85, 0.55); tilt.add(bar);
  // rider
  const rider = new THREE.Group(); rider.position.set(0, 1.35, -0.7);
  const s = 0.88 + ch.stats.weight * 0.055; rider.scale.setScalar(s);
  const legs = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.5, 1.1), phong(0x20232e)); legs.position.set(0, 0.2, 0.2); rider.add(legs);
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.95, 1.1, 0.6), phong(col)); torso.position.set(0, 0.95, 0.25); torso.rotation.x = 0.35; rider.add(torso);
  const vest = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.35, 0.65), phong(acc)); vest.position.set(0, 0.85, 0.22); vest.rotation.x = 0.35; rider.add(vest);
  for (const sx of [-1, 1]) {
    const arm = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.24, 1.1), phong(col)); arm.position.set(sx * 0.55, 1.2, 0.8); arm.rotation.x = 0.4; rider.add(arm);
  }
  const head = new THREE.Mesh(new THREE.IcosahedronGeometry(0.42, 1), phong(ch.skin)); head.position.set(0, 1.75, 0.5); rider.add(head);
  const helm = new THREE.Mesh(new THREE.SphereGeometry(0.47, 8, 5, 0, Math.PI * 2, 0, Math.PI * 0.55), phong(ch.accent === '#ffffff' ? ch.hair : ch.accent)); helm.position.copy(head.position); helm.position.y += 0.05; helm.rotation.x = -0.35; rider.add(helm);
  const goggles = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.16, 0.2), phong(0x111111, { emissive: 0x113355 })); goggles.position.set(0, 1.8, 0.86); rider.add(goggles);
  tilt.add(rider);
  // effects
  const flame = new THREE.Mesh(new THREE.ConeGeometry(0.5, 2.6, 6).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0xffa21f, transparent: true, opacity: 0.85 }));
  flame.position.set(0, 0.7, -3.6); flame.visible = false; tilt.add(flame);
  const bubble = new THREE.Mesh(new THREE.IcosahedronGeometry(3.4, 1), new THREE.MeshPhongMaterial({ color: 0x5fd8ff, transparent: true, opacity: 0.28, shininess: 100, flatShading: true, depthWrite: false }));
  bubble.position.y = 1.5; bubble.visible = false; root.add(bubble);
  const cloud = new THREE.Group();
  for (let k = 0; k < 4; k++) { const m = new THREE.Mesh(A.cloudGeo, A.cloudMat); m.position.set(k * 1.3 - 2, Math.sin(k) * 0.4, 0); cloud.add(m); }
  cloud.position.y = 8; cloud.visible = false; root.add(cloud);
  const shadow = new THREE.Mesh(A.shadowGeo, A.shadowMat); shadow.scale.set(1, 1, 1.8);
  return { root, tilt, flame, bubble, cloud, shadow };
}

// ---------- spray particles ----------
function buildSpray() {
  const max = 900;
  const geo = new THREE.BufferGeometry();
  const pos = new Float32Array(max * 3), col = new Float32Array(max * 3);
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  const tex = canvasTex(32, 32, (g) => { const r = g.createRadialGradient(16, 16, 0, 16, 16, 16); r.addColorStop(0, 'rgba(255,255,255,1)'); r.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = r; g.fillRect(0, 0, 32, 32); });
  const mat = new THREE.PointsMaterial({ size: 1.0, map: tex, vertexColors: true, transparent: true, depthWrite: false, sizeAttenuation: true, blending: THREE.AdditiveBlending });
  const pts = new THREE.Points(geo, mat); pts.frustumCulled = false;
  const S = { pts, max, n: 0, p: [] };
  for (let i = 0; i < max; i++) { S.p.push({ x: 0, y: -999, z: 0, vx: 0, vy: 0, vz: 0, life: 0, r: 1, g: 1, b: 1 }); }
  W.scene.add(pts);
  W.spray = S;
  return S;
}
function emitSpray(x, y, z, vx, vy, vz, life, r = 1, g = 1, b = 1) {
  const S = W.spray; if (!S) return;
  const p = S.p[S.n]; S.n = (S.n + 1) % S.max;
  p.x = x; p.y = y; p.z = z; p.vx = vx; p.vy = vy; p.vz = vz; p.life = life; p.r = r; p.g = g; p.b = b;
}
function updateSpray(dt) {
  const S = W.spray; if (!S) return;
  const pa = S.pts.geometry.attributes.position.array, ca = S.pts.geometry.attributes.color.array;
  for (let i = 0; i < S.max; i++) {
    const p = S.p[i];
    if (p.life > 0) {
      p.life -= dt; p.vy -= 22 * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
      if (p.life <= 0) p.y = -999;
    }
    pa[i * 3] = p.x; pa[i * 3 + 1] = p.y; pa[i * 3 + 2] = p.z;
    const f = Math.min(1, p.life * 2) * 0.75; ca[i * 3] = p.r * f; ca[i * 3 + 1] = p.g * f; ca[i * 3 + 2] = p.b * f;
  }
  S.pts.geometry.attributes.position.needsUpdate = true;
  S.pts.geometry.attributes.color.needsUpdate = true;
}
