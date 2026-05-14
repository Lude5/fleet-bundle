"""Insert SITE_CONFIG fallback dict right after ADMIN_API_TOKEN."""
import sys, pathlib

OLD = "ADMIN_API_TOKEN = os.environ.get('ADMIN_API_TOKEN', '')"
NEW = """ADMIN_API_TOKEN = os.environ.get('ADMIN_API_TOKEN', '')

# Site identity used by the cross-site API (falls back if SITE_CONFIG missing)
try:
    SITE_CONFIG  # noqa: F821
except NameError:
    SITE_CONFIG = {
        'name': os.environ.get('SITE_NAME', 'Site'),
        'agent_name': os.environ.get('AGENT_NAME', 'KakoBuy'),
    }"""

p = pathlib.Path(sys.argv[1])
src = p.read_text(encoding='utf-8')
if 'SITE_CONFIG  # noqa' in src:
    print('  already patched, skipping')
elif OLD in src:
    p.write_text(src.replace(OLD, NEW), encoding='utf-8')
    print(f'  + patched {p}')
else:
    print(f'  ! ADMIN_API_TOKEN line not found in {p}')
    sys.exit(1)
