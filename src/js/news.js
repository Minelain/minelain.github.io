/* Новости сайта.
   Источники:
     1) window.NEWS из news-data.js — посты, написанные вручную;
     2) news/index.json + news/p/<id>.json — посты, которые публикует бот после одобрения модератором.
   Текст постов из бота приходит как HTML и проходит через sanitize() — разрешены только безопасные теги. */
(function () {
  'use strict';

  var DEFAULT_IMAGE = 'images/news/news-1.webp';
  var ID_RE = /^[A-Za-z0-9_-]{1,80}$/;
  var staticPosts = (window.NEWS || []).slice();

  function byDateDesc(a, b) { return a.date < b.date ? 1 : a.date > b.date ? -1 : 0; }

  function formatDate(iso) {
    var d = new Date(iso + 'T00:00:00');
    if (isNaN(d)) return iso;
    return d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' });
  }

  function el(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }

  function readMinutes(p) {
    if (p.read) return Math.max(1, Math.round(p.read));
    var words = String(p.content || '').replace(/<[^>]*>/g, ' ').split(/\s+/).filter(Boolean).length;
    return Math.max(1, Math.round(words / 180));
  }

  /* Пропускает только p, br, ul/ol/li, strong/em, blockquote и ссылки http(s). Остальное превращается в текст. */
  var ALLOWED = { P: 1, BR: 1, UL: 1, OL: 1, LI: 1, STRONG: 1, B: 1, EM: 1, I: 1, BLOCKQUOTE: 1, A: 1 };
  function sanitize(html) {
    var doc = new DOMParser().parseFromString('<body>' + String(html || '') + '</body>', 'text/html');
    var out = document.createDocumentFragment();
    (function walk(src, dst) {
      Array.prototype.forEach.call(src.childNodes, function (n) {
        if (n.nodeType === 3) { dst.appendChild(document.createTextNode(n.nodeValue)); return; }
        if (n.nodeType !== 1) return;
        var tag = n.tagName;
        if (!ALLOWED[tag]) {
          if (tag !== 'SCRIPT' && tag !== 'STYLE') walk(n, dst);   // неизвестный тег: оставляем только его текст
          return;
        }
        var c = document.createElement(tag.toLowerCase());
        if (tag === 'A') {
          var href = n.getAttribute('href') || '';
          if (!/^https?:\/\//i.test(href)) { walk(n, dst); return; }
          c.setAttribute('href', href);
          c.setAttribute('rel', 'noopener noreferrer nofollow');
          c.setAttribute('target', '_blank');
        }
        walk(n, c);
        dst.appendChild(c);
      });
    })(doc.body, out);
    return out;
  }

  function getJson(url) {
    // no-cache: браузер всякий раз сверяется с сервером (быстро, по ETag), поэтому свежие новости видны сразу
    return fetch(url, { cache: 'no-cache' }).then(function (r) {
      if (!r.ok) throw new Error(url + ' ' + r.status);
      return r.json();
    });
  }

  /* ---------- Список новостей ---------- */
  var grid = document.getElementById('news-grid');

  function renderList(posts, showEmpty) {
    grid.textContent = '';
    if (!posts.length && showEmpty) {
      grid.appendChild(el('p', 'news-empty', 'Пока здесь пусто. Скоро появятся новости!'));
    }
    var cards = [];
    posts.forEach(function (p, i) {
      var a = el('a', 'news-card');
      a.href = 'post.html?id=' + encodeURIComponent(p.id);
      a.style.setProperty('--i', i);

      var imgWrap = el('div', 'news-card-image');
      var img = el('img');
      img.src = p.image || DEFAULT_IMAGE;
      img.alt = p.title;
      img.width = 800;
      img.height = 450;
      img.decoding = 'async';
      if (i > 2) img.loading = 'lazy';
      imgWrap.appendChild(img);

      var body = el('div', 'news-card-body');
      var meta = el('span', 'news-card-date', formatDate(p.date));
      meta.appendChild(el('span', 'read-time', ' · ' + readMinutes(p) + ' мин чтения'));
      body.appendChild(meta);
      body.appendChild(el('h2', 'news-card-title', p.title));

      a.appendChild(imgWrap);
      a.appendChild(body);
      grid.appendChild(a);
      cards.push(a);
    });
    return cards;
  }

  if (grid) {
    // 1) сразу показываем ручные посты (как раньше), 2) догружаем посты бота и пересобираем список
    renderList(staticPosts.slice().sort(byDateDesc), false);
    getJson('news/index.json').then(function (data) {
      var remote = (data && data.posts) || [];
      var known = {};
      staticPosts.forEach(function (p) { known[p.id] = 1; });
      var merged = staticPosts.concat(remote.filter(function (p) {
        return p && ID_RE.test(p.id) && !known[p.id] && p.title && p.date;
      })).sort(byDateDesc);
      if (merged.length === staticPosts.length && staticPosts.length) return;   // ничего нового
      var run = function () {
        var cards = renderList(merged, true);
        if (window.MineLainTilt) window.MineLainTilt(cards);
      };
      // dynamic.js (наклон карточек) подключается после этого файла — ждём конца разбора страницы
      if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', run); else run();
    }).catch(function () {
      if (!staticPosts.length) renderList([], true);
    });
  }

  /* ---------- Страница поста ---------- */
  var root = document.getElementById('post-root');
  if (root) {
    var id = new URLSearchParams(location.search).get('id') || '';

    var back = el('a', 'post-back', '← Все новости');
    back.href = 'news.html';
    root.appendChild(back);

    var show = function (post, trusted) {
      document.title = post.title + ' — MineLain';
      var og = document.querySelector('meta[property="og:title"]');
      if (og) og.setAttribute('content', post.title);

      var cover = el('img', 'post-cover');
      cover.src = post.image || DEFAULT_IMAGE;
      cover.alt = post.title;
      cover.width = 800;
      cover.height = 450;
      root.appendChild(cover);

      var pd = el('time', 'post-date', formatDate(post.date));
      pd.appendChild(el('span', 'read-time', ' · ' + readMinutes(post) + ' мин чтения'));
      root.appendChild(pd);
      root.appendChild(el('h1', 'post-title', post.title));
      if (post.author) root.appendChild(el('p', 'post-author', 'Автор: ' + post.author));

      var content = el('div', 'post-content');
      if (trusted) content.innerHTML = post.content;      // ручные посты пишет владелец сайта в news-data.js
      else content.appendChild(sanitize(post.content));   // посты бота — только через фильтр
      root.appendChild(content);
    };
    var notFound = function () {
      document.title = 'Пост не найден — MineLain';
      root.appendChild(el('h1', 'post-title', 'Пост не найден'));
      root.appendChild(el('p', 'post-content', 'Возможно, ссылка устарела.'));
    };

    var local = staticPosts.filter(function (p) { return p.id === id; })[0];
    if (local) show(local, true);
    else if (!ID_RE.test(id)) notFound();
    else getJson('news/p/' + id + '.json').then(function (p) {
      if (!p || !p.title || !p.date) throw new Error('bad post');
      show(p, false);
    }).catch(notFound);
  }
})();
