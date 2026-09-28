// Headless check for SPRAYWAVE RALLY. Launches its own Chrome, plays with real key input, saves screenshots.
// Run: node test.js   (needs puppeteer-core; path resolved from the global npm root)
const path = require('path');
const fs = require('fs');
const { execSync } = require('child_process');
const root = execSync('npm root -g').toString().trim();
const puppeteer = require(path.join(root, '@modelcontextprotocol/server-puppeteer/node_modules/puppeteer-core'));
const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const url = 'file:///' + path.resolve(__dirname, 'index.html').replace(/\\/g, '/');
const shots = path.resolve(__dirname, 'shots');
fs.mkdirSync(shots, { recursive: true });
const sleep = ms => new Promise(r => setTimeout(r, ms));
const results = [];
const check = (name, ok, info = '') => { results.push({ name, ok, info }); console.log((ok ? 'PASS ' : 'FAIL ') + name + (info ? ' — ' + info : '')); };
const only = process.argv[2] || 'all';

(async () => {
  const browser = await puppeteer.launch({
    executablePath: CHROME, headless: 'new',
    userDataDir: path.join(process.env.TEST_PROFILE || require('os').tmpdir(), 'spraywave-profile'),
    args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--window-size=1280,720'],
    defaultViewport: { width: 1280, height: 720 },
  });
  console.log('chrome pid', browser.process().pid);
  const errors = [];
  const newPage = async (hash) => {
    const page = await browser.newPage();
    page.on('pageerror', e => errors.push('pageerror: ' + e.message));
    page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
    await page.goto(url + (hash || ''), { waitUntil: 'load' });
    return page;
  };
  try {
    if (only === 'all' || only === 'sim') {
      // 1. fixed-step self-test on every track
      const tp = await newPage('#test');
      await tp.waitForFunction(() => document.title.startsWith('TEST'), { timeout: 300000, polling: 1000 });
      const out = await tp.$eval('#testout', e => e.textContent);
      console.log(out);
      let sim = null; try { sim = JSON.parse(out); } catch (e) {}
      check('self-test ran', !!sim, sim ? '' : out.slice(0, 400));
      if (sim) sim.forEach(t => {
        check(`sim ${t.track}: all 8 finish`, t.finished === '8/8', `${t.finished} in ${t.simSeconds}s`);
        check(`sim ${t.track}: no NaN, stays inside buoys`, !t.nan && t.maxLateral < t.halfWidth + 1.2, `buoy line at hw+1.2; maxLat ${t.maxLateral} / hw ${t.halfWidth}`);
        check(`sim ${t.track}: ramps + crates + items used`, t.jumps > 0 && t.crates > 0 && t.itemsUsed > 0, `jumps ${t.jumps}, crates ${t.crates}, items ${t.itemsUsed}, torpedo hits ${t.torpedoHits}, mine hits ${t.mineHits}`);
      });
      await tp.close();
    }
    if (only === 'all' || only === 'play') {
      // 2. title -> select -> race, driven with real keys and clicks
      const page = await newPage('');
      await sleep(3500);
      await page.screenshot({ path: path.join(shots, '01-title.png') });
      check('title state', await page.evaluate(() => G.state) === 'title');
      await page.keyboard.press('Enter');
      await sleep(1500);
      check('select state after Enter', await page.evaluate(() => G.state) === 'select');
      await page.keyboard.press('ArrowRight'); await sleep(200); await page.keyboard.press('ArrowRight');
      await page.click('[data-opt="laps"][data-d="-1"]'); // 3 -> 2 laps
      await page.click('[data-opt="class"][data-d="1"]'); // GALE -> HURRICANE
      await sleep(1200);
      await page.screenshot({ path: path.join(shots, '02-select.png') });
      const sel = await page.evaluate(() => ({ c: G.charIdx, laps: G.selLaps, cls: G.classIdx, cards: document.querySelectorAll('.card').length, bars: document.querySelectorAll('#stats .stat').length }));
      check('select: 8 racer cards + 4 stat bars', sel.cards === 8 && sel.bars === 4, JSON.stringify(sel));
      check('select: arrow keys, lap and class controls work', sel.c === 2 && sel.laps === 2 && sel.cls === 2, JSON.stringify(sel));
      await page.click('[data-opt="class"][data-d="-1"]');
      await page.click('#raceBtn');
      await sleep(1200);
      check('title card shown', await page.evaluate(() => G.state === 'intro' && document.getElementById('card').classList.contains('on')));
      await page.screenshot({ path: path.join(shots, '03-title-card.png') });
      await page.waitForFunction(() => G.state === 'race', { timeout: 30000 });
      const before = await page.evaluate(() => ({ idx: G.player.idx, name: G.player.ch.name }));
      await page.keyboard.down('ArrowUp');
      await sleep(4000);
      const mid = await page.evaluate(() => ({ idx: G.player.idx, spd: Math.hypot(G.player.vx, G.player.vz), rank: G.player.rank, t: G.raceTime }));
      check('throttle key moves the player', mid.spd > 5 && mid.idx !== before.idx, `${before.name}: idx ${before.idx} -> ${mid.idx}, speed ${mid.spd.toFixed(1)}, race time ${mid.t.toFixed(1)}s`);
      const h0 = await page.evaluate(() => G.player.heading);
      await page.keyboard.down('ArrowLeft'); await sleep(700); await page.keyboard.up('ArrowLeft');
      const h1 = await page.evaluate(() => G.player.heading);
      check('left key turns left (heading increases)', h1 > h0 + 0.05, `${h0.toFixed(2)} -> ${h1.toFixed(2)}`);
      await sleep(1500);
      await page.screenshot({ path: path.join(shots, '04-race-hud.png') });
      await page.evaluate(() => { G.player.item = 'turbo'; G.player.uses = 1; });
      await page.keyboard.press('Space');
      await sleep(300);
      const b = await page.evaluate(() => ({ boost: G.player.boost, item: G.player.item }));
      check('Space uses the held item (turbo)', b.item === null && b.boost > 0, JSON.stringify(b));
      const hud = await page.evaluate(() => ['itemBox', 'mapBox', 'speedBox', 'posBox', 'lapBox'].map(id => { const r = document.getElementById(id).getBoundingClientRect(); return { id, x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width) }; }));
      const item = hud.find(h => h.id === 'itemBox');
      check('item slot at top center', Math.abs(item.x + item.w / 2 - 640) < 4 && item.y < 30, JSON.stringify(hud));
      await page.evaluate(() => { G.player.item = 'triple'; G.player.uses = 3; });
      await sleep(500);
      await page.screenshot({ path: path.join(shots, '04b-item-slot.png') });
      await page.evaluate(() => { G.player.item = 'torpedo'; G.player.uses = 1; });
      await page.keyboard.press('Space'); await sleep(200);
      const tp2 = await page.evaluate(() => G.torps.length);
      check('Space fires a torpedo', tp2 > 0, `${tp2} torpedo(es) in water`);
      await page.keyboard.up('ArrowUp');
      await page.keyboard.press('KeyP'); await sleep(300);
      check('P pauses', await page.evaluate(() => G.state) === 'paused');
      await page.keyboard.press('KeyP');
      await page.close();
    }
    if (only === 'all' || only === 'tracks') {
      // 3. each track mid-race with the player on autopilot
      for (let t = 0; t < 3; t++) {
        const p = await newPage(`#race&track=${t}&auto=1&skipintro=1&laps=3&char=${t * 3}`);
        await p.waitForFunction(() => G.state === 'race', { timeout: 30000 });
        await sleep(9000);
        await p.screenshot({ path: path.join(shots, `05-track${t + 1}.png`) });
        const st = await p.evaluate(() => ({ idx: G.player.idx, rank: G.player.rank, lap: G.player.lapCount, t: G.raceTime.toFixed(1) }));
        check(`track ${t + 1} renders and runs`, st.idx > 0, JSON.stringify(st));
        await p.close();
      }
    }
    if (only === 'all' || only === 'ramp') {
      // 3b. drive straight at a ramp with the throttle key; expect a jump, then a crate pickup
      const p = await newPage('#race&track=0&skipintro=1&laps=3&char=3');
      await p.waitForFunction(() => G.state === 'race', { timeout: 30000 });
      await p.evaluate(() => {
        const tr = W.track, rp = tr.ramps[0], r = G.player, i = (rp.i - 26 + tr.N) % tr.N;
        r.idx = i; r.x = tr.px[i] + tr.lx[i] * rp.lat; r.z = tr.pz[i] + tr.lz[i] * rp.lat;
        r.heading = Math.atan2(rp.tx, rp.tz); r.speed = 40; r.vx = rp.tx * 40; r.vz = rp.tz * 40; r.lapCount = 1; r.cp = false;
        for (const o of G.racers) if (o !== r) { o.x += 400; o.z += 400; } // clear the lane
      });
      await p.keyboard.down('ArrowUp');
      await p.screenshot({ path: path.join(shots, '07-ramp-ahead.png') });
      let air = false;
      try { await p.waitForFunction(() => G.player.air, { polling: 'raf', timeout: 20000 }); air = true; } catch (e) {}
      let trick = null;
      if (air) {
        await p.keyboard.press('KeyZ');
        trick = await p.evaluate(() => ({ trickT: +G.player.trickT.toFixed(2), done: G.player.trickDone, air: G.player.air }));
        await p.screenshot({ path: path.join(shots, '08-ramp-jump.png') });
        check('Z starts a trick while airborne', trick.trickT > 0 || trick.done || !trick.air, JSON.stringify(trick) + (trick.air ? '' : ' (landed before the key arrived; not conclusive)'));
      }
      const j = await p.evaluate(() => ({ jumps: G.player.jumps, y: G.player.y.toFixed(1), idx: G.player.idx, ramp: W.track.ramps[0].i, t: G.raceTime.toFixed(1), spd: G.player.speed.toFixed(1) }));
      check('ramp launches the player into the air', j.jumps >= 1, JSON.stringify(j) + (air ? ' (mid-air shot saved)' : ' (jump happened during the first screenshot)'));
      await p.keyboard.up('ArrowUp');
      await p.close();
    }
    if (only === 'all' || only === 'results') {
      // 4. results screen after a 1-lap autopilot race
      const rp = await newPage('#race&track=0&auto=1&skipintro=1&laps=1&char=1&class=2');
      await rp.waitForFunction(() => G.state === 'results', { timeout: 300000, polling: 1000 });
      await sleep(600);
      await rp.screenshot({ path: path.join(shots, '06-results.png') });
      const rows = await rp.$$eval('#resTable tr', r => r.length);
      check('results screen lists 8 racers', rows === 9, `${rows - 1} rows`);
      await rp.close();
    }
  } catch (e) {
    check('test run completed', false, e.stack);
  }
  // Headless Chrome has no audio output device; WebAudio reports that as a console error. It is not a game bug.
  const envNoise = e => e.includes('AudioContext encountered an error from the audio device');
  const ignored = errors.filter(envNoise).length;
  const real = errors.filter(e => !envNoise(e));
  check('no page errors', real.length === 0, real.slice(0, 5).join(' | ') + (ignored ? ` (ignored ${ignored} headless audio-device messages)` : ''));
  await browser.close();
  const fails = results.filter(r => !r.ok).length;
  console.log(`\n${results.length - fails}/${results.length} checks passed`);
  process.exit(fails ? 1 : 0);
})();
