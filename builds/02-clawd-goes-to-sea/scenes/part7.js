// Part 7 — "Homeward" (song 124.8–150.0 s, S.lt 0–25.2). Sunny island dock.
// Four lyric-line gags (PLOP! / TA-DA! / STOMP! / time-lapse), then the outro:
// two stomps, everyone jumps on HEY!, the sail reads THE END, Clawd winks, hold, fade.
(function () {
  const { PAL, W, H, ease, inv, ping, lerp, clamp, mix, INK_W } = Kit;

  // ---------- world layout (ship is moored: no tilt, fixed deck) ----------
  const SHIP_LEN = 480, SHIP_X = 380, DECK_Y = 460;
  const GROUND_Y = 500;                        // dock + sand share one ground line
  const DOCK_X0 = 560, DOCK_X1 = 760;           // pier planks
  const ROCK_X = 780, ROCK_TOP_Y = 410, ROCK_W = 150, ROCK_H = 95; // hero-pose rock (line 2)
  const PALM_X = 930, PALM_GY = GROUND_Y;       // palm base (grows in line 4)
  // "everyone" group spots (stomp line, time-lapse line, outro)
  const G = { sailor: 610, clawd: 710, sci: 815, fiddle: 915 };
  const STOMP2_T = [10.2, 11.4, 12.6, 13.8];    // line 3 (li=2) stomp times, part-local seconds
  const OUTRO_STOMPS = [19.2, 19.8];
  const HEY_T = 20.4;

  // ---------- small helpers ----------
  function stompPulse(pt, times, dur) {
    let m = 0;
    for (const t0 of times) { const d = pt - t0; if (d >= 0 && d < dur) m = Math.max(m, ping(d / dur)); }
    return m;
  }
  function ageSinceAny(pt, times) {
    let best = Infinity;
    for (const t0 of times) { const d = pt - t0; if (d >= 0 && d < best) best = d; }
    return best;
  }
  function palmScaleAt(pt) {
    if (pt < 14.4) return 1;
    const u = clamp((Math.min(pt, 19.2) - 14.4) / 4.8);
    return lerp(1, 1.5, ease.inOut(u));
  }

  // ---------- props ----------
  function propAnchor(x, y, s) {
    const c = '#5a5f66';
    Kit.rect(x - s * 0.08, y - s * 0.55, s * 0.16, s * 0.45, c, { weight: 2.5 });
    Kit.circle(x, y - s * 0.62, s * 0.15, c, { weight: 2.5 });
    Kit.streak(x - s * 0.32, y - s * 0.26, x + s * 0.32, y - s * 0.26, s * 0.11, c);
    Kit.poly([[x - s * 0.4, y - s * 0.04], [x - s * 0.06, y + s * 0.1], [x - s * 0.06, y - s * 0.16]], c, { weight: 2.5 });
    Kit.poly([[x + s * 0.4, y - s * 0.04], [x + s * 0.06, y + s * 0.1], [x + s * 0.06, y - s * 0.16]], c, { weight: 2.5 });
  }
  function propSplash(x, y, scale) {
    for (let i = 0; i < 5; i++) {
      const a = -Math.PI / 2 + (i - 2) * 0.34;
      Kit.streak(x, y, x + Math.cos(a) * 30 * scale, y + Math.sin(a) * 30 * scale - 8 * scale, 4 * scale, PAL.foam);
    }
    Kit.ellipse(x, y + 4, 26 * scale, 10 * scale, PAL.foam, { stroke: false });
  }
  function propCoconut(x, y, s) {
    Kit.circle(x, y, s, '#5b3a24', { weight: 2 });
    Kit.ellipse(x - s * 0.15, y - s * 0.1, s * 0.3, s * 0.18, '#3f2818', { stroke: false });
  }
  function propMedal(x, y, s) {
    Kit.streak(x - s * 0.06, y - s * 0.55, x - s * 0.06, y - s * 0.15, s * 0.08, PAL.red);
    Kit.streak(x + s * 0.06, y - s * 0.55, x + s * 0.06, y - s * 0.15, s * 0.08, PAL.red);
    Kit.rect(x - s * 0.13, y - s * 0.28, s * 0.26, s * 0.26, PAL.yellow, { weight: 2.5, r: 3 });
  }
  function propCape(x, y, h, wind) {
    const w = h * 0.6;
    Kit.poly([
      [x - w * 0.48, y - h * 0.7], [x + w * 0.08, y - h * 0.72],
      [x + w * 0.58 + wind * 30, y - h * 0.14], [x + w * 0.3 + wind * 40, y + h * 0.05],
      [x - w * 0.2 - wind * 10, y + h * 0.03], [x - w * 0.55 - wind * 26, y - h * 0.18]
    ], PAL.red, { weight: 3 });
  }
  function propDock(x0, x1, surfaceY) {
    Kit.rect(x0, surfaceY, x1 - x0, 20, PAL.wood, { weight: 3 });
    for (let i = 0; i <= 5; i++) { const px = x0 + (x1 - x0) * i / 5; Kit.streak(px, surfaceY + 20, px, surfaceY + 65, 10, PAL.woodDark); }
    for (let i = 1; i < 5; i++) { const px = x0 + (x1 - x0) * i / 5; Kit.line(px, surfaceY + 2, px, surfaceY + 18, { weight: 2, color: PAL.woodDark }); }
  }
  function propSand(x0) {
    Kit.poly([[x0, GROUND_Y - 30], [x0 + 70, GROUND_Y - 45], [W + 40, GROUND_Y - 35], [W + 40, H + 20], [x0 - 30, H + 20]], PAL.sand);
  }
  function propRock(x, gy, w, h) {
    Kit.poly([[x - w / 2, gy], [x - w * 0.4, gy - h * 0.6], [x - w * 0.08, gy - h], [x + w * 0.18, gy - h * 0.88], [x + w / 2, gy - h * 0.3], [x + w * 0.38, gy]], PAL.rock, { weight: 3 });
  }
  function propPalm(x, gy, scale) {
    const trunkH = 175 * scale, trunkW = 16 * scale;
    Kit.poly([[x - trunkW / 2, gy], [x - trunkW / 2 + 10 * scale, gy - trunkH], [x + trunkW / 2 + 10 * scale, gy - trunkH], [x + trunkW / 2, gy]], PAL.woodDark, { weight: 3 });
    const topX = x + 10 * scale, topY = gy - trunkH;
    for (let i = 0; i < 6; i++) {
      const a = -Math.PI / 2 + (i - 2.5) * 0.46, len = 92 * scale;
      Kit.curve([[topX, topY], [topX + Math.cos(a) * len * 0.55, topY + Math.sin(a) * len * 0.55 - 18 * scale], [topX + Math.cos(a) * len, topY + Math.sin(a) * len]], { weight: 5, color: PAL.green });
    }
    Kit.circle(topX - 10 * scale, topY + 16 * scale, 10 * scale, '#5b3a24', { weight: 2 });
    Kit.circle(topX + 13 * scale, topY + 19 * scale, 10 * scale, '#5b3a24', { weight: 2 });
    return { topX, topY };
  }
  function propFootprints(fromX, toX, y) {
    const n = 6;
    for (let i = 0; i < n; i++) {
      const fx = lerp(fromX, toX, i / (n - 1));
      const off = (i % 2 === 0) ? -11 : 11;
      Kit.rect(fx - 6, y + off - 6, 12, 12, PAL.woodDark, { stroke: false, alpha: 130 });
    }
  }
  function propBeard(sx, sy, h, len) {
    if (len <= 0.5) return;
    const headY = sy - h * 0.84, hr = h * 0.14, my = headY + hr * 0.5;
    Kit.poly([[sx - hr * 0.5, my], [sx + hr * 0.5, my], [sx + hr * 0.3, my + len], [sx, my + len * 1.15], [sx - hr * 0.3, my + len]], '#eef0ea', { weight: 2.5 });
  }
  function propCane(x, y, s) {
    Kit.streak(x + s * 0.4, y - s * 0.5, x + s * 0.48, y - s * 0.02, s * 0.04, PAL.woodDark);
    Kit.curve([[x + s * 0.36, y - s * 0.5], [x + s * 0.4, y - s * 0.58], [x + s * 0.46, y - s * 0.54]], { weight: 2.5 });
  }
  function crew(x, y, s, o = {}) {
    const legH = s * 0.42, bw = s * 0.46, bh = s * 0.6, hr = s * 0.24, col = o.color || PAL.blue;
    const sq = o.squash || 0, bh2 = bh * (1 - sq * 0.25), legH2 = legH * (1 - sq * 0.3);
    const armA = o.armA === undefined ? 0.25 : o.armA;
    push(); translate(x, y);
    for (const side of [-1, 1]) Kit.streak(side * bw * 0.18, -legH2, side * bw * 0.18, 0, s * 0.12, PAL.pants);
    Kit.rect(-bw / 2, -legH2 - bh2, bw, bh2, col, { weight: 2.5, r: s * 0.05 });
    for (const side of [-1, 1]) {
      const dir = o.armsUp ? -1 : 1;
      Kit.streak(side * bw * 0.42, -legH2 - bh2 * 0.82, side * (bw * 0.42 + Math.sin(armA) * s * 0.3), -legH2 - bh2 * 0.82 + Math.cos(armA) * s * 0.3 * dir, s * 0.1, col);
    }
    Kit.circle(0, -legH2 - bh2 - hr * 0.75, hr, PAL.skin, { weight: 2.5 });
    Kit.rect(-hr * 0.75, -legH2 - bh2 - hr * 1.6, hr * 1.5, hr * 0.5, o.hat || '#284a76', { weight: 2, r: 4 });
    Kit.circle(-hr * 0.3, -legH2 - bh2 - hr * 0.8, hr * 0.12, PAL.ink, { stroke: false });
    Kit.circle(hr * 0.3, -legH2 - bh2 - hr * 0.8, hr * 0.12, PAL.ink, { stroke: false });
    pop();
    return { headY: y - legH2 - bh2 - hr * 0.75 };
  }
  function fiddle(x, y, s, cryAmt) {
    const fx = x + s * 0.34, fy = y - s * 0.62;
    Kit.ellipse(fx, fy, s * 0.16, s * 0.24, PAL.woodLight, { rot: -0.3, weight: 2.5 });
    Kit.circle(fx - s * 0.04, fy - s * 0.06, s * 0.02, PAL.ink, { stroke: false });
    Kit.circle(fx + s * 0.04, fy - s * 0.06, s * 0.02, PAL.ink, { stroke: false });
    Kit.curve([[fx - s * 0.05, fy + s * 0.05], [fx, fy + s * 0.08], [fx + s * 0.05, fy + s * 0.05]], { weight: 2 });
    if (cryAmt > 0) {
      Kit.streak(fx - s * 0.04, fy - s * 0.02, fx - s * 0.05, fy - s * 0.02 + s * 0.16 * cryAmt, s * 0.018, '#3a6fd8');
      Kit.streak(fx + s * 0.04, fy - s * 0.02, fx + s * 0.05, fy - s * 0.02 + s * 0.16 * cryAmt, s * 0.018, '#3a6fd8');
    }
    Kit.streak(fx, fy, fx + s * 0.22, fy - s * 0.12, s * 0.05, PAL.skin);
  }
  function clawdWinkCover(x, y, s, f) {
    const bh = s * 0.72, top = -s * 0.17 - bh, ey = top + bh * 0.38, ex = s * 0.2, shift = f * s * 0.03, er = s * 0.05;
    const cx = x + ex + shift, cy = y + ey;
    Kit.rect(cx - er * 1.6, cy - er * 1.6, er * 3.2, er * 2, PAL.clawd, { stroke: false });
    Kit.line(cx - er * 1.2, cy - er * 0.1, cx + er * 1.2, cy - er * 0.1, { weight: INK_W * 1.3 });
  }

  function draw(S) {
    const t = S.t, lt = S.lt;
    const holdStart = t - lt + 23.2;        // absolute song time matching part-local 23.2 s
    const animT = Math.min(t, holdStart);   // freeze background motion for the final hold
    const pt = Math.min(lt, 23.2);          // freeze all pose logic for the final hold

    // ---------- background ----------
    Kit.gradient(0, 0, W, 400, PAL.skyTop, PAL.skyLow);
    Kit.paint([[0, 0], [W, 0], [W, 240], [0, 300]], '#ffffff', 70, 'p7-sky');
    Kit.cloud(220 + (animT * 6) % 260, 90, 170);
    Kit.cloud(900 - (animT * 5) % 220, 68, 140);
    if (pt >= 14.4 && pt < 19.2) {
      const u3 = (pt - 14.4) / 4.8;
      Kit.sun(640 + Math.sin(u3 * Math.PI * 5) * 560, 85, 42);
    } else {
      Kit.sun(1150, 90, 46);
    }
    Kit.sea(animT, 400, PAL.seaDeep, { amp: 7, phase: 0.6, foam: false });

    // ---------- ship (moored; slides the last bit into place at the very start) ----------
    const shipX = pt < 0.8 ? lerp(140, SHIP_X, ease.out(inv(0, 0.8, pt))) : SHIP_X;
    const bob = Kit.waveY(shipX, animT, 0, 3, 0, 1.4);
    push(); translate(shipX, DECK_Y + bob);
    Kit.ship(SHIP_LEN, { t: animT, billow: 0.15, crowsNest: false });
    pop();

    Kit.sea(animT, 470, PAL.sea, { amp: 10, color2: PAL.seaDeep });

    // ---------- dock, sand, rock, palm ----------
    propDock(DOCK_X0, DOCK_X1, GROUND_Y - 20);
    propSand(760);
    Kit.paint([[700, 470], [W + 40, 460], [W + 40, H + 20], [680, H + 20]], '#8a5a1a', 55, 'p7-sand', { texture: 0.5 });
    propRock(ROCK_X, GROUND_Y, ROCK_W, ROCK_H);
    const pScale = palmScaleAt(pt);
    propPalm(PALM_X, PALM_GY, pScale);

    // footprints, once Clawd has crossed onto the sand (persist afterward)
    if (pt >= 3.35) propFootprints(760, 815, GROUND_Y + 30);

    // ================= per-line gags =================
    if (pt < 4.8) {
      // ---- Line 0 (0–4.8s): "there's land on the lee" — anchor overboard, PLOP!, jump to sand ----
      const u = pt / 4.8;
      const cx0 = shipX + 150; // Clawd's spot at the bow rail
      let cx = cx0, cy = DECK_Y + bob, csq = 0, cmood = 'happy', carms = 'down';
      const release = 2.15, land0 = 2.5;

      if (pt < 1.6) {
        // idle stand, waiting
        carms = 'down';
      } else if (pt < 2.0) {
        csq = lerp(0, 0.35, ease.in(inv(1.6, 2.0, pt)));
        carms = 'down';
      } else if (pt < release) {
        csq = lerp(0.35, -0.35, ease.out(inv(2.0, release, pt)));
        carms = 'up';
      } else if (pt < 2.7) {
        csq = lerp(-0.2, 0, ease.out(inv(release, 2.7, pt)));
        carms = 'up';
      } else if (pt < 2.9) {
        // recover
        carms = 'down';
      } else if (pt < 3.15) {
        // takeoff crouch
        csq = lerp(0, 0.3, ease.in(inv(2.9, 3.15, pt)));
      } else if (pt < 3.35) {
        // airborne arc from ship to dock
        const uj = inv(3.15, 3.35, pt);
        cx = lerp(cx0, 650, uj);
        cy = lerp(DECK_Y + bob, GROUND_Y, uj) - ping(uj) * 55;
        csq = lerp(-0.3, 0, uj);
      } else if (pt < 3.55) {
        cx = 650; cy = GROUND_Y;
        csq = lerp(0.4, 0, ease.out(inv(3.35, 3.55, pt)));
      } else {
        // walk from the dock, across the sand, up to the rock
        const uw = inv(3.55, 4.8, pt);
        cx = lerp(650, 780, ease.inOut(uw));
        cy = GROUND_Y;
      }

      Kit.clawd(cx, cy, 118, { squash: csq, arms: carms, mood: cmood, look: [0.2, 0], blink: (pt % 2.4) < 0.1 });

      // the anchor: sits by Clawd's feet, then arcs over the rail into the sea — drawn
      // after Clawd so it reads in front of him instead of hiding behind his body.
      if (pt < release) {
        propAnchor(cx0 + 26, DECK_Y + bob - 8, 68);
      } else if (pt < land0) {
        const ua = inv(release, land0, pt);
        const ax = lerp(cx0 + 40, 620, ua), ay = lerp(DECK_Y + bob - 55, 500, ua) - ping(ua) * 55;
        propAnchor(ax, ay, 60);
      } else if (pt < land0 + 0.5) {
        propSplash(620, 500, lerp(1.2, 0.3, inv(land0, land0 + 0.5, pt)));
      }
      Kit.sfx('PLOP!', 620, 420, pt - land0, { size: 110, rot: -0.1 });

      // scientist strolls off the ship toward the rock, incidental to Clawd's gag
      const sx = lerp(600, 830, ease.inOut(u));
      Kit.scientist(sx, GROUND_Y, 160, { facing: 1, walk: pt * 6, arms: [0.2, 1.1], prop: 'clipboard', mood: 'happy' });

    } else if (pt < 9.6) {
      // ---- Line 1 (4.8–9.6s): "bold as can be" — hero pose on the rock, cape + medal, TA-DA! ----
      const u1 = (pt - 4.8) / 4.8;
      const climb = clamp(u1 / 0.18);
      const cx = lerp(780, 745, ease.out(climb)), cy = lerp(GROUND_Y, ROCK_TOP_Y, ease.out(climb));
      const sx = lerp(830, 838, ease.out(climb)), sy = lerp(GROUND_Y, ROCK_TOP_Y + 8, ease.out(climb));
      const poseIn = clamp((u1 - 0.15) / 0.2);
      const wind = 0.5 + 0.5 * Math.sin(pt * 2.6);
      const stretch = -0.18 * poseIn;

      propCape(sx, sy, 160, wind * poseIn);
      Kit.scientist(sx, sy, 160, { facing: 1, arms: [lerp(0.3, 2.6, poseIn), lerp(0.3, 2.5, poseIn)], prop: 'none', mood: 'happy', hair: 'normal' });
      Kit.clawd(cx, cy, 120, { squash: stretch, arms: poseIn > 0.5 ? 'up' : 'out', mood: 'happy', look: [0, -0.3] });
      if (poseIn > 0.3) {
        propMedal(cx, cy, 120);
        const sparkle = 6 + S.pulse * 8;
        for (let i = 0; i < 4; i++) {
          const a = pt * 3 + i * 1.6;
          Kit.streak(cx + Math.cos(a) * sparkle, cy - 90 + Math.sin(a) * sparkle * 0.6, cx + Math.cos(a) * (sparkle + 10), cy - 90 + Math.sin(a) * (sparkle + 10) * 0.6, 2.5, PAL.yellow, 220);
        }
      }
      Kit.sfx('TA-DA!', cx + 145, ROCK_TOP_Y - 95, pt - (4.8 + 0.45 * 4.8), { size: 95, rot: 0.08 });

    } else if (pt < 14.4) {
      // ---- Line 2 (9.6–14.4s): "a fiddle's cheer" — everyone stomps, coconuts, crying fiddle ----
      const sq = stompPulse(pt, STOMP2_T, 0.3);
      const nDown = STOMP2_T.filter(t0 => pt - t0 >= 0.5).length;

      crew(G.sailor, GROUND_Y, 128, { color: PAL.blue, squash: sq, armA: 0.5 });
      Kit.scientist(G.sci, GROUND_Y, 160, { facing: -1, arms: [0.3, 0.3], prop: 'none', mood: nDown > 0 && (pt - STOMP2_T[nDown - 1]) < 0.3 ? 'dizzy' : 'surprised', walk: 0 });
      Kit.clawd(G.clawd, GROUND_Y, 118, { squash: sq * 0.8, arms: 'out', mood: 'happy' });
      crew(G.fiddle, GROUND_Y, 128, { color: PAL.red, squash: sq, armA: 0.2 });
      fiddle(G.fiddle, GROUND_Y, 128, 0.4 + 0.6 * sq);

      // coconuts: one falling from the palm at each stomp, then a growing pile at the scientist's feet
      for (let i = 0; i < STOMP2_T.length; i++) {
        const age = pt - STOMP2_T[i];
        if (age >= 0 && age < 0.5) {
          const y = lerp(PALM_GY - 260, GROUND_Y - 130, ease.in(age / 0.5));
          const x = lerp(PALM_X - 10, G.sci, ease.in(age / 0.5));
          propCoconut(x, y, 15);
        }
      }
      for (let i = 0; i < nDown; i++) propCoconut(G.sci - 30 + i * 16, GROUND_Y - 6, 13);

      Kit.sfx('STOMP!', 610, 250, ageSinceAny(pt, STOMP2_T), { size: 105, rot: -0.12 });

    } else if (pt < 19.2) {
      // ---- Line 3 (14.4–19.2s): time-lapse — palm grows, beard grows, tiny cane. No SFX. ----
      const u3 = (pt - 14.4) / 4.8;
      const beardLen = lerp(0, 46, ease.inOut(clamp(u3 * 1.3)));

      crew(G.sailor, GROUND_Y, 128, { color: PAL.blue, armA: 0.2 });
      Kit.scientist(G.sci, GROUND_Y, 160, { facing: -1, arms: [0.2, 0.2], prop: 'none', hair: 'normal', mood: 'happy' });
      propBeard(G.sci, GROUND_Y, 160, beardLen);
      Kit.clawd(G.clawd, GROUND_Y, 118, { arms: 'down', mood: 'happy' });
      if (u3 > 0.08) propCane(G.clawd, GROUND_Y, 118);
      crew(G.fiddle, GROUND_Y, 128, { color: PAL.red, armA: 0.2 });
      fiddle(G.fiddle, GROUND_Y, 128, 0.2);

    } else {
      // ---- Outro (19.2–25.2s): two stomps, HEY! jump, THE END on the sail, wink, hold, fade ----
      const heyAge = S.since('hey');
      const beardLen = 46; // full-grown, held from line 3

      let squash = stompPulse(pt, OUTRO_STOMPS, 0.3);
      let jumpY = 0, armsUp = false;
      if (heyAge === Infinity) {
        if (pt >= 20.0) squash = Math.max(squash, ease.in(clamp(inv(20.0, 20.4, pt))) * 0.4);
      } else if (heyAge < 0.45) {
        const uj = clamp(heyAge / 0.45);
        jumpY = Math.sin(uj * Math.PI) * 75;
        squash = -0.35 * Math.sin(uj * Math.PI);
        armsUp = true;
      } else if (heyAge < 0.65) {
        squash = lerp(0.3, 0, clamp((heyAge - 0.45) / 0.2));
        armsUp = true;
      } else if (heyAge < 1.4) {
        armsUp = true;
      }

      const gy = GROUND_Y - jumpY;
      crew(G.sailor, gy, 128, { color: PAL.blue, squash, armsUp, armA: armsUp ? 0.4 : 0.25 });
      Kit.scientist(G.sci, gy, 160, { facing: -1, arms: armsUp ? [2.7, 2.7] : [0.2, 0.2], prop: 'none', mood: 'happy' });
      propBeard(G.sci, gy, 160, beardLen);
      Kit.clawd(G.clawd, gy, 118, { squash, arms: armsUp ? 'up' : 'down', mood: 'happy' });
      propCane(G.clawd, gy, 118);
      crew(G.fiddle, gy, 128, { color: PAL.red, squash, armsUp, armA: armsUp ? 0.4 : 0.25 });
      fiddle(G.fiddle, gy, 128, 0.3);

      if (heyAge !== Infinity && heyAge >= 1.4) clawdWinkCover(G.clawd, gy, 118, 1);

      Kit.sfx('STOMP!', 620, 240, ageSinceAny(pt, OUTRO_STOMPS), { size: 100, rot: -0.1 });
      Kit.sfx('HEY!', 760, 150, heyAge, { size: 165, rot: 0.05, dur: 1.3 });

      const fadeA = clamp(inv(24.0, 25.2, lt));
      if (heyAge !== Infinity && heyAge >= 0.9) {
        const up = clamp((heyAge - 0.9) / 0.6);
        const sz = lerp(8, 42, ease.outBack(up));
        Kit.label('THE END', SHIP_X - 19, 270, { size: sz, font: 'bold', color: PAL.ink, alpha: 1 - 0.9 * fadeA });
      }
      if (lt >= 24.0) Kit.rect(0, 0, W, H, '#231208', { stroke: false, alpha: 235 * fadeA });
    }
  }

  Scenes.register(7, { draw });
})();
