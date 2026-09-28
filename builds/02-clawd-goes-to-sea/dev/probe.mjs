import puppeteer from 'puppeteer-core';
import { pathToFileURL } from 'url';
const b = await puppeteer.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: 'new', args: ['--use-angle=d3d11', '--ignore-gpu-blocklist'] });
const p = await b.newPage(); await p.setViewport({ width: 1280, height: 720 });
p.on('pageerror', e => console.log('E:', e.message));
await p.goto(pathToFileURL(process.argv[2] || 'probe.html').href); await p.waitForFunction('window.ready');
console.log(await p.evaluate('go()')); await p.screenshot({ path: 'probe.png' }); await b.close();
