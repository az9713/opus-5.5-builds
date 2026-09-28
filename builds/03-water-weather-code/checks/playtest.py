# Clicks Play in headless Chrome, checks the audio clock drives the film, pause works, and times draw() per scene.
import pathlib, time
from playwright.sync_api import sync_playwright
here = pathlib.Path(__file__).resolve().parent
url = here.parent.joinpath('index.html').as_uri()
with sync_playwright() as p:
    b = p.chromium.launch(channel='chrome', headless=True, args=['--autoplay-policy=no-user-gesture-required'])
    pg = b.new_page(viewport={'width': 1280, 'height': 720})
    errs = []; pg.on('pageerror', lambda e: errs.append(str(e))); pg.on('console', lambda m: m.type == 'error' and errs.append(m.text))
    pg.goto(url, wait_until='commit', timeout=120000); pg.wait_for_selector('#play', timeout=120000); pg.wait_for_timeout(1500)
    print('overlay visible before click:', pg.evaluate("!document.getElementById('ui').classList.contains('hide')"))
    pg.click('#play'); pg.wait_for_timeout(4000)
    print('after 4 s: state=%s filmTime=%.2f scheduledNotes=%d' % tuple(pg.evaluate("[ac.state, filmTime(), idx]")))
    pg.screenshot(path=str(here / 'play_4s.png'))
    pg.keyboard.press('Space'); pg.wait_for_timeout(300); a = pg.evaluate("[ac.state, filmTime()]")
    pg.wait_for_timeout(1500); b2 = pg.evaluate("[ac.state, filmTime()]")
    print('paused:', a, '-> 1.5 s later', b2)
    pg.keyboard.press('Space'); pg.wait_for_timeout(1000); print('resumed:', pg.evaluate("[ac.state, filmTime()]"))
    ms = pg.evaluate("""() => S.map(s => { const t = s.start + s.dur / 2; const t0 = performance.now(); for (let i = 0; i < 30; i++) draw(t + i / 60); return [s.id, +((performance.now() - t0) / 30).toFixed(2)]; })""")
    print('draw() ms per frame at mid-scene (1280x720):', ms)
    print('page errors:', errs)
    b.close()
