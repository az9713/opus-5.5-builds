// Example scene: shows the Kit API. Copy the structure, not the content.
// Registered as part N by the line at the bottom.
(function () {
  const { PAL, W, H, ease, inv, ping, lerp } = Kit;

  function draw(S) {
    const t = S.t;
    // 1. background: sky gradient + one watercolor wash for texture (1 of max 3 paint calls)
    Kit.gradient(0, 0, W, 470, PAL.skyTop, PAL.skyLow);
    Kit.paint([[0, 0], [W, 0], [W, 260], [0, 320]], '#ffffff', 90, 'example-sky');
    Kit.sun(1080, 110, 55);
    Kit.cloud(240 + (t * 12) % 200, 120, 220);

    // 2. back sea layer, then the ship riding it, then the front sea layer
    Kit.sea(t, 450, PAL.seaDeep, { amp: 10, phase: 1, foam: false });
    const shipX = 600, deckY = Kit.waveY(shipX, t, 470, 14) - 30;
    const tilt = Math.sin(t * 1.3) * 0.04;
    push(); translate(shipX, deckY); rotate(tilt);
    Kit.ship(520, { billow: 0.6 + 0.3 * Math.sin(t) });
    // characters stand on the deck (y = 0) in the ship's transform
    const hop = S.beatInBar % 2 === 1 ? S.pulse * 10 : 0; // little hop on the stomp beats
    Kit.clawd(-80, -hop, 110, { walk: 0, look: [0.5, 0], blink: (t % 3.1) < 0.12 });
    Kit.scientist(70, 0, 160, { facing: -1, arms: [0.2, 1.2], prop: 'clipboard' });
    pop();
    Kit.sea(t, 540, PAL.sea, { amp: 16, color2: PAL.seaDeep });

    // 3. a sound word on each stomp fill, placed in screen coordinates
    Kit.sfx('STOMP!', 300, 250, S.since('stompFill'), { size: 120, rot: -0.15 });
    // a hand-lettered label
    Kit.label('Example scene', 640, 40, { size: 30 });
  }

  Scenes.register(1, { draw });
})();
