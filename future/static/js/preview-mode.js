/* Future Finds preview-mode runtime — v1
 * Dark sci-fi by default. Activated by ?pv=1 query param.
 */
(function () {
    var qs = new URLSearchParams(window.location.search);
    if (qs.get('pv') !== '1') return;

    var ORIG = { brandHTML: null, footerBrandHTML: null };

    function hexToRgb(hex) {
        var h = String(hex || '').replace('#', '');
        if (h.length === 3) h = h.split('').map(function (c) { return c + c; }).join('');
        if (!/^[0-9a-fA-F]{6}$/.test(h)) return null;
        var n = parseInt(h, 16);
        return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
    }
    function hexToRgba(hex, a) {
        var c = hexToRgb(hex);
        if (!c) return 'rgba(0,245,212,' + a + ')';
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
        var f = amount, t = f < 0 ? 0 : 255, p = f < 0 ? f * -1 : f;
        return '#' + [c.r, c.g, c.b].map(function (v) {
            var x = Math.round((t - v) * p) + v;
            var h = x.toString(16); return h.length === 1 ? '0' + h : h;
        }).join('');
    }
    function readableAccent(hex, themeName) {
        var c = hexToRgb(hex);
        if (!c) return hex;
        var lum = (0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b) / 255;
        var darkBg = themeName !== 'light';
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
    // button/border/text disappears. Iteratively push accent away from bg
    // until contrast ratio is >= 3:1 (WCAG min for graphic objects).
    function luminance(hex) {
        var c = hexToRgb(hex);
        if (!c) return 0;
        // sRGB relative luminance (gamma-corrected)
        function ch(v) { v = v / 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }
        return 0.2126 * ch(c.r) + 0.7152 * ch(c.g) + 0.0722 * ch(c.b);
    }
    function contrastRatio(aHex, bHex) {
        var a = luminance(aHex), b = luminance(bHex);
        var lo = Math.min(a, b), hi = Math.max(a, b);
        return (hi + 0.05) / (lo + 0.05);
    }
    function contrastSafeAccent(hex, bgHex) {
        if (contrastRatio(hex, bgHex) >= 3) return hex;
        // Push toward opposite extreme in 0.2 steps until safe (or capped).
        var bgLum = luminance(bgHex);
        var dir = bgLum < 0.5 ? 1 : -1; // dark bg → lighten, light bg → darken
        var out = hex;
        for (var i = 0; i < 6; i++) {
            out = shade(out, dir * 0.25);
            if (contrastRatio(out, bgHex) >= 3) return out;
        }
        // Last resort — return pure white/black opposite of bg.
        return bgLum < 0.5 ? '#ffffff' : '#000000';
    }

    var THEMES = {
        dark: {
            '--bg':            '#050507',
            '--bg-grid':       'rgba(0,245,212,0.04)',
            '--surface':       '#0a0a0e',
            '--surface-2':     '#0f1015',
            '--surface-3':     '#15171f',
            '--text':          '#e6e9f0',
            '--text-secondary':'rgba(230,233,240,0.65)',
            '--text-muted':    'rgba(230,233,240,0.4)',
            '--border-subtle': 'rgba(230,233,240,0.06)',
            '--nav-bg':        'rgba(5,5,7,0.85)',
            '--mobile-menu-bg':'rgba(5,5,7,0.97)',
            isDarkBg: true,
        },
        light: {
            '--bg':            '#fafafa',
            '--bg-grid':       'rgba(0,0,0,0.03)',
            '--surface':       '#ffffff',
            '--surface-2':     '#f4f4f4',
            '--surface-3':     '#e5e5e5',
            '--text':          '#0a0a0a',
            '--text-secondary':'rgba(10,10,10,0.7)',
            '--text-muted':    'rgba(10,10,10,0.45)',
            '--border-subtle': 'rgba(10,10,10,0.08)',
            '--nav-bg':        'rgba(255,255,255,0.92)',
            '--mobile-menu-bg':'rgba(255,255,255,0.97)',
            isDarkBg: false,
        },
        mono: {
            '--bg':            '#000000',
            '--bg-grid':       'rgba(255,255,255,0.04)',
            '--surface':       '#0a0a0a',
            '--surface-2':     '#121212',
            '--surface-3':     '#1a1a1a',
            '--text':          '#ffffff',
            '--text-secondary':'rgba(255,255,255,0.7)',
            '--text-muted':    'rgba(255,255,255,0.4)',
            '--border-subtle': 'rgba(255,255,255,0.12)',
            '--nav-bg':        'rgba(0,0,0,0.92)',
            '--mobile-menu-bg':'rgba(0,0,0,0.97)',
            isDarkBg: true,
        },
    };

    var FONTS = {
        space:           "'Space Grotesk', sans-serif",
        jetbrains:       "'JetBrains Mono', monospace",
        inter:           "'Inter', sans-serif",
        instrumentserif: "'Instrument Serif', serif",
        playfair:        "'Playfair Display', serif",
        dmserif:         "'DM Serif Display', serif",
        syne:            "'Syne', sans-serif",
        anton:           "'Anton', sans-serif",
        bebas:           "'Bebas Neue', sans-serif",
    };

    function buildCss(state) {
        var theme = THEMES[state.theme] || THEMES.dark;
        var color = state.color || '#00f5d4';
        color = contrastSafeAccent(color, theme['--bg']);
        var accentOn = isLight(color) ? '#000' : '#050507';
        var accentText = readableAccent(color, state.theme || 'dark');

        var css = [];
        var rootDecls = [];
        Object.keys(theme).forEach(function (k) {
            if (k.indexOf('--') === 0) rootDecls.push(k + ':' + theme[k] + ';');
        });
        rootDecls.push('--accent:' + color + ';');
        rootDecls.push('--accent-hover:' + hexToRgba(color, 0.85) + ';');
        rootDecls.push('--accent-dim:' + hexToRgba(color, 0.1) + ';');
        rootDecls.push('--accent-glow:' + hexToRgba(color, 0.2) + ';');
        rootDecls.push('--border:' + hexToRgba(color, 0.18) + ';');
        rootDecls.push('--border-strong:' + hexToRgba(color, 0.4) + ';');
        rootDecls.push('--accent-on:' + accentOn + ';');
        rootDecls.push('--accent-text:' + accentText + ';');
        css.push(':root{' + rootDecls.join('') + '}');

        if (state.font && FONTS[state.font]) {
            css.push(':root{--font-display:' + FONTS[state.font] + ' !important;}');
            css.push('.hero h1,.section-title,.sec-title,.cta-section h2,.popup-headline,.pd-title,'
                + '.footer-brand,.nav-brand,.stat-num,.shop-header h1,.empty-state-text,'
                + '.spec-block h2'
                + '{font-family:' + FONTS[state.font] + ' !important;}');
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
                + 'style="height:24px;max-height:24px;width:auto;max-width:140px;display:inline-block;vertical-align:middle;object-fit:contain;margin-right:10px;flex-shrink:0;" '
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
                  + 'style="height:20px;max-height:20px;width:auto;max-width:100px;display:inline-block;vertical-align:middle;object-fit:contain;margin-right:8px;flex-shrink:0;" '
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
        var accentSpan = split.accent ? '<span class="accent">' + escapeHtml(split.accent) + '</span>' : '';
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
            color: qs.get('color') || '#00f5d4',
            theme: qs.get('theme') || 'dark',
            font: qs.get('font') || '',
            logo: qs.get('logo') || '',
            hideChrome: qs.get('hideChrome') === '1',
        };
    }

    var state = readState();
    applyCss(state);
    function onReady() { applyBrand(state); applyChrome(state); ensurePreviewBadge(); }
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

    // ============================================================
    // Preserve preview params across in-page navigation.
    // Without this, clicking Home/Shop/etc. inside the iframe strips
    // ?pv=1 and friends — so the next page renders bare (no customizations).
    // ============================================================
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
        } catch (err) { /* fall through to default nav */ }
    }, true);
})();
