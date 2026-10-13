/*
 * Галерея скриншотов в конце статьи (post.html).
 *
 * Бот кладёт в news/p/<id>.json поле "gallery": [{ "src": "images/news/<id>/2.avif", "w": 1920, "h": 1080 }, …]
 * — это все скриншоты, кроме первого (первый — обложка, он в поле "image" и в списке новостей).
 * Скрипт сам читает тот же JSON, находит тело статьи и дорисовывает под ним сетку превью;
 * по клику картинка открывается на весь экран (стрелки ← → и Esc работают).
 *
 * Подключение в post.html (после js/news.js):
 *   <link rel="stylesheet" href="css/news-gallery.css">
 *   <script src="js/news-gallery.js" defer></script>
 * Если тело статьи в вашей вёрстке не находится само, укажите его селектор:
 *   <script src="js/news-gallery.js" data-target="#article-body" defer></script>
 *
 * Безопасность: JSON — недоверенные данные. Адрес картинки принимается только вида
 * images/news/<id>/<n>.avif, всё строится через DOM API (никакого innerHTML).
 */
(function () {
  'use strict';

  var SRC_RE = /^images\/news\/[A-Za-z0-9_-]{1,80}\/\d{1,3}\.avif$/;
  var ID_RE = /^[A-Za-z0-9_-]{1,80}$/;
  // Куда вставлять, если data-target не задан: первое найденное (после него; у main/article — внутрь, в конец).
  var AFTER = ['[data-news-content]', '#post-content', '#postContent', '.post-content', '.post__content', '.news-content', '.article-content', '.post-body'];
  var INSIDE = ['article', 'main'];
  var WAIT_MS = 10000;

  var script = document.currentScript;
  var customTarget = script && script.getAttribute('data-target');

  var id = new URLSearchParams(location.search).get('id');
  if (!id || !ID_RE.test(id)) return;

  function el(tag, cls, attrs) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (attrs) for (var k in attrs) n.setAttribute(k, attrs[k]);
    return n;
  }

  function cleanItems(list) {
    if (!Array.isArray(list)) return [];
    var out = [];
    list.forEach(function (it) {
      if (!it || typeof it.src !== 'string' || !SRC_RE.test(it.src)) return;
      var w = Number(it.w), h = Number(it.h);
      out.push({
        src: it.src,
        w: w > 0 && w < 20000 ? Math.round(w) : 16,
        h: h > 0 && h < 20000 ? Math.round(h) : 9
      });
    });
    return out.slice(0, 20);
  }

  function findMount() {
    var i, node, sels = customTarget ? [customTarget] : AFTER;
    for (i = 0; i < sels.length; i++) {
      try { node = document.querySelector(sels[i]); } catch (e) { node = null; }
      if (node && node.textContent.trim()) return { node: node, inside: false };
    }
    if (customTarget) return null;
    for (i = 0; i < INSIDE.length; i++) {
      node = document.querySelector(INSIDE[i]);
      if (node && node.textContent.trim()) return { node: node, inside: true };
    }
    return null;
  }

  function buildLightbox(items, title) {
    var dlg = el('dialog', 'news-lightbox', { 'aria-label': 'Просмотр скриншота' });
    var img = el('img', 'news-lightbox__img', { alt: '' });
    var cap = el('div', 'news-lightbox__cap');
    var close = el('button', 'news-lightbox__btn news-lightbox__close', { type: 'button', 'aria-label': 'Закрыть' });
    var prev = el('button', 'news-lightbox__btn news-lightbox__prev', { type: 'button', 'aria-label': 'Предыдущий' });
    var next = el('button', 'news-lightbox__btn news-lightbox__next', { type: 'button', 'aria-label': 'Следующий' });
    close.textContent = '×'; prev.textContent = '‹'; next.textContent = '›';
    dlg.append(img, cap, close, prev, next);

    var cur = 0;
    function show(n) {
      cur = (n + items.length) % items.length;
      img.src = items[cur].src;
      img.alt = 'Скриншот ' + (cur + 1) + ' из ' + items.length + ' — ' + title;
      cap.textContent = (cur + 1) + ' / ' + items.length;
      prev.hidden = next.hidden = items.length < 2;
    }
    close.addEventListener('click', function () { dlg.close(); });
    prev.addEventListener('click', function () { show(cur - 1); });
    next.addEventListener('click', function () { show(cur + 1); });
    // клик по затемнению (не по картинке и не по кнопкам) закрывает
    dlg.addEventListener('click', function (e) { if (e.target === dlg) dlg.close(); });
    dlg.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowLeft') { show(cur - 1); e.preventDefault(); }
      else if (e.key === 'ArrowRight') { show(cur + 1); e.preventDefault(); }
    });
    dlg.addEventListener('close', function () { img.removeAttribute('src'); });
    return { dlg: dlg, open: function (n) { show(n); if (!dlg.open) dlg.showModal(); } };
  }

  function render(items, title, mount) {
    var section = el('section', 'news-gallery', { 'aria-label': 'Скриншоты' });
    var h = el('h2', 'news-gallery__title');
    h.textContent = 'Скриншоты';
    var grid = el('div', 'news-gallery__grid');
    // один скриншот — крупно на всю ширину; несколько — сетка
    if (items.length === 1) grid.classList.add('news-gallery__grid--single');
    var box = buildLightbox(items, title);

    items.forEach(function (it, i) {
      var b = el('button', 'news-gallery__item', { type: 'button', 'aria-label': 'Открыть скриншот ' + (i + 1) + ' из ' + items.length });
      var im = el('img', 'news-gallery__img', { alt: 'Скриншот ' + (i + 1) + ' — ' + title, loading: 'lazy', decoding: 'async', width: String(it.w), height: String(it.h) });
      im.src = it.src;
      b.appendChild(im);
      b.addEventListener('click', function () { box.open(i); });
      grid.appendChild(b);
    });

    section.append(h, grid, box.dlg);
    if (mount.inside) mount.node.appendChild(section); else mount.node.after(section);
  }

  function start(post) {
    var items = cleanItems(post && post.gallery);
    if (!items.length) return;
    var title = typeof post.title === 'string' ? post.title.slice(0, 120) : 'новость';
    var done = false;

    function tryMount() {
      if (done) return true;
      if (document.querySelector('.news-gallery')) { done = true; return true; }
      var mount = findMount();
      if (!mount) return false;
      done = true;
      render(items, title, mount);
      return true;
    }

    if (tryMount()) return;
    // news.js рисует статью асинхронно — ждём, пока тело появится
    var obs = new MutationObserver(function () { if (tryMount()) obs.disconnect(); });
    obs.observe(document.body, { childList: true, subtree: true });
    setTimeout(function () { obs.disconnect(); }, WAIT_MS);
  }

  fetch(new URL('news/p/' + encodeURIComponent(id) + '.json', document.baseURI), { cache: 'no-cache' })
    .then(function (r) { return r.ok ? r.json() : null; })
    .then(start)
    .catch(function () { /* нет галереи — статья остаётся как была */ });
})();
