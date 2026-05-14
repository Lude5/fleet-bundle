"""Add Chinese translation support to a client site's admin.

Copies admin_i18n.js to static/js/ and injects a floating language toggle
button + script tag into each admin_*.html template. Non-invasive — preserves
existing admin layout.

Usage:
    python add_admin_i18n.py <site_dir>
"""
import sys, shutil
from pathlib import Path

ROOT = Path(__file__).resolve().parent
KAI = ROOT.parent.parent / 'kai'

FLOATING_TOGGLE = '''
<!-- Admin language toggle (added by master admin) -->
<style>
.adm-lang-fab { position: fixed; bottom: 18px; right: 18px; z-index: 999; display: inline-flex; align-items: center; gap: 6px; padding: 10px 14px; background: rgba(20,20,22,0.95); border: 1px solid rgba(255,255,255,0.15); border-radius: 12px; color: rgba(255,255,255,0.9); font-family: 'Space Grotesk', monospace; font-size: 10px; font-weight: 700; letter-spacing: 1.5px; text-transform: uppercase; cursor: pointer; box-shadow: 0 10px 30px rgba(0,0,0,0.4); backdrop-filter: blur(8px); user-select: none; }
.adm-lang-fab:hover { background: rgba(6,182,212,0.15); border-color: rgba(6,182,212,0.5); color: rgb(6,182,212); }
.adm-lang-fab .arrow { opacity: 0.5; font-size: 11px; }
</style>
<button type="button" class="adm-lang-fab" onclick="toggleAdminLang()" title="Switch language" aria-label="Switch language">
    <span data-lang-label>EN</span><span class="arrow">&#8646;</span><span data-lang-other>中文</span>
</button>
<script src="/static/js/admin_i18n.js"></script>
'''


def patch_html(path):
    src = path.read_text(encoding='utf-8')
    if 'adm-lang-fab' in src:
        return False  # already patched
    if '</body>' in src:
        src = src.replace('</body>', FLOATING_TOGGLE + '\n</body>')
    else:
        src = src + FLOATING_TOGGLE
    path.write_text(src, encoding='utf-8')
    return True


def patch(site_dir):
    site_dir = Path(site_dir)
    # 1. Copy admin_i18n.js
    js_src = KAI / 'static' / 'js' / 'admin_i18n.js'
    js_dst = site_dir / 'static' / 'js' / 'admin_i18n.js'
    js_dst.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(js_src, js_dst)
    print(f'  + {js_dst}')

    # 2. Patch each admin template
    tpl_dir = site_dir / 'templates'
    patched = 0
    for f in sorted(tpl_dir.glob('admin_*.html')):
        if patch_html(f):
            print(f'  + patched {f.name}')
            patched += 1
        else:
            print(f'  - {f.name} already patched')
    return patched


if __name__ == '__main__':
    if len(sys.argv) < 2:
        print('Usage: python add_admin_i18n.py <site_dir>')
        sys.exit(1)
    patch(sys.argv[1])
