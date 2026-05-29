/* ============================================================
   Immersive in-place site editor.
   Injected by the master-admin Studio INTO the live site iframe
   (same origin), so it edits the real page and saves via the
   master-admin proxy routes (session-authed, token added server-side).
   ============================================================ */
(function () {
  if (window.__STUDIO_EDITOR_LOADED) { try { window.__seRescan && window.__seRescan(); } catch (e) {} return; }
  window.__STUDIO_EDITOR_LOADED = true;

  var CFG = window.__STUDIO__ || {};
  var SITE = CFG.siteId || '';
  var CATS = [];           // cached category list
  var dragEl = null;

  function jfetch(path, method, body) {
    return fetch(path, {
      method: method || 'GET',
      headers: { 'Content-Type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined,
      credentials: 'same-origin'
    }).then(function (r) { return r.json().catch(function () { return {}; }); });
  }
  function status(msg, kind) { try { (window.parent.StudioStatus || function () {})(msg, kind); } catch (e) {} }

  /* ---------- styles ---------- */
  var css = document.createElement('style');
  css.textContent = [
    '.se-ed{outline:1.5px dashed rgba(99,102,241,.55);outline-offset:3px;position:relative;transition:outline-color .12s;}',
    '.se-ed:hover{outline-color:#6366f1;outline-style:solid;}',
    '.se-pen{position:absolute;top:-12px;right:-12px;width:26px;height:26px;border-radius:50%;background:#6366f1;color:#fff;border:2px solid #fff;display:none;align-items:center;justify-content:center;font-size:13px;cursor:pointer;z-index:2147483000;box-shadow:0 2px 8px rgba(0,0,0,.35);}',
    '.se-ed:hover>.se-pen{display:flex;}',
    '.product-card.se-card{position:relative;}',
    '.se-ptools{position:absolute;top:8px;right:8px;display:none;gap:5px;z-index:2147483000;}',
    '.product-card.se-card:hover .se-ptools{display:flex;}',
    '.se-pbtn{width:30px;height:30px;border-radius:8px;border:none;background:rgba(17,17,17,.82);color:#fff;font-size:14px;cursor:pointer;display:flex;align-items:center;justify-content:center;backdrop-filter:blur(6px);box-shadow:0 2px 8px rgba(0,0,0,.35);}',
    '.se-pbtn:hover{background:#6366f1;}',
    '.se-pbtn.on{background:#f59e0b;}',
    '.se-pbtn.grab{cursor:grab;}',
    '.product-card.se-dragging{opacity:.4;}',
    '.product-card.se-over{outline:2px solid #6366f1;outline-offset:-2px;}',
    /* popover + modal */
    '.se-pop,.se-modal-bg{position:fixed;z-index:2147483600;font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;}',
    '.se-pop{background:#16161c;color:#fff;border:1px solid #2a2a35;border-radius:14px;padding:16px;width:330px;max-width:92vw;box-shadow:0 20px 60px rgba(0,0,0,.6);}',
    '.se-pop h4{margin:0 0 10px;font-size:13px;letter-spacing:.5px;text-transform:uppercase;color:#9ca3af;}',
    '.se-pop label{display:block;font-size:11px;color:#9ca3af;margin:9px 0 4px;}',
    '.se-pop input,.se-pop textarea,.se-pop select{width:100%;box-sizing:border-box;background:#0f0f14;border:1px solid #2a2a35;border-radius:8px;color:#fff;padding:9px 10px;font-size:13px;font-family:inherit;}',
    '.se-pop textarea{min-height:60px;resize:vertical;}',
    '.se-row{display:flex;gap:8px;margin-top:14px;}',
    '.se-b{flex:1;border:none;border-radius:8px;padding:10px;font-weight:700;font-size:12px;cursor:pointer;}',
    '.se-b.save{background:#6366f1;color:#fff;}.se-b.save:hover{background:#4f46e5;}',
    '.se-b.ghost{background:#23232c;color:#cbd5e1;}',
    '.se-modal-bg{inset:0;background:rgba(0,0,0,.6);backdrop-filter:blur(4px);display:flex;align-items:center;justify-content:center;padding:20px;}',
    '.se-modal{background:#16161c;color:#fff;border:1px solid #2a2a35;border-radius:16px;width:520px;max-width:96vw;max-height:88vh;overflow:auto;padding:22px;box-shadow:0 24px 70px rgba(0,0,0,.6);}',
    '.se-modal h3{margin:0 0 4px;font-size:18px;}',
    '.se-modal .sub{color:#9ca3af;font-size:12px;margin-bottom:16px;}',
    '.se-cat{display:flex;align-items:center;gap:10px;background:#0f0f14;border:1px solid #2a2a35;border-radius:10px;padding:9px 11px;margin-bottom:8px;}',
    '.se-cat .h{cursor:grab;color:#6b7280;font-size:16px;}',
    '.se-cat input{flex:1;background:transparent;border:none;color:#fff;font-size:14px;outline:none;}',
    '.se-cat .del{background:none;border:none;color:#ef4444;cursor:pointer;font-size:16px;}',
    '.se-cat.se-over{outline:2px solid #6366f1;}',
    '.se-hint{position:fixed;left:50%;transform:translateX(-50%);bottom:18px;background:#6366f1;color:#fff;padding:8px 16px;border-radius:999px;font:600 12px system-ui;z-index:2147483600;box-shadow:0 6px 20px rgba(0,0,0,.4);}'
  ].join('');
  document.head.appendChild(css);

  /* ---------- floating popover helper ---------- */
  function closePop() { var p = document.getElementById('se-pop'); if (p) p.remove(); }
  function openPop(anchor, html, onSave) {
    closePop();
    var p = document.createElement('div'); p.className = 'se-pop'; p.id = 'se-pop'; p.innerHTML = html;
    document.body.appendChild(p);
    var r = anchor.getBoundingClientRect();
    var top = Math.min(Math.max(10, r.top), window.innerHeight - p.offsetHeight - 10);
    var left = Math.min(Math.max(10, r.left), window.innerWidth - p.offsetWidth - 10);
    p.style.top = top + 'px'; p.style.left = left + 'px';
    p.querySelector('.se-b.ghost').onclick = closePop;
    p.querySelector('.se-b.save').onclick = function () { onSave(p); };
    var first = p.querySelector('input,textarea'); if (first) first.focus();
    return p;
  }

  /* ---------- TEXT editing ---------- */
  function enhanceText() {
    document.querySelectorAll('[data-edit],[data-edit-brand]').forEach(function (el) {
      if (el.__seDone) return; el.__seDone = true;
      el.classList.add('se-ed');
      if (getComputedStyle(el).position === 'static') el.style.position = 'relative';
      var pen = document.createElement('span'); pen.className = 'se-pen'; pen.textContent = '✎';
      el.appendChild(pen);
      pen.onclick = function (e) {
        e.preventDefault(); e.stopPropagation();
        if (el.hasAttribute('data-edit-brand')) return editBrand(el, pen);
        editText(el, pen);
      };
    });
  }
  function editText(el, anchor) {
    var key = el.getAttribute('data-edit');
    var isHtml = el.hasAttribute('data-edit-html');
    var clone = el.cloneNode(true); var pc = clone.querySelector('.se-pen'); if (pc) pc.remove();
    var cur = isHtml ? clone.innerHTML.trim() : clone.textContent.trim();
    openPop(anchor,
      '<h4>Edit text</h4>' +
      (isHtml ? '<label>Text (you can use &lt;br&gt; and &lt;span class="accent"&gt;word&lt;/span&gt;)</label>' : '<label>Text</label>') +
      '<textarea id="se-t">' + cur.replace(/</g, '&lt;') + '</textarea>' +
      '<div class="se-row"><button class="se-b ghost">Cancel</button><button class="se-b save">Save</button></div>',
      function (p) {
        var val = p.querySelector('#se-t').value;
        status('Saving…');
        var body = {}; body[key] = val;
        jfetch('/content/' + SITE, 'POST', body).then(function (j) {
          if (j && j.ok) {
            if (isHtml) { el.innerHTML = val + '<span class="se-pen">✎</span>'; rebindPen(el); }
            else { setText(el, val); }
            status('Saved ✓', 'success');
          } else { status((j && j.error) || 'Save failed', 'error'); }
          closePop();
        });
      });
  }
  function editBrand(el, anchor) {
    var span = el.querySelector('.accent');
    var p1 = (el.childNodes[0] && el.childNodes[0].textContent || '').trim();
    var p2 = (span && span.textContent || '').trim();
    openPop(anchor,
      '<h4>Edit brand</h4><label>First part</label><input id="se-b1" value="' + p1.replace(/"/g, '&quot;') + '">' +
      '<label>Accent part</label><input id="se-b2" value="' + p2.replace(/"/g, '&quot;') + '">' +
      '<div class="se-row"><button class="se-b ghost">Cancel</button><button class="se-b save">Save</button></div>',
      function (p) {
        var b1 = p.querySelector('#se-b1').value, b2 = p.querySelector('#se-b2').value;
        status('Saving…');
        jfetch('/content/' + SITE, 'POST', { brand_part1: b1, brand_part2: b2 }).then(function (j) {
          if (j && j.ok) {
            el.childNodes[0].textContent = b1; if (span) span.textContent = b2;
            status('Saved ✓', 'success');
          } else { status((j && j.error) || 'Save failed', 'error'); }
          closePop();
        });
      });
  }
  function setText(el, val) {
    // replace text but keep the pencil
    var pen = el.querySelector('.se-pen');
    el.textContent = val; if (pen) el.appendChild(pen);
  }
  function rebindPen(el) {
    var pen = el.querySelector('.se-pen');
    if (pen) pen.onclick = function (e) { e.preventDefault(); e.stopPropagation(); editText(el, pen); };
  }

  /* ---------- PRODUCT editing ---------- */
  function pid(card) { var m = (card.getAttribute('data-pid') || (card.getAttribute('href') || '').match(/\/product\/([^/?#]+)/) || [])[1]; return m || card.getAttribute('data-pid'); }
  function enhanceProducts() {
    var grid = document.querySelector('.product-grid'); if (!grid) return;
    grid.querySelectorAll('.product-card').forEach(function (card) {
      if (card.__seDone) return; card.__seDone = true;
      card.classList.add('se-card');
      var id = pid(card); if (!id) return;
      var tools = document.createElement('div'); tools.className = 'se-ptools';
      var hot = card.classList.contains('is-hot');
      tools.innerHTML =
        '<button class="se-pbtn grab" title="Drag to reorder">⠿</button>' +
        '<button class="se-pbtn b-hot' + (hot ? ' on' : '') + '" title="Mark hot">🔥</button>' +
        '<button class="se-pbtn b-edit" title="Edit product">✎</button>';
      card.appendChild(tools);
      tools.querySelectorAll('.se-pbtn').forEach(function (b) {
        b.addEventListener('click', function (e) { e.preventDefault(); e.stopPropagation(); });
      });
      tools.querySelector('.b-edit').onclick = function (e) { e.preventDefault(); e.stopPropagation(); editProduct(card, id, this); };
      tools.querySelector('.b-hot').onclick = function (e) { e.preventDefault(); e.stopPropagation(); toggleHot(card, id, this); };
      setupDrag(card, tools.querySelector('.grab'), grid);
    });
  }
  function editProduct(card, id, anchor) {
    var nameEl = card.querySelector('.product-card-name');
    var priceEl = card.querySelector('.product-card-price');
    var imgEl = card.querySelector('.product-card-img');
    var name = nameEl ? nameEl.textContent.trim() : '';
    var price = priceEl ? priceEl.textContent.replace(/[^0-9.,]/g, '') : '';
    var img = imgEl ? imgEl.getAttribute('src') : '';
    var stock = !card.classList.contains('out-of-stock');
    var catOpts = '<option value="">—</option>' + CATS.map(function (c) { return '<option value="' + c.slug + '">' + c.name + '</option>'; }).join('');
    openPop(anchor,
      '<h4>Edit product</h4>' +
      '<label>Name</label><input id="se-n" value="' + name.replace(/"/g, '&quot;') + '">' +
      '<label>Price ($)</label><input id="se-p" value="' + price + '">' +
      '<label>Category</label><select id="se-c">' + catOpts + '</select>' +
      '<label>Image URL</label><input id="se-i" value="' + (img || '').replace(/"/g, '&quot;') + '">' +
      '<label style="display:flex;align-items:center;gap:7px;margin-top:10px;"><input type="checkbox" id="se-s" ' + (stock ? 'checked' : '') + ' style="width:auto;"> In stock</label>' +
      '<div class="se-row"><button class="se-b ghost">Cancel</button><button class="se-b save">Save</button></div>',
      function (p) {
        var body = {
          name: p.querySelector('#se-n').value,
          price: p.querySelector('#se-p').value,
          category: p.querySelector('#se-c').value,
          image: p.querySelector('#se-i').value,
          in_stock: p.querySelector('#se-s').checked ? 1 : 0
        };
        status('Saving…');
        jfetch('/products/' + SITE + '/' + encodeURIComponent(id), 'PUT', body).then(function (j) {
          if (j && j.ok) {
            if (nameEl) nameEl.textContent = body.name;
            if (priceEl) priceEl.firstChild ? priceEl.childNodes[0].nodeValue = '$' + body.price : priceEl.textContent = '$' + body.price;
            if (imgEl && body.image) imgEl.src = body.image;
            card.classList.toggle('out-of-stock', !body.in_stock);
            status('Saved ✓', 'success');
          } else { status((j && j.error) || 'Save failed', 'error'); }
          closePop();
        });
      });
  }
  function toggleHot(card, id, btn) {
    var makeHot = !card.classList.contains('is-hot');
    status('Saving…');
    jfetch('/products/' + SITE + '/' + encodeURIComponent(id), 'PUT', { featured: makeHot ? 1 : 0 }).then(function (j) {
      if (j && j.ok) {
        card.classList.toggle('is-hot', makeHot); btn.classList.toggle('on', makeHot);
        var wrap = card.querySelector('.product-card-img-wrap');
        var badge = card.querySelector('.product-card-hot');
        if (makeHot && !badge && wrap) { badge = document.createElement('span'); badge.className = 'product-card-hot'; badge.title = 'Hot'; badge.textContent = '🔥'; wrap.insertBefore(badge, wrap.firstChild); }
        else if (!makeHot && badge) { badge.remove(); }
        status(makeHot ? 'Marked hot 🔥' : 'Unmarked', 'success');
      } else { status((j && j.error) || 'Save failed', 'error'); }
    });
  }
  /* drag reorder within the grid */
  function setupDrag(card, handle, grid) {
    handle.addEventListener('mousedown', function () { card.setAttribute('draggable', 'true'); });
    card.addEventListener('dragstart', function (e) { dragEl = card; card.classList.add('se-dragging'); e.dataTransfer.effectAllowed = 'move'; try { e.dataTransfer.setData('text/plain', ''); } catch (x) {} });
    card.addEventListener('dragend', function () { card.classList.remove('se-dragging'); card.removeAttribute('draggable'); grid.querySelectorAll('.se-over').forEach(function (n) { n.classList.remove('se-over'); }); });
    card.addEventListener('dragover', function (e) { if (!dragEl || dragEl === card) return; e.preventDefault(); card.classList.add('se-over'); });
    card.addEventListener('dragleave', function () { card.classList.remove('se-over'); });
    card.addEventListener('drop', function (e) {
      e.preventDefault(); card.classList.remove('se-over'); if (!dragEl || dragEl === card) return;
      var cards = Array.prototype.slice.call(grid.querySelectorAll('.product-card'));
      if (cards.indexOf(dragEl) < cards.indexOf(card)) card.after(dragEl); else card.before(dragEl);
      persistOrder(grid);
    });
  }
  function persistOrder(grid) {
    var cards = Array.prototype.slice.call(grid.querySelectorAll('.product-card'));
    status('Saving order…');
    var calls = cards.map(function (c, i) { var id = pid(c); return id ? jfetch('/products/' + SITE + '/' + encodeURIComponent(id), 'PUT', { position: i }) : Promise.resolve(); });
    Promise.all(calls).then(function () { status('Order saved ✓', 'success'); });
  }

  /* ---------- CATEGORY manager ---------- */
  function loadCats() { return jfetch('/categories/' + SITE).then(function (j) { CATS = (j && j.categories) || []; return CATS; }); }
  function openCategories() {
    loadCats().then(function () {
      var bg = document.createElement('div'); bg.className = 'se-modal-bg';
      bg.innerHTML = '<div class="se-modal"><h3>Categories</h3><div class="sub">Drag to reorder · click a name to rename · ✕ to delete</div><div id="se-clist"></div>' +
        '<div class="se-row"><button class="se-b ghost" id="se-addc">+ Add category</button></div>' +
        '<div class="se-row"><button class="se-b ghost" id="se-ccancel">Close</button><button class="se-b save" id="se-csave">Save changes</button></div></div>';
      document.body.appendChild(bg);
      bg.onclick = function (e) { if (e.target === bg) bg.remove(); };
      var list = bg.querySelector('#se-clist');
      function row(c) {
        var d = document.createElement('div'); d.className = 'se-cat'; d.setAttribute('draggable', 'true'); d.dataset.slug = c.slug || '';
        d.innerHTML = '<span class="h">⠿</span><input value="' + (c.name || '').replace(/"/g, '&quot;') + '"><button class="del" title="Delete">✕</button>';
        d.querySelector('.del').onclick = function () { d.remove(); };
        d.addEventListener('dragstart', function () { d.classList.add('se-dragging'); dragEl = d; });
        d.addEventListener('dragend', function () { d.classList.remove('se-dragging'); });
        d.addEventListener('dragover', function (e) { e.preventDefault(); });
        d.addEventListener('drop', function (e) { e.preventDefault(); if (!dragEl || dragEl === d) return; var rows = Array.prototype.slice.call(list.children); if (rows.indexOf(dragEl) < rows.indexOf(d)) d.after(dragEl); else d.before(dragEl); });
        return d;
      }
      CATS.forEach(function (c) { list.appendChild(row(c)); });
      bg.querySelector('#se-addc').onclick = function () { list.appendChild(row({ slug: '', name: 'New category' })); };
      bg.querySelector('#se-ccancel').onclick = function () { bg.remove(); };
      bg.querySelector('#se-csave').onclick = function () {
        var rows = Array.prototype.slice.call(list.children);
        status('Saving categories…');
        var ops = [];
        var existing = {}; CATS.forEach(function (c) { existing[c.slug] = c; });
        var seen = {};
        rows.forEach(function (d) {
          var slug = d.dataset.slug, name = d.querySelector('input').value.trim();
          if (!name) return;
          if (slug) { seen[slug] = 1; if (existing[slug] && existing[slug].name !== name) ops.push(jfetch('/categories/' + SITE + '/' + encodeURIComponent(slug), 'PATCH', { name: name })); }
          else { ops.push(jfetch('/categories/' + SITE, 'POST', { name: name })); }
        });
        // deletions
        CATS.forEach(function (c) { if (!seen[c.slug]) ops.push(jfetch('/categories/' + SITE + '/' + encodeURIComponent(c.slug), 'DELETE')); });
        Promise.all(ops).then(function () {
          // reorder by current row order (slugs we know; new ones resolved after reload)
          var order = rows.map(function (d) { return d.dataset.slug; }).filter(Boolean);
          return jfetch('/categories/' + SITE + '/reorder', 'POST', { order: order });
        }).then(function () {
          status('Categories saved ✓ — reloading', 'success');
          bg.remove(); setTimeout(function () { location.reload(); }, 500);
        });
      };
    });
  }
  window.StudioEditor = { openCategories: openCategories };

  /* ---------- boot ---------- */
  function scan() { enhanceText(); enhanceProducts(); }
  window.__seRescan = scan;
  loadCats().finally(scan);
  var h = document.createElement('div'); h.className = 'se-hint'; h.textContent = 'Edit mode — hover any text or product to edit';
  document.body.appendChild(h); setTimeout(function () { h.style.transition = 'opacity .4s'; h.style.opacity = '0'; setTimeout(function () { h.remove(); }, 500); }, 3200);
})();
