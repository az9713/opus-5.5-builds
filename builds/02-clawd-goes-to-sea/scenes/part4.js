// Part 4 — The Storm (song 67.2-86.4 s). Sky goes grey -> black in line 0, tall dark
// waves and wind throughout, ship pitching hard. Thunder at local 0.5 s (67.7) and
// 10.8 s (78.0): flashes/bolts/sound-words are keyed to S.since('thunder').
// Opens already darkening (storm-cloud transition covers first 0.55 s).
// Ends holding lightning-hits-mast (lightning white-out transition covers last 0.55 s).
(function () {
  const { PAL, W, ease, inv, ping, lerp, mix, clamp, rand } = Kit;

  const LINE_DUR = 4.8;
  const SHIP_LEN = 520, SHIP_X = 660;
  const SEA_Y0 = 495, SEA_AMP = 44, SEA_PH = 0.5, SEA_SPD = 1.05;
  const FRONT_Y0 = 560, FRONT_AMP = 54;
  const MX = -SHIP_LEN * 0.04; // mast x in ship-local space (sail is furled: sail:false, whole mast is bare)

  const blink = (t) => (t % 3.3) < 0.11;

  function skyColors(u) {
    const greyTop = mix(PAL.stormSky, PAL.cloud, 0.5), greyLow = mix(PAL.stormSkyLow, PAL.cloud, 0.35);
    const darkTop = mix(PAL.stormSky, PAL.ink, 0.6), darkLow = mix(PAL.stormSkyLow, PAL.ink, 0.5);
    return { greyTop, greyLow, darkTop: mix(greyTop, darkTop, u), darkLow: mix(greyLow, darkLow, u) };
  }

  function drawSky(S) {
    const li = S.li, u = li >= 0 ? S.lp : 0;
    const c = skyColors(li <= 0 ? clamp(u) : 1);
    // base: the grey morning sky, only ever seen above the descending blind in line 0
    Kit.gradient(0, 0, W, 480, c.greyTop, c.greyLow);
    // the storm blind: covers from the top down to edgeY. Descends during line 0,
    // then stays at full height (480) for the rest of the part -> sky reads black.
    const edgeY = li === 0 ? lerp(80, 480, ease.inOut(clamp(u))) : 480;
    Kit.gradient(0, 0, W, edgeY, c.darkTop, c.darkLow);
    if (li === 0) {
      // grumpy cloud along the blind's leading edge (two puffs to span the width)
      Kit.cloud(340, edgeY - 6, 640, mix(PAL.cloudStorm, PAL.ink, 0.2), { weight: 4 });
      Kit.cloud(940, edgeY - 6, 640, mix(PAL.cloudStorm, PAL.ink, 0.2), { weight: 4 });
      // grumpy face, off to the left so the KRA-KOOM! word and the rolling barrel
      // (which enters from the left) do not cover it
      const fx = 220, fy = edgeY - 26;
      Kit.line(fx - 44, fy - 22, fx - 12, fy - 6, { weight: 6 });
      Kit.line(fx + 44, fy - 22, fx + 12, fy - 6, { weight: 6 });
      Kit.circle(fx - 20, fy + 6, 10, '#ffffff', { weight: 2.5 });
      Kit.circle(fx + 20, fy + 6, 10, '#ffffff', { weight: 2.5 });
      Kit.circle(fx - 20, fy + 9, 4, PAL.ink, { stroke: false });
      Kit.circle(fx + 20, fy + 9, 4, PAL.ink, { stroke: false });
      Kit.curve([[fx - 22, fy + 30], [fx, fy + 20], [fx + 22, fy + 30]], { weight: 4 });
      // the barrel of thunder rolls across the cloud tops, timed to the crack itself
      const since = S.since('thunder');
      const bx = lerp(-100, W + 100, ease.out(clamp(since / 2.5)));
      const by = edgeY - 30;
      Kit.rect(bx - 85, by - 32, 170, 64, mix(PAL.cloudStorm, PAL.wood, 0.3), { r: 30, weight: 3.5 });
      const bandPhase = (bx * 0.35) % 40;
      for (let i = -1; i <= 1; i++) Kit.line(bx - 55 + i * 40 + bandPhase * (i === 0 ? 0.3 : -0.2), by - 30, bx - 55 + i * 40 + bandPhase * (i === 0 ? 0.3 : -0.2), by + 30, { weight: 5, color: PAL.woodDark });
    }
    // fast dark cloud wisps streaking by = wind
    Kit.cloud((150 + S.t * 230) % (W + 400) - 200, 92, 240, mix(PAL.cloudStorm, PAL.ink, 0.25), { stroke: false });
    Kit.cloud((520 + S.t * 185) % (W + 400) - 200, 150, 200, mix(PAL.cloudStorm, PAL.ink, 0.4), { stroke: false });
    Kit.paint([[0, 0], [W, 0], [W, 260], [0, 300]], PAL.ink, 30, 'p4-sky', { texture: 0.5, bleed: 0.06 });
    return edgeY;
  }

  // A single huge mischievous wave beside the ship (line 1 only; 0 elsewhere).
  function drawGiantWave(S, t) {
    const growth = S.li === 1 ? ping(inv(0.06, 0.94, S.lp)) : 0;
    if (growth < 0.02) return;
    const x = 1040, base = Kit.waveY(x, t, SEA_Y0, SEA_AMP, SEA_PH, SEA_SPD);
    const peak = lerp(base, 110, growth);
    const w = 210;
    const pts = [
      [x - w * 0.55, base + 30], [x - w * 0.42, base - 10],
      [x - w * 0.3, lerp(base, peak, 0.35)], [x - w * 0.08, lerp(base, peak, 0.75)],
      [x, peak], [x + w * 0.22, lerp(base, peak, 0.55)],
      [x + w * 0.15, lerp(base, peak, 0.3)], [x + w * 0.4, base],
      [x + w * 0.5, base + 40], [x - w * 0.55, base + 40],
    ];
    Kit.poly(pts, PAL.stormSea, { weight: 3.5 });
    Kit.streak(x - w * 0.25, lerp(base, peak, 0.4), x + w * 0.05, lerp(base, peak, 0.78), 10, PAL.foam, 200);
    if (growth > 0.35) {
      const ex = x - 10, ey = lerp(base, peak, 0.85);
      Kit.circle(ex - 26, ey, 9 * growth, '#ffffff', { weight: 2 });
      Kit.circle(ex + 14, ey - 4, 9 * growth, '#ffffff', { weight: 2 });
      Kit.circle(ex - 26, ey + 2, 4 * growth, PAL.ink, { stroke: false });
      Kit.circle(ex + 14, ey - 2, 4 * growth, PAL.ink, { stroke: false });
      Kit.curve([[ex - 34, ey + 16], [ex - 8, ey + 26 * growth], [ex + 24, ey + 12]], { weight: 3.5 });
    }
  }

  const STACK_H = 78; // book stack height: raises Clawd so he reaches the hub
  const WHEEL_R = 95; // rim radius: kept well clear of Clawd's own body width

  function drawWheel(S, wheelLX, hubY) {
    const since = S.since('thunder');
    const anticip = S.lt < 10.8 ? -0.15 * ease.inOut(inv(10.5, 10.8, S.lt)) : 0;
    const spin = anticip + 6 * Math.PI * ease.out(clamp(since / 1.2));
    const spinning = since >= 0.15 && since <= 1.3;
    push(); translate(wheelLX, 0);
    Kit.rect(-10, hubY, 20, -hubY, PAL.woodDark, { weight: 3 });
    // the scientist's books, stacked so Clawd can reach
    for (let i = 0; i < 3; i++) {
      const bh = STACK_H / 3, by0 = -bh * (i + 1), bw2 = 84 - i * 6, rotB = (rand('book', i) - 0.5) * 0.1;
      push(); translate(0, by0 + bh / 2); rotate(rotB);
      Kit.rect(-bw2 / 2, -bh / 2, bw2, bh, [PAL.blue, PAL.red, PAL.green][i], { weight: 2.5, r: 3 });
      pop();
    }
    push(); translate(0, hubY); rotate(spin);
    Kit.circle(0, 0, WHEEL_R, null, { weight: 16, ink: PAL.woodDark });
    for (let i = 0; i < 8; i++) {
      const a = i * Math.PI / 4;
      Kit.line(Math.cos(a) * 22, Math.sin(a) * 22, Math.cos(a) * WHEEL_R, Math.sin(a) * WHEEL_R, { weight: 8, color: PAL.wood });
      Kit.circle(Math.cos(a) * (WHEEL_R + 8), Math.sin(a) * (WHEEL_R + 8), 12, PAL.woodDark, { weight: 2.5 });
    }
    Kit.circle(0, 0, 22, PAL.woodDark, { weight: 3 });
    const mood = anticip < -0.02 ? 'determined' : (spinning ? 'dizzy' : 'happy');
    Kit.clawd(0, STACK_H, 96, { arms: 'out', mood, look: [0, -0.3], blink: blink(S.t), color: mood === 'dizzy' ? mix(PAL.clawd, PAL.clawdLight, 0.4) : PAL.clawd });
    pop();
    pop();
  }

  function drawLightBulb(x, y, lit) {
    const glass = mix(mix(PAL.sail, PAL.ink, 0.12), PAL.yellow, lit);
    Kit.circle(x, y, 21, glass, { weight: 3 });
    Kit.rect(x - 8, y + 17, 16, 13, PAL.woodDark, { weight: 2 });
    Kit.line(x - 12, y + 16, x + 12, y + 16, { weight: 2 });
    Kit.curve([[x - 7, y - 6], [x, y + 4], [x + 7, y - 6]], { weight: 2 });
    Kit.line(x - 6, y - 10, x + 3, y - 15, { weight: 2 });
    if (lit > 0.5) for (let i = 0; i < 6; i++) { const a = i * Math.PI / 3; Kit.streak(x + Math.cos(a) * 27, y + Math.sin(a) * 27, x + Math.cos(a) * 40, y + Math.sin(a) * 40, 4, PAL.yellow, 200); }
  }

  function draw(S) {
    const t = S.t, li = S.li, u = li >= 0 ? S.lp : 0;
    drawSky(S);

    Kit.sea(t, SEA_Y0, PAL.stormSeaDeep, { amp: SEA_AMP, phase: SEA_PH, speed: SEA_SPD, foam: false, stroke: false });
    drawGiantWave(S, t);

    const deckY = Kit.waveY(SHIP_X, t, SEA_Y0, SEA_AMP, SEA_PH, SEA_SPD) - 18;
    const tilt = Math.sin(t * 1.3 + 0.4) * 0.10 + Math.sin(t * 3.05) * 0.045;
    const toScreen = (px, py) => [SHIP_X + px * Math.cos(tilt) - py * Math.sin(tilt), deckY + px * Math.sin(tilt) + py * Math.cos(tilt)];

    push(); translate(SHIP_X, deckY); rotate(tilt);
    Kit.ship(SHIP_LEN, { t, sail: false, billow: 0 });

    if (li === 0) {
      // startled bystanders as the sky goes dark
      const flinch = ping(clamp(S.since('thunder') / 0.4)) * 0.12;
      Kit.clawd(-170, 0, 120, { mood: 'surprised', look: [0, -1], squash: -flinch, blink: blink(t) });
      Kit.scientist(110, 0, 165, { facing: -1, arms: [0.3, 1.9], mood: 'surprised', look: [0, -1], blink: blink(t) });
    } else if (li === 1) {
      const cold = ping(clamp(inv(0.12, 0.8, u)));
      const shiver = Math.sin(t * 42) * 0.055 * cold;
      const col = mix(PAL.clawd, '#8fc7e8', cold * 0.75);
      Kit.clawd(-30, 0, 118, { mood: cold > 0.5 ? 'scared' : 'happy', rot: shiver, color: col, blink: blink(t) });
      if (cold > 0.2) {
        Kit.poly([[-30 - 46, -66], [-30 - 34, -66 - 26 * cold], [-30 - 26, -66]], PAL.foam, { weight: 2 });
        Kit.poly([[-30 + 30, -70], [-30 + 42, -70 - 30 * cold], [-30 + 50, -70]], PAL.foam, { weight: 2 });
      }
      Kit.scientist(190, 0, 160, { facing: -1, arms: [0.2, 0.9], mood: 'scared', blink: blink(t) });
    } else if (li === 2) {
      drawWheel(S, -90, -120);
      Kit.scientist(-250, 0, 160, { facing: 1, arms: [0.2, 2.4], mood: 'surprised', blink: blink(t) });
    } else if (li === 3) {
      const strikeU = 0.333, ageStrike = (u - strikeU) * LINE_DUR;
      const struck = ageStrike >= 0;
      const litT = struck ? clamp(inv(0, 0.25, ageStrike)) : 0;
      const tap = struck ? 0 : Math.sin(t * 6) * 0.08;
      const glowA = struck ? clamp(inv(0, 0.3, ageStrike)) * 0.85 : 0;
      const sciX = 55, sciH = 160;
      if (glowA > 0.01) Kit.circle(sciX, -sciH * 0.84 - 10, 46, '#fff2a8', { stroke: false, alpha: glowA * 200 });
      Kit.scientist(sciX, 0, sciH, {
        facing: -1, arms: [0.2, 2.5 + tap], hair: struck ? 'static' : 'normal',
        mood: struck ? (ageStrike < 0.35 ? 'surprised' : 'happy') : 'squint', blink: blink(t),
      });
      const hand = handPos(sciX, sciH, -1, 2.5 + tap);
      drawLightBulb(hand[0], hand[1], litT);
      Kit.clawd(-190, 0, 118, { mood: struck ? 'surprised' : 'happy', look: [0.4, -0.3], blink: blink(t) });
    }
    pop();

    Kit.sea(t, FRONT_Y0, PAL.stormSea, { amp: FRONT_AMP, phase: SEA_PH + 1.4, speed: SEA_SPD, color2: PAL.stormSeaDeep, foam: true });
    Kit.rain(t, 14, { slant: 0.62, len: 26, color: mix(PAL.cloud, PAL.stormSkyLow, 0.35) });

    // thunder flashes/bolts, keyed to the shared audio event
    if (li === 0) {
      const since = S.since('thunder');
      if (since <= 0.35) Kit.flash(0.6 * (1 - since / 0.35));
      if (since <= 0.5) Kit.bolt(300, 20, 250, {});
      Kit.sfx('KRA-KOOM!', 880, 110, since, { size: 150, rot: -0.08 });
    } else if (li === 1) {
      const cold = ping(clamp(inv(0.12, 0.8, u)));
      Kit.sfx('BRRR!', 250, 260, cold > 0.55 ? (0.8 - cold * 0.7) : -1, { size: 118, rot: 0.1 });
    } else if (li === 2) {
      const since = S.since('thunder');
      if (since <= 0.3) Kit.flash(0.55 * (1 - since / 0.3));
      if (since <= 0.45) Kit.bolt(970, 10, 220, {});
      const [wx, wy] = toScreen(-90, -190);
      Kit.sfx('CRACK!', wx, wy, since, { size: 140, rot: -0.1 });
    } else if (li === 3) {
      const strikeU = 0.333, ageStrike = (u - strikeU) * LINE_DUR;
      if (ageStrike >= 0) {
        const [bx, by] = toScreen(MX, -300);
        Kit.bolt(bx - 6, by - 260, 260, {});
        if (ageStrike < 0.16) Kit.flash(0.55 * (1 - ageStrike / 0.16));
      }
      const [sx, sy] = toScreen(55, -270);
      Kit.sfx('ZAP!', sx, sy, ageStrike, { size: 150, rot: 0.05 });
    }
  }

  // Reproduce Kit.scientist's front-hand placement so the light bulb sits in-hand.
  function handPos(x, h, facing, a) {
    const ax = h * 0.12, ay = -h * 0.7 + h * 0.03, len = h * 0.28;
    const hx = ax + Math.sin(a) * len, hy = ay + Math.cos(a) * len;
    return [x + facing * hx, hy];
  }

  Scenes.register(4, { draw });
})();
