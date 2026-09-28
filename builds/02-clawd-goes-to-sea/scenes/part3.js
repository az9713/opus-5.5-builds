// Part 3 — Learning the Ropes (48.0-67.2 s). Bright morning, a close wide view of the ship's deck.
// Four jokes, one per lyric line, drawn from a hand-built deck floor (not the whole ship).
(function () {
  const { PAL, W, H, ease, inv, ping, lerp, clamp, mix, rand } = Kit;

  const HORIZON = 250, RAIL_TOP = 380, RAIL_Y = 420, GROUND = 580;

  // ---------- small actors we draw ourselves ----------
  // A sailor: round head, sailor cap, striped shirt, one arm raised holding a rope knot.
  // Returns the world position of the raised hand (where the knot sits).
  function drawSailor(x, y, h, o = {}) {
    const hr = h * 0.14, headY = -h * 0.72, sh = -h * 0.58, hip = -h * 0.28;
    const armA = o.armAngle === undefined ? 0.35 : o.armAngle;
    push(); translate(x, y);
    Kit.streak(-h * 0.05, hip, -h * 0.05, 0, h * 0.09, PAL.pants);
    Kit.streak(h * 0.05, hip, h * 0.05, 0, h * 0.09, PAL.pants);
    Kit.ellipse(-h * 0.05, h * 0.01, h * 0.05, h * 0.025, PAL.shoe, { weight: 2 });
    Kit.ellipse(h * 0.05, h * 0.01, h * 0.05, h * 0.025, PAL.shoe, { weight: 2 });
    Kit.rect(-h * 0.17, sh, h * 0.34, hip - sh, '#eee7d4', { weight: 2.5, r: 4 });
    for (let i = 0; i < 3; i++) Kit.rect(-h * 0.17, sh + h * 0.10 + i * h * 0.085, h * 0.34, h * 0.04, PAL.blue, { stroke: false });
    Kit.streak(-h * 0.14, sh + h * 0.05, -h * 0.20, hip - h * 0.02, h * 0.06, '#eee7d4');
    const hx = h * 0.16 + Math.sin(armA) * h * 0.24, hy = (sh + h * 0.03) - Math.cos(armA) * h * 0.24;
    Kit.streak(h * 0.14, sh + h * 0.05, hx, hy, h * 0.065, '#eee7d4');
    Kit.circle(hx, hy, h * 0.035, PAL.skin, { weight: 2 });
    Kit.circle(0, headY, hr, PAL.skin);
    Kit.poly([[-hr, headY - hr * 0.2], [hr, headY - hr * 0.2], [hr * 0.75, headY - hr * 0.85], [-hr * 0.75, headY - hr * 0.85]], '#ffffff', { weight: 2.5 });
    Kit.ellipse(0, headY - hr * 0.15, hr * 1.05, hr * 0.2, PAL.blue, { weight: 2 });
    Kit.circle(-hr * 0.3, headY, hr * 0.08, PAL.ink, { stroke: false });
    Kit.circle(hr * 0.3, headY, hr * 0.08, PAL.ink, { stroke: false });
    pop();
    return { x: x + hx, y: y + hy };
  }

  // A small fish: oval body, tail, one eye. rot in radians, mood 'normal'|'pucker'.
  function drawFish(x, y, s, o = {}) {
    push(); translate(x, y); rotate(o.rot || 0);
    Kit.ellipse(0, 0, s * 0.5, s * 0.28, o.color || PAL.blue, { weight: 2.5 });
    Kit.poly([[-s * 0.45, 0], [-s * 0.68, -s * 0.2], [-s * 0.68, s * 0.2]], o.color || PAL.blue, { weight: 2.5 });
    Kit.circle(s * 0.18, -s * 0.04, s * 0.045, PAL.ink, { stroke: false });
    if (o.mood === 'pucker') Kit.circle(s * 0.34, 0, s * 0.05, '#7a3a3a', { weight: 2 });
    pop();
  }

  function drawStar(x, y, r, c) {
    Kit.streak(x - r, y, x + r, y, 3, c || PAL.yellow, 210);
    Kit.streak(x, y - r, x, y + r, 3, c || PAL.yellow, 210);
  }

  // ---------- background: deck, rail, sea, sky (no full ship) ----------
  function drawBackground(S) {
    Kit.gradient(0, 0, W, HORIZON, PAL.skyTop, mix(PAL.skyTop, PAL.skyLow, 0.55));
    Kit.paint([[0, 0], [W, 0], [W, 140], [0, 175]], '#ffffff', 65, 'p3-sky');
    Kit.sun(1130, 85, 48);
    Kit.cloud(230, 95, 160);

    // storm clouds gather at the horizon through the last line, hold through the close
    const stormU = ease.inOut(inv(14.4, 18.4, S.lt));
    if (stormU > 0) {
      Kit.cloud(130, 165 + 20 * stormU, 170 + 110 * stormU, PAL.cloudStorm, { weight: 3.5 });
      Kit.cloud(1150, 175 + 15 * stormU, 155 + 100 * stormU, PAL.cloudStorm, { weight: 3.5 });
    }

    Kit.sea(S.t, HORIZON, PAL.seaDeep, { amp: 8, phase: 0.4, foam: false, color2: PAL.stormSeaDeep });

    // rail
    for (let x = 40; x <= 1240; x += 145) Kit.streak(x, RAIL_TOP, x, RAIL_Y, 8, PAL.woodDark);
    Kit.line(20, RAIL_TOP, 1260, RAIL_TOP, { weight: 3, color: PAL.woodDark });

    // deck (no paint wash here: keeps the frame budget well clear of the 250 ms limit)
    Kit.poly([[0, RAIL_Y], [W, RAIL_Y], [W, H + 4], [0, H + 4]], PAL.wood);
    for (let y = RAIL_Y + 45; y < H; y += 55) Kit.line(0, y, W, y, { weight: 2, color: PAL.woodDark });
  }

  // ---------- joke 1 (t 0-4.8): the knot, THUD at 3.4 ----------
  function jokeKnot(S, lt) {
    const sailorX = 300, s = 128, clawdX = 640;
    const armA = lerp(0.5, 0.15, ease.inOut(clamp(inv(0, 1.0, lt))));
    const knot = drawSailor(sailorX, GROUND, 150, { armAngle: armA });
    Kit.ellipse(knot.x, knot.y, 26, 18, PAL.rope, { weight: 2.5 });
    Kit.circle(knot.x, knot.y, 8, PAL.rope, { weight: 2 });

    const wrapU = ease.out(clamp(inv(1.0, 2.6, lt)));
    const wraps = Math.floor(wrapU * 4 + 0.01);
    const fallU = clamp(inv(2.9, 3.4, lt));
    let mood = 'happy', squash = 0, lookX = 0.55;
    if (lt >= 1.0 && lt < 2.6) { mood = 'determined'; lookX = 0; }
    else if (lt >= 2.6 && lt < 3.4) { mood = 'surprised'; squash = -0.16; lookX = 0; }
    else if (lt >= 3.4) { mood = 'dizzy'; lookX = 0; squash = lerp(0.55, 0.16, clamp(inv(3.4, 4.4, lt))); }

    const rot = lt >= 2.9 ? ease.in(fallU) * 1.38 : 0;
    const bw = s * (1 + clamp(squash, -1, 1) * 0.18);

    push();
    translate(clawdX + bw / 2, GROUND);
    rotate(rot);
    Kit.clawd(-bw / 2, 0, s, { squash, mood, look: [lookX, 0], arms: rot > 0.4 ? 'out' : 'down' });
    if (wraps > 0 && lt < 3.5) for (let i = 0; i < wraps; i++) Kit.ellipse(-bw / 2, -s * 0.10 - i * 5, s * 0.34, s * 0.11, PAL.rope, { weight: 2 });
    if (lt >= 3.25) {
      Kit.ellipse(-bw / 2 - s * 0.13, -s * 0.06, s * 0.17, s * 0.12, PAL.rope, { weight: 2.5, rot: 0.5 });
      Kit.ellipse(-bw / 2 + s * 0.13, -s * 0.06, s * 0.17, s * 0.12, PAL.rope, { weight: 2.5, rot: -0.5 });
      Kit.circle(-bw / 2, -s * 0.06, s * 0.075, PAL.rope, { weight: 2 });
    }
    pop();

    const thudAge = lt - 3.4;
    if (thudAge >= 0 && thudAge < 0.45) {
      const dx = clawdX + bw * 0.75, dy = GROUND;
      for (let i = 0; i < 4; i++) {
        const a = i * 1.6 + 0.5;
        const r = 18 + thudAge * 110;
        Kit.circle(dx + Math.cos(a) * r * 0.6, dy - Math.abs(Math.sin(a)) * r * 0.2, 13 * (1 - thudAge * 2), '#ffffff', { stroke: false, alpha: 150 });
      }
    }
    Kit.sfx('THUD!', clawdX + 30, GROUND - 200, thudAge, { size: 110, rot: -0.1 });
  }

  // ---------- joke 2 (t 0-4.8, local): the mop, SQUEAK at 1.6 ----------
  function jokeMop(S, lt) {
    const clawdX = 420, s = 122;
    const scrub = Math.sin(lt * 20);
    Kit.clawd(clawdX, GROUND, s, { walk: lt * 18, arms: 'up', rot: scrub * 0.08, mood: 'determined', look: [scrub > 0 ? 0.5 : -0.5, 0] });

    // handle held steady at Clawd's raised nub, well clear of his body; the mop head sweeps beside him.
    // Drawn after Clawd so it always reads in front, never hidden behind his box at either extreme.
    const handX = clawdX + s * 1.05, handY = GROUND - s * 0.9;
    const mopX = clawdX + s * 1.05 + scrub * 46, mopY = GROUND + 10;
    Kit.streak(handX, handY, mopX, mopY, 10, PAL.woodDark);
    Kit.ellipse(mopX, mopY, s * 0.30, s * 0.15, '#e8dcae', { weight: 2.5 });
    for (let i = 0; i < 6; i++) Kit.streak(mopX - 20 + i * 8, mopY - 6, mopX - 20 + i * 8, mopY + 12, 3.5, '#b89a52');

    const shineU = ease.out(clamp(inv(0, 1.6, lt)));
    if (shineU > 0) {
      Kit.ellipse(clawdX + 55, GROUND + 14, 150 * shineU, 34 * shineU, '#ffffff', { stroke: false, alpha: 110 });
      Kit.ellipse(clawdX - 30, GROUND + 18, 90 * shineU, 22 * shineU, '#ffffff', { stroke: false, alpha: 90 });
    }

    Kit.sfx('SQUEAK!', clawdX - 20, GROUND - 210, lt - 1.6, { size: 96, rot: 0.08 });

    const skateU = ease.out(clamp(inv(1.6, 4.2, lt)));
    if (skateU > 0) {
      const sciX = lerp(140, 990, skateU);
      const wobble = Math.sin(lt * 9.5) * 0.22;
      Kit.scientist(sciX, GROUND, 155, { rot: wobble, arms: [2.5, 2.6], mood: 'surprised', prop: 'none' });
      for (let i = 0; i < 3; i++) Kit.streak(sciX - 45 - i * 18, GROUND - 70, sciX - 75 - i * 18, GROUND - 70, 4, '#ffffff', 150);
      const spark = Math.floor(lt * 3);
      for (let i = 0; i < 4; i++) {
        const a = (i / 4) * Math.PI * 2 + spark;
        const rx = sciX + Math.cos(a) * (60 + rand('p3spark', i, spark) * 20);
        const ry = GROUND - 175 + Math.sin(a) * (55 + rand('p3sparky', i, spark) * 15);
        drawStar(rx, ry, 8);
      }
    }
  }

  // ---------- joke 3 (t 0-4.8, local): the taste test, PTOOEY at 3.0 ----------
  function jokeTaste(S, lt) {
    const sciX = 900, h = 160;
    const waterY = 340;
    const mouthX = sciX - 0.017 * h, mouthY = GROUND - 0.77 * h;
    const pucker = lt >= 2.75;
    const armA = lerp(0.25, 1.3, ease.out(clamp(inv(0, 1.2, lt))));
    Kit.scientist(sciX, GROUND, h, { facing: -1, arms: [0.3, armA], prop: 'none', mood: 'happy' });

    const handX = sciX - (0.12 * h + Math.sin(armA) * h * 0.28), handY = GROUND - 0.67 * h + Math.cos(armA) * h * 0.28;
    const startY = GROUND - h * 0.45;
    const dipU = ease.inOut(clamp(inv(1.0, 1.8, lt)));      // lower the pipette to the sea
    const reelU = ease.inOut(clamp(inv(2.2, 2.75, lt)));    // then reel it back up to his mouth
    const pipetteX = lerp(730, mouthX, reelU);
    const pipetteY = reelU > 0 ? lerp(waterY, mouthY, reelU) : lerp(startY, waterY, dipU);
    Kit.streak(handX, handY, pipetteX + 8, pipetteY - 30, 5, PAL.wood);
    Kit.line(pipetteX + 8, pipetteY - 30, pipetteX, pipetteY, { weight: 2, color: PAL.ink });
    Kit.rect(pipetteX - 4, pipetteY - 15, 8, 18, '#dff3fb', { weight: 2 });
    Kit.circle(pipetteX, pipetteY - 17, 6, PAL.red, { weight: 2 });

    // taste: cover the smile with a small round pucker once the drop reaches his mouth
    if (pucker) {
      Kit.circle(mouthX, mouthY, h * 0.045, PAL.skin, { stroke: false });
      Kit.circle(mouthX, mouthY, h * 0.022, '#7a3a3a', { weight: 2 });
    }

    const fishU = ease.out(clamp(inv(1.8, 2.3, lt)));
    if (fishU > 0) drawFish(730 - 30, lerp(waterY + 40, waterY - 6, fishU), 68, { mood: pucker ? 'pucker' : 'normal' });

    const puckerAge = lt - 2.9;
    if (puckerAge >= 0 && puckerAge < 0.55) {
      Kit.streak(mouthX, mouthY, mouthX - 26, mouthY - 8, 3, '#bfe8f2', 190);
      Kit.streak(700, waterY - 6, 674, waterY - 20, 3, '#bfe8f2', 190);
    }
    Kit.sfx('PTOOEY!', 610, 165, lt - 3.0, { size: 100, rot: -0.06 });
  }

  // ---------- joke 4 (t 0-4.8, local): the notebook, WHEE at 0.4 ----------
  function jokeNotebook(S, lt) {
    const cx = 640;
    const pageU = ease.outBack(clamp(inv(0, 0.5, lt)));
    const pw = 620 * Math.max(pageU, 0), ph = 430 * Math.max(pageU, 0);
    const px0 = cx - pw / 2, py0 = 150;
    Kit.rect(px0, py0, pw, ph, '#fffdf5', { weight: 3 });

    if (pageU > 0.55) {
      Kit.label('Confirmed! Salty! Whee!', cx, py0 + 70, { size: 38, font: 'comic' });
      const baseY = py0 + 340, barW = 62;
      Kit.line(px0 + 60, baseY, px0 + pw - 60, baseY, { weight: 2.5 });
      [0.5, 0.95, 0.72].forEach((b, i) => {
        const bu = ease.outBack(clamp(inv(0.55 + i * 0.15, 0.95 + i * 0.15, lt)));
        const bh = 150 * b * clamp(bu, 0, 1.15);
        Kit.rect(px0 + 100 + i * 150, baseY - bh, barW, bh, [PAL.red, PAL.blue, PAL.green][i], { weight: 2 });
      });
    }

    const spinFacing = Math.sin(lt * 11) > 0 ? 1 : -1;
    const hop = Math.abs(Math.sin(lt * 5.5)) * 14;
    Kit.scientist(150, GROUND - hop, 140, { facing: spinFacing, arms: [2.4, 2.4], mood: 'happy', rot: Math.sin(lt * 11) * 0.12 });
    for (let i = 0; i < 4; i++) {
      const a = lt * 6 + i * 1.6;
      drawStar(150 + Math.cos(a) * 78, GROUND - 130 + Math.sin(a) * 55, 8);
    }

    drawFish(1130, GROUND - 40, 68, { rot: -0.1 });
    Kit.streak(1130, GROUND - 58, 1130, GROUND - 95, 4, PAL.blue);
    Kit.rect(1090, GROUND - 145, 92, 50, '#fffdf5', { weight: 2.5 });
    Kit.label('Duh.', 1136, GROUND - 116, { size: 22, font: 'bold' });

    Kit.sfx('WHEE!', cx, 118, lt - 0.4, { size: 118, rot: -0.1 });
  }

  function draw(S) {
    drawBackground(S);
    const t = S.lt;
    if (t < 4.8) jokeKnot(S, t);
    else if (t < 9.6) jokeMop(S, t - 4.8);
    else if (t < 14.4) jokeTaste(S, t - 9.6);
    else jokeNotebook(S, t - 14.4);
  }

  Scenes.register(3, { draw });
})();
