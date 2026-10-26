# Project Documentation

## Overview

This repository is a static, single-page personal portfolio for Shaikh Javed. The complete application is implemented in `index.html`; root-level assets provide the profile image, project thumbnails, logo, certificates, favicon, and resume link target. There is no build system, server-side application, database, or package manifest.

`README.md` remains the public GitHub-facing introduction.

## Design Lock / Audit (Step 1 of 12)

This section records the preserved design system and content baseline for the portfolio redesign. Treat this as the locked source of truth for all following implementation steps.

### Preserved Design Tokens

- `:root` palette:
  - `--black: #000`
  - `--ink: #00251a`
  - `--deep: #004d40`
  - `--teal: #006064`
  - `--cyan: #26c6da`
  - `--green: #00e676`
  - `--green-dark: #4CAF50`
  - `--paper: #fff`
  - `--mist: #f9f9f9`
  - `--kale: #D7DDBA`
  - `--pale: #BCC88B`
  - `--muted: #555`
  - `--line: rgba(0,77,64,.12)`
  - `--ease: cubic-bezier(.2,.8,.2,1)`
- Background colors: black, paper white, deep green, teal gradients, pale green with radial overlays, mist backgrounds.
- Primary text color: `--ink` (#00251a)
- Secondary text color: `--deep` (#004d40)
- Muted text color: `--muted` (#555)
- Glass fill examples: `rgba(255,255,255,.86)` on sticky nav; `rgba(255,255,255,.1)` hero status chip.
- Glass borders: `rgba(255,255,255,.24)`, `rgba(255,255,255,.32)`, `rgba(255,255,255,.62)` and green translucent borders.
- Existing gradients: hero dark green/teal blend and soft pale-green radial overlays.
- Accent colors: `#D7DDBA` must remain exactly as the Golden Kale accent; `--cyan`, `--green`, `--deep` are secondary accents.
- Shadows: soft green-tinted shadows such as `rgba(0,37,26,.07)` and `rgba(0,37,26,.15)`.
- Glow colors: certificate glow in soft `rgba(188,200,139,.6)` to `.9`.
- Border colors: `var(--line)` with translucent green values and white translucent surfaces.
- Typography: Inter for body/UI; JetBrains Mono for labels and metadata; large editorial headings with tight tracking and uppercase eyebrow labels.
- Spacing system: container width `min(1160px, calc(100% - 40px))`, large section padding, 12-column project grid, card paddings, and tight stacked rhythm.
- Breakpoints: current responsive logic is anchored by `max-width: 800px` and `max-width: 480px`.

### Asset Audit

Required root assets already present and must remain supported without renaming or inventing replacements:

- `github-copilot.png` — certificate card
- `Great-learing.png` — certificate card
- `IBM.png` — certificate card
- `cert-powerbi.png` — certificate card
- `cert-google.png` — certificate card
- `Sahikh_javed.png` — certificate card
- `logo.png` — header brand mark (160×160; shown at 2.1rem)
- `about-gdg-stage.jpg` — About section stage photo
- `Shaikh_Javed_Data_Analyst.pdf` — resume download link target

Other existing images remain part of the portfolio gallery and should be preserved unless genuinely unused.

### Content Audit

Preserve the current factual content and narrative as the source-of-truth:

- Data Analytics Intern at MAK { Byte }
- Final-year B.Sc. Data Science student at Mumbai University
- CGPA: final graduation CGPA 7.60 / 10 (7.40 was the earlier figure up to Semester 4)
- Post-exam status: awaiting results
- Team Code_Runners leadership at GDG Cloud Hackathon 2.0
- Google Student Ambassador role

Do not add extra jobs, degrees, companies, awards, or metrics beyond the current implementation.

### Structure Audit

Current sections present in the page:

- Header
- Navigation
- Hero
- About
- Skills
- Journey (contains experience, education, leadership, and community content)
- Projects
- Certificates
- Contact
- Footer

Planned but not currently standalone: dedicated Experience, Education, and Achievements sections.

### Final Architecture Guardrails

- Single-file portfolio remains in `index.html`
- Semantic HTML5, CSS3, CSS variables, Grid/Flexbox, `backdrop-filter`, vanilla ES6+, and HTML5 Canvas only
- No React, Vue, Angular, Tailwind, build system, or unnecessary libraries
- Apple-inspired but not copied from proprietary Apple assets or implementations
- Subtle motion, large typography, glass surfaces, editorial spacing, and story-led hierarchy
- Mobile-first, responsive from 320px to desktop
- Performance targets: no unnecessary layout shifts, passive listeners, `requestAnimationFrame`, and reduced-motion support

## Architecture

- `index.html` contains semantic HTML, all CSS, and all JavaScript (vanilla, no framework, no build step).
- Palette tokens: `--ink #00251a`, `--deep #004d40`, `--teal #006064`, `--kale #D7DDBA`, `--paper #fff`, `--mist #f9f9f9`, black.
- Inter and JetBrains Mono load from Google Fonts. Font Awesome 6.5.1 loads from cdnjs for a few icons. GSAP is not used.
- One shared rAF scroll pass (`setHeaderAndNav`) reads the section rects once per frame and writes CSS variables (`--tl`, `--arrive`, `--farrive`). The hero film, the certificates reel and the work index read scroll in their own rAF handlers.
- There is no API, database, authentication, environment variable, or server route.

## Features (current)

- Hero: a scroll-driven Canvas 2D film (460svh; 400svh on phones).
- About, Experience (timeline), Education (CGPA gauge), Leadership (bento with animated icons).
- Work: an editorial index of 5 projects with sticky posters, each with its own motion.
- Certificates: a pinned horizontal reel of 6 certificates, each with an SVG scene and a full-size `<dialog>` viewer.
- Toolkit: a periodic table of 26 tools with "molecule" bonds.
- Contact: email hero, copy button, live IST clock. Footer: a rising wordmark.
- Reduced-motion and keyboard paths for all of the above.

## Main UI Surfaces

- `#hero` / `#dataCanvas`, `#about`, `#experience` (`.timeline`), `#education`, `#leadership` (`.lead-grid`), `#projects` (`.work-index`), `#certificates` (`.cert-reel`, `.cert-viewer`), `#skills` (`.ptable`, `.el-card`), `#contact`, `.footer`.

## Dependencies

- Google Fonts (Inter, JetBrains Mono) and Font Awesome 6.5.1 (CDN).
- GoatCounter `count.js`. It loads only when `GC_CODE` is set and the host is `shk-javed.github.io` (see Site metadata below).
- Browser-native APIs: Canvas, SVG, IntersectionObserver, `requestAnimationFrame`, Clipboard, `Intl.DateTimeFormat`, `<dialog>`.

## Site metadata, sharing, search, 404 and analytics (Oct 2026)

- The `<head>` has the search title "Shaikh Javed – Automation Analyst | Data, interpreted", a 156-character description, and a canonical link to `https://shk-javed.github.io/shaikhjaved.portfolio/`. It also has JSON-LD (Person, WebSite, ProfilePage) and Open Graph and Twitter tags.
- Share and icon files: `og-image.png` (1200×630 link preview), `favicon.ico` (16/32/48; the old file was 0 bytes), `favicon-32.png`, `apple-touch-icon.png`, `icon-192.png`, `icon-512.png`, `icon-maskable-512.png` and `site.webmanifest`. theme-color is #004d40. All icons come from the original 2048px logo (git `7f827de:logo.png`).
- `sitemap.xml` lists only the home page; update `<lastmod>` and the JSON-LD `dateModified` on releases. There is no `robots.txt` on purpose: on a GitHub Pages project site, crawlers only read `https://shk-javed.github.io/robots.txt`, so a file in this repo would be ignored, and having none means "crawl everything".
- `404.html` is standalone ("This row doesn't exist in the dataset.") and noindex. It uses `<base href="https://shk-javed.github.io/shaikhjaved.portfolio/">`, so its assets resolve at any depth and in local previews.
- Analytics: GoatCounter is cookie-free. The snippet sits before `</body>` in both `index.html` and `404.html`, and stays inert until the owner sets `GC_CODE` in both files. When on, it sends a page view and one event per page view for reaching projects, certificates, skills and contact, plus resume-download clicks. On the 404, broken links are logged as `/404/<path>`.
- Optional owner steps:
  - Create the GoatCounter account and set `GC_CODE`.
  - In Google Search Console, verify the site with a meta tag and submit `sitemap.xml`.
  - Re-scrape the preview in LinkedIn Post Inspector after deploys.
- `README.md` was rewritten for GitHub, with screenshots in `readme/` (WebP, about 116 KB total).

## Known Issues

- `shaikh_javed_DA.pdf` is a duplicate of `Shaikh_Javed_Data_Analyst.pdf`. It is kept because older shared links may point to it.

## Maintenance Notes

- Treat `index.html` as a coupled single-file application: markup, styles, and behavior are intentionally co-located.
- Preserve existing root-level asset names and external project links when changing content.
- Validate the inline script and local asset references after edits.
- Repository cleanup (Oct 2026): removed 13 unused assets (~20 MB): the old project posters `aadhar.png`, `comcast.png`, `flight.png`, `spotify2023.png` and `financial.png`; the old portraits `javed222.jpeg`, `javed52.jpeg` and `JAVED.png`; the old icons `business.png`, `calculating.png`, `github1.png` and `insta1.png`; and `cert-3.png`. Also stopped tracking `.DS_Store`. `logo.png` was shrunk from 2048×2048 (9.2 MB) to 160×160 (66 KB). `favicon.ico` was renamed from a filename with a trailing space, and its link no longer needs `%20`. `shaikh_javed_DA.pdf` (a duplicate of the resume) is kept on purpose because older shared links may point to it. A code audit found no unused CSS classes or keyframes in `index.html`.
