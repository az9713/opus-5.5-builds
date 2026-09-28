// Part 6 — Land Ho (105.6-124.8s). Storm clears, sky turns blue, sea calms,
// an island with a palm tree appears on the horizon and comes closer.
// Jokes: (0) clouds break like puzzle pieces, sun peeks through with sunglasses -- PEEK-A-BOO!
//        (1) a gull lands on Clawd's head like a helipad, runway lights blink -- SQUAWK! (S.since('gull'))
//        (2) the scientist's telescope extends across the screen to a crab on the island -- ZOOOM!
//        (3) the shout blows off the crew's hats, music notes burst from everyone -- LAND HO!
(function () {
  const { PAL, W, H, ease, inv, ping, lerp, clamp, mix } = Kit;
  const K = Kit; // short alias used by the local helper functions below

  // ---------- small drawn props (Kit shapes only) ----------
  function note(x, y, s, color, alpha) {
    K.ellipse(x, y, s * 0.5, s * 0.36, color, { rot: -0.35, weight: 2, alpha });
    K.rect(x + s * 0.42, y - s * 1.3, s * 0.09, s * 1.3, color, { weight: 2, alpha });
    K.poly([[x + s * 0.51, y - s * 1.3], [x + s * 0.95, y - s * 1.05], [x + s * 0.95, y - s * 0.75], [x + s * 0.51, y - s * 0.95]], color, { weight: 2, alpha });
  }
  function notesBurst(x, y, age, scale) {
    if (age < 0 || age > 1.2) return;
    const u = age / 1.2, fade = Math.round(255 * (1 - u));
    for (let i = 0; i < 2; i++) {
      const a = -0.7 + i * 1.0;
      const dist = ease.out(u) * 80 * scale;
      const nx = x + Math.sin(a) * dist * 0.6, ny = y - Math.cos(a) * dist - u * 30 * scale;
      note(nx, ny, 15 * scale, PAL.ink, fade);
    }
  }
  // A local sailor: circle head, striped block body, stick arms. o.hat === false hides the hat (drawn by caller instead).
  function sailor(x, y, h, o = {}) {
    const bw = h * 0.5, bh = h * 0.55, legH = h * 0.22, bob = o.bob || 0;
    push(); translate(x, y - bob);
    K.rect(-bw * 0.22, -legH, bw * 0.17, legH, PAL.pants, { weight: 2.5 });
    K.rect(bw * 0.06, -legH, bw * 0.17, legH, PAL.pants, { weight: 2.5 });
    const top = -legH - bh;
    K.rect(-bw / 2, top, bw, bh, o.shirt || PAL.blue, { r: h * 0.06, weight: 3 });
    for (let i = 1; i < 4; i++) K.streak(-bw / 2 + 2, top + (bh * i) / 4, bw / 2 - 2, top + (bh * i) / 4, h * 0.02, '#ffffff', 170);
    const armY = top + bh * 0.22, wave = o.wave || 0;
    K.streak(-bw / 2, armY, -bw / 2 - h * 0.14, armY + h * 0.18, h * 0.06, o.shirt || PAL.blue);
    K.streak(bw / 2, armY, bw / 2 + h * 0.14, armY + h * 0.18 - wave * h * 0.3, h * 0.06, o.shirt || PAL.blue);
    const headY = top - h * 0.12;
    K.circle(0, headY, h * 0.12, PAL.skin, { weight: 2.5 });
    K.circle(-h * 0.04, headY - h * 0.01, h * 0.015, PAL.ink, { stroke: false });
    K.circle(h * 0.04, headY - h * 0.01, h * 0.015, PAL.ink, { stroke: false });
    K.curve([[-h * 0.04, headY + h * 0.05], [0, headY + h * 0.07], [h * 0.04, headY + h * 0.05]], { weight: 2 });
    if (o.hat !== false) hat(0, headY, h, o.hatColor || PAL.woodDark, -1);
    pop();
    return { headY: y - bob + headY };
  }
  // Hat resting (age < 0) or blown off (age >= 0, rises and spins away).
  function hat(headX, headY, h, color, side, age = -1) {
    if (age < 0) {
      K.poly([[headX - h * 0.13, headY - h * 0.05], [headX + h * 0.13, headY - h * 0.05], [headX + h * 0.09, headY - h * 0.22], [headX - h * 0.09, headY - h * 0.22]], color, { weight: 2.5 });
      return;
    }
    if (age > 2.4) return;
    const rise = ease.out(clamp(age / 1.4)) * 260;
    const hx = headX + side * age * 60, hy = headY - h * 0.13 - rise, rot = side * age * 3.2;
    push(); translate(hx, hy); rotate(rot);
    K.poly([[-h * 0.13, -h * 0.05], [h * 0.13, -h * 0.05], [h * 0.09, -h * 0.22], [-h * 0.09, -h * 0.22]], color, { weight: 2.5 });
    pop();
  }
  function crab(x, y, s, scared) {
    push(); translate(x, y);
    K.ellipse(0, 0, s * 0.5, s * 0.3, PAL.red, { weight: 2.5 });
    for (const side of [-1, 1]) {
      K.line(side * s * 0.3, -s * 0.14, side * s * 0.42, -s * 0.34, { weight: 2.5 });
      K.circle(side * s * 0.42, -s * 0.36, s * (scared ? 0.11 : 0.07), '#ffffff', { weight: 2 });
      K.circle(side * s * 0.42, -s * 0.36, s * 0.035, PAL.ink, { stroke: false });
      K.poly([[side * s * 0.5, -s * 0.04], [side * s * 0.72, -s * 0.12], [side * s * 0.62, s * 0.06]], PAL.red, { weight: 2 });
    }
    for (let i = -1; i <= 1; i += 2) K.streak(i * s * 0.14, s * 0.14, i * s * 0.2, s * 0.26, s * 0.05, PAL.red);
    pop();
  }
  function palm(x, y, h, lean) {
    push(); translate(x, y);
    const tipX = h * 0.22 * lean, tipY = -h;
    K.poly([[-h * 0.05, 0], [h * 0.05, 0], [tipX + h * 0.04, tipY], [tipX - h * 0.04, tipY]], PAL.woodDark, { weight: 2.5 });
    for (let i = 0; i < 5; i++) {
      const a = -0.9 + i * 0.45;
      K.ellipse(tipX + Math.cos(a) * h * 0.32, tipY + Math.sin(a) * h * 0.14, h * 0.34, h * 0.09, PAL.green, { rot: a, weight: 2.5 });
    }
    pop();
  }
  function island(x, y, w, hgt, showCrab, crabScared) {
    const pts = [[x - w * 0.55, y], [x - w * 0.4, y - hgt * 0.7], [x - w * 0.05, y - hgt], [x + w * 0.35, y - hgt * 0.75], [x + w * 0.5, y - hgt * 0.15], [x + w * 0.45, y + 6], [x - w * 0.5, y + 6]];
    K.poly(pts, PAL.sand, { weight: 3 });
    K.ellipse(x - w * 0.1, y - hgt * 0.55, w * 0.24, hgt * 0.28, PAL.grass, { stroke: false, alpha: 160 });
    palm(x + w * 0.12, y - hgt * 0.5, hgt * 1.7, 1);
    if (showCrab) crab(x - w * 0.18, y - hgt * 0.28, hgt * 0.6, crabScared);
  }

  function toScreen(sx, sy, tilt, lx, ly) {
    const c = Math.cos(tilt), s = Math.sin(tilt);
    return [sx + lx * c - ly * s, sy + lx * s + ly * c];
  }

  function draw(S) {
    const t = S.t, lt = S.lt;
    const uAll = clamp(lt / S.dur); // 0..1 across the whole part: storm clears, island approaches

    // ---------- sky: storm clears to blue ----------
    const skyClear = ease.out(clamp(lt / 4.0));
    Kit.gradient(0, 0, W, 480, mix(PAL.stormSky, PAL.skyTop, skyClear), mix(PAL.stormSkyLow, PAL.skyLow, skyClear));
    Kit.paint([[0, 0], [W, 0], [W, 260], [0, 320]], '#ffffff', 70, 'p6-sky');

    // ---------- joke 0: clouds break apart like puzzle pieces, sun peeks through ----------
    const cu = ease.out(clamp(lt / 2.8));
    const pieces = [[-0.34, -0.22, -1.5, -0.9], [0.32, -0.2, 1.55, -0.85], [-0.22, 0.16, -1.1, 0.9], [0.26, 0.18, 1.2, 0.95]];
    if (lt < 3.4) for (const [dx, dy, tx, ty] of pieces) {
      const px = 640 + dx * 260 + tx * W * cu, py = 150 + dy * 170 + ty * H * 0.55 * cu;
      Kit.cloud(px, py, 240, mix(PAL.cloudStorm, PAL.cloud, cu * 0.6));
    }
    const uSun = clamp(lt / 4.4);
    const sunX = lerp(640, 1080, ease.out(uSun)), sunY = lerp(220, 110, ease.out(uSun)), sunR = 60 * ease.out(clamp(lt / 2.2));
    if (sunR > 2) {
      Kit.sun(sunX, sunY, sunR, { face: true });
      const glassesU = clamp((lt - 2.0) / 0.4);
      if (glassesU > 0) {
        K.rect(sunX - sunR * 0.55, sunY - sunR * 0.22, sunR * 0.42, sunR * 0.22, PAL.ink, { r: sunR * 0.08, alpha: 230 * glassesU });
        K.rect(sunX + sunR * 0.12, sunY - sunR * 0.22, sunR * 0.42, sunR * 0.22, PAL.ink, { r: sunR * 0.08, alpha: 230 * glassesU });
        K.streak(sunX - sunR * 0.12, sunY - sunR * 0.11, sunX + sunR * 0.12, sunY - sunR * 0.11, sunR * 0.07, PAL.ink, 230 * glassesU);
      }
    }
    Kit.sfx('PEEK-A-BOO!', 620, 190, lt - 2.35, { size: 96, rot: -0.1 });

    // ---------- back sea (calming) ----------
    const seaAmp = lerp(20, 7, clamp(lt / 8));
    Kit.sea(t, 460, PAL.seaDeep, { amp: seaAmp, phase: 1, foam: false });

    // ---------- island on the horizon, coming closer ----------
    const isU = Math.pow(uAll, 1.4);
    const islandX = lerp(1230, 760, isU), islandBaseY = lerp(458, 560, isU);
    const islandW = lerp(28, 430, isU), islandH = lerp(13, 135, isU);
    const showCrab = lt >= 9.6 && lt <= 14.6;
    const u2 = clamp((lt - 9.6) / 3.0);
    island(islandX, islandBaseY, islandW, islandH, showCrab, u2 > 0.7);

    // ---------- ship + characters ----------
    const shipX = 520, shipLen = 560;
    const deckY = Kit.waveY(shipX, t, 460, seaAmp * 0.9) - 30;
    const tilt = Math.sin(t * 1.15) * lerp(0.045, 0.015, clamp(lt / 8));
    const hop = S.beatInBar % 2 === 1 ? S.pulse * 6 : 0;

    const gullLanded = isFinite(S.since('gull'));
    const gullAge = S.since('gull');
    const clawdSquash = gullLanded && gullAge < 0.3 ? ping(gullAge / 0.3) * 0.45 : 0;
    const clawdMood = gullLanded && gullAge < 0.25 ? 'surprised' : 'happy';
    const clawdLook = !gullLanded && lt > 4.8 && lt < 5.2 ? [0, -1] : [0, 0];

    const hatsAge = lt - 14.7;

    push(); translate(shipX, deckY); rotate(tilt);
    Kit.ship(shipLen, { billow: 0.35, sail: true, t });

    // crew (background, aft)
    const s1 = sailor(-200, -hop, 148, { hat: false });
    hat(-200, s1.headY, 148, PAL.woodDark, -1, hatsAge);
    notesBurst(-200, s1.headY - 20, (hatsAge >= 0 ? hatsAge % 1.7 : -1), 1);

    // Clawd
    K.clawd(-70, 0, 125, { squash: clawdSquash, mood: clawdMood, look: clawdLook, blink: (t % 3.3) < 0.12, arms: 'down' });
    // perched gull (like a helipad) and runway lights along Clawd's top edge
    if (gullLanded) {
      const flap = Math.sin(t * 5) * 0.1, gx = -70, gy = -125 * 0.97;
      K.ellipse(gx, gy + 8, 32, 20, PAL.gull, { weight: 3 });
      K.gull(gx, gy - 6, 60, flap, { weight: 3 });
      K.poly([[gx + 14, gy + 8], [gx + 30, gy + 4], [gx + 14, gy + 14]], PAL.yellow, { weight: 2 });
      K.circle(gx + 8, gy + 2, 3, PAL.ink, { stroke: false });
      for (let i = -2; i <= 2; i++) {
        const on = Math.floor(t * 3 + i) % 2 === 0;
        K.circle(-70 + i * 26, -125 * 0.9, 4, on ? PAL.yellow : PAL.clawdDark, { weight: 1.2 });
      }
      notesBurst(gx, gy - 46, (hatsAge >= 0 ? (hatsAge + 0.3) % 1.7 : -1), 0.8);
    }
    notesBurst(-70, -125 * 1.05, (hatsAge >= 0 ? hatsAge % 1.7 : -1), 1);
    const [squawkX, squawkY] = toScreen(shipX, deckY, tilt, -70, -125 * 0.98 - 70);

    // scientist with the telescope joke
    const inScope = lt >= 9.6 && lt <= 14.4;
    K.scientist(30, 0, 160, { facing: 1, arms: inScope ? [0.2, 1.35] : [0.15, 0.15], prop: inScope ? 'none' : 'telescope', mood: inScope ? 'squint' : 'happy', hair: 'normal' });
    notesBurst(30, -160 * 0.84 - 10, (hatsAge >= 0 ? hatsAge % 1.7 : -1), 1);

    // crew (fore)
    const s2 = sailor(170, -hop, 148, { hat: false, shirt: PAL.green });
    hat(170, s2.headY, 148, PAL.rope, 1, hatsAge);
    notesBurst(170, s2.headY - 20, (hatsAge >= 0 ? (hatsAge + 0.6) % 1.7 : -1), 1);

    // scientist's hand point, for the telescope drawn outside this transform
    const handLocal = [30 + 160 * 0.16, -160 * 0.66];
    pop();
    Kit.sfx('SQUAWK!', squawkX, squawkY, gullAge, { size: 92, rot: 0.08 });

    // ---------- joke 2: the telescope extends across the screen to the island ----------
    if (inScope) {
      const [hx, hy] = toScreen(shipX, deckY, tilt, handLocal[0], handLocal[1]);
      const tx = islandX - islandW * 0.15, ty = islandBaseY - islandH * 0.55;
      const eu2 = ease.out(u2);
      const tipX = lerp(hx, tx, eu2), tipY = lerp(hy, ty, eu2);
      const dx = tipX - hx, dy = tipY - hy, len = Math.hypot(dx, dy) || 1, ux = dx / len, uy = dy / len;
      const segs = 3;
      for (let i = 0; i < segs; i++) {
        const a0 = (i / segs) * len, a1 = ((i + 1) / segs) * len, wgt = lerp(20, 9, i / (segs - 1));
        K.streak(hx + ux * a0, hy + uy * a0, hx + ux * a1, hy + uy * a1, wgt, i % 2 ? PAL.woodDark : '#c9a13b');
      }
      K.circle(hx, hy, 11, PAL.woodDark, { weight: 2.5 });
      K.circle(tipX, tipY, 9, PAL.ink, { weight: 2.5 });
      Kit.sfx('ZOOOM!', 640, 300, lt - 12.6, { size: 100, rot: -0.08 });
    }

    // ---------- front sea (foreground) ----------
    Kit.sea(t, 552, PAL.sea, { amp: seaAmp * 1.15, color2: PAL.seaDeep });
    Kit.paint([[0, 500], [W, 480], [W, H], [0, H]], '#ffffff', 55, 'p6-foam');

    // ---------- flying gull, before it lands ----------
    if (!gullLanded && lt >= 4.8 && lt < 5.2) {
      const flyU = clamp((lt - 4.8) / 0.4);
      const [hx, hy] = toScreen(shipX, deckY, tilt, -70, -125 * 0.98);
      const gx = lerp(-40, hx, ease.in(flyU)), gy = lerp(150, hy, ease.in(flyU));
      K.gull(gx, gy, 50, t * 10, { body: true, weight: 3 });
    }

    // ---------- joke 3: fish jumps and joins the song ----------
    if (lt >= 14.4 && lt <= 17.2) {
      const fu = clamp((lt - 14.7) / 1.0);
      const fy = 552 - ping(fu) * 90;
      K.poly([[300, fy], [340, fy - 14], [360, fy], [340, fy + 14]], PAL.seaLight, { weight: 2.5 });
      K.poly([[300, fy], [280, fy - 12], [280, fy + 12]], PAL.seaLight, { weight: 2.5 });
      K.circle(345, fy - 3, 3, PAL.ink, { stroke: false });
      notesBurst(320, fy - 30, lt - 14.9, 0.8);
    }

    Kit.sfx('LAND HO!', 640, 210, lt - 15.3, { size: 120, rot: -0.06 });
  }

  Scenes.register(6, { draw });
})();
