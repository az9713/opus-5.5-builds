// Bench: draw time vs screenshot time, and a determinism check (same frame twice + in a second browser).
import puppeteer from 'puppeteer-core';
import { pathToFileURL, fileURLToPath } from 'url';
import crypto from 'crypto';
import path from 'path';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const T = +(process.argv[2] || 20), T2 = +(process.argv[3] || T + 1 / 24);
async function open() {
  const b = await puppeteer.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: 'new', args: ['--use-angle=d3d11', '--ignore-gpu-blocklist', '--mute-audio'] });
  const p = await b.newPage(); await p.setViewport({ width: 1280, height: 720, deviceScaleFactor: 1 });
  await p.evaluateOnNewDocument(() => { window.RENDER = true; });
  await p.goto(pathToFileURL(path.join(root, 'studio.html')).href, { waitUntil: 'domcontentloaded', timeout: 120000 }); await p.waitForFunction('window.studioReady === true');
  return [b, p];
}
const md5 = buf => crypto.createHash('md5').update(buf).digest('hex').slice(0, 10);
const [b1, p1] = await open();
let dr = 0, sh = 0;
for (let i = 0; i < 8; i++) {
  const a = Date.now(); await p1.evaluate(t => window.renderFrame(t), T + i / 24); dr += Date.now() - a;
  const c = Date.now(); await p1.screenshot({ type: 'jpeg', quality: 92, optimizeForSpeed: true }); sh += Date.now() - c;
}
console.log(`draw ${(dr / 8).toFixed(0)} ms, screenshot ${(sh / 8).toFixed(0)} ms per frame`);
const shot = async (p, t) => { await p.evaluate(t => window.renderFrame(t), t); return md5(await p.screenshot({ type: 'png' })); };
const a = await shot(p1, T), bb = await shot(p1, T2), c = await shot(p1, T);
const [b2, p2] = await open();
const d = await shot(p2, T);
console.log(`frame ${T}: first ${a}, after ${T2} again ${c}, second browser ${d} -> ${a === c && a === d ? 'DETERMINISTIC' : 'DIFFERENT'} (neighbour ${bb})`);
await b1.close(); await b2.close();
