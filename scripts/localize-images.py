#!/usr/bin/env python3
"""
Localize images from the live maia-seven.com build into ./images/.

The live site is a React SPA (Vite), so image URLs only exist after the
bundle runs. This script renders the page in headless Chromium, collects
every <img src>, <source srcset> and CSS background-image, downloads them
to images/source/, then lets you map each one to the filename the replica
expects (images/manifest.json).

  pip install playwright requests
  python -m playwright install chromium
  python scripts/localize-images.py            # download + interactive mapping
  python scripts/localize-images.py --no-map   # download only
"""
import json, os, re, sys, mimetypes, urllib.parse
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
IMG = ROOT / "images"
SRC = IMG / "source"
SITE = "https://www.maia-seven.com/"

def collect_urls():
    from playwright.sync_api import sync_playwright
    urls = set()
    with sync_playwright() as p:
        b = p.chromium.launch()
        pg = b.new_page(viewport={"width": 1440, "height": 900})
        pg.on("response", lambda r: urls.add(r.url) if (r.headers.get("content-type", "").startswith("image/")) else None)
        pg.goto(SITE, wait_until="networkidle", timeout=90000)
        # scroll to trigger lazy images
        h = pg.evaluate("document.body.scrollHeight")
        for y in range(0, h, 600):
            pg.evaluate(f"window.scrollTo(0,{y})"); pg.wait_for_timeout(250)
        pg.wait_for_timeout(1500)
        dom = pg.evaluate("""() => {
          const out = new Set();
          document.querySelectorAll('img').forEach(i => { if (i.currentSrc||i.src) out.add(i.currentSrc||i.src); });
          document.querySelectorAll('*').forEach(el => {
            const bg = getComputedStyle(el).backgroundImage;
            const m = bg && bg.match(/url\\(["']?(.*?)["']?\\)/g);
            if (m) m.forEach(u => out.add(u.replace(/url\\(["']?|["']?\\)/g,'')));
          });
          return [...out];
        }""")
        for u in dom: urls.add(urllib.parse.urljoin(SITE, u))
        b.close()
    return sorted(u for u in urls if not u.startswith("data:") and "googletagmanager" not in u)

def download(urls):
    import requests
    SRC.mkdir(parents=True, exist_ok=True)
    saved = []
    for i, u in enumerate(urls, 1):
        try:
            r = requests.get(u, timeout=30); r.raise_for_status()
            ext = mimetypes.guess_extension(r.headers.get("content-type", "").split(";")[0]) or Path(urllib.parse.urlparse(u).path).suffix or ".bin"
            name = f"{i:02d}-{Path(urllib.parse.urlparse(u).path).stem or 'image'}{ext}"
            (SRC / name).write_bytes(r.content); saved.append((name, u, len(r.content)))
            print(f"  saved {name}  ({len(r.content)//1024} KB)  <- {u}")
        except Exception as e:
            print(f"  FAILED {u}: {e}")
    return saved

def interactive_map(saved):
    manifest = json.loads((IMG / "manifest.json").read_text())
    print("\nMap downloaded files to the filenames the replica expects.")
    print("Open images/source/ in a file browser to see them. Press Enter to skip.\n")
    for target, desc in manifest.items():
        for k, (n, u, _) in enumerate(saved, 1): print(f"  [{k}] {n}")
        pick = input(f"\n{target}  — {desc}\n  choose #: ").strip()
        if pick.isdigit() and 0 < int(pick) <= len(saved):
            src = SRC / saved[int(pick)-1][0]
            (IMG / target).write_bytes(src.read_bytes()); print(f"  -> wrote images/{target}")

if __name__ == "__main__":
    print("Collecting image URLs from", SITE)
    urls = collect_urls(); print(f"Found {len(urls)} images"); saved = download(urls)
    (SRC / "urls.json").write_text(json.dumps(saved, indent=2))
    if "--no-map" not in sys.argv and saved: interactive_map(saved)
    print("\nDone. Placeholders in images/ can now be replaced/renamed as needed.")
