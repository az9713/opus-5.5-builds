// Scene test: render a few frames of one part and make a contact sheet.
// Usage (from the build folder):
//   node dev/scene-test.mjs <part 1-7>                 -> 6 frames spread over the part
//   node dev/scene-test.mjs <part> --lt=0,2.4,5.1      -> frames at these part-local seconds
//   node dev/scene-test.mjs <part> --t=30.5,31         -> frames at these song seconds
// Output: dev/out/part<N>_<i>.jpg and dev/out/part<N>_sheet.jpg. Prints draw time and errors.
import puppeteer from 'puppeteer-core';
import { pathToFileURL, fileURLToPath } from 'url';
import { execFileSync } from 'child_process';
import fs from 'fs';
import path from 'path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const part = +process.argv[2];
if (!(part >= 1 && part <= 7)) { console.error('usage: node dev/scene-test.mjs <part 1-7> [--lt=a,b] [--t=a,b]'); process.exit(1); }
const arg = k => (process.argv.find(a => a.startsWith(`--${k}=`)) || '').split('=')[1];
const outDir = path.join(root, 'dev', 'out'); fs.mkdirSync(outDir, { recursive: true });

const browser = await puppeteer.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: 'new', args: ['--use-angle=d3d11', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'] });
try {
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 720, deviceScaleFactor: 1 });
  const logs = [];
  page.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') { const s = m.text(); if (!/uniform|location is not from/.test(s)) logs.push(s); } });
  page.on('pageerror', e => logs.push('PAGE ERROR: ' + e.message));
  await page.evaluateOnNewDocument(() => { window.RENDER = true; });
  await page.goto(pathToFileURL(path.join(root, 'studio.html')).href, { waitUntil: 'domcontentloaded', timeout: 120000 });
  await page.waitForFunction('window.studioReady === true', { timeout: 60000 });
  const P = await page.evaluate(n => { const p = window.TIMING.parts[n - 1]; return { t0: p.t0, t1: p.t1, name: p.name }; }, part);
  let times;
  if (arg('t')) times = arg('t').split(',').map(Number);
  else if (arg('lt')) times = arg('lt').split(',').map(x => P.t0 + +x);
  else {
    const a = part === 1 ? 0 : P.t0 + 0.6, b = part === 7 ? 149.5 : P.t1 - 0.6;
    times = [0, 1, 2, 3, 4, 5].map(i => a + (b - a) * i / 5);
  }
  const files = [];
  for (let i = 0; i < times.length; i++) {
    const ms = await page.evaluate(t => window.renderFrame(t), times[i]);
    const f = path.join(outDir, `part${part}_${i}.jpg`);
    await page.screenshot({ path: f, type: 'jpeg', quality: 85 });
    files.push(f);
    console.log(`part ${part} "${P.name}" t=${times[i].toFixed(2)}s (local ${(times[i] - P.t0).toFixed(2)}s) draw ${ms.toFixed(0)} ms -> ${path.relative(root, f)}`);
  }
  const errs = await page.evaluate(() => window.SCENE_ERRORS);
  if (errs.length) console.log('SCENE ERRORS:\n  ' + [...new Set(errs)].join('\n  '));
  if (logs.length) console.log('CONSOLE:\n  ' + [...new Set(logs)].slice(0, 20).join('\n  '));
  if (!errs.length && !logs.length) console.log('no errors');
  // contact sheet (3 columns)
  const sheet = path.join(outDir, `part${part}_sheet.jpg`);
  const inputs = files.flatMap(f => ['-i', f]);
  const cols = Math.min(3, files.length), rows = Math.ceil(files.length / cols);
  const scale = files.map((_, i) => `[${i}:v]scale=640:360[s${i}]`).join(';');
  const layout = files.map((_, i) => `${(i % cols) * 640}_${Math.floor(i / cols) * 360}`).join('|');
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', ...inputs, '-filter_complex', `${scale};${files.map((_, i) => `[s${i}]`).join('')}xstack=inputs=${files.length}:layout=${layout}:fill=black`, sheet]);
  console.log('sheet -> ' + path.relative(root, sheet));
} finally {
  await browser.close();
}
