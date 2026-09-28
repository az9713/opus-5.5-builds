# Animation Guide — Clawd Goes to Sea

This guide is for the seven scene agents. Each agent writes one part of the song as one file:
`scenes/part<N>.js`. Read this guide, `STORYBOARD.md` (your four jokes), and `dev/example-scene.js`
(a working scene) before you write code.

## 1. Rules

1. Write only `scenes/part<N>.js`. Do not change any other file. If the shared kit (`lib.js`) lacks something, draw it yourself inside your file.
2. Register the scene with `Scenes.register(N, { draw(S) { ... } })`, wrapped in an IIFE (see the example).
3. Draw only with `Kit.*` functions (they call p5.brush). Do not call native p5 shapes (`rect`, `ellipse`, `circle`, `line`, `text`): in this WEBGL canvas they cost about 2 ms each and do not have the painted look. You may use `push()`, `pop()`, `translate()`, `rotate()`, `scale()`.
4. Never use `Math.random()`, `random()` or `noise()`. Use `Kit.rand(key...)`. Each frame must depend only on the time `S.t`: the renderer draws frames out of order in two browsers.
5. Do not keep state between frames (no counters, no arrays that grow). Compute everything from `S.t`.
6. Frame budget: the whole frame must draw in less than 250 ms (the test prints the time). Use at most 3 `Kit.paint` (watercolor) calls per frame. Outlined shapes cost about 1.2 ms each; shapes with `{ stroke: false }` and `Kit.streak` cost almost nothing.
7. Do not add files, fonts, images, or npm packages. Do not use browser MCP tools. Do not kill processes by name. The test script closes its own Chrome.
8. Keep the bottom 92 px clear of important action: the karaoke caption bar covers y = 628..720.

## 2. How to draw Clawd

Clawd is an **orange block with two dot eyes and four stubby legs**. Nothing else: no mouth, no nose, no hat unless a joke needs it.

- **Body**: a wide rectangle, width `s`, height `0.72 s`, corners almost square. Color `PAL.clawd` (#d97757). Ink outline.
- **Eyes**: two small black vertical ovals in the upper half of the body, about `0.4 s` apart. They are dots, not circles with pupils. For a surprised or scared look they become white circles with a small black dot.
- **Legs**: four short dark-orange stubs (`PAL.clawdDark`) under the body, height `0.17 s`. When he walks, alternate legs lift. They are short: this is the running joke ("stubby legs that barely grew").
- **Nubs**: one small block on each side of the body, like tiny arms. They can point down, out, or up.
- **Acting**: Clawd acts with his whole body. Squash him flat on a landing (`squash: 0.6`), stretch him tall on a jump (`squash: -0.5`), tilt him (`rot`), move his eyes (`look`), blink (`blink`).

Use the kit function — do not draw Clawd by hand:

```js
Kit.clawd(x, y, s, { facing, walk, squash, rot, look: [dx, dy], blink, mood, arms, color });
// (x, y) = ground point between his feet. s = body width in px (110-130 on the ship, 200+ for close-ups).
// walk = a phase that grows while walking, e.g. walk: S.t * 14. Use 0 to stand still.
// mood: 'happy' (dot eyes) | 'surprised' | 'scared' (adds a sweat drop) | 'dizzy' (X eyes) | 'determined' (brows) | 'sleepy'
// arms: 'down' | 'out' | 'up'
// color: override for a joke (for example blue when he is cold).
```

## 3. How to draw the scientist

A **small** scientist: about 1.4 times Clawd's height, never taller than Clawd is wide times 1.6.
White lab coat, round glasses, messy brown hair, dark trousers.

```js
Kit.scientist(x, y, h, { facing, walk, rot, arms: [back, front], prop, hair, mood, look, blink });
// (x, y) = ground point. h = full height (about 150-170 px on the ship).
// arms: angles in radians. 0 = hanging down, 1.57 = pointing forward, 3.14 = straight up.
// prop (in the front hand): 'none' | 'clipboard' | 'notebook' | 'telescope' | 'pipette' | 'ruler' | 'pencil'
// hair: 'normal' | 'static' (straight up, for the lightning joke) | 'wet'
// mood: 'happy' | 'surprised' | 'squint' | 'scared' | 'dizzy'
```

Other people (captain, crew, fiddler) are yours to draw from `Kit` shapes. Keep them simple: a circle head, a
block body in navy or striped colors, stick arms (`Kit.streak`). They must look like the same cartoon world:
flat colors, ink outlines.

## 4. Style

- Flat cartoon shapes, one flat color each, black ink outline (`PAL.ink`, pen weight `Kit.INK_W` = 4).
- Painted texture comes from three things: the wobbly p5.brush ink line (it "boils" 8 times per second),
  up to 3 watercolor washes per frame (`Kit.paint`, use them on big areas like the sky or the sea),
  and a paper texture that the core multiplies over the whole frame. You do not draw the paper.
- Use the palette `Kit.PAL` (see `lib.js`). Mix with `Kit.mix(c1, c2, u)`.
- Motion: ease everything (`Kit.ease.outBack`, `inOut`, `outBounce`), squash and stretch, anticipation before a big action.
- Move on the beat. `S.pulse` is 1 on each beat and decays; `S.beatInBar` is 0..3. Stomps are on beats 1 and 3 (`beatInBar` 1 and 3).

## 5. Coordinates and layers

- Screen: 1280 x 720, top-left origin, y goes down. The core already translates the WEBGL canvas.
- Draw back to front: sky, far things, back sea (`Kit.sea`), ship and characters, front sea, near things.
- **Ship**: `push(); translate(x, deckY); rotate(tilt); Kit.ship(len, { billow, sail }); ...characters at y = 0...; pop();`
  Local origin = middle of the deck, deck surface at y = 0, bow on the right, hull length `len` (500-700 px for a wide shot).
- **Floating**: `Kit.waveY(x, t, y0, amp, phase, speed)` returns the sea surface height; use the same values as your `Kit.sea` call so the ship rides the wave.

## 6. The scene context `S`

```
S.t        song time in seconds (0..150)
S.lt       seconds since your part started (part 1: negative during the intro; part 7: up to 25.2 in the outro)
S.dur      part length (19.2 s)
S.lines    your 4 lyric lines: { index, text, t0, t1, words: [{ w, t0, t1 }] }
S.li       current line 0..3 (-1 before the first line), S.line = that line, S.lp = 0..1 progress in it
S.word     index of the word being sung in S.line
S.beat     beats since the song start (float); S.beatInBar 0..3; S.bar; S.pulse (1 on the beat, decays)
S.since(type)  seconds since the last event of this type ('thunder', 'gull', 'stompFill', 'hey'), Infinity if none yet
S.W, S.H   1280, 720
```

A good pattern: compute a local time inside each line, then animate the joke with it.

```js
const L = S.li, u = S.lp;                 // which joke, how far along
if (L === 1) { const jump = Kit.ping(Kit.inv(0.3, 0.6, u)); ... }
```

## 7. Text on screen

- **Sound words** (big yellow comic letters): `Kit.sfx(text, x, y, age, { size, rot, dur })`. `age` is seconds since the word starts; it shows while `0 <= age <= dur` (default 0.9 s). Use one per joke, at the moment of the gag. Screen coordinates (transforms do not apply).
- **Labels** (signs, notebook text, tally marks): `Kit.label(text, x, y, { size, rot, color, font: 'comic' | 'bold' | 'serif' })`. Screen coordinates.
- **Flash**: `Kit.flash(a)` whites out the screen (lightning), `a` 0..1.
- Do not draw the karaoke captions. The core draws them.

## 8. Continuity and transitions

The core draws a transition over each part boundary (0.55 s before and after). It switches scenes at the exact
boundary, under full cover. Your scene must still look right in its first and last 0.6 s: start the part already in
place (no empty frame), and hold your final pose until the end.

| Part | Opens with | Closes with | Transition out |
|---|---|---|---|
| 1 Signing On | intro title sign, harbor, morning | Clawd and scientist on deck, ship leaving to the right | wave |
| 2 Heave Away | ship at open sea, sunny, crew on deck | sunset, orange square sun sinks | wave |
| 3 Learning the Ropes | bright morning on deck | scientist spinning with joy, dark clouds on the horizon | storm clouds |
| 4 The Storm | sky darkening fast | lightning hits the mast | lightning flash |
| 5 Heave Through the Gale | full storm, heavy rain | ship surfing a giant wave, a crack of light in the clouds | sunburst |
| 6 Land Ho | clouds breaking up, sun | crew singing, island close | wave |
| 7 Homeward | ship arriving at the island dock | everyone jumps on HEY! (145.2 s), sail says THE END | end of video |

## 9. Test your scene

From the build folder:

```
node dev/scene-test.mjs <N>                 # 6 frames spread over your part + contact sheet
node dev/scene-test.mjs <N> --lt=1,5.5,9    # frames at part-local seconds
```

It writes `dev/out/part<N>_*.jpg` and `dev/out/part<N>_sheet.jpg`, prints the draw time of each frame, and prints
any scene error. Look at the sheet with the Read tool. Render at most 6 frames per run: eleven other builds share
this computer. A scene that throws an error is replaced by a plain placeholder, so check for "SCENE ERRORS".
