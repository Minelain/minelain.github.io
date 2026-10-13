/* ===========================
   СНЕГОПАД — отдельный самодостаточный модуль.

   КАК ОТКЛЮЧИТЬ:
   вариант 1 (быстро, везде сразу): поставьте ENABLED = false ниже;
   вариант 2 (полностью): удалите строку
       <script src="js/snow.js" defer></script>
   со страниц (и сам файл, если не нужен).

   Больше снег нигде не зашит: ни в winter.js, ни в winter.css.
=========================== */
(function () {
  'use strict';

  var ENABLED = true;        // ← false = снег выключен
  var COUNT_DESKTOP = 80;    // число снежинок на ПК
  var COUNT_MOBILE = 35;     // число снежинок на телефоне
  var FPS = 30;              // частота кадров
  var SPEED = 0.75;          // скорость падения и покачивания (1 = как раньше; 0.75 = на 25% медленнее)

  if (!ENABLED) return;
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  var canvas = document.createElement('canvas');
  canvas.id = 'snow-canvas';
  canvas.setAttribute('aria-hidden', 'true');
  canvas.style.cssText = 'position:fixed;inset:0;width:100%;height:100%;z-index:50;pointer-events:none';
  document.body.appendChild(canvas);

  var ctx = canvas.getContext('2d');
  var w = 0, h = 0, dpr = 1   /* снежинки мягкие — retina-разрешение не нужно, а пикселей в 4 раза меньше */;
  var COUNT = window.innerWidth < 700 ? COUNT_MOBILE : COUNT_DESKTOP;
  var STEP = 1000 / FPS;

  // предрисованные снежинки трёх размеров
  var sprites = [3, 5, 8].map(function (r) {
    var c = document.createElement('canvas');
    var s = r * 2 + 4;
    c.width = c.height = s * dpr;
    var x = c.getContext('2d');
    x.scale(dpr, dpr);
    var g = x.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, r);
    g.addColorStop(0, 'rgba(255,255,255,0.95)');
    g.addColorStop(0.5, 'rgba(235,248,255,0.55)');
    g.addColorStop(1, 'rgba(235,248,255,0)');
    x.fillStyle = g;
    x.beginPath(); x.arc(s / 2, s / 2, r, 0, Math.PI * 2); x.fill();
    return { c: c, s: s };
  });

  var flakes = [];
  function resize() {
    w = window.innerWidth; h = window.innerHeight;
    canvas.width = w * dpr; canvas.height = h * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  function make(initial) {
    var t = Math.random();
    var k = t < 0.55 ? 0 : t < 0.88 ? 1 : 2;
    return {
      k: k,
      x: Math.random() * w,
      y: initial ? Math.random() * h : -20,
      vy: (25 + k * 22 + Math.random() * 20) * SPEED,   // px/сек
      sway: 10 + Math.random() * 25,
      ph: Math.random() * 6.28,
      sp: (0.4 + Math.random() * 0.8) * SPEED
    };
  }
  resize();
  for (var i = 0; i < COUNT; i++) flakes.push(make(true));
  window.addEventListener('resize', resize, { passive: true });

  var last = 0, running = true;
  function frame(ts) {
    if (!running) return;
    requestAnimationFrame(frame);
    if (ts - last < STEP) return;
    var dt = Math.min((ts - last) / 1000, 0.1); last = ts;
    ctx.clearRect(0, 0, w, h);
    for (var i = 0; i < flakes.length; i++) {
      var f = flakes[i];
      f.y += f.vy * dt;
      f.ph += f.sp * dt;
      var x = f.x + Math.sin(f.ph) * f.sway;
      if (f.y > h + 20) { flakes[i] = make(false); continue; }
      var sp = sprites[f.k];
      ctx.drawImage(sp.c, x - sp.s / 2, f.y - sp.s / 2, sp.s, sp.s);
    }
  }
  document.addEventListener('visibilitychange', function () {
    running = !document.hidden;           // пауза на скрытой вкладке
    if (running) { last = performance.now(); requestAnimationFrame(frame); }
  });
  requestAnimationFrame(frame);
})();
