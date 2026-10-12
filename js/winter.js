(function () {
  'use strict';
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------- Полоса прокрутки ---------- */
  var bar = document.createElement('div');
  bar.className = 'scroll-progress';
  document.body.appendChild(bar);
  var ticking = false;
  function updateBar() {
    var h = document.documentElement.scrollHeight - window.innerHeight;
    bar.style.transform = 'scaleX(' + (h > 0 ? Math.min(window.scrollY / h, 1) : 0) + ')';
    ticking = false;
  }
  window.addEventListener('scroll', function () {
    if (!ticking) { ticking = true; requestAnimationFrame(updateBar); }
  }, { passive: true });
  updateBar();

  /* ---------- Отсчёт до 5-летия (18.02.2027, 00:00 по Москве) ---------- */
  var box = document.getElementById('birthday');
  if (box) {
    var TARGET = Date.parse('2027-02-18T00:00:00+03:00');
    var els = {
      d: box.querySelector('[data-cd="days"]'),
      h: box.querySelector('[data-cd="hours"]'),
      m: box.querySelector('[data-cd="minutes"]'),
      s: box.querySelector('[data-cd="seconds"]')
    };
    var cache = {};
    function pad(n) { return n < 10 ? '0' + n : String(n); }
    function set(key, val) {
      if (cache[key] === val) return;
      cache[key] = val;
      var el = els[key];
      el.textContent = val;
      if (!reduce) {
        el.classList.remove('tick'); void el.offsetWidth; el.classList.add('tick');
      }
    }
    function tick() {
      var now = Date.now();
      var left = TARGET - now;
      if (left <= 0) { if (!box.classList.contains('is-done')) { box.classList.add('is-done'); window.dispatchEvent(new Event('mine:birthday')); } clearInterval(timer); return; }
      var s = Math.floor(left / 1000);
      set('d', String(Math.floor(s / 86400)));
      set('h', pad(Math.floor(s % 86400 / 3600)));
      set('m', pad(Math.floor(s % 3600 / 60)));
      set('s', pad(s % 60));
    }
    var timer = setInterval(tick, 1000);
    tick();
  }
})();
