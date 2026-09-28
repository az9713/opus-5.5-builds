// Part 1 — Signing On. Harbor dock, morning. Song time 0..28.8s (S.lt: -9.6 intro .. 19.2 boarding).
(function () {
  const { PAL, ease, inv, ping, lerp, clamp } = Kit;
  const W = Kit.W;

  const DOCK_Y = 560;                 // dock surface: characters' feet
  const SEA_Y0 = 440, SEA_AMP = 8, SEA_PHASE = 1, SEA_SPEED = 1;
  const SHIP_X0 = 950, HULL = 480;
  const CAPTAIN_X = 840;               // captain stands here, book held out to the left
  const BOOK_X = 760, BOOK_Y = 480;    // crew book, held clear of the captain's own body

  function shipX(lt) {
    const u = ease.in(inv(17.6, 19.2, lt));
    return lerp(SHIP_X0, SHIP_X0 + 170, u);
  }
  function shipPose(t, lt) {
    const sx = shipX(lt);
    const tilt = Math.sin(t * 1.3 + sx * 0.002) * 0.03;
    const deckY = Kit.waveY(sx, t, SEA_Y0, SEA_AMP, SEA_PHASE, SEA_SPEED) - 35;
    return { sx, tilt, deckY };
  }
  // world point for a local ship-deck coordinate (x local, y local; y=0 is deck)
  function shipToWorld(sx, deckY, tilt, lx, ly) {
    return [sx + lx * Math.cos(tilt) - ly * Math.sin(tilt), deckY + lx * Math.sin(tilt) + ly * Math.cos(tilt)];
  }

  function drawBackground(S) {
    const t = S.t;
    Kit.gradient(0, 0, W, 440, PAL.skyTop, PAL.skyLow);
    Kit.paint([[0, 0], [W, 0], [W, 250], [0, 300]], '#ffffff', 70, 'p1-sky');
    Kit.sun(150, 110, 46);
    Kit.cloud(560 + (t * 8) % (W + 300) - 150, 120, 190);
    Kit.sea(t, SEA_Y0, PAL.seaDeep, { amp: SEA_AMP, phase: SEA_PHASE, speed: SEA_SPEED, foam: false });
  }

  function drawShip(S) {
    const { sx, tilt, deckY } = shipPose(S.t, S.lt);
    const sailing = S.lt > 16.8;
    push(); translate(sx, deckY); rotate(tilt);
    Kit.ship(HULL, { t: S.t, billow: 0.35 + 0.25 * Math.sin(S.t * 1.6), sail: sailing, crowsNest: true });
    pop();
    return { sx, tilt, deckY };
  }

  function drawSignPost(S) {
    // swinging gantry sign at the dock entrance: "CLAWD GOES TO SEA"
    const pivotX = 210, pivotY = 250;
    K_dockPost(140, 250, 20); K_dockPost(300, 250, 20);
    Kit.rect(130, 235, 190, 18, PAL.woodDark, { weight: 3 });
    const theta = 0.14 * Math.sin(S.t * 1.05 + 0.4);
    push(); translate(pivotX, pivotY); rotate(theta);
    Kit.line(0, 0, 0, 24, { weight: 3, color: PAL.woodDark });
    Kit.line(-30, 4, 0, 24, { weight: 2.5, color: PAL.woodDark });
    Kit.line(30, 4, 0, 24, { weight: 2.5, color: PAL.woodDark });
    Kit.rect(-95, 24, 190, 84, PAL.wood, { weight: 3.5, r: 6 });
    Kit.rect(-88, 31, 176, 70, PAL.woodLight, { stroke: false, alpha: 130 });
    pop();
    const pt = (localY) => [pivotX - localY * Math.sin(theta), pivotY + localY * Math.cos(theta)];
    const [x1, y1] = pt(50), [x2, y2] = pt(83);
    Kit.label('CLAWD GOES', x1, y1, { size: 22, rot: theta, font: 'bold', color: PAL.ink });
    Kit.label('TO SEA', x2, y2, { size: 26, rot: theta, font: 'bold', color: PAL.ink });
  }
  function K_dockPost(x, topY, w) { Kit.rect(x - w / 2, topY, w, DOCK_Y - topY, PAL.woodDark, { weight: 3 }); }

  function drawDock() {
    Kit.rect(-20, DOCK_Y, W + 40, 74, PAL.wood, { weight: 3.5 });
    Kit.rect(-20, DOCK_Y + 2, W + 40, 10, PAL.woodLight, { stroke: false, alpha: 110 });
    for (let x = 60; x < W + 40; x += 130) Kit.rect(x - 12, DOCK_Y + 44, 24, 80, PAL.woodDark, { weight: 2.5 });
    for (let x = 130; x < W; x += 160) Kit.line(x, DOCK_Y, x, DOCK_Y + 74, { weight: 2, color: PAL.woodDark });
  }

  // ---------- Joke 1: mooring post + gull that puts on sunglasses as Clawd's glow passes (line 0) ----------
  function drawGullPost(S, clawdX) {
    const px = 560, gy0 = DOCK_Y - 96;
    K_dockPost(px, DOCK_Y - 90, 24);
    // perched gull, bigger and clearer: body, head, wing, beak
    Kit.ellipse(px, gy0 + 8, 34, 22, PAL.gull, { weight: 3 });
    Kit.circle(px + 14, gy0 - 12, 16, PAL.gull, { weight: 3 });
    Kit.ellipse(px - 4, gy0 + 4, 16, 10, '#dfe0da', { weight: 2.5 });
    Kit.poly([[px + 26, gy0 - 13], [px + 42, gy0 - 9], [px + 26, gy0 - 5]], PAL.yellow, { weight: 2.5 });
    Kit.circle(px + 20, gy0 - 15, 2.6, PAL.ink, { stroke: false });

    // Clawd's brightest-orange glow burst as he passes underneath the post
    const glow = ping(inv(1.2, 3.0, S.lt));
    if (glow > 0.02) {
      for (let i = 0; i < 10; i++) {
        const a = (i / 10) * Math.PI * 2 + S.t * 1.6;
        const len = 55 + glow * 55;
        Kit.streak(clawdX, DOCK_Y - 60, clawdX + Math.cos(a) * len, DOCK_Y - 60 + Math.sin(a) * len * 0.7, 7, PAL.yellow, 210 * glow);
      }
      Kit.circle(clawdX, DOCK_Y - 60, 66 + glow * 20, PAL.sun, { stroke: false, alpha: 90 * glow });
    }
    // sunglasses slide down onto the gull's face, big and unmistakable
    if (S.lt > 1.5) {
      const drop = ease.outBack(clamp(inv(1.5, 2.05, S.lt)));
      const gyy = lerp(gy0 - 220, gy0 - 12, clamp(drop, 0, 1.05));
      Kit.ellipse(px + 8, gyy, 11, 8, PAL.ink, { weight: 2.5 });
      Kit.ellipse(px + 26, gyy, 11, 8, PAL.ink, { weight: 2.5 });
      Kit.line(px + 16, gyy - 1, px + 20, gyy - 1, { weight: 3 });
      Kit.streak(px + 8, gyy - 6, px + 5, gyy - 2, 2, '#eaf6ff', 200);
    }
    Kit.sfx('BLING!', clawdX + 10, DOCK_Y - 190, S.lt - 1.2, { size: 120, rot: -0.1 });
  }

  // ---------- Joke 2: rope across the dock, hopped like a box (line 1) ----------
  function drawRope() {
    Kit.streak(628, 566, 736, 566, 11, PAL.woodDark, 255);
    Kit.curve([[628, 563], [658, 553], [682, 568], [706, 550], [736, 563]], { weight: 7, color: PAL.rope });
    Kit.curve([[628, 570], [658, 560], [682, 575], [706, 557], [736, 570]], { weight: 5, color: '#e2c58a' });
  }

  // ---------- Joke 3: scientist marches with a wobbling tower of flasks twice their height (line 2) ----------
  function drawFlaskTower(sx, sy, S) {
    const grow = clamp(inv(9.6, 12.6, S.lt));      // tower rises into place as the line plays
    const near = clamp(inv(12.6, 13.35, S.lt));    // wobbles hard right before the CLINK
    const liquids = [PAL.blue, PAL.green, PAL.red];
    const sizes = [[54, 70], [44, 56], [34, 42]];  // big Erlenmeyer flasks, shrinking upward
    let fy = sy;
    for (let i = 0; i < 3; i++) {
      const sway = Math.sin(S.t * 5 + i * 1.6) * (4 + i * 7) * (0.25 + 0.75 * grow) + near * (i + 1) * 10 * Math.sin(S.t * 10 + i);
      const [fw, fh] = sizes[i];
      const fx = sx + sway * (0.3 + i * 0.35);
      fy -= fh * 0.9;
      push(); translate(fx, fy); rotate(sway * 0.01);
      Kit.poly([[-3, -fh * 0.55], [3, -fh * 0.55], [3, -fh * 0.15], [fw / 2, fh * 0.42], [-fw / 2, fh * 0.42], [-3, -fh * 0.15]], '#eaf4fa', { weight: 3 });
      Kit.poly([[-fw * 0.42, fh * 0.14], [fw * 0.42, fh * 0.14], [fw * 0.46, fh * 0.4], [-fw * 0.46, fh * 0.4]], liquids[i], { stroke: false });
      Kit.rect(-3, -fh * 0.58, 6, 10, '#c9d8e0', { weight: 2 });
      pop();
    }
    Kit.sfx('CLINK!', sx + 40, fy - 40, S.lt - 13.35, { size: 100, rot: -0.08 });
  }

  // ---------- Joke 4: captain, crew book, Clawd's body-stamp, formula off the page (line 3) ----------
  function drawCaptain() {
    const x = CAPTAIN_X;
    // legs, navy coat body, head, captain's hat — a stocky adult figure, clear of the book
    Kit.rect(x - 20, DOCK_Y - 44, 16, 44, PAL.pants, { weight: 2.5 });
    Kit.rect(x + 6, DOCK_Y - 44, 16, 44, PAL.pants, { weight: 2.5 });
    Kit.rect(x - 27, DOCK_Y - 112, 54, 70, PAL.blue, { weight: 3, r: 7 });
    Kit.rect(x - 27, DOCK_Y - 112, 54, 14, '#f5d24a', { stroke: false, alpha: 200 }); // gold trim
    Kit.circle(x + 2, DOCK_Y - 132, 19, PAL.skin, { weight: 2.5 });
    Kit.rect(x - 18, DOCK_Y - 154, 40, 15, PAL.ink, { weight: 2.5, r: 3 });
    Kit.rect(x - 12, DOCK_Y - 162, 26, 11, PAL.ink, { stroke: false });
    Kit.circle(x - 3, DOCK_Y - 133, 2.4, PAL.ink, { stroke: false });
    Kit.circle(x + 9, DOCK_Y - 133, 2.4, PAL.ink, { stroke: false });
    // forward arm reaches left, holding the crew book out and away from his body
    Kit.streak(x - 22, DOCK_Y - 96, BOOK_X + 34, BOOK_Y + 6, 9, PAL.blue);
    Kit.circle(BOOK_X + 34, BOOK_Y + 6, 8, PAL.skin, { weight: 2 });
    Kit.rect(BOOK_X - 46, BOOK_Y - 5, 46, 66, '#f4ecd8', { weight: 3 });
    Kit.rect(BOOK_X, BOOK_Y - 5, 46, 66, '#ffffff', { weight: 3 });
    Kit.line(BOOK_X, BOOK_Y - 2, BOOK_X, BOOK_Y + 59, { weight: 2 });
  }
  function drawStampAndFormula(S) {
    if (S.lt < 16.5) return;
    const stampPop = ease.outBack(clamp(inv(16.5, 16.75, S.lt)));
    push(); translate(BOOK_X - 10, BOOK_Y + 26); scale(clamp(stampPop, 0.05, 1.15));
    Kit.rect(-16, -16, 32, 32, PAL.clawd, { weight: 2.5, r: 3 });
    Kit.circle(-6, -4, 2.2, PAL.ink, { stroke: false }); Kit.circle(6, -4, 2.2, PAL.ink, { stroke: false });
    pop();
    if (S.lt >= 16.7) Kit.label('x = the salt of the sea + 2', BOOK_X + 6, BOOK_Y + 30, { size: 12, rot: -0.03, font: 'serif' });
    if (S.lt >= 16.85) Kit.label('...(cont. overboard)', BOOK_X + 70, BOOK_Y + 48, { size: 11, rot: 0.05, font: 'serif' });
    Kit.sfx('STAMP!', BOOK_X - 10, BOOK_Y - 90, S.lt - 16.5, { size: 110, rot: -0.12 });
  }

  function draw(S) {
    const lt = S.lt;

    drawBackground(S);
    const ship = drawShip(S);
    drawDock();
    drawSignPost(S);

    // ---------- Clawd's path along the dock ----------
    let cx, cy = DOCK_Y, csquash = 0, cmood = 'happy', cwalk = 0, conDeck = false, clocal = [0, 0];
    if (lt < 0) {
      cx = lerp(-100, 520, ease.out(inv(-9.6, 0, lt)));
      cwalk = lt * 26;
    } else if (lt < 4.8) {
      cx = lerp(520, 620, ease.inOut(inv(0, 4.8, lt)));
      cwalk = lt * 20;
    } else if (lt < 9.6) {
      cx = lerp(620, 760, ease.inOut(inv(4.8, 9.6, lt)));
      cwalk = lt * 20;
      const hu = inv(6.0, 7.4, lt);
      if (hu > 0 && hu < 1) {
        const jump = ping(hu);
        cy = DOCK_Y - jump * 150;
        csquash = hu < 0.12 ? lerp(0, 0.5, hu / 0.12) : (hu > 0.88 ? lerp(0.55, 0, (hu - 0.88) / 0.12) : -0.55 * Math.sin((hu - 0.12) / 0.76 * Math.PI));
        cmood = 'surprised';
        cwalk = 0;
      }
      Kit.sfx('BOING!', cx, cy - 150, lt - 6.8, { size: 120, rot: 0.08 });
    } else if (lt < 14.4) {
      cx = lerp(760, 780, ease.inOut(inv(9.6, 14.4, lt)));
      cwalk = lt * 20;
    } else if (lt < 15.6) {
      cx = lerp(780, BOOK_X + 40, ease.out(inv(14.4, 15.6, lt)));
      cwalk = lt * 20;
    } else if (lt < 16.55) {
      const u = inv(15.6, 16.55, lt);
      if (u < 0.55) { cx = BOOK_X + 40; csquash = lerp(0, 0.3, u / 0.55); cy = DOCK_Y; cmood = 'determined'; }
      else {
        const ju = (u - 0.55) / 0.45;
        cx = lerp(BOOK_X + 40, BOOK_X - 10, ease.out(ju));
        cy = lerp(DOCK_Y, BOOK_Y + 26, ease.out(ju)) - Math.sin(Math.PI * ju) * 70;
        csquash = -0.5 * Math.sin(Math.PI * ju);
        cmood = 'surprised';
      }
    } else if (lt < 17.4) {
      cx = BOOK_X - 10;
      cy = BOOK_Y + 26;
      csquash = lerp(0.55, 0, clamp(inv(16.5, 17.2, lt)));
      cmood = 'happy';
    } else if (lt < 18.1) {
      const u = inv(17.4, 18.1, lt);
      const [wx, wy] = shipToWorld(ship.sx, ship.deckY, ship.tilt, -70, 0);
      cx = lerp(BOOK_X - 10, wx, ease.out(u)); cy = lerp(BOOK_Y + 26, wy, ease.out(u)) - Math.sin(Math.PI * u) * 90;
      csquash = -0.35 * Math.sin(Math.PI * u);
      cmood = 'surprised';
    } else {
      conDeck = true; clocal = [-70, 0];
      csquash = lerp(0.3, 0, clamp(inv(18.1, 18.4, lt)));
      cmood = 'happy';
    }

    if (lt < 4.8) {
      drawGullPost(S, cx);
    } else {
      // gull keeps its sunglasses on for the rest of the scene (a settled sight gag)
      const px = 560, gy0 = DOCK_Y - 96;
      K_dockPost(px, DOCK_Y - 90, 24);
      Kit.ellipse(px, gy0 + 8, 34, 22, PAL.gull, { weight: 3 });
      Kit.circle(px + 14, gy0 - 12, 16, PAL.gull, { weight: 3 });
      Kit.poly([[px + 26, gy0 - 13], [px + 42, gy0 - 9], [px + 26, gy0 - 5]], PAL.yellow, { weight: 2.5 });
      Kit.ellipse(px + 8, gy0 - 12, 11, 8, PAL.ink, { weight: 2.5 });
      Kit.ellipse(px + 26, gy0 - 12, 11, 8, PAL.ink, { weight: 2.5 });
      Kit.line(px + 16, gy0 - 13, px + 20, gy0 - 13, { weight: 3 });
    }

    drawRope();

    // ---------- scientist path ----------
    if (lt >= 9.6) {
      let sx2, sy2 = DOCK_Y, swalk = 0, sonDeck = false, slocal = [0, 0], smood = 'happy', sprop = 'none';
      if (lt < 14.4) { sx2 = lerp(-80, 660, ease.inOut(inv(9.6, 14.4, lt))); swalk = lt * 20; drawFlaskTower(sx2, DOCK_Y - 118, S); }
      else if (lt < 16.0) { sx2 = lerp(660, BOOK_X - 60, ease.out(inv(14.4, 16.0, lt))); swalk = lt * 20; drawFlaskTower(sx2, DOCK_Y - 118, S); }
      else if (lt < 17.8) { sx2 = BOOK_X - 60; sprop = 'pencil'; smood = 'determined'; }
      else if (lt < 18.6) {
        const u = inv(17.8, 18.6, lt);
        const [wx, wy] = shipToWorld(ship.sx, ship.deckY, ship.tilt, 30, 0);
        sx2 = lerp(BOOK_X - 60, wx, ease.out(u)); sy2 = lerp(DOCK_Y, wy, ease.out(u)) - Math.sin(Math.PI * u) * 90;
        smood = 'surprised';
      } else { sonDeck = true; slocal = [30, 0]; }

      if (sonDeck) { push(); translate(ship.sx, ship.deckY); rotate(ship.tilt); Kit.scientist(slocal[0], slocal[1], 150, { facing: 1, mood: smood, prop: 'pencil' }); pop(); }
      else Kit.scientist(sx2, sy2, 150, { facing: 1, walk: swalk, mood: smood, prop: sprop, arms: sprop === 'pencil' ? [0.2, 1.3] : [2.7, 2.7] });
    }

    if (S.lt >= 14.4) drawCaptain();
    if (S.lt >= 16.5) drawStampAndFormula(S);

    if (conDeck) { push(); translate(ship.sx, ship.deckY); rotate(ship.tilt); Kit.clawd(clocal[0], clocal[1], 118, { facing: 1, squash: csquash, mood: cmood, look: [0.4, 0] }); pop(); }
    else Kit.clawd(cx, cy, 118, { facing: 1, walk: cwalk, squash: csquash, mood: cmood, look: [0.4, 0] });

    // ---------- intro-only: ship horn TOOT + speed-blur streaks on Clawd's entrance ----------
    if (lt < 0) {
      const age = lt - (-6.0);
      Kit.sfx('TOOT!', ship.sx - 150, ship.deckY - 260, age, { size: 100, rot: -0.1 });
      const puffU = clamp(inv(0, 1.1, age));
      if (age >= 0 && age < 1.3) Kit.circle(ship.sx - 165 + puffU * 40, ship.deckY - 270 - puffU * 30, 18 + puffU * 26, '#ffffff', { weight: 2, alpha: 210 * (1 - puffU) });
      for (let i = 0; i < 3; i++) Kit.streak(cx - 40 - i * 16, DOCK_Y - 30, cx - 20 - i * 16, DOCK_Y - 30, 4, '#ffffff', 120 - i * 30);
    }
  }

  Scenes.register(1, { draw });
})();
