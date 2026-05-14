"""Patch a client site to add ADMIN_API_TOKEN + JSON API routes.

Surgical, idempotent. Run once per site directory. Safe to re-run.

Usage:
    python patch_api_auth.py <site_dir>
"""
import sys
from pathlib import Path

API_BLOCK = '''


# ===========================================================================
# Cross-site API (used by the master admin) — token-auth alternative.
# ===========================================================================

@app.route('/admin/api/ping')
def api_ping():
    return jsonify({
        'ok': True,
        'site': SITE_CONFIG.get('name'),
        'agent': SITE_CONFIG.get('agent_name'),
        'token_required': bool(ADMIN_API_TOKEN),
        'token_valid': is_admin_api(),
    })


@app.route('/admin/api/stats')
def api_stats():
    if not is_admin_api():
        return jsonify({'error': 'Unauthorized'}), 401
    from datetime import datetime, timedelta
    days = request.args.get('days', 30, type=int)
    stats = get_analytics(days=days)
    products = get_products()
    return jsonify({
        'site': SITE_CONFIG.get('name'),
        'agent': SITE_CONFIG.get('agent_name'),
        'total_products': len(products),
        'featured_count': sum(1 for p in products if p.get('featured')),
        'categories': len(get_categories()),
        'total_clicks': stats.get('total_clicks', 0),
        'unique_visitors': stats.get('unique_visitors', 0),
        'signup_clicks': stats.get('signup_clicks', 0),
        'top_products': stats.get('top_products', []),
        'top_categories': stats.get('top_categories', []),
        'daily': stats.get('daily', []),
        'days': days,
        'since': (datetime.now() - timedelta(days=days)).isoformat(),
    })


@app.route('/admin/api/products', methods=['GET'])
def api_admin_products():
    if not is_admin_api():
        return jsonify({'error': 'Unauthorized'}), 401
    return jsonify({
        'site': SITE_CONFIG.get('name'),
        'products': get_products(),
    })


@app.route('/admin/api/products', methods=['POST'])
def api_admin_add_product():
    if not is_admin_api():
        return jsonify({'error': 'Unauthorized'}), 401
    data = request.get_json(silent=True) or {}
    if not data.get('name'):
        return jsonify({'error': 'Name required'}), 400
    if not data.get('id'):
        data['id'] = f"p{secrets.token_hex(4)}"
    add_product(data)
    return jsonify({'ok': True, 'id': data['id']})


@app.route('/admin/api/products/<pid>', methods=['PUT', 'PATCH'])
def api_admin_update_product(pid):
    if not is_admin_api():
        return jsonify({'error': 'Unauthorized'}), 401
    data = request.get_json(silent=True) or {}
    if 'price' in data:
        try: data['price_numeric'] = float(data['price'] or 0)
        except (ValueError, TypeError): data['price_numeric'] = 0
    update_product(pid, data)
    return jsonify({'ok': True})


@app.route('/admin/api/products/<pid>', methods=['DELETE'])
def api_admin_delete_product(pid):
    if not is_admin_api():
        return jsonify({'error': 'Unauthorized'}), 401
    delete_product(pid)
    return jsonify({'ok': True})


@app.route('/admin/api/config')
def api_admin_config():
    if not is_admin_api():
        return jsonify({'error': 'Unauthorized'}), 401
    safe = {k: v for k, v in SITE_CONFIG.items() if 'token' not in k.lower() and 'secret' not in k.lower()}
    return jsonify(safe)
'''


HELPER_BLOCK = '''
ADMIN_API_TOKEN = os.environ.get('ADMIN_API_TOKEN', '')


def is_admin_api():
    """Either a logged-in admin session OR a valid X-Admin-Token header."""
    if session.get('admin_logged_in', False):
        return True
    token = request.headers.get('X-Admin-Token') or request.args.get('token')
    return bool(ADMIN_API_TOKEN and token and token == ADMIN_API_TOKEN)
'''


def patch(site_dir):
    site_dir = Path(site_dir)
    app_py = site_dir / 'app.py'
    if not app_py.exists():
        print(f'  ! {app_py} not found')
        return False
    src = app_py.read_text(encoding='utf-8')

    if 'ADMIN_API_TOKEN' in src and '/admin/api/ping' in src:
        print(f'  - already patched, skipping')
        return True

    # Add ADMIN_API_TOKEN line + is_admin_api helper right after ADMIN_PASSWORD line.
    needle = 'ADMIN_PASSWORD = os.environ.get('
    if needle not in src:
        print(f'  ! could not find ADMIN_PASSWORD line; skipping')
        return False
    # Insert helpers after the ADMIN_PASSWORD line block (find end of that line)
    idx = src.index(needle)
    line_end = src.index('\n', idx) + 1
    src = src[:line_end] + HELPER_BLOCK + src[line_end:]

    # Make sure update_product is imported (john's app.py lacks it).
    if 'update_product' not in src:
        src = src.replace(
            'delete_product, search_products',
            'update_product, delete_product, search_products',
        )

    # Append the API block at the end of the file (or before `if __name__` if present).
    if "if __name__ == '__main__':" in src:
        idx = src.index("if __name__ == '__main__':")
        src = src[:idx] + API_BLOCK + '\n\n' + src[idx:]
    else:
        src = src + API_BLOCK

    app_py.write_text(src, encoding='utf-8')
    print(f'  + patched {app_py}')
    return True


if __name__ == '__main__':
    if len(sys.argv) < 2:
        print('Usage: python patch_api_auth.py <site_dir>')
        sys.exit(1)
    ok = patch(sys.argv[1])
    sys.exit(0 if ok else 1)
