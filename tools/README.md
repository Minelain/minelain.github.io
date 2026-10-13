# Сборка сайта

Исходники CSS/JS лежат в `src/`. Файлы `css/*.min.css`, `js/*.min.js`, `wiki/wiki.min.js` — результат сборки, руками их не правим.

```bash
cd tools && npm install        # один раз: csso, purgecss, terser
pip install markdown beautifulsoup4 pillow   # для build_wiki.py
python3 build_wiki.py          # после правок вики (wiki-src/) или шапки в news.html
python3 build_assets.py        # после правок в src/css, src/js, а также HTML-разметки
```

* `build_assets.py` чистит Tailwind и AOS от неиспользуемых правил. Если класс из разметки при этом пропадёт, сборка остановится с ошибкой.
* Новые HTML-страницы: подключайте один бандл (`css/home|page|news|wiki.min.css`) и `js/site.min.js` (defer). Бандлы описаны в начале `build_assets.py`.
* Шрифт Montserrat лежит в `fonts/` (SIL OFL), подключается из `src/css/fonts.css`.
* Иконки статей вики — словарь `ICONS` в `build_wiki.py`; для новой статьи добавьте строку (иначе будет иконка-документ).
* `measure_perf.py <папка сайта> <порт>` — замер запросов, веса и метрик через Playwright (`pip install playwright`).

## Новости от бота
Одобренные новости бот коммитит в `news/index.json` (список) и `news/p/<id>.json` (текст). Страницы `news.html` и `post.html` подгружают их сами (`src/js/news.js`), а HTML из JSON дополнительно фильтруется на странице. Вручную написанные посты по-прежнему живут в `src/js/news-data.js`. Править `news/` руками можно, но бот перезаписывает `news/index.json` целиком, поэтому лишние правки лучше делать коммитом поверх.
