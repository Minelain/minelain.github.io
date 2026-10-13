/* FAQ-аккордеон («Есть вопросы?»): одновременно открыт один пункт.
   Работает и с клавиатуры: заголовок — кнопка (Tab, Enter, Пробел). */
(function () {
  'use strict';
  var items = Array.prototype.slice.call(document.querySelectorAll('.spoller-item'));
  if (!items.length) return;

  function setOpen(item, open) {
    item.classList.toggle('active', open);
    var t = item.querySelector('.spoller-item-title');
    if (t) t.setAttribute('aria-expanded', open ? 'true' : 'false');
  }
  function toggle(item) {
    var open = !item.classList.contains('active');
    items.forEach(function (i) { setOpen(i, false); });
    setOpen(item, open);
  }

  items.forEach(function (item, n) {
    var title = item.querySelector('.spoller-item-title');
    var body = item.querySelector('.text-container');
    if (title) {
      title.setAttribute('role', 'button');
      title.tabIndex = 0;
      title.setAttribute('aria-expanded', 'false');
      if (body) { body.id = body.id || 'faq-' + n; title.setAttribute('aria-controls', body.id); }
      title.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle(item); }
      });
    }
    item.addEventListener('click', function (e) {
      if (e.target.closest('a')) return;   // клик по ссылке внутри ответа не сворачивает пункт
      toggle(item);
    });
  });
})();
