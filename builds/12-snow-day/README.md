# Snow Day -- Alpine Plow (localhost multiplayer)

A photorealistic-as-browser-PBR-allows, first-person, multiplayer snow-clearing
simulator. Players ride vintage snowblowers in front of a grand alpine hotel,
cutting lanes through deep snow that slowly refills, while a server keeps
every window's view of the snowfield and the other players in sync.

**Local only.** There is no public server and no deploy step. Everything
runs on `localhost` for testing with 2-3 browser windows on one PC.

## Requirements

- Node.js (already installed)
- Google Chrome or any modern browser

## Run it

From this folder (`builds/12-snow-day/`):

```
npm install
npm start
```

The server prints:

```
[snow-day] listening on http://localhost:3512
```

Open that URL in a browser. Each browser **window** (not each tab sharing
state) becomes its own player -- the server hands out a fresh id per
WebSocket connection, so nothing is keyed on a cookie or `localStorage`
value that windows would otherwise share.

To join with a name straight from a link (skips the name-entry screen):

```
http://localhost:3512/?name=Frost
```

Without `?name=`, you get a small join screen with a name field and a
"Start Plowing" button.

## Controls

- `W` / `Up` -- throttle forward
- `S` / `Down` -- reverse
- `A` / `D` or `Left` / `Right` -- steer (only takes effect while moving)
- `Enter` -- open chat, type, `Enter` again to send (`Escape` clears/closes)

The camera is a fixed first-person cockpit view (over the wheel, hands on
it, a thermos on the dash) -- there is no mouse-look, so it stays usable
without pointer lock stealing focus between windows.

**Keyboard and pointer/focus only go to the window that has OS focus.**
That's a normal browser limitation, not a bug here: click into the window
you want to drive before pressing keys. The *other* windows keep receiving
and rendering the game state the whole time (see "How sync works" below) --
you'll see their machines, cleared lanes and chat update even while unfocused.

## Test with 2 or 3 windows

1. Run `npm install` once, then `npm start`.
2. Open `http://localhost:3512/?name=Alice` in one browser window.
3. Open `http://localhost:3512/?name=Bob` in a second browser window.
   Arrange the two windows side by side so both are visible.
4. Click into Alice's window and drive with `W`/`A`/`S`/`D`. Within well
   under a second, Bob's window shows the cleared lane, Alice's machine
   moving, and Alice's snowblower on Bob's minimap (bottom-right).
5. Press `Enter` in Alice's window, type a message, press `Enter` again.
   It appears in the middle of both windows' screens.
6. Optionally open a third window at `http://localhost:3512/?name=Casey`
   (or just click a link with that URL) while the first two are still
   playing -- Casey spawns into the same live game and all three players
   see each other immediately.
7. To stop the server, go back to the terminal running `npm start` and
   press `Ctrl+C`.

## How sync works (why background/unfocused windows still update)

Browsers throttle `requestAnimationFrame` in a hidden tab, so a render loop
alone would freeze a window's view of the world while it's in the
background. This build never relies on rAF for state:

- The server ticks on a plain `setInterval` (12.5 Hz, `server/index.js`),
  independent of any browser, and broadcasts snow-grid diffs and player
  positions on that timer.
- Each client sends its own position (and implicitly clears snow under
  itself while moving) on a `setInterval` (~15 Hz, `public/js/network.js`),
  not inside the render loop.
- Every incoming WebSocket message updates the shared `world` state
  object immediately, in the message handler -- not in the draw loop.
  `requestAnimationFrame` only ever *reads* that state to draw the current
  frame, whenever it next gets to run.

That combination was verified directly: with one window in the background
(`document.visibilityState === 'hidden'`), driving the foreground window
still produced a clean lane-clear update in the hidden window in ~217 ms
(see the build report for the full numbers).

## What's simplified

- The "thermos in one hand" is modeled resting in a dash-mounted cup
  holder near the right glove, not literally gripped in a hand mesh --
  the hands are on the wheel.
- The whole scene (snowblower, hotel, snow) is built from primitive
  three.js geometry with procedurally generated canvas textures (no
  external image/model assets, so it runs fully offline). It uses real
  PBR materials, soft shadows, fog and a low sun, but it is a stylized
  low-poly look, not photoreal.
- Vehicle physics are simple arcade-style acceleration/steering, not a
  full suspension/traction simulation.

## Project layout

```
server/
  index.js       HTTP + WebSocket server, authoritative tick loop
  gameState.js   Snow grid, player registry, chat log
public/
  index.html     Page shell, join screen, HUD, import map (offline three.js)
  style.css      Dark-on-snow UI styling
  js/
    main.js      Renderer/scene setup, input, vehicle physics, render loop
    network.js   WebSocket client, reconnect-with-backoff, world-state sync
    world.js     Plain-data shared state (players, snow bytes, chat)
    terrain.js   Ground + displaced/alpha-cut snow field, texture upload
    snowblower.js  Vintage ride-on snowblower + remote-player driver figure
    hotel.js     Grand alpine hotel facade (primitives only)
    snowfx.js    Ambient falling snow + auger snow-plume particles
    minimap.js   Bottom-right 2D canvas minimap
    chat.js      Center-screen chat overlay
    textures.js  Procedural canvas textures (ground, snow sparkle, wood)
```
