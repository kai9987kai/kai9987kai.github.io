# kai9987kai.github.io — Personal Website + Project Hub

This repository contains my personal website hosted on GitHub Pages. It’s a mixed-purpose site that I use to:

- Showcase **projects** and interactive web experiments (HTML/CSS/JS)
- Link **social accounts** (YouTube channels, Instagram, etc.)
- Host a **3D design portfolio**
- Store **screenshots / promo images** for projects and general organization

> Note: This repo is intentionally broad. Some content is “serious portfolio”, some is experimental, and some is archival/legacy.

---

## Live site

Primary (custom domain):
- https://www.kai9987kai.co.uk/

Also used/linked:
- https://kai9987kai.pw/

The default GitHub Pages domain may redirect to the custom domain (depending on current DNS / Pages settings).

---

## Tech stack (simple + fast)

- Static hosting via **GitHub Pages**
- Mostly **HTML** with supporting **CSS** and **JavaScript**
- No required build step (pages are served directly)

If you want a framework/build pipeline later (Vite, Astro, Next static export, etc.), you can add it — but this repo currently works as a straight static site.

---

## Repo layout (high-level)

Because this is a long-running “website + lab + archive” repo, content lives in multiple places. Common patterns:

- `assets/` — shared static assets (CSS, JS, icons, etc.)
- `images/` / `Screenshots/` — images, promo screenshots, uploads
- `projects/` — project pages and/or project index data
- `blog/` — blog-related pages/content (if present)
- Other folders may represent:
  - University work / modules (e.g. `BU/`, `College/`)
  - Experimental sections (e.g. `Beta/`)
  - Standalone mini-sites or tools

There are also many standalone `.html` pages at the repo root.

---

## Run locally (recommended)

### Option A — Python (fastest)
```bash
python -m http.server 8080
