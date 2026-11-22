#!/usr/bin/env python3
"""Build the project case-study pages.

    python3 tools/build_projects.py          # write projects/<slug>/index.html and projects/posters.css
    python3 tools/build_projects.py --check  # fail if any generated file is out of date

Inputs: projects/projects.json (content) and index.html (the Work section's posters and their CSS, reused as is,
so each case study opens on the same animated poster as its row on the home page). No dependencies.
"""
import html
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "projects"
E = lambda s: html.escape(str(s), quote=True)

ICON = {
    "arrow-l": '<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M12.5 4.5 7 10l5.5 5.5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    "arrow-r": '<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M7.5 4.5 13 10l-5.5 5.5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    "out": '<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M8 5H5v10h10v-3M11 4h5v5M16 4l-7 7" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    "down": '<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M10 3.5v9M6 9l4 4 4-4M4.5 16.5h11" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    "github": '<svg viewBox="0 0 16 16" aria-hidden="true"><path fill="currentColor" d="M8 0a8 8 0 0 0-2.53 15.59c.4.07.55-.17.55-.38v-1.34c-2.23.48-2.7-1.07-2.7-1.07-.36-.92-.89-1.17-.89-1.17-.73-.5.06-.49.06-.49.8.06 1.23.83 1.23.83.72 1.22 1.88.87 2.34.66.07-.52.28-.87.5-1.07-1.78-.2-3.65-.89-3.65-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.22 2.2.82a7.6 7.6 0 0 1 4 0c1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.28.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48v2.2c0 .21.15.46.55.38A8 8 0 0 0 8 0Z"/></svg>',
}
BADGE = {"live": "Live", "shot": "Screenshot", "sim": "Simulation", "code": "Code", "embed": "Embed"}


# ---------------------------------------------------------------- index.html: posters and their CSS
def css_blocks(css):
    """Top-level (selector, body) blocks; nested at-rule bodies are returned raw."""
    out, i, n = [], 0, len(css)
    while i < n:
        j = css.find("{", i)
        if j < 0:
            break
        depth, k = 1, j + 1
        while depth and k < n:
            depth += {"{": 1, "}": -1}.get(css[k], 0)
            k += 1
        out.append((css[i:j].strip(), css[j + 1:k - 1]))
        i = k
    return out


def poster_rule(sel):
    return "wp-" in sel or "work-poster" in sel


def keep_selectors(sel):
    """From a selector list keep only the poster selectors (so shared rules don't leak other sections' styles)."""
    parts = [p.strip() for p in sel.split(",")]
    kept = [p for p in parts if poster_rule(p)]
    return ",".join(kept)


def extract_poster_css(index_html):
    styles = re.findall(r"<style[^>]*>(.*?)</style>", index_html, re.S)
    css = re.sub(r"/\*.*?\*/", "", "\n".join(styles), flags=re.S)
    out = []
    for sel, body in css_blocks(css):
        if sel.startswith("@keyframes"):
            if re.match(r"@keyframes\s+wp-", sel):
                out.append(f"{sel}{{{body}}}")
        elif sel.startswith("@media") or sel.startswith("@supports"):
            inner = []
            for s2, b2 in css_blocks(body):
                k = keep_selectors(s2)
                if k:
                    inner.append(f"{k}{{{b2}}}")
            if inner:
                out.append(f"{sel}{{{''.join(inner)}}}")
        elif not sel.startswith("@"):
            k = keep_selectors(sel)
            if k:
                out.append(f"{k}{{{body}}}")
    return out


def extract_posters(index_html):
    sec = index_html[index_html.index('id="projects"'):]
    sec = sec[:sec.index("</section>")]
    figs = {}
    for m in re.finditer(r'<figure class="work-poster[^"]*"[^>]*data-i="(\d)"[^>]*>.*?</figure>', sec, re.S):
        fig = m.group(0)
        # assets are referenced from the site root; the case studies live two folders down
        fig = re.sub(r'\s(src|href)="(?!https?:|#|data:|/)([^"]+)"', r' \1="../../\2"', fig)
        figs[int(m.group(1))] = fig
    return figs


# ---------------------------------------------------------------- page parts
def badges(p):
    return "".join(f'<li class="pd-badge pd-badge--{E(x["kind"])}"><span class="pd-badge__k">{E(BADGE.get(x["kind"], x["kind"]))}</span>{E(x["label"])}</li>' for x in p["experience"])


def actions(p):
    a = [f'<a class="pd-btn pd-btn--primary" href="{E(p["repo"])}" target="_blank" rel="noopener">{ICON["github"]}<span>View code on GitHub</span>{ICON["out"]}<span class="sr-only"> (opens in a new tab)</span></a>']
    for label, href in p.get("links", []):
        a.append(f'<a class="pd-btn" href="{E(href)}" target="_blank" rel="noopener">{ICON["out"]}<span>{E(label)}</span><span class="sr-only"> (opens in a new tab)</span></a>')
    for label, href in p.get("downloads", []):
        a.append(f'<a class="pd-btn" href="{E(href)}" rel="noopener" download>{ICON["down"]}<span>{E(label)}</span></a>')
    return "".join(a)


def head(sec, n):
    src = f'<span class="pd-src">Source: {E(sec["source"])}</span>' if sec.get("source") else ""
    return (f'<div class="pd-sec__head"><span class="pd-eyebrow">{n:02d} / {E(sec["eyebrow"])}</span>'
            f'<h2>{E(sec["title"])}</h2>{src}</div>')


def render_section(sec, n, p):
    t = sec["type"]
    h = head(sec, n)
    if t == "text":
        body = "".join(f"<p>{E(x)}</p>" for x in sec["body"])
        return f'<section class="pd-sec">{h}<div class="pd-sec__body pd-prose">{body}</div></section>'
    if t == "note":
        body = "".join(f"<p>{E(x)}</p>" for x in sec["body"])
        return f'<section class="pd-sec pd-sec--note">{h}<div class="pd-sec__body pd-prose pd-note">{body}</div></section>'
    if t == "features":
        items = "".join(f'<li><h3>{E(a)}</h3><p>{E(b)}</p></li>' for a, b in sec["items"])
        return f'<section class="pd-sec">{h}<div class="pd-sec__body"><ul class="pd-features">{items}</ul></div></section>'
    if t == "steps":
        items = "".join(f'<li><span class="pd-steps__n">{i + 1:02d}</span><div><h3>{E(a)}</h3><p>{E(b)}</p></div></li>' for i, (a, b) in enumerate(sec["items"]))
        return f'<section class="pd-sec">{h}<div class="pd-sec__body"><ol class="pd-steps">{items}</ol></div></section>'
    if t in ("stack", "dataset"):
        items = "".join(f"<div><dt>{E(a)}</dt><dd>{E(b)}</dd></div>" for a, b in sec["items"])
        return f'<section class="pd-sec">{h}<div class="pd-sec__body"><dl class="pd-table">{items}</dl></div></section>'
    if t == "code":
        code = E("\n".join(sec["lines"]))
        return f'<section class="pd-sec">{h}<div class="pd-sec__body"><pre class="pd-code"><code>{code}</code></pre></div></section>'
    if t == "figure":
        return (f'<section class="pd-sec pd-sec--wide">{h}<figure class="pd-fig"><div class="pd-fig__frame">'
                f'<img src="{E(sec["src"])}" alt="{E(sec["alt"])}" loading="lazy" decoding="async"></div>'
                f'<figcaption><span class="pd-badge pd-badge--shot"><span class="pd-badge__k">Screenshot</span>Not interactive</span>'
                f'<span>{E(sec["caption"])}</span></figcaption></figure></section>')
    if t == "dashboard":
        return (f'<section class="pd-sec pd-sec--wide" id="explore">{h}'
                f'<div class="dash" data-dash="{E(sec["id"])}" data-src="../data/{E(sec["data"])}">'
                f'<p class="dash__loading">Loading the interactive dashboard…</p>'
                f'<noscript><p class="dash__loading">The interactive dashboard needs JavaScript.</p></noscript></div></section>')
    if t == "walkthrough":
        steps = json.dumps(sec["steps"], ensure_ascii=False).replace("</", "<\\/")
        return (f'<section class="pd-sec pd-sec--wide" id="explore">{h}'
                f'<div class="walk" data-walk><p class="dash__loading">Loading the walkthrough…</p>'
                f'<script type="application/json" data-walk-steps>{steps}</script></div></section>')
    if t == "insights":
        items = "".join(f'<li><span class="pd-insight__n">{E(a)}</span><p>{E(b)}</p></li>' for a, b in sec["items"])
        note = f'<p class="pd-foot-note">{E(sec["note"])}</p>' if sec.get("note") else ""
        return f'<section class="pd-sec">{h}<div class="pd-sec__body"><ul class="pd-insights">{items}</ul>{note}</div></section>'
    if t == "pipeline":
        items = "".join(f'<li><span class="pd-steps__n">{i + 1:02d}</span><div><h3>{E(a)}</h3><p>{E(b)}</p></div></li>' for i, (a, b) in enumerate(sec["items"]))
        note = f'<p class="pd-foot-note">{E(sec["note"])}</p>' if sec.get("note") else ""
        return f'<section class="pd-sec">{h}<div class="pd-sec__body"><ol class="pd-steps pd-steps--pipe">{items}</ol>{note}</div></section>'
    raise ValueError(f"unknown section type {t}")


def page(p, prev, nxt, total, poster, site):
    url = f'{site}projects/{p["slug"]}/'
    secs = [s for s in p["sections"] if not s.get("pending")]
    body = "".join(render_section(s, i + 1, p) for i, s in enumerate(secs))
    facts = "".join(f"<div><dt>{E(a)}</dt><dd>{E(b)}</dd></div>" for a, b in p["facts"])
    i = p["index"]
    # the row's grid placement (--r) means nothing here; the name lets the poster morph from the home page (view transitions)
    poster, swapped = re.subn(r'style="--r:\d+"', f'style="view-transition-name:wp-{i}"', poster, count=1)
    if not swapped:
        raise SystemExit(f"poster {i}: expected a style=\"--r:N\" attribute to replace")

    def pager_link(q, rel, label):
        arrow = ICON["arrow-l"] if rel == "prev" else ICON["arrow-r"]
        return (f'<a class="pd-pager__link pd-pager__link--{rel}" href="../{E(q["slug"])}/" rel="{rel}">'
                f'<span class="pd-pager__label">{arrow}{label} · {q["index"] + 1:02d}</span>'
                f'<span class="pd-pager__title">{E(q["title"])}</span><span class="pd-pager__kicker">{E(q["kicker"])}</span></a>')

    og_img = site + "og-image.png"
    return f"""<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>{E(p["title"])} · Case study · Shaikh Javed</title>
  <meta name="description" content="{E(p["summary"])}">
  <link rel="canonical" href="{E(url)}">
  <meta name="theme-color" content="#00251a">
  <meta property="og:type" content="article">
  <meta property="og:site_name" content="Shaikh Javed">
  <meta property="og:title" content="{E(p["title"])} · Shaikh Javed">
  <meta property="og:description" content="{E(p["summary"])}">
  <meta property="og:url" content="{E(url)}">
  <meta property="og:image" content="{E(og_img)}">
  <meta name="twitter:card" content="summary_large_image">
  <link rel="icon" href="../../favicon.ico" sizes="any">
  <link rel="icon" type="image/png" sizes="32x32" href="../../favicon-32.png">
  <link rel="apple-touch-icon" href="../../apple-touch-icon.png">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600&display=swap">
  <link rel="stylesheet" href="../posters.css">
  <link rel="stylesheet" href="../project.css">
  <script>document.documentElement.classList.add('js')</script>
</head>
<body class="pd" data-project="{E(p["slug"])}">
  <a class="pd-skip" href="#main">Skip to content</a>
  <header class="pd-bar">
    <a class="pd-back" href="../../#projects" data-back>{ICON["arrow-l"]}<span>All projects</span></a>
    <a class="pd-brand" href="../../" aria-label="Shaikh Javed, portfolio home"><img src="../../logo.png" alt="" width="28" height="28"><span>Shaikh Javed</span></a>
    <span class="pd-count" aria-label="Project {i + 1} of {total}">{i + 1:02d} / {total:02d}</span>
  </header>
  <main id="main">
    <section class="pd-hero">
      <div class="pd-hero__copy">
        <span class="pd-eyebrow">{i + 1:02d} / Work</span>
        <p class="pd-kicker">{E(p["kicker"])}</p>
        <h1 class="pd-title" style="view-transition-name:wt-{i}">{E(p["title"])}</h1>
        <p class="pd-lede">{E(p["summary"])}</p>
        <ul class="pd-badges" aria-label="What this page offers">{badges(p)}</ul>
        <div class="pd-actions">{actions(p)}</div>
      </div>
      <div class="pd-hero__poster">{poster}</div>
    </section>
    <dl class="pd-facts">{facts}</dl>
    {body}
    <nav class="pd-pager" aria-label="More projects">{pager_link(prev, "prev", "Previous")}{pager_link(nxt, "next", "Next")}</nav>
  </main>
  <footer class="pd-foot">
    <a class="pd-back pd-back--foot" href="../../#projects" data-back>{ICON["arrow-l"]}<span>Back to all projects</span></a>
    <span>Shaikh Javed · Mumbai</span>
  </footer>
  <script src="../project.js" defer></script>
</body>
</html>
"""


def build():
    data = json.loads((OUT / "projects.json").read_text())
    index_html = (ROOT / "index.html").read_text()
    posters = extract_posters(index_html)
    projects = sorted(data["projects"], key=lambda q: q["index"])
    files = {}
    css = "/* GENERATED by tools/build_projects.py from index.html (Work posters). Do not edit by hand. */\n" + "\n".join(extract_poster_css(index_html)) + "\n"
    files[OUT / "posters.css"] = css
    n = len(projects)
    for k, p in enumerate(projects):
        if p["index"] not in posters:
            raise SystemExit(f'no poster with data-i="{p["index"]}" in index.html for {p["slug"]}')
        files[OUT / p["slug"] / "index.html"] = page(p, projects[k - 1], projects[(k + 1) % n], n, posters[p["index"]], data["site"])
    return files


def main():
    files = build()
    if "--check" in sys.argv:
        stale = [str(f.relative_to(ROOT)) for f, txt in files.items() if not f.exists() or f.read_text() != txt]
        if stale:
            print("STALE (run python3 tools/build_projects.py):", ", ".join(stale))
            sys.exit(1)
        print(f"PASS: {len(files)} generated files up to date")
        return
    for f, txt in files.items():
        f.parent.mkdir(parents=True, exist_ok=True)
        f.write_text(txt)
    print(f"wrote {len(files)} files: " + ", ".join(str(f.relative_to(ROOT)) for f in files))


if __name__ == "__main__":
    main()
