/* ============================================================
   Immersive IN-PLACE site editor (injected into the live site iframe).
   Click the actual element on the page to edit it — text becomes
   editable where it sits, badges become dropdowns, the image/QC get
   anchored editors. Saves go through master-admin proxies (session
   authed). Works on home, shop, and product pages.
   ============================================================ */
(function () {
  if (window.__STUDIO_EDITOR_LOADED) { try { window.__seRescan(); } catch (e) {} return; }
  window.__STUDIO_EDITOR_LOADED = true;

  var CFG = window.__STUDIO__ || {};
  var SITE = CFG.siteId || '';
  var PID = (typeof window.PID !== 'undefined') ? window.PID : null;  // set on product pages
  var CATS = [];
  var dragEl = null;
  var D = document, B = D.body;

  function jfetch(path, method, body) {
    return fetch(path, { method: method || 'GET', headers: { 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined, credentials: 'same-origin' })
      .then(function (r) { return r.json().catch(function () { return {}; }); });
  }
  function status(msg, kind) { try { (window.parent.StudioStatus || function () {})(msg, kind); } catch (e) {} }
  function esc(s) { return (s == null ? '' : String(s)).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
  function isPlaceholder(t) { t = (t || '').trim(); return t === '' || t === '—' || t === 'Unspecified'; }
  function saveProduct(field, value, ok) {
    if (!PID) { status('Open a product page to edit this', 'error'); return; }
    var body = {}; body[field] = value; status('Saving…');
    jfetch('/products/' + SITE + '/' + encodeURIComponent(PID), 'PUT', body).then(function (j) {
      if (j && j.ok) { status('Saved ✓', 'success'); ok && ok(); } else { status((j && j.error) || 'Save failed', 'error'); }
    });
  }
  function saveSetting(key, value, ok) {
    var body = {}; body[key] = value; status('Saving…');
    jfetch('/content/' + SITE, 'POST', body).then(function (j) {
      if (j && j.ok) { status('Saved ✓', 'success'); ok && ok(); } else { status((j && j.error) || 'Save failed', 'error'); }
    });
  }

  /* ---------- styles ---------- */
  var css = D.createElement('style');
  css.textContent = [
    '[data-edit],[data-edit-brand],[data-pf],[data-qc-edit]{position:relative;}',
    '.se-ed-h{outline:1.5px dashed rgba(99,102,241,.5);outline-offset:3px;border-radius:3px;transition:outline-color .12s;}',
    '.se-ed-h:hover{outline-color:#6366f1;outline-style:solid;cursor:pointer;}',
    '.se-now{outline:2px solid #22c55e!important;outline-offset:3px;background:rgba(34,197,94,.08);cursor:text;}',
    '.se-pen{position:absolute;top:-11px;right:-11px;width:25px;height:25px;border-radius:50%;background:#6366f1;color:#fff;border:2px solid #fff;display:none;align-items:center;justify-content:center;font-size:12px;cursor:pointer;z-index:2147483000;box-shadow:0 2px 8px rgba(0,0,0,.35);}',
    '.se-ed-h:hover>.se-pen{display:flex;}',
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
    '.se-hint{position:fixed;left:50%;transform:translateX(-50%);bottom:18px;background:#6366f1;color:#fff;padding:9px 18px;border-radius:999px;font:600 12px system-ui;z-index:2147483600;box-shadow:0 6px 20px rgba(0,0,0,.4);}'
  ].join('');
  D.head.appendChild(css);

  /* ---------- inline contentEditable ---------- */
  function selectAll(el) { try { var r = D.createRange(); r.selectNodeContents(el); var s = window.getSelection(); s.removeAllRanges(); s.addRange(r); } catch (e) {} }
  function inlineEdit(el, opts) {
    opts = opts || {};
    var orig = opts.startText != null ? opts.startText : el.textContent;
    if (opts.clearPlaceholder && isPlaceholder(el.textContent)) el.textContent = '';
    el.setAttribute('contenteditable', 'true'); el.classList.add('se-now'); el.focus(); selectAll(el);
    var done = false;
    function finish(commit) {
      if (done) return; done = true;
      el.removeAttribute('contenteditable'); el.classList.remove('se-now');
      el.removeEventListener('keydown', kd); el.removeEventListener('blur', bl);
      if (commit) { opts.save(opts.html ? el.innerHTML.trim() : el.textContent.trim(), el); }
      else { if (opts.html) el.innerHTML = orig; else el.textContent = orig; }
    }
    function kd(e) { if (e.key === 'Enter' && !opts.multiline) { e.preventDefault(); finish(true); } else if (e.key === 'Escape') { e.preventDefault(); finish(false); } }
    function bl() { finish(true); }
    el.addEventListener('keydown', kd); el.addEventListener('blur', bl);
  }

  /* ---------- anchored mini editor (image / qc / dropdowns) ---------- */
  function closeMini() { var m = D.getElementById('se-mini'); if (m) m.remove(); }
  function mini(anchor, inner, onOk) {
    closeMini();
    var m = D.createElement('div'); m.className = 'se-mini'; m.id = 'se-mini'; m.innerHTML = inner;
    B.appendChild(m);
    var r = anchor.getBoundingClientRect();
    m.style.top = (window.scrollY + r.bottom + 6) + 'px';
    m.style.left = (window.scrollX + Math.min(r.left, window.innerWidth - m.offsetWidth - 12)) + 'px';
    var ok = m.querySelector('.ok'); if (ok) ok.onclick = function () { onOk(m); };
    var f = m.querySelector('input,textarea,select'); if (f) f.focus();
    D.addEventListener('mousedown', function off(e) { if (m && !m.contains(e.target)) { closeMini(); D.removeEventListener('mousedown', off); } }, true);
    return m;
  }

  /* ---------- TEXT (settings) editing ---------- */
  function bindText(el) {
    if (el.__se) return; el.__se = 1;
    el.classList.add('se-ed-h');
    var pen = D.createElement('span'); pen.className = 'se-pen'; pen.textContent = '✎'; el.appendChild(pen);
    pen.onclick = function (e) {
      e.preventDefault(); e.stopPropagation();
      if (el.hasAttribute('data-edit-brand')) return editBrand(el);
      var key = el.getAttribute('data-edit'), html = el.hasAttribute('data-edit-html');
      var clone = el.cloneNode(true); var p = clone.querySelector('.se-pen'); if (p) p.remove();
      el.removeChild(pen);
      inlineEdit(el, { html: html, startText: html ? clone.innerHTML.trim() : clone.textContent.trim(),
        save: function (val) { saveSetting(key, val); el.appendChild(pen); }, multiline: html });
    };
  }
  function editBrand(el) {
    var span = el.querySelector('.accent');
    var p1 = (el.childNodes[0] && el.childNodes[0].textContent || '').trim();
    var p2 = (span && span.textContent || '').trim();
    mini(el, '<input id="b1" value="' + esc(p1) + '" size="8"><input id="b2" value="' + esc(p2) + '" size="8"><button class="ok">Save</button>', function (m) {
      var v1 = m.querySelector('#b1').value, v2 = m.querySelector('#b2').value;
      saveSetting('brand_part1', v1, function () { saveSetting('brand_part2', v2, function () { el.childNodes[0].textContent = v1; if (span) span.textContent = v2; }); });
      closeMini();
    });
  }

  /* ---------- PRODUCT field editing (product page) ---------- */
  function bindProductField(el) {
    if (el.__se) return; el.__se = 1;
    el.classList.add('se-ed-h');
    var pen = D.createElement('span'); pen.className = 'se-pen'; pen.textContent = '✎'; el.appendChild(pen);
    var field = el.getAttribute('data-pf'), type = el.getAttribute('data-pf-type') || 'text';
    pen.onclick = function (e) {
      e.preventDefault(); e.stopPropagation();
      if (type === 'image') return editImage(el, field);
      if (type === 'quality') return editQuality(el, field);
      if (type === 'category') return editCategory(el, field);
      if (type === 'price') { el.removeChild(pen); var cur = el.textContent.replace(/[^0-9.]/g, ''); inlineEdit(el, { startText: el.textContent.replace('✎',''), save: function () { var num = el.textContent.replace(/[^0-9.]/g, ''); saveProduct('price', num, function () { el.textContent = '$' + num; el.appendChild(pen); }); el.appendChild(pen); } }); el.textContent = cur; selectAll(el); return; }
      // text / int: editable target may be a child span (sales) or the element itself
      var tEl = (type === 'int') ? el : el;
      el.removeChild(pen);
      inlineEdit(el, { clearPlaceholder: true, save: function (val) {
        if (type === 'int') val = (val || '').replace(/[^0-9]/g, '') || '0';
        saveProduct(field, val, function () { if (isPlaceholder(val) && (field === 'weight')) el.textContent = '—'; }); el.appendChild(pen);
      } });
    };
  }
  function editImage(el, field) {
    mini(el, '<input id="iu" value="' + esc(el.getAttribute('src')) + '" size="34" placeholder="https://..."><button class="ok">Set</button>', function (m) {
      var v = m.querySelector('#iu').value.trim(); if (!v) return; saveProduct('image', v, function () { el.src = v; }); closeMini();
    });
  }
  function editQuality(el, field) {
    var valEl = el.querySelector('.pf-val') || el, cur = isPlaceholder(valEl.textContent) ? '' : valEl.textContent.trim();
    var opts = ['', 'BUDGET', 'TOP', '1:1'].map(function (o) { return '<option' + (o === cur ? ' selected' : '') + ' value="' + o + '">' + (o || '— none —') + '</option>'; }).join('');
    mini(el, '<select id="q">' + opts + '</select><button class="ok">Save</button>', function (m) {
      var v = m.querySelector('#q').value; saveProduct('quality', v, function () { valEl.textContent = v || '—'; el.classList.toggle('pf-empty', !v); }); closeMini();
    });
  }
  function editCategory(el, field) {
    var valEl = el.querySelector('.pf-val') || el, cur = isPlaceholder(valEl.textContent) ? '' : valEl.textContent.trim();
    var opts = ['<option value="">— none —</option>'].concat(CATS.map(function (c) { return '<option' + (c.slug === cur ? ' selected' : '') + ' value="' + c.slug + '">' + esc(c.name) + '</option>'; })).join('');
    mini(el, '<select id="c">' + opts + '</select><button class="ok">Save</button>', function (m) {
      var v = m.querySelector('#c').value; saveProduct('category', v, function () { valEl.textContent = v || '—'; el.classList.toggle('pf-empty', !v); var src = D.getElementById('ppSource'); if (src) src.textContent = (v || 'Find').toUpperCase(); }); closeMini();
    });
  }
  function bindQc(el) {
    if (el.__se) return; el.__se = 1; el.classList.add('se-ed-h');
    var pen = D.createElement('span'); pen.className = 'se-pen'; pen.textContent = '✎'; el.appendChild(pen);
    pen.onclick = function (e) {
      e.preventDefault(); e.stopPropagation();
      var imgs = Array.prototype.map.call(D.querySelectorAll('#ppQc img'), function (i) { return i.src; });
      mini(el, '<textarea id="qc" placeholder="One QC photo URL per line">' + esc(imgs.join('\n')) + '</textarea><button class="ok">Save</button>', function (m) {
        var lines = m.querySelector('#qc').value.split('\n').map(function (x) { return x.trim(); }).filter(Boolean);
        saveProduct('qc_photos', JSON.stringify(lines), function () {
          var box = D.getElementById('ppQc');
          if (box) { box.className = 'pd-qc'; box.innerHTML = lines.length ? lines.map(function (u) { return '<img src="' + esc(u) + '" referrerpolicy="no-referrer">'; }).join('') : '<div class="pd-qc-empty">No QC photos yet.</div>'; }
        });
        closeMini();
      });
    };
  }

  /* ---------- PRODUCT cards (grid) ---------- */
  function pidOf(card) { return card.getAttribute('data-pid') || ((card.getAttribute('href') || '').match(/\/product\/([^/?#]+)/) || [])[1]; }
  function enhanceCards() {
    var grid = D.querySelector('.product-grid'); if (!grid) return;
    var onProductPage = !!PID; // related grid shouldn't be drag-sorted
    grid.querySelectorAll('.product-card').forEach(function (card) {
      if (card.__se) return; card.__se = 1; card.classList.add('se-card');
      var id = pidOf(card); if (!id) return;
      var hot = card.classList.contains('is-hot');
      var t = D.createElement('div'); t.className = 'se-ptools';
      t.innerHTML = (onProductPage ? '' : '<button class="se-pbtn grab" title="Drag to reorder">⠿</button>') +
        '<button class="se-pbtn b-hot' + (hot ? ' on' : '') + '" title="Hot">🔥</button>' +
        '<button class="se-pbtn b-edit" title="Edit on its page">✎</button>';
      card.appendChild(t);
      t.querySelectorAll('.se-pbtn').forEach(function (b) { b.addEventListener('click', function (e) { e.preventDefault(); e.stopPropagation(); }); });
      t.querySelector('.b-edit').onclick = function (e) { e.preventDefault(); e.stopPropagation(); window.location.href = '/product/' + encodeURIComponent(id); };
      t.querySelector('.b-hot').onclick = function (e) { e.preventDefault(); e.stopPropagation(); toggleHot(card, id, this); };
      if (!onProductPage) { var g = t.querySelector('.grab'); if (g) setupDrag(card, g, grid); }
    });
  }
  function toggleHot(card, id, btn) {
    var makeHot = !card.classList.contains('is-hot'); status('Saving…');
    jfetch('/products/' + SITE + '/' + encodeURIComponent(id), 'PUT', { featured: makeHot ? 1 : 0 }).then(function (j) {
      if (j && j.ok) {
        card.classList.toggle('is-hot', makeHot); btn.classList.toggle('on', makeHot);
        var wrap = card.querySelector('.product-card-img-wrap'), badge = card.querySelector('.product-card-hot');
        if (makeHot && !badge && wrap) { badge = D.createElement('span'); badge.className = 'product-card-hot'; badge.textContent = '🔥'; wrap.insertBefore(badge, wrap.firstChild); }
        else if (!makeHot && badge) badge.remove();
        status(makeHot ? 'Marked hot 🔥' : 'Unmarked', 'success');
      } else status((j && j.error) || 'Save failed', 'error');
    });
  }
  function setupDrag(card, handle, grid) {
    handle.addEventListener('mousedown', function () { card.setAttribute('draggable', 'true'); });
    card.addEventListener('dragstart', function (e) { dragEl = card; card.classList.add('se-dragging'); e.dataTransfer.effectAllowed = 'move'; try { e.dataTransfer.setData('text/plain', ''); } catch (x) {} });
    card.addEventListener('dragend', function () { card.classList.remove('se-dragging'); card.removeAttribute('draggable'); grid.querySelectorAll('.se-over').forEach(function (n) { n.classList.remove('se-over'); }); });
    card.addEventListener('dragover', function (e) { if (!dragEl || dragEl === card) return; e.preventDefault(); card.classList.add('se-over'); });
    card.addEventListener('dragleave', function () { card.classList.remove('se-over'); });
    card.addEventListener('drop', function (e) { e.preventDefault(); card.classList.remove('se-over'); if (!dragEl || dragEl === card) return; var cs = [].slice.call(grid.querySelectorAll('.product-card')); if (cs.indexOf(dragEl) < cs.indexOf(card)) card.after(dragEl); else card.before(dragEl); persistOrder(grid); });
  }
  function persistOrder(grid) {
    var cards = [].slice.call(grid.querySelectorAll('.product-card')); status('Saving order…');
    Promise.all(cards.map(function (c, i) { var id = pidOf(c); return id ? jfetch('/products/' + SITE + '/' + encodeURIComponent(id), 'PUT', { position: i }) : null; })).then(function () { status('Order saved ✓', 'success'); });
  }

  /* ---------- CATEGORY manager ---------- */
  function loadCats() { return jfetch('/categories/' + SITE).then(function (j) { CATS = (j && j.categories) || []; return CATS; }).catch(function () { return []; }); }
  function openCategories() {
    loadCats().then(function () {
      var bg = D.createElement('div'); bg.className = 'se-modal-bg';
      bg.innerHTML = '<div class="se-modal"><h3>Categories</h3><div class="sub">Drag to reorder · click a name to rename · ✕ to delete</div><div id="cl"></div><div class="se-row"><button class="se-b ghost" id="ac">+ Add category</button></div><div class="se-row"><button class="se-b ghost" id="cc">Close</button><button class="se-b save" id="cs">Save changes</button></div></div>';
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
          .then(function () { status('Categories saved ✓', 'success'); bg.remove(); setTimeout(function () { location.reload(); }, 500); });
      };
    });
  }
  window.StudioEditor = { openCategories: openCategories };

  /* ---------- boot ---------- */
  function scan() {
    B.classList.add('se-editing');
    // reveal empty product slots so they can be filled
    D.querySelectorAll('.pf-empty').forEach(function (el) { el.style.display = el.classList.contains('pd-badge') ? 'inline-flex' : ''; });
    D.querySelectorAll('[data-edit],[data-edit-brand]').forEach(bindText);
    if (PID) { D.querySelectorAll('[data-pf]').forEach(bindProductField); D.querySelectorAll('[data-qc-edit]').forEach(bindQc); }
    enhanceCards();
  }
  window.__seRescan = scan;
  loadCats().finally(scan);
  var h = D.createElement('div'); h.className = 'se-hint'; h.textContent = PID ? 'Edit mode — hover any field on this listing to edit it' : 'Edit mode — hover text or products to edit';
  B.appendChild(h); setTimeout(function () { h.style.transition = 'opacity .4s'; h.style.opacity = '0'; setTimeout(function () { h.remove(); }, 500); }, 3600);
})();
