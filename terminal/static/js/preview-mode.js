/* Terminal preview-mode runtime — v2 (phosphor green CRT)
 * Activated by ?pv=1 query param. Reads brand / color / theme / logo / font
 * from URL params and overrides the live site in real-time.
 *
 * Listens for postMessage('kai-preview-update') from a parent window
 * (master admin studio) and applies changes in-place — no iframe reload.
 *
 * Terminal note: the template is always dark mono. "theme" still works (dark
 * = green phosphor, amber = amber phosphor, mono = pure white-on-black) but
 * the layout never leaves the terminal vibe.
 */
(function () {
    var qs = new URLSearchParams(window.location.search);
    if (qs.get('pv') !== '1') return;

    var ORIG = { brandHTML: null, footerBrandHTML: null };

    // ============================================================
    // Helpers
    // ============================================================
    function hexToRgb(hex) {
        var h = String(hex || '').replace('#', '');
        if (h.length === 3) h = h.split('').map(function (c) { return c + c; }).join('');
        if (!/^[0-9a-fA-F]{6}$/.test(h)) return null;
        var n = parseInt(h, 16);
        return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
    }
    function hexToRgba(hex, a) {
        var c = hexToRgb(hex);
        if (!c) return 'rgba(34,197,94,' + a + ')';
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
    function readableAccent(hex) {
        var c = hexToRgb(hex);
        if (!c) return hex;
        var lum = (0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b) / 255;
        if (lum < 0.25) return shade(hex, 0.55);
        return hex;
    }
    // When accent BG sits too close to the scene BG luminance, the button
    // disappears (white accent on light bg, black accent on dark bg, etc.).
    // Shift accent toward the opposite extreme until it has enough contrast.
    function luminance(hex) {
        var c = hexToRgb(hex);
        if (!c) return 0;
        return (0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b) / 255;
    }
    function contrastSafeAccent(hex, bgHex) {
        var aLum = luminance(hex);
        var bLum = luminance(bgHex);
        var diff = Math.abs(aLum - bLum);
        if (diff > 0.22) return hex;
        var push = bLum < 0.5 ? 0.7 : -0.7;
        return shade(hex, push);
    }

    // ============================================================
    // Theme palettes — all dark, all terminal
    // ============================================================
    var THEMES = {
        dark: {  // phosphor green default
            '--bg':            '#050805',
            '--surface':       '#0a0e0a',
            '--surface-2':     '#0e1410',
            '--surface-3':     '#131a14',
            '--text':          '#c8d7c8',
            '--text-secondary':'#88a088',
            '--text-muted':    '#4a5a4a',
            '--border-subtle': 'rgba(34,197,94,0.15)',
            scanlineRgba:      'rgba(34,197,94,0.025)',
            vignetteRgba:      'rgba(0,0,0,0.55)',
            navBg:             '#050805',
            mobileMenuBg:      '#050805',
        },
        amber: {  // amber CRT
            '--bg':            '#0a0805',
            '--surface':       '#100c08',
            '--surface-2':     '#15110b',
            '--surface-3':     '#1c160e',
            '--text':          '#d7c89a',
            '--text-secondary':'#a08858',
            '--text-muted':    '#5a4a30',
            '--border-subtle': 'rgba(245,158,11,0.15)',
            scanlineRgba:      'rgba(245,158,11,0.025)',
            vignetteRgba:      'rgba(0,0,0,0.55)',
            navBg:             '#0a0805',
            mobileMenuBg:      '#0a0805',
        },
        mono: {  // pure white-on-black
            '--bg':            '#050505',
            '--surface':       '#0a0a0a',
            '--surface-2':     '#101010',
            '--surface-3':     '#151515',
            '--text':          '#dadada',
            '--text-secondary':'#888888',
            '--text-muted':    '#4a4a4a',
            '--border-subtle': 'rgba(255,255,255,0.12)',
            scanlineRgba:      'rgba(255,255,255,0.025)',
            vignetteRgba:      'rgba(0,0,0,0.6)',
            navBg:             '#050505',
            mobileMenuBg:      '#050505',
        },
    };

    var FONTS = {
        anton:     "'Anton', sans-serif",
        bebas:     "'Bebas Neue', sans-serif",
        playfair:  "'Playfair Display', serif",
        space:     "'Space Grotesk', monospace",
        jetbrains: "'JetBrains Mono', monospace",
        inter:     "'Inter', sans-serif",
        dmserif:   "'DM Serif Display', serif",
        syne:      "'Syne', sans-serif",
    };

    // ============================================================
    // Build override CSS for current state
    // ============================================================
    function buildCss(state) {
        var theme = THEMES[state.theme] || THEMES.dark;
        var rawColor = state.color || '#22c55e';
        var color = contrastSafeAccent(rawColor, theme['--bg']);
        var accentOn = isLight(color) ? '#0a0a0a' : '#f3fff3';
        var accentText = readableAccent(color);

        var css = [];

        // ---- :root variables ----
        var rootDecls = [];
        Object.keys(theme).forEach(function (k) {
            if (k.indexOf('--') === 0) rootDecls.push(k + ':' + theme[k] + ';');
        });
        rootDecls.push('--accent:' + color + ';');
        rootDecls.push('--accent-hover:' + shade(color, -0.15) + ';');
        rootDecls.push('--accent-dim:' + hexToRgba(color, 0.12) + ';');
        rootDecls.push('--accent-glow:' + hexToRgba(color, 0.33) + ';');
        rootDecls.push('--border:' + hexToRgba(color, 0.35) + ';');
        rootDecls.push('--border-strong:' + hexToRgba(color, 0.6) + ';');
        rootDecls.push('--accent-on:' + accentOn + ';');
        rootDecls.push('--accent-text:' + accentText + ';');
        css.push(':root{' + rootDecls.join('') + '}');

        // ---- Force accent-as-text contexts to use accent-text ----
        css.push(
            '.nav-brand::before,.nav-brand .accent,.nav-brand .cursor,'
            + '.nav-links a::before,.nav-links a.active,'
            + '.subnav a:hover,.subnav a.active,.subnav a.active::before,.subnav a.active::after,'
            + '.sysbar .title .accent,.sysbar .right .ok,'
            + '.btn-outline,.btn-ghost:hover,'
            + '.product-card-index,.product-card-seller::before,'
            + '.payload-head .name,.payload-title::before,'
            + '.payload-meta .count::before,.payload-meta .price,.payload-meta .price::before,'
            + '.sec-prompt::before,.sec-prompt .accent,.sec-title::before,.sec-link,'
            + '.stat-num,.stat-key::before,.stat-label::before,'
            + '.cta-section h2::before,.cta-section h2 .accent,'
            + '.mid-cta .big,'
            + '.readme-head::before,.readme-body h3::before,'
            + '.boot-log .ok,.hero-title .prompt,.hero-title .accent,'
            + '.shop-prompt::before,.shop-prompt .accent,'
            + '.filter-tab.active,.filter-tab.active::before,.filter-tab.active::after,'
            + '.popup-brand::before,.search-wrap::before,'
            + '.product-card-price,.cat-strip a.active,.cat-strip a.active::before,.cat-strip a.active::after'
            + '{color:var(--accent-text) !important;}'
        );

        // Borders / backgrounds tied to accent
        css.push(
            '.sysbar,.nav,.cat-strip a.active,.filter-tab.active,.subnav a.active'
            + '{border-color:var(--accent) !important;}'
        );
        css.push('.product-card-index{border-color:var(--accent) !important;}');
        css.push('.product-card:hover{border-color:var(--accent) !important;box-shadow:0 0 0 1px var(--accent),0 0 20px var(--accent-glow) !important;}');
        css.push('.payload:hover{border-color:var(--accent) !important;box-shadow:0 0 24px var(--accent-glow) !important;}');
        css.push('.side-btn:hover{color:var(--accent-text) !important;border-color:var(--accent) !important;box-shadow:0 0 12px var(--accent-glow) !important;}');

        // Backgrounds on accent (buttons, badges, CTA, popup header)
        css.push(
            '.nav-cta,.nav-links a.active,.btn-primary,.product-card-badge,'
            + '.popup-head,.search-wrap button,'
            + '.sysbar .dots span:nth-child(3),.sysbar .right .ok::before'
            + '{background:' + color + ' !important;color:' + accentOn + ' !important;}'
        );
        css.push('.btn-outline{border-color:' + color + ' !important;}');
        css.push('.btn-outline:hover{background:' + color + ' !important;color:' + accentOn + ' !important;}');
        css.push('.btn-primary:hover{background:' + shade(color, -0.15) + ' !important;}');
        css.push('.btn-primary{border-color:' + color + ' !important;}');
        css.push('.mid-cta{border-top-color:' + color + ' !important;border-bottom-color:' + color + ' !important;}');

        // Scanline + vignette overlay tints
        css.push('body::before{background:repeating-linear-gradient(0deg,transparent 0 1px,' + theme.scanlineRgba + ' 1px 2px) !important;}');
        css.push('body::after{background:radial-gradient(ellipse at center,transparent 30%,' + theme.vignetteRgba + ' 100%) !important;}');

        // Nav background
        css.push('.nav{background:' + theme.navBg + ' !important;}');
        css.push('.mobile-menu{background:' + theme.mobileMenuBg + ' !important;}');

        // Hero background image filter — match accent hue (slight tint)
        var c = hexToRgb(color);
        if (c) {
            css.push('.hero-bg-cell::after{background:linear-gradient(180deg,transparent 60%,rgba(' + c.r + ',' + c.g + ',' + c.b + ',0.18)) !important;}');
        }

        // Font override (display + body + mono all switch — keeps terminal feel
        // if user picks a mono font, but lets them go sci-fi-display if they want)
        if (state.font && FONTS[state.font]) {
            css.push(':root{--font-display:' + FONTS[state.font] + ' !important;}');
            css.push('.hero-title,.sec-title,.cta-section h2,.popup h2,.nav-brand,.stat-num,.mid-cta .big,.payload-title,.readme-body h3{font-family:' + FONTS[state.font] + ' !important;}');
        }

        return css.join('\n');
    }

    // ============================================================
    // Apply state to DOM
    // ============================================================
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
        var sufs = ['locker', 'finds', 'world', 'store', 'house', 'mart', 'shop', 'club', 'spot', 'mode', 'co', 'buy', 'os'];
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

    function applyBrand(state) {
        document.querySelectorAll('.nav-brand').forEach(function (el) {
            if (ORIG.brandHTML === null) ORIG.brandHTML = el.innerHTML;
        });
        document.querySelectorAll('.footer-brand').forEach(function (el) {
            if (ORIG.footerBrandHTML === null) ORIG.footerBrandHTML = el.innerHTML;
        });

        var brand = state.brand;
        var logo = state.logo;
        var brandHTML = brand ? (renderSplitBrandHTML(brand) + '<span class="cursor"></span>') : ORIG.brandHTML;

        function logoHTML() {
            if (!logo) return '';
            return '<img src="' + escapeHtml(logo) + '" alt="' + escapeHtml(brand || 'logo') + '" '
                + 'style="height:24px;max-height:24px;width:auto;max-width:120px;display:inline-block;vertical-align:middle;object-fit:contain;margin-right:8px;flex-shrink:0;filter:drop-shadow(0 0 4px var(--accent-glow));" '
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
                  + 'style="height:20px;max-height:20px;width:auto;max-width:100px;display:inline-block;vertical-align:middle;object-fit:contain;margin-right:6px;flex-shrink:0;" '
                  + 'onerror="this.style.display=\'none\'">'
                : '';
            var fBrand = brand ? renderSplitBrandHTML(brand) : ORIG.footerBrandHTML;
            el.innerHTML = fLogo + fBrand;
        });

        try { document.title = (brand || 'Preview') + ' :: preview'; } catch (e) {}
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
        b.textContent = '> PREVIEW';
        b.style.cssText = 'position:fixed;bottom:14px;left:14px;z-index:9999;padding:4px 10px;background:var(--accent);color:var(--accent-on);font-family:monospace;font-size:9px;font-weight:700;letter-spacing:2px;pointer-events:none;';
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
            color: qs.get('color') || '#22c55e',
            theme: qs.get('theme') || 'dark',
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

    // Preserve preview params across in-page navigation
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
