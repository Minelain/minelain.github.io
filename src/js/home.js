/* Главная: запуск AOS и пауза бегущей строки игроков, когда она вне экрана */
(function () {
  'use strict';
  if (window.AOS) {
    // once: анимация появления проигрывается один раз (меньше работы при скролле)
    AOS.init({ once: true, disable: function () {
      return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    } });
  }
  var wall = document.querySelector('.legendary-players-wall');
  if (!wall || !('IntersectionObserver' in window)) return;
  new IntersectionObserver(function (entries) {
    entries.forEach(function (e) { wall.classList.toggle('is-offscreen', !e.isIntersecting); });
  }, { rootMargin: '100px 0px' }).observe(wall);
})();
