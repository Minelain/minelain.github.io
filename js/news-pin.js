/*
 * Закреплённые новости: карточка с "pinned": true в news/index.json всегда первая в списке
 * и получает значок-кнопку булавки слева сверху.
 *
 * Подключение в news.html (после js/news.js):
 *   <link rel="stylesheet" href="css/news-pin.css">
 *   <script src="js/news-pin.js" defer></script>
 *
 * Скрипт не зависит от вёрстки карточек: находит ссылки на post.html?id=<id>, поднимается к
 * самому большому предку, в котором только одна новость, помечает его и ставит первым среди соседей.
 * Нужен лишь id из index.json (проверяется по [A-Za-z0-9_-]).
 */
(function () {
  'use strict';
  var ID_RE = /^[A-Za-z0-9_-]{1,80}$/;
  var pinned = [];
  var busy = false;

  function linkId(a) {
    var m = /[?&]id=([^&#]+)/.exec(a.getAttribute('href') || '');
    return m ? decodeURIComponent(m[1]) : null;
  }

  // Предок-карточка: растём, пока внутри ровно одна новость.
  function cardOf(a) {
    var card = a, up = a.parentElement;
    while (up && up !== document.body) {
      var ids = {}, n = 0;
      up.querySelectorAll('a[href*="post.html"]').forEach(function (x) {
        var id = linkId(x);
        if (id && !ids[id]) { ids[id] = 1; n++; }
      });
      if (n !== 1) break;
      card = up; up = up.parentElement;
    }
    return card;
  }

  function badge() {
    var b = document.createElement('span');
    b.className = 'news-pin-badge';
    b.setAttribute('role', 'img');
    b.setAttribute('aria-label', 'Закреплено');
    b.title = 'Закреплено';
    var ns = 'http://www.w3.org/2000/svg';
    var svg = document.createElementNS(ns, 'svg');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('width', '16');
    svg.setAttribute('height', '16');
    svg.setAttribute('aria-hidden', 'true');
    var path = document.createElementNS(ns, 'path');
    path.setAttribute('fill', 'currentColor');
    path.setAttribute('d', 'M16 3a1 1 0 0 1 .7 1.7L15.4 6l.9 5.1 2.3 2.3a1 1 0 0 1-.7 1.7H13v5.2a1 1 0 0 1-2 0v-5.2H6.1a1 1 0 0 1-.7-1.7L7.7 11l.9-5L7.3 4.7A1 1 0 0 1 8 3h8z');
    svg.appendChild(path);
    b.appendChild(svg);
    return b;
  }

  function apply() {
    if (busy) return;
    busy = true;
    try {
      // в порядке списка: первая закреплённая окажется самой верхней
      for (var i = pinned.length - 1; i >= 0; i--) {
        var a = document.querySelector('a[href*="post.html"][href*="' + pinned[i] + '"]');
        if (!a || linkId(a) !== pinned[i]) continue;
        var card = cardOf(a);
        card.classList.add('news-pinned');
        if (!card.querySelector(':scope > .news-pin-badge')) card.appendChild(badge());
        if (card.parentElement && card.parentElement.firstElementChild !== card) {
          card.parentElement.prepend(card);
        }
      }
    } finally {
      // MutationObserver получит записи о наших правках уже после этого — пропускаем их
      setTimeout(function () { busy = false; }, 0);
    }
  }

  fetch(new URL('news/index.json', document.baseURI), { cache: 'no-cache' })
    .then(function (r) { return r.ok ? r.json() : null; })
    .then(function (data) {
      var posts = data && Array.isArray(data.posts) ? data.posts : [];
      pinned = posts
        .filter(function (p) { return p && p.pinned === true && typeof p.id === 'string' && ID_RE.test(p.id); })
        .map(function (p) { return p.id; });
      if (!pinned.length) return;
      apply();
      // news.js рисует и перерисовывает список (поиск, фильтры, «ещё») — подстраиваемся
      new MutationObserver(apply).observe(document.body, { childList: true, subtree: true });
    })
    .catch(function () { /* без значка список остаётся как был */ });
})();
