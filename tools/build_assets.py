#!/usr/bin/env python3
"""
Сборка CSS/JS сайта MineLain:  src/css, src/js  ->  css/*.min.css, js/*.min.js

Зачем: вместо 8 CSS и 5–7 JS файлов на каждой странице браузер получает
один CSS и один-два JS. Tailwind (style.css) и AOS (aos.css) очищаются от
неиспользуемых правил, всё минифицируется.

Порядок работы после правок:
    cd tools && npm install          # один раз: csso, purgecss, terser
    python3 tools/build_wiki.py      # если менялась вики или шапка
    python3 tools/build_assets.py    # собрать css/ и js/

Исходники правим только в src/. Файлы css/*.min.css и js/*.min.js — результат сборки.
"""
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

ROOT = Path(sys.argv[1]).resolve() if len(sys.argv) > 1 else Path(__file__).resolve().parent.parent
SRC_CSS, SRC_JS = ROOT / "src" / "css", ROOT / "src" / "js"
OUT_CSS, OUT_JS = ROOT / "css", ROOT / "js"

BIN = ROOT / "tools" / "node_modules" / ".bin"


def tool(name):
    p = BIN / name
    return [str(p)] if p.exists() else ["npx", "--no-install", name]


# Порядок файлов в бандле = порядок подключения раньше (каскад не меняется).
CORE = ["fonts.css", "style.css", "normalize.css", "style.min.css"]
TAIL = ["winter.css", "dynamic.css", "transition.css"]
CSS_BUNDLES = {
    "home":  CORE + ["aos.css", "custom.css"] + TAIL,
    "page":  CORE + ["custom.css"] + TAIL,                    # donate / social / oferta
    "news":  CORE + ["custom.css", "news.css"] + TAIL,        # news / post
    "wiki":  CORE + ["custom.css"] + TAIL + ["wiki.css"],
}
# Только эти файлы чистим от неиспользуемых правил (остальные — рукописные)
PURGE = {"style.css", "aos.css"}

JS_BUNDLES = {
    # общий для всех страниц (раньше: menu + winter + snow + dynamic)
    OUT_JS / "site.min.js": ["menu.js", "winter.js", "snow.js", "dynamic.js"],
    # только главная: AOS + FAQ-аккордеон + пауза бегущей строки вне экрана
    OUT_JS / "home.min.js": ["aos.min.js", "spoller.js", "home.js"],
    # только новости и пост
    OUT_JS / "news.min.js": ["news-data.js", "news.js"],
    OUT_JS / "transition.min.js": ["transition.js"],
    ROOT / "wiki" / "wiki.min.js": ["wiki.js"],
}


def run(cmd, **kw):
    r = subprocess.run(cmd, capture_output=True, text=True, **kw)
    if r.returncode:
        sys.exit(f"Ошибка: {' '.join(cmd)}\n{r.stderr}")
    return r.stdout


def kb(n):
    return f"{n / 1024:.1f} КБ"


def purge(tmp):
    """Очищает style.css и aos.css по реальному содержимому страниц и скриптов."""
    out = tmp / "purged"
    out.mkdir()
    content = [str(p) for pat in ("*.html", "wiki/**/*.html", "wiki/*.html", "src/js/*.js", "tools/build_wiki.py")
               for p in ROOT.glob(pat)]
    for name in PURGE:
        run(tool("purgecss") + ["--config", str(ROOT / "tools" / "purgecss.config.js"),
                                "--css", str(SRC_CSS / name), "--content", *content, "--output", str(out)], cwd=ROOT)
    check_purge(out / "style.css")
    return out


def check_purge(purged_css):
    """Страховка: если Tailwind-класс из разметки пропал после очистки — сборка падает, а не ломает сайт."""
    import re
    unesc = lambda s: re.sub(r"\\(.)", r"\1", s)
    sels = lambda css: {unesc(s) for s in re.findall(r"\.((?:[a-zA-Z0-9_-]|\\.)+)", css)}
    before = sels((SRC_CSS / "style.css").read_text(encoding="utf-8"))
    after = sels(purged_css.read_text(encoding="utf-8"))
    used = set()
    for f in list(ROOT.glob("*.html")) + list(ROOT.glob("wiki/**/*.html")):
        for m in re.finditer(r'class="([^"]*)"', f.read_text(encoding="utf-8")):
            used.update(m.group(1).split())
    lost = sorted((before - after) & used)
    if lost:
        sys.exit("PurgeCSS удалил используемые классы: " + ", ".join(lost))


def build_css():
    OUT_CSS.mkdir(exist_ok=True)
    with tempfile.TemporaryDirectory() as t:
        tmp = Path(t)
        purged = purge(tmp)
        for key, files in CSS_BUNDLES.items():
            parts = []
            for f in files:
                src = (purged / f) if f in PURGE else (SRC_CSS / f)
                parts.append(src.read_text(encoding="utf-8"))
            raw = tmp / f"{key}.css"
            raw.write_text("\n".join(parts), encoding="utf-8")
            out = OUT_CSS / f"{key}.min.css"
            run(tool("csso") + [str(raw), "-o", str(out), "--comments", "none", "--no-restructure"])
            print(f"  css/{key}.min.css  {kb(out.stat().st_size)}  (исходники: {kb(raw.stat().st_size)})")


def build_js():
    OUT_JS.mkdir(exist_ok=True)
    for out, files in JS_BUNDLES.items():
        code = "\n;\n".join((SRC_JS / f).read_text(encoding="utf-8") for f in files)
        with tempfile.NamedTemporaryFile("w", suffix=".js", delete=False, encoding="utf-8") as tf:
            tf.write(code)
        run(tool("terser") + [tf.name, "-c", "-m", "--comments", "false", "-o", str(out)])
        Path(tf.name).unlink()
        print(f"  {out.relative_to(ROOT)}  {kb(out.stat().st_size)}")


if __name__ == "__main__":
    print("CSS:")
    build_css()
    print("JS:")
    build_js()
    print("Готово.")
