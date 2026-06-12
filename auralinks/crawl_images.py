"""Slow, resilient Weidian image crawler for the spreadsheet import.

Fetches product gallery images for every itemID the importer needs, at a rate
Weidian tolerates. Resumable: successes persist to static/enrich_cache.json
(same cache the importer reads); failures are retried with escalating cooldowns.
Run detached; progress + heartbeat go to crawl_images.log.
"""
import json, os, re, sys, time, random, threading
import urllib.request
from urllib.parse import quote

HERE = os.path.dirname(os.path.abspath(__file__))
CACHE = os.path.join(HERE, 'static', 'enrich_cache.json')
PIDS = os.path.join(HERE, 'static', 'enrich_pids.json')
LOG = os.path.join(HERE, 'crawl_images.log')
DONEFLAG = os.path.join(HERE, 'crawl_images.done')

WORKERS = 3
DELAY = (1.0, 2.0)          # jittered per-request delay per worker
COOLDOWN_AFTER = 15          # consecutive hard failures -> cool down
COOLDOWN_S = 480             # 8 min
MAX_HOURS = 6

_IMG_JUNK = ('wx_default_headimg', 'hz_img_', 'icon-', '/avatar', 'login_', 'wd_logo', 'common-')
_IMG_RE = re.compile(r'https?://[a-z]+\.geilicdn\.com/(?:pcitem|open)[^"\'\\\s&]+?\.(?:jpg|jpeg|png|webp)[^"\'\\\s&]*')
UA = {'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Mobile/15E148 Safari/604.1'}

def log(msg):
    line = f'[{time.strftime("%H:%M:%S")}] {msg}'
    print(line, flush=True)
    with open(LOG, 'a', encoding='utf-8') as f:
        f.write(line + '\n')

def fetch(pid):
    """Returns list of images, [] for genuine empty, None for hard failure."""
    try:
        req = urllib.request.Request(f'https://weidian.com/item.html?itemID={pid}', headers=UA)
        with urllib.request.urlopen(req, timeout=15) as r:
            html = r.read().decode('utf-8', 'ignore')
        imgs, seen = [], set()
        for u in _IMG_RE.findall(html):
            if any(j in u for j in _IMG_JUNK) or u in seen:
                continue
            seen.add(u); imgs.append(u)
            if len(imgs) >= 10:
                break
        return imgs
    except Exception:
        return None

def main():
    pids = json.load(open(PIDS, encoding='utf-8'))
    try:
        cache = json.load(open(CACHE, encoding='utf-8'))
    except Exception:
        cache = {}
    cache = {k: v for k, v in cache.items() if v}
    todo = [p for p in pids if p not in cache]
    log(f'start: {len(todo)} to fetch, {len(cache)} cached')

    lock = threading.Lock()
    state = {'fail_streak': 0, 'ok': 0, 'fail': 0, 'empty': 0, 'i': 0}
    deadline = time.time() + MAX_HOURS * 3600

    def worker():
        while time.time() < deadline:
            with lock:
                if state['i'] >= len(todo):
                    return
                pid = todo[state['i']]; state['i'] += 1
            r = fetch(pid)
            with lock:
                if r:
                    cache[pid] = r; state['ok'] += 1; state['fail_streak'] = 0
                elif r == []:
                    state['empty'] += 1; state['fail_streak'] = 0
                else:
                    state['fail'] += 1; state['fail_streak'] += 1
                n = state['ok'] + state['empty'] + state['fail']
                if n % 100 == 0:
                    log(f"progress {n}/{len(todo)} ok={state['ok']} empty={state['empty']} fail={state['fail']}")
                    json.dump(cache, open(CACHE, 'w', encoding='utf-8'))
                cool = state['fail_streak'] >= COOLDOWN_AFTER
                if cool:
                    state['fail_streak'] = 0
            if cool:
                log(f'cooldown {COOLDOWN_S}s (rate limited)')
                json.dump(cache, open(CACHE, 'w', encoding='utf-8'))
                time.sleep(COOLDOWN_S)
            time.sleep(random.uniform(*DELAY))

    threads = [threading.Thread(target=worker, daemon=True) for _ in range(WORKERS)]
    for t in threads: t.start()
    for t in threads: t.join()
    json.dump(cache, open(CACHE, 'w', encoding='utf-8'))

    # retry pass for hard failures (pids still missing), single-threaded gentle
    missing = [p for p in pids if p not in cache]
    log(f'first pass done: cached={len(cache)} missing={len(missing)}')
    for pid in missing:
        if time.time() > deadline: break
        r = fetch(pid)
        if r:
            cache[pid] = r
        time.sleep(random.uniform(1.5, 2.5))
        if len(cache) % 100 == 0:
            json.dump(cache, open(CACHE, 'w', encoding='utf-8'))
    json.dump(cache, open(CACHE, 'w', encoding='utf-8'))
    final_missing = len([p for p in pids if p not in cache])
    log(f'DONE: cached={len(cache)} still-missing={final_missing}')
    open(DONEFLAG, 'w').write(f'{len(cache)} cached, {final_missing} missing\n')

if __name__ == '__main__':
    main()
