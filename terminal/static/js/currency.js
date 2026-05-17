/* Currency converter — converts every [data-price-usd] element to the selected currency.
   Rates cached in localStorage for 12h; source: open.er-api.com (no key). */
(function () {
    var CURRENCIES = {
        USD: { symbol: '$',  decimals: 2, before: true },
        CNY: { symbol: '¥',  decimals: 0, before: true },
        EUR: { symbol: '€',  decimals: 2, before: true },
        GBP: { symbol: '£',  decimals: 2, before: true },
        CAD: { symbol: 'C$', decimals: 2, before: true },
    };
    var STORAGE_KEY_CUR = 'currency';
    var STORAGE_KEY_RATES = 'fx_rates_v1';
    var CACHE_MS = 12 * 3600 * 1000; // 12h
    var current = localStorage.getItem(STORAGE_KEY_CUR) || 'USD';
    if (!CURRENCIES[current]) current = 'USD';
    var rates = { USD: 1 };

    function fmt(usd, code) {
        var c = CURRENCIES[code] || CURRENCIES.USD;
        var rate = rates[code] || 1;
        var v = usd * rate;
        var str = v.toLocaleString(undefined, {
            minimumFractionDigits: c.decimals,
            maximumFractionDigits: c.decimals
        });
        return c.before ? c.symbol + str : str + c.symbol;
    }

    function applyAll() {
        document.querySelectorAll('[data-price-usd]').forEach(function (el) {
            var v = parseFloat(el.dataset.priceUsd);
            if (isNaN(v)) return;
            el.textContent = fmt(v, current);
        });
        document.querySelectorAll('[data-currency-label]').forEach(function (el) {
            el.textContent = current;
        });
    }

    function loadCachedRates() {
        try {
            var raw = localStorage.getItem(STORAGE_KEY_RATES);
            if (!raw) return null;
            var data = JSON.parse(raw);
            if (!data || !data.rates || !data.ts) return null;
            if (Date.now() - data.ts > CACHE_MS) return null;
            return data.rates;
        } catch (e) { return null; }
    }

    function saveRates(r) {
        try { localStorage.setItem(STORAGE_KEY_RATES, JSON.stringify({ rates: r, ts: Date.now() })); } catch (e) {}
    }

    function fetchRates() {
        var cached = loadCachedRates();
        if (cached) { rates = cached; applyAll(); return; }
        // open.er-api.com is CORS-enabled, no key, USD base
        fetch('https://open.er-api.com/v6/latest/USD').then(function (r) { return r.json(); }).then(function (data) {
            if (data && data.rates) {
                var picked = { USD: 1 };
                Object.keys(CURRENCIES).forEach(function (code) {
                    if (data.rates[code]) picked[code] = data.rates[code];
                });
                rates = picked;
                saveRates(picked);
                applyAll();
            }
        }).catch(function () { /* offline / blocked → prices stay USD */ });
    }

    window.setCurrency = function (code) {
        if (!CURRENCIES[code]) return;
        current = code;
        localStorage.setItem(STORAGE_KEY_CUR, code);
        applyAll();
        // Close the dropdown if open
        var menu = document.getElementById('currencyMenu');
        if (menu) menu.classList.remove('open');
    };

    window.toggleCurrencyMenu = function () {
        var menu = document.getElementById('currencyMenu');
        if (menu) menu.classList.toggle('open');
    };

    // Close dropdown when clicking outside
    document.addEventListener('click', function (e) {
        var menu = document.getElementById('currencyMenu');
        if (!menu) return;
        if (!e.target.closest('.currency-switcher')) menu.classList.remove('open');
    });

    // Initial paint with USD, then fetch rates
    document.addEventListener('DOMContentLoaded', function () {
        applyAll();
        fetchRates();
    });

    // Expose for late-injected content (admin / dynamic)
    window.refreshCurrencyPrices = applyAll;
})();
