import puppeteer from 'puppeteer-core';
import { pathToFileURL } from 'url';
const b = await puppeteer.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: 'new', args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist'] });
const p = await b.newPage(); await p.setViewport({ width: 1280, height: 720 });
p.on('console', m => console.log('C:', m.text())); p.on('pageerror', e => console.log('E:', e.message));
await p.goto(pathToFileURL('perf.html').href); await p.waitForFunction('window.ready');
for (const m of ['wash', 'fill', 'wash', 'fill']) console.log(m, (await p.evaluate(`time('${m}')`)).toFixed(1), 'ms');
const t0 = Date.now(); for (let i = 0; i < 5; i++) await p.screenshot({ path: 'perf.jpg', type: 'jpeg', quality: 90 }); console.log('shot', (Date.now() - t0) / 5, 'ms');
await b.close();
