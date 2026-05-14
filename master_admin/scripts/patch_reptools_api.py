"""Custom API-auth patch for rep.tools.

rep.tools is a different codebase from the kai template — different DB
function names and a different session key. This script adapts the cross-site
API surface to its conventions.

Usage:
    python patch_reptools_api.py <reptools_app.py_path>
"""
import sys
from pathlib import Path

API_BLOCK = '''


# ===========================================================================
# Cross-site API (used by the master admin) — token auth
# ===========================================================================
ADMIN_API_TOKEN = os.environ.get('ADMIN_API_TOKEN', '')
SITE_NAME = os.environ.get('SITE_NAME', 'RepTools')
AGENT_NAME = os.environ.get('AGENT_NAME', 'KakoBuy')


def _is_admin_api():
    if session.get('admin'):
        return True
    token = request.headers.get('X-Admin-Token') or request.args.get('token')
    return bool(ADMIN_API_TOKEN and token and token == ADMIN_API_TOKEN)


def _flatten_products():
    """rep.tools stores products grouped by category. Flatten for the master."""
    try:
        grouped = db_get_all_products()
    except Exception:
        return []
    flat = []
    if isinstance(grouped, dict):
        for slug, cat in grouped.items():
            if not isinstance(cat, dict):
                continue
            items = cat.get('items') or cat.get('products') or []
            for p in items:
                p = dict(p) if not isinstance(p, dict) else p.copy()
                if not p.get('category'):
                    p['category'] = slug
                flat.append(p)
    elif isinstance(grouped, list):
        flat = grouped
    return flat


@app.route('/admin/api/ping')
def _api_ping():
    return jsonify({
        'ok': True,
        'site': SITE_NAME,
        'agent': AGENT_NAME,
        'token_required': bool(ADMIN_API_TOKEN),
        'token_valid': _is_admin_api(),
    })


@app.route('/admin/api/stats')
def _api_stats():
    if not _is_admin_api():
        return jsonify({'error': 'Unauthorized'}), 401
    days = int(request.args.get('days', 30))
    try:
        s = get_click_stats(days=days)
    except Exception as e:
        s = {'total_clicks': 0, 'unique_visitors': 0, 'top_products': [], 'top_categories': [], 'daily_clicks': []}
    products = _flatten_products()
    # Adapt to the shape the master admin expects
    daily = [{'day': d.get('date'), 'clicks': d.get('clicks', 0), 'visitors': 0} for d in (s.get('daily_clicks') or [])]
    return jsonify({
        'site': SITE_NAME,
        'agent': AGENT_NAME,
        'total_products': len(products),
        'featured_count': 0,
        'categories': len(set(p.get('category') for p in products if p.get('category'))),
        'total_clicks': s.get('total_clicks', 0),
        'unique_visitors': s.get('unique_visitors', 0),
        'signup_clicks': 0,
        'top_products': s.get('top_products', []),
        'top_categories': s.get('top_categories', []),
        'daily': daily,
        'days': days,
    })


@app.route('/admin/api/products')
def _api_products():
    if not _is_admin_api():
        return jsonify({'error': 'Unauthorized'}), 401
    products = _flatten_products()
    return jsonify({'site': SITE_NAME, 'products': products})


@app.route('/admin/api/config')
def _api_config():
    if not _is_admin_api():
        return jsonify({'error': 'Unauthorized'}), 401
    return jsonify({
        'name': SITE_NAME,
        'agent_name': AGENT_NAME,
        'host': request.host,
    })
'''


def patch(path):
    path = Path(path)
    src = path.read_text(encoding='utf-8')
    if '/admin/api/ping' in src:
        print(f'  - already patched, skipping')
        return False
    # Append before `if __name__` block if present, else at end
    needle = "if __name__ == '__main__':"
    if needle in src:
        idx = src.index(needle)
        src = src[:idx] + API_BLOCK + '\n\n' + src[idx:]
    else:
        src = src + API_BLOCK
    path.write_text(src, encoding='utf-8')
    print(f'  + patched {path}')
    return True


if __name__ == '__main__':
    if len(sys.argv) < 2:
        print('Usage: python patch_reptools_api.py <app.py path>')
        sys.exit(1)
    patch(sys.argv[1])
