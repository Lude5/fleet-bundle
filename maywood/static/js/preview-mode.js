/* Maywood Sheets preview-mode runtime — v1
 * Adapted from kai's preview-mode.js. Light theme is the DEFAULT.
 *
 * Activated by ?pv=1 query param. Reads brand / color / theme / logo / font
 * from URL params and overrides the live site in real-time.
 *
 * Listens for postMessage('kai-preview-update') from a parent window
 * (master admin studio) and applies changes in-place — no iframe reload.
 *
 * Params:
 *   pv=1            enable preview mode
 *   brand=Acme      replace nav + footer + popup brand text
 *   color=%23ff5500 override --accent and derived variables
 *   theme=light|dark|mono   swap the entire color theme (default: light)
 *   font=inter|playfair|instrumentserif|dmserif|syne|jetbrains|anton|bebas|space
 *   logo=URL        put a logo image in nav-brand instead of text
 *   hideChrome=1    hide popup + sales notif (cleaner preview)
 */
(function () {
    var qs = new URLSearchParams(window.location.search);
    if (qs.get('pv') !== '1') return;

    var ORIG = {
        brandHTML: null,
        footerBrandHTML: null,
    };

    function hexToRgb(hex) {
        var h = String(hex || '').replace('#', '');
        if (h.length === 3) h = h.split('').map(function (c) { return c + c; }).join('');
        if (!/^[0-9a-fA-F]{6}$/.test(h)) return null;
        var n = parseInt(h, 16);
        return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
    }
    function hexToRgba(hex, a) {
        var c = hexToRgb(hex);
        if (!c) return 'rgba(13,148,136,' + a + ')';
        return 'rgba(' + c.r + ',' + c.g + ',' + c.b + ',' + a + ')';
    }
    function isLight(hex) {
        var c = hexToRgb(hex);
        if (!c) return false;
        var lum = (0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b) / 255;
        return lum > 0.6;
    }
    function shade(hex, amount) {
        var c = hexToRgb(hex);
        if (!c) return hex;
        var f = amount;
        var t = f < 0 ? 0 : 255;
        var p = f < 0 ? f * -1 : f;
        var r = Math.round((t - c.r) * p) + c.r;
        var g = Math.round((t - c.g) * p) + c.g;
        var b = Math.round((t - c.b) * p) + c.b;
        return '#' + [r, g, b].map(function (v) {
            var h = v.toString(16);
            return h.length === 1 ? '0' + h : h;
        }).join('');
    }
    function readableAccent(hex, themeName) {
        var c = hexToRgb(hex);
        if (!c) return hex;
        var lum = (0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b) / 255;
        var darkBg = themeName === 'dark' || themeName === 'mono';
        if (darkBg) {
            if (lum < 0.18) return shade(hex, 0.55);
            return hex;
        } else {
            if (lum > 0.62) return shade(hex, -0.55);
            if (lum > 0.5) return shade(hex, -0.35);
            return hex;
        }
    }

    // When the picked accent sits too close to the scene bg luminance, the
    // button/border disappears (white-on-light, black-on-dark, etc.). Push
    // accent toward the opposite extreme until it has enough contrast.
    function luminance(hex) {
        var c = hexToRgb(hex);
        if (!c) return 0;
        return (0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b) / 255;
    }
    function contrastSafeAccent(hex, bgHex) {
        var aLum = luminance(hex);
        var bLum = luminance(bgHex);
        if (Math.abs(aLum - bLum) > 0.22) return hex;
        var push = bLum < 0.5 ? 0.7 : -0.7;
        return shade(hex, push);
    }

    // ============================================================
    // Theme palettes (light is the default for Maywood)
    // ============================================================
    var THEMES = {
        light: {
            '--bg':            '#ffffff',
            '--surface':       '#fafafa',
            '--surface-2':     '#f4f4f5',
            '--surface-3':     '#e5e5e8',
            '--text':          '#111827',
            '--text-secondary':'rgba(17,24,39,0.72)',
            '--text-muted':    'rgba(17,24,39,0.48)',
            '--border-subtle': 'rgba(17,24,39,0.08)',
            '--border-strong': 'rgba(17,24,39,0.16)',
            '--nav-bg':        'rgba(255,255,255,0.86)',
            '--mobile-menu-bg':'rgba(255,255,255,0.97)',
            isDarkBg:          false,
        },
        dark: {
            '--bg':            '#0a0a0b',
            '--surface':       '#141418',
            '--surface-2':     '#1c1c22',
            '--surface-3':     '#26262e',
            '--text':          '#fafafa',
            '--text-secondary':'rgba(250,250,250,0.72)',
            '--text-muted':    'rgba(250,250,250,0.48)',
            '--border-subtle': 'rgba(250,250,250,0.08)',
            '--border-strong': 'rgba(250,250,250,0.18)',
            '--nav-bg':        'rgba(10,10,11,0.86)',
            '--mobile-menu-bg':'rgba(10,10,11,0.97)',
            isDarkBg:          true,
        },
        mono: {
            '--bg':            '#0a0a0a',
            '--surface':       '#111111',
            '--surface-2':     '#181818',
            '--surface-3':     '#202020',
            '--text':          '#f5f5f5',
            '--text-secondary':'rgba(245,245,245,0.78)',
            '--text-muted':    'rgba(245,245,245,0.45)',
            '--border-subtle': 'rgba(245,245,245,0.12)',
            '--border-strong': 'rgba(245,245,245,0.22)',
            '--nav-bg':        'rgba(10,10,10,0.92)',
            '--mobile-menu-bg':'rgba(10,10,10,0.97)',
            isDarkBg:          true,
        },
    };

    var FONTS = {
        instrumentserif: "'Instrument Serif', serif",
        inter:           "'Inter', sans-serif",
        playfair:        "'Playfair Display', serif",
        dmserif:         "'DM Serif Display', serif",
        syne:            "'Syne', sans-serif",
        jetbrains:       "'JetBrains Mono', monospace",
        anton:           "'Anton', sans-serif",
        bebas:           "'Bebas Neue', sans-serif",
        space:           "'Space Grotesk', sans-serif",
    };

    function buildCss(state) {
        var theme = THEMES[state.theme] || THEMES.light;
        var color = state.color || '#0d9488';
        color = contrastSafeAccent(color, theme['--bg']);
        var c = hexToRgb(color) || { r: 13, g: 148, b: 136 };
        var accentOn = isLight(color) ? '#000' : '#fff';
        var accentText = readableAccent(color, state.theme || 'light');

        var css = [];

        // ---- :root variables ----
        var rootDecls = [];
        Object.keys(theme).forEach(function (k) {
            if (k.indexOf('--') === 0) rootDecls.push(k + ':' + theme[k] + ';');
        });
        rootDecls.push('--accent:' + color + ';');
        rootDecls.push('--accent-hover:' + hexToRgba(color, 0.85) + ';');
        rootDecls.push('--accent-dim:' + hexToRgba(color, 0.1) + ';');
        rootDecls.push('--accent-glow:' + hexToRgba(color, 0.2) + ';');
        rootDecls.push('--border:' + hexToRgba(color, 0.3) + ';');
        rootDecls.push('--accent-on:' + accentOn + ';');
        rootDecls.push('--accent-text:' + accentText + ';');
        css.push(':root{' + rootDecls.join('') + '}');

        // ---- accent-text contexts (keep accent text readable on bg) ----
        css.push('.nav-brand .accent,.footer-brand .accent,.product-card-buy,.product-card-price,'
            + '.popup-label,.section-title .italic,.sec-title .italic,.cta-section h2 .italic,'
            + '.split-cta-text h2 .italic,.popup h2 .italic,.discord-cta-text h3 .italic,'
            + '.stat-num .italic,.seo-block h2 .italic,.shop-header h1 .italic,'
            + '.empty-state-text,.sn-time,.pd-source .src-dot,.cat-pill.active,'
            + '.bundle-card-name,.seller-card-avatar,.mobile-menu a.italic'
            + '{color:var(--accent-text) !important;}');
        css.push('.cat-pill.active,.nav-links a.active::after{border-bottom-color:var(--accent-text) !important;}');
        css.push('.pd-source .src-dot{background:var(--accent-text) !important;}');

        // ---- buttons that put text ON accent ----
        css.push('.nav-cta,.btn-primary,.product-card-badge,.mid-cta,.mid-cta a,.mid-cta .big,.mid-cta .small'
            + '{color:' + accentOn + ' !important;}');
        css.push('.mid-cta{background:' + color + ' !important;}');

        // pd-buy uses --text bg / --bg fg, switches naturally with theme

        // hero search button uses --text bg / --bg fg, naturally inverts
        // The search button's hover -> accent works via existing rules

        // ---- font override ----
        if (state.font && FONTS[state.font]) {
            css.push(':root{--font-display:' + FONTS[state.font] + ' !important;}');
            css.push('.hero h1,.section-title,.sec-title,.cta-section h2,.popup h2,.pd-title,'
                + '.footer-brand,.nav-brand,.stat-num,.split-cta-text h2,.discord-cta-text h3,'
                + '.seo-block h2,.shop-header h1,.empty-state-text,.brand-strip-item,'
                + '.seller-card-avatar,.pd-price'
                + '{font-family:' + FONTS[state.font] + ' !important;}');
        }

        // Variant pill on dark themes — flip the white background to dark
        if (theme.isDarkBg) {
            css.push('.variant-pill{background:rgba(20,20,24,0.92) !important;color:#fafafa !important;border-color:rgba(255,255,255,0.06) !important;}');
            css.push('.variant-pill .stack > div{border-color:#1c1c22 !important;}');
        }

        return css.join('\n');
    }

    function applyCss(state) {
        var existing = document.getElementById('kai-preview-overrides');
        if (existing) existing.remove();
        var st = document.createElement('style');
        st.id = 'kai-preview-overrides';
        st.textContent = buildCss(state);
        document.head.appendChild(st);
    }

    function splitBrand(brand) {
        var b = String(brand || '').trim();
        if (!b) return null;
        if (b.indexOf(' ') !== -1) {
            var parts = b.split(/\s+/);
            return { plain: parts.slice(0, -1).join(' ') + ' ', accent: parts[parts.length - 1] };
        }
        var camel = b.match(/^([A-Z][a-z]+)([A-Z][a-zA-Z]+)$/);
        if (camel) return { plain: camel[1], accent: camel[2] };
        var sufs = ['locker', 'finds', 'sheets', 'studio', 'world', 'store', 'house', 'mart', 'shop', 'club', 'spot', 'co', 'buy'];
        var lower = b.toLowerCase();
        for (var i = 0; i < sufs.length; i++) {
            if (lower.length > sufs[i].length && lower.endsWith(sufs[i])) {
                var splitAt = b.length - sufs[i].length;
                return { plain: b.slice(0, splitAt), accent: b.slice(splitAt) };
            }
        }
        if (b.length >= 3) {
            var mid = Math.ceil(b.length / 2);
            return { plain: b.slice(0, mid), accent: b.slice(mid) };
        }
        return { plain: b, accent: '' };
    }

    function applyBrand(state) {
        document.querySelectorAll('.nav-brand').forEach(function (el) {
            if (ORIG.brandHTML === null) ORIG.brandHTML = el.innerHTML;
        });
        document.querySelectorAll('.footer-brand').forEach(function (el) {
            if (ORIG.footerBrandHTML === null) ORIG.footerBrandHTML = el.innerHTML;
        });

        var brand = state.brand;
        var logo = state.logo;
        var brandHTML = brand ? renderSplitBrandHTML(brand) : ORIG.brandHTML;

        function logoHTML() {
            if (!logo) return '';
            return '<img src="' + escapeHtml(logo) + '" alt="' + escapeHtml(brand || 'logo') + '" '
                + 'style="height:32px;max-height:32px;width:auto;max-width:160px;display:inline-block;vertical-align:middle;object-fit:contain;margin-right:10px;flex-shrink:0;" '
                + 'onerror="this.style.display=\'none\'">';
        }

        document.querySelectorAll('.nav-brand').forEach(function (el) {
            el.style.display = 'inline-flex';
            el.style.alignItems = 'center';
            el.innerHTML = logoHTML() + brandHTML;
        });

        document.querySelectorAll('.footer-brand').forEach(function (el) {
            el.style.display = 'inline-flex';
            el.style.alignItems = 'center';
            var fLogo = logo
                ? '<img src="' + escapeHtml(logo) + '" alt="' + escapeHtml(brand || 'logo') + '" '
                  + 'style="height:24px;max-height:24px;width:auto;max-width:120px;display:inline-block;vertical-align:middle;object-fit:contain;margin-right:8px;flex-shrink:0;" '
                  + 'onerror="this.style.display=\'none\'">'
                : '';
            var fBrand = brand ? renderSplitBrandHTML(brand) : ORIG.footerBrandHTML;
            el.innerHTML = fLogo + fBrand;
        });

        try { document.title = (brand || 'Preview') + ' — preview'; } catch (e) {}
    }

    function escapeHtml(s) {
        return String(s).replace(/[&<>"']/g, function (c) {
            return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
        });
    }
    function renderSplitBrandHTML(brand) {
        var split = splitBrand(brand);
        if (!split) return '';
        var accentSpan = split.accent
            ? '<span class="accent">' + escapeHtml(split.accent) + '</span>'
            : '';
        return escapeHtml(split.plain) + accentSpan;
    }

    function applyChrome(state) {
        var popup = document.getElementById('popup');
        var sn = document.getElementById('sn');
        if (state.hideChrome) {
            if (popup) popup.style.display = 'none';
            if (sn) sn.style.display = 'none';
            try { sessionStorage.setItem('pp', '1'); } catch (e) {}
        } else {
            if (popup) popup.style.display = '';
            if (sn) sn.style.display = '';
        }
    }

    function ensurePreviewBadge() {
        if (document.getElementById('kai-preview-badge')) return;
        var b = document.createElement('div');
        b.id = 'kai-preview-badge';
        b.textContent = 'PREVIEW';
        b.style.cssText = 'position:fixed;bottom:14px;left:14px;z-index:9999;padding:4px 10px;background:rgba(0,0,0,0.55);color:#fff;font-family:monospace;font-size:9px;font-weight:700;letter-spacing:2px;border-radius:5px;pointer-events:none;backdrop-filter:blur(4px);';
        document.body.appendChild(b);
    }

    function apply(state) {
        applyCss(state);
        if (document.body) {
            applyBrand(state);
            applyChrome(state);
            ensurePreviewBadge();
        }
    }

    function readState() {
        return {
            brand: qs.get('brand') || '',
            color: qs.get('color') || '#0d9488',
            theme: qs.get('theme') || 'light',
            font: qs.get('font') || '',
            logo: qs.get('logo') || '',
            hideChrome: qs.get('hideChrome') === '1',
        };
    }

    var state = readState();
    applyCss(state);

    function onReady() {
        applyBrand(state);
        applyChrome(state);
        ensurePreviewBadge();
    }
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', onReady);
    } else {
        onReady();
    }

    window.addEventListener('message', function (e) {
        if (!e.data || typeof e.data !== 'object') return;
        if (e.data.type !== 'kai-preview-update') return;
        var patch = e.data.payload || {};
        ['brand', 'color', 'theme', 'font', 'logo', 'hideChrome'].forEach(function (k) {
            if (k in patch) state[k] = patch[k];
        });
        apply(state);
        try {
            var u = new URL(window.location.href);
            ['brand', 'color', 'theme', 'font', 'logo'].forEach(function (k) {
                if (state[k]) u.searchParams.set(k, state[k]); else u.searchParams.delete(k);
            });
            if (state.hideChrome) u.searchParams.set('hideChrome', '1'); else u.searchParams.delete('hideChrome');
            u.searchParams.set('pv', '1');
            window.history.replaceState(null, '', u.toString());
        } catch (err) {}
        try {
            if (e.source && e.source.postMessage) {
                e.source.postMessage({ type: 'kai-preview-applied', state: state }, '*');
            }
        } catch (err) {}
    });

    try {
        if (window.parent && window.parent !== window) {
            window.parent.postMessage({ type: 'kai-preview-ready', state: state }, '*');
        }
    } catch (e) {}

    var PRESERVE_KEYS = ['pv', 'brand', 'color', 'theme', 'font', 'logo', 'hideChrome'];
    document.addEventListener('click', function (e) {
        var a = e.target.closest && e.target.closest('a[href]');
        if (!a) return;
        var href = a.getAttribute('href');
        if (!href) return;
        if (href.charAt(0) === '#') return;
        if (/^(mailto:|tel:|javascript:|data:)/i.test(href)) return;
        if (a.target === '_blank') return;
        try {
            var u = new URL(href, window.location.href);
            if (u.origin !== window.location.origin) return;
            if (a.classList.contains('product-card') || (a.closest && a.closest('.product-card'))) return;
            if (e.metaKey || e.ctrlKey || e.shiftKey || e.button === 1) return;
            var curParams = new URLSearchParams(window.location.search);
            PRESERVE_KEYS.forEach(function (k) {
                var v = curParams.get(k);
                if (v) u.searchParams.set(k, v);
            });
            e.preventDefault();
            window.location.href = u.toString();
        } catch (err) {}
    }, true);
})();
