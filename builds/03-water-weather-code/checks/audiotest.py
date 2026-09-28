# Opens index.html?audiotest in headless Chrome, waits for the offline render, prints the stats.
import pathlib, sys
from playwright.sync_api import sync_playwright
url = pathlib.Path(__file__).resolve().parent.parent.joinpath('index.html').as_uri() + '?audiotest'
with sync_playwright() as p:
    b = p.chromium.launch(channel='chrome', headless=True)
    pg = b.new_page()
    errs = []
    pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.goto(url, wait_until='commit', timeout=120000)
    pg.wait_for_selector('#result', timeout=240000)
    print(pg.inner_text('#result'))
    print('page errors:', errs)
    b.close()
