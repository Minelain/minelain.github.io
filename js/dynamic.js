(function () {
  'use strict';
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var canHover = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };

  /* ===== 8. Подсветка пункта меню (переходы — в js/transition.js) ===== */
  var here = location.pathname.split('/').pop() || 'index.html';
  if (here === 'post.html') here = 'news.html';
  var inWiki = /\/wiki(\/|$)/.test(location.pathname);
  $$('#navbar-sticky a').forEach(function (a) {
    var raw = (a.getAttribute('href') || '').split('?')[0];
    if (inWiki) { if (/(^|\/)wiki\/?$/.test(raw)) a.classList.add('nav-active'); return; }
    var href = raw.split('/').pop();
    if ((href === here) || (here === 'index.html' && /minelain\.github\.io\/?$/.test(a.getAttribute('href') || ''))) {
      a.classList.add('nav-active');
    }
  });

  /* ===== 9. Шапка прячется при прокрутке вниз и возвращается вверх ===== */
  var header = $('header');
  if (header) {
    var lastY = window.scrollY, hTick = false;
    window.addEventListener('scroll', function () {
      if (hTick) return; hTick = true;
      requestAnimationFrame(function () {
        var y = window.scrollY, menu = $('#navbar-sticky');
        var menuOpen = menu && menu.classList.contains('show');
        if (menuOpen || y < 120 || y < lastY - 4) header.classList.remove('header-hidden');
        else if (y > lastY + 6) header.classList.add('header-hidden');
        lastY = y; hTick = false;
      });
    }, { passive: true });
  }

  /* ===== Тост ===== */
  var toastEl, toastT;
  function toast(msg) {
    if (!toastEl) { toastEl = document.createElement('div'); toastEl.className = 'toast'; document.body.appendChild(toastEl); }
    toastEl.textContent = msg;
    requestAnimationFrame(function () { toastEl.classList.add('show'); });
    clearTimeout(toastT);
    toastT = setTimeout(function () { toastEl.classList.remove('show'); }, 1800);
  }

  /* ===== 11. Конфетти / салют из снежинок ===== */
  var fx = { cv: null, ctx: null, parts: [], run: false, dpr: Math.min(window.devicePixelRatio || 1, 2) };
  var COLORS = ['#00CED1', '#40E0D0', '#9fe7ff', '#ffffff', '#00BFFF', '#ffe765', '#ee85ff'];
  function fxInit() {
    if (fx.cv) return;
    fx.cv = document.createElement('canvas'); fx.cv.id = 'fx-canvas';
    fx.cv.setAttribute('aria-hidden', 'true');
    document.body.appendChild(fx.cv);
    fx.ctx = fx.cv.getContext('2d');
    var rs = function () {
      fx.cv.width = innerWidth * fx.dpr; fx.cv.height = innerHeight * fx.dpr;
      fx.ctx.setTransform(fx.dpr, 0, 0, fx.dpr, 0, 0);
    };
    rs(); addEventListener('resize', rs, { passive: true });
  }
  function burst(x, y, n) {
    if (reduce) return;
    fxInit();
    n = n || (innerWidth < 700 ? 45 : 80);
    for (var i = 0; i < n; i++) {
      var a = Math.random() * Math.PI * 2, v = 120 + Math.random() * 320;
      fx.parts.push({
        x: x, y: y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 120,
        r: 2 + Math.random() * 3.5, c: COLORS[(Math.random() * COLORS.length) | 0],
        life: 0, max: 1.3 + Math.random() * 0.9, sq: Math.random() < 0.5
      });
    }
    if (!fx.run) { fx.run = true; fx.last = performance.now(); requestAnimationFrame(fxFrame); }
  }
  function fxFrame(ts) {
    var dt = Math.min((ts - fx.last) / 1000, 0.05); fx.last = ts;
    var c = fx.ctx; c.clearRect(0, 0, innerWidth, innerHeight);
    fx.parts = fx.parts.filter(function (p) { return p.life < p.max; });
    fx.parts.forEach(function (p) {
      p.life += dt; p.vy += 520 * dt; p.vx *= 0.99; p.x += p.vx * dt; p.y += p.vy * dt;
      c.globalAlpha = Math.max(0, 1 - p.life / p.max);
      c.fillStyle = p.c;
      if (p.sq) c.fillRect(p.x, p.y, p.r * 1.6, p.r * 1.6);
      else { c.beginPath(); c.arc(p.x, p.y, p.r, 0, 6.283); c.fill(); }
    });
    c.globalAlpha = 1;
    if (fx.parts.length) requestAnimationFrame(fxFrame);
    else { fx.run = false; c.clearRect(0, 0, innerWidth, innerHeight); }
  }
  window.MineFX = { burst: burst };

  var logo = $('header a img.logo-image');
  if (logo) {
    logo.closest('a').addEventListener('click', function (e) {
      var onHome = here === 'index.html';
      if (onHome) e.preventDefault();
      var r = logo.getBoundingClientRect();
      burst(r.left + r.width / 2, r.top + r.height / 2);
      if (onHome) e.stopImmediatePropagation();
    }, true);
  }
  // салют в день рождения проекта
  window.addEventListener('mine:birthday', function () {
    var i = 0, t = setInterval(function () {
      burst(innerWidth * (0.15 + Math.random() * 0.7), innerHeight * (0.2 + Math.random() * 0.4), 70);
      if (++i > 9) clearInterval(t);
    }, 450);
  });

  /* ===== 2. Печатающийся заголовок ===== */
  var desc = $('.first-section .info-block .desc');
  if (desc) {
    var line = document.createElement('p');
    line.className = 'typed-line'; line.setAttribute('aria-hidden', 'true');
    line.innerHTML = '<span class="typed-text"></span><span class="typed-caret"></span>';
    desc.parentNode.insertBefore(line, desc);
    var tt = $('.typed-text', line);
    var phrases = ['Строй города', 'Заключай союзы', 'Плети интриги', 'Объявляй войны', 'Делай историю'];
    if (reduce) { tt.textContent = phrases[phrases.length - 1]; $('.typed-caret', line).style.display = 'none'; }
    else {
      var pi = 0, ci = 0, del = false;
      (function step() {
        var p = phrases[pi];
        if (!del) { ci++; tt.textContent = p.slice(0, ci); }
        else { ci--; tt.textContent = p.slice(0, ci); }
        var delay = del ? 35 : 75;
        if (!del && ci === p.length) { del = true; delay = 1600; }
        else if (del && ci === 0) { del = false; pi = (pi + 1) % phrases.length; delay = 350; }
        setTimeout(step, delay);
      })();
    }
  }

  /* ===== 1 + 3. Параллакс героя и «магнитная» кнопка ===== */
  var hero = $('.first-section');
  if (hero) {
    var tx = 0, ty = 0, heroVisible = true, pTick = false;
    new IntersectionObserver(function (e) { heroVisible = e[0].isIntersecting; }).observe(hero);
    var apply = function () {
      pTick = false;
      hero.style.setProperty('--px', tx.toFixed(1) + 'px');
      hero.style.setProperty('--py', ty.toFixed(1) + 'px');
    };
    var move = function (x, y) {   // x,y в диапазоне -1..1
      tx = x * 14; ty = y * 14;
      if (!pTick) { pTick = true; requestAnimationFrame(apply); }
    };
    if (!reduce) {
      if (canHover) {
        window.addEventListener('pointermove', function (e) {
          if (!heroVisible) return;
          move((e.clientX / innerWidth - 0.5) * 2, (e.clientY / innerHeight - 0.5) * 2);
        }, { passive: true });
      } else if (window.DeviceOrientationEvent && typeof DeviceOrientationEvent.requestPermission !== 'function') {
        window.addEventListener('deviceorientation', function (e) {
          if (!heroVisible || e.gamma == null) return;
          move(Math.max(-1, Math.min(1, e.gamma / 25)), Math.max(-1, Math.min(1, ((e.beta || 0) - 45) / 25)));
        }, { passive: true });
      }
      // магнитная кнопка
      var btn = $('.buy-penetration-top', hero);
      if (btn && canHover) {
        hero.addEventListener('pointermove', function (e) {
          var r = btn.getBoundingClientRect();
          var dx = e.clientX - (r.left + r.width / 2), dy = e.clientY - (r.top + r.height / 2);
          var d = Math.hypot(dx, dy);
          if (d < 140) btn.style.translate = (dx * 0.22).toFixed(1) + 'px ' + (dy * 0.3).toFixed(1) + 'px';
          else btn.style.translate = '';
        }, { passive: true });
        hero.addEventListener('pointerleave', function () { btn.style.translate = ''; });
      }
    }
  }

  /* ===== 5. Счётчики ===== */
  function countTo(el, to, dur, suffix) {
    suffix = suffix || '';
    if (reduce) { el.textContent = to + suffix; return; }
    var from = parseInt(el.textContent, 10) || 0, t0 = performance.now();
    (function f(t) {
      var k = Math.min((t - t0) / dur, 1), e = 1 - Math.pow(1 - k, 3);
      el.textContent = Math.round(from + (to - from) * e) + suffix;
      if (k < 1) requestAnimationFrame(f);
    })(t0);
  }
  var legends = $('[data-count-legends]');
  if (legends) {
    var names = {};
    $$('.player-name').forEach(function (n) { names[n.textContent.trim()] = 1; });
    legends.setAttribute('data-count', Object.keys(names).length);
  }
  var counters = $$('[data-count]');
  if (counters.length) {
    var cio = new IntersectionObserver(function (es) {
      es.forEach(function (e) {
        if (!e.isIntersecting) return;
        countTo(e.target, parseInt(e.target.getAttribute('data-count'), 10), 1600);
        cio.unobserve(e.target);
      });
    }, { threshold: 0.6 });
    counters.forEach(function (c) { cio.observe(c); });
  }

  /* ===== 4. Онлайн сервера + копирование IP ===== */
  var live = $('#live');
  if (live) {
    var ip = live.getAttribute('data-ip');
    var stateEl = $('.live-state', live), onEl = $('[data-online]', live);
    var ipBtn = $('.live-ip', live);
    $('.live-ip-text', live).textContent = ip;
    ipBtn.addEventListener('click', function () {
      var done = function () { toast('IP скопирован: ' + ip); };
      if (navigator.clipboard && window.isSecureContext) navigator.clipboard.writeText(ip).then(done, done);
      else {
        var ta = document.createElement('textarea'); ta.value = ip; ta.style.position = 'fixed'; ta.style.opacity = '0';
        document.body.appendChild(ta); ta.select();
        try { document.execCommand('copy'); } catch (_) {}
        ta.remove(); done();
      }
      if (window.MineFX) { var r = ipBtn.getBoundingClientRect(); burst(r.left + r.width / 2, r.top, 30); }
    });
    var setState = function (cls, text, online) {
      live.classList.remove('is-online', 'is-offline');
      if (cls) live.classList.add(cls);
      stateEl.textContent = text;
      if (online == null) onEl.textContent = '—';
      else countTo(onEl, online, 900);
    };
    var load = function () {
      var ctrl = window.AbortController ? new AbortController() : null;
      var to = setTimeout(function () { ctrl && ctrl.abort(); }, 7000);
      fetch('https://api.mcsrvstat.us/3/' + encodeURIComponent(ip), ctrl ? { signal: ctrl.signal } : {})
        .then(function (r) { return r.json(); })
        .then(function (d) {
          if (d && d.online) setState('is-online', 'Сервер онлайн', d.players ? d.players.online : 0);
          else setState('is-offline', 'Сервер сейчас оффлайн', null);
        })
        .catch(function () { setState('', 'Статус недоступен', null); })
        .then(function () { clearTimeout(to); });
    };
    load();
    setInterval(function () { if (!document.hidden) load(); }, 60000);
  }

  /* ===== 6. 3D-наклон карточек ===== */
  if (canHover && !reduce) {
    var tiltSel = '.todo-item, .four-section .card, .news-card, .six-section .item-card-link, .social-link';
    $$(tiltSel).forEach(function (el) {
      var glare = document.createElement('span'); glare.className = 'tilt-glare'; el.appendChild(glare);
      var raf = 0, ev;
      el.addEventListener('pointerenter', function () {
        el.removeAttribute('data-aos');            // AOS больше не управляет transform
        el.classList.add('is-tilting');
        el.style.transition = 'transform 0.12s ease-out';
      });
      el.addEventListener('pointermove', function (e) {
        ev = e;
        if (raf) return;
        raf = requestAnimationFrame(function () {
          raf = 0;
          var r = el.getBoundingClientRect();
          var px = (ev.clientX - r.left) / r.width, py = (ev.clientY - r.top) / r.height;
          el.style.transform = 'perspective(900px) translate3d(0,-6px,0) rotateX(' + ((0.5 - py) * 9).toFixed(2) + 'deg) rotateY(' + ((px - 0.5) * 11).toFixed(2) + 'deg)';
          el.style.setProperty('--gx', (px * 100).toFixed(1) + '%');
          el.style.setProperty('--gy', (py * 100).toFixed(1) + '%');
        });
      });
      el.addEventListener('pointerleave', function () {
        el.classList.remove('is-tilting');
        el.style.transition = ''; el.style.transform = '';
      });
    });
  }

  /* ===== 7. Заголовки секций проявляются при прокрутке ===== */
  var heads = $$('.title-section, .section-title, .three-section .block-content .title, .birthday-title, .news-title');
  if (heads.length && 'IntersectionObserver' in window && !reduce) {
    var hio = new IntersectionObserver(function (es) {
      es.forEach(function (e) {
        if (e.isIntersecting) { e.target.classList.add('in'); hio.unobserve(e.target); }
      });
    }, { threshold: 0.4 });
    heads.forEach(function (h) { h.classList.add('h-reveal'); hio.observe(h); });
  }
})();
