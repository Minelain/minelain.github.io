#!/usr/bin/env python3
"""
Сборка вики MineLain: wiki-src/*.md  ->  wiki/*.html

Исходники — markdown-экспорт из GitBook (папка wiki-src/, оглавление в SUMMARY.md).
Скрипт превращает их в статические страницы с общей шапкой сайта.

Запуск из корня репозитория:
    pip install markdown beautifulsoup4
    python3 tools/build_wiki.py

Чтобы добавить страницу: положите .md в wiki-src/, добавьте строку в
wiki-src/SUMMARY.md и (по желанию) красивый адрес в SLUGS ниже.
"""
import html
import json
import re
import shutil
import sys
from pathlib import Path

import markdown
from bs4 import BeautifulSoup
from markdown.extensions.toc import slugify_unicode

ROOT = Path(sys.argv[1]).resolve() if len(sys.argv) > 1 else Path(__file__).resolve().parent.parent
SRC = ROOT / "wiki-src"
OUT = ROOT / "wiki"

# Красивые адреса вместо технических имён файлов из GitBook
SLUGS = {
    "README.md": "index",
    "pravila.md": "pravila",
    "nachat-igru/quickstart.md": "nachat-igru/quickstart",
    "nachat-igru/publish-your-docs.md": "nachat-igru/kak-zajti",
    "nachat-igru/interactive-blocks.md": "nachat-igru/konkursy",
    "nachat-igru/openapi.md": "nachat-igru/pomoshch",
    "po-igre/editor.md": "po-igre/goroda",
    "po-igre/nacii.md": "po-igre/nacii",
    "po-igre/flagwar.md": "po-igre/voiny",
    "po-igre/epokhi.md": "po-igre/epokhi",
    "po-igre/images-and-media.md": "po-igre/viktorina",
    "po-igre/sposoby-zarabotka.md": "po-igre/zarabotok",
    "po-igre/integrations.md": "po-igre/alkogol",
    "lor/gazeta-12-sezon-minecampff.md": "lor/gazeta-12-sezon",
}


# ---------------------------------------------------------------- оглавление
def parse_summary():
    pages, section = [], None
    for line in (SRC / "SUMMARY.md").read_text(encoding="utf-8").splitlines():
        m = re.match(r"^##\s+(.+)", line)
        if m:
            section = m.group(1).strip()
            continue
        m = re.match(r"^\s*\*\s+\[(.+?)\]\((.+?)\)", line)
        if m:
            src = m.group(2)
            pages.append({
                "title": m.group(1),
                "src": src,
                "slug": SLUGS.get(src, src[:-3]),
                "section": section,
            })
    return pages


def rel(from_slug, to_slug):
    """Относительная ссылка между страницами вики."""
    base = Path(from_slug).parent
    target = Path(to_slug + ".html")
    out = Path(*([".."] * len(base.parts))) / target if base.parts else target
    s = str(out)
    return "./" if s == "index.html" else s.replace("/index.html", "/")


def root_prefix(slug):
    return "../" * (len(Path(slug).parts))  # wiki/<slug>.html -> на уровень выше wiki/


# ---------------------------------------------------------------- шапка сайта
def site_chrome():
    news = (ROOT / "news.html").read_text(encoding="utf-8")
    header = re.search(r"<header.*?</header>", news, re.S).group(0)
    svg = re.search(r"<svg width=\"0\".*?</svg>", news, re.S).group(0)
    menu_js = re.search(r"<script>\s*// Улучшенная анимация.*?</script>", news, re.S).group(0)
    return header, svg, menu_js


def fix_header(header, prefix):
    # ссылки сайта лежат в корне, а страницы вики — глубже
    header = re.sub(r'(src|href)="(images/|news\.html|donate\.html|social\.html)',
                    lambda m: f'{m.group(1)}="{prefix}{m.group(2)}', header)
    header = re.sub(r'href="(\.\./)*wiki/"', f'href="{prefix}wiki/"', header)
    header = header.replace(' aria-current="page"', "")
    header = re.sub(r'href="wiki/"', f'href="{prefix}wiki/"', header)
    return header


# ---------------------------------------------------------------- markdown
def prepare_md(text, pages, cur):
    text = re.sub(r"\A---\n.*?\n---\n", "", text, flags=re.S)  # front matter GitBook

    def ref(m):
        url = m.group(1)
        label = re.search(r"\[(.+?)\]", m.group(0)).group(1)
        key = url.rstrip("/").split("/")[-1]
        target = None
        if url.endswith(".md"):  # относительная ссылка на файл: ../po-igre/nacii.md
            import posixpath
            want = posixpath.normpath(posixpath.join(posixpath.dirname(cur["src"]), url))
            target = next((p for p in pages if p["src"] == want), None)
        if not target:
            target = next((p for p in pages if p["slug"].split("/")[0] == key or p["slug"] == key), None)
        if not target:
            print(f"  ! content-ref без цели: {url}")
            return f'<a class="wiki-ref" href="{html.escape(url)}"><b>{label}</b></a>'
        return (f'\n<a class="wiki-ref" href="{rel(cur["slug"], target["slug"])}">'
                f'<span>Читать дальше</span><b>{label}</b></a>\n')

    text = re.sub(r'\{%\s*content-ref url="(.+?)"\s*%\}.*?\{%\s*endcontent-ref\s*%\}', ref, text, flags=re.S)
    text = re.sub(r"\[([^\]]+)\]\(#user-content-fn-\d+\)", r"\1", text)      # битые сноски GitBook
    text = re.sub(r'<a href="#[^"]*" id="[^"]*"></a>', "", text)             # пустые якоря-дубли
    text = re.sub(r"\\\n", "<br>\n", text)                                   # «\» в конце строки = перенос
    text = text.replace("&#x20;", " ")
    return text


def render(text):
    md = markdown.Markdown(
        extensions=["extra", "sane_lists", "toc"],
        extension_configs={"toc": {"slugify": slugify_unicode}},
    )
    return md.convert(text)


def postprocess(body_html, cur, pages):
    soup = BeautifulSoup(body_html, "html.parser")

    # пустые заголовки-мусор (GitBook оставляет <h3 id="menu"><br></h3> внутри таблиц)
    for h in soup.find_all(re.compile(r"^h[1-6]$")):
        if not h.get_text(strip=True) and not h.find("img"):
            h.decompose()

    # заголовок страницы
    h1 = soup.find("h1")
    title = h1.get_text(strip=True) if h1 else cur["title"]
    if h1:
        h1.decompose()

    # таблица-карточки GitBook (data-view="cards")
    for t in soup.find_all("table", attrs={"data-view": "cards"}):
        grid = soup.new_tag("div", attrs={"class": "wiki-cards"})
        for tr in t.find("tbody").find_all("tr"):
            tds = tr.find_all("td")
            card = soup.new_tag("div", attrs={"class": "wiki-card"})
            cover = tds[2].find("a") if len(tds) > 2 else None
            if cover and cover.get("href"):
                img = soup.new_tag("img", src=cover["href"], alt="", loading="lazy")
                card.append(img)
            info = soup.new_tag("div")
            b = soup.new_tag("b"); b.string = tds[0].get_text(strip=True)
            p = soup.new_tag("p"); p.string = tds[1].get_text(strip=True) if len(tds) > 1 else ""
            info.append(b); info.append(p); card.append(info)
            grid.append(card)
        t.replace_with(grid)

    # остальные таблицы — со скроллом на телефоне
    for t in soup.find_all("table"):
        for a in t.attrs.copy():
            if a != "class":
                del t[a]
        for el in t.find_all(["th", "td"]):
            el.attrs.pop("width", None)
        wrap = soup.new_tag("div", attrs={"class": "table-wrap"})
        t.wrap(wrap)

    # картинки
    for fig in soup.find_all("figure"):
        fig.attrs = {"class": "wiki-fig"}
        cap = fig.find("figcaption")
        if cap and not cap.get_text(strip=True):
            cap.decompose()
        if fig.parent and fig.parent.name == "div" and fig.parent.get("align"):
            del fig.parent["align"]
    for img in soup.find_all("img"):
        for a in ("width", "height"):
            img.attrs.pop(a, None)
        img["loading"] = "lazy"
        img["decoding"] = "async"
        src = img.get("src", "")
        if src.startswith("../.gitbook/assets/"):
            # assets лежит в wiki/assets, страница — в wiki/<slug>.html
            img["src"] = ("../" * (len(Path(cur["slug"]).parts) - 1)) + "assets/" + src.split("/")[-1]

    # align="center" -> класс
    for el in soup.find_all(attrs={"align": True}):
        if el["align"] == "center":
            el["class"] = el.get("class", []) + ["is-center"]
        del el["align"]

    # внешние ссылки — в новой вкладке
    for a in soup.find_all("a", href=True):
        if re.match(r"https?://", a["href"]):
            a["target"] = "_blank"
            a["rel"] = "noopener noreferrer"

    # id у заголовков, оглавление справа, ссылка-якорь
    toc = []
    for h in soup.find_all(["h2", "h3"]):
        if h.find_parent("table"):
            continue
        text = h.get_text(" ", strip=True)
        if not h.get("id"):
            h["id"] = slugify_unicode(text, "-")
        toc.append({"level": int(h.name[1]), "id": h["id"], "text": text})
        anchor = soup.new_tag("a", href="#" + h["id"], attrs={"class": "anchor", "aria-label": "Ссылка на раздел"})
        anchor.string = "#"
        h.append(anchor)

    return soup, title, toc


# ---------------------------------------------------------------- шаблон
def sidebar_html(pages, cur):
    out, last, first = [], None, True
    for p in pages:
        if first or p["section"] != last:
            if not first:
                out.append("</div>")
            first = False
            out.append('<div class="wiki-group">')
            if p["section"]:
                out.append(f'<div class="wiki-group-title">{html.escape(p["section"])}</div>')
            last = p["section"]
        active = ' class="active" aria-current="page"' if p is cur else ""
        out.append(f'<a href="{rel(cur["slug"], p["slug"])}"{active}>{html.escape(p["title"])}</a>')
    out.append("</div>")
    return "\n".join(out)


def page_html(cur, idx, pages, body, title, toc, desc, chrome):
    header, svg, menu_js = chrome
    prefix = root_prefix(cur["slug"])
    wprefix = prefix + "wiki/"
    asset = prefix  # css/js/images лежат в корне сайта
    header = fix_header(header, prefix)

    toc_html = ""
    if toc:
        items = "".join(
            f'<a class="lvl{t["level"]}" href="#{t["id"]}">{html.escape(t["text"])}</a>' for t in toc
        )
        toc_html = f'<div class="wiki-toc-title">На этой странице</div>{items}'

    prev_p = pages[idx - 1] if idx > 0 else None
    next_p = pages[idx + 1] if idx < len(pages) - 1 else None
    pager = ""
    if prev_p:
        pager += (f'<a class="prev" href="{rel(cur["slug"], prev_p["slug"])}"><span>← Назад</span>'
                  f'<b>{html.escape(prev_p["title"])}</b></a>')
    else:
        pager += "<span></span>"
    if next_p:
        pager += (f'<a class="next" href="{rel(cur["slug"], next_p["slug"])}"><span>Дальше →</span>'
                  f'<b>{html.escape(next_p["title"])}</b></a>')

    crumbs = html.escape(cur["section"]) if cur["section"] else "Вики"
    full_title = f"{title} — Вики MineLain"

    return f"""<!DOCTYPE html>
<html class="scroll-smooth" lang="ru">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Montserrat:wght@400;500;600;700;800&display=swap">
  <link href="{asset}css/style.css" rel="stylesheet">
  <link rel="shortcut icon" type="image/x-icon" href="{asset}images/logo.png">
  <title>{html.escape(full_title)}</title>
  <meta name="description" content="{html.escape(desc)}">
  <meta property="og:title" content="{html.escape(full_title)}">
  <meta property="og:description" content="{html.escape(desc)}">
  <link rel="stylesheet" href="{asset}css/normalize.css">
  <link rel="stylesheet" href="{asset}css/style.min.css">
  <link rel="stylesheet" href="{asset}css/custom.css">
  <link rel="stylesheet" href="{asset}css/winter.css">
  <link rel="stylesheet" href="{asset}css/dynamic.css">
  <link rel="stylesheet" href="{asset}css/transition.css">
  <link rel="stylesheet" href="{asset}css/wiki.css">
  <script src="{asset}js/transition.js"></script>
</head>

<body class="min-w-[400px]" style="background-color: #212121;">

  {svg}

  {header}

  <main class="wiki-page">
    <div class="wiki-layout">
      <aside class="wiki-side" id="wiki-side">
        <div class="wiki-search">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>
          <input id="wiki-search" type="search" placeholder="Поиск по вики…" autocomplete="off" aria-label="Поиск по вики">
          <div class="wiki-results" id="wiki-results" hidden></div>
        </div>
        <nav class="wiki-nav">
{sidebar_html(pages, cur)}
        </nav>
      </aside>

      <article class="wiki-article">
        <button class="wiki-burger" id="wiki-burger" type="button" aria-controls="wiki-side" aria-expanded="false">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 6h16M4 12h16M4 18h10"/></svg>
          Разделы вики
        </button>
        <div class="wiki-crumbs">Вики · {crumbs}</div>
        <h1 class="wiki-title">{html.escape(title)}</h1>
        <div class="wiki-body">
{body}
        </div>
        <div class="wiki-pager">{pager}</div>
      </article>

      <aside class="wiki-toc" id="wiki-toc">{toc_html}</aside>
    </div>
  </main>

  <footer>
  </footer>

  <script>window.WIKI_ROOT = "{wprefix}";</script>
  <script src="{wprefix}wiki.js"></script>
  {menu_js}

<script src="{asset}js/winter.js" defer></script>
<script src="{asset}js/snow.js" defer></script>
<script src="{asset}js/dynamic.js" defer></script>
</body>
</html>
"""


# ---------------------------------------------------------------- main
def main():
    pages = parse_summary()
    chrome = site_chrome()

    # чистим только сгенерированные html, статику (wiki.js) не трогаем
    OUT.mkdir(exist_ok=True)
    for f in OUT.rglob("*.html"):
        f.unlink()

    # картинки, которые GitBook хранит локально
    assets_src = SRC / ".gitbook" / "assets"
    if assets_src.exists():
        shutil.copytree(assets_src, OUT / "assets", dirs_exist_ok=True)

    index = []
    for i, cur in enumerate(pages):
        text = (SRC / cur["src"]).read_text(encoding="utf-8")
        body_html = render(prepare_md(text, pages, cur))
        soup, title, toc = postprocess(body_html, cur, pages)

        plain = soup.get_text(" ", strip=True)
        plain = re.sub(r"\s*#\s*(?=\s|$)", " ", plain)
        first_p = soup.find("p")
        desc = (first_p.get_text(" ", strip=True) if first_p else title)[:200]

        out_path = OUT / (cur["slug"] + ".html")
        out_path.parent.mkdir(parents=True, exist_ok=True)
        out_path.write_text(page_html(cur, i, pages, str(soup), title, toc, desc, chrome), encoding="utf-8")

        index.append({
            "t": title, "u": cur["slug"] + ".html", "s": cur["section"] or "",
            "h": [x["text"] for x in toc], "x": plain[:4000],
        })
        print(f"  ✓ {cur['src']:42s} -> wiki/{cur['slug']}.html")

    (OUT / "search-index.js").write_text(
        "window.WIKI_INDEX=" + json.dumps(index, ensure_ascii=False, separators=(",", ":")) + ";",
        encoding="utf-8",
    )
    print(f"Готово: {len(pages)} страниц.")


if __name__ == "__main__":
    main()
