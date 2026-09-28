// Part 5 — Heave Through the Gale (86.4-105.6s), the storm chorus.
// Full storm: heavy rain, dark tall waves, ship tossed about. One joke per line:
//  L0 heave in the rain, Clawd's rope pulls a rain cloud down on himself only (WHOOSH!)
//  L1 the scientist spins on the mast top like a weather vane, N/E/S/W circling (SPIN!)
//  L2 one crew stomp, the ship jumps clean over a wave (HO!)
//  L3 the ship surfs a giant wave, Clawd surfs the bow, scientist flaps from the mast,
//     a crack of golden light grows in the clouds (thunder #2 KA-BOOM! lands here)
// Thunder at 86.6s and 101.2s (lt 0.2 and 14.8) always gets a flash + KA-BOOM!, via S.since('thunder').
(function () {
  const { PAL, W, H, ease, inv, ping, lerp, clamp, rand } = Kit;

  // ---------- small helpers ----------
  // World point inside the ship's push/translate(shipX,deckY)/rotate(tilt) block, converted
  // to screen coordinates for Kit.sfx/Kit.label (they ignore transforms).
  function shipToScreen(shipX, deckY, tilt, lx, ly) {
    const c = Math.cos(tilt), s = Math.sin(tilt);
    return [shipX + lx * c - ly * s, deckY + lx * s + ly * c];
  }

  // A plain crew sailor: circle head, block shirt, streak arms/legs. Cheap on purpose.
  function sailor(x, y, h, o = {}) {
    const bw = h * 0.52, bh = h * 0.44, legH = h * 0.32, sq = clamp(o.squash || 0, -1, 1);
    const bh2 = bh * (1 - sq * 0.35), legH2 = legH * (1 - sq * 0.4);
    push(); translate(x, y); if (o.rot) rotate(o.rot);
    for (const side of [-1, 1]) Kit.streak(side * bw * 0.16, -legH2, side * bw * 0.16 + (o.stagger || 0) * side, 0, h * 0.13, PAL.pants);
    Kit.rect(-bw / 2, -legH2 - bh2, bw, bh2, o.shirt || PAL.blue, { r: h * 0.04 });
    Kit.streak(-bw / 2 + 3, -legH2 - bh2 * 0.5, bw / 2 - 3, -legH2 - bh2 * 0.5, h * 0.055, '#ffffff', 150);
    const arms = o.arms || [0.35, 0.35];
    for (const [side, a] of [[-1, arms[0]], [1, arms[1]]]) {
      const ax = side * bw * 0.48, ay = -legH2 - bh2 * 0.82;
      const hx = ax + Math.sin(a) * h * 0.34 * side, hy = ay - Math.cos(a) * h * 0.34;
      Kit.streak(ax, ay, hx, hy, h * 0.1, o.shirt || PAL.blue);
      if (o.hand) Kit.circle(hx, hy, h * 0.05, PAL.skin, { weight: 2 });
    }
    Kit.circle(0, -legH2 - bh2 - h * 0.15, h * 0.15, PAL.skin, { weight: 2.5 });
    Kit.circle(-h * 0.03, -legH2 - bh2 - h * 0.18, h * 0.18, o.cap || PAL.woodDark, { weight: 2.5, alpha: o.noCap ? 0 : 255 });
    pop();
  }

  // Dense bright rain that falls only through one column (Clawd's personal storm cloud).
  function personalRain(cx, yTop, yBot, t) {
    const span = yBot - yTop;
    for (let i = 0; i < 12; i++) {
      const sp = 760 + rand('pr-s', i) * 260;
      const x0 = cx - 34 + rand('pr-x', i) * 68;
      const y = ((rand('pr-y', i) * span + t * sp) % (span + 20)) + yTop;
      Kit.streak(x0, y, x0 - 9, y + 34, 5, '#eaf6ff', 215);
    }
  }

  function draw(S) {
    const t = S.t, lt = S.lt, L = S.li;

    // ---------- 1. sky, storm clouds ----------
    Kit.gradient(0, 0, W, 500, PAL.stormSky, PAL.stormSkyLow);
    Kit.paint([[-20, -20], [W + 20, -20], [W + 20, 250], [W * 0.55, 330], [-20, 280]], Kit.mix(PAL.cloudStorm, PAL.ink, 0.3), 165, 'p5-storm-bank');

    // Crack of golden light growing in the clouds through the last line; holds at the end.
    if (L === 3) {
      const g = ease.out(inv(14.4, 18.2, lt));
      if (g > 0) {
        const gx = 810, gw = 40 + g * 260;
        Kit.streak(gx - 6, -20, gx - 60, 320, gw * 0.9, '#fff3c2', 60 * g); // soft glow halo
        Kit.poly([[gx - gw * 0.1, -20], [gx + gw * 0.1, -20], [gx + gw * 0.42, 300], [gx - gw * 0.42, 300]], PAL.sun, { stroke: false, alpha: 90 + 130 * g });
        Kit.streak(gx, -20, gx + 20, 300, gw * 0.18, '#fff8de', 130 * g);
      }
    }

    // ---------- 2. back sea (dark, tall) ----------
    const seaY0 = 520;
    Kit.sea(t, seaY0, PAL.stormSeaDeep, { amp: 44, phase: 0.6, foam: false });

    // heavy global rain
    Kit.rain(t, 95, { slant: 0.42, len: 44, color: '#c3dbe8' });

    if (L === 1) drawMastTopSpin(S); else drawShipWide(S, seaY0);

    // ---------- 3. front sea (closer, taller, washes over the low hull only) ----------
    // Kept low enough that it never eats a character standing on deck (checked at L2/L3 poses).
    Kit.sea(t, 620, PAL.stormSea, { amp: 44, phase: 2.1, color2: PAL.stormSeaDeep });

    // ---------- 4. thunder: flash + KA-BOOM!, tied to the last thunder event ----------
    const th = S.since('thunder');
    if (th < 0.5) {
      const flick = Math.max(Math.max(0, 1 - th * 7), (th > 0.16 && th < 0.24) ? 0.65 : 0);
      Kit.flash(flick);
      if (th < 0.22) Kit.bolt(770, -10, 360, { color: '#fff6c8' });
    }
    Kit.sfx('KA-BOOM!', 760, 170, th, { size: 128, rot: 0.07 });
  }

  // ---------- Line 1 (S.li === 1): mast-top close-up, the scientist spins like a weather vane ----------
  function drawMastTopSpin(S) {
    const t = S.t, lt = S.lt, u = S.lp;
    const cx = 640, groundY = 500, h = 195;
    // hand-drawn mast (a full Kit.ship here would push the crow's nest off-screen)
    Kit.rect(cx - 11, 150, 22, 620, PAL.woodDark, { weight: 3 });
    Kit.poly([[cx - 8, 120], [cx + 150, 220], [cx + 210, 420], [cx + 8, 340]], PAL.sail, { weight: 3, alpha: 235 });
    Kit.line(cx, 175, cx - 140, 470, { weight: 2.5, color: PAL.woodDark });
    Kit.line(cx, 175, cx + 140, 470, { weight: 2.5, color: PAL.woodDark });
    Kit.rect(cx - 55, groundY - 34, 110, 34, PAL.wood, { weight: 3, r: 6 });

    // anticipation into the line, then a spin whose speed pulses with each gust (S.pulse)
    const spinUp = ease.out(inv(0, 0.12, u));
    const theta = spinUp * (Math.PI * 2) * lt * (1.3 + 1.7 * S.pulse);
    const facing = Math.cos(theta) >= 0 ? 1 : -1;
    const sx = facing * Math.max(Math.abs(Math.cos(theta)), 0.16);
    push(); translate(cx, groundY); scale(sx, 1);
    Kit.scientist(0, 0, h, { facing: 1, arms: [0.25, 1.6], hair: 'static', mood: 'surprised', look: [facing, -0.3] });
    pop();

    // N / E / S / W circling the spin, screen coordinates (not affected by the scale trick above)
    const headY = groundY - h * 0.98, rx = 128, ry = 42;
    ['N', 'E', 'S', 'W'].forEach((letter, i) => {
      const a = theta + i * (Math.PI / 2);
      const depth = Math.sin(a);
      Kit.label(letter, cx + Math.cos(a) * rx, headY - 10 + depth * ry * 0.3, { size: 30 + depth * 8, font: 'bold', alpha: 0.55 + 0.45 * clamp((depth + 1) / 2) });
    });
    Kit.sfx('SPIN!', 900, 300, lt - 6.0, { size: 118, rot: -0.1 });
  }

  // ---------- Lines 0, 2, 3: the wide ship shot ----------
  function drawShipWide(S, seaY0) {
    const t = S.t, lt = S.lt, L = S.li;
    const shipX = 640, len = 560;
    let lift = 0, tiltExtra = 0, bulge = 0;

    let jt = 0;
    if (L === 2) {
      // one clean jump: crew+Clawd stomp at beatInBar 1 (take-off) and land at beatInBar 3.
      // Lift outruns the wave hump below so a clear gap of air opens at the apex.
      jt = clamp((lt - 10.2) / 1.2);
      lift = ping(jt) * 150;
      tiltExtra = -0.07 * Math.sin(jt * Math.PI);
    }
    if (L === 3) {
      bulge = ease.out(inv(14.4, 16.4, lt));
      tiltExtra = 0.3 * bulge; // bow dips down, riding the wave face
      lift = -34 * bulge;
    }
    const tiltBase = Math.sin(t * 1.7) * 0.05 + Math.sin(t * 0.9) * 0.03;
    const tilt = tiltBase + tiltExtra;

    // a big wave crest under the hull: the ship visibly clears it on the jump (L2) or
    // surfs down its face (L3). Drawn before the ship so the hull sits on top of it.
    if (L === 2 && jt > 0.02 && jt < 0.98) {
      const rise = ping(jt);
      const pts = [];
      for (let x = -20; x <= W + 20; x += 40) { const d = (x - shipX) / 260; pts.push([x, seaY0 + 30 - Math.max(0, rise * 70 * (1 - d * d))]); }
      Kit.poly([...pts, [W + 20, H + 20], [-20, H + 20]], PAL.stormSea, { weight: 3.5 });
    }
    if (L === 3 && bulge > 0) {
      const pts = [];
      for (let x = -20; x <= W + 20; x += 40) { const d = (x - shipX) / 420; pts.push([x, seaY0 + 30 - Math.max(0, bulge * 220 * (1 - d * d))]); }
      Kit.poly([...pts, [W + 20, H + 20], [-20, H + 20]], PAL.stormSea, { weight: 3.5 });
    }

    const deckY = Kit.waveY(shipX, t, seaY0 - 20, 44, 0.6, 1) - 30 - lift;
    push(); translate(shipX, deckY); rotate(tilt);
    Kit.ship(len, { billow: 0.8, t });

    if (L === 0) {
      // crew hauls a rope in a line; Clawd's own rope is tied to a personal rain cloud
      const pull = S.pulse;
      sailor(20, -8, 92, { squash: 0.15 * pull, arms: [1.2 - 0.3 * pull, 1.2 - 0.3 * pull], shirt: PAL.red, stagger: 4 });
      sailor(80, -6, 88, { squash: 0.15 * pull, arms: [1.1 - 0.25 * pull, 1.1 - 0.25 * pull], shirt: PAL.green, stagger: -4 });
      Kit.curve([[20, -95], [50, -100], [80, -92]], { weight: 4, color: PAL.rope });

      // Clawd stands clear of the sail's white silhouette so his cloud reads against dark sky.
      const clawdX = -230, clawdY = 0, clawdTop = clawdY - 118 * 0.72;
      const yank = ease.outBack(clamp(S.pulse * 1.3));
      const cloudX = clawdX - 55, cloudY = -235 + yank * 55;
      Kit.clawd(clawdX, clawdY, 118, { walk: 0, arms: 'up', mood: 'determined', squash: -0.12 * S.pulse, look: [-0.6, -1] });
      Kit.curve([[clawdX + 10, clawdTop - 6], [cloudX + 26, (clawdTop + cloudY) / 2], [cloudX + 18, cloudY + 34]], { weight: 4.5, color: PAL.rope });
      Kit.cloud(cloudX, cloudY, 140, Kit.mix(PAL.cloudStorm, PAL.ink, 0.15));
      personalRain(cloudX + 6, cloudY + 40, clawdTop + 10, t);
      Kit.ellipse(clawdX + 6, clawdY + 4, 48, 11, PAL.stormSeaDeep, { stroke: false, alpha: 150 }); // puddle at his feet

      const [wx, wy] = shipToScreen(shipX, deckY, tilt, cloudX, cloudY - 70);
      Kit.sfx('WHOOSH!', wx, wy, lt - 1.8, { size: 110, rot: -0.12 });

      Kit.scientist(150, 0, 155, { facing: -1, rot: -0.06, arms: [0.6, 0.3], mood: 'scared', hair: 'wet', prop: 'clipboard' });
    }

    if (L === 2) {
      const anticip = ease.in(inv(9.6, 10.2, lt));
      const airborne = jt > 0.02 && jt < 0.98;
      const land = jt >= 0.98;
      const clawdSquash = airborne ? -0.45 : land ? 0.55 : 0.32 * anticip;
      Kit.clawd(-150, 0, 120, { squash: clawdSquash, mood: airborne ? 'surprised' : 'determined', arms: airborne ? 'out' : 'down' });
      sailor(0, 0, 96, { squash: airborne ? -0.4 : land ? 0.5 : 0.3 * anticip, arms: [1.4, 1.4], shirt: PAL.red });
      sailor(70, 0, 92, { squash: airborne ? -0.4 : land ? 0.5 : 0.3 * anticip, arms: [1.4, 1.4], shirt: PAL.green, stagger: 5 });
      Kit.scientist(160, 0, 150, { facing: -1, arms: [1.3, 1.3], mood: airborne ? 'surprised' : 'squint', prop: 'none' });

      const [hx, hy] = shipToScreen(shipX, deckY, tilt, -60, -170);
      Kit.sfx('HO!', hx, hy, lt - 10.5, { size: 140, rot: 0.1 });
    }

    if (L === 3) {
      // surfing the giant wave: Clawd surfs the bow (kept high enough to clear the front sea),
      // the scientist grips the mast and flaps sideways in the wind like a flag.
      Kit.clawd(len * 0.32, -18, 115, { facing: -1, arms: 'out', mood: 'determined', rot: -tilt * 0.6, squash: -0.1 });
      const flap = 0.35 + 0.1 * Math.sin(t * 9);
      Kit.scientist(-30, 0, 160, { facing: 1, rot: flap, arms: [3.05, 3.05], mood: 'scared', hair: 'wet' });
    }
    pop();
  }

  Scenes.register(5, { draw });
})();
