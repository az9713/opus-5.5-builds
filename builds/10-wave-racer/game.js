// SPRAYWAVE RALLY — race logic: racers, physics, AI, items, laps, camera, self-test.
'use strict';

const G = {
  state: 'boot', racers: [], player: null, torps: [], mines: [], raceTime: 0,
  laps: 3, classIdx: 1, trackIdx: 0, charIdx: 0, countdown: 0, introT: 0, postT: 0,
  attract: false, auto: false, headless: false, camMode: 0, camT: 0, attractTarget: 0,
  cam: { pos: new V3(0, 60, -80), look: new V3() }, stats: null,
};
const sfx = (n, v) => { if (window.SFX) SFX.play(n, v); };
const toast = (t, ms) => { if (window.UI && G.player && !G.headless) UI.toast(t, ms); };
const wrapA = a => { while (a > Math.PI) a -= Math.PI * 2; while (a < -Math.PI) a += Math.PI * 2; return a; };
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;

function makeRacer(ch, isPlayer) {
  const r = {
    ch, isPlayer, x: 0, z: 0, y: 0, vy: 0, vx: 0, vz: 0, heading: 0, speed: 0, air: false, onRamp: null,
    idx: 0, lapCount: 0, cp: true, lapStart: 0, lapTimes: [], finished: false, finishTime: 0, rank: 1,
    item: null, uses: 0, rolling: 0, holdT: 0, boost: 0, spin: 0, spinA: 0, slow: 0, shield: 0,
    trickT: 0, trickDone: false, bumpCd: 0, wrongT: 0, lane: 0, laneT: 0, skill: Math.random(),
    steerVis: 0, pitch: 0, roll: 0, jumps: 0, bumps: 0, itemsUsed: 0, maxSpd: 0,
  };
  r.model = buildJetSki(ch);
  W.scene.add(r.model.root, r.model.shadow);
  return r;
}

function setupRace(trackIdx, opts = {}) {
  clearRace();
  disposeTrack();
  if (!opts.attract) G.trackIdx = trackIdx;
  const tr = buildTrack(TRACKS[trackIdx]);
  if (!W.spray) buildSpray();
  G.attract = !!opts.attract;
  G.laps = opts.laps || 3;
  const order = [];
  const pc = opts.allAI ? -1 : G.charIdx;
  if (pc >= 0) order.push(pc);
  CHARACTERS.forEach((c, i) => { if (i !== pc) order.push(i); });
  // player starts near the back of the grid, like the genre
  const slots = [0, 1, 2, 3, 4, 5, 6, 7];
  G.racers = order.map((ci, k) => makeRacer(CHARACTERS[ci], k === 0 && pc >= 0));
  G.player = pc >= 0 ? G.racers[0] : null;
  const gridOrder = G.player ? [5, 0, 1, 2, 3, 4, 6, 7] : slots;
  G.racers.forEach((r, k) => placeOnGrid(r, gridOrder[k], tr));
  G.torps = []; G.mines = []; G.raceTime = 0;
  G.stats = { crates: 0, torpHits: 0, mineHits: 0 };
  G.cam.pos.set(tr.px[0], 70, tr.pz[0] - 60);
}

function placeOnGrid(r, slot, tr) {
  const N = tr.N;
  const i = (N - 10 - Math.floor(slot / 2) * Math.round(9 / tr.ds)) % N;
  const lat = (slot % 2 ? -1 : 1) * tr.hw * 0.38;
  r.idx = i; r.x = tr.px[i] + tr.lx[i] * lat; r.z = tr.pz[i] + tr.lz[i] * lat;
  r.heading = Math.atan2(tr.tx[i], tr.tz[i]);
  r.lapCount = 0; r.cp = true; r.lane = lat / tr.hw;
}

function clearRace() {
  for (const r of G.racers) { W.scene.remove(r.model.root, r.model.shadow); }
  for (const t of G.torps) W.scene.remove(t.mesh);
  for (const m of G.mines) W.scene.remove(m.mesh);
  G.racers = []; G.torps = []; G.mines = []; G.player = null;
}

function racerStats(r) {
  const s = r.ch.stats, cls = CLASSES[G.classIdx];
  let mul = cls.speedMul;
  if (!r.isPlayer || G.auto) {
    mul *= cls.aiSkill * (0.95 + r.skill * 0.06);
    if (G.player && !G.attract && !r.isPlayer) {
      const gap = progress(r) - progress(G.player);
      if (gap > W.track.N * 0.12) mul *= 0.92;
      else if (gap < -W.track.N * 0.08) mul *= 1.06;
    }
  }
  return {
    max: (46 + s.speed * 4.2) * mul,
    accel: (11 + s.accel * 4.2) * Math.sqrt(mul),
    turn: 1.3 + s.handling * 0.2,
    grip: 2.0 + s.handling * 0.55,
  };
}
const progress = r => r.finished ? 1e9 - r.finishTime : r.lapCount * W.track.N + r.idx;

// ---------- input -> controls ----------
function aiControls(r, tr) {
  const N = tr.N, spd = Math.hypot(r.vx, r.vz);
  const look = Math.round((12 + spd * 0.45) / tr.ds);
  // choose a lane: crates when empty-handed, ramps for fun, otherwise wander
  r.laneT -= 1 / 60;
  if (r.laneT <= 0) { r.lane = (Math.random() - 0.5) * 1.1; r.laneT = 2 + Math.random() * 3; }
  let lane = r.lane;
  for (const rp of tr.ramps) {
    const d = (rp.i - r.idx + N) % N;
    if (d > 0 && d < 90 && r.skill > 0.35) lane = rp.lat / tr.hw;
  }
  if (!r.item && !r.rolling) {
    for (let k = 0; k < tr.crates.length; k += 5) {
      const d = (tr.crates[k].i - r.idx + N) % N;
      if (d > 0 && d < 70) { lane = [-0.62, -0.31, 0, 0.31, 0.62][Math.floor(r.skill * 4.99)]; }
    }
  }
  const ti = (r.idx + look) % N;
  const tx = tr.px[ti] + tr.lx[ti] * lane * tr.hw, tz = tr.pz[ti] + tr.lz[ti] * lane * tr.hw;
  const diff = wrapA(Math.atan2(tx - r.x, tz - r.z) - r.heading);
  const c = { throttle: true, brake: Math.abs(diff) > 1.0 && spd > 22, steer: clamp(diff * 3.2, -1, 1), item: false, trick: false };
  if (r.air && r.skill > 0.5 && r.vy > 4 && !r.trickT && !r.trickDone) c.trick = true;
  if (r.item) {
    r.holdT -= 1 / 60;
    if (r.holdT <= 0) {
      const it = r.item;
      if (it === 'turbo' || it === 'triple') c.item = Math.abs(diff) < 0.3;
      else if (it === 'torpedo') c.item = r.rank > 1;
      else c.item = true;
      if (it === 'torpedo' && r.rank === 1 && r.holdT < -4) c.item = true;
    }
  }
  return c;
}

function nearestIdx(tr, x, z, from, global) {
  const N = tr.N;
  let best = from, bd = 1e12;
  if (global) {
    for (let i = 0; i < N; i += 2) { const d = (x - tr.px[i]) ** 2 + (z - tr.pz[i]) ** 2; if (d < bd) { bd = d; best = i; } }
    return best;
  }
  for (let k = -30; k <= 30; k++) {
    const i = (from + k + N) % N;
    const d = (x - tr.px[i]) ** 2 + (z - tr.pz[i]) ** 2;
    if (d < bd) { bd = d; best = i; }
  }
  return best;
}

// ---------- physics ----------
function stepRacer(r, c, dt, tr) {
  const st = racerStats(r);
  r.boost = Math.max(0, r.boost - dt); r.slow = Math.max(0, r.slow - dt);
  r.shield = Math.max(0, r.shield - dt); r.bumpCd = Math.max(0, r.bumpCd - dt);
  if (r.spin > 0) { r.spin -= dt; r.spinA += dt * 14; c = { throttle: false, brake: false, steer: 0 }; } else r.spinA = 0;
  let cap = st.max;
  if (r.boost > 0) cap *= 1.42;
  if (r.slow > 0) cap *= 0.55;
  if (r.rolling > 0) {
    r.rolling -= dt;
    if (r.rolling <= 0) { r.rolling = 0; r.item = rollItem(r.rank); r.uses = r.item === 'triple' ? 3 : 1; r.holdT = 0.6 + Math.random() * 2.5; if (r.isPlayer) sfx('got'); }
  }
  if (c.item && r.item && r.rolling <= 0) useItem(r);

  if (!r.air) {
    if (c.throttle) { if (r.speed < cap) r.speed += st.accel * dt * (1 - 0.55 * r.speed / cap); }
    else r.speed -= Math.sign(r.speed) * Math.min(Math.abs(r.speed), 9 * dt);
    if (c.brake) r.speed = Math.max(-12, r.speed - 30 * dt);
    if (r.boost > 0) r.speed = Math.min(cap, r.speed + 55 * dt);
    if (r.speed > cap) r.speed -= (r.speed - cap) * Math.min(1, 1.6 * dt);
    const sf = clamp(Math.abs(r.speed) / 16, 0.25, 1) * (r.speed < 0 ? -1 : 1);
    r.heading += c.steer * st.turn * dt * sf * (r.boost > 0 ? 0.85 : 1);
    const tvx = Math.sin(r.heading) * r.speed, tvz = Math.cos(r.heading) * r.speed;
    const g = Math.min(1, st.grip * dt);
    r.vx += (tvx - r.vx) * g; r.vz += (tvz - r.vz) * g;
  } else {
    r.heading += c.steer * st.turn * 0.35 * dt;
    r.vy -= 32 * dt;
    if (c.trick && !r.trickT && !r.trickDone) { r.trickT = 0.55; if (r.isPlayer) sfx('trick'); }
  }
  r.steerVis += (c.steer - r.steerVis) * Math.min(1, 6 * dt);
  r.x += r.vx * dt; r.z += r.vz * dt;

  // track progress + buoy walls
  const prev = r.idx;
  r.idx = nearestIdx(tr, r.x, r.z, r.idx);
  const i = r.idx, lat = (r.x - tr.px[i]) * tr.lx[i] + (r.z - tr.pz[i]) * tr.lz[i];
  if (Math.abs(lat) > tr.hw) {
    const s = Math.sign(lat), over = Math.abs(lat) - tr.hw;
    r.x -= tr.lx[i] * s * over; r.z -= tr.lz[i] * s * over;
    const vl = r.vx * tr.lx[i] + r.vz * tr.lz[i];
    if (vl * s > 0) { r.vx -= tr.lx[i] * vl * 1.4; r.vz -= tr.lz[i] * vl * 1.4; }
    if (r.bumpCd <= 0) { r.speed *= 0.82; r.bumpCd = 0.4; r.bumps++; if (r.isPlayer) sfx('bump'); }
  }
  const N = tr.N;
  if (prev > N * 0.8 && r.idx < N * 0.2) {
    if (r.cp) { r.lapCount++; r.cp = false; onLap(r); }
  } else if (prev < N * 0.2 && r.idx > N * 0.8) {
    if (r.lapCount > 0) { r.lapCount--; r.cp = true; }
  }
  if (r.idx > N * 0.45 && r.idx < N * 0.55) r.cp = true;

  // vertical: water, ramps, air
  const wh = waveHeight(r.x, r.z, W.t);
  if (!r.air) {
    let ground = wh, onR = null;
    for (const rp of tr.ramps) {
      const dx = r.x - rp.x, dz = r.z - rp.z;
      const al = dx * rp.tx + dz * rp.tz, la = dx * rp.lx + dz * rp.lz;
      if (Math.abs(la) < rp.w / 2 + 0.5) {
        if (al >= -0.5 && al <= rp.len && (r.onRamp === rp || al < 3) && r.speed > 0) { onR = rp; ground = Math.max(wh, rp.y + rp.h * clamp(al / rp.len, 0, 1)); }
        else if (r.onRamp === rp && al > rp.len) { // launch off the lip
          r.air = true; r.vy = 8 + Math.max(0, r.speed) * 0.26; r.y = rp.y + rp.h; r.jumps++;
          r.trickDone = false; r.trickT = 0;
          if (r.isPlayer) sfx('jump');
        }
      }
    }
    if (r.onRamp && !onR && !r.air && r.y > wh + 0.6) { r.air = true; r.vy = 0; r.trickDone = false; r.trickT = 0; }
    r.onRamp = onR;
    if (!r.air) r.y = ground;
  }
  if (r.air) {
    r.y += r.vy * dt;
    if (r.trickT > 0) { r.trickT -= dt; if (r.trickT <= 0) { r.trickT = 0; r.trickDone = true; } }
    if (r.y <= wh && r.vy < 0) {
      r.air = false; r.y = wh; r.onRamp = null;
      for (let k = 0; k < 26; k++) emitSpray(r.x, wh + 0.5, r.z, (Math.random() - 0.5) * 16, 6 + Math.random() * 9, (Math.random() - 0.5) * 16, 0.9);
      if (r.trickT > 0) { r.trickT = 0; hitRacer(r, true); toast('WIPEOUT!'); }
      else if (r.trickDone) { r.boost = Math.max(r.boost, 1.3); toast('STUNT BONUS!'); if (r.isPlayer) sfx('boost'); }
      r.trickDone = false;
      if (r.isPlayer) sfx('splash');
    }
  }
  // pickups
  for (const cr of tr.crates) {
    if (cr.respawn > 0) continue;
    if ((r.x - cr.x) ** 2 + (r.z - cr.z) ** 2 < 10.5 && r.y < wh + 5) {
      cr.respawn = 3.5; G.stats.crates++;
      for (let k = 0; k < 14; k++) emitSpray(cr.x, cr.mesh.position.y, cr.z, (Math.random() - 0.5) * 14, Math.random() * 10, (Math.random() - 0.5) * 14, 0.7, 1, 0.8, 0.3);
      if (!r.item && !r.rolling) { r.rolling = r.isPlayer ? 1.7 : 0.8; if (r.isPlayer) sfx('crate'); }
    }
  }
  if (r.isPlayer) {
    const dir = Math.sin(r.heading) * tr.tx[i] + Math.cos(r.heading) * tr.tz[i];
    r.wrongT = dir < -0.35 && Math.abs(r.speed) > 6 ? r.wrongT + dt : 0;
  }
  r.maxSpd = Math.max(r.maxSpd, Math.hypot(r.vx, r.vz));
}

function onLap(r) {
  if (r.lapCount >= 2) { r.lapTimes.push(G.raceTime - r.lapStart); r.lapStart = G.raceTime; }
  if (r.lapCount > G.laps && !r.finished) {
    r.finished = true; r.finishTime = G.raceTime;
    if (r.isPlayer && !G.attract) { toast('FINISH!', 2200); sfx('finish'); G.state = 'post'; G.postT = 0; }
  } else if (r.isPlayer && r.lapCount >= 2) {
    if (r.lapCount === G.laps) { toast('FINAL LAP!', 1800); sfx('final'); } else { toast('LAP ' + r.lapCount, 1400); sfx('lap'); }
  }
}

function collideRacers() {
  const rs = G.racers;
  for (let a = 0; a < rs.length; a++) for (let b = a + 1; b < rs.length; b++) {
    const A1 = rs[a], B1 = rs[b];
    const dx = B1.x - A1.x, dz = B1.z - A1.z, d2 = dx * dx + dz * dz;
    if (d2 < 10 && d2 > 0.0001 && Math.abs(A1.y - B1.y) < 2.5) {
      const d = Math.sqrt(d2), nx = dx / d, nz = dz / d, over = 3.2 - d;
      const wa = A1.ch.stats.weight, wb = B1.ch.stats.weight, ka = wb / (wa + wb), kb = wa / (wa + wb);
      A1.x -= nx * over * ka; A1.z -= nz * over * ka; B1.x += nx * over * kb; B1.z += nz * over * kb;
      const rel = (B1.vx - A1.vx) * nx + (B1.vz - A1.vz) * nz;
      if (rel < 0) {
        A1.vx += nx * rel * ka * 1.2; A1.vz += nz * rel * ka * 1.2; B1.vx -= nx * rel * kb * 1.2; B1.vz -= nz * rel * kb * 1.2;
        if (A1.isPlayer || B1.isPlayer) sfx('thud');
      }
    }
  }
}

// ---------- items ----------
function rollItem(rank) {
  const odds = ITEM_ODDS[clamp(rank - 1, 0, 7)];
  let tot = 0; for (const k in odds) tot += odds[k];
  let x = Math.random() * tot;
  for (const k in odds) { x -= odds[k]; if (x <= 0) return k; }
  return 'turbo';
}

function useItem(r) {
  const it = r.item, dx = Math.sin(r.heading), dz = Math.cos(r.heading);
  r.itemsUsed++;
  if (it === 'turbo' || it === 'triple') {
    r.boost = 1.5; r.speed = Math.max(r.speed, racerStats(r).max * 1.1);
    if (r.isPlayer) sfx('boost');
  } else if (it === 'torpedo') {
    const target = G.racers.find(o => o.rank === r.rank - 1) || null;
    const mesh = new THREE.Group();
    mesh.add(new THREE.Mesh(A.torpGeo, A.torpMat));
    const nose = new THREE.Mesh(A.noseGeo, A.redMat); nose.position.z = 2; mesh.add(nose);
    W.scene.add(mesh);
    G.torps.push({ x: r.x + dx * 4, z: r.z + dz * 4, h: r.heading, spd: Math.max(95, Math.hypot(r.vx, r.vz) + 40), life: 7, owner: r, target, idx: r.idx, age: 0, mesh });
    if (r.isPlayer) sfx('fire');
  } else if (it === 'mine') {
    const mesh = new THREE.Group();
    mesh.add(new THREE.Mesh(A.mineGeo, A.mineMat));
    for (let k = 0; k < 8; k++) { const s = new THREE.Mesh(A.spikeGeo, A.mineMat); const a = k * 0.785; s.position.set(Math.cos(a) * 1.2, (k % 2 - 0.5) * 1.2, Math.sin(a) * 1.2); s.lookAt(0, 0, 0); s.rotateX(-Math.PI / 2); mesh.add(s); }
    const light = new THREE.Mesh(new THREE.SphereGeometry(0.3, 6, 4), A.redMat); light.position.y = 1.3; mesh.add(light);
    W.scene.add(mesh);
    G.mines.push({ x: r.x - dx * 5, z: r.z - dz * 5, age: 0, owner: r, mesh });
    if (G.mines.length > 14) { W.scene.remove(G.mines[0].mesh); G.mines.shift(); }
    if (r.isPlayer) sfx('drop');
  } else if (it === 'shield') {
    r.shield = 9; if (r.isPlayer) sfx('shield');
  } else if (it === 'squall') {
    for (const o of G.racers) if (o.rank < r.rank && !o.finished) {
      if (o.shield > 0) { o.shield = 0; continue; }
      o.slow = 3.2; o.spin = Math.max(o.spin, 0.5); o.speed *= 0.6;
    }
    if (window.UI && !G.headless) UI.flash();
    sfx('thunder');
  }
  r.uses--;
  if (r.uses <= 0) r.item = null; else r.holdT = 0.5 + Math.random();
}

function hitRacer(r, self) {
  if (!self && r.shield > 0) { r.shield = 0; if (r.isPlayer) { sfx('pop'); toast('BLOCKED!'); } return; }
  r.spin = 1.3; r.speed *= 0.25; r.vx *= 0.3; r.vz *= 0.3;
  for (let k = 0; k < 30; k++) emitSpray(r.x, r.y + 1, r.z, (Math.random() - 0.5) * 20, 5 + Math.random() * 14, (Math.random() - 0.5) * 20, 1.0, 1, 0.6, 0.3);
  if (r.isPlayer) sfx('boom');
}

function updateWeapons(dt, tr) {
  for (let k = G.torps.length - 1; k >= 0; k--) {
    const t = G.torps[k];
    t.age += dt; t.life -= dt;
    t.idx = nearestIdx(tr, t.x, t.z, t.idx);
    let aimX, aimZ;
    const tg = t.target;
    if (tg && !tg.finished && Math.hypot(tg.x - t.x, tg.z - t.z) < 70) { aimX = tg.x; aimZ = tg.z; }
    else { const i = (t.idx + 18) % tr.N; aimX = tr.px[i]; aimZ = tr.pz[i]; }
    const diff = wrapA(Math.atan2(aimX - t.x, aimZ - t.z) - t.h);
    t.h += clamp(diff, -4 * dt, 4 * dt);
    t.x += Math.sin(t.h) * t.spd * dt; t.z += Math.cos(t.h) * t.spd * dt;
    const wy = waveHeight(t.x, t.z, W.t);
    t.mesh.position.set(t.x, wy + 0.3, t.z); t.mesh.rotation.y = t.h;
    if (Math.random() < 0.8) emitSpray(t.x, wy + 0.3, t.z, (Math.random() - 0.5) * 4, 3 + Math.random() * 3, (Math.random() - 0.5) * 4, 0.5);
    let hit = null;
    for (const r of G.racers) if (r !== t.owner || t.age > 1.5) if ((r.x - t.x) ** 2 + (r.z - t.z) ** 2 < 10 && r.y < wy + 4) { hit = r; break; }
    if (hit) { hitRacer(hit); G.stats.torpHits++; if (hit.isPlayer || t.owner.isPlayer) sfx('boom'); }
    if (hit || t.life <= 0) { W.scene.remove(t.mesh); G.torps.splice(k, 1); }
  }
  for (let k = G.mines.length - 1; k >= 0; k--) {
    const m = G.mines[k];
    m.age += dt;
    const wy = waveHeight(m.x, m.z, W.t);
    m.mesh.position.set(m.x, wy + 0.4, m.z); m.mesh.rotation.y += dt;
    m.mesh.children[m.mesh.children.length - 1].visible = (m.age * 3 | 0) % 2 === 0;
    if (m.age < 0.8) continue;
    for (const r of G.racers) if ((r.x - m.x) ** 2 + (r.z - m.z) ** 2 < 8 && r.y < wy + 3) {
      hitRacer(r); G.stats.mineHits++;
      W.scene.remove(m.mesh); G.mines.splice(k, 1); break;
    }
  }
}

// ---------- race update ----------
function updateRace(dt, frozen) {
  const tr = W.track;
  if (!frozen) G.raceTime += dt;
  // ranks
  const sorted = G.racers.slice().sort((a, b) => progress(b) - progress(a));
  sorted.forEach((r, k) => r.rank = k + 1);
  for (const r of G.racers) {
    let c;
    if (frozen) c = { throttle: false, brake: false, steer: 0 };
    else if (r.isPlayer && !G.auto && G.state === 'race') c = window.UI ? UI.playerControls() : { throttle: false, steer: 0 };
    else c = aiControls(r, tr);
    if (frozen) { r.speed = 0; r.vx = 0; r.vz = 0; r.y = waveHeight(r.x, r.z, W.t); continue; }
    stepRacer(r, c, dt, tr);
  }
  if (!frozen) { collideRacers(); updateWeapons(dt, tr); }
  for (const cr of tr.crates) if (cr.respawn > 0) cr.respawn -= dt;
  if (G.state === 'post') {
    G.postT += dt;
    if (G.postT > 5 && window.UI) { G.state = 'results'; UI.showResults(); }
  }
}

function syncVisuals(dt) {
  const tr = W.track;
  for (const r of G.racers) {
    const m = r.model, spd = Math.hypot(r.vx, r.vz);
    m.root.position.set(r.x, r.y, r.z);
    m.root.rotation.y = r.heading;
    const sl = waveSlope(r.x, r.z, W.t);
    const fx = Math.sin(r.heading), fz = Math.cos(r.heading);
    let tp = r.air ? -r.vy * 0.025 : -(sl.dx * fx + sl.dz * fz) * 1.2;
    if (r.onRamp) tp = -Math.atan(r.onRamp.h / r.onRamp.len);
    const tRoll = r.air ? 0 : -r.steerVis * 0.38 * clamp(spd / 30, 0, 1) + (sl.dx * fz - sl.dz * fx) * 0.8;
    r.pitch += (tp - r.pitch) * Math.min(1, 8 * dt); r.roll += (tRoll - r.roll) * Math.min(1, 8 * dt);
    m.tilt.rotation.set(r.pitch, r.spinA, r.roll + (r.trickT > 0 ? (1 - r.trickT / 0.55) * Math.PI * 2 : 0), 'YXZ');
    m.flame.visible = r.boost > 0; if (m.flame.visible) m.flame.scale.setScalar(0.8 + Math.random() * 0.5);
    m.bubble.visible = r.shield > 0; m.bubble.rotation.y += dt;
    m.cloud.visible = r.slow > 0;
    const wy = waveHeight(r.x, r.z, W.t);
    m.shadow.position.set(r.x, wy + 0.08, r.z); m.shadow.rotation.y = r.heading;
    m.shadow.visible = r.air;
    if (!r.air && spd > 8 && W.spray) {
      const n = spd > 40 ? 2 : 1;
      for (let k = 0; k < n; k++) {
        const side = Math.random() < 0.5 ? -1 : 1;
        emitSpray(r.x - fx * 2.4 + fz * side * 1.1, wy + 0.4, r.z - fz * 2.4 - fx * side * 1.1,
          -fx * spd * 0.15 + fz * side * 4, 3 + spd * 0.12 * Math.random(), -fz * spd * 0.15 - fx * side * 4, 0.55 + Math.random() * 0.3);
      }
    }
  }
}

// ---------- camera ----------
function updateCamera(dt) {
  const tr = W.track, cam = W.camera, C = G.cam;
  let want = new V3(), look = new V3(), k = 1 - Math.exp(-5 * dt);
  if (G.state === 'intro') {
    const u = clamp(G.introT / 4.2, 0, 1), N = tr.N;
    const i = Math.floor((0.55 + u * 0.45) * N) % N, j = (i + 60) % N;
    want.set(tr.px[i] - tr.lx[i] * 70, 55 - u * 25, tr.pz[i] - tr.lz[i] * 70);
    look.set(tr.px[j], 0, tr.pz[j]);
    k = 1 - Math.exp(-3 * dt);
  } else if (G.attract || !G.player) {
    G.camT += dt;
    if (G.camT > 6) { G.camT = 0; G.camMode = (G.camMode + 1) % 3; G.attractTarget = (G.attractTarget + 3) % G.racers.length; }
    const r = G.racers[G.attractTarget], fx = Math.sin(r.heading), fz = Math.cos(r.heading);
    if (G.camMode === 0) { want.set(r.x - fx * 16 + fz * 8, r.y + 7, r.z - fz * 16 - fx * 8); }
    else if (G.camMode === 1) { want.set(r.x + fx * 16 + fz * 6, r.y + 4, r.z + fz * 16 - fx * 6); }
    else { want.set(r.x + fz * 30, r.y + 22, r.z - fx * 30); }
    look.set(r.x + fx * 4, r.y + 1.5, r.z + fz * 4);
    k = 1 - Math.exp(-3 * dt);
  } else {
    const r = G.player, fx = Math.sin(r.heading), fz = Math.cos(r.heading);
    const back = 12.5 + clamp(Math.hypot(r.vx, r.vz) / 20, 0, 3);
    want.set(r.x - fx * back, Math.max(r.y, 0) + 5.6, r.z - fz * back);
    look.set(r.x + fx * 9, r.y + 2.2, r.z + fz * 9);
    k = 1 - Math.exp(-7 * dt);
  }
  C.pos.lerp(want, k); C.look.lerp(look, Math.min(1, k * 1.6));
  const wy = waveHeight(C.pos.x, C.pos.z, W.t) + 1.5;
  if (C.pos.y < wy) C.pos.y = wy;
  cam.position.copy(C.pos); cam.lookAt(C.look);
  const tf = G.player && G.player.boost > 0 ? 72 : 62;
  cam.fov += (tf - cam.fov) * Math.min(1, 4 * dt); cam.updateProjectionMatrix();
}

// ---------- self-test: fixed-step AI race on every track ----------
function runSelfTest() {
  G.headless = true;
  const out = [];
  const saved = { laps: G.laps, classIdx: G.classIdx };
  G.laps = 2; G.classIdx = 1;
  for (let ti = 0; ti < TRACKS.length; ti++) {
    setupRace(ti, { allAI: true, laps: 2 });
    G.state = 'race';
    const dt = 1 / 60, tr = W.track;
    let steps = 0, maxLat = 0, nanHit = false;
    W.t = 0;
    while (steps < 60 * 400 && !G.racers.every(r => r.finished)) {
      W.t += dt;
      for (const rp of tr.ramps) rp.y = waveHeight(rp.x, rp.z, W.t) * 0.6 - 0.2;
      updateRace(dt, false);
      for (const r of G.racers) {
        const i = r.idx, lat = Math.abs((r.x - tr.px[i]) * tr.lx[i] + (r.z - tr.pz[i]) * tr.lz[i]);
        maxLat = Math.max(maxLat, lat);
        if (!isFinite(r.x + r.z + r.y)) nanHit = true;
      }
      steps++;
    }
    const res = G.racers.slice().sort((a, b) => (a.finished ? a.finishTime : 1e9) - (b.finished ? b.finishTime : 1e9));
    out.push({
      track: TRACKS[ti].name, length_m: Math.round(tr.length), simSeconds: +(steps * dt).toFixed(1),
      finished: G.racers.filter(r => r.finished).length + '/8', nan: nanHit, maxLateral: +maxLat.toFixed(2), halfWidth: tr.hw,
      crates: G.stats.crates, torpedoHits: G.stats.torpHits, mineHits: G.stats.mineHits,
      jumps: G.racers.reduce((s, r) => s + r.jumps, 0), itemsUsed: G.racers.reduce((s, r) => s + r.itemsUsed, 0),
      order: res.map(r => `${r.ch.name} ${r.finished ? r.finishTime.toFixed(1) + 's' : 'DNF'} laps[${r.lapTimes.map(t => t.toFixed(1)).join(',')}] top ${(r.maxSpd * 1.8).toFixed(0)}km/h`),
    });
  }
  G.laps = saved.laps; G.classIdx = saved.classIdx;
  G.headless = false;
  return out;
}
