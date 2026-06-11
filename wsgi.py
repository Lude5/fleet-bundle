"""
Fleet bundle WSGI entry point.

Mounts:
  /                 -> master_admin (control plane, login at /login, dashboard at /)
  /kai/             -> kai template site
  /maywood/         -> maywood sheets template site

This is a single Render Web Service that hosts the master admin + every template
under one URL. Used to show Talan/Mimi big updates without deploying each site
to its own Render service.

Live production sites (jake, tobey, john, reptools) stay on their own Render
services — this bundle is for the templates kaiom is building.
"""
import os
import re
import sys
from io import BytesIO

# Ensure the bundle root is importable
HERE = os.path.dirname(os.path.abspath(__file__))
if HERE not in sys.path:
    sys.path.insert(0, HERE)

# Persistent storage. Render mounts the disk at /data or /var/data depending on
# service config (render.yaml says /var/data but the engine's production-incident
# notes say /data) — accept whichever actually exists so per-app data dirs always
# land on the persistent disk; locally fall back to ./data.
LOCAL_DATA = os.path.join(HERE, 'data')
DATA_ROOT = next((d for d in ('/data', '/var/data') if os.path.isdir(d)), LOCAL_DATA)
for sub in ('kai', 'maywood', 'minimal', 'future', 'volume', 'terminal', 'editorial', 'ategoat', 'vault', 'auralinks', 'master_admin'):
    os.makedirs(os.path.join(DATA_ROOT, sub), exist_ok=True)

# Set per-app data dirs BEFORE importing the apps.
os.environ.setdefault('KAI_DATA_DIR', os.path.join(DATA_ROOT, 'kai'))
os.environ.setdefault('MAYWOOD_DATA_DIR', os.path.join(DATA_ROOT, 'maywood'))
os.environ.setdefault('MINIMAL_DATA_DIR', os.path.join(DATA_ROOT, 'minimal'))
os.environ.setdefault('FUTURE_DATA_DIR', os.path.join(DATA_ROOT, 'future'))
os.environ.setdefault('VOLUME_DATA_DIR', os.path.join(DATA_ROOT, 'volume'))
os.environ.setdefault('TERMINAL_DATA_DIR', os.path.join(DATA_ROOT, 'terminal'))
os.environ.setdefault('EDITORIAL_DATA_DIR', os.path.join(DATA_ROOT, 'editorial'))
os.environ.setdefault('ATEGOAT_DATA_DIR', os.path.join(DATA_ROOT, 'ategoat'))
os.environ.setdefault('VAULT_DATA_DIR', os.path.join(DATA_ROOT, 'vault'))
os.environ.setdefault('AURALINKS_DATA_DIR', os.path.join(DATA_ROOT, 'auralinks'))
os.environ.setdefault('MASTER_ADMIN_DATA_DIR', os.path.join(DATA_ROOT, 'master_admin'))

from werkzeug.middleware.dispatcher import DispatcherMiddleware  # noqa: E402

from master_admin.app import app as master_app  # noqa: E402
from kai.app import app as kai_app  # noqa: E402
from maywood.app import app as maywood_app  # noqa: E402
from minimal.app import app as minimal_app  # noqa: E402
from future.app import app as future_app  # noqa: E402
from volume.app import app as volume_app  # noqa: E402
from terminal.app import app as terminal_app  # noqa: E402
from editorial.app import app as editorial_app  # noqa: E402
from ategoat.app import app as ategoat_app  # noqa: E402
from vault.app import app as vault_app  # noqa: E402
from auralinks.app import app as auralinks_app  # noqa: E402

# --- security hardening: cookies, headers, login throttle for every sub-app ---
from security import harden as _harden  # noqa: E402
for _sub_app in (master_app, kai_app, maywood_app, minimal_app, future_app,
                 volume_app, terminal_app, editorial_app, ategoat_app, vault_app,
                 auralinks_app):
    _harden(_sub_app)

kai_app.config['APPLICATION_ROOT'] = '/kai'
maywood_app.config['APPLICATION_ROOT'] = '/maywood'
minimal_app.config['APPLICATION_ROOT'] = '/minimal'
future_app.config['APPLICATION_ROOT'] = '/future'
volume_app.config['APPLICATION_ROOT'] = '/volume'
terminal_app.config['APPLICATION_ROOT'] = '/terminal'
editorial_app.config['APPLICATION_ROOT'] = '/editorial'
ategoat_app.config['APPLICATION_ROOT'] = '/ategoat'
vault_app.config['APPLICATION_ROOT'] = '/vault'
auralinks_app.config['APPLICATION_ROOT'] = '/auralinks'


# ============================================================
# URL prefix middleware — rewrites absolute paths in HTML/JS
# responses so sub-mounted Flask apps work without template edits.
# ============================================================
# Matches URL-like attributes/calls that start with a single slash followed by
# anything except another slash (so we don't touch protocol-relative URLs like
# //cdn.example.com or fully qualified URLs).
_URL_RE = re.compile(
    r'''(?P<prefix>(?:href|src|action|formaction|data-href|data-url)\s*=\s*["'])'''
    r'''/(?!/)'''
)
_FETCH_RE = re.compile(
    r'''(?P<prefix>(?:fetch|axios\.(?:get|post|put|delete|patch))\s*\(\s*["'])'''
    r'''/(?!/)'''
)
_LOCATION_RE = re.compile(
    r'''(?P<prefix>window\.location(?:\.href)?\s*=\s*["'])'''
    r'''/(?!/)'''
)
# A whitelist of URL-prefixes that we should rewrite. Without this we'd rewrite
# /static, /api, /admin, /go etc. — but also any /<word> that the dev wrote.
# Belt-and-braces: just rewrite whenever the pattern matches; the page's own
# routes always start with one of these anyway.

class URLPrefixMiddleware:
    """Rewrites root-relative URLs in HTML/JS responses to include a mount prefix."""

    def __init__(self, app, prefix):
        self.app = app
        self.prefix = prefix.rstrip('/')

    def __call__(self, environ, start_response):
        captured_status = []
        captured_headers = []

        def custom_start_response(status, headers, exc_info=None):
            captured_status.append(status)
            captured_headers.append(headers)
            # Defer real start_response until after we mutate headers
            return lambda data: None

        body_iter = self.app(environ, custom_start_response)

        # Determine if this is a rewriteable response
        headers = captured_headers[0] if captured_headers else []
        content_type = ''
        for k, v in headers:
            if k.lower() == 'content-type':
                content_type = v.lower()
                break

        is_rewriteable = (
            'text/html' in content_type
            or 'application/javascript' in content_type
            or 'text/javascript' in content_type
        )

        if not is_rewriteable:
            # Pass through as-is
            start_response(captured_status[0], headers)
            return body_iter

        # Buffer the entire response
        buf = BytesIO()
        try:
            for chunk in body_iter:
                if chunk:
                    buf.write(chunk)
        finally:
            if hasattr(body_iter, 'close'):
                body_iter.close()

        body_bytes = buf.getvalue()
        try:
            text = body_bytes.decode('utf-8')
        except UnicodeDecodeError:
            # Non-UTF8 — pass through
            start_response(captured_status[0], headers)
            return [body_bytes]

        # Apply rewrites
        text = _URL_RE.sub(lambda m: m.group('prefix') + self.prefix + '/', text)
        text = _FETCH_RE.sub(lambda m: m.group('prefix') + self.prefix + '/', text)
        text = _LOCATION_RE.sub(lambda m: m.group('prefix') + self.prefix + '/', text)

        new_body = text.encode('utf-8')

        # Strip any existing Content-Length, then set to the new size
        new_headers = [(k, v) for (k, v) in headers if k.lower() != 'content-length']
        new_headers.append(('Content-Length', str(len(new_body))))

        start_response(captured_status[0], new_headers)
        return [new_body]


# Wrap kai and maywood with the rewriter; master_admin is at root so it
# doesn't need rewriting.
kai_wrapped = URLPrefixMiddleware(kai_app, '/kai')
maywood_wrapped = URLPrefixMiddleware(maywood_app, '/maywood')
minimal_wrapped = URLPrefixMiddleware(minimal_app, '/minimal')
future_wrapped = URLPrefixMiddleware(future_app, '/future')
volume_wrapped = URLPrefixMiddleware(volume_app, '/volume')
terminal_wrapped = URLPrefixMiddleware(terminal_app, '/terminal')
editorial_wrapped = URLPrefixMiddleware(editorial_app, '/editorial')
ategoat_wrapped = URLPrefixMiddleware(ategoat_app, '/ategoat')
vault_wrapped = URLPrefixMiddleware(vault_app, '/vault')
auralinks_wrapped = URLPrefixMiddleware(auralinks_app, '/auralinks')

_bundle = DispatcherMiddleware(master_app, {
    '/kai': kai_wrapped,
    '/maywood': maywood_wrapped,
    '/minimal': minimal_wrapped,
    '/future': future_wrapped,
    '/volume': volume_wrapped,
    '/terminal': terminal_wrapped,
    '/editorial': editorial_wrapped,
    '/ategoat': ategoat_wrapped,
    '/vault': vault_wrapped,
    '/auralinks': auralinks_wrapped,
})

# ============================================================
# Host-based front controller
# ============================================================
# ategoat has its own public domain (repsloot.com). When a request comes in on
# that host we serve the RAW ategoat app at the root — no '/ategoat' prefix and
# no URL-prefix rewriting, because the app's own root-relative URLs (/shop,
# /api/..., /static/...) are already correct at root. SCRIPT_NAME stays '' so
# Flask's url_for generates clean root URLs on this domain.
#
# Every other host keeps the bundle layout unchanged (master_admin at /, ategoat
# editable at /ategoat). This matters: the master_admin Studio edits ategoat via
# the SAME-ORIGIN fleet-bundle.onrender.com/ategoat surface, and because that's
# the same app + same database that repsloot.com serves, edits appear on the
# public domain instantly. So we deliberately DO NOT redirect /ategoat away.
ATEGOAT_ROOT_HOSTS = {'repsloot.com', 'www.repsloot.com'}
AURALINKS_ROOT_HOSTS = {'auralinks.de', 'www.auralinks.de'}


def application(environ, start_response):
    host = (environ.get('HTTP_HOST') or '').split(':')[0].strip().lower()
    if host in ATEGOAT_ROOT_HOSTS:
        return ategoat_app(environ, start_response)
    if host in AURALINKS_ROOT_HOSTS:
        return auralinks_app(environ, start_response)
    return _bundle(environ, start_response)


# Gunicorn looks for `app` by default
app = application


if __name__ == '__main__':
    from werkzeug.serving import run_simple
    run_simple('0.0.0.0', int(os.environ.get('PORT', 5000)), application,
               use_reloader=True, use_debugger=True)
