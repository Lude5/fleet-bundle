import sqlite3
import os
import json
import shutil
from datetime import datetime, timedelta

DB_PATH = '/data/site.db' if os.path.exists('/data') else 'site.db'
BACKUP_DIR = '/data/backups' if os.path.exists('/data') else 'data/backups'


def get_db():
    os.makedirs(os.path.dirname(DB_PATH) if os.path.dirname(DB_PATH) else '.', exist_ok=True)
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute("PRAGMA foreign_keys=ON")
    return conn


def init_db():
    conn = get_db()
    conn.executescript('''
        CREATE TABLE IF NOT EXISTS products (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            price TEXT DEFAULT '',
            price_numeric REAL DEFAULT 0,
            url TEXT DEFAULT '',
            image TEXT DEFAULT '',
            category TEXT DEFAULT '',
            seller TEXT DEFAULT '',
            rating REAL DEFAULT 0,
            batch TEXT DEFAULT '',
            retail_price TEXT DEFAULT '',
            review_count INTEGER DEFAULT 0,
            tags TEXT DEFAULT '',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS categories (
            slug TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            icon TEXT DEFAULT '',
            description TEXT DEFAULT '',
            sort_order INTEGER DEFAULT 0
        );

        CREATE TABLE IF NOT EXISTS clicks (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            product_id TEXT,
            product_name TEXT DEFAULT '',
            category TEXT DEFAULT '',
            element_type TEXT DEFAULT '',
            page TEXT DEFAULT '',
            referrer TEXT DEFAULT '',
            user_ip TEXT DEFAULT '',
            user_agent TEXT DEFAULT '',
            country TEXT DEFAULT '',
            clicked_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS daily_stats (
            date TEXT PRIMARY KEY,
            total_clicks INTEGER DEFAULT 0,
            unique_visitors INTEGER DEFAULT 0,
            top_product TEXT DEFAULT '',
            top_category TEXT DEFAULT '',
            page_views INTEGER DEFAULT 0,
            signup_clicks INTEGER DEFAULT 0,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );

        CREATE INDEX IF NOT EXISTS idx_clicks_product ON clicks(product_id);
        CREATE INDEX IF NOT EXISTS idx_clicks_date ON clicks(clicked_at);
        CREATE INDEX IF NOT EXISTS idx_clicks_category ON clicks(category);
        CREATE INDEX IF NOT EXISTS idx_clicks_page ON clicks(page);
        CREATE INDEX IF NOT EXISTS idx_clicks_element ON clicks(element_type);

        CREATE TABLE IF NOT EXISTS api_cache (
            key TEXT PRIMARY KEY,
            value TEXT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS site_settings (
            key TEXT PRIMARY KEY,
            value TEXT NOT NULL DEFAULT '',
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
    ''')
    # Migrations for older DBs
    for col, ddl in [
        ('tags',       'ALTER TABLE products ADD COLUMN tags TEXT DEFAULT ""'),
        ('featured',   'ALTER TABLE products ADD COLUMN featured INTEGER DEFAULT 0'),
        ('position',   'ALTER TABLE products ADD COLUMN position INTEGER DEFAULT 999999'),
        ('listing_id', 'ALTER TABLE products ADD COLUMN listing_id TEXT DEFAULT ""'),
        ('weight',     'ALTER TABLE products ADD COLUMN weight TEXT DEFAULT ""'),
        ('quality',    'ALTER TABLE products ADD COLUMN quality TEXT DEFAULT ""'),
        ('sales',      'ALTER TABLE products ADD COLUMN sales INTEGER DEFAULT 0'),
        ('qc_photos',  'ALTER TABLE products ADD COLUMN qc_photos TEXT DEFAULT ""'),
        ('in_stock',   'ALTER TABLE products ADD COLUMN in_stock INTEGER DEFAULT 1'),
        ('variants',   'ALTER TABLE products ADD COLUMN variants TEXT DEFAULT ""'),
        ('edited',     'ALTER TABLE products ADD COLUMN edited INTEGER DEFAULT 0'),
        ('images',     'ALTER TABLE products ADD COLUMN images TEXT DEFAULT ""'),
        ('manual',     'ALTER TABLE products ADD COLUMN manual INTEGER DEFAULT 0'),
    ]:
        try:
            conn.execute(ddl)
        except Exception:
            pass
    conn.execute('CREATE INDEX IF NOT EXISTS idx_products_order ON products(featured DESC, position ASC, created_at DESC)')
    conn.execute('CREATE INDEX IF NOT EXISTS idx_products_listing ON products(listing_id)')
    conn.close()


def count_products():
    """Fast live product count (for the dynamic '<n>+ finds' labels)."""
    try:
        conn = get_db()
        n = conn.execute('SELECT COUNT(*) FROM products').fetchone()[0]
        conn.close()
        return int(n or 0)
    except Exception:
        return 0


# --- Editable site settings (hero, nav, footer, branding, theme) -------------
def get_all_settings():
    """Return every site setting as a plain dict (empty dict if none/missing)."""
    try:
        conn = get_db()
        rows = conn.execute('SELECT key, value FROM site_settings').fetchall()
        conn.close()
        return {r['key']: r['value'] for r in rows}
    except Exception:
        return {}


def set_settings(updates):
    """Upsert a dict of {key: value} settings. Returns count written."""
    conn = get_db()
    n = 0
    for k, v in (updates or {}).items():
        conn.execute(
            'INSERT INTO site_settings (key, value, updated_at) VALUES (?, ?, CURRENT_TIMESTAMP) '
            'ON CONFLICT(key) DO UPDATE SET value=excluded.value, updated_at=CURRENT_TIMESTAMP',
            (str(k), '' if v is None else str(v))
        )
        n += 1
    conn.commit()
    conn.close()
    return n


SHOP_ORDER = 'featured DESC, position ASC, created_at DESC'


def get_products(category=None):
    conn = get_db()
    if category:
        rows = conn.execute(
            f'SELECT * FROM products WHERE category = ? ORDER BY {SHOP_ORDER}',
            (category,)
        ).fetchall()
    else:
        rows = conn.execute(f'SELECT * FROM products ORDER BY {SHOP_ORDER}').fetchall()
    conn.close()
    return [dict(r) for r in rows]


def get_product(product_id):
    conn = get_db()
    row = conn.execute('SELECT * FROM products WHERE id = ?', (product_id,)).fetchone()
    conn.close()
    return dict(row) if row else None


def get_listing_variants(product):
    """Return all products sharing this product's listing_id (its variants/colorways).

    Falls back to the product's own URL if listing_id isn't set yet. The returned
    list includes the product itself, ordered with featured + position.
    """
    if not product:
        return []
    listing_id = (product.get('listing_id') or '').strip()
    conn = get_db()
    if listing_id:
        rows = conn.execute(
            f'SELECT * FROM products WHERE listing_id = ? ORDER BY {SHOP_ORDER}',
            (listing_id,)
        ).fetchall()
    else:
        # Fallback: products with the same purchase URL
        url = product.get('url') or ''
        if url and 'placeholder' not in url:
            rows = conn.execute(
                f'SELECT * FROM products WHERE url = ? ORDER BY {SHOP_ORDER}',
                (url,)
            ).fetchall()
        else:
            rows = [conn.execute('SELECT * FROM products WHERE id = ?', (product['id'],)).fetchone()]
            rows = [r for r in rows if r]
    conn.close()
    return [dict(r) for r in rows]


def add_product(product):
    conn = get_db()
    conn.execute('''
        INSERT OR REPLACE INTO products (id, name, price, price_numeric, url, image, category, seller, rating, batch, retail_price, review_count, tags, manual, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    ''', (
        product.get('id', ''),
        product.get('name', ''),
        product.get('price', ''),
        float(product.get('price_numeric', 0) or 0),
        product.get('url', ''),
        product.get('image', ''),
        product.get('category', ''),
        product.get('seller', ''),
        float(product.get('rating', 0) or 0),
        product.get('batch', ''),
        product.get('retail_price', ''),
        int(product.get('review_count', 0) or 0),
        product.get('tags', ''),
        int(product.get('manual', 0) or 0),
    ))
    conn.commit()
    conn.close()


def add_products_bulk(products):
    conn = get_db()
    for p in products:
        conn.execute('''
            INSERT OR REPLACE INTO products (id, name, price, price_numeric, url, image, category, seller, rating, batch, retail_price, review_count, tags, manual, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
        ''', (
            p.get('id', ''),
            p.get('name', ''),
            p.get('price', ''),
            float(p.get('price_numeric', 0) or 0),
            p.get('url', ''),
            p.get('image', ''),
            p.get('category', ''),
            p.get('seller', ''),
            float(p.get('rating', 0) or 0),
            p.get('batch', ''),
            p.get('retail_price', ''),
            int(p.get('review_count', 0) or 0),
            p.get('tags', ''),
            int(p.get('manual', 0) or 0),
        ))
    conn.commit()
    conn.close()


def update_product(product_id, updates):
    conn = get_db()
    allowed = ['name', 'price', 'price_numeric', 'url', 'image', 'category', 'seller', 'rating', 'batch', 'retail_price', 'tags', 'featured', 'position', 'in_stock', 'weight', 'quality', 'sales', 'qc_photos', 'variants', 'images', 'manual']
    sets = []
    vals = []
    for key in allowed:
        if key in updates:
            sets.append(f'{key} = ?')
            vals.append(updates[key])
    if not sets:
        conn.close()
        return
    sets.append('updated_at = CURRENT_TIMESTAMP')
    sets.append('edited = 1')  # mark operator-edited so a reseed never wipes this product's work
    vals.append(product_id)
    conn.execute(f'UPDATE products SET {", ".join(sets)} WHERE id = ?', vals)
    conn.commit()
    conn.close()


def delete_product(product_id):
    conn = get_db()
    conn.execute('DELETE FROM products WHERE id = ?', (product_id,))
    conn.commit()
    conn.close()


def set_featured(product_ids, featured):
    """Pin/unpin multiple products."""
    if not product_ids:
        return 0
    conn = get_db()
    qmarks = ','.join('?' * len(product_ids))
    conn.execute(
        f'UPDATE products SET featured = ?, updated_at = CURRENT_TIMESTAMP WHERE id IN ({qmarks})',
        (1 if featured else 0, *product_ids)
    )
    n = conn.total_changes
    conn.commit()
    conn.close()
    return n


def move_category(product_ids, category):
    """Bulk-move products to a different category."""
    if not product_ids:
        return 0
    conn = get_db()
    qmarks = ','.join('?' * len(product_ids))
    conn.execute(
        f'UPDATE products SET category = ?, updated_at = CURRENT_TIMESTAMP WHERE id IN ({qmarks})',
        (category, *product_ids)
    )
    n = conn.total_changes
    conn.commit()
    conn.close()
    return n


def reorder_products(ordered_ids):
    """Assign positions 1..N in the given order. Products not in the list keep their existing position."""
    if not ordered_ids:
        return 0
    conn = get_db()
    for i, pid in enumerate(ordered_ids, start=1):
        conn.execute('UPDATE products SET position = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', (i, pid))
    conn.commit()
    n = len(ordered_ids)
    conn.close()
    return n


def search_products(query):
    """Extensive fuzzy product search:
      - shorthand expansion: j4 -> "jordan 4", af1 -> "air force 1", am90 -> "air max 90"
      - number-aware: "jordan 4" matches Jordan 4s (the old tokenizer dropped bare numbers)
      - brand aliases (lv, yzy, crtz, tnf, aj, ...) resolved via tags
      - typo tolerance as a fallback so misspellings ("balencaga") still resolve
    Each query GROUP (a word or expanded phrase) must appear in name/tags/seller/
    category (OR within a group, AND across groups); name matches rank highest.
    """
    try:
        from tag_utils import expand_search_query, fuzzy_correct_groups, get_search_vocab, set_search_vocab
    except ImportError:
        from .tag_utils import expand_search_query, fuzzy_correct_groups, get_search_vocab, set_search_vocab

    groups = expand_search_query(query)
    if not groups:
        return []
    conn = get_db()

    def run(grps):
        rel_parts, where_parts, rel_params, where_params = [], [], [], []
        for group in grps:
            # spaces in a phrase become '_' (LIKE single-char wildcard) so the
            # separator can be a space, NEWLINE, or hyphen — "jordan 4" still
            # matches "Jordan\n4" / "off white" matches "off-white" — without the
            # gap-matching that would wrongly let "jordan 4" hit "Jordan 14".
            likes = ['%' + a.lower().replace(' ', '_') + '%' for a in group]
            name_or = ' OR '.join('LOWER(name) LIKE ?' for _ in likes)
            tag_or = ' OR '.join('LOWER(tags) LIKE ?' for _ in likes)
            rel_parts.append(f'(CASE WHEN ({name_or}) THEN 3 WHEN ({tag_or}) THEN 1 ELSE 0 END)')
            rel_params.extend(likes)   # name ORs
            rel_params.extend(likes)   # tag ORs
            field_or = ' OR '.join(
                '(LOWER(name) LIKE ? OR LOWER(tags) LIKE ? OR LOWER(seller) LIKE ? OR LOWER(category) LIKE ?)'
                for _ in likes)
            where_parts.append('(' + field_or + ')')
            for lk in likes:
                where_params.extend([lk, lk, lk, lk])
        sql = (f'SELECT *, ({" + ".join(rel_parts)}) AS relevance FROM products '
               f'WHERE {" AND ".join(where_parts)} ORDER BY relevance DESC, {SHOP_ORDER}')
        return [dict(r) for r in conn.execute(sql, rel_params + where_params).fetchall()]

    results = run(groups)
    # Typo fallback: only when the exact/shorthand pass found very little, correct
    # unknown words against the product vocabulary and search again.
    if len(results) < 3:
        vocab = get_search_vocab()
        if vocab is None:
            vocab = set_search_vocab([dict(r) for r in conn.execute('SELECT name, tags FROM products').fetchall()])
        fz, changed = fuzzy_correct_groups(groups, vocab)
        if changed:
            seen = {r['id'] for r in results}
            for r in run(fz):
                if r['id'] not in seen:
                    results.append(r)
                    seen.add(r['id'])
    conn.close()
    return results


def get_categories():
    conn = get_db()
    rows = conn.execute('SELECT * FROM categories ORDER BY sort_order').fetchall()
    conn.close()
    return [dict(r) for r in rows]


def add_category(slug, name, icon='', description='', sort_order=0):
    conn = get_db()
    conn.execute('''
        INSERT OR REPLACE INTO categories (slug, name, icon, description, sort_order)
        VALUES (?, ?, ?, ?, ?)
    ''', (slug, name, icon, description, sort_order))
    conn.commit()
    conn.close()


def update_category(old_slug, updates):
    """Update a category's name/icon/sort_order, and optionally rename its slug
    (which also rewrites every product currently in that category)."""
    conn = get_db()
    new_slug = (updates.get('slug') or old_slug).strip().lower()
    fields, values = [], []
    if 'slug' in updates and new_slug != old_slug:
        fields.append('slug = ?'); values.append(new_slug)
    for k in ('name', 'icon', 'description'):
        if k in updates:
            fields.append(f'{k} = ?'); values.append(updates[k])
    if 'sort_order' in updates:
        fields.append('sort_order = ?'); values.append(int(updates['sort_order'] or 0))
    if fields:
        values.append(old_slug)
        conn.execute(f'UPDATE categories SET {", ".join(fields)} WHERE slug = ?', tuple(values))
    if new_slug != old_slug:
        conn.execute('UPDATE products SET category = ? WHERE category = ?', (new_slug, old_slug))
    conn.commit()
    conn.close()
    return new_slug


def delete_category(slug, reassign_to=''):
    """Delete a category. Products in it get reassigned to reassign_to
    (default empty string = uncategorized)."""
    conn = get_db()
    conn.execute('UPDATE products SET category = ? WHERE category = ?', (reassign_to, slug))
    conn.execute('DELETE FROM categories WHERE slug = ?', (slug,))
    conn.commit()
    conn.close()


def count_products_in_category(slug):
    conn = get_db()
    row = conn.execute('SELECT COUNT(*) AS n FROM products WHERE category = ?', (slug,)).fetchone()
    conn.close()
    return int(row['n']) if row else 0


def get_top_clicked_products(limit=75, days=30):
    """Return the top N products by click count over the last N days.
    Used by the /shop?category=trending route to derive 'trending' from real
    user behaviour instead of a manual tag."""
    conn = get_db()
    from datetime import datetime, timedelta
    since = (datetime.now() - timedelta(days=days)).isoformat()
    rows = conn.execute(f'''
        SELECT p.*, COUNT(c.id) AS click_count
        FROM products p
        JOIN clicks c ON c.product_id = p.id
        WHERE c.clicked_at >= ?
        GROUP BY p.id
        ORDER BY click_count DESC, {SHOP_ORDER}
        LIMIT ?
    ''', (since, limit)).fetchall()
    conn.close()
    return [dict(r) for r in rows]


def set_in_stock(product_ids, in_stock):
    """Toggle in_stock for one or many product IDs. Returns count changed."""
    if not product_ids:
        return 0
    conn = get_db()
    qmarks = ','.join('?' * len(product_ids))
    conn.execute(
        f'UPDATE products SET in_stock = ?, updated_at = CURRENT_TIMESTAMP WHERE id IN ({qmarks})',
        (1 if in_stock else 0, *product_ids)
    )
    n = conn.total_changes
    conn.commit()
    conn.close()
    return n


def cache_get(key, max_age_seconds=7 * 24 * 3600):
    """Return the cached value (JSON-decoded) for `key`, or None if missing
    or older than max_age_seconds."""
    conn = get_db()
    row = conn.execute(
        "SELECT value, created_at FROM api_cache WHERE key = ?", (key,)
    ).fetchone()
    conn.close()
    if not row:
        return None
    try:
        created = datetime.fromisoformat(row['created_at'])
    except Exception:
        try:
            created = datetime.strptime(row['created_at'], '%Y-%m-%d %H:%M:%S')
        except Exception:
            return None
    if (datetime.now() - created).total_seconds() > max_age_seconds:
        return None
    try:
        return json.loads(row['value'])
    except Exception:
        return None


def cache_set(key, value):
    conn = get_db()
    conn.execute(
        "INSERT OR REPLACE INTO api_cache (key, value, created_at) VALUES (?, ?, CURRENT_TIMESTAMP)",
        (key, json.dumps(value, ensure_ascii=False))
    )
    conn.commit()
    conn.close()


def record_click(data):
    conn = get_db()
    conn.execute('''
        INSERT INTO clicks (product_id, product_name, category, element_type, page, referrer, user_ip, user_agent, country)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    ''', (
        data.get('product_id', ''),
        data.get('product_name', ''),
        data.get('category', ''),
        data.get('element_type', 'click'),
        data.get('page', ''),
        data.get('referrer', ''),
        data.get('user_ip', ''),
        data.get('user_agent', ''),
        data.get('country', ''),
    ))
    conn.commit()
    conn.close()


def get_analytics(days=30, since=None, until=None):
    """Pull analytics for a window.

    Either pass `days` (legacy, counts back from now) OR pass explicit
    `since` / `until` ISO datetime strings for arbitrary windows.
    """
    conn = get_db()
    if since is None:
        since = (datetime.now() - timedelta(days=days)).isoformat()
    if until is None:
        until = datetime.now().isoformat()

    range_args = (since, until)

    total = conn.execute(
        'SELECT COUNT(*) as c FROM clicks WHERE clicked_at >= ? AND clicked_at <= ?', range_args
    ).fetchone()['c']

    unique = conn.execute(
        'SELECT COUNT(DISTINCT user_ip) as c FROM clicks WHERE clicked_at >= ? AND clicked_at <= ?', range_args
    ).fetchone()['c']

    top_products = conn.execute('''
        SELECT product_name, COUNT(*) as clicks FROM clicks
        WHERE clicked_at >= ? AND clicked_at <= ? AND product_name != ''
        GROUP BY product_name ORDER BY clicks DESC LIMIT 10
    ''', range_args).fetchall()

    top_categories = conn.execute('''
        SELECT category, COUNT(*) as clicks FROM clicks
        WHERE clicked_at >= ? AND clicked_at <= ? AND category != ''
        GROUP BY category ORDER BY clicks DESC LIMIT 10
    ''', range_args).fetchall()

    top_pages = conn.execute('''
        SELECT page, COUNT(*) as views FROM clicks
        WHERE clicked_at >= ? AND clicked_at <= ? AND page != ''
        GROUP BY page ORDER BY views DESC LIMIT 10
    ''', range_args).fetchall()

    element_types = conn.execute('''
        SELECT element_type, COUNT(*) as clicks FROM clicks
        WHERE clicked_at >= ? AND clicked_at <= ?
        GROUP BY element_type ORDER BY clicks DESC
    ''', range_args).fetchall()

    # Pick a bucket size based on window length so the chart stays useful.
    # < 6h → hourly, < 60d → daily, < 2y → weekly, else monthly.
    try:
        s_dt = datetime.fromisoformat(since)
        u_dt = datetime.fromisoformat(until)
        span_h = (u_dt - s_dt).total_seconds() / 3600.0
    except Exception:
        span_h = 24 * 30
    if span_h <= 48:
        bucket_sql = "strftime('%Y-%m-%d %H:00', clicked_at)"
        bucket = 'hour'
    elif span_h <= 24 * 60:
        bucket_sql = "DATE(clicked_at)"
        bucket = 'day'
    elif span_h <= 24 * 365 * 2:
        bucket_sql = "strftime('%Y-W%W', clicked_at)"
        bucket = 'week'
    else:
        bucket_sql = "strftime('%Y-%m', clicked_at)"
        bucket = 'month'

    daily = conn.execute(f'''
        SELECT {bucket_sql} as day, COUNT(*) as clicks, COUNT(DISTINCT user_ip) as visitors
        FROM clicks WHERE clicked_at >= ? AND clicked_at <= ?
        GROUP BY day ORDER BY day
    ''', range_args).fetchall()

    signup_clicks = conn.execute(
        "SELECT COUNT(*) as c FROM clicks WHERE clicked_at >= ? AND clicked_at <= ? AND element_type = 'signup'", range_args
    ).fetchone()['c']

    conn.close()
    return {
        'total_clicks': total,
        'unique_visitors': unique,
        'signup_clicks': signup_clicks,
        'top_products': [dict(r) for r in top_products],
        'top_categories': [dict(r) for r in top_categories],
        'top_pages': [dict(r) for r in top_pages],
        'element_types': [dict(r) for r in element_types],
        'daily': [dict(r) for r in daily],
        'bucket': bucket,
        'since': since,
        'until': until,
    }


def backup_database():
    os.makedirs(BACKUP_DIR, exist_ok=True)
    timestamp = datetime.now().strftime('%Y-%m-%d_%H%M%S')
    backup_path = os.path.join(BACKUP_DIR, f'backup_{timestamp}.db')
    shutil.copy2(DB_PATH, backup_path)

    # Clean backups older than 30 days
    cutoff = datetime.now() - timedelta(days=30)
    for f in os.listdir(BACKUP_DIR):
        fpath = os.path.join(BACKUP_DIR, f)
        if os.path.isfile(fpath):
            mtime = datetime.fromtimestamp(os.path.getmtime(fpath))
            if mtime < cutoff:
                os.remove(fpath)

    return backup_path


def check_auto_backup():
    """Run backup if last one was > 24hrs ago."""
    os.makedirs(BACKUP_DIR, exist_ok=True)
    backups = sorted([f for f in os.listdir(BACKUP_DIR) if f.startswith('backup_')])
    if not backups:
        return backup_database()

    latest = os.path.join(BACKUP_DIR, backups[-1])
    mtime = datetime.fromtimestamp(os.path.getmtime(latest))
    if datetime.now() - mtime > timedelta(hours=24):
        return backup_database()
    return None
