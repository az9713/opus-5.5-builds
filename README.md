# 15 Opus 5.5 builds — variations

Fifteen builds made with Claude Opus 5.5. Each one is a **variation** of a build from the video
[**Top 15 Things built with Claude OPUS 5.5**](https://www.youtube.com/watch?v=dw4rYWy8nLw) by **Code Bear** on YouTube.

A variation keeps the technique and the look of the original and changes the subject.
For example, the original #6 is "The Minecraft Test"; the variation is "The Volcano Test".
These are not copies of the original builds. Every original belongs to its creator (see the "Based on" column).

The prompts and the pass checks for all 15 builds are in [`opus55-15-variations-specs.html`](https://az9713.github.io/opus-5.5-builds/opus55-15-variations-specs.html).

## Play them

Live links run on GitHub Pages at `https://az9713.github.io/opus-5.5-builds/`.

| # | Build | Based on | Play |
|---|---|---|---|
| 1 | **Eye Lab** — how the human eye focuses (3D) | Lens Lab, by [@RyanSael](https://x.com/RyanSael) | [▶ Open](https://az9713.github.io/opus-5.5-builds/builds/01-eye-lab/index.html) |
| 2 | **Clawd Goes to Sea** — music video, a sea shanty composed in code (150 s) | Clawd music video, by [@other__reality](https://x.com/other__reality) | [▶ Watch MP4](https://az9713.github.io/opus-5.5-builds/builds/02-clawd-goes-to-sea/out/clawd-goes-to-sea.mp4) |
| 3 | **Small Weather** — short film in code, water and weather patterns | Short film in code, by [@devteamdrew](https://x.com/devteamdrew) | [▶ Open](https://az9713.github.io/opus-5.5-builds/builds/03-water-weather-code/index.html) |
| 4 | **Meridian** — one-prompt film title sequence (15 s) | Motion showreel, by [@stephanlivera](https://x.com/stephanlivera) | [▶ Open](https://az9713.github.io/opus-5.5-builds/builds/04-title-sequence/index.html) |
| 5 | **Frostbound Monastery** — soulslike game in a snowbound monastery | Dark Souls-style game, by [@The_Alex](https://x.com/The_Alex) | [▶ Play](https://az9713.github.io/opus-5.5-builds/builds/05-frostbound-monastery/index.html) |
| 6 | **The Volcano Test** — volcanic island sandbox | "The Minecraft Test", by [@noahwachnik](https://x.com/noahwachnik) | [▶ Play](https://az9713.github.io/opus-5.5-builds/builds/06-volcano-test/index.html) |
| 7 | **Storm Lighthouse** — procedural Blender scene (12.5 s render) | Procedural Blender castle, by [@Stefan_3D_AI](https://x.com/Stefan_3D_AI) | [▶ Watch render](https://az9713.github.io/opus-5.5-builds/builds/07-storm-lighthouse/storm_lighthouse_final.mp4) · [build time-lapse](https://az9713.github.io/opus-5.5-builds/builds/07-storm-lighthouse/build_timelapse.mp4) |
| 8 | **Pixel Dragon** — pixel art drawn in pure code | Pixel-art wizard, by [@majidmanzarpour](https://x.com/majidmanzarpour) | [▶ Open](https://az9713.github.io/opus-5.5-builds/builds/08-pixel-dragon/index.html) |
| 9 | **The Stone of Rashid** — Rosetta Stone puzzle game | Antikythera mechanism game, by [@edwinarbus](https://x.com/edwinarbus) | [▶ Play](https://az9713.github.io/opus-5.5-builds/builds/09-rosetta-stone/index.html) |
| 10 | **Spraywave Rally** — one-shot jet-ski racer | Kart racer, by [@bridgemindai](https://x.com/bridgemindai) | [▶ Play](https://az9713.github.io/opus-5.5-builds/builds/10-wave-racer/index.html) |
| 11 | **Arch Bridge** — pencil sketch to 3D stone arch bridge, with physics | Sketch to 3D trebuchet, by [@poolio](https://x.com/poolio) | [▶ Open](https://az9713.github.io/opus-5.5-builds/builds/11-arch-bridge/index.html) |
| 12 | **Snow Day** — first-person multiplayer snow clearing | Multiplayer lawn mowing, by [@_MaxBlade](https://x.com/_MaxBlade) | Local only — [see below](#12-snow-day-runs-on-your-pc) |
| 13 | **Four Seasons in Glass** — glass-tile mosaic film, spring into winter | Glass-tile mosaic film, by [@LCSlates](https://x.com/LCSlates) | [▶ Open](https://az9713.github.io/opus-5.5-builds/builds/13-four-seasons-glass/index.html) |
| 14 | **A Japan Rail Sketchbook** — a trip drawn in acrylic marker | New Zealand trip in markers, by [@ann_nnng](https://x.com/ann_nnng) | [▶ Open](https://az9713.github.io/opus-5.5-builds/builds/14-japan-rail-sketchbook/index.html) |
| 15 | **Silk Road in Sand** — sand-art film, 130 BCE to 1453 CE (120 s) | Sand-art film of US history, by [@Michaelzsguo](https://x.com/Michaelzsguo) | [▶ Open](https://az9713.github.io/opus-5.5-builds/builds/15-silk-road-sand/index.html) |

Turn on sound for #2, #3, #4 and #15. They have music.

### #12 Snow Day runs on your PC

Snow Day needs a Node.js WebSocket server, so GitHub Pages cannot host it. Run it locally:

1. Open a terminal in `builds/12-snow-day/`.
2. Run `npm install`.
3. Run `npm start`. The server prints `listening on http://localhost:3512`.
4. Open `http://localhost:3512/?name=Alice` in one browser window.
5. Open `http://localhost:3512/?name=Bob` in a second window. Each window is one player.

More detail is in [`builds/12-snow-day/README.md`](builds/12-snow-day/README.md).

## Run locally

Clone the repo, then open any `builds/NN-*/index.html` through a local web server.
Some builds load ES modules, and browsers block those from `file://`.

```
python -m http.server 8000
```

Then open `http://localhost:8000/builds/01-eye-lab/index.html` (change the folder name for the other builds).

## Rebuild from source

The committed files already play. Rebuild only when you change the source.

| # | Command (run in the build folder) | Output |
|---|---|---|
| 2 | `npm install`, then `node compose.mjs`, then `node render.mjs` | `assets/shanty.wav`, `assets/timing.js`, `out/clawd-goes-to-sea.mp4` (needs Chrome and ffmpeg) |
| 7 | `blender -b -P build_scene.py`, then `blender -b storm_lighthouse.blend -P render_final.py` (Blender 5.2) | `storm_lighthouse.blend`, `screenshots/`, `frames/` (encode the frames to MP4 with ffmpeg) |
| 11 | `npm install`, then `node build/build.js` | `bundle.js` |
| 14 | `node build.js` | `index.html` (from `template.html` and `photos/`) |

Not in the repo, because they are large or can be made again: `node_modules/`, the #2 frame folder and `shanty.wav`, the #7 frame folder, Blender cache and `.blend` files.
The committed #2 MP4 is a smaller re-encode (24.7 MB, 1280×720, 150 s). `node render.mjs` writes the full-quality file.

## Known limits

Each build was checked against the "Check" lines in the specs file. These items did not fully pass:

- **#4** — the spec asks for max effort; the build did not use max effort.
- **#5** — the Tower, Bridge and Summit area banners were not tested with real input.
- **#11** — removing the keystone drops only the crown of the arch; the haunches and deck stay up.
- **#12** — the look is low-poly, not photoreal; there is no mouse-look.
- **#14** — one distant walker in the Arashiyama page is lost in the marker filter.
- **#15** — the spec asks for "one prompt, no edits"; the build was resumed once.
- **#2, #3, #15** — the music was generated but not reviewed by ear.

## Credits

- Reference video: [Top 15 Things built with Claude OPUS 5.5](https://www.youtube.com/watch?v=dw4rYWy8nLw), Code Bear.
- Original builds: the 15 creators named in the table. Their posts are linked in the video description.
- Builds in this repo: made with Claude Opus 5.5 in Claude Code. The #11 sketch and the #14 photos are AI images made with Higgsfield Soul 2.0.
