// render.mjs: render studio.html frame by frame in headless Chrome, then encode an MP4 with ffmpeg.
// Usage:
//   node render.mjs                      full song, 24 fps, 2 workers -> out/clawd-goes-to-sea.mp4
//   node render.mjs --workers=2 --fps=24 --from=28 --to=31 --out=out/slice.mp4
//   --fresh    re-render frames that already exist (default: keep them, so an interrupted run resumes)
//   --encode-only   skip rendering, only run ffmpeg on the frames folder
import puppeteer from 'puppeteer-core';
import { pathToFileURL, fileURLToPath } from 'url';
import { spawnSync } from 'child_process';
import fs from 'fs';
import path from 'path';

const root = path.dirname(fileURLToPath(import.meta.url));
const arg = (k, d) => { const a = process.argv.find(x => x.startsWith(`--${k}=`)); return a ? a.split('=')[1] : d; };
const flag = k => process.argv.includes(`--${k}`);
const CHROME = process.env.CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const FPS = +arg('fps', 24), WORKERS = Math.max(1, +arg('workers', 2));
const DURATION = 150;
const from = +arg('from', 0), to = Math.min(DURATION, +arg('to', DURATION));
const framesDir = path.resolve(root, arg('frames', 'frames'));
const out = path.resolve(root, arg('out', 'out/clawd-goes-to-sea.mp4'));
const f0 = Math.round(from * FPS), f1 = Math.round(to * FPS); // [f0, f1)
const name = i => path.join(framesDir, `f_${String(i).padStart(5, '0')}.jpg`);
fs.mkdirSync(framesDir, { recursive: true });
fs.mkdirSync(path.dirname(out), { recursive: true });

async function worker(k) {
  const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new', args: ['--use-angle=d3d11', '--ignore-gpu-blocklist', '--mute-audio'] });
  const errors = [];
  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 720, deviceScaleFactor: 1 });
    page.on('pageerror', e => errors.push(e.message));
    await page.evaluateOnNewDocument(() => { window.RENDER = true; });
    await page.goto(pathToFileURL(path.join(root, 'studio.html')).href, { waitUntil: 'domcontentloaded', timeout: 120000 });
    await page.waitForFunction('window.studioReady === true', { timeout: 120000 });
    let done = 0, drawMs = 0;
    const started = Date.now();
    for (let i = f0 + k; i < f1; i += WORKERS) {
      if (!flag('fresh') && fs.existsSync(name(i)) && fs.statSync(name(i)).size > 0) continue;
      drawMs += await page.evaluate(t => window.renderFrame(t), i / FPS);
      const tmp = name(i) + '.part';
      await page.screenshot({ path: tmp, type: 'jpeg', quality: 92, optimizeForSpeed: true });
      fs.renameSync(tmp, name(i));
      done++;
      if (done % 50 === 0) {
        const rate = done / ((Date.now() - started) / 1000);
        console.log(`[worker ${k}] frame ${i} (${(i / FPS).toFixed(1)}s) | ${rate.toFixed(2)} fps | avg draw ${(drawMs / done).toFixed(0)} ms`);
      }
    }
    const sceneErrors = await page.evaluate(() => window.SCENE_ERRORS);
    return { k, done, errors, sceneErrors: [...new Set(sceneErrors)] };
  } finally {
    await browser.close();
  }
}

if (!flag('encode-only')) {
  console.log(`rendering frames ${f0}..${f1 - 1} (${((f1 - f0) / FPS).toFixed(1)} s at ${FPS} fps) with ${WORKERS} worker(s)`);
  const t0 = Date.now();
  const results = await Promise.all(Array.from({ length: WORKERS }, (_, k) => worker(k)));
  for (const r of results) {
    console.log(`[worker ${r.k}] rendered ${r.done} frames`);
    if (r.errors.length) console.log(`[worker ${r.k}] page errors:\n  ` + [...new Set(r.errors)].join('\n  '));
    if (r.sceneErrors.length) console.log(`[worker ${r.k}] scene errors:\n  ` + r.sceneErrors.slice(0, 20).join('\n  '));
  }
  console.log(`frames done in ${((Date.now() - t0) / 60000).toFixed(1)} min`);
}

const missing = [];
for (let i = f0; i < f1; i++) if (!fs.existsSync(name(i))) missing.push(i);
if (missing.length) { console.error(`missing ${missing.length} frames, first: ${missing[0]}. Not encoding.`); process.exit(1); }

const ff = spawnSync('ffmpeg', ['-y', '-loglevel', 'error', '-stats',
  '-framerate', String(FPS), '-start_number', String(f0), '-i', path.join(framesDir, 'f_%05d.jpg'),
  '-ss', String(f0 / FPS), '-t', String((f1 - f0) / FPS), '-i', path.join(root, 'assets', 'shanty.wav'),
  '-frames:v', String(f1 - f0),
  '-c:v', 'libx264', '-preset', 'medium', '-crf', '18', '-pix_fmt', 'yuv420p', '-movflags', '+faststart',
  '-c:a', 'aac', '-b:a', '192k', out], { stdio: 'inherit' });
if (ff.status !== 0) { console.error('ffmpeg failed'); process.exit(1); }
console.log('wrote ' + path.relative(root, out));
