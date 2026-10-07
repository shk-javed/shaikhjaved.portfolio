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
- `logo.png` — header brand mark
- `javed222.jpeg` — about profile image
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

### Final production composition rebuild

- Rebuilt `index.html` around one shared 12-column master grid with a deliberate eight-chapter narrative: hero, identity, journey, education, leadership, work, credentials, toolkit, and contact.
- Replaced the incomplete one-card journey with independently visible current role, previous internship, and academic milestone entries, using only the verified project/profile timeline available in the workspace.
- Reframed projects as four product-story presentations instead of a dense bento card wall, while preserving existing project assets and adding only source-backed details.
- Added an accessible mobile navigation overlay, responsive tablet rules, intrinsic image dimensions, and a reduced motion mode that disables canvas movement and complex transforms.
- Kept the established palette and `#D7DDBA` accent unchanged. No new framework or build system was introduced.
- Production checks completed: JavaScript syntax, HTML parser structure, image intrinsic dimensions, palette lock, required section landmarks, and `git diff --check`.

### Step 4 — About / Identity redesign

- Replaced the placeholder about section with a two-column editorial identity story.
- Preserved the project palette and used only existing design tokens: black, deep green, teal, white, pale green, and the Golden Kale accent `#D7DDBA`.
- Kept the content grounded in current portfolio facts: Data Analytics, Data Science, Python, SQL, Power BI, automation, and Google Apps Script as a workflow support tool.
- Added subtle scroll parallax and reveal motion only within the about/identity block to avoid affecting the hero or other sections.
- Used the existing profile image asset `javed222.jpeg` with a fixed aspect ratio to prevent CLS.
- Replaced the leadership placeholder with two asymmetric liquid-glass storytelling cards for Team Code_Runners at GDG Cloud Hackathon 2.0 and the Google Student Ambassador role.
- Added leadership-only mouse spotlight tracking with CSS custom properties and `requestAnimationFrame`, while preserving sequential reveal behavior and reduced-motion support.
- Replaced the projects placeholder with a responsive 12-column bento gallery using existing assets and conservative, source-grounded project descriptions.
- Added fixed-ratio project visuals, product-style hover treatments, and project-only pointer spotlight tracking with CSS custom properties and `requestAnimationFrame`.
- Refined the project interaction system without changing the bento geometry: cached pointer bounds, restrained CSS-variable depth, content translation, image zoom, border illumination, and keyboard focus parity.
- Added reduced-motion fallbacks so project transforms and image movement resolve to static states when requested.
- Replaced the certificates placeholder with a responsive asymmetric gallery using the exact existing certificate assets: GitHub Copilot, Great Learning, IBM, Power BI, and Google.
- Added fixed-ratio certificate visuals, asset-supported captions, keyboard-accessible viewing links, and a restrained Golden Kale `#D7DDBA` border/glow treatment with reduced-motion support.
- Replaced the skills placeholder with a two-column editorial technology ecosystem covering Data Analytics, Data Science, Python, SQL, Power BI, Google Apps Script, and automation.
- Added progressively revealed, keyboard-accessible technology clusters with subtle glass surfaces, monochrome labels, restrained focus/hover movement, and reduced-motion support.
- Replaced the Contact placeholder with a spacious closing statement and one primary magnetic `View Resume` action using the existing resume asset.
- Simplified the Footer to preserve only existing identity, copyright, resume access, and closing portfolio language; no email, phone, or social details were invented.
- Completed final production QA: preserved the locked palette, added intrinsic dimensions to all images, batched scroll work through `requestAnimationFrame`, reduced mobile canvas density, guarded zero-distance pointer math, and tied hero animation to both viewport and document visibility.
- Final static audit passes HTML parser validation, JavaScript syntax validation, whitespace validation, section landmark checks, focus/reduced-motion checks, and palette verification.
- Final art-direction pass completed against rendered desktop and mobile views: reduced desktop hero scale so the full opening hierarchy and CTAs compose in one viewport, tightened the mobile toolkit-to-contact handoff, added restrained project-story content lift, and fixed mobile menu toggle stacking so the overlay can always be closed.
- Rendered checks covered 320px, 390px, 768px, 1024px, 1280px, 1440px, and 1920px compositions; no horizontal overflow or console errors were observed.
- Step 16 global layout normalization completed: replaced the universal section padding with standard, compact, and story density tiers; brought timeline and leadership content onto the master visual rail; normalized shared card radius and shadow treatment; added subtle current-role emphasis; and reduced hero/mobile spacing compression without changing project storytelling or media behavior.
- Step 16 validation completed at 320px, 390px, 768px, 1024px, 1280px, 1440px, and 1920px. No horizontal overflow or HTML diagnostics were observed; rendered hero, experience, and project checkpoints were inspected after the change.
- Step 17 Projects storytelling completed: project rows now use one consistent editorial scene system with a centered text rail, dominant 16:10 media frame, secondary metadata treatment, controlled mobile order, and a Projects-only rAF active-scene emphasis. Project 02 uses palette-backed `contain` treatment to preserve its square dashboard source without stretching or destructive cropping.
- Step 17 rendered QA passed at 320px, 390px, 768px, 1024px, 1280px, 1440px, and 1920px with four project scenes, no horizontal overflow, preserved project content/order/CTAs, and reduced-motion transitions disabled. No other page section was intentionally changed in this step.
- Step 17.6 Projects pacing completed: reduced desktop scene padding and changed the cinematic media ratio to 16:9; added visible current-scene emphasis with quieter inactive media/content; made the media cap responsive up to 1280px at wide desktop; tightened Project 01 focal positioning, reduced Project 02 containment padding, and reduced the Projects-to-Certificates boundary gap.
- Step 17.6 validation: at 1440px scenes are approximately 1115px and Projects is approximately 4929px, compared with the previous 1355px scenes and 5964px section. At 1280px scenes are approximately 994px; at 1024px approximately 891px; at 390px scenes are approximately 605-630px. Active states resolve one-at-a-time, inactive media uses restrained opacity/scale, reduced-motion resets all project transforms, and all tested viewports remain free of horizontal overflow.
- Step 17.8 Projects finalization — root cause: the Step 17.6 emphasis was split across two competing layers. The article-level `opacity:.78` only reached Project 03, because Project 01 was pinned to `1` by `.project-story:first-of-type` and Projects 02/04 were overridden by the more specific `.reveal.is-visible`. Inactive media therefore rendered at `.82` for P1/P2/P4 and `.64` for P3: too weak, and inconsistent between scenes. The article layer is removed; all emphasis now lives in one selector family (`.project-story.is-visible:not(.is-current)`), so the four scenes behave identically and the reveal fade/rise applies to all of them.
- Step 17.8 active-scene algorithm: the current scene is the story containing a focus line at the centre of the area visible below the fixed header. The previous line sat at 52% of the full viewport, ignored the ~82–90px header, and switched 18–47px late depending on scene height. A 3% deadband around each boundary prevents flicker. Classes are written only when the index changes, layout reads happen before writes in the shared rAF pass, `main section[id]` is cached, and `resize` now schedules the same pass so state no longer goes stale after a resize or rotation.
- Step 17.8 visual hierarchy: inactive media `opacity:.55`, `scale(.97)`, `saturate(.6)`; inactive content `opacity:.85` with `translateY(8px)`; inactive titles `.6` (≈.51 effective). Small text stays at or above 4.5:1 and titles at or above 3:1. Transitions use `--slow`, and the same values apply at every breakpoint (the softer mobile override was removed). The hover zoom on project images and a dead hover-lift rule were removed: scenes span the full width, so the zoom fired on pointer position rather than intent and implied a click target that does not exist.
- Step 17.8 Project 02 asset: `business.png` is a 512×512 LinkedIn outline icon, not a dashboard. The committed version of this project (2,000+ customer complaints, SQL / Power BI) used `comcast.png`, so Project 02 now uses that asset with an accurate alt. Title, description, facts, and links are unchanged. The artwork is 73 source rows taller than a 16:9 window, so any crop would cut its title or bottom labels; it therefore stays `contain`ed, on a matte matched to the artwork's own paper (`#fdf7f0`) because the kale tint produced visible cool/warm pillarbox seams.
- Step 17.8 framing and closing: Project 01 `object-position` moved from 62% to 53% so the source's white mat is equal above and below its artwork band (rows 184–850 of 1024). Project 04 moved from 50% to 40% so its title clears the frame edge. Media now centres with `align-self:center`: above 1480px the media is wider than the 1200px rail, where `margin-inline:auto` collapsed to zero and pushed it up to 40px right of centre. The last story closes with a firmer `rgba(0,77,64,.28)` rule (the existing current-role border value) so the series reads as finished before Certificates; spacing is unchanged. The project title cap moved from 6.5rem to 6.25rem (binding only above ~1667px), so "Spotify 2023 Music Dashboard" no longer breaks onto three lines at 1920px.
- Step 17.8 validation (Playwright/Chromium at 320, 390, 768, 1024, 1280, 1440, and 1920px): exactly one current scene at the beginning, middle, and lower portion of every scene in both scroll directions; every boundary flips once per direction in 1px sweeps; fast jumps and native smooth scrolling progress 1→2→3→4; 0 console errors and 0 horizontal overflow. CLS is unchanged from baseline (≤0.038, originating outside Projects), and wheel-scrolling through Projects produced no long animation frames. Reduced motion renders every scene at full opacity with no transforms or filters. Non-Projects sections are pixel-identical apart from the 1px offset introduced by the closing rule, and html-validate reports the same 8 pre-existing diagnostics as before. Measurements: scenes 1115px at 1440 (Projects 4932px), 995px at 1280, 891px at 1024, 605–630px at 390; Projects at 1920 fell from 5515px to 5394px.
- Observed during Step 17.8 but out of scope: the site-wide `:focus-visible` outline uses `--kale`, which is about 1.35:1 against white sections; and after the Contact CTA the nav highlights Toolkit, because Contact cannot reach the 180px detection line.
- About (Oct 2026): the headline (3 lines on desktop) and intro copy share one row, `about-gdg-stage.jpg` (GDG MAD and Cloud Mumbai stage, 2171×724) sits below as a full-width strip (7:2, capped at 36svh; 13:5 right-anchored on phones), and a Now / Before / Foundation ledger closes the section. Motion is limited to two beats: the shared heading reveal and a horizontal mask wipe on the photo. The section fits one screen at 1024–1920. `javed222.jpeg` is no longer referenced. On phones the hero text now uses the full width (an older rule had held it to 7 of 12 columns).
- Experience (Oct 2026): titled "From analysis to automation." with two timeline entries. American Hairline (current role, LinkedIn wording) comes first; MAK { Byte } is grouped as one company card holding the Data Analyst role (with +25% / +30% / −22% / −20% metric tiles from the resume) and the internship. The B.Sc. entry was removed because Education covers it. Motion is the shared heading reveal plus the scroll-linked timeline line and node highlight; cards no longer animate in. Height at 1440 went from 1864px to 1394px.
- Hero project signatures (Oct 2026): every project in the film has its own motion. Airline: the plane. Aadhaar: an OCR scan beam sweeps the card, and a padlock shackle snaps shut on the MASKED stamp. Trading: a terminal crosshair with a pulsing live dot, a ▲ FORECAST tag and T+3. Spotify: a spinning vinyl with a play bar synced to the waveform playhead. Hospital ER: an ECG heartbeat sweeps across the heatmap. Apps Script: a cursor clicks each sheet row just before its onEdit packet fires. The Measure morphs now take 1.2% of progress each (previously 2.5%), giving every dashboard a short hold for its signature. Time-based loops are frozen under reduced motion.
- Education (Oct 2026): the heading plus one supporting line on the left; on the right a card with the degree, university and dates, an SVG ring for the final graduation CGPA (7.60 / 10, given by the user in Oct 2026, drawn as 76% with `pathLength=100`) and a three-segment Year 1–3 track. Motion is the shared heading reveal plus the ring filling once when the card is revealed; the older rule and line-clip reveals were removed. The section fits one screen from 390 to 1440.
- Leadership (Oct 2026): now a dark `--ink` section, giving rhythm between the white Education and Projects. A bento grid has the Maayura hackathon feature card with an animated mini map: the route draws, a heart pin drops and ripples (Google Maps API), a 24h ring fills (24-hour sprint) and team avatars pop in (team of 3, led). Three icon cards follow: DevFest showcase (stage spotlight sweep), Google Student Ambassador (broadcast rings) and OSCG '26 (a git branch that draws and merges). Reveal animations are one-shot; the loops (ripple, spotlight, rings, merge pulse) run only when motion is allowed. Added later: an SMIL navigation dot with a short trail that loops along the Maayura route (shown once the card is revealed), an orbiting tick on the 24h ring, a slow ambient aurora behind the section, icon and tag pop-ins, and a cursor-tracking glow with a gentle 3D tilt for fine pointers (2.5° on the feature card, 6° on small cards). Under reduced motion the dot and tick are hidden and the loops stop. The old story-panel CSS was removed. Layout: 2 columns above 1100px, a full-width feature plus 3 columns from 801–1100px, and a single column on phones.
- Projects / Work (Oct 2026, final): an editorial index. A quiet list of five rows (index, kicker with stack, title, one line, arrow), each linking to its GitHub repo, sits beside one sticky 5:4 poster. Each poster carries a single real figure on its own palette colour and its own signature motion, chosen not to repeat the Hero film: Aadhaar `XXXX XXXX 1956` (ink) with fingerprint ridges that draw in and breathe; MIS 76.75% of 2,224 complaints resolved (kale) with 100 squares (each about 22 complaints) of which 77 resolve column by column; Airline 9,651 flights across 12 airlines (deep) as a split-flap departure board whose tiles flip in; Hospital ER 36.67 min average wait, February view, 9,216 records (matte) with a stopwatch hand that sweeps to 36.67 while the minute ticks light, plus a ticking second hand; Spotify 478B streams across 932 tracks (teal) with an equalizer that grows in and keeps a beat. Each poster also wipes in from its own direction (left, bottom, right, top, and a circle for Spotify). Motion: row hairlines draw in on reveal; hover or focus sweeps a band, slides the title and fills the arrow, and the poster wipes in over the previous one (`is-active` / `was-active`). A poster plays only while it is on show and in view (`is-play`, set by an IntersectionObserver); leaving resets it (`is-reset`) so it plays from the start next time, and phones play each inline poster as it scrolls in. Posters switch only with a fine pointer at 1024px and wider. On touch and narrow screens every poster shows inline (10:7) above its row. Reduced motion switches instantly and shows each poster's finished state. Height at 1440 is about 1,290px. The old `.project-story` CSS/JS and the dashboard-card version were removed. The Hero film's ER figure reads 9,216 (the repo CSV row count), not 10,000+.
- Certificates (Oct 2026): a pinned horizontal reel (`.cert-reel`, 520svh; the sticky stage is 100svh). Scroll maps onto stops: each certificate enters from the right, holds in the centre, then leaves to the left. Order is oldest first: Google Analytics (Great Learning, Jul 2024), Power BI Workshop (Office Master, Sep 2025), Data Analytics on Google Cloud (Nov 2025), Build and Grow AI Hackathon 2.0 (GDG Cloud Mumbai, Jan 2026; newly added, `Sahikh_javed.png`), Python for Data Science (IBM, Mar 2026) and GitHub Copilot Dev Days Mumbai (Mar 2026). Each frame is themed to its certificate: Great Learning corner brackets, a gold double rule with an "UNDER 30 MIN" seal, Google-colour corner ticks, a Mumbai skyline (Gateway and Sea Link) under a gradient hairline, IBM stripes, and a purple-to-green gradient border. A centred certificate (`is-on`) draws its frame, turns from grey to colour and plays its own hand-made SVG scene. The scenes are: visitors bounce off a funnel while one stays; bars build before the chai cools; a sleepy cloud rains digits into a table; Code_Runners run through the night, stack chai and flop asleep; a python and a panda clear NaN rows; and Tab gets pressed, sunglasses drop, then a review. Each scene is paired with a funny line and a true, serious line. A scene resets once its slide is fully off screen, so it replays. A rising learning curve with 6 dated nodes and a 01/06 counter tracks progress. Clicking a frame opens the original image in a `<dialog>`, with a Verify link for Great Learning and IBM (Credly). Focusing a certificate scrolls the reel to centre it. The reel shows web JPEGs (`cert-ga/pbi/gc/gdg/ibm/gh.jpg`; the Google one is cropped to the badge), while the viewer uses the original PNGs. Without JS or with reduced motion the section is a plain list in final poses. The old `.certificate` gallery CSS was removed. `cert-3.png` (a Google Skills profile screenshot) is intentionally unused. The GDG certificate itself prints the name as "Sahikh javed".
- Toolkit / Skills (Oct 2026): "The elements of clean data." A periodic table of 26 real tools in workflow order, grouped Prepare → Analyse → Visualise → Automate → Build → Deliver, each group with a muted colour. Tools are taken from the resume skills, the current role and the project stacks. Picking an element (hover with a fine pointer, focus, or tap) fills the element card (number, symbol, what it is for, where it was used) and draws curved bonds to the tools it was used with in one project or role, a "molecule". The molecules are Aadhaar Masking Tool, Customer Service MIS, Domestic Airline KPI, Hospital ER, Spotify 2023, MAK { Byte }, American Hairline and this portfolio. Chips in the card switch molecules, and the formula line spells the molecule out (for example `Aadhaar Masking Tool: Py + Dj + Cv + Oc + Rx`). Plain contexts with no molecule are shown as dashed chips (IBM, Copilot Dev Days, Maayura, Tableau working knowledge, GitHub). Motion: tiles wave in diagonally on reveal, bonds draw outward, partner tiles pop and the card symbol swaps. Until someone interacts, the table cycles As → Pb → Py → Ex → Dx → Sq every 3.8s while in view; any hover, focus or tap stops it for good and turns the card's `aria-live` to polite. Selected and bonded tiles sit above the bond layer, so lines only show in the gaps. On phones, tiles show the symbol only. Reduced motion selects Apps Script with static bonds. The old four `.skill-cluster` cards and their CSS were removed.
- Contact and Footer (Oct 2026): the closing chapter. Contact keeps the headline "Let the next idea begin." and makes the email (shkjaved41@gmail.com) the hero. Its letters roll to kale on hover or focus (`.roll`, aria-hidden, with the link carrying an aria-label). A Copy email button uses the Clipboard API and shows "Copied" in a polite live region; if the clipboard fails it falls back to mailto. A facts row shows Based in Mumbai, a live IST clock (Intl, updated every 10s, with the minute ticking in) with a light mood line (probably asleep / morning chai / deep in spreadsheets / winding down), and the current role. The resume button now reads Download Resume, because it downloads. The mail row's hairline draws in, then the facts and buttons cascade. Footer: "Shaikh Javed" as a full-width kale wordmark sized per breakpoint (container width / 6.12). Its letters rise one by one as the footer scrolls fully into view, through `--farrive`, which the shared scroll pass writes on the footer. Below it are © 2026, the line "End of file. Thanks for scrolling all the way down.", the links and Back to top. Contact is the one exception to the full-screen section rule (`.section.contact{min-height:0}`): centring it in 100svh left large empty bands above the content and before the footer, so contact and footer now share the final screen. The phone number is still deliberately not published.
- Current role (from LinkedIn, Oct 2026): Automation Analyst / Google Apps Script Developer at American Hairline since Aug 2026 (the job title is written this way everywhere; on phones the hero chip shortens it to "Automation Analyst"). MAK { Byte } Data Analyst dates follow LinkedIn: Jan 2026 – Aug 2026. The hero film's Automate chapter shows this role (Google Sheets → Apps Script → MIS report, dashboard, web app). Every section except the Hero and Projects has `min-height:100svh`, with content centred vertically.
- Content source (Oct 2026): portfolio text follows the latest resume (`portfolio-resume2.pdf`: Data Analyst at MAK { Byte } from Feb 2026, intern Aug 2025 – Jan 2026, B.Sc. Data Science Jul 2023 – Apr 2026). Hospital ER (10,000+ records) and certificate dates come from the earlier resume. `Shaikh_Javed_Data_Analyst.pdf` and `shaikh_javed_DA.pdf` are now the real resume. The phone number is intentionally not published; email, LinkedIn and GitHub are.
- Hero film chapters: records validate, then fold into a plane that lands on "Analytics"; Protect (Aadhaar masking); Measure (one chart: airline fares → trading forecast → Spotify streams → Hospital ER load); Automate (service records → Power Query → Power BI, −22% manual reporting effort); Connect (five panels, a solar-system orbit and convergence); name card. Object handoffs link the chapters (digits become bars, heatmap cells become sheet rows, the MIS donut becomes the insight ring). An idle hook drips records from the headline, and the ending sends a packet into View Work.
- Step 18.5 motion system: one motion owner per property. Chapter content uses `.beat` one-shot reveals (opacity, individual `translate`/`scale`, `clip-path`); items revealed in the same frame stagger in document order via `--stagger`, and `--tempo` shortens beats during fast scrolls. Hover and press keep `transform`, which repaired the dead certificate hover lift and skill-grid offsets. The shared rAF pass drives the Experience timeline progress (`--tl`, reached/active markers) and the Contact arrival (`--arrive`). Projects keeps its own `.reveal` and `.is-current` system unchanged. Focusing a control inside an unrevealed chapter reveals it immediately; hover states are pointer-only; reduced motion uses opacity-only crossfades.
- Hero font stability: the entrance waits for the web fonts (capped at 1.2s), the headline cap is expressed in `em`, and a width-matched `Inter Fallback` (local Arial, size-adjust 106.6% / 102.3%) keeps a late font swap from reflowing the page. Hero CLS measured 0 on normal and font-delayed loads.
- Hero film (380svh sticky stage, 320svh at 800px and below): a ~20s identity film scrubbed by native scroll. The shared scroll pass sets `heroTarget`; one hero rAF loop eases toward it (weighted camera) and derives everything from that single progress value. The title card is driven by `--tx/--ty/--ts/--ta/--tb`, the copy and CTAs by `--la/--ly`, and the grid by `--g*`. The canvas projects far/mid/near layers through the same camera (push-in plus a restrained pan). Scenes: identity (0–15%), awakening (15–30%: data streams emerge from the ends of the four headline words), data movement (30–50%: Golden Kale packets with trails travel real connections; arrivals light the node, flash the connection, pulse a ring and wake neighbours), automation (50–70%: the network snaps into lanes with process frames and rhythmic, evenly paced packets), convergence (70–88%: three orbits around a restrained insight point, packets route into it), resolution (88–100%: no new packets, orbits settle, the title card and CTAs return as the end card, and a kale rule draws along the bottom edge before About). The header stays transparent while the film is pinned. Desktop has 33 nodes and up to 4 packets; phone has 11 nodes, up to 2 packets and vertical orbits, in the lower-right column beside the deliberately narrow text rail. Short phones (≤720px tall) get a compact title card so the stage fits the viewport. Focusing a CTA restores the copy at any point. Reduced motion removes the pinned travel and draws one organised frame with a single lit signal path. Layout is read only on resize/fonts/intro, and the loop runs only while the hero is visible.
- Asset note: `javed222.jpeg` was restored to the committed 3120×4160 portrait after it had been replaced by a 1400×349 banner. Both resume PDFs (`Shaikh_Javed_Data_Analyst.pdf`, the link target, and `shaikh_javed_DA.pdf`) are currently 1-page plain-text placeholders; the real 2-page resume exists only in git HEAD (`shaikh_javed_DA.pdf`).


## Architecture

- `index.html` contains semantic HTML, all CSS, and all JavaScript.
- The design uses the existing teal, deep green, cyan, green, white, pale green, and Golden Kale (`#D7DDBA`) palette.
- Inter and JetBrains Mono load from Google Fonts; Font Awesome, GSAP, and ScrollTrigger load from CDNs.
- GSAP and ScrollTrigger enhance reveal animations when available. CSS states remain usable if the CDN is unavailable or reduced motion is enabled.
- No API, database, authentication, environment variables, or server routes are present.

## Features

- Fixed navigation with in-page anchors, scroll state, rotating role text, magnetic buttons, and a scroll-to-top control.
- Full-viewport canvas node/vector background using `requestAnimationFrame`, capped device-pixel ratio, and pointer proximity.
- Profile section with social links and resume download link reserved for `Shaikh_Javed_Data_Analyst.pdf`.
- Skills section covering Python, SQL, Power BI, Excel, machine learning, analytics, OpenCV, OCR, and Google Cloud.
- Responsive bento project grid with Machine Learning and Analytics filters, pointer spotlight, and GitHub links.
- Certificate gallery with Golden Kale hover glow and keyboard-accessible previous/next modal navigation.
- Journey cards for MAK { Byte }, Mumbai University, Team Code_Runners, and Google Student Ambassador work.
- Contact form with required fields and local success feedback.

## Main UI Surfaces

- `#siteNav`, `.nav-links`, and `#scrollTop`: fixed navigation and scroll state.
- `#home`, `.hero`, `.button`, and `#dataCanvas`: hero content, calls to action, and canvas background.
- `#about`, `.about-layout`, and `.metrics`: profile, photo, links, and summary figures.
- `#skills`, `.skill-list`: toolkit presentation.
- `#journey`, `.journey-grid`, and `.liquid-card`: experience, education, leadership, and community cards.
- `#projects`, `.filter`, and `.project-card`: filtered project gallery.
- `#certificates`, `.cert-card`, and `#certModal`: certificate gallery and viewer.
- `#contact`, `#contactForm`, and `#formStatus`: contact form and local feedback.

## Data Flow

- Portfolio content, project metadata, contact details, and journey entries are static HTML.
- Project filter buttons toggle cards using each card's `data-category`.
- Certificate clicks open the modal; buttons and arrow keys cycle images with wraparound.
- Canvas nodes and connecting vectors animate continuously and respond to pointer proximity.
- The contact handler prevents the configured Formspree request, shows local feedback, and resets the form.

## Dependencies

- Google Fonts: Inter and JetBrains Mono.
- Font Awesome 6.5.1 CDN.
- GSAP 3.12.5 and ScrollTrigger CDN.
- Browser-native DOM events, CSS Grid/Flexbox, Canvas, `requestAnimationFrame`, keyboard events, and media queries.

## Known Issues

- Resume PDF is restored at the root as `Shaikh_Javed_Data_Analyst.pdf`, and the legacy `shaikh_javed_DA.pdf` copy is retained for compatibility.
- The contact form remains local feedback because the inline handler prevents the Formspree request. Remove `preventDefault()` and define the production submission UX before enabling submissions.
- External fonts, Font Awesome, GSAP, and ScrollTrigger require network access. The page remains readable and interactive without GSAP through the CSS fallback.

## Maintenance Notes

- Treat `index.html` as a coupled single-file application: markup, styles, and behavior are intentionally co-located.
- Preserve existing root-level asset names and external project links when changing content.
- Validate the inline script and local asset references after edits.
