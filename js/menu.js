/* Мобильное меню (три полоски в шапке).
   Открытие/закрытие — только класс .show: всю анимацию делает CSS через
   transform/opacity (css/custom.css), поэтому на телефонах она идёт без лагов. */
(function () {
  'use strict';
  var btn = document.querySelector('[data-collapse-toggle="navbar-sticky"]');
  var menu = document.getElementById('navbar-sticky');
  if (!btn || !menu) return;
  var root = document.documentElement, busyT;

  function set(open) {
    if (menu.classList.contains('show') === open) return;
    // на время анимации ставим на паузу фоновые эффекты (снег, звёзды, сияние)
    root.classList.add('is-busy');
    clearTimeout(busyT);
    busyT = setTimeout(function () { root.classList.remove('is-busy'); }, 420);
    menu.classList.toggle('show', open);
    btn.setAttribute('aria-expanded', open ? 'true' : 'false');
  }

  btn.addEventListener('click', function () { set(!menu.classList.contains('show')); });
  menu.addEventListener('click', function (e) { if (e.target.closest('a')) set(false); });
  document.addEventListener('click', function (e) {
    if (menu.classList.contains('show') && !menu.contains(e.target) && !btn.contains(e.target)) set(false);
  });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') set(false); });
  window.matchMedia('(min-width: 1024px)').addEventListener('change', function (m) { if (m.matches) set(false); });
})();
