/* Плавные переходы между страницами (см. css/transition.css).
   Подключается в <head> БЕЗ defer — это нужно, чтобы класс .vt
   выставился до первой отрисовки страницы. */
(function () {
  'use strict';
  var root = document.documentElement;
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // Браузер умеет нативные переходы между документами — CSS сделает всё сам.
  if ('CSSViewTransitionRule' in window) { root.classList.add('vt'); return; }
  if (reduce) return;

  // Запасной вариант: затухаем, потом переходим по ссылке.
  document.addEventListener('click', function (e) {
    var a = e.target.closest && e.target.closest('a[href]');
    if (!a || e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    if (a.target && a.target !== '_self') return;
    if (a.hasAttribute('download')) return;
    var u;
    try { u = new URL(a.href, location.href); } catch (_) { return; }
    if (u.origin !== location.origin) return;
    if (u.pathname === location.pathname && u.search === location.search) return; // якоря на этой же странице
    e.preventDefault();
    document.body.classList.add('page-leave');
    setTimeout(function () { location.href = u.href; }, 200);
  });
  // возврат кнопкой «Назад» из кэша браузера
  window.addEventListener('pageshow', function () { document.body.classList.remove('page-leave'); });
})();
