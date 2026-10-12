/* Вики MineLain: бесшовная навигация, поиск, мобильное меню, оглавление, лайтбокс, копирование команд.

   Переходы между страницами вики не перезагружают страницу: шапка, снег и левое меню остаются
   на месте, подменяется только статья (и оглавление справа). Если что-то пошло не так
   (нет сети, файл открыт с диска и т.п.) — молча срабатывает обычный переход по ссылке. */
(function () {
  'use strict';
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var esc = function (s) { return s.replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); };
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  var side = $('#wiki-side');
  var root = new URL(window.WIKI_ROOT || './', location.href).href;   // абсолютный адрес папки wiki/

  /* ---------- адреса: делаем абсолютными, чтобы они не ломались при смене «глубины» страницы ---------- */
  function absolutize(scope, base) {
    $$('a[href], img[src]', scope).forEach(function (el) {
      var attr = el.hasAttribute('href') ? 'href' : 'src', v = el.getAttribute(attr);
      if (!v || v.charAt(0) === '#' || /^(?:[a-z][a-z0-9+.-]*:|\/\/)/i.test(v)) return;
      el.setAttribute(attr, new URL(v, base).href);
    });
  }
  absolutize($('header'), location.href);
  absolutize(side, location.href);

  /* ---------- мобильное меню ---------- */
  function setMenu(open) {
    if (!side) return;
    side.classList.toggle('open', open);
    document.body.classList.toggle('wiki-menu-open', open);
    var b = $('#wiki-burger'); if (b) b.setAttribute('aria-expanded', open ? 'true' : 'false');
  }
  document.addEventListener('click', function (e) {
    var b = e.target.closest && e.target.closest('#wiki-burger');
    if (b) { setMenu(!side.classList.contains('open')); return; }
    if (side && side.classList.contains('open') && !side.contains(e.target)) setMenu(false);
  });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') { setMenu(false); closeLb(); } });

  /* ---------- плавающие плашки: в меню и у оглавления ---------- */
  var pill = null, tocPill = null;
  function setPill(el, target, ready) {
    if (!el || !target) { if (el) el.style.opacity = 0; return; }
    el.style.opacity = '';
    el.style.setProperty('--y', target.offsetTop + 'px');
    el.style.setProperty('--h', target.offsetHeight + 'px');
    if (ready && !el.classList.contains('ready')) requestAnimationFrame(function () { el.classList.add('ready'); });
  }
  function placePill(act) {
    var nav = $('.wiki-nav');
    if (!nav) return;
    if (!pill) { pill = document.createElement('span'); pill.className = 'wiki-pill'; nav.insertBefore(pill, nav.firstChild); nav.classList.add('has-pill'); }
    setPill(pill, act, true);
  }
  function placeTocPill() {
    var toc = $('.wiki-toc');
    if (!toc || !toc.children.length) { tocPill = null; return; }
    tocPill = $('.wiki-toc-pill', toc);
    if (!tocPill) { tocPill = document.createElement('span'); tocPill.className = 'wiki-toc-pill'; toc.insertBefore(tocPill, toc.firstChild); }
    setPill(tocPill, $('.wiki-toc a.on', toc), true);
  }
  // шрифты/размеры могли сдвинуть пункты после первой отрисовки
  window.addEventListener('load', function () { var a = $('.wiki-nav a.active'); if (a) { setPill(pill, a, false); placeTocPill(); } });
  window.addEventListener('resize', function () { var a = $('.wiki-nav a.active'); if (a) setPill(pill, a, false); placeTocPill(); }, { passive: true });

  /* ---------- активный пункт в левом меню ---------- */
  function markActive() {
    var here = location.pathname.replace(/index\.html$/, '');
    var act = null;
    $$('.wiki-nav a').forEach(function (a) {
      var p = new URL(a.href, location.href).pathname.replace(/index\.html$/, '');
      var on = p === here;
      a.classList.toggle('active', on);
      if (on) { a.setAttribute('aria-current', 'page'); act = a; } else a.removeAttribute('aria-current');
    });
    placePill(act);
    if (act && side && side.scrollHeight > side.clientHeight) {
      var top = act.offsetTop, h = act.offsetHeight;
      if (top < side.scrollTop + 40 || top + h > side.scrollTop + side.clientHeight - 40) {
        side.scrollTo({ top: Math.max(0, top - 140), behavior: reduce ? 'auto' : 'smooth' });
      }
    }
  }

  /* ---------- поиск (индекс подгружается при первом обращении к поиску) ---------- */
  var input = $('#wiki-search'), box = $('#wiki-results'), sel = -1;
  var index = window.WIKI_INDEX || null, indexLoading = null;
  function loadIndex() {
    if (index) return Promise.resolve(index);
    if (indexLoading) return indexLoading;
    indexLoading = new Promise(function (ok) {
      var s = document.createElement('script');
      s.src = root + 'search-index.js';
      s.onload = function () { index = window.WIKI_INDEX || []; ok(index); };
      s.onerror = function () { index = []; ok(index); };
      document.head.appendChild(s);
    });
    return indexLoading;
  }
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
  function runSearch() {
    var q = input.value;
    if (!q.trim()) { box.hidden = true; return; }
    loadIndex().then(function () { if (input.value === q) show(search(q), q); });
  }
  if (input && box) {
    input.addEventListener('input', runSearch);
    input.addEventListener('focus', function () { loadIndex(); if (input.value.trim()) runSearch(); });
    input.addEventListener('keydown', function (e) {
      var items = $$('a', box);
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        if (!items.length) return;
        sel = (sel + (e.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length;
        items.forEach(function (a, i) { a.classList.toggle('sel', i === sel); });
      } else if (e.key === 'Enter' && items.length) {
        go((items[sel] || items[0]).href);
      }
    });
    document.addEventListener('click', function (e) { if (!input.parentNode.contains(e.target)) box.hidden = true; });
    document.addEventListener('keydown', function (e) {
      if (e.key === '/' && document.activeElement.tagName !== 'INPUT') { e.preventDefault(); input.focus(); }
    });
  }

  /* ---------- toast ---------- */
  var toastEl, toastT;
  function toast(msg) {
    if (!toastEl) { toastEl = document.createElement('div'); toastEl.className = 'toast'; document.body.appendChild(toastEl); }
    toastEl.textContent = msg;
    requestAnimationFrame(function () { toastEl.classList.add('show'); });
    clearTimeout(toastT); toastT = setTimeout(function () { toastEl.classList.remove('show'); }, 1800);
  }

  /* ---------- лайтбокс ---------- */
  var lb = document.createElement('div'); lb.className = 'wiki-lightbox';
  lb.innerHTML = '<img alt="">'; document.body.appendChild(lb);
  function closeLb() { lb.classList.remove('open'); }
  lb.addEventListener('click', closeLb);

  /* ---------- то, что нужно заново настраивать после каждой смены статьи ---------- */
  var io = null;
  function initPage() {
    markActive();

    // оглавление справа: подсветка текущего раздела
    if (io) { io.disconnect(); io = null; }
    var links = $$('.wiki-toc a');
    if (links.length && 'IntersectionObserver' in window) {
      var map = {};
      links.forEach(function (a) { map[a.getAttribute('href').slice(1)] = a; });
      io = new IntersectionObserver(function (entries) {
        entries.forEach(function (en) {
          if (en.isIntersecting) {
            links.forEach(function (a) { a.classList.remove('on'); });
            var a = map[en.target.id]; if (a) { a.classList.add('on'); setPill(tocPill, a, true); }
          }
        });
      }, { rootMargin: '-90px 0px -70% 0px' });
      $$('.wiki-body h2[id], .wiki-body h3[id]').forEach(function (h) { io.observe(h); });
    }

    placeTocPill();
    reveal();
    $$('.wiki-card, .wiki-ref, .wiki-pager a').forEach(function (el) { el.classList.add('spot'); });

    // клик по команде копирует её
    $$('.wiki-body code').forEach(function (c) {
      if (c.parentNode.tagName !== 'PRE' && /^\/[a-zа-я]/i.test(c.textContent.trim())) {
        c.classList.add('cmd'); c.title = 'Нажмите, чтобы скопировать';
        c.addEventListener('click', function () {
          var t = c.textContent.trim();
          (navigator.clipboard ? navigator.clipboard.writeText(t) : Promise.reject()).then(function () { toast('Скопировано: ' + t); }, function () {});
        });
      }
    });

    // скриншоты открываются крупно
    $$('.wiki-fig img, .wiki-body p > img').forEach(function (img) {
      img.addEventListener('click', function () { $('img', lb).src = img.src; lb.classList.add('open'); });
    });
  }

  /* ---------- блоки статьи плавно появляются при прокрутке ---------- */
  var rvIO = null, rvPending = [];
  function showRv(el) {
    if (!el.classList.contains('rv') || el.classList.contains('in')) return;
    el.classList.add('in');
    if (rvIO) rvIO.unobserve(el);
    setTimeout(function () { el.classList.remove('rv', 'in'); el.style.removeProperty('--d'); }, 900);   // возвращаем обычные hover-эффекты
  }
  // если прокрутка «перепрыгнула» блок (якорь, «Наверх»), IntersectionObserver его не заметит — досвечиваем сами
  function sweepRv() {
    if (!rvPending.length) return;
    var vh = window.innerHeight;
    rvPending = rvPending.filter(function (el) {
      if (!el.isConnected || el.classList.contains('in')) return false;
      if (el.getBoundingClientRect().top < vh * 0.92) { showRv(el); return false; }
      return true;
    });
  }
  function reveal() {
    if (rvIO) { rvIO.disconnect(); rvIO = null; }
    rvPending = [];
    if (reduce || !('IntersectionObserver' in window)) return;
    var items = [];
    $$('.wiki-body > *').forEach(function (el) {
      if (el.classList.contains('wiki-cards')) $$('.wiki-card', el).forEach(function (c) { items.push(c); });
      else items.push(el);
    });
    var vh = window.innerHeight;
    var below = items.filter(function (el) { return el.getBoundingClientRect().top > vh - 30; });
    if (!below.length) return;
    below.forEach(function (el) { el.classList.add('rv'); });
    rvPending = below.slice();
    rvIO = new IntersectionObserver(function (entries) {
      var k = 0;
      entries.forEach(function (en) {
        var el = en.target;
        if (en.isIntersecting || en.boundingClientRect.top < 0) {          // «проскочили» якорем — тоже показываем
          el.style.setProperty('--d', (Math.min(k++, 4) * 0.06) + 's');
          showRv(el);
        }
      });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.05 });
    below.forEach(function (el) { rvIO.observe(el); });
  }

  /* ---------- подсветка карточек под курсором ---------- */
  if (window.matchMedia('(hover: hover)').matches) {
    var spotEl = null, spotX = 0, spotY = 0, spotRaf = 0;
    document.addEventListener('mousemove', function (e) {
      var el = e.target.closest && e.target.closest('.spot');
      if (!el) return;
      spotEl = el; spotX = e.clientX; spotY = e.clientY;
      if (spotRaf) return;
      spotRaf = requestAnimationFrame(function () {
        spotRaf = 0;
        var r = spotEl.getBoundingClientRect();
        spotEl.style.setProperty('--mx', (spotX - r.left) + 'px');
        spotEl.style.setProperty('--my', (spotY - r.top) + 'px');
      });
    }, { passive: true });
  }

  /* ---------- «Наверх» с кольцом прогресса чтения ---------- */
  var topBtn = document.createElement('button');
  topBtn.className = 'wiki-top'; topBtn.type = 'button'; topBtn.setAttribute('aria-label', 'Наверх');
  topBtn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M12 19V5M5 12l7-7 7 7"/></svg>';
  document.body.appendChild(topBtn);
  topBtn.addEventListener('click', function () { window.scrollTo({ top: 0, behavior: reduce ? 'auto' : 'smooth' }); });
  var topRaf = 0;
  function onScroll() {
    if (topRaf) return;
    topRaf = requestAnimationFrame(function () {
      topRaf = 0;
      var max = document.documentElement.scrollHeight - window.innerHeight;
      var y = window.scrollY;
      topBtn.classList.toggle('show', y > 700);
      topBtn.style.setProperty('--p', max > 0 ? Math.min(100, Math.round(y / max * 100)) : 0);
      sweepRv();
    });
  }
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  /* =====================================================================
     Бесшовная навигация
  ===================================================================== */
  var canSpa = 'fetch' in window && 'DOMParser' in window && 'pushState' in history && location.protocol !== 'file:';
  var cache = {};           // адрес -> Promise<текст страницы>
  var busy = 0;             // защита от гонок: учитываем только последний переход
  if ('scrollRestoration' in history) history.scrollRestoration = 'manual';

  function clean(u) { var x = new URL(u, location.href); x.hash = ''; return x.href; }
  function isWikiPage(u) {
    return u.origin === location.origin && u.href.indexOf(root) === 0 && /(\.html|\/)$/.test(u.pathname);
  }
  function load(url) {
    var k = clean(url);
    if (!cache[k]) {
      cache[k] = fetch(k, { credentials: 'same-origin' }).then(function (r) {
        if (!r.ok) throw new Error(r.status);
        return r.text();
      });
      cache[k].catch(function () { delete cache[k]; });
    }
    return cache[k];
  }
  function prefetch(url) { if (canSpa) load(url).catch(function () {}); }

  var loader = document.createElement('div'); loader.className = 'wiki-loader'; document.body.appendChild(loader);

  function go(url, push, state) {
    var u = new URL(url, location.href);
    if (!canSpa || !isWikiPage(u)) { location.href = u.href; return; }
    var token = ++busy, t0 = Date.now();
    var art = $('.wiki-article');
    if (push !== false) history.replaceState({ y: window.scrollY }, '');   // запоминаем, где стояли
    // направление: вперёд по оглавлению — статья уезжает влево и приезжает справа, назад — наоборот
    var navLinks = $$('.wiki-nav a'), from = -1, to = -1, tp = u.pathname.replace(/index\.html$/, '');
    navLinks.forEach(function (a, i) {
      if (a.classList.contains('active')) from = i;
      if (new URL(a.href, location.href).pathname.replace(/index\.html$/, '') === tp) to = i;
    });
    var dir = from > -1 && to > -1 ? (to > from ? 1 : -1) : 0;
    if (art && !reduce) { art.style.setProperty('--lx', (-dir * 16) + 'px'); art.classList.add('is-leaving'); }
    var slow = setTimeout(function () { loader.classList.add('on'); }, 220);

    Promise.all([load(u.href), new Promise(function (ok) { setTimeout(ok, reduce ? 0 : 130); })]).then(function (res) {
      if (token !== busy) return;
      clearTimeout(slow); loader.classList.remove('on');
      var doc = new DOMParser().parseFromString(res[0], 'text/html');
      var nArt = $('.wiki-article', doc), nToc = $('.wiki-toc', doc);
      if (!nArt) throw new Error('no article');
      var base = clean(u.href);
      absolutize(nArt, base);
      if (nToc) absolutize(nToc, base);

      var oldToc = $('.wiki-toc');
      if (art) art.replaceWith(nArt);
      if (oldToc && nToc) oldToc.replaceWith(nToc);
      document.title = doc.title;
      var md = $('meta[name="description"]', doc), cur = $('meta[name="description"]');
      if (md && cur) cur.setAttribute('content', md.getAttribute('content'));
      if (push !== false) history.pushState({ y: 0 }, '', u.href);
      curPath = location.pathname;

      var hdr = $('header'); if (hdr) hdr.classList.remove('header-hidden');
      setMenu(false);
      if (input) { input.value = ''; box.hidden = true; }
      initPage();

      var target = u.hash && document.getElementById(decodeURIComponent(u.hash.slice(1)));
      var y = state && typeof state.y === 'number' ? state.y : 0;
      window.scrollTo({ top: target ? target.getBoundingClientRect().top + window.scrollY - 90 : y, behavior: 'instant' });

      if (!reduce) {
        nArt.style.setProperty('--dx', (dir * 28) + 'px');
        nArt.classList.add('is-entering');
        nArt.addEventListener('animationend', function f(e) {
          if (e.target !== nArt) return;
          nArt.classList.remove('is-entering'); nArt.removeEventListener('animationend', f);
        });
      }
      // заранее прогреваем соседние страницы — следующий переход будет мгновенным
      var idle = window.requestIdleCallback || function (f) { return setTimeout(f, 300); };
      idle(function () { $$('.wiki-pager a').forEach(function (a) { prefetch(a.href); }); });
    }).catch(function () {
      clearTimeout(slow); loader.classList.remove('on');
      location.href = u.href;      // обычный переход, если что-то не получилось
    });
  }

  // перехватываем клики по ссылкам вики (в фазе перехвата — раньше запасного обработчика переходов сайта)
  document.addEventListener('click', function (e) {
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    var a = e.target.closest && e.target.closest('a[href]');
    if (!a || (a.target && a.target !== '_self') || a.hasAttribute('download')) return;
    var u; try { u = new URL(a.href, location.href); } catch (_) { return; }
    if (!isWikiPage(u)) return;
    if (u.pathname === location.pathname && u.search === location.search) {          // эта же страница
      if (u.hash) return;                                                            // якорь — обычное поведение
      e.preventDefault(); setMenu(false); window.scrollTo({ top: 0, behavior: reduce ? 'auto' : 'smooth' });
      return;
    }
    e.preventDefault();
    go(u.href, true);
  }, true);

  // предзагрузка при наведении / касании
  function hint(e) {
    var a = e.target.closest && e.target.closest('a[href]');
    if (!a) return;
    var u; try { u = new URL(a.href, location.href); } catch (_) { return; }
    if (isWikiPage(u) && u.pathname !== location.pathname) prefetch(u.href);
  }
  document.addEventListener('mouseover', hint, { passive: true });
  document.addEventListener('touchstart', hint, { passive: true });
  document.addEventListener('focusin', hint);

  var curPath = location.pathname;
  window.addEventListener('popstate', function (e) {
    if (location.pathname === curPath) return;        // изменился только #якорь — браузер справится сам
    go(location.href, false, e.state);
  });

  initPage();
  if (canSpa) {
    history.replaceState({ y: window.scrollY }, '');
    var idle0 = window.requestIdleCallback || function (f) { return setTimeout(f, 600); };
    idle0(function () { $$('.wiki-pager a').forEach(function (a) { prefetch(a.href); }); });
  }
})();
