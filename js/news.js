(function () {
  var posts = (window.NEWS || []).slice().sort(function (a, b) {
    return a.date < b.date ? 1 : a.date > b.date ? -1 : 0;
  });

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

  function readTime(html) {
    var words = String(html || '').replace(/<[^>]*>/g, ' ').split(/\s+/).filter(Boolean).length;
    return Math.max(1, Math.round(words / 180)) + ' мин чтения';
  }

  // ---------- Список новостей ----------
  var grid = document.getElementById('news-grid');
  if (grid) {
    if (!posts.length) {
      grid.appendChild(el('p', 'news-empty', 'Пока здесь пусто. Скоро появятся новости!'));
    }
    posts.forEach(function (p, i) {
      var a = el('a', 'news-card');
      a.href = 'post.html?id=' + encodeURIComponent(p.id);
      a.style.setProperty('--i', i);

      var imgWrap = el('div', 'news-card-image');
      var img = el('img');
      img.src = p.image;
      img.alt = p.title;
      img.width = 800;
      img.height = 450;
      img.decoding = 'async';
      if (i > 2) img.loading = 'lazy';
      imgWrap.appendChild(img);

      var body = el('div', 'news-card-body');
      var meta = el('span', 'news-card-date', formatDate(p.date));
      meta.appendChild(el('span', 'read-time', ' · ' + readTime(p.content)));
      body.appendChild(meta);
      body.appendChild(el('h2', 'news-card-title', p.title));

      a.appendChild(imgWrap);
      a.appendChild(body);
      grid.appendChild(a);
    });
  }

  // ---------- Страница поста ----------
  var root = document.getElementById('post-root');
  if (root) {
    var id = new URLSearchParams(location.search).get('id');
    var post = posts.filter(function (p) { return p.id === id; })[0];

    var back = el('a', 'post-back', '← Все новости');
    back.href = 'news.html';
    root.appendChild(back);

    if (!post) {
      document.title = 'Пост не найден — MineLain';
      root.appendChild(el('h1', 'post-title', 'Пост не найден'));
      root.appendChild(el('p', 'post-content', 'Возможно, ссылка устарела.'));
    } else {
      document.title = post.title + ' — MineLain';
      var og = document.querySelector('meta[property="og:title"]');
      if (og) og.setAttribute('content', post.title);

      var cover = el('img', 'post-cover');
      cover.src = post.image;
      cover.alt = post.title;
      cover.width = 800;
      cover.height = 450;
      root.appendChild(cover);
      var pd = el('time', 'post-date', formatDate(post.date));
      pd.appendChild(el('span', 'read-time', ' · ' + readTime(post.content)));
      root.appendChild(pd);
      root.appendChild(el('h1', 'post-title', post.title));

      var content = el('div', 'post-content');
      content.innerHTML = post.content; // контент пишет владелец сайта в news-data.js
      root.appendChild(content);
    }
  }
})();
