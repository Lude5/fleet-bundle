/* ============================================================
   Immersive IN-PLACE site editor (injected into the live site iframe).
   BATCH model: every edit applies INSTANTLY in the page (optimistic) and
   is queued; a floating "Save changes" bar commits everything in one go
   (products in a single bulk request). Nothing blocks while you edit.
   ============================================================ */
(function () {
  if (window.__STUDIO_EDITOR_LOADED) { try { window.__seRescan(); } catch (e) {} return; }
  window.__STUDIO_EDITOR_LOADED = true;

  var CFG = window.__STUDIO__ || {};
  var SITE = CFG.siteId || '';
  var PID = (typeof window.PID !== 'undefined') ? window.PID : null;
  // Draft "Add product" page: the full product layout, blank + editable. All
  // edits accumulate in DRAFT (no PID yet); "Add product" creates it for real.
  var DRAFT_MODE = !!window.PP_DRAFT;
  var DRAFT = { images: [] };
  var SITEROOT = (location.pathname.match(/^\/[a-z0-9_-]+/i) || [''])[0]; // e.g. /ategoat
  if (SITEROOT === '/product' || SITEROOT === '/shop') SITEROOT = '';
  var CATS = [];
  var dragEl = null;
  var selectMode = false, selected = {};  // bulk select: pid -> card
  var D = document, B = D.body;
  var pending = { products: {}, settings: {}, order: null };
  var PKEY = 'se_pending_' + SITE; // unsaved edits survive crashes / cold-starts

  // Auto-retries 5xx + network errors with backoff so a Render cold-start
  // (slow first hit) doesn't fail an otherwise-valid save.
  function jfetch(path, method, body, _t) {
    _t = _t || 0;
    return fetch(path, { method: method || 'GET', headers: { 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined, credentials: 'same-origin' })
      .then(function (r) {
        // The control-plane gate 302s unauthenticated calls to /login; fetch
        // follows it and we land on the HTML login page. Detect that and tell
        // the user plainly instead of a confusing "failed" with unparseable HTML.
        if (r.redirected && /\/login/.test(r.url || '')) {
          status('Session expired — reload Studio and log in again', 'error');
          return { ok: false, error: 'Session expired — reload Studio and log in again', _auth: 1 };
        }
        if (!r.ok && r.status >= 500 && _t < 3) return new Promise(function (res) { setTimeout(res, 1500 * (_t + 1)); }).then(function () { return jfetch(path, method, body, _t + 1); });
        return r.json().catch(function () { return { ok: r.ok }; });
      })
      .catch(function (e) {
        if (_t < 3) return new Promise(function (res) { setTimeout(res, 1500 * (_t + 1)); }).then(function () { return jfetch(path, method, body, _t + 1); });
        throw e;
      });
  }
  function status(msg, kind) { try { (window.parent.StudioStatus || function () {})(msg, kind); } catch (e) {} }
  function esc(s) { return (s == null ? '' : String(s)).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
  function isPlaceholder(t) { t = (t || '').replace('✎', '').trim(); return t === '' || t === '—' || t === 'Unspecified' || t === '— no buy link set —'; }
  function mkPen() { var p = D.createElement('span'); p.className = 'se-pen'; p.textContent = '✎'; return p; }
  // prefix /uploads with the site root for DISPLAY; guard against double-prefix
  function imgSrc(u) {
    if (!u || u.charAt(0) !== '/') return u;
    if (SITEROOT && (u === SITEROOT || u.indexOf(SITEROOT + '/') === 0)) return u; // already prefixed
    return SITEROOT + u;
  }
  // strip the site-root prefix so we STORE/persist the raw path the site serves
  function rawSrc(u) {
    if (u && SITEROOT && u.indexOf(SITEROOT + '/') === 0) return u.slice(SITEROOT.length);
    return u;
  }
  function uploadImg(pid, file, primary) {
    // Draft has no product id yet — store the file under a 'draft' bucket; the
    // returned /uploads URL is kept in DRAFT and attached when the product is created.
    pid = pid || (DRAFT_MODE ? 'draft' : '');
    var fd = new FormData(); fd.append('file', file);
    return fetch('/upload/' + SITE + '/' + encodeURIComponent(pid) + (primary === false ? '?primary=0' : ''), { method: 'POST', body: fd, credentials: 'same-origin' })
      .then(function (r) { return r.json(); }).catch(function () { return { ok: false, error: 'network error' }; });
  }
  function toast(msg, actionLabel, onAction) {
    var t = D.createElement('div'); t.className = 'se-toast';
    t.innerHTML = '<span>' + esc(msg) + '</span>' + (actionLabel ? '<button>' + esc(actionLabel) + '</button>' : '');
    B.appendChild(t); var done = false;
    function close() { if (done) return; done = true; t.style.opacity = '0'; setTimeout(function () { t.remove(); }, 300); }
    if (actionLabel) t.querySelector('button').onclick = function () { onAction && onAction(); close(); };
    setTimeout(close, 6500); return t;
  }
  function confirmBox(anchor, message, onYes) {
    mini(anchor, '<span style="font-size:13px;">' + esc(message) + '</span><button class="ok" style="background:#ef4444;">Delete</button>', function () { closeMini(); onYes(); });
  }

  /* ---------- pending changes ---------- */
  function recordProduct(id, partial) { if (DRAFT_MODE) { Object.keys(partial).forEach(function (k) { DRAFT[k] = partial[k]; }); return; } if (!id) return; var p = pending.products[id] || (pending.products[id] = {}); Object.keys(partial).forEach(function (k) { p[k] = partial[k]; }); refreshBar(); }
  function recordSetting(key, val) { pending.settings[key] = val; refreshBar(); }
  function dirtyCount() { var n = 0; Object.keys(pending.products).forEach(function (id) { n += Object.keys(pending.products[id]).length; }); return n + Object.keys(pending.settings).length + (pending.order ? 1 : 0); }
  function refreshBar() {
    var bar = D.getElementById('se-bar'); if (!bar) return;
    var n = dirtyCount();
    bar.classList.toggle('show', n > 0);
    var c = bar.querySelector('.cnt'); if (c) c.textContent = '● ' + n + ' unsaved change' + (n === 1 ? '' : 's');
    try { if (n) localStorage.setItem(PKEY, JSON.stringify(pending)); } catch (e) {}  // cleared only on explicit save/dismiss
  }
  function showRecover(saved) {
    var n = Object.keys(saved.products || {}).reduce(function (a, id) { return a + Object.keys(saved.products[id]).length; }, 0) + Object.keys(saved.settings || {}).length + (saved.order ? 1 : 0);
    if (!n) return;
    var r = D.createElement('div'); r.className = 'se-recover';
    r.innerHTML = '<span>↩ ' + n + ' unsaved change' + (n === 1 ? '' : 's') + ' from earlier</span><button class="rsave">Save them</button><button class="rdismiss">Dismiss</button>';
    B.appendChild(r);
    r.querySelector('.rsave').onclick = function () { pending = { products: saved.products || {}, settings: saved.settings || {}, order: saved.order || null }; refreshBar(); r.remove(); flush(); };
    r.querySelector('.rdismiss').onclick = function () { try { localStorage.removeItem(PKEY); } catch (e) {} r.remove(); };
  }
  function flush() {
    var ops = [], labels = [];
    var prodMap = {};
    Object.keys(pending.products).forEach(function (pid) { prodMap[pid] = Object.assign({}, pending.products[pid]); });
    if (pending.order) { pending.order.forEach(function (pid, i) { (prodMap[pid] = prodMap[pid] || {}).position = i; }); }
    var updates = Object.keys(prodMap).map(function (pid) { return Object.assign({ id: pid }, prodMap[pid]); });
    if (updates.length) { ops.push(jfetch('/products/' + SITE + '/bulk', 'POST', { updates: updates })); labels.push('products'); }
    if (Object.keys(pending.settings).length) { ops.push(jfetch('/content/' + SITE, 'POST', pending.settings)); labels.push('content'); }
    if (!ops.length) return Promise.resolve(true);
    status('Saving ' + dirtyCount() + ' change' + (dirtyCount() === 1 ? '' : 's') + '…');
    var saveBtn = D.querySelector('#se-bar .save'); if (saveBtn) { saveBtn.disabled = true; saveBtn.textContent = 'Saving…'; }
    return Promise.all(ops).then(function (res) {
      var ok = res.every(function (r) { return r && r.ok; });
      if (saveBtn) { saveBtn.disabled = false; saveBtn.textContent = 'Save changes'; }
      if (ok) { pending = { products: {}, settings: {}, order: null }; try { localStorage.removeItem(PKEY); } catch (e) {} refreshBar(); status('All changes saved ✓', 'success'); return true; }
      status('Some changes failed — try again', 'error'); return false;
    }).catch(function () { if (saveBtn) { saveBtn.disabled = false; saveBtn.textContent = 'Save changes'; } status('Network error — NOT saved', 'error'); return false; });
  }
  function navTo(href) { if (dirtyCount()) flush().then(function () { location.href = href; }); else location.href = href; }

  /* ---------- styles ---------- */
  var css = D.createElement('style');
  css.textContent = [
    '.se-ed-h{position:relative;outline:1.5px dashed rgba(99,102,241,.5);outline-offset:3px;border-radius:3px;transition:outline-color .12s;}',
    '.se-ed-h:hover{outline-color:#6366f1;outline-style:solid;cursor:pointer;}',
    '.se-now{outline:2px solid #22c55e!important;outline-offset:3px;background:rgba(34,197,94,.08);cursor:text;}',
    '.se-pen{position:absolute;top:-11px;right:-11px;width:25px;height:25px;border-radius:50%;background:#6366f1;color:#fff;border:2px solid #fff;display:none;align-items:center;justify-content:center;font-size:12px;cursor:pointer;z-index:2147483000;box-shadow:0 2px 8px rgba(0,0,0,.35);}',
    '.se-ed-h:hover>.se-pen,.se-pen.force{display:flex;}',
    '.product-card.se-card{position:relative;}',
    '.se-ptools{position:absolute;top:8px;right:8px;display:none;gap:5px;z-index:2147483000;}',
    '.product-card.se-card:hover .se-ptools{display:flex;}',
    '.se-pbtn{width:30px;height:30px;border-radius:8px;border:none;background:rgba(17,17,17,.82);color:#fff;font-size:14px;cursor:pointer;display:flex;align-items:center;justify-content:center;backdrop-filter:blur(6px);box-shadow:0 2px 8px rgba(0,0,0,.35);}',
    '.se-pbtn:hover{background:#6366f1;}.se-pbtn.on{background:#f59e0b;}.se-pbtn.grab{cursor:grab;}',
    '.product-card.se-dragging{opacity:.4;}.product-card.se-over{outline:2px solid #6366f1;outline-offset:-2px;}',
    /* numbered position badge (visible in edit mode; click to set exact position) */
    '.se-posbadge{position:absolute;top:8px;left:8px;z-index:2147483001;min-width:26px;height:26px;padding:0 7px;border-radius:9px;background:rgba(99,102,241,.96);color:#fff;font:800 13px/26px system-ui;text-align:center;cursor:pointer;box-shadow:0 2px 9px rgba(0,0,0,.45);border:1.5px solid rgba(255,255,255,.9);user-select:none;display:none;transition:transform .12s,background .12s;}',
    'body.se-editing .product-card.se-card .se-posbadge{display:block;}',
    '.se-posbadge:hover{background:#4f46e5;transform:scale(1.08);}',
    'body.se-selecting .se-posbadge{display:none!important;}',
    '.se-posbadge input{width:60px;height:24px;border:none;border-radius:6px;background:#0f0f14;color:#fff;font:800 13px system-ui;text-align:center;outline:2px solid #fff;padding:0;-moz-appearance:textfield;}',
    '.se-posbadge input::-webkit-outer-spin-button,.se-posbadge input::-webkit-inner-spin-button{-webkit-appearance:none;margin:0;}',
    /* redesigned "move product" popover */
    '.se-mvbox{width:236px;display:flex;flex-direction:column;}',
    '.se-mvbox .mp-h{font:800 15px system-ui;margin-bottom:2px;}',
    '.se-mvbox .mp-sub{color:#9ca3af;font:600 11px system-ui;margin-bottom:6px;}',
    '.se-mvbox .mp-l{font:700 11px system-ui;color:#cbd5e1;margin:9px 0 4px;}',
    '.se-mvbox .mp-opt{color:#6b7280;font-weight:600;}',
    '.se-mvbox .mp-in{background:#0f0f14;border:1px solid #2a2a35;color:#fff;border-radius:9px;padding:9px 11px;font:14px system-ui;outline:none;width:100%;box-sizing:border-box;}',
    '.se-mvbox .mp-in:focus{border-color:#6366f1;}',
    '.se-mini{position:absolute;z-index:2147483600;background:#16161c;border:1px solid #2a2a35;border-radius:10px;padding:8px;display:flex;gap:6px;align-items:center;box-shadow:0 14px 40px rgba(0,0,0,.55);}',
    '.se-mini input,.se-mini select,.se-mini textarea{background:#0f0f14;border:1px solid #2a2a35;color:#fff;border-radius:7px;padding:8px 10px;font:13px system-ui;outline:none;}',
    '.se-mini textarea{min-width:300px;min-height:90px;resize:vertical;}',
    '.se-mini .ok{background:#6366f1;color:#fff;border:none;border-radius:7px;padding:8px 11px;cursor:pointer;font-weight:700;}',
    '.se-modal-bg{position:fixed;inset:0;z-index:2147483600;background:rgba(0,0,0,.6);backdrop-filter:blur(4px);display:flex;align-items:center;justify-content:center;padding:20px;font:14px system-ui;}',
    '.se-modal{background:#16161c;color:#fff;border:1px solid #2a2a35;border-radius:16px;width:520px;max-width:96vw;max-height:88vh;overflow:auto;padding:22px;box-shadow:0 24px 70px rgba(0,0,0,.6);}',
    '.se-modal h3{margin:0 0 4px;font-size:18px;}.se-modal .sub{color:#9ca3af;font-size:12px;margin-bottom:16px;}',
    '.se-cat{display:flex;align-items:center;gap:10px;background:#0f0f14;border:1px solid #2a2a35;border-radius:10px;padding:9px 11px;margin-bottom:8px;}',
    '.se-cat .h{cursor:grab;color:#6b7280;font-size:16px;}.se-cat input{flex:1;background:transparent;border:none;color:#fff;font-size:14px;outline:none;}.se-cat .del{background:none;border:none;color:#ef4444;cursor:pointer;font-size:16px;}',
    '.se-pl{display:block;font-size:11px;color:#9ca3af;margin:12px 0 4px;}.se-ps{width:100%;box-sizing:border-box;background:#0f0f14;border:1px solid #2a2a35;color:#fff;border-radius:8px;padding:9px 10px;font:13px system-ui;outline:none;}',
    '.bs-add{display:flex;align-items:center;justify-content:center;min-height:120px;border:2px dashed #6366f1;border-radius:14px;background:rgba(99,102,241,.08);color:#a5b4fc;font:700 13px system-ui;cursor:pointer;transition:all .12s;}.bs-add:hover{background:rgba(99,102,241,.18);color:#fff;}',
    /* Add-photo tile — sized to match the page thumbnails, sits at the end of the strip */
    '.pp-thumb.se-addthumb,.se-addthumb{display:flex!important;flex-direction:column;align-items:center;justify-content:center;gap:2px;border:2px dashed #6366f1!important;background:rgba(99,102,241,.10)!important;color:#6366f1;cursor:pointer;transition:all .12s;box-sizing:border-box;}',
    '.se-addthumb:hover{background:rgba(99,102,241,.22)!important;color:#fff;}',
    '.se-addthumb .plus{font-size:22px;line-height:1;font-weight:700;}',
    '.se-addthumb .lbl{font:700 7px system-ui;letter-spacing:.5px;text-transform:uppercase;}',
    /* File drop / picker zone (Change main photo · Add photos) */
    '.se-drop{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:4px;width:100%;box-sizing:border-box;padding:26px 16px;margin-bottom:14px;border:2px dashed #6366f1;border-radius:12px;background:rgba(99,102,241,.08);color:#c7d2fe;cursor:pointer;text-align:center;transition:all .12s;}',
    '.se-drop:hover{background:rgba(99,102,241,.18);color:#fff;border-color:#818cf8;}',
    '.se-drop.over{background:rgba(99,102,241,.28);color:#fff;border-color:#a5b4fc;transform:scale(1.01);}',
    '.se-drop .se-drop-ico{font-size:26px;line-height:1;}',
    '.se-drop .se-drop-main{font:700 14px system-ui;}',
    '.se-drop .se-drop-sub{font:500 11px system-ui;color:#9ca3af;}',
    /* Click-to-change main photo: hover hint overlay on the main image */
    '.se-mainphoto{cursor:pointer!important;}',
    '.se-mainphoto-hint{position:absolute;left:0;right:0;bottom:0;padding:9px 10px;background:linear-gradient(0deg,rgba(99,102,241,.96),rgba(99,102,241,0));color:#fff;font:700 12px system-ui;letter-spacing:.4px;text-align:center;opacity:0;transition:opacity .14s;pointer-events:none;z-index:5;display:flex;align-items:center;justify-content:center;gap:6px;}',
    '.se-mainphoto:hover .se-mainphoto-hint{opacity:1;}',
    /* Scrape button — inline at the top of the product info column */
    '.se-scrape-btn{display:inline-flex;align-items:center;gap:7px;margin-bottom:14px;background:#6366f1;color:#fff;border:none;border-radius:10px;padding:10px 16px;font:700 12px system-ui;cursor:pointer;transition:background .12s;box-shadow:0 4px 14px rgba(99,102,241,.35);}',
    '.se-scrape-btn:hover{background:#5457e0;}.se-scrape-btn .ico{font-size:15px;line-height:1;}',
    '.se-galgrid{display:grid;grid-template-columns:repeat(auto-fill,minmax(76px,1fr));gap:8px;margin:8px 0;max-height:42vh;overflow:auto;}',
    '.se-galcell{position:relative;aspect-ratio:1;border-radius:9px;overflow:hidden;background:#fff;border:1px solid #2a2a35;}',
    '.se-galcell img{width:100%;height:100%;object-fit:contain;background:#fff;}',
    '.se-galcell .gx{position:absolute;top:3px;right:3px;width:20px;height:20px;border-radius:50%;background:rgba(17,17,17,.82);color:#fff;border:none;cursor:pointer;font-size:12px;line-height:1;display:flex;align-items:center;justify-content:center;}',
    '.se-galcell .gx:hover{background:#ef4444;}',
    '.se-galcell .gmain{position:absolute;bottom:3px;left:3px;background:rgba(99,102,241,.92);color:#fff;border:none;cursor:pointer;font:700 8px system-ui;padding:3px 5px;border-radius:5px;letter-spacing:.3px;}',
    '.se-galcell .gmain:hover{background:#6366f1;}',
    '.se-galcell.is-main{outline:2px solid #6366f1;outline-offset:-2px;}.se-galcell.is-main .gmain{background:#22c55e;}',
    '.se-var{display:flex;gap:8px;align-items:center;background:#0f0f14;border:1px solid #2a2a35;border-radius:10px;padding:8px;margin-bottom:8px;}.se-var .h{cursor:grab;color:#6b7280;}.se-var input{background:#16161c;border:1px solid #2a2a35;color:#fff;border-radius:7px;padding:7px 9px;font:12px system-ui;outline:none;}.se-var .vn{width:110px;}.se-var .vi{flex:1;min-width:0;}.se-var .del{background:none;border:none;color:#ef4444;cursor:pointer;font-size:15px;}',
    '.bs-res{display:flex;align-items:center;gap:10px;padding:8px;border-radius:8px;cursor:pointer;}.bs-res:hover{background:#23232c;}.bs-res img{width:42px;height:42px;object-fit:cover;border-radius:6px;background:#222;flex-shrink:0;}',
    '.se-up{display:inline-flex;align-items:center;gap:4px;background:#23232c;color:#cbd5e1;border:1px solid #2a2a35;border-radius:7px;padding:8px 11px;font:700 12px system-ui;cursor:pointer;white-space:nowrap;}.se-up:hover{border-color:#6366f1;color:#fff;}.se-up-sm{padding:7px 9px;}',
    '.se-uprow{display:flex;gap:6px;align-items:center;margin-top:8px;}',
    '.se-menu{display:flex;flex-direction:column;min-width:172px;}.se-menu button{background:none;border:none;color:#e6e6ea;text-align:left;padding:9px 11px;border-radius:7px;font:600 13px system-ui;cursor:pointer;}.se-menu button:hover{background:#23232c;}.se-menu button.danger{color:#ef4444;}',
    '.se-toast{position:fixed;left:50%;transform:translateX(-50%);bottom:74px;z-index:2147483600;display:flex;align-items:center;gap:12px;background:#16161c;border:1px solid #2a2a35;color:#fff;padding:11px 16px;border-radius:12px;font:600 13px system-ui;box-shadow:0 10px 30px rgba(0,0,0,.5);transition:opacity .3s;}.se-toast button{background:#6366f1;color:#fff;border:none;border-radius:7px;padding:6px 12px;font-weight:700;cursor:pointer;}',
    '.se-selbtn{position:fixed;bottom:18px;left:18px;z-index:2147483550;background:#16161c;border:1px solid #2a2a35;color:#fff;border-radius:999px;padding:10px 16px;font:700 13px system-ui;cursor:pointer;box-shadow:0 6px 20px rgba(0,0,0,.4);}.se-selbtn:hover{border-color:#6366f1;}body.se-selecting .se-selbtn{display:none;}',
    '.se-checkbox{display:none;}body.se-selecting .product-card{cursor:pointer;}body.se-selecting .product-card .se-ptools{display:none!important;}',
    'body.se-selecting .product-card .se-checkbox{display:flex;position:absolute;top:8px;left:8px;width:24px;height:24px;border-radius:50%;border:2px solid #fff;background:rgba(0,0,0,.55);z-index:6;align-items:center;justify-content:center;color:#fff;font:700 13px system-ui;box-shadow:0 2px 6px rgba(0,0,0,.4);}',
    'body.se-selecting .product-card.se-sel .se-checkbox{background:#6366f1;}body.se-selecting .product-card.se-sel .se-checkbox::after{content:"✓";}body.se-selecting .product-card.se-sel{outline:3px solid #6366f1;outline-offset:-3px;border-radius:14px;}',
    'body.se-selecting #se-bar{display:none!important;}',
    '.se-bulk{position:fixed;bottom:0;left:0;right:0;z-index:2147483600;display:none;align-items:center;justify-content:center;gap:8px;padding:12px;background:linear-gradient(0deg,rgba(10,10,13,.98),rgba(10,10,13,.88));backdrop-filter:blur(8px);border-top:1px solid #2a2a35;font:600 13px system-ui;color:#fff;flex-wrap:wrap;}.se-bulk.show{display:flex;}.se-bulk .bcnt{color:#fbbf24;margin-right:6px;}',
    '.se-bulk button{border:none;border-radius:8px;padding:9px 14px;font-weight:700;font-size:12px;cursor:pointer;background:#23232c;color:#e6e6ea;}.se-bulk button:hover{background:#33333e;}.se-bulk button.danger{color:#ef4444;}.se-bulk button.ghost{background:transparent;color:#9ca3af;}',
    '.se-row{display:flex;gap:8px;margin-top:14px;}.se-b{flex:1;border:none;border-radius:8px;padding:10px;font-weight:700;font-size:12px;cursor:pointer;}.se-b.save{background:#6366f1;color:#fff;}.se-b.ghost{background:#23232c;color:#cbd5e1;}',
    '.se-bar{position:fixed;bottom:0;left:0;right:0;z-index:2147483600;display:none;align-items:center;justify-content:center;gap:14px;padding:12px;background:linear-gradient(0deg,rgba(10,10,13,.97),rgba(10,10,13,.85));backdrop-filter:blur(8px);border-top:1px solid #2a2a35;font:600 13px system-ui;color:#fff;}',
    '.se-bar.show{display:flex;}.se-bar .cnt{color:#fbbf24;}',
    '.se-bar button{border:none;border-radius:9px;padding:10px 18px;font-weight:700;font-size:13px;cursor:pointer;}',
    '.se-bar .save{background:#6366f1;color:#fff;}.se-bar .save:hover{background:#4f46e5;}.se-bar .save:disabled{opacity:.6;cursor:default;}.se-bar .disc{background:#23232c;color:#cbd5e1;}',
    '.se-hint{position:fixed;left:50%;transform:translateX(-50%);bottom:70px;background:#6366f1;color:#fff;padding:9px 18px;border-radius:999px;font:600 12px system-ui;z-index:2147483500;box-shadow:0 6px 20px rgba(0,0,0,.4);}',
    '.se-recover{position:fixed;top:14px;left:50%;transform:translateX(-50%);z-index:2147483600;display:flex;align-items:center;gap:12px;background:#1f2937;border:1px solid #f59e0b;color:#fff;padding:10px 14px;border-radius:12px;font:600 13px system-ui;box-shadow:0 10px 30px rgba(0,0,0,.5);}',
    '.se-recover button{border:none;border-radius:8px;padding:7px 13px;font-weight:700;font-size:12px;cursor:pointer;}.se-recover .rsave{background:#f59e0b;color:#111;}.se-recover .rdismiss{background:#374151;color:#cbd5e1;}',
    /* suppress the site\'s first-visit popups so they don\'t block editing */
    'body.se-editing #popup,body.se-editing .popup-overlay,body.se-editing #sn,body.se-editing .sales-notif{display:none!important;}',
    'body.se-editing{padding-bottom:64px;}' /* room for the Save bar */
  ].join('');
  D.head.appendChild(css);

  function selectAll(el) { try { var r = D.createRange(); r.selectNodeContents(el); var s = window.getSelection(); s.removeAllRanges(); s.addRange(r); } catch (e) {} }

  /* ---------- inline contentEditable (optimistic; queues, never blocks) ---------- */
  function inlineEdit(el, opts) {
    opts = opts || {};
    var pen = opts.pen; if (pen && pen.parentNode === el) el.removeChild(pen);
    var origDisplay = opts.startText != null ? opts.startText : (opts.html ? el.innerHTML : el.textContent);
    var cmp = opts.cmp != null ? opts.cmp : ((opts.clearPlaceholder && isPlaceholder(origDisplay)) ? '' : ('' + origDisplay).trim());
    if (opts.setText != null) el.textContent = opts.setText;
    else if (opts.clearPlaceholder && isPlaceholder(el.textContent)) el.textContent = '';
    el.setAttribute('contenteditable', 'true'); el.classList.add('se-now'); el.focus(); selectAll(el);
    var done = false;
    function finish(commit) {
      if (done) return; done = true;
      el.removeEventListener('keydown', kd); el.removeEventListener('blur', bl);
      el.removeAttribute('contenteditable'); el.classList.remove('se-now');
      var val = (opts.html ? el.innerHTML : el.textContent).trim();
      if (commit && val !== cmp) { opts.save(val); }
      else { if (opts.html) el.innerHTML = origDisplay; else el.textContent = origDisplay; }
      if (pen) el.appendChild(pen);
    }
    function kd(e) { if (e.key === 'Enter' && !opts.multiline) { e.preventDefault(); finish(true); } else if (e.key === 'Escape') { e.preventDefault(); finish(false); } }
    function bl() { finish(true); }
    el.addEventListener('keydown', kd); el.addEventListener('blur', bl);
  }

  // single tracked outside-click handler. CRITICAL: when one mini opens another
  // (e.g. card ⋯ menu -> "Move to page" popover), the FIRST mini's mousedown
  // listener used to linger and close the SECOND popover the instant you clicked
  // into it — so move-to-page never worked with a real mouse (only with a
  // scripted click, which fires no mousedown). closeMini() now always tears the
  // listener down so exactly one is ever live.
  var _miniOff = null;
  function closeMini() {
    var m = D.getElementById('se-mini'); if (m) m.remove();
    if (_miniOff) { D.removeEventListener('mousedown', _miniOff, true); _miniOff = null; }
  }
  function mini(anchor, inner, onOk) {
    closeMini();
    var m = D.createElement('div'); m.className = 'se-mini'; m.id = 'se-mini'; m.innerHTML = inner; B.appendChild(m);
    var r = anchor.getBoundingClientRect(), mh = m.offsetHeight;
    // flip above the anchor if it would render below the fold
    m.style.top = ((r.bottom + mh + 12 > window.innerHeight) ? (window.scrollY + r.top - mh - 6) : (window.scrollY + r.bottom + 6)) + 'px';
    m.style.left = (window.scrollX + Math.max(8, Math.min(r.left, window.innerWidth - m.offsetWidth - 12))) + 'px';
    var ok = m.querySelector('.ok'); if (ok) ok.onclick = function () { onOk(m); };
    var f = m.querySelector('input,textarea,select'); if (f) f.focus();
    setTimeout(function () {
      _miniOff = function (e) {
        if (!m.isConnected) { closeMini(); return; }
        if (!m.contains(e.target) && !(anchor && anchor.contains && anchor.contains(e.target))) closeMini();
      };
      D.addEventListener('mousedown', _miniOff, true);
    }, 0);
    return m;
  }

  /* ---------- TEXT (settings) ---------- */
  function bindText(el) {
    if (el.__se) return; el.__se = 1; el.classList.add('se-ed-h');
    var pen = mkPen(); el.appendChild(pen);
    pen.onclick = function (e) {
      e.preventDefault(); e.stopPropagation();
      if (el.hasAttribute('data-edit-brand')) return editBrand(el);
      var key = el.getAttribute('data-edit'), html = el.hasAttribute('data-edit-html');
      var clone = el.cloneNode(true); var p = clone.querySelector('.se-pen'); if (p) p.remove();
      inlineEdit(el, { pen: pen, html: html, multiline: html, startText: html ? clone.innerHTML.trim() : clone.textContent.trim(),
        save: function (val) { recordSetting(key, val); } });
    };
  }
  function editBrand(el) {
    var span = el.querySelector('.accent');
    var p1 = (el.childNodes[0] && el.childNodes[0].textContent || '').trim();
    var p2 = (span && span.textContent || '').trim();
    mini(el, '<input id="b1" value="' + esc(p1) + '" size="8"><input id="b2" value="' + esc(p2) + '" size="8"><button class="ok">OK</button>', function (m) {
      var v1 = m.querySelector('#b1').value, v2 = m.querySelector('#b2').value;
      el.childNodes[0].textContent = v1; if (span) span.textContent = v2;
      recordSetting('brand_part1', v1); recordSetting('brand_part2', v2); closeMini();
    });
  }

  /* ---------- PRODUCT fields (product page) ---------- */
  function bindProductField(el) {
    var field = el.getAttribute('data-pf'), type = el.getAttribute('data-pf-type') || 'text';
    if (type === 'image') {
      // Main product image: click anywhere on it to change; hover shows a hint.
      var host = el.closest('.pd-img-wrap') || el.parentElement || el;
      if (host.__se) return; host.__se = 1; host.classList.add('se-mainphoto');
      if (getComputedStyle(host).position === 'static') host.style.position = 'relative';
      var hint = D.createElement('div'); hint.className = 'se-mainphoto-hint';
      hint.innerHTML = '<span>🖼</span> Click to change main photo';
      host.appendChild(hint);
      host.addEventListener('click', function (e) { e.preventDefault(); e.stopPropagation(); editImage(el); });
      return;
    }
    if (el.__se) return; el.__se = 1; el.classList.add('se-ed-h');
    var pen = mkPen(); el.appendChild(pen);
    // category/quality/buy-link open a picker/field: clicking the element opens it
    if (type === 'quality' || type === 'category' || type === 'url') {
      el.style.cursor = 'pointer';
      el.addEventListener('click', function (e) { if (e.target === pen || pen.contains(e.target)) return; e.preventDefault(); e.stopPropagation(); pen.onclick(e); });
    }
    pen.onclick = function (e) {
      e.preventDefault(); e.stopPropagation();
      if (type === 'quality') return editQuality(el);
      if (type === 'category') return editCategory(el);
      if (type === 'url') {
        var raw = el.textContent.replace('✎', '').trim();
        var cur = isPlaceholder(raw) ? '' : raw;
        return mini(el, '<input id="bl" value="' + esc(cur) + '" size="40" placeholder="https://weidian.com/item.html?itemID=..."><button class="ok">Save</button>', function (m) {
          var v = m.querySelector('#bl').value.trim(); el.textContent = v || '— no buy link set —'; el.classList.toggle('pf-empty', false); recordProduct(PID, { url: v }); closeMini();
        });
      }
      if (type === 'price' || type === 'money') {
        var fld = type === 'price' ? 'price' : field;
        var num = (el.textContent.replace('✎', '').match(/[0-9.]+/) || [''])[0];
        return inlineEdit(el, { pen: pen, startText: el.textContent.replace('✎', ''), setText: num, cmp: num,
          save: function (val) { var n = (val.match(/[0-9.]+/) || [''])[0] || '0'; el.textContent = '$' + n; if (type === 'price') el.setAttribute('data-price-usd', n); var o = {}; o[fld] = n; recordProduct(PID, o); } });
      }
      var clone = el.cloneNode(true); var p = clone.querySelector('.se-pen'); if (p) p.remove();
      inlineEdit(el, { pen: pen, clearPlaceholder: true, startText: clone.textContent.trim(),
        save: function (val) { if (type === 'int') val = (val.replace(/[^0-9]/g, '') || '0'); var o = {}; o[field] = val; recordProduct(PID, o); } });
    };
  }
  function editImage(img) {
    var bg = D.createElement('div'); bg.className = 'se-modal-bg';
    bg.innerHTML = '<div class="se-modal"><h3>Change main photo</h3><div class="sub">Pick a photo from your computer, drag one in, or paste an image URL.</div>' +
      '<label class="se-drop" id="se-drop"><span class="se-drop-ico">⤴</span><span class="se-drop-main">Choose photo from your computer</span><span class="se-drop-sub">or drag &amp; drop an image here</span><input type="file" accept="image/*" hidden></label>' +
      '<label class="se-pl">Or paste an image URL</label><input id="iu" class="se-ps" value="' + esc(img.getAttribute('src') || '') + '" placeholder="https://…">' +
      '<div class="se-row"><button class="se-b ghost" id="ix">Cancel</button><button class="se-b save" id="is">Set URL</button></div></div>';
    B.appendChild(bg); bg.onclick = function (e) { if (e.target === bg) bg.remove(); };
    bg.querySelector('#ix').onclick = function () { bg.remove(); };
    bg.querySelector('#is').onclick = function () { var v = bg.querySelector('#iu').value.trim(); if (!v) return; setMainPhoto(v); bg.remove(); };
    bg.querySelector('#iu').addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); var v = this.value.trim(); if (v) { setMainPhoto(v); bg.remove(); } } });
    function doUpload(f) {
      if (!f) return;
      if (!/^image\//.test(f.type || '')) { status('That file is not an image', 'error'); return; }
      status('Uploading…');
      uploadImg(PID, f, true).then(function (j) {
        if (j && j.ok) { setMainPhoto(j.image); status('Main photo updated ✓', 'success'); bg.remove(); }
        else status((j && j.error) || 'Upload failed', 'error');
      });
    }
    bg.querySelector('input[type=file]').onchange = function () { doUpload(this.files[0]); };
    var drop = bg.querySelector('#se-drop');
    drop.addEventListener('dragover', function (e) { e.preventDefault(); drop.classList.add('over'); });
    drop.addEventListener('dragleave', function () { drop.classList.remove('over'); });
    drop.addEventListener('drop', function (e) { e.preventDefault(); drop.classList.remove('over'); doUpload((e.dataTransfer.files || [])[0]); });
  }

  /* ---------- PRODUCT PAGE EDITOR CHROME ----------
     - thumbnail strip owns an "Add photo" tile that matches a real thumbnail
     - scrape lives as an inline button at the top of the product info column
     (changing the MAIN photo is handled by clicking the main image — see the
      type==='image' branch of bindProductField) */
  function bindProductToolbar() {
    var wrap = D.querySelector('.pd-img-wrap'); if (!wrap || wrap.__setb) return; wrap.__setb = 1;

    // 1) Editor owns the thumbnail strip so it can always show every photo
    //    plus a trailing "+ Add photo" tile (the public render only shows the
    //    strip when >1 image — in edit mode we always show it).
    if (!window.__seThumbsOwned) {
      window.__seThumbsOwned = 1;
      var origRender = window.renderPpThumbs;
      window.renderPpThumbs = function () { renderEditorThumbs(); };
      // render once now (gallery may still be loading; the async fetch will
      // call window.renderPpThumbs again when ppGallery is populated)
      renderEditorThumbs();
      void origRender;
    }

    // 2) Scrape button at the top of the right-hand info column.
    var side = D.querySelector('.pd-side');
    if (side && !side.__sescrape) {
      side.__sescrape = 1;
      var sb = D.createElement('button');
      sb.type = 'button'; sb.className = 'se-scrape-btn';
      sb.innerHTML = '<span class="ico">⚡</span> Scrape to fill this product';
      sb.onclick = openScrape;
      side.insertBefore(sb, side.firstChild);
    }
  }

  // Create the product from the blank "Add product" draft page after review.
  var _savingDraft = false;
  function saveDraftProduct() {
    if (_savingDraft) return;  // guard against double-submit
    var name = (DRAFT.name || '').trim();
    if (!name) { status('Add a product name first', 'error'); return; }
    var body = {
      name: name,
      price: DRAFT.price || '',
      category: DRAFT.category || '',
      image: DRAFT.image || '',
      url: DRAFT.url || '',
      quality: DRAFT.quality || '',
      batch: DRAFT.batch || '',
      weight: DRAFT.weight || '',
      seller: DRAFT.seller || '',
      retail_price: DRAFT.retail_price || '',
      sales: DRAFT.sales || 0,
    };
    if (DRAFT.variants) body.variants = DRAFT.variants;
    if (DRAFT.qc_photos) body.qc_photos = DRAFT.qc_photos;
    if (DRAFT.tags) body.tags = DRAFT.tags;  // AI search keywords
    var btn = D.getElementById('se-draftadd');
    function reset() { _savingDraft = false; if (btn) { btn.disabled = false; btn.textContent = '✓ Add product'; } }
    _savingDraft = true; if (btn) { btn.disabled = true; btn.textContent = 'Adding…'; }
    status('Adding product…');
    jfetch('/products/' + SITE + '/new', 'POST', body).then(function (j) {
      if (j && j._auth) { reset(); return; }  // jfetch already showed "session expired"
      if (!(j && j.ok && j.id)) { reset(); status((j && j.error) || 'Could not add product', 'error'); return; }
      var imgs = (DRAFT.images || []).filter(Boolean);
      // product exists now — navigate regardless, but warn if photos didn't save
      var go = function (photosOk) {
        status(photosOk ? 'Product added ✓' : 'Product added — but photos didn’t save; add them on the product page', photosOk ? 'success' : 'error');
        location.href = SITEROOT + '/product/' + j.id;
      };
      if (imgs.length) {
        jfetch('/products/' + SITE + '/gallery/' + j.id, 'POST', { images: imgs })
          .then(function (gr) { go(!!(gr && gr.ok !== false)); })
          .catch(function () { go(false); });
      } else { go(true); }
    }).catch(function () { reset(); status('Network error — not added', 'error'); });
  }

  function absU(u) { try { var a = D.createElement('a'); a.href = u; return a.href; } catch (e) { return u; } }
  function renderEditorThumbs() {
    var th = D.getElementById('ppThumbs'); if (!th) return;
    var imgs = (window.ppGallery || []).slice();
    var mainEl = D.getElementById('ppMain');
    var mainAbs = absU(mainEl ? mainEl.src : '');  // .src property = absolute, reliable
    th.innerHTML = '';
    imgs.slice(0, 24).forEach(function (src) {
      var disp = imgSrc(src);
      var t = D.createElement('div'); t.className = 'pp-thumb' + (absU(disp) === mainAbs ? ' active' : '');
      var im = D.createElement('img'); im.src = disp; im.referrerPolicy = 'no-referrer'; t.appendChild(im);
      t.onclick = function () { if (mainEl) mainEl.src = disp; [].forEach.call(th.querySelectorAll('.pp-thumb'), function (x) { x.classList.remove('active'); }); t.classList.add('active'); };
      th.appendChild(t);
    });
    // trailing add-photo tile, styled like a thumbnail
    var add = D.createElement('div'); add.className = 'pp-thumb se-addthumb';
    add.innerHTML = '<span class="plus">＋</span><span class="lbl">Add</span>';
    add.title = 'Add photos to this product';
    add.onclick = function (e) { e.preventDefault(); e.stopPropagation(); openGalleryEditor(); };
    th.appendChild(add);
  }

  // The editor manages the MANUAL gallery only (window.ppManualGallery, the
  // persisted `images` list). All values kept RAW; imgSrc() prefixes for
  // display, rawSrc() strips for storage. window.ppGallery is the merged
  // display list (main + manual + variants) rebuilt by window.rebuildPpGallery.
  function manualGallery() { return (window.ppManualGallery || []).slice(); }
  function mainRaw() {
    if (window.ppMainSrc) return rawSrc(window.ppMainSrc);
    var m = D.getElementById('ppMain'); return m ? rawSrc(m.getAttribute('src')) : '';
  }
  function rebuild() { if (typeof window.rebuildPpGallery === 'function') window.rebuildPpGallery(); else if (typeof window.renderPpThumbs === 'function') window.renderPpThumbs(); }
  function setMainPhoto(url) {
    url = rawSrc(url);
    var img = D.getElementById('ppMain'); if (img) img.src = imgSrc(url);
    window.ppMainSrc = url;
    recordProduct(PID, { image: url });
    rebuild();
  }
  function setManualGallery(list) {
    var clean = (list || []).map(rawSrc).filter(Boolean);
    // de-dupe
    var seen = {}, out = []; clean.forEach(function (u) { if (!seen[u]) { seen[u] = 1; out.push(u); } });
    window.ppManualGallery = out;
    rebuild();
    if (DRAFT_MODE) { DRAFT.images = out; return Promise.resolve({ ok: true }); }  // attached on create
    return persistGallery(out);
  }
  function persistGallery(list) {
    // Save the manual gallery via the dedicated endpoint (kept out of the
    // bulk product save so URLs + removals commit immediately).
    return jfetch('/products/' + SITE + '/gallery/' + encodeURIComponent(PID), 'POST', { images: list });
  }

  function openGalleryEditor() {
    var bg = D.createElement('div'); bg.className = 'se-modal-bg';
    bg.innerHTML = '<div class="se-modal"><h3>Product photos</h3><div class="sub">Upload or paste image URLs. Click ☆ Main to make one the main photo, ✕ to remove.</div>' +
      '<div class="se-galgrid" id="gg"></div>' +
      '<label class="se-pl">Add by URL</label><input id="gu" class="se-ps" placeholder="https://… image url">' +
      '<div class="se-row"><label class="se-up" style="flex:1;justify-content:center;">⤴ Upload photo(s)<input type="file" accept="image/*" multiple hidden></label><button class="se-b ghost" id="gadd">+ Add URL</button></div>' +
      '<div class="se-row"><button class="se-b ghost" id="gclose">Done</button></div></div>';
    B.appendChild(bg); bg.onclick = function (e) { if (e.target === bg) bg.remove(); };
    var grid = bg.querySelector('#gg');
    function render() {
      grid.innerHTML = '';
      var main = mainRaw();
      var gallery = manualGallery();
      var all = [];
      if (main) all.push({ url: main, isMain: true });
      gallery.forEach(function (u) { if (u !== main) all.push({ url: u, isMain: false }); });
      all.forEach(function (item) {
        var cell = D.createElement('div'); cell.className = 'se-galcell' + (item.isMain ? ' is-main' : '');
        cell.innerHTML = '<img src="' + esc(imgSrc(item.url)) + '" referrerpolicy="no-referrer">' +
          '<button class="gmain" title="Set as main photo">' + (item.isMain ? '★ MAIN' : '☆ Main') + '</button>' +
          (item.isMain ? '' : '<button class="gx" title="Remove">✕</button>');
        cell.querySelector('.gmain').onclick = function () {
          if (item.isMain) return;
          // promote: old main drops into the manual gallery so it isn't lost
          var oldMain = mainRaw();
          var g = manualGallery().filter(function (u) { return u !== item.url; });
          if (oldMain && g.indexOf(oldMain) < 0) g.unshift(oldMain);
          setMainPhoto(item.url);          // updates ppMainSrc + records image
          setManualGallery(g);             // persists new gallery + rebuilds
          status('Main photo updated ✓', 'success'); render();
        };
        var gx = cell.querySelector('.gx');
        if (gx) gx.onclick = function () {
          setManualGallery(manualGallery().filter(function (u) { return u !== item.url; }))
            .then(function () { status('Photo removed', 'success'); });
          render();
        };
        grid.appendChild(cell);
      });
      if (!all.length) grid.innerHTML = '<div style="grid-column:1/-1;color:#9ca3af;font-size:12px;padding:14px;text-align:center;">No photos yet — upload or paste a URL.</div>';
    }
    function addUrl(u) {
      u = (u || '').trim(); if (!u) return;
      var g = manualGallery(); if (g.indexOf(u) < 0) g.push(u);
      setManualGallery(g); render();
    }
    bg.querySelector('#gadd').onclick = function () { var i = bg.querySelector('#gu'); addUrl(i.value); i.value = ''; };
    bg.querySelector('#gu').addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); addUrl(this.value); this.value = ''; } });
    bg.querySelector('#gclose').onclick = function () { bg.remove(); };
    bg.querySelector('input[type=file]').onchange = function () {
      var files = [].slice.call(this.files); if (!files.length) return;
      status('Uploading ' + files.length + ' photo' + (files.length > 1 ? 's' : '') + '…');
      var g = manualGallery();
      var chain = Promise.resolve();
      files.forEach(function (f) {
        chain = chain.then(function () {
          return uploadImg(PID, f, false).then(function (j) {
            if (j && j.ok && g.indexOf(j.image) < 0) g.push(j.image);
          });
        });
      });
      chain.then(function () { setManualGallery(g); status('Photos added ✓', 'success'); render(); });
    };
    render();
  }

  function openScrape() {
    var bg = D.createElement('div'); bg.className = 'se-modal-bg';
    bg.innerHTML = '<div class="se-modal"><h3>Scrape product</h3><div class="sub">Paste a Weidian / Taobao / 1688 (or agent) link. AI identifies the brand, name &amp; category and pulls the price, photos and variants, then fills this page — review before saving.</div>' +
      '<label class="se-pl">Product link</label><input id="scu" class="se-ps" placeholder="https://weidian.com/item.html?itemID=…">' +
      '<label class="se-pl" style="margin-top:10px;"><input type="checkbox" id="scphotos" checked style="vertical-align:-1px;"> Import photos into the gallery</label>' +
      '<label class="se-pl"><input type="checkbox" id="scvars" checked style="vertical-align:-1px;"> Import variants / versions</label>' +
      '<div id="scstatus" style="font-size:12px;color:#9ca3af;margin-top:10px;min-height:16px;"></div>' +
      '<div class="se-row"><button class="se-b ghost" id="scx">Cancel</button><button class="se-b save" id="scgo">⚡ Scrape</button></div></div>';
    B.appendChild(bg); bg.onclick = function (e) { if (e.target === bg) bg.remove(); };
    var st = bg.querySelector('#scstatus');
    bg.querySelector('#scx').onclick = function () { bg.remove(); };
    var input = bg.querySelector('#scu'); input.focus();
    bg.querySelector('#scgo').onclick = function () {
      var url = input.value.trim(); if (!url) { st.textContent = 'Paste a link first.'; return; }
      var goBtn = this; goBtn.disabled = true; goBtn.textContent = 'Scraping…'; st.textContent = 'Fetching listing…';
      jfetch('/products/scrape', 'POST', { url: url }).then(function (r) {
        goBtn.disabled = false; goBtn.textContent = '⚡ Scrape';
        if (!r || r.ok === false) { st.textContent = (r && r.error) || 'Scrape failed.'; return; }
        applyScrape(r, bg.querySelector('#scphotos').checked, bg.querySelector('#scvars').checked, url);
        bg.remove();
      }).catch(function () { goBtn.disabled = false; goBtn.textContent = '⚡ Scrape'; st.textContent = 'Network error.'; });
    };
  }

  function applyScrape(r, wantPhotos, wantVars, srcUrl) {
    var s = r.scraped || r;  // scrape() nests fields under .scraped
    var changed = [];
    // Name
    if (s.name) { var t = D.getElementById('ppTitle'); if (t) { var pen = t.querySelector('.se-pen'); t.textContent = s.name; if (pen) t.appendChild(pen); } recordProduct(PID, { name: s.name }); changed.push('name'); }
    // Price (USD base price)
    var price = s.price || s.price_numeric;
    if (price != null && price !== '' && String(price) !== '0') {
      var pn = (String(price).match(/[0-9.]+/) || [''])[0];
      var pe = D.getElementById('ppPrice'); if (pe && pn) { pe.textContent = '$' + pn; pe.setAttribute('data-price-usd', pn); }
      recordProduct(PID, { price: pn }); changed.push('price');
    }
    // Buy link (canonical source url, or what the user pasted)
    var url = r.source_url || s.url || srcUrl;
    if (url) { var bl = D.querySelector('[data-pf="url"]'); if (bl) { var blpen = bl.querySelector('.se-pen'); bl.textContent = url; if (blpen) bl.appendChild(blpen); bl.classList.remove('pf-empty'); } recordProduct(PID, { url: url }); changed.push('link'); }
    // Category (AI-identified) — set the badge + the source label + record it
    if (s.category) {
      var catEl = D.querySelector('[data-pf="category"] .pf-val') || D.querySelector('[data-pf="category"]');
      if (catEl) { catEl.textContent = s.category; var ce = catEl.closest('[data-pf="category"]') || catEl; if (ce.classList) ce.classList.remove('pf-empty'); }
      var srcLbl = D.getElementById('ppSource'); if (srcLbl) srcLbl.textContent = String(s.category).toUpperCase();
      recordProduct(PID, { category: s.category }); changed.push('category');
    }
    // Seller = brand, plus search tags (both AI-identified)
    if (s.brand) {
      var selEl = D.querySelector('[data-pf="seller"]');
      if (selEl) { var sp = selEl.querySelector('.se-pen'); selEl.textContent = s.brand; if (sp) selEl.appendChild(sp); selEl.classList.remove('pf-empty'); }
      recordProduct(PID, { seller: s.brand });
    }
    if (s.tags) recordProduct(PID, { tags: s.tags });
    // Main image + gallery
    var gallery = (s.images || []).slice();
    if (s.image && gallery.indexOf(s.image) < 0) gallery = [s.image].concat(gallery);
    if (wantPhotos && gallery.length) {
      var oldMain = mainRaw();             // don't silently lose a custom-uploaded main
      setMainPhoto(gallery[0]);            // first scraped photo becomes the main image
      var rest = gallery.slice(1);
      if (oldMain && oldMain.indexOf('/uploads/') === 0 && oldMain !== gallery[0] && rest.indexOf(oldMain) < 0) rest.unshift(oldMain);
      setManualGallery(rest);              // the rest (plus any preserved custom main) → gallery
      changed.push(gallery.length + ' photos');
    }
    // Variants
    var vars = s.variants || [];
    if (wantVars && vars.length) {
      var norm = vars.map(function (v) { return { name: v.name || v.title || '', image: v.image || v.image_url || '' }; }).filter(function (v) { return v.name || v.image; });
      if (norm.length && typeof renderVariants === 'function') {
        renderVariants(norm);
        recordProduct(PID, { variants: JSON.stringify(norm) });
        changed.push(norm.length + ' variants');
      }
    }
    status('Scraped: ' + (changed.join(', ') || 'nothing new') + ' — Save changes to publish', 'success');
  }
  function editQuality(el) {
    var valEl = el.querySelector('.pf-val') || el, cur = isPlaceholder(valEl.textContent) ? '' : valEl.textContent.trim();
    var opts = ['', 'BUDGET', 'TOP', '1:1'].map(function (o) { return '<option' + (o.toUpperCase() === cur.toUpperCase() ? ' selected' : '') + ' value="' + o + '">' + (o || '— none —') + '</option>'; }).join('');
    mini(el, '<select id="q">' + opts + '</select><button class="ok">OK</button>', function (m) {
      var v = m.querySelector('#q').value; valEl.textContent = v || '—'; recordProduct(PID, { quality: v }); closeMini();
    });
  }
  function editCategory(el) {
    var valEl = el.querySelector('.pf-val') || el, cur = isPlaceholder(valEl.textContent) ? '' : valEl.textContent.trim();
    var opts = ['<option value="">— none —</option>'].concat(CATS.map(function (c) { return '<option' + (c.slug === cur ? ' selected' : '') + ' value="' + c.slug + '">' + esc(c.name) + '</option>'; })).join('');
    mini(el, '<select id="c">' + opts + '</select><button class="ok">OK</button>', function (m) {
      var v = m.querySelector('#c').value; valEl.textContent = v || '—'; var s = D.getElementById('ppSource'); if (s) s.textContent = (v || 'Find').toUpperCase(); recordProduct(PID, { category: v }); closeMini();
    });
  }
  function bindQc(el) {
    if (el.__se) return; el.__se = 1; el.classList.add('se-ed-h');
    var pen = mkPen(); el.appendChild(pen);
    pen.onclick = function (e) {
      e.preventDefault(); e.stopPropagation();
      var imgs = [].map.call(D.querySelectorAll('#ppQc img'), function (i) { return i.src; });
      var mm = mini(el, '<textarea id="qc" placeholder="One QC photo URL per line">' + esc(imgs.join('\n')) + '</textarea><div class="se-uprow"><button class="ok">Save</button><label class="se-up">⤴ Upload photo<input type="file" accept="image/*" hidden></label></div>', function (m) {
        var lines = m.querySelector('#qc').value.split('\n').map(function (x) { return x.trim(); }).filter(Boolean);
        var box = D.getElementById('ppQc'); if (box) { box.className = 'pd-qc'; box.innerHTML = lines.length ? lines.map(function (u) { return '<img src="' + esc(u) + '" referrerpolicy="no-referrer">'; }).join('') : '<div class="pd-qc-empty">No QC photos yet.</div>'; }
        recordProduct(PID, { qc_photos: JSON.stringify(lines) }); closeMini();
      });
      var fi = mm.querySelector('input[type=file]');
      if (fi) fi.onchange = function () { var f = this.files[0]; if (!f) return; status('Uploading…'); uploadImg(PID, f, false).then(function (j) { if (j && j.ok) { var ta = mm.querySelector('#qc'); ta.value = (ta.value ? ta.value + '\n' : '') + imgSrc(j.image); status('Photo added — click Save', 'success'); } else status((j && j.error) || 'Upload failed', 'error'); }); };
    };
  }

  /* ---------- Variant editor (name + photo per version) ---------- */
  function bindVariants(el) {
    if (el.__se) return; el.__se = 1; el.classList.add('se-ed-h');
    var pen = mkPen(); el.appendChild(pen);
    pen.onclick = function (e) { e.preventDefault(); e.stopPropagation(); openVariantEditor(); };
  }
  function currentVariants() {
    return [].map.call(D.querySelectorAll('#ppVariants .pd-variant'), function (btn) {
      var img = btn.querySelector('img'), lbl = btn.querySelector('.pd-variant-lbl');
      return { name: lbl ? lbl.textContent.trim() : (btn.getAttribute('title') || ''), image: img ? img.getAttribute('src') : '' };
    }).filter(function (v) { return v.name || v.image; });
  }
  function renderVariants(arr) {
    var box = D.getElementById('ppVariants'), cnt = D.getElementById('ppVariantCount'); if (!box) return;
    if (arr.length) { if (cnt) cnt.textContent = arr.length + ' variant' + (arr.length === 1 ? '' : 's');
      box.innerHTML = arr.map(function (v) { return '<button type="button" class="pd-variant" title="' + esc(v.name) + '">' + (v.image ? '<img src="' + esc(v.image) + '" referrerpolicy="no-referrer">' : '') + '<span class="pd-variant-lbl">' + esc(v.name) + '</span></button>'; }).join('');
    } else { box.innerHTML = '<div class="pd-qc-empty">Single variant</div>'; if (cnt) cnt.textContent = 'Variants · 1'; }
  }
  function openVariantEditor() {
    var bg = D.createElement('div'); bg.className = 'se-modal-bg';
    bg.innerHTML = '<div class="se-modal"><h3>Variants / versions</h3><div class="sub">Name + photo each · drag to reorder · ✕ to remove</div><div id="vl"></div><div class="se-row"><button class="se-b ghost" id="va">+ Add variant</button></div><div class="se-row"><button class="se-b ghost" id="vc">Cancel</button><button class="se-b save" id="vs">Apply</button></div></div>';
    B.appendChild(bg); bg.onclick = function (e) { if (e.target === bg) bg.remove(); };
    var list = bg.querySelector('#vl');
    function row(v) {
      var d = D.createElement('div'); d.className = 'se-var'; d.setAttribute('draggable', 'true');
      d.innerHTML = '<span class="h">⠿</span><input class="vn" placeholder="Name" value="' + esc(v.name || '') + '"><input class="vi" placeholder="Image URL" value="' + esc(v.image || '') + '"><label class="se-up se-up-sm" title="Upload photo">⤴<input type="file" accept="image/*" hidden></label><button class="del">✕</button>';
      d.querySelector('.del').onclick = function () { d.remove(); };
      d.querySelector('input[type=file]').onchange = function () { var f = this.files[0]; if (!f) return; status('Uploading…'); uploadImg(PID, f, false).then(function (j) { if (j && j.ok) { d.querySelector('.vi').value = imgSrc(j.image); status('Uploaded ✓', 'success'); } else status((j && j.error) || 'Upload failed', 'error'); }); };
      d.addEventListener('dragstart', function () { dragEl = d; }); d.addEventListener('dragover', function (e) { e.preventDefault(); });
      d.addEventListener('drop', function (e) { e.preventDefault(); if (!dragEl || dragEl === d) return; var rs = [].slice.call(list.children); if (rs.indexOf(dragEl) < rs.indexOf(d)) d.after(dragEl); else d.before(dragEl); });
      return d;
    }
    currentVariants().forEach(function (v) { list.appendChild(row(v)); });
    bg.querySelector('#va').onclick = function () { list.appendChild(row({})); };
    bg.querySelector('#vc').onclick = function () { bg.remove(); };
    bg.querySelector('#vs').onclick = function () {
      var arr = [].map.call(list.children, function (d) { return { name: d.querySelector('.vn').value.trim(), image: d.querySelector('.vi').value.trim() }; }).filter(function (v) { return v.name || v.image; });
      recordProduct(PID, { variants: JSON.stringify(arr) }); renderVariants(arr); bg.remove(); status('Variants queued — Save changes', 'success');
    };
  }

  /* ---------- FLIP: animate cards sliding into their new spots ---------- */
  function flip(grid, mutate) {
    var cards = [].slice.call(grid.querySelectorAll('.product-card'));
    var first = cards.map(function (c) { return c.getBoundingClientRect(); });
    mutate();
    [].slice.call(grid.querySelectorAll('.product-card')).forEach(function (c) {
      var idx = cards.indexOf(c); if (idx < 0) return;
      var pr = first[idx], nr = c.getBoundingClientRect();
      var dx = pr.left - nr.left, dy = pr.top - nr.top;
      if (!dx && !dy) return;
      c.style.transition = 'none'; c.style.transform = 'translate(' + dx + 'px,' + dy + 'px)';
      requestAnimationFrame(function () { c.style.transition = 'transform .28s cubic-bezier(.2,.7,.3,1)'; c.style.transform = ''; });
    });
  }

  /* ---------- PRODUCT cards (shop grid + related) ---------- */
  function pidOf(card) { return card.getAttribute('data-pid') || ((card.getAttribute('href') || '').match(/\/product\/([^/?#]+)/) || [])[1]; }

  /* ---------- position badges + exact-position moves ---------- */
  var SE_PER_PAGE = 40;
  function viewCtx() {
    var q; try { q = new URLSearchParams(location.search); } catch (e) { q = null; }
    return { page: Math.max(1, (q && parseInt(q.get('page'), 10)) || 1), category: (q && q.get('category')) || '' };
  }
  // badge label = "page:position" within the current view (e.g. 1:1, 1:2 … 3:10)
  function renumberBadges(grid) {
    if (!grid) return;
    var pg = viewCtx().page;
    [].slice.call(grid.querySelectorAll('.product-card')).forEach(function (c, i) {
      var b = c.querySelector('.se-posbadge'); if (b && !b.__editing) b.textContent = pg + ':' + (i + 1);
    });
  }
  // accepts "page:position" (e.g. 3:10) OR a bare number (= position on the CURRENT page)
  function parsePosInput(v) {
    v = (v || '').trim();
    var m = v.match(/^(\d+)\s*:\s*(\d+)$/);
    if (m) { var pg = Math.max(1, parseInt(m[1], 10)); var pos = Math.min(Math.max(parseInt(m[2], 10), 1), SE_PER_PAGE); return (pg - 1) * SE_PER_PAGE + pos; }
    if (/^\d+$/.test(v)) { var n = Math.max(1, parseInt(v, 10)); return (viewCtx().page - 1) * SE_PER_PAGE + n; }
    return null;
  }
  function editPosition(card, id, badge, grid) {
    if (badge.__editing) return; badge.__editing = 1;
    var cur = badge.textContent, done = false;
    badge.innerHTML = '<input type="text" inputmode="numeric" value="' + cur + '" title="page:position — e.g. 3:10">';
    var inp = badge.querySelector('input'); inp.focus(); inp.select();
    function finish(commit) {
      if (done) return; done = true;
      var abs = parsePosInput(inp.value);
      badge.__editing = 0; badge.textContent = cur;
      if (commit && abs && inp.value.trim() !== cur) applyPositionMove(card, id, abs, grid);
    }
    inp.onclick = function (e) { e.stopPropagation(); };
    inp.onkeydown = function (e) { if (e.key === 'Enter') { e.preventDefault(); finish(true); } else if (e.key === 'Escape') { e.preventDefault(); finish(false); } };
    inp.onblur = function () { finish(true); };
  }
  function applyPositionMove(card, id, position, grid) {
    var ctx = viewCtx(); status('Moving…');
    jfetch('/products/' + SITE + '/move-to-position', 'POST', { id: id, position: position, category: ctx.category }).then(function (r) {
      if (!r || !r.ok) { status((r && r.error) || 'Move failed', 'error'); return; }
      if (r.page === ctx.page && grid) {                       // stays on this page → reposition smoothly
        var targetIdx = r.position - (ctx.page - 1) * SE_PER_PAGE - 1;
        flip(grid, function () {
          var others = [].slice.call(grid.querySelectorAll('.product-card')).filter(function (c) { return c !== card; });
          var ref = others[targetIdx];
          if (ref) grid.insertBefore(card, ref);
          else { var add = grid.querySelector('.bs-add'); add ? grid.insertBefore(card, add) : grid.appendChild(card); }
        });
        renumberBadges(grid); status('Moved to ' + r.page + ':' + ((r.position - 1) % SE_PER_PAGE + 1) + ' ✓', 'success');
      } else {                                                  // left this page
        if (grid) { flip(grid, function () { card.remove(); }); renumberBadges(grid); }
        status('Moved to ' + r.page + ':' + ((r.position - 1) % SE_PER_PAGE + 1) + ' ✓', 'success');
      }
    });
  }
  function persistDragged(grid, card, id) {
    renumberBadges(grid);
    var ctx = viewCtx(), cards = [].slice.call(grid.querySelectorAll('.product-card')), idx = cards.indexOf(card);
    if (idx < 0) return;
    var rank = (ctx.page - 1) * SE_PER_PAGE + idx + 1;
    status('Saving order…');
    jfetch('/products/' + SITE + '/move-to-position', 'POST', { id: id, position: rank, category: ctx.category }).then(function (r) {
      status(r && r.ok ? 'Order saved ✓' : 'Save failed', r && r.ok ? 'success' : 'error');
    });
  }
  function enhanceCards() {
    var isShop = /\/shop/.test(location.pathname);
    D.querySelectorAll('.product-card').forEach(function (card) {
      if (card.__se) return;
      if (card.closest('[data-best-selling]') || card.closest('.conveyor-track')) return; // handled / skipped
      card.__se = 1; card.classList.add('se-card');
      var id = pidOf(card); if (!id) return;
      card.setAttribute('draggable', 'false');
      var grid = card.closest('.product-grid');
      var hot = card.classList.contains('is-hot');
      var t = D.createElement('div'); t.className = 'se-ptools';
      t.innerHTML = (isShop && grid ? '<button class="se-pbtn grab" title="Drag to reorder">⠿</button>' : '') +
        '<button class="se-pbtn b-hot' + (hot ? ' on' : '') + '" title="Mark hot">🔥</button>' +
        '<button class="se-pbtn b-edit" title="Edit this product">✎</button>' +
        '<button class="se-pbtn b-more" title="More">⋯</button>';
      card.appendChild(t);
      var cb = D.createElement('span'); cb.className = 'se-checkbox'; card.appendChild(cb);
      t.querySelectorAll('.se-pbtn').forEach(function (b) { b.addEventListener('click', function (e) { e.preventDefault(); e.stopPropagation(); }); });
      t.querySelector('.b-edit').onclick = function (e) { e.preventDefault(); e.stopPropagation(); navTo(card.getAttribute('href')); };
      t.querySelector('.b-hot').onclick = function (e) { e.preventDefault(); e.stopPropagation(); toggleHot(card, id, this); };
      t.querySelector('.b-more').onclick = function (e) { e.preventDefault(); e.stopPropagation(); cardMenu(card, id, this); };
      if (isShop && grid) {
        var pb = D.createElement('div'); pb.className = 'se-posbadge'; pb.title = 'Position — click to set exactly';
        pb.onclick = function (e) { e.preventDefault(); e.stopPropagation(); editPosition(card, id, pb, grid); };
        card.appendChild(pb);
        var g = t.querySelector('.grab'); if (g) setupDrag(card, g, grid, function () { persistDragged(grid, card, id); });
      }
    });
    if (isShop) {
      D.querySelectorAll('.product-grid').forEach(renumberBadges);
      var sg = D.querySelector('.product-grid'); if (sg && !sg.__addtile) { sg.__addtile = 1; var tile = D.createElement('button'); tile.type = 'button'; tile.className = 'bs-add'; tile.textContent = '+ Add product'; tile.onclick = openAddProduct; sg.appendChild(tile); }
      if (!D.getElementById('se-selbtn')) { var sb = D.createElement('button'); sb.id = 'se-selbtn'; sb.className = 'se-selbtn'; sb.textContent = '☑ Select'; sb.onclick = function () { setSelectMode(!selectMode); }; B.appendChild(sb); }
    }
  }
  function cardMenu(card, id, btn) {
    var stockLabel = card.classList.contains('out-of-stock') ? '✅ Mark in stock' : '⛔ Mark out of stock';
    var m = mini(btn, '<div class="se-menu"><button data-a="movepage">⇄ Move to page…</button><button data-a="dup">⧉ Duplicate</button><button data-a="stock">' + stockLabel + '</button><button data-a="del" class="danger">🗑 Delete</button></div>');
    m.querySelector('[data-a=movepage]').onclick = function () { closeMini(); moveToPage(id, btn); };
    m.querySelector('[data-a=dup]').onclick = function () { closeMini(); duplicateProduct(id); };
    m.querySelector('[data-a=stock]').onclick = function () { closeMini(); toggleStock(card, id); };
    m.querySelector('[data-a=del]').onclick = function () { closeMini(); deleteProduct(card, id, btn); };
  }
  // shop URL on THIS site (derives the mount prefix from a real product card href)
  function shopUrlFor(page) {
    var c = D.querySelector('.product-card[href*="/product/"]');
    var href = c ? c.getAttribute('href') : '/shop';
    var cat = viewCtx().category;
    return href.replace(/\/product\/.*$/, '') + '/shop?page=' + page + (cat ? '&category=' + encodeURIComponent(cat) : '');
  }
  // In-page "move to shop page" popover (no browser prompt).
  function moveToPage(id, anchor) {
    var ctx = viewCtx();
    var m = mini(anchor,
      '<div class="se-mvbox">' +
        '<div class="mp-h">Move product</div>' +
        '<div class="mp-sub">' + (ctx.category ? 'In “' + esc(ctx.category) + '” · ' : '') + '40 per page</div>' +
        '<label class="mp-l">Page</label>' +
        '<input id="mp-page" type="number" min="1" class="mp-in" placeholder="e.g. 1">' +
        '<label class="mp-l">Position on page <span class="mp-opt">(optional — defaults to top)</span></label>' +
        '<input id="mp-pos" type="number" min="1" max="40" class="mp-in" placeholder="Top">' +
        '<div class="se-row"><button class="se-b ghost" id="mp-x">Cancel</button><button class="se-b save ok">Move</button></div>' +
      '</div>',
      function (mm) {
        var page = parseInt((mm.querySelector('#mp-page') || {}).value, 10);
        if (!page || page < 1) { status('Enter a page number (1 or higher)', 'error'); var p = mm.querySelector('#mp-page'); if (p) p.focus(); return; }
        var pos = parseInt((mm.querySelector('#mp-pos') || {}).value, 10);
        if (!(pos >= 1 && pos <= 40)) pos = 1;                       // optional → top of page
        var abs = (page - 1) * SE_PER_PAGE + pos;
        var okb = mm.querySelector('.ok'); okb.textContent = 'Moving…'; okb.disabled = true;
        jfetch('/products/' + SITE + '/move-to-position', 'POST', { id: id, position: abs, category: ctx.category }).then(function (r) {
          if (r && r.ok) {
            var onPage = (r.position - 1) % SE_PER_PAGE + 1;
            mm.innerHTML = '<div class="se-mvbox"><div class="mp-h">Moved ✓</div>' +
              '<div class="mp-sub">Now at <b>page ' + r.page + ', position ' + onPage + '</b>' + (ctx.category ? ' in “' + esc(ctx.category) + '”' : '') + '.</div>' +
              '<div class="se-row"><button class="se-b ghost" id="mp-d">Done</button><button class="se-b save" id="mp-v">View page ' + r.page + ' →</button></div></div>';
            mm.querySelector('#mp-d').onclick = function () { closeMini(); };
            mm.querySelector('#mp-v').onclick = function () { closeMini(); navTo(shopUrlFor(r.page)); };
          } else { status((r && r.error) || 'Move failed', 'error'); closeMini(); }
        });
      });
    var x = m.querySelector('#mp-x'); if (x) x.onclick = function () { closeMini(); };
  }
  function toggleStock(card, id) {
    var nowOut = !card.classList.contains('out-of-stock');
    card.classList.toggle('out-of-stock', nowOut);
    recordProduct(id, { in_stock: nowOut ? 0 : 1 });
    status(nowOut ? 'Marked out of stock' : 'Marked in stock', 'success');
  }
  var EXTRA_FIELDS = ['weight', 'quality', 'sales', 'in_stock', 'qc_photos', 'variants'];      // non-core columns add_product skips
  function rawProduct(id) { return jfetch('/products/' + SITE + '/' + encodeURIComponent(id)).then(function (r) { return (r && r.product) || null; }); }
  function coreOf(p) { return { name: p.name, price: p.price, url: p.url, image: p.image, category: p.category, seller: p.seller, batch: p.batch, retail_price: p.retail_price, tags: p.tags }; }
  function applyExtras(id, p, fields, done) {
    var extras = {}; fields.forEach(function (k) { if (p[k] != null && p[k] !== '') extras[k] = p[k]; });
    if (Object.keys(extras).length) jfetch('/products/' + SITE + '/' + id, 'PUT', extras).then(done); else done();
  }
  function duplicateProduct(id) {
    status('Duplicating…');
    rawProduct(id).then(function (p) {
      if (!p) { status('Could not load product', 'error'); return; }
      var core = coreOf(p); core.name = (p.name || 'Product') + ' (copy)';
      jfetch('/products/' + SITE + '/new', 'POST', core).then(function (j) {
        if (j && j.ok && j.id) applyExtras(j.id, p, EXTRA_FIELDS, function () { status('Duplicated ✓', 'success'); navTo(SITEROOT + '/product/' + j.id); });
        else status((j && j.error) || 'Duplicate failed', 'error');
      });
    });
  }
  function deleteProduct(card, id, anchor) {
    confirmBox(anchor, 'Delete this product?', function () {
      rawProduct(id).then(function (p) {
        jfetch('/products/' + SITE + '/' + encodeURIComponent(id), 'DELETE').then(function (j) {
          if (j && j.ok) {
            delete pending.products[id]; if (pending.order) pending.order = pending.order.filter(function (x) { return x !== id; }); refreshBar();
            var grid = card.closest('.product-grid') || card.parentNode; flip(grid, function () { card.remove(); });
            toast('Product deleted', p ? 'Undo' : null, p ? function () { restoreProduct(p); } : null);
          } else status((j && j.error) || 'Delete failed', 'error');
        });
      });
    });
  }
  function restoreProduct(p) {
    if (!p || !p.id) { status('Cannot undo', 'error'); return; }
    var core = coreOf(p); core.id = p.id;
    jfetch('/products/' + SITE + '/new', 'POST', core).then(function () {
      applyExtras(p.id, p, EXTRA_FIELDS.concat(['featured', 'position']), function () { status('Restored ✓', 'success'); setTimeout(function () { location.reload(); }, 700); });
    });
  }
  function openAddProduct() {
    // Open the full blank product page (draft). The operator fills it in / scrapes
    // it, reviews everything in the real layout, then clicks "Add product".
    navTo(SITEROOT + '/product/new');
  }

  /* ---------- BULK select + actions (shop grid) ---------- */
  function applyExtrasP(id, p, fields) { return new Promise(function (res) { applyExtras(id, p, fields, res); }); }
  function selectedIds() { return Object.keys(selected); }
  function setSelectMode(on) {
    selectMode = on; B.classList.toggle('se-selecting', on);
    if (!on) { selectedIds().forEach(function (id) { if (selected[id]) selected[id].classList.remove('se-sel'); }); selected = {}; }
    updateBulkBar();
  }
  function toggleSelect(card) {
    var id = pidOf(card); if (!id) return;
    if (selected[id]) { delete selected[id]; card.classList.remove('se-sel'); }
    else { selected[id] = card; card.classList.add('se-sel'); }
    updateBulkBar();
  }
  function bulkApply(partial) {
    var ids = selectedIds(); if (!ids.length) { status('Tap some products first', 'error'); return; }
    ids.forEach(function (id) {
      recordProduct(id, partial); var c = selected[id]; if (!c) return;
      if ('featured' in partial) { c.classList.toggle('is-hot', !!partial.featured); var w = c.querySelector('.product-card-img-wrap'), bd = c.querySelector('.product-card-hot'); if (partial.featured && !bd && w) { bd = D.createElement('span'); bd.className = 'product-card-hot'; bd.textContent = '🔥'; w.insertBefore(bd, w.firstChild); } else if (!partial.featured && bd) bd.remove(); }
      if ('in_stock' in partial) c.classList.toggle('out-of-stock', !partial.in_stock);
    });
    status(ids.length + ' product' + (ids.length > 1 ? 's' : '') + ' updated — Done → Save changes', 'success');
  }
  function bulkCategory(anchor) {
    var open = function () { mini(anchor, '<select id="bc"><option value="">— pick category —</option>' + CATS.map(function (c) { return '<option value="' + c.slug + '">' + esc(c.name) + '</option>'; }).join('') + '</select><button class="ok">Apply</button>', function (m) { var v = m.querySelector('#bc').value; if (v) bulkApply({ category: v }); closeMini(); }); };
    if (CATS.length) open(); else loadCats().then(open);
  }
  function bulkDelete(anchor) {
    var ids = selectedIds(); if (!ids.length) return;
    confirmBox(anchor, 'Delete ' + ids.length + ' product' + (ids.length > 1 ? 's' : '') + '?', function () {
      status('Deleting ' + ids.length + '…');
      Promise.all(ids.map(function (id) { return rawProduct(id).catch(function () { return null; }); })).then(function (rows) {
        var grid = (selected[ids[0]] || {}).closest ? selected[ids[0]].closest('.product-grid') : null;
        Promise.all(ids.map(function (id) { delete pending.products[id]; return jfetch('/products/' + SITE + '/' + encodeURIComponent(id), 'DELETE'); })).then(function () {
          if (pending.order) pending.order = pending.order.filter(function (x) { return ids.indexOf(x) < 0; });
          ids.forEach(function (id) { var c = selected[id]; if (c) { if (grid) flip(grid, function () { c.remove(); }); else c.remove(); } });
          var cached = rows.filter(Boolean); setSelectMode(false); refreshBar();
          toast(ids.length + ' deleted', cached.length ? 'Undo' : null, cached.length ? function () { bulkRestore(cached); } : null);
        });
      });
    });
  }
  function bulkRestore(rows) {
    status('Restoring ' + rows.length + '…');
    Promise.all(rows.map(function (p) { var core = coreOf(p); core.id = p.id; return jfetch('/products/' + SITE + '/new', 'POST', core).then(function () { return applyExtrasP(p.id, p, EXTRA_FIELDS.concat(['featured', 'position'])); }); })).then(function () { status('Restored ✓', 'success'); setTimeout(function () { location.reload(); }, 700); });
  }
  function updateBulkBar() {
    var bar = D.getElementById('se-bulk');
    if (!selectMode) { if (bar) bar.classList.remove('show'); return; }
    if (!bar) {
      bar = D.createElement('div'); bar.className = 'se-bulk'; bar.id = 'se-bulk';
      bar.innerHTML = '<span class="bcnt"></span><button data-b="hot">🔥 Hot</button><button data-b="unhot">Unhot</button><button data-b="cat">🏷 Category</button><button data-b="out">⛔ Out of stock</button><button data-b="in">✅ In stock</button><button data-b="del" class="danger">🗑 Delete</button><button data-b="done" class="ghost">Done</button>';
      B.appendChild(bar);
      bar.querySelector('[data-b=hot]').onclick = function () { bulkApply({ featured: 1 }); };
      bar.querySelector('[data-b=unhot]').onclick = function () { bulkApply({ featured: 0 }); };
      bar.querySelector('[data-b=out]').onclick = function () { bulkApply({ in_stock: 0 }); };
      bar.querySelector('[data-b=in]').onclick = function () { bulkApply({ in_stock: 1 }); };
      bar.querySelector('[data-b=cat]').onclick = function (e) { bulkCategory(e.currentTarget); };
      bar.querySelector('[data-b=del]').onclick = function (e) { bulkDelete(e.currentTarget); };
      bar.querySelector('[data-b=done]').onclick = function () { setSelectMode(false); };
    }
    bar.classList.add('show');
    bar.querySelector('.bcnt').textContent = selectedIds().length + ' selected';
  }
  function toggleHot(card, id, btn) {
    var makeHot = !card.classList.contains('is-hot');
    card.classList.toggle('is-hot', makeHot); btn.classList.toggle('on', makeHot);
    var wrap = card.querySelector('.product-card-img-wrap'), badge = card.querySelector('.product-card-hot');
    if (makeHot && !badge && wrap) { badge = D.createElement('span'); badge.className = 'product-card-hot'; badge.textContent = '🔥'; wrap.insertBefore(badge, wrap.firstChild); }
    else if (!makeHot && badge) badge.remove();
    recordProduct(id, { featured: makeHot ? 1 : 0 });
  }
  function setupDrag(card, handle, grid, onReorder) {
    handle.addEventListener('mousedown', function () { card.setAttribute('draggable', 'true'); });
    card.addEventListener('dragstart', function (e) { if (card.getAttribute('draggable') !== 'true') { e.preventDefault(); return; } dragEl = card; card.classList.add('se-dragging'); e.dataTransfer.effectAllowed = 'move'; try { e.dataTransfer.setData('text/plain', ''); } catch (x) {} });
    card.addEventListener('dragend', function () { card.classList.remove('se-dragging'); card.setAttribute('draggable', 'false'); grid.querySelectorAll('.se-over').forEach(function (n) { n.classList.remove('se-over'); }); });
    card.addEventListener('dragover', function (e) { if (!dragEl || dragEl === card || dragEl.parentNode !== card.parentNode) return; e.preventDefault(); card.classList.add('se-over'); });
    card.addEventListener('dragleave', function () { card.classList.remove('se-over'); });
    card.addEventListener('drop', function (e) { e.preventDefault(); card.classList.remove('se-over'); if (!dragEl || dragEl === card || dragEl.parentNode !== card.parentNode) return; var d = dragEl; flip(grid, function () { var cs = [].slice.call(grid.querySelectorAll('.product-card')); if (cs.indexOf(d) < cs.indexOf(card)) card.after(d); else card.before(d); }); onReorder && onReorder(); });
  }
  function recordOrder(grid) { pending.order = [].slice.call(grid.querySelectorAll('.product-card')).map(pidOf).filter(Boolean); refreshBar(); }

  /* ---------- Best Selling: curated, drag-orderable, search-to-add (home) ---------- */
  var bsGrid = null, bsAddTile = null;
  function recordBest() { if (!bsGrid) return; recordSetting('home_featured_ids', JSON.stringify([].map.call(bsGrid.querySelectorAll('.product-card'), pidOf).filter(Boolean))); }
  function bsDecorate(card) {
    if (card.__bs) return; card.__bs = 1; card.classList.add('se-card'); card.setAttribute('draggable', 'false');
    var t = D.createElement('div'); t.className = 'se-ptools';
    t.innerHTML = '<button class="se-pbtn grab" title="Drag to reorder">⠿</button><button class="se-pbtn b-rem" title="Remove from Best Selling">✕</button>';
    card.appendChild(t);
    t.querySelectorAll('.se-pbtn').forEach(function (b) { b.addEventListener('click', function (e) { e.preventDefault(); e.stopPropagation(); }); });
    t.querySelector('.b-rem').onclick = function (e) { e.preventDefault(); e.stopPropagation(); flip(bsGrid, function () { card.remove(); }); recordBest(); };
    setupDrag(card, t.querySelector('.grab'), bsGrid, recordBest);
  }
  function enhanceBestSelling() {
    bsGrid = D.querySelector('[data-best-selling]'); if (!bsGrid || bsGrid.__se) return; bsGrid.__se = 1;
    [].forEach.call(bsGrid.querySelectorAll('.product-card'), bsDecorate);
    bsAddTile = D.createElement('button'); bsAddTile.type = 'button'; bsAddTile.className = 'bs-add'; bsAddTile.textContent = '+ Pick existing product';
    bsAddTile.title = 'Pick a product already in the catalogue to feature in Best Selling';
    bsAddTile.onclick = openBestPicker; bsGrid.appendChild(bsAddTile);
  }
  function bsCard(r) {
    var a = D.createElement('a'); a.href = SITEROOT + '/product/' + r.id; a.setAttribute('data-pid', r.id); a.className = 'product-card';
    a.innerHTML = '<div class="product-card-img-wrap"><img class="product-card-img" src="' + esc(r.image) + '" referrerpolicy="no-referrer"><span class="product-card-badge">Best Selling</span></div><div class="product-card-body"><div class="product-card-name">' + esc(r.name) + '</div><div class="product-card-row"><span class="product-card-price">$' + esc(r.price) + '</span><span class="product-card-buy">Buy</span></div></div>';
    return a;
  }
  function openBestPicker() {
    var bg = D.createElement('div'); bg.className = 'se-modal-bg';
    bg.innerHTML = '<div class="se-modal"><h3>Add to Best Selling</h3><div class="sub">Search the catalogue to feature an existing product — or create a brand-new one.</div><input id="bsq" class="se-ps" placeholder="Search products…" autocomplete="off"><div id="bsres" style="margin-top:10px;max-height:46vh;overflow:auto;"></div><div class="se-row"><button class="se-b ghost" id="bsdone">Done</button><button class="se-b save" id="bsnew">+ Create new product</button></div></div>';
    B.appendChild(bg); bg.onclick = function (e) { if (e.target === bg) bg.remove(); };
    bg.querySelector('#bsdone').onclick = function () { bg.remove(); };
    bg.querySelector('#bsnew').onclick = function () { bg.remove(); openAddProduct(); };
    var input = bg.querySelector('#bsq'), res = bg.querySelector('#bsres'), timer = null;
    input.addEventListener('input', function () {
      clearTimeout(timer); var q = input.value.trim(); if (q.length < 2) { res.innerHTML = ''; return; }
      timer = setTimeout(function () {
        jfetch('/search/' + SITE + '?q=' + encodeURIComponent(q)).then(function (j) {
          var rows = (j && j.results) || [];
          res.innerHTML = rows.length ? rows.map(function (r) { return '<div class="bs-res" data-id="' + esc(r.id) + '"><img src="' + esc(r.image) + '" referrerpolicy="no-referrer"><div style="flex:1;min-width:0;"><div style="font-size:13px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">' + esc(r.name) + '</div><div style="font-size:11px;color:#9ca3af;">$' + esc(r.price) + ' · ' + esc(r.category || '') + '</div></div><span style="color:#6366f1;font-weight:700;">+ Add</span></div>'; }).join('') : '<div style="color:#9ca3af;font-size:12px;padding:8px;">No matches.</div>';
          [].forEach.call(res.querySelectorAll('.bs-res'), function (rowEl) {
            rowEl.onclick = function () {
              var r = rows.filter(function (x) { return x.id === rowEl.dataset.id; })[0]; if (!r || !bsGrid) return;
              if (bsGrid.querySelector('[data-pid="' + r.id + '"]')) { status('Already in the list', 'error'); return; }
              var c = bsCard(r); bsGrid.insertBefore(c, bsAddTile); bsDecorate(c); recordBest(); status('Added — Save changes to publish', 'success');
            };
          });
        });
      }, 250);
    });
    input.focus();
  }

  /* ---------- CATEGORY manager ---------- */
  function loadCats() { return jfetch('/categories/' + SITE).then(function (j) { CATS = (j && j.categories) || []; return CATS; }).catch(function () { return []; }); }
  function openCategories() {
    loadCats().then(function () {
      if (!CATS.length) status('Could not load categories', 'error');
      var bg = D.createElement('div'); bg.className = 'se-modal-bg';
      bg.innerHTML = '<div class="se-modal"><h3>Categories</h3><div class="sub">Drag to reorder · click a name to rename · ✕ to delete</div><div id="cl"></div><div class="se-row"><button class="se-b ghost" id="ac">+ Add category</button></div><div class="se-row"><button class="se-b ghost" id="cc">Close</button><button class="se-b save" id="cs">Save categories</button></div></div>';
      B.appendChild(bg); bg.onclick = function (e) { if (e.target === bg) bg.remove(); };
      var list = bg.querySelector('#cl');
      function row(c) {
        var d = D.createElement('div'); d.className = 'se-cat'; d.setAttribute('draggable', 'true'); d.dataset.slug = c.slug || '';
        d.innerHTML = '<span class="h">⠿</span><input value="' + esc(c.name || '') + '"><button class="del">✕</button>';
        d.querySelector('.del').onclick = function () { d.remove(); };
        d.addEventListener('dragstart', function () { dragEl = d; }); d.addEventListener('dragover', function (e) { e.preventDefault(); });
        d.addEventListener('drop', function (e) { e.preventDefault(); if (!dragEl || dragEl === d) return; var rs = [].slice.call(list.children); if (rs.indexOf(dragEl) < rs.indexOf(d)) d.after(dragEl); else d.before(dragEl); });
        return d;
      }
      CATS.forEach(function (c) { list.appendChild(row(c)); });
      bg.querySelector('#ac').onclick = function () { list.appendChild(row({ slug: '', name: 'New category' })); };
      bg.querySelector('#cc').onclick = function () { bg.remove(); };
      bg.querySelector('#cs').onclick = function () {
        var rows = [].slice.call(list.children), existing = {}; CATS.forEach(function (c) { existing[c.slug] = c; });
        var seen = {}, ops = []; status('Saving categories…');
        rows.forEach(function (d) { var slug = d.dataset.slug, name = d.querySelector('input').value.trim(); if (!name) return;
          if (slug) { seen[slug] = 1; if (existing[slug] && existing[slug].name !== name) ops.push(jfetch('/categories/' + SITE + '/' + encodeURIComponent(slug), 'PATCH', { name: name })); }
          else ops.push(jfetch('/categories/' + SITE, 'POST', { name: name })); });
        CATS.forEach(function (c) { if (!seen[c.slug]) ops.push(jfetch('/categories/' + SITE + '/' + encodeURIComponent(c.slug), 'DELETE')); });
        Promise.all(ops).then(function () { var order = rows.map(function (d) { return d.dataset.slug; }).filter(Boolean); return jfetch('/categories/' + SITE + '/reorder', 'POST', { order: order }); })
          .then(function () { return flush(); })  // also commit any pending product/text edits before reload
          .then(function () { status('Categories saved ✓', 'success'); bg.remove(); setTimeout(function () { location.reload(); }, 400); })
          .catch(function () { status('Category save failed', 'error'); });
      };
    });
  }
  /* ---------- Page settings (announcement + SEO — not hoverable on the page) ---------- */
  function openPageSettings() {
    var ann = ((D.querySelector('.announce-bar') || {}).textContent || '').trim();
    var title = D.title || '';
    var desc = ((D.querySelector('meta[name="description"]') || {}).content) || '';
    var bg = D.createElement('div'); bg.className = 'se-modal-bg';
    bg.innerHTML = '<div class="se-modal"><h3>Page settings</h3><div class="sub">Top announcement bar + browser title & SEO description</div>' +
      '<label class="se-pl">Announcement bar <span style="color:#6b7280;">(top strip — leave empty to hide)</span></label><input id="ps-ann" class="se-ps" value="' + esc(ann) + '" placeholder="e.g. Spring sale — coupons up to $500">' +
      '<label class="se-pl">Browser tab title (SEO)</label><input id="ps-title" class="se-ps" value="' + esc(title) + '">' +
      '<label class="se-pl">Meta description (SEO)</label><textarea id="ps-desc" class="se-ps" style="min-height:64px;">' + esc(desc) + '</textarea>' +
      '<div class="se-row"><button class="se-b ghost" id="ps-c">Cancel</button><button class="se-b save" id="ps-s">Apply</button></div></div>';
    B.appendChild(bg); bg.onclick = function (e) { if (e.target === bg) bg.remove(); };
    bg.querySelector('#ps-c').onclick = function () { bg.remove(); };
    bg.querySelector('#ps-s').onclick = function () {
      var a = bg.querySelector('#ps-ann').value, t = bg.querySelector('#ps-title').value, d = bg.querySelector('#ps-desc').value;
      if (a !== ann) { recordSetting('announcement_text', a); var bar = D.querySelector('.announce-bar'); if (bar) bar.textContent = a; }
      if (t !== title) recordSetting('page_title', t);
      if (d !== desc) recordSetting('meta_description', d);
      bg.remove(); status('Queued — click “Save changes”', 'success');
    };
  }
  window.StudioEditor = { openCategories: openCategories, openPageSettings: openPageSettings, save: flush, dirty: dirtyCount };

  /* ---------- select-mode: clicking a card toggles selection ---------- */
  D.addEventListener('click', function (e) {
    if (!selectMode) return;
    var card = e.target.closest && e.target.closest('.product-card');
    if (card && !card.closest('[data-best-selling]')) { e.preventDefault(); e.stopPropagation(); toggleSelect(card); }
  }, true);

  /* ---------- navigation guard: save before leaving with unsaved edits ---------- */
  D.addEventListener('click', function (e) {
    var a = e.target.closest && e.target.closest('a[href]'); if (!a) return;
    if (a.classList.contains('se-pen') || a.closest('.se-ptools') || a.closest('.se-bar')) return;
    var href = a.getAttribute('href'); if (!href || href.charAt(0) === '#' || /^(mailto|tel|javascript):/i.test(href)) return;
    if (a.target === '_blank') return;
    if (!dirtyCount()) return;  // clean: let normal navigation happen
    e.preventDefault(); e.stopPropagation(); navTo(href);
  }, true);

  /* ---------- boot ---------- */
  function scan() {
    B.classList.add('se-editing');
    D.querySelectorAll('.pf-empty').forEach(function (el) { el.classList.remove('pf-empty'); }); // reveal empty slots so they can be filled (class is the only thing hiding them)
    D.querySelectorAll('[data-edit],[data-edit-brand]').forEach(bindText);
    if (PID || DRAFT_MODE) { D.querySelectorAll('[data-pf]').forEach(bindProductField); D.querySelectorAll('[data-qc-edit]').forEach(bindQc); D.querySelectorAll('[data-variant-edit]').forEach(bindVariants); bindProductToolbar(); }
    enhanceBestSelling();
    enhanceCards();
    if (DRAFT_MODE) {
      // Draft "Add product" page: a dedicated bar to create the product (no
      // per-field save — everything is collected into DRAFT and created at once).
      if (!D.getElementById('se-draftbar')) {
        var db = D.createElement('div'); db.className = 'se-bar show'; db.id = 'se-draftbar';
        db.innerHTML = '<span class="cnt">New product — fill it in or scrape, then add it</span><button class="disc" id="se-draftcancel">Cancel</button><button class="save" id="se-draftadd">✓ Add product</button>';
        B.appendChild(db);
        db.querySelector('#se-draftadd').onclick = saveDraftProduct;
        db.querySelector('#se-draftcancel').onclick = function () { location.href = SITEROOT + '/shop'; };
      }
      return;  // skip the normal save bar + recovery on the draft page
    }
    if (!D.getElementById('se-bar')) {
      var bar = D.createElement('div'); bar.className = 'se-bar'; bar.id = 'se-bar';
      bar.innerHTML = '<span class="cnt">● 0 unsaved changes</span><button class="disc">Discard</button><button class="save">Save changes</button>';
      B.appendChild(bar);
      bar.querySelector('.save').onclick = function () { flush(); };
      bar.querySelector('.disc').onclick = function () { try { localStorage.removeItem(PKEY); } catch (e) {} if (dirtyCount()) location.reload(); };
    }
    refreshBar();
    // Recover unsaved edits from a previous session (crash / cold-start / accidental close)
    if (!window.__seRecoverChecked) { window.__seRecoverChecked = 1; try { var saved = JSON.parse(localStorage.getItem(PKEY) || 'null'); if (saved) showRecover(saved); } catch (e) {} }
  }
  window.__seRescan = scan;
  if (PID || DRAFT_MODE) loadCats().finally(scan); else scan();  // categories needed on the product/draft page
  var h = D.createElement('div'); h.className = 'se-hint'; h.textContent = DRAFT_MODE ? 'New product — click any field to fill it in, or ⚡ Scrape to auto-fill, then “Add product”' : 'Edit mode — changes are instant; click “Save changes” when ready';
  B.appendChild(h); setTimeout(function () { h.style.transition = 'opacity .4s'; h.style.opacity = '0'; setTimeout(function () { h.remove(); }, 500); }, 5000);
})();
