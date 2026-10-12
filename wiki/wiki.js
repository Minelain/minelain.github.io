/* Вики MineLain: поиск, мобильное меню, оглавление, лайтбокс, копирование команд. */
(function () {
  'use strict';
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var esc = function (s) { return s.replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); };

  /* ---------- мобильное меню ---------- */
  var side = $('#wiki-side'), burger = $('#wiki-burger');
  function setMenu(open) {
    if (!side) return;
    side.classList.toggle('open', open);
    document.body.classList.toggle('wiki-menu-open', open);
    if (burger) burger.setAttribute('aria-expanded', open ? 'true' : 'false');
  }
  if (burger) burger.addEventListener('click', function () { setMenu(!side.classList.contains('open')); });
  document.addEventListener('click', function (e) {
    if (side && side.classList.contains('open') && !side.contains(e.target) && !burger.contains(e.target)) setMenu(false);
  });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') { setMenu(false); closeLb(); } });

  /* ---------- активный пункт в левом меню виден без прокрутки ---------- */
  var act = $('.wiki-nav a.active');
  if (act && side) side.scrollTop = Math.max(0, act.offsetTop - 140);

  /* ---------- поиск ---------- */
  var input = $('#wiki-search'), box = $('#wiki-results'), sel = -1;
  var index = window.WIKI_INDEX || [], root = window.WIKI_ROOT || '';
  function stem(w) { return w.length > 5 ? w.slice(0, -2) : (w.length > 3 ? w.slice(0, -1) : w); }
  function search(q) {
    var words = q.toLowerCase().split(/[^a-zа-яё0-9/_-]+/i).filter(Boolean).map(stem);
    if (!words.length) return [];
    var res = [];
    index.forEach(function (p) {
      var title = p.t.toLowerCase(), heads = p.h.join(' | ').toLowerCase(), text = p.x.toLowerCase(), score = 0, ok = true, pos = -1;
      words.forEach(function (w) {
        var s = 0;
        if (title.indexOf(w) > -1) s += 10;
        if (heads.indexOf(w) > -1) s += 5;
        var i = text.indexOf(w);
        if (i > -1) { s += 1; if (pos < 0) pos = i; }
        if (!s) ok = false;
        score += s;
      });
      if (ok) res.push({ p: p, score: score, pos: pos });
    });
    return res.sort(function (a, b) { return b.score - a.score; }).slice(0, 8).map(function (r) {
      var snip = '';
      if (r.pos > -1) {
        var from = Math.max(0, r.pos - 40);
        snip = (from ? '…' : '') + r.p.x.slice(from, r.pos + 110) + '…';
      }
      return { p: r.p, snip: snip, words: words };
    });
  }
  function mark(text, words) {
    var out = esc(text);
    words.forEach(function (w) {
      if (!w) return;
      out = out.replace(new RegExp('(' + w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '[а-яёa-z0-9]*)', 'ig'), '<mark>$1</mark>');
    });
    return out;
  }
  function show(list, q) {
    if (!q.trim()) { box.hidden = true; return; }
    box.innerHTML = list.length ? list.map(function (r) {
      return '<a href="' + root + r.p.u + '"><b>' + mark(r.p.t, r.words) + '</b>' +
        (r.snip ? '<small>' + mark(r.snip, r.words) + '</small>' : '') + '</a>';
    }).join('') : '<div class="none">Ничего не найдено</div>';
    box.hidden = false; sel = -1;
  }
  if (input && box) {
    input.addEventListener('input', function () { show(search(input.value), input.value); });
    input.addEventListener('focus', function () { if (input.value.trim()) show(search(input.value), input.value); });
    input.addEventListener('keydown', function (e) {
      var items = $$('a', box);
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        if (!items.length) return;
        sel = (sel + (e.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length;
        items.forEach(function (a, i) { a.classList.toggle('sel', i === sel); });
      } else if (e.key === 'Enter' && items.length) {
        location.href = (items[sel] || items[0]).href;
      }
    });
    document.addEventListener('click', function (e) { if (!input.parentNode.contains(e.target)) box.hidden = true; });
    document.addEventListener('keydown', function (e) {
      if (e.key === '/' && document.activeElement.tagName !== 'INPUT') { e.preventDefault(); input.focus(); }
    });
  }

  /* ---------- оглавление справа: подсветка текущего раздела ---------- */
  var links = $$('.wiki-toc a');
  if (links.length && 'IntersectionObserver' in window) {
    var map = {};
    links.forEach(function (a) { map[a.getAttribute('href').slice(1)] = a; });
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (en.isIntersecting) {
          links.forEach(function (a) { a.classList.remove('on'); });
          var a = map[en.target.id]; if (a) a.classList.add('on');
        }
      });
    }, { rootMargin: '-90px 0px -70% 0px' });
    $$('.wiki-body h2[id], .wiki-body h3[id]').forEach(function (h) { io.observe(h); });
  }

  /* ---------- клик по команде копирует её ---------- */
  var toastEl, toastT;
  function toast(msg) {
    if (!toastEl) { toastEl = document.createElement('div'); toastEl.className = 'toast'; document.body.appendChild(toastEl); }
    toastEl.textContent = msg;
    requestAnimationFrame(function () { toastEl.classList.add('show'); });
    clearTimeout(toastT); toastT = setTimeout(function () { toastEl.classList.remove('show'); }, 1800);
  }
  $$('.wiki-body code').forEach(function (c) {
    if (c.parentNode.tagName !== 'PRE' && /^\/[a-zа-я]/i.test(c.textContent.trim())) {
      c.classList.add('cmd'); c.title = 'Нажмите, чтобы скопировать';
      c.addEventListener('click', function () {
        var t = c.textContent.trim();
        (navigator.clipboard ? navigator.clipboard.writeText(t) : Promise.reject()).then(function () { toast('Скопировано: ' + t); }, function () {});
      });
    }
  });

  /* ---------- лайтбокс для скриншотов ---------- */
  var lb = document.createElement('div'); lb.className = 'wiki-lightbox';
  lb.innerHTML = '<img alt="">'; document.body.appendChild(lb);
  function closeLb() { lb.classList.remove('open'); }
  lb.addEventListener('click', closeLb);
  $$('.wiki-fig img, .wiki-body p > img').forEach(function (img) {
    img.addEventListener('click', function () { $('img', lb).src = img.src; lb.classList.add('open'); });
  });
})();
