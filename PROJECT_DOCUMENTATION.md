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

## Talk to Me: SHK JAVED AI guide (Oct 2026)

A robotic-pangolin "AI guide" that answers visitors' questions about Javed from verified site facts and takes them to the evidence. It runs fully in the browser: no backend, API keys, accounts, cookies, analytics of questions, or network transmission of anything the visitor types.

**Experience ("The Archivist")**
- The dock stays hidden while the hero film plays. After the hero, the pangolin slides in on a kale disc in the bottom-right corner and waves once per session. On narrow screens, near the certificate reel, or wherever it would cover an interactive element, it compacts to a small edge tab.
- Openers: the dock button and `[data-tw-open]`, which is the "Ask my AI guide" button in #contact.
- The panel is a non-modal dialog. Its header always shows "AI guide · not Javed himself · answers only from this site's verified facts". It has starter questions, answers with evidence chips (the hexagon glyph marks verified facts) and follow-up suggestions.
- "Show me" minimises the panel to the dock (the transcript stays), plays a move, then calls `SHKSite.go(evidence)`. Certificate chips move the reel to that certificate; tool chips select that toolkit element (its bonds draw); project chips activate that work row; anchors scroll. Focus moves to the target and a spotlight ring marks it.
- Mobile uses a bottom sheet. Reduced motion uses still poses, instant moves and no entrance animation.
- The transcript, engine context and "hide for this visit" state live in `sessionStorage` (`tw:v1`, this tab only).

**Modules (each one global; plain scripts, no build)**
| File | Owner role | Notes |
|---|---|---|
| `twin/tw-boot.js` | Experience | Loader. It loads nothing while the hero is visible, then injects `tw.css`, the poster, `pangolin.js` and the idle/wave strips. Global `SHKTwin`. |
| `twin/tw-app.js`, `twin/tw.css` | Experience | Panel, Shadow DOM, chips, focus, choreography, dock avoidance. Loads on the first hover, focus or click of an opener. |
| `twin/pangolin.js` | Character | Sprite player (`SHKPangolin`). Timer clock, not rAF; per-row ground and scale corrections; 16 look directions; pauses when hidden. |
| `twin/sprites/*.webp`, `manifest.json` | Character | Built from the official ChatGPT-pet v2 sheet (1536×2288, 192×208 cells) by `tools/build_twin_sprites.py <sheet>`. A new sheet can be dropped in by re-running the tool. `running-right` is mirrored from `running-left`. |
| `twin/engine.js` | Engine | Local deterministic answers (`SHKTwinEngine`). Pipeline: normalise, Hinglish/synonym map, typo-tolerant tokens, intent rules, BM25 over facts and aliases, context resolution, templated grounded answers. Every sentence comes from a KB fact; output is text segments rendered with textContent only. |
| `twin/knowledge.json` | Knowledge | 158 facts, 55 entities, 57 evidence targets, 12 refusals, 5 starters. Built and checked by `tools/build_twin_kb.py` (`--check` compares the KB against index.html and fails on drift, broken targets, or phone-number patterns). |
| `index.html` | Lead | `window.SHKSite.go` hooks in the work-index, certificate-reel and toolkit modules; the `twin/tw-boot.js` script tag; the "Ask my AI guide" button. |

**Animation plan (Nov 2026, decided with the owner)**
- **Energy:** calm idle (breathing, blinking, a glance every 11–16 s while docked) with energetic reactions only on events. Nothing random.
- **Listening and attention:** the pet looks toward the input while the visitor types and settles after a pause. It looks up on dock hover or focus, and waves when the chat opens.
- **Evidence Scan** runs only for a confident answer (`kind:'answer'`, mood `review`, an internal target):
  1. The thinking pose (`working`, ≥520 ms).
  2. The compact **evidence card**: a mini poster icon for projects (hexagon otherwise), the category (Project / Certificate / Skill / Experience / Education / Leadership / About), the title, one verified proof sentence and an action button (Explore Project / View Certificate / See in Toolkit / …).
     - The proof is a different, preferably numeric, knowledge-base fact about the same entity than the one the answer already states.
     - Repo links and tool lists stay as chips.
  3. An "Aha! Found something." bubble (variants include the Hinglish "Arre, found something!").
  4. About 0.9 s later, the automatic tour:
     - a kale **Evidence scan** line sweeps across the page toward the section;
     - `SHKSite.go` moves the page once (instant for long distances);
     - the spotlight appears;
     - the pet **walks along the bottom edge** toward the evidence. On desktop it walks up to 620 px across the page, passing in front of the open chat. On phones a slim paper strip slides up from the bottom and the small pet walks inside it, with its bubble beside it, so it never covers page text;
     - it looks at the evidence and says "Here's the proof." (the first project of the visit gets a jump and "Now we're talking!");
     - after 2.6 s it walks home.
- **Visitor control:** a wheel, touch or keyboard scroll, or a new question, ends the tour at once; the pet goes straight home and the page is never moved again.
- **Chat during a tour:** desktop keeps the chat open unless it would cover the evidence; phones minimise the sheet (one tap restores it). A manual Explore click during an automatic tour takes it over and moves focus to the evidence.
- **Unknown or unverifiable:** a thoughtful head tilt, then the waiting pose, with "Umm… that's outside my territory." The sad `failed` row is no longer shown.
- **Other lines:**
  - "Bro, one mission at a time!" when asking while it's busy;
  - "Mission accomplished!" with a jump on Copy email (at most once per 30 s);
  - a rare "Oh sh*t, here we go again." on a complex question (long, or several questions or topics; at most once per visit);
  - "Look who's back!" with a wave for a returning visitor.
- **Speech bubble** (`.tw-say`):
  - decorative (`aria-hidden`), placed beside wherever the pet stands, two frames after layout changes;
  - lines queue, and each shows for at least 1.6 s;
  - with the desktop chat open, it stays in the free column to the right of the panel;
  - on phones it sits inside the strip.
- **Spotlight:** anchor sections highlight their key card (not the whole section), clamped below the real header. `SHKSite.go` lands targets 16 px under the header as it looks after scrolling, measured from layout so reveal animations can't shift it.
- **Storage:** the only thing kept across visits is ONE localStorage flag, `tw:visited = "1"`, for "Look who's back!". There is no chat, date or ID, it's never sent anywhere, and the chat footer says so. Everything else stays in `sessionStorage`.
- **Reduced motion:** still poses only, no scan, no walking, instant moves; bubbles and the card appear without animation.

**Rules the guide follows**
- It speaks as the guide, about "Javed" in the third person. It never claims to be Javed, the ChatGPT pet, or human.
- The site is canonical. Resume-only facts are kept only when not contradicted, and are phrased "his resume also notes…". Raw resume text is never indexed, because it contains the phone number.
- It politely declines unknown and personal questions (salary, phone, notice period, relocation, languages, …) and points to email.
- Engine moods: `review` for answers; `failed` for "can't verify" (the UI shows it as the thoughtful tilt + `waiting`); `idle` for polite refusals; `waiting` for clarification.

**Tests**
- `node --test tests/twin/engine.test.mjs` runs hard gates (traceability, identity, evidence resolution, refusals, answerable follow-ups, no phone pattern, determinism, mood mapping) and score targets (intent, top-3 fact, Hinglish, typos, p95 latency) on `tests/twin/eval.json` (91 items).
- `python3 tools/build_twin_kb.py --check` checks the KB against the site.
- `tests/twin/mascot.mjs` is the browser suite for the animation plan (34 checks: welcome, listening, attention, ambient, thinking → review, thoughtful unknown, card, scan, tour out and back, manual-scroll respect, busy line, email delight, return visitor, mobile look angles, reduced motion).
- `tests/twin/e2e.mjs` is the browser suite (Playwright; usage in its header). It is read-only and covers budgets, entrance, real typed conversation, evidence navigation, persistence, privacy, axe, keyboard, reduced motion, layout sweeps at 1440/1024/390/320/390×667, the dialog and menu layering, and errors.
- Verified results (2026-10-26):
  - engine tests: 16/16; all eval scores 100% on 91 items plus generated typos; p95 under 1 ms
  - KB check: 0 errors, 0 warnings
  - e2e: 95 passed, 2 failed. The 2 failures are the uncompressed byte totals on the local server (124.2 KB and 425.8 KB). The gzip estimates pass (entrance 89.4 KB ≤ 100; panel open 281.4 KB ≤ 350), and GitHub Pages serves gzip (`content-encoding: gzip` verified).
  - regression probe against the pre-integration baseline: identical, except the mobile Contact height (+1 button); 0 console errors and 0 4xx.
- Known cosmetic issue: on the full click path under reduced motion, "Show me" can settle in two instant steps about 20 ms apart while the destination's lazy images load. Direct `SHKSite.go` calls make a single jump.

**Maintenance**
- After editing site content, run `python3 tools/build_twin_kb.py` (then `--check`) and the engine tests.
- Keep the `.work-row` and `.cert` order, the toolkit symbols, and the section ids stable; the evidence targets depend on them.

**Gemini phrasing (Nov 2026, owner's decision: Cloudflare Worker proxy)**
- **Hybrid:** the local engine always answers first. Gemini is called **only** when the local result is a verified answer (`kind:'answer'`) whose facts contain no URL or email. Refusals, unknowns, greetings, clarifications and repo/contact answers never leave the page.
- **Request path:** the browser sends `{ v:1, q, factIds }` (the question plus up to 6 ids of the facts the local engine used, never fact text, no cookies) to the worker at the URL in `index.html` (`data-tw-endpoint` on the `twin/tw-boot.js` script tag).
  - The worker (`worker/`, Cloudflare Workers Free) holds the key as a Cloudflare secret.
  - It loads the fact text itself from the live `twin/knowledge.json` and asks Gemini (`gemini-3.5-flash-lite`, Interactions API, `store:false`) to reword only those facts.
  - It validates the reply.
  - It also enforces an origin allow-list (`https://shk-javed.github.io`), per-IP and daily limits, and never logs questions.
- **What Gemini changes:** only the answer **text**. The evidence card (word-for-word proof line), chips, follow-ups, auto-tour and moods stay local.
- **Timing (local first):** Gemini gets a 1.5 s head start. After that the local answer shows. A later vetted reply (up to 10 s; the worker's own budget is `TIMEOUT_MS`, 9 s) fades in over only the answer text, with a small "Phrased by Gemini" label, while that answer is still the latest. Measured in Nov 2026: Flash-Lite on the free tier took 1.5–9 s, with some 503s; `gemini-3.5-flash` returned 503 (overloaded).
- **Checks (worker and browser):** any of these falls back to the local answer, silently:
  - an empty reply or one over 600 characters;
  - uncited or unsent ids;
  - a number or date not in the facts;
  - a URL, an email, or a phone pattern;
  - a first-person claim to be Javed, or to be human;
  - markdown;
  - a 10 s timeout, a quota or upstream error, or a blocked origin.
- **Live:** `data-tw-endpoint="https://shk-javed-twin.shaikhjaved.workers.dev"`. Setting it to `""` makes the guide fully local again. The local test suites blank or stub it, so no test reaches the real worker.
- **Privacy:** with an endpoint, the footer reads *"Answers use only this site's verified facts. To phrase replies, your question is sent to Google Gemini — don't share personal info."* A **Local mode** switch (session only) keeps everything on the page.
- **Cost:** ₹0. Cloudflare Workers Free allows 100,000 requests a day and stops at the cap. Google AI Studio with billing **off** makes the free quota the hard cap. Setup and the off switch are in `worker/README.md`.
- **Tests:**
  - `node worker/test.mjs`: 31 offline checks with a mocked Gemini;
  - `tests/twin/remote.mjs`: 29 browser checks with a mocked worker.

## Known Issues

- `shaikh_javed_DA.pdf` is a duplicate of `Shaikh_Javed_Data_Analyst.pdf`. It is kept because older shared links may point to it.

## Maintenance Notes

- Treat `index.html` as a coupled single-file application: markup, styles, and behavior are intentionally co-located.
- Preserve existing root-level asset names and external project links when changing content.
- Validate the inline script and local asset references after edits.
- Repository cleanup (Oct 2026): removed 13 unused assets (~20 MB): the old project posters `aadhar.png`, `comcast.png`, `flight.png`, `spotify2023.png` and `financial.png`; the old portraits `javed222.jpeg`, `javed52.jpeg` and `JAVED.png`; the old icons `business.png`, `calculating.png`, `github1.png` and `insta1.png`; and `cert-3.png`. Also stopped tracking `.DS_Store`. `logo.png` was shrunk from 2048×2048 (9.2 MB) to 160×160 (66 KB). `favicon.ico` was renamed from a filename with a trailing space, and its link no longer needs `%20`. `shaikh_javed_DA.pdf` (a duplicate of the resume) is kept on purpose because older shared links may point to it. A code audit found no unused CSS classes or keyframes in `index.html`.
