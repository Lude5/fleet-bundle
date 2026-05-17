/* Kai preview-mode runtime — v2
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
 *   theme=dark|light|mono   swap the entire color theme
 *   font=anton|bebas|playfair|space|jetbrains|inter|dmserif|syne
 *   logo=URL        put a logo image in nav-brand instead of text
 *   hideChrome=1    hide popup + sales notif (cleaner preview)
 *   tagline=text    override hero sub-headline (optional)
 *   ctaText=text    override hero / popup CTA button text (optional)
 */
(function () {
    var qs = new URLSearchParams(window.location.search);
    if (qs.get('pv') !== '1') return;

    // ============================================================
    // 1. Capture original values so we can restore on theme=dark etc.
    // ============================================================
    var ORIG = {
        brandHTML: null,           // nav-brand innerHTML captured once
        footerBrandHTML: null,
    };

    // ============================================================
    // 2. Helpers
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
        if (!c) return 'rgba(6,182,212,' + a + ')';
        return 'rgba(' + c.r + ',' + c.g + ',' + c.b + ',' + a + ')';
    }
    // luminance to decide if text-on-accent should be black or white
    function isLight(hex) {
        var c = hexToRgb(hex);
        if (!c) return false;
        var lum = (0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b) / 255;
        return lum > 0.6;
    }
    // Shade a hex color. amount: -1..0 darkens, 0..1 lightens.
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
    // Pick a version of the accent that contrasts against the page background.
    function readableAccent(hex, themeName) {
        var c = hexToRgb(hex);
        if (!c) return hex;
        var lum = (0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b) / 255;
        var darkBg = themeName !== 'light';
        if (darkBg) {
            // Dark bg → if accent is very dark, lighten so it shows up
            if (lum < 0.18) return shade(hex, 0.55);
            return hex;
        } else {
            // Light bg → if accent is very light, darken so it shows up
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

    // ============================================================
    // 3. Theme palettes
    // ============================================================
    var THEMES = {
        dark: {
            '--bg':            '#0b0b0b',
            '--surface':       '#141414',
            '--surface-2':     '#1c1c1c',
            '--surface-3':     '#262626',
            '--text':          '#ffffff',
            '--text-secondary':'rgba(255,255,255,0.6)',
            '--text-muted':    'rgba(255,255,255,0.3)',
            '--border-subtle': 'rgba(255,255,255,0.06)',
            navBg:             'rgba(11,11,11,0.9)',
            mobileMenuBg:      'rgba(0,0,0,0.95)',
            heroOverlayR:      '11,11,11',
            heroOverlayMid:    '0.4',  // center opacity of hero gradient (where the title sits)
            heroOverlayEdge:   '0.95',
            heroTextShadow:    '0 4px 40px rgba(0,0,0,0.5)',
            heroSubShadow:     '0 2px 16px rgba(0,0,0,0.4)',
        },
        light: {  // editorial natural — gallery-white near-paper
            '--bg':            '#fafaf8',
            '--bg-2':          '#f0efeb',
            '--paper':         '#ffffff',
            '--surface':       '#ffffff',
            '--surface-2':     '#f0efeb',
            '--surface-3':     '#e6e4df',
            '--text':          '#050505',
            '--text-secondary':'#2a2a2a',
            '--text-muted':    '#8a8a8a',
            '--rule':          '#050505',
            '--rule-soft':     'rgba(5,5,5,0.12)',
            '--rule-faint':    'rgba(5,5,5,0.05)',
            '--border-subtle': 'rgba(5,5,5,0.08)',
            navBg:             '#fafaf8',
            mobileMenuBg:      '#fafaf8',
            heroOverlayR:      '250,250,248',
            heroOverlayMid:    '0.7',
            heroOverlayEdge:   '1',
            heroTextShadow:    'none',
            heroSubShadow:     'none',
        },
        mono: {
            '--bg':            '#000000',
            '--surface':       '#0a0a0a',
            '--surface-2':     '#121212',
            '--surface-3':     '#1a1a1a',
            '--text':          '#ffffff',
            '--text-secondary':'rgba(255,255,255,0.75)',
            '--text-muted':    'rgba(255,255,255,0.4)',
            '--border-subtle': 'rgba(255,255,255,0.14)',
            navBg:             'rgba(0,0,0,0.92)',
            mobileMenuBg:      'rgba(0,0,0,0.97)',
            heroOverlayR:      '0,0,0',
            heroOverlayMid:    '0.5',
            heroOverlayEdge:   '1',
            heroTextShadow:    '0 4px 40px rgba(0,0,0,0.7)',
            heroSubShadow:     '0 2px 16px rgba(0,0,0,0.5)',
        },
    };

    // ============================================================
    // 4. Font presets
    // ============================================================
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
    // 5. Build override CSS for current state
    // ============================================================
    function buildCss(state) {
        var theme = THEMES[state.theme] || THEMES.dark;
        var color = state.color || '#06b6d4';
        color = contrastSafeAccent(color, theme['--bg']);
        var c = hexToRgb(color) || { r: 6, g: 182, b: 212 };
        var accentOn = isLight(color) ? '#000' : '#fff';
        var accentText = readableAccent(color, state.theme);

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
        rootDecls.push('--accent-on:' + accentOn + ';'); // text color on accent buttons
        rootDecls.push('--accent-text:' + accentText + ';');
        css.push(':root{' + rootDecls.join('') + '}');

        // Apply --accent-text to accent-as-text contexts so light accents stay readable
        // on light bg (and vice versa). Buttons that use accent as BG keep --accent.
        css.push('.hero-label,.section-label,.product-card-price,.hero-bg-card-price'
            + ',.nav-links a.active,.cat-tab.active,.sec-link,.stat-num'
            + ',.popup-label,.pd-source,.pd-source .src-dot,.pd-price,.sn-time'
            + ',.nav-brand .accent,.footer-brand .accent'
            + '{color:var(--accent-text) !important;}');
        css.push('.nav-links a.active::after,.cat-tab.active{border-bottom-color:var(--accent-text) !important;}');
        css.push('.pd-source .src-dot{background:var(--accent-text) !important;}');

        // ---- hardcoded element overrides ----
        css.push('.nav{background:' + theme.navBg + ' !important;}');
        css.push('.mobile-menu{background:' + theme.mobileMenuBg + ' !important;}');

        // Hero overlay — kai literally writes rgba(11,11,11,...) gradients; rebuild them with the theme's bg color
        var R = theme.heroOverlayR;
        var Mid = theme.heroOverlayMid;
        var Edge = theme.heroOverlayEdge;
        css.push('.hero-overlay{background:'
            + 'linear-gradient(to right, rgba(' + R + ',' + Edge + ') 0%, rgba(' + R + ',' + (parseFloat(Edge) * 0.85) + ') 18%, rgba(' + R + ',' + (parseFloat(Mid) + 0.05) + ') 40%, rgba(' + R + ',' + Mid + ') 50%, rgba(' + R + ',' + (parseFloat(Mid) + 0.05) + ') 60%, rgba(' + R + ',' + (parseFloat(Edge) * 0.85) + ') 82%, rgba(' + R + ',' + Edge + ') 100%),'
            + 'linear-gradient(to bottom, rgba(' + R + ',' + (parseFloat(Edge) * 0.95) + ') 0%, rgba(' + R + ',' + Mid + ') 30%, rgba(' + R + ',' + (parseFloat(Mid) - 0.05) + ') 50%, rgba(' + R + ',' + Mid + ') 70%, rgba(' + R + ',' + Edge + ') 100%)'
            + ' !important;}');

        // Hero text shadows that look terrible on light
        css.push('.hero-title{text-shadow:' + theme.heroTextShadow + ' !important;}');
        css.push('.hero-sub{text-shadow:' + theme.heroSubShadow + ' !important;}');

        // Buttons that put text on accent — switch to black text if accent is light (e.g. white/yellow)
        css.push(
            '.nav-cta,.hero-signup,.btn-primary,.product-card-buy,.product-card-badge,.mid-cta a,.mid-cta a span'
            + '{color:' + accentOn + ' !important;}'
        );
        css.push('.mid-cta{background:' + color + ' !important;}');
        css.push('.mid-cta a span:last-child{color:' + (isLight(color) ? 'rgba(0,0,0,0.7)' : 'rgba(255,255,255,0.8)') + ' !important;}');

        // pd-buy (white "Buy" button in product modal): in light theme, flip so it doesn't blend into the white modal
        if (state.theme === 'light') {
            css.push('.pd-buy{background:#0a0a0b !important;color:#ffffff !important;}');
            css.push('.popup-overlay,.pd-overlay{background:rgba(0,0,0,0.55) !important;}');
        }

        // ---- Font override ----
        if (state.font && FONTS[state.font]) {
            css.push(':root{--font-display:' + FONTS[state.font] + ' !important;}');
            // Some elements use inline font-family that bypasses var()
            css.push('.hero-title,.section-title,.sec-title,.cta-section h2,.popup h2,.pd-title,.footer-brand,.nav-brand,.stat-num,.mid-cta a{font-family:' + FONTS[state.font] + ' !important;}');
        }

        return css.join('\n');
    }

    // ============================================================
    // 6. Apply state to DOM (CSS + brand text + logo)
    // ============================================================
    function applyCss(state) {
        var existing = document.getElementById('kai-preview-overrides');
        if (existing) existing.remove();
        var st = document.createElement('style');
        st.id = 'kai-preview-overrides';
        st.textContent = buildCss(state);
        document.head.appendChild(st);
    }

    // Smart brand split — preserves the kai "name<span.accent>finds</span>" two-tone effect.
    // Rule: if brand contains a space, the LAST WORD becomes accent.
    //       else for 3+ chars, look for known suffixes (finds/shop/club/finds/co/buy/store/locker/mart/world).
    //       else split at midpoint.
    //       else (<=2 chars), no split.
    function splitBrand(brand) {
        var b = String(brand || '').trim();
        if (!b) return null;

        // Space separator: "Mimi Finds" → "Mimi " + "Finds"
        if (b.indexOf(' ') !== -1) {
            var parts = b.split(/\s+/);
            return { plain: parts.slice(0, -1).join(' ') + ' ', accent: parts[parts.length - 1] };
        }

        // Camel case: "MimiFinds" → "Mimi" + "Finds"
        var camel = b.match(/^([A-Z][a-z]+)([A-Z][a-zA-Z]+)$/);
        if (camel) return { plain: camel[1], accent: camel[2] };

        // Known suffixes (case-insensitive, longest first)
        var sufs = ['locker', 'finds', 'world', 'store', 'house', 'mart', 'shop', 'club', 'spot', 'co', 'buy'];
        var lower = b.toLowerCase();
        for (var i = 0; i < sufs.length; i++) {
            if (lower.length > sufs[i].length && lower.endsWith(sufs[i])) {
                var splitAt = b.length - sufs[i].length;
                return { plain: b.slice(0, splitAt), accent: b.slice(splitAt) };
            }
        }

        // Midpoint split for 3+ char names
        if (b.length >= 3) {
            var mid = Math.ceil(b.length / 2);
            return { plain: b.slice(0, mid), accent: b.slice(mid) };
        }

        return { plain: b, accent: '' };
    }

    function applyBrand(state) {
        // Capture originals on first run so we can restore
        document.querySelectorAll('.nav-brand').forEach(function (el) {
            if (ORIG.brandHTML === null) ORIG.brandHTML = el.innerHTML;
        });
        document.querySelectorAll('.footer-brand').forEach(function (el) {
            if (ORIG.footerBrandHTML === null) ORIG.footerBrandHTML = el.innerHTML;
        });

        var brand = state.brand;
        var logo = state.logo;
        var brandHTML = brand ? renderSplitBrandHTML(brand) : ORIG.brandHTML;

        // Build a logo <img> element string when logo URL is set
        function logoHTML() {
            if (!logo) return '';
            return '<img src="' + escapeHtml(logo) + '" alt="' + escapeHtml(brand || 'logo') + '" '
                + 'style="height:32px;max-height:32px;width:auto;max-width:140px;display:inline-block;vertical-align:middle;object-fit:contain;margin-right:10px;flex-shrink:0;" '
                + 'onerror="this.style.display=\'none\'">';
        }

        document.querySelectorAll('.nav-brand').forEach(function (el) {
            // Make nav-brand a flex row so logo + text align cleanly
            el.style.display = 'inline-flex';
            el.style.alignItems = 'center';
            el.innerHTML = logoHTML() + brandHTML;
        });

        document.querySelectorAll('.footer-brand').forEach(function (el) {
            el.style.display = 'inline-flex';
            el.style.alignItems = 'center';
            // Footer logo a bit smaller
            var fLogo = logo
                ? '<img src="' + escapeHtml(logo) + '" alt="' + escapeHtml(brand || 'logo') + '" '
                  + 'style="height:24px;max-height:24px;width:auto;max-width:100px;display:inline-block;vertical-align:middle;object-fit:contain;margin-right:8px;flex-shrink:0;" '
                  + 'onerror="this.style.display=\'none\'">'
                : '';
            var fBrand = brand ? renderSplitBrandHTML(brand, false, 'color:var(--accent);') : ORIG.footerBrandHTML;
            el.innerHTML = fLogo + fBrand;
        });

        // Update document title
        try { document.title = (brand || 'Preview') + ' — preview'; } catch (e) {}
    }

    function escapeHtml(s) {
        return String(s).replace(/[&<>"']/g, function (c) {
            return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
        });
    }
    function renderSplitBrandHTML(brand, isRaw, accentInline) {
        if (isRaw) return brand;
        var split = splitBrand(brand);
        if (!split) return '';
        var accentStyle = accentInline || '';
        var accentSpan = split.accent
            ? '<span class="accent"' + (accentStyle ? ' style="' + accentStyle + '"' : '') + '>' + escapeHtml(split.accent) + '</span>'
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
        // Anchor to bottom-left so it doesn't overlap the nav-brand
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

    // ============================================================
    // 7. State init from URL
    // ============================================================
    // If the URL has no override params (just ?pv=1), don't touch the page —
    // the iframe should look identical to the natural deployed site. Overrides
    // only kick in once the studio sends an explicit value.
    var OVERRIDE_KEYS = ['brand', 'color', 'theme', 'font', 'logo', 'hideChrome'];
    function urlHasAnyOverride() {
        for (var i = 0; i < OVERRIDE_KEYS.length; i++) {
            if (qs.has(OVERRIDE_KEYS[i])) return true;
        }
        return false;
    }
    function readState() {
        return {
            brand: qs.get('brand') || '',
            color: qs.get('color') || '#8a1c1c',
            theme: qs.get('theme') || 'light',
            font: qs.get('font') || '',
            logo: qs.get('logo') || '',
            hideChrome: qs.get('hideChrome') === '1',
        };
    }

    var state = readState();
    var hasOverrideOnLoad = urlHasAnyOverride();

    if (hasOverrideOnLoad) applyCss(state);

    function onReady() {
        if (hasOverrideOnLoad) { applyBrand(state); applyChrome(state); }
        ensurePreviewBadge();
    }
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', onReady);
    } else {
        onReady();
    }

    // ============================================================
    // 8. Live updates from parent window
    // ============================================================
    window.addEventListener('message', function (e) {
        if (!e.data || typeof e.data !== 'object') return;
        if (e.data.type !== 'kai-preview-update') return;
        var patch = e.data.payload || {};
        // Merge patch into state — undefined/null clears, empty string clears
        ['brand', 'color', 'theme', 'font', 'logo', 'hideChrome'].forEach(function (k) {
            if (k in patch) state[k] = patch[k];
        });
        // Re-apply
        apply(state);
        // Update URL bar (without reload) so a hard refresh keeps state
        try {
            var u = new URL(window.location.href);
            ['brand', 'color', 'theme', 'font', 'logo'].forEach(function (k) {
                if (state[k]) u.searchParams.set(k, state[k]); else u.searchParams.delete(k);
            });
            if (state.hideChrome) u.searchParams.set('hideChrome', '1'); else u.searchParams.delete('hideChrome');
            u.searchParams.set('pv', '1');
            window.history.replaceState(null, '', u.toString());
        } catch (err) {}

        // Acknowledge so the parent can update its UI ("applied 250ms ago")
        try {
            if (e.source && e.source.postMessage) {
                e.source.postMessage({ type: 'kai-preview-applied', state: state }, '*');
            }
        } catch (err) {}
    });

    // Let the parent know we're ready
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
        } catch (err) {}
    }, true);
})();
