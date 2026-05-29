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
  var CATS = [];
  var dragEl = null;
  var D = document, B = D.body;
  var pending = { products: {}, settings: {}, order: null };

  function jfetch(path, method, body) {
    return fetch(path, { method: method || 'GET', headers: { 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined, credentials: 'same-origin' })
      .then(function (r) { return r.json().catch(function () { return { ok: r.ok }; }); });
  }
  function status(msg, kind) { try { (window.parent.StudioStatus || function () {})(msg, kind); } catch (e) {} }
  function esc(s) { return (s == null ? '' : String(s)).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
  function isPlaceholder(t) { t = (t || '').trim(); return t === '' || t === '—' || t === 'Unspecified'; }
  function mkPen() { var p = D.createElement('span'); p.className = 'se-pen'; p.textContent = '✎'; return p; }

  /* ---------- pending changes ---------- */
  function recordProduct(id, partial) { if (!id) return; var p = pending.products[id] || (pending.products[id] = {}); Object.keys(partial).forEach(function (k) { p[k] = partial[k]; }); refreshBar(); }
  function recordSetting(key, val) { pending.settings[key] = val; refreshBar(); }
  function dirtyCount() { return Object.keys(pending.products).length + Object.keys(pending.settings).length + (pending.order ? 1 : 0); }
  function refreshBar() {
    var bar = D.getElementById('se-bar'); if (!bar) return;
    var n = dirtyCount();
    bar.classList.toggle('show', n > 0);
    var c = bar.querySelector('.cnt'); if (c) c.textContent = '● ' + n + ' unsaved change' + (n === 1 ? '' : 's');
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
      if (ok) { pending = { products: {}, settings: {}, order: null }; refreshBar(); status('All changes saved ✓', 'success'); return true; }
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
    '.se-mini{position:absolute;z-index:2147483600;background:#16161c;border:1px solid #2a2a35;border-radius:10px;padding:8px;display:flex;gap:6px;align-items:center;box-shadow:0 14px 40px rgba(0,0,0,.55);}',
    '.se-mini input,.se-mini select,.se-mini textarea{background:#0f0f14;border:1px solid #2a2a35;color:#fff;border-radius:7px;padding:8px 10px;font:13px system-ui;outline:none;}',
    '.se-mini textarea{min-width:300px;min-height:90px;resize:vertical;}',
    '.se-mini .ok{background:#6366f1;color:#fff;border:none;border-radius:7px;padding:8px 11px;cursor:pointer;font-weight:700;}',
    '.se-modal-bg{position:fixed;inset:0;z-index:2147483600;background:rgba(0,0,0,.6);backdrop-filter:blur(4px);display:flex;align-items:center;justify-content:center;padding:20px;font:14px system-ui;}',
    '.se-modal{background:#16161c;color:#fff;border:1px solid #2a2a35;border-radius:16px;width:520px;max-width:96vw;max-height:88vh;overflow:auto;padding:22px;box-shadow:0 24px 70px rgba(0,0,0,.6);}',
    '.se-modal h3{margin:0 0 4px;font-size:18px;}.se-modal .sub{color:#9ca3af;font-size:12px;margin-bottom:16px;}',
    '.se-cat{display:flex;align-items:center;gap:10px;background:#0f0f14;border:1px solid #2a2a35;border-radius:10px;padding:9px 11px;margin-bottom:8px;}',
    '.se-cat .h{cursor:grab;color:#6b7280;font-size:16px;}.se-cat input{flex:1;background:transparent;border:none;color:#fff;font-size:14px;outline:none;}.se-cat .del{background:none;border:none;color:#ef4444;cursor:pointer;font-size:16px;}',
    '.se-row{display:flex;gap:8px;margin-top:14px;}.se-b{flex:1;border:none;border-radius:8px;padding:10px;font-weight:700;font-size:12px;cursor:pointer;}.se-b.save{background:#6366f1;color:#fff;}.se-b.ghost{background:#23232c;color:#cbd5e1;}',
    '.se-bar{position:fixed;bottom:0;left:0;right:0;z-index:2147483600;display:none;align-items:center;justify-content:center;gap:14px;padding:12px;background:linear-gradient(0deg,rgba(10,10,13,.97),rgba(10,10,13,.85));backdrop-filter:blur(8px);border-top:1px solid #2a2a35;font:600 13px system-ui;color:#fff;}',
    '.se-bar.show{display:flex;}.se-bar .cnt{color:#fbbf24;}',
    '.se-bar button{border:none;border-radius:9px;padding:10px 18px;font-weight:700;font-size:13px;cursor:pointer;}',
    '.se-bar .save{background:#6366f1;color:#fff;}.se-bar .save:hover{background:#4f46e5;}.se-bar .save:disabled{opacity:.6;cursor:default;}.se-bar .disc{background:#23232c;color:#cbd5e1;}',
    '.se-hint{position:fixed;left:50%;transform:translateX(-50%);bottom:70px;background:#6366f1;color:#fff;padding:9px 18px;border-radius:999px;font:600 12px system-ui;z-index:2147483500;box-shadow:0 6px 20px rgba(0,0,0,.4);}'
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

  function closeMini() { var m = D.getElementById('se-mini'); if (m) m.remove(); }
  function mini(anchor, inner, onOk) {
    closeMini();
    var m = D.createElement('div'); m.className = 'se-mini'; m.id = 'se-mini'; m.innerHTML = inner; B.appendChild(m);
    var r = anchor.getBoundingClientRect();
    m.style.top = (window.scrollY + r.bottom + 6) + 'px';
    m.style.left = (window.scrollX + Math.max(8, Math.min(r.left, window.innerWidth - m.offsetWidth - 12))) + 'px';
    var ok = m.querySelector('.ok'); if (ok) ok.onclick = function () { onOk(m); };
    var f = m.querySelector('input,textarea,select'); if (f) f.focus();
    setTimeout(function () { D.addEventListener('mousedown', function off(e) { if (!D.getElementById('se-mini')) { D.removeEventListener('mousedown', off); return; } if (!m.contains(e.target)) { closeMini(); D.removeEventListener('mousedown', off); } }, true); }, 0);
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
      var host = el.closest('.pd-img-wrap') || el.parentElement || el;
      if (host.__se) return; host.__se = 1; host.classList.add('se-ed-h');
      if (getComputedStyle(host).position === 'static') host.style.position = 'relative';
      var ip = mkPen(); host.appendChild(ip); ip.onclick = function (e) { e.preventDefault(); e.stopPropagation(); editImage(el); };
      return;
    }
    if (el.__se) return; el.__se = 1; el.classList.add('se-ed-h');
    var pen = mkPen(); el.appendChild(pen);
    pen.onclick = function (e) {
      e.preventDefault(); e.stopPropagation();
      if (type === 'quality') return editQuality(el);
      if (type === 'category') return editCategory(el);
      if (type === 'price') {
        var num = (el.textContent.replace('✎', '').match(/[0-9.]+/) || [''])[0];
        return inlineEdit(el, { pen: pen, startText: el.textContent.replace('✎', ''), setText: num, cmp: num,
          save: function (val) { var n = (val.match(/[0-9.]+/) || [''])[0] || '0'; el.textContent = '$' + n; el.setAttribute('data-price-usd', n); recordProduct(PID, { price: n }); } });
      }
      var clone = el.cloneNode(true); var p = clone.querySelector('.se-pen'); if (p) p.remove();
      inlineEdit(el, { pen: pen, clearPlaceholder: true, startText: clone.textContent.trim(),
        save: function (val) { if (type === 'int') val = (val.replace(/[^0-9]/g, '') || '0'); var o = {}; o[field] = val; recordProduct(PID, o); } });
    };
  }
  function editImage(img) {
    mini(img, '<input id="iu" value="' + esc(img.getAttribute('src')) + '" size="34" placeholder="https://..."><button class="ok">OK</button>', function (m) {
      var v = m.querySelector('#iu').value.trim(); if (!v) return; img.src = v; recordProduct(PID, { image: v }); closeMini();
    });
  }
  function editQuality(el) {
    var valEl = el.querySelector('.pf-val') || el, cur = isPlaceholder(valEl.textContent) ? '' : valEl.textContent.trim();
    var opts = ['', 'BUDGET', 'TOP', '1:1'].map(function (o) { return '<option' + (o === cur ? ' selected' : '') + ' value="' + o + '">' + (o || '— none —') + '</option>'; }).join('');
    mini(el, '<select id="q">' + opts + '</select><button class="ok">OK</button>', function (m) {
      var v = m.querySelector('#q').value; valEl.textContent = v || '—'; el.classList.toggle('pf-empty', !v); recordProduct(PID, { quality: v }); closeMini();
    });
  }
  function editCategory(el) {
    var valEl = el.querySelector('.pf-val') || el, cur = isPlaceholder(valEl.textContent) ? '' : valEl.textContent.trim();
    var opts = ['<option value="">— none —</option>'].concat(CATS.map(function (c) { return '<option' + (c.slug === cur ? ' selected' : '') + ' value="' + c.slug + '">' + esc(c.name) + '</option>'; })).join('');
    mini(el, '<select id="c">' + opts + '</select><button class="ok">OK</button>', function (m) {
      var v = m.querySelector('#c').value; valEl.textContent = v || '—'; el.classList.toggle('pf-empty', !v); var s = D.getElementById('ppSource'); if (s) s.textContent = (v || 'Find').toUpperCase(); recordProduct(PID, { category: v }); closeMini();
    });
  }
  function bindQc(el) {
    if (el.__se) return; el.__se = 1; el.classList.add('se-ed-h');
    var pen = mkPen(); el.appendChild(pen);
    pen.onclick = function (e) {
      e.preventDefault(); e.stopPropagation();
      var imgs = [].map.call(D.querySelectorAll('#ppQc img'), function (i) { return i.src; });
      mini(el, '<textarea id="qc" placeholder="One QC photo URL per line">' + esc(imgs.join('\n')) + '</textarea><button class="ok">OK</button>', function (m) {
        var lines = m.querySelector('#qc').value.split('\n').map(function (x) { return x.trim(); }).filter(Boolean);
        var box = D.getElementById('ppQc'); if (box) { box.className = 'pd-qc'; box.innerHTML = lines.length ? lines.map(function (u) { return '<img src="' + esc(u) + '" referrerpolicy="no-referrer">'; }).join('') : '<div class="pd-qc-empty">No QC photos yet.</div>'; }
        recordProduct(PID, { qc_photos: JSON.stringify(lines) }); closeMini();
      });
    };
  }

  /* ---------- PRODUCT cards ---------- */
  function pidOf(card) { return card.getAttribute('data-pid') || ((card.getAttribute('href') || '').match(/\/product\/([^/?#]+)/) || [])[1]; }
  function enhanceCards() {
    var grid = D.querySelector('.product-grid'); if (!grid) return;
    var onProductPage = !!PID;
    grid.querySelectorAll('.product-card').forEach(function (card) {
      if (card.__se) return; card.__se = 1; card.classList.add('se-card');
      var id = pidOf(card); if (!id) return;
      card.setAttribute('draggable', 'false');
      var hot = card.classList.contains('is-hot');
      var t = D.createElement('div'); t.className = 'se-ptools';
      t.innerHTML = (onProductPage ? '' : '<button class="se-pbtn grab" title="Drag to reorder">⠿</button>') +
        '<button class="se-pbtn b-hot' + (hot ? ' on' : '') + '" title="Hot">🔥</button>' +
        '<button class="se-pbtn b-edit" title="Edit this product">✎</button>';
      card.appendChild(t);
      t.querySelectorAll('.se-pbtn').forEach(function (b) { b.addEventListener('click', function (e) { e.preventDefault(); e.stopPropagation(); }); });
      t.querySelector('.b-edit').onclick = function (e) { e.preventDefault(); e.stopPropagation(); navTo(card.getAttribute('href')); };
      t.querySelector('.b-hot').onclick = function (e) { e.preventDefault(); e.stopPropagation(); toggleHot(card, id, this); };
      if (!onProductPage) { var g = t.querySelector('.grab'); if (g) setupDrag(card, g, grid); }
    });
  }
  function toggleHot(card, id, btn) {
    var makeHot = !card.classList.contains('is-hot');
    card.classList.toggle('is-hot', makeHot); btn.classList.toggle('on', makeHot);
    var wrap = card.querySelector('.product-card-img-wrap'), badge = card.querySelector('.product-card-hot');
    if (makeHot && !badge && wrap) { badge = D.createElement('span'); badge.className = 'product-card-hot'; badge.textContent = '🔥'; wrap.insertBefore(badge, wrap.firstChild); }
    else if (!makeHot && badge) badge.remove();
    recordProduct(id, { featured: makeHot ? 1 : 0 });
  }
  function setupDrag(card, handle, grid) {
    handle.addEventListener('mousedown', function () { card.setAttribute('draggable', 'true'); });
    card.addEventListener('dragstart', function (e) { if (card.getAttribute('draggable') !== 'true') { e.preventDefault(); return; } dragEl = card; card.classList.add('se-dragging'); e.dataTransfer.effectAllowed = 'move'; try { e.dataTransfer.setData('text/plain', ''); } catch (x) {} });
    card.addEventListener('dragend', function () { card.classList.remove('se-dragging'); card.setAttribute('draggable', 'false'); grid.querySelectorAll('.se-over').forEach(function (n) { n.classList.remove('se-over'); }); });
    card.addEventListener('dragover', function (e) { if (!dragEl || dragEl === card) return; e.preventDefault(); card.classList.add('se-over'); });
    card.addEventListener('dragleave', function () { card.classList.remove('se-over'); });
    card.addEventListener('drop', function (e) { e.preventDefault(); card.classList.remove('se-over'); if (!dragEl || dragEl === card) return; var cs = [].slice.call(grid.querySelectorAll('.product-card')); if (cs.indexOf(dragEl) < cs.indexOf(card)) card.after(dragEl); else card.before(dragEl); recordOrder(grid); });
  }
  function recordOrder(grid) { pending.order = [].slice.call(grid.querySelectorAll('.product-card')).map(pidOf).filter(Boolean); refreshBar(); }

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
  window.StudioEditor = { openCategories: openCategories, save: flush, dirty: dirtyCount };

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
    D.querySelectorAll('.pf-empty').forEach(function (el) { el.style.display = el.classList.contains('pd-badge') ? 'inline-flex' : ''; });
    D.querySelectorAll('[data-edit],[data-edit-brand]').forEach(bindText);
    if (PID) { D.querySelectorAll('[data-pf]').forEach(bindProductField); D.querySelectorAll('[data-qc-edit]').forEach(bindQc); }
    enhanceCards();
    if (!D.getElementById('se-bar')) {
      var bar = D.createElement('div'); bar.className = 'se-bar'; bar.id = 'se-bar';
      bar.innerHTML = '<span class="cnt">● 0 unsaved changes</span><button class="disc">Discard</button><button class="save">Save changes</button>';
      B.appendChild(bar);
      bar.querySelector('.save').onclick = function () { flush(); };
      bar.querySelector('.disc').onclick = function () { if (dirtyCount()) location.reload(); };
    }
    refreshBar();
  }
  window.__seRescan = scan;
  loadCats().finally(scan);
  var h = D.createElement('div'); h.className = 'se-hint'; h.textContent = 'Edit mode — changes are instant; click “Save changes” when ready';
  B.appendChild(h); setTimeout(function () { h.style.transition = 'opacity .4s'; h.style.opacity = '0'; setTimeout(function () { h.remove(); }, 500); }, 4000);
})();
