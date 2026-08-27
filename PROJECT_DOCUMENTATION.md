# Project Documentation

## Overview

This repository is a static, single-page personal portfolio for Shaikh Javed. The complete site is implemented in `index.html`; images, the favicon, and the downloadable resume are root-level assets. There is no build system, server-side application, database, or package manifest in the repository.

`README.md` remains the public GitHub-facing introduction. This file is the code-backed working context for maintainers and AI coding agents.

## Architecture

- `index.html` contains the page markup, all CSS, and all JavaScript.
- Root-level image files supply profile photos, project thumbnails, logos, and certificate images.
- The browser loads Google Fonts, Font Awesome, skill icons from jsDelivr, and several skill-logo images from Wikimedia URLs.
- The contact form is configured with a Formspree `action`; its current JavaScript submit handler prevents the native submission and shows a local success message instead.
- No API, database, authentication, environment variables, or server routes are present. The only page is the root document, with in-page navigation via section anchors.

## Features

- Fixed navigation, a scroll-to-top control, hero section, and rotating role text.
- About section with social links and a resume download link to `shaikh_javed_DA.pdf`.
- Skills universe: 19 skill bubbles positioned in concentric circles and enlarged near the cursor.
- Project gallery with category filters for Machine Learning, Gen AI, and Analytics. Current cards link to external GitHub repositories.
- Certificate grid with hover styling and a click-to-open modal, including previous/next and touch-swipe navigation.
- Experience, education, and achievement timeline cards.
- Contact details and a form with required name, email, and message fields.
- Full-screen canvas background intended to animate data bars, donut charts, and scatter plots.

## Components and UI Patterns

In this static site, components are HTML sections and reusable CSS classes rather than framework components.

- `nav`, `.nav-links`, and `.scroll-top`: fixed navigation and scroll state.
- `#home`, `.hero`, `.btn`: hero content and anchor buttons.
- `#about`, `.about-container`, `.btn-resume-magic`: biography, photo, social links, and resume action.
- `#skills-universe`, `#watchGrid`, `.skill-bubble`: interactive skills display.
- `#projects`, `.filter-btn`, `.project-card`: filtered project gallery.
- `#certificates`, `.cert-card`, `#certModal`: certificate gallery and modal viewer.
- `#journey`, `.timeline-grid`, `.glass-box`, `.liquid-card`, `.stat-badge`: experience and achievement cards.
- `#contact`, `#contactForm`, `#successMessage`: contact form and local feedback message.

## Design System

- Typography: Poppins from Google Fonts with a sans-serif fallback.
- Visual direction: dark teal gradient/canvas hero, white content sections, green/cyan accents, and a pale green journey section.
- Repeated colors include teal (`#006064`, `#004d40`), green (`#00e676`, `#4CAF50`), cyan (`#26c6da`), and pale green (`#BCC88B`).
- Layout uses a centered `.container` capped at 1200px, CSS grid for galleries/timelines, and flexbox for groups and responsive arrangements.
- Cards use rounded corners, soft shadows, hover lift/scale transitions, and semi-transparent glass effects with `backdrop-filter`.
- At `max-width: 768px`, navigation links are hidden, key flex layouts stack, and the skills animation is reduced.

## Data Flow and Business Logic

- Portfolio content, project metadata, contact details, and timeline entries are static HTML.
- `filterProjects(category)` toggles project-card classes and display/opacity styles using each card's `data-category`.
- Certificate clicks copy an image source into the modal; controls and touch gestures update the current image index with wraparound.
- Canvas chart positions and values are generated with `Math.random()` and dimensions are recomputed on resize.
- Scroll events add/remove sticky navigation and reveal the scroll-to-top control.
- The form handler prevents the configured Formspree request, shows a success message for five seconds, and clears the fields.

## Dependencies

- Google Fonts: Poppins.
- Font Awesome 6.5.1 CDN: interface and social icons.
- Remote skill images: jsDelivr Devicon and Wikimedia-hosted logos.
- Browser-native APIs: DOM events, CSS Grid/Flexbox, HTML Canvas, `requestAnimationFrame`, and touch events.

There are no installed npm or other package-managed dependencies.

## Known Issues

- The script begins with a duplicate nested `function resize()` declaration and appears to lack a closing brace for the outer declaration. This prevents the inline JavaScript from parsing, so later interactions may not run.
- The contact form specifies a Formspree endpoint, but the submit handler calls `preventDefault()`, so it currently only shows local feedback.
- Navigation exposes Home, About, Projects, and Contact, but not Skills, Certificates, or Journey anchors.
- A `Gen AI` filter button is present, while no project card currently has `data-category="genai"`.
- Several styles are duplicated or overridden later in the same inline stylesheet, especially certificate and journey rules.

## Tasks

- Fix and manually verify the inline JavaScript parse error before relying on interactive features.
- Decide whether the contact form should submit to Formspree or remain local feedback, then align the handler.
- Add a `genai` project card or remove/disable the empty filter.
- Keep asset filenames synchronized with each `src` or `href` when changing assets.

## AI Project Memory

- Treat `index.html` as a coupled single-file application: markup, styles, and behavior live together.
- Preserve existing root-level assets and external links unless explicitly requested otherwise.
- Make responsive changes in both base CSS and the existing mobile media query when necessary.
- Inspect event handlers and the CSS classes they manipulate before changing client-side behavior.
- Do not add secrets, credentials, or tokens to this static client-side repository.
- Update this document after meaningful architectural, behavioral, dependency, or known-issue changes.
