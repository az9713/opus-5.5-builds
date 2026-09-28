// Part 2 — "Heave Away" (28.8s - 48.0s), the first chorus.
// Setting: open sea, sunny, crew on deck. Light warms to sunset during the last line.
// Joke 1 (line 0): the crew hauls a rope in a line; Clawd, holding the end, is flung up like a yo-yo.
// Joke 2 (line 1): the scientist chalks a tally for each wave; the last one soaks him.
// Joke 3 (line 2): every stomp (beat 1 and 3) hops the whole ship out of the water; a fiddle with a
//   face cries big tears as it is played.
// Joke 4 (line 3): the sunset sun turns orange and square, like Clawd. Clawd waves. It plonks into the sea.
(function () {
  const { PAL, W, H, ease, inv, ping, lerp, clamp, mix } = Kit;

  // ---- a simple sailor, drawn from Kit shapes: circle head, block body, stick arms, a cap. ----
  function sailor(x, y, lean) {
    push(); translate(x, y); if (lean) rotate(lean);
    Kit.rect(-15, -30, 10, 30, PAL.pants, { weight: 2.5 });
    Kit.rect(5, -30, 10, 30, PAL.pants, { weight: 2.5 });
    Kit.rect(-14, -58, 28, 30, '#3a6fd8', { r: 4 });
    Kit.streak(-13, -50, -32, -72, 9, PAL.skin);
    Kit.streak(13, -50, 32, -72, 9, PAL.skin);
    Kit.circle(0, -66, 15, PAL.skin, { weight: 2.5 });
    Kit.ellipse(0, -78, 16, 8, PAL.coat, { weight: 2 });
    pop();
  }

  // ---- a fiddle with a face, crying big cartoon tears while it is bowed. Held beside the sailor's
  // own head (not over it) so both faces stay readable. ----
  function cryingFiddle(x, y, t) {
    const fx = x - 30, fy = y - 74;
    const tearU1 = (t * 1.3) % 1, tearU2 = ((t * 1.3) + 0.5) % 1;
    Kit.ellipse(fx, fy, 28, 40, '#c9793f', { weight: 3.5 });
    Kit.circle(fx - 10, fy - 12, 5, PAL.ink, { stroke: false });
    Kit.circle(fx + 10, fy - 12, 5, PAL.ink, { stroke: false });
    Kit.ellipse(fx, fy + 13, 11, 15, '#7a2e2e', { weight: 2.5, segments: 12 });
    Kit.ellipse(fx - 10, lerp(fy + 18, fy + 68, tearU1), 8, 11, PAL.blue, { stroke: false, alpha: 230 * (1 - tearU1) });
    Kit.ellipse(fx + 10, lerp(fy + 18, fy + 68, tearU2), 8, 11, PAL.blue, { stroke: false, alpha: 230 * (1 - tearU2) });
    const bowA = Math.sin(t * 11) * 0.5;
    Kit.streak(fx - 42 + Math.cos(bowA) * 10, fy - 28 + Math.sin(bowA) * 10, fx + 42 - Math.cos(bowA) * 10, fy + 30 - Math.sin(bowA) * 10, 5, PAL.woodDark);
  }

  // ---- the sunset sun: a rounded rect that morphs from round to square, like Clawd, and dips into
  // the sea just to the right of the ship. It tracks the same wave line the back sea is drawn with,
  // so it is clipped by that sea band and sinks gradually instead of popping out of sight. ----
  function drawSun(S, t) {
    const L = S.li, u = S.lp;
    let sx = 1000, sy = 130, size = 90, r = 45, col = PAL.sun, showRays = true, eyes = false;
    if (L === 3) {
      const morphU = ease.inOut(inv(0.1, 0.55, u));
      const dropU = ease.inOut(inv(0.1, 1.0, u));
      r = lerp(45, 0, morphU);
      sx = lerp(1000, 1070, dropU);
      const waterY = Kit.waveY(sx, t, 460, 12, 1, 1);
      sy = lerp(130, waterY + size * 0.1, dropU); // ends only ~60% submerged: still visibly sinking, not gone
      col = mix(PAL.sun, PAL.clawd, ease.inOut(u));
      showRays = u < 0.15;
      eyes = u > 0.2;
    }
    if (showRays) for (let i = 0; i < 10; i++) { const a = i * Math.PI / 5 + t * 0.3; Kit.streak(sx + Math.cos(a) * size * 0.6, sy + Math.sin(a) * size * 0.6, sx + Math.cos(a) * size * 0.85, sy + Math.sin(a) * size * 0.85, 8, '#ffc21f'); }
    Kit.rect(sx - size / 2, sy - size / 2, size, size, col, { r });
    if (eyes) { Kit.circle(sx - size * 0.18, sy - size * 0.05, size * 0.06, PAL.ink, { stroke: false }); Kit.circle(sx + size * 0.18, sy - size * 0.05, size * 0.06, PAL.ink, { stroke: false }); }
    return { sx, sy };
  }

  function draw(S) {
    const t = S.t, L = S.li, u = S.lp;
    const warmU = L === 3 ? ease.inOut(u) : 0;

    // ---- sky, warming into sunset only during the last line ----
    const skyTop = mix(PAL.skyTop, '#ffb066', warmU);
    const skyLow = mix(PAL.skyLow, PAL.sunset, warmU);
    Kit.gradient(0, 0, W, 470, skyTop, skyLow);
    Kit.paint([[0, 0], [W, 0], [W, 260], [0, 320]], '#ffffff', 70, 'p2-sky');
    Kit.cloud(220 + (t * 8) % 260, 100, 170, mix(PAL.cloud, '#ffe3c2', warmU * 0.6));
    Kit.cloud(760 - (t * 6) % 300, 165, 190, mix(PAL.cloud, '#ffe3c2', warmU * 0.6));

    const sun = drawSun(S, t);

    // ---- back sea (the sun sinks behind this band during line 3) ----
    Kit.sea(t, 460, mix(PAL.seaDeep, PAL.sunset, warmU * 0.25), { amp: 12, phase: 1, foam: false });

    // ---- the shared rope-and-heave rhythm, used by Clawd and the crew all part long ----
    const beatFrac = S.beat - Math.floor(S.beat);
    const fling = Math.pow(ping(beatFrac), 0.6);
    const flingAmt = L === 0 ? 1 : 0.15;
    const clawdLift = fling * flingAmt * 140;

    // ---- the stomp: on beatInBar 1 and 3, the whole ship hops out of the water ----
    const stompBeat = (S.beatInBar === 1 || S.beatInBar === 3);
    const stompStrength = stompBeat ? S.pulse : S.pulse * 0.12;
    const hopAmt = L === 2 ? 46 : 12;
    // a small anticipation dip just before each stomp beat, so the hop reads as a push-off, not a pop
    const nextBeatInBar = (Math.floor(S.beat) + 1) % 4, toNextBeat = 1 - beatFrac;
    const anticip = (L === 2 && (nextBeatInBar === 1 || nextBeatInBar === 3) && toNextBeat < 0.15) ? (1 - toNextBeat / 0.15) * 9 : 0;
    const hopY = -stompStrength * hopAmt + anticip;

    const shipLen = 600, shipX = 610;
    const deckY = Kit.waveY(shipX, t, 460, 12, 1) - 26 + hopY;
    const tilt = Math.sin(t * 1.2) * 0.035;
    const toScreen = (lx, ly) => [shipX + lx * Math.cos(tilt) - ly * Math.sin(tilt), deckY + lx * Math.sin(tilt) + ly * Math.cos(tilt)];

    push(); translate(shipX, deckY); rotate(tilt);
    Kit.ship(shipLen, { billow: 0.55 + 0.2 * Math.sin(t * 1.3), t });

    // rope + pulley near the mast (present all part; amplitude changes with the line)
    const px = -24, py = -260;
    Kit.circle(px, py, 10, PAL.woodDark, { weight: 2.5 });
    Kit.circle(px, py, 4, PAL.wood, { stroke: false });

    // crew hauling the line, well clear of Clawd and the scientist
    const leanBase = lerp(0.05, -0.35, fling) * (L === 0 ? 1 : 0.3);
    [90, 155, 220].forEach((sx2, i) => sailor(sx2, 0, leanBase - i * 0.03));
    Kit.streak(px, py, 90, -70, 5, PAL.rope);

    // Clawd's own rope, only shown while he is being hove up and down (line 0's gag)
    const clawdX = L === 3 ? lerp(-24, 290, ease.outBack(clamp(u / 0.15))) : -24;
    const clawdTopY = -140 - clawdLift;
    if (L === 0) Kit.streak(px, py, clawdX, clawdTopY, 5, PAL.rope);

    // fiddler with a crying face, at the bow rail, clear of the crew (line 2's gag)
    if (L === 2) { sailor(300, 0, Math.sin(t * 2) * 0.05); cryingFiddle(300, 0, t); }

    // scientist's chalkboard: a tally mark for each wave, growing into a soaking wave (line 1's gag).
    // Uses line 1's own absolute time so the marks do not flicker during the other three lines,
    // and stay at four for the rest of the part once line 1 is done.
    const line1 = S.lines[1];
    const u1 = clamp((S.t - line1.t0) / (line1.t1 - line1.t0));
    const marks = Math.min(4, Math.floor(u1 * 4 + 1e-6));
    const soaked = L === 1 && u > 0.9;
    const bx0 = -280, by0 = -150, bw = 100, bh = 90;
    Kit.rect(bx0 + bw / 2 - 4, by0 + bh, 8, 60, PAL.wood, { weight: 2.5 });
    Kit.rect(bx0, by0, bw, bh, PAL.woodDark, { weight: 3 });
    Kit.rect(bx0 + 5, by0 + 5, bw - 10, bh - 10, '#fbfaf5', { weight: 1.5 });
    for (let i = 0; i < Math.min(marks, 3); i++) { const mx2 = bx0 + 25 + i * 20; Kit.streak(mx2, by0 + 78, mx2, by0 + 18, 5, PAL.ink); }
    if (marks >= 4) Kit.streak(bx0 + 18, by0 + 78, bx0 + 82, by0 + 18, 5, PAL.ink);
    if (L === 1) {
      // one small wave per mark, each bigger than the last; the fourth is a big one that
      // crests all the way over to the scientist and holds there instead of falling back.
      const k = clamp(Math.floor(u * 4), 0, 3), q = clamp(u * 4 - k);
      if (k < 3) {
        const waveH = (25 + 35 * k) * ping(q);
        Kit.poly([[bx0 - 45, 30], [bx0 - 22, 30 - waveH], [bx0, 22 - waveH * 0.6], [bx0 + 12, 30]], mix(PAL.sea, PAL.foam, 0.3), { weight: 3 });
      } else {
        const waveH = 210 * ease.out(clamp(q / 0.55));
        Kit.poly([[bx0 - 48, 30], [bx0 - 15, 28 - waveH * 0.55], [-215, 18 - waveH], [-150, 8 - waveH * 0.95], [-95, 18 - waveH * 0.45], [-60, 30]], mix(PAL.sea, PAL.foam, 0.35), { weight: 3 });
      }
      if (soaked) { Kit.circle(-150 - 20, -170, 6, PAL.foam, { stroke: false, alpha: 220 }); Kit.circle(-150 + 15, -180, 5, PAL.foam, { stroke: false, alpha: 220 }); }
    }
    Kit.scientist(-150, 0, 160, {
      facing: -1, arms: L === 1 ? [0.15, 1.15] : [0.15, 0.15], prop: L === 1 ? 'pencil' : 'none',
      hair: soaked ? 'wet' : 'normal', mood: soaked ? 'surprised' : (L === 1 ? 'squint' : 'happy'),
    });

    // Clawd — the yo-yo lift actually moves his ground point up, not just the rope's end
    Kit.clawd(clawdX, -clawdLift, 130, {
      facing: L === 3 ? 1 : -1, look: L === 3 ? [0.6, -0.2] : [0, 0],
      squash: lerp(0.3, -0.35, fling), rot: L === 3 && u > 0.15 ? Math.sin(t * 6) * 0.06 : 0,
      walk: (L === 3 && u < 0.15) ? inv(0, 0.15, u) * 10 : 0,
      arms: (L === 0 || (L === 3 && u > 0.12)) ? 'up' : 'down',
      mood: (L === 0 && fling > 0.8) ? 'surprised' : 'happy',
    });
    if (hopY < -14) Kit.ellipse(0, 22, shipLen * 0.34, 14, PAL.foam, { stroke: false, alpha: 170 });
    pop();

    // ---- front sea ----
    Kit.sea(t, 545, PAL.sea, { amp: 18, color2: mix(PAL.seaDeep, PAL.sunset, warmU * 0.2) });

    // ---- sound words, one per joke, at the moment of the gag ----
    if (L === 0) {
      const word = Math.floor(S.beat) % 2 === 0 ? 'HEAVE!' : 'HO!';
      const [wx, wy] = toScreen(-24, -170 - clawdLift);
      Kit.sfx(word, wx, wy, beatFrac * 0.6, { size: 100, rot: -0.1 });
    }
    if (L === 1) {
      const splashT = S.line.t0 + 0.86 * (S.line.t1 - S.line.t0);
      const [wx, wy] = toScreen(-330, -190);
      Kit.sfx('SPLOOSH!', wx, wy, S.t - splashT, { size: 110, rot: 0.08 });
    }
    if (L === 2 && stompBeat) {
      const [wx, wy] = toScreen(0, -160);
      Kit.sfx('STOMP!', wx, wy, beatFrac * 0.6, { size: 120, rot: -0.15 });
    }
    if (L === 3) {
      const plonkT = S.line.t0 + 0.84 * (S.line.t1 - S.line.t0);
      Kit.sfx('PLONK!', sun.sx - 60, sun.sy - 100, S.t - plonkT, { size: 100, rot: 0.05 });
    }
  }

  Scenes.register(2, { draw });
})();
