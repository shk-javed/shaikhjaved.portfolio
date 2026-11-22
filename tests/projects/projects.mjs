/* Project case-study pages (projects/<slug>/), Playwright. Read-only: it never edits product files.
 *   1 generator --check · 2 page integrity (with and without the trailing slash) · 3 pager · 4 home ⇄ case-study navigation ·
 *   5 dashboards · 6 Aadhaar walkthrough · 7 responsive (1440×900, 834×1112, 390×844 + full-page screenshots) ·
 *   8 accessibility basics (+ axe-core from the CDN when reachable) · 9 home rows + index.html diff review · 10 weight.
 * Run from the repo root with the site served on :8813 (python3 -m http.server 8813 --bind 127.0.0.1):
 *   python3 tools/build_projects.py && PLAYWRIGHT_DIR=/path/to/node_modules/playwright QA_DIR=/path/to/screens node tests/projects/projects.mjs
 * Env: PD_URL site root (default http://localhost:8813/) · QA_DIR screenshot folder (default <os tmp>/pd-qa) · PD_ONLY=2,5 runs some items ·
 *      PD_BASE git ref the index.html diff review compares against (default HEAD; use the commit before the case studies once they are committed).
 * A dashboard whose data JSON is not there yet (404) is SKIP, not FAIL. WARN lines are worth a look but don't fail the run.
 * The home page's guide never reaches the live worker: requests to *.workers.dev are aborted. Exit code 1 on any FAIL.
 */
import { spawnSync } from 'node:child_process';
import { readFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import zlib from 'node:zlib';

const { chromium } = await import(process.env.PLAYWRIGHT_DIR ? process.env.PLAYWRIGHT_DIR + '/index.mjs' : 'playwright');
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const BASE = (process.env.PD_URL || 'http://localhost:8813/').replace(/\/?$/, '/');
const ORIGIN = new URL(BASE).origin;
const QA = process.env.QA_DIR || path.join(tmpdir(), 'pd-qa'); mkdirSync(QA, { recursive: true });
const ONLY = process.env.PD_ONLY ? new Set(process.env.PD_ONLY.split(',').map(Number)) : null;
const run = n => !ONLY || ONLY.has(n);
const CONTENT = JSON.parse(readFileSync(path.join(ROOT, 'projects/projects.json'), 'utf8'));
const P = CONTENT.projects.slice().sort((a, b) => a.index - b.index), N = P.length;
const pageUrl = q => `${BASE}projects/${q.slug}/`;
const DATA_PREFIX = new URL('projects/data/', BASE).href;
const BADGE = { live: 'Live', shot: 'Screenshot', sim: 'Simulation', code: 'Code', embed: 'Embed' };
const DESK = { width: 1440, height: 900 };
const VIEWPORTS = [{ width: 1440, height: 900 }, { width: 834, height: 1112, mobile: true }, { width: 390, height: 844, mobile: true }];
const AXE = 'https://cdnjs.cloudflare.com/ajax/libs/axe-core/4.10.2/axe.min.js';
const live = s => !s.pending;
const dashesOf = q => q.sections.filter(s => s.type === 'dashboard' && live(s)).map(s => ({ id: s.id, data: s.data }));
const walkOf = q => q.sections.find(s => s.type === 'walkthrough' && live(s));
const PROJECT_RE = /work-|wp-|view-transition|#projects|\.projects\b|projects\//;

// ---------------------------------------------------------------- reporting
const results = [];
const clip = (s, n = 260) => { s = String(s ?? ''); return s.length > n ? s.slice(0, n) + '…' : s; };
const out = (tag, name, info) => console.log(`${tag}  ${name}${info ? '  ' + info : ''}`);
const check = (name, ok, info = '') => { results.push({ name, st: ok ? 'PASS' : 'FAIL', info }); out(ok ? 'PASS' : 'FAIL', name, ok ? clip(info) : info); return !!ok; };
const skip = (name, info) => { results.push({ name, st: 'SKIP', info }); out('SKIP', name, info); };
const warn = (name, info) => { results.push({ name, st: 'WARN', info }); out('WARN', name, info); };
const note = (name, info) => out('INFO', name, info);
const section = t => console.log(`\n==== ${t}`);

// ---------------------------------------------------------------- browser helpers
const browser = await chromium.launch();
async function context(vp = DESK, extra = {}) {
  const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height }, isMobile: !!vp.mobile, hasTouch: !!vp.mobile, deviceScaleFactor: 1, ...extra });
  await ctx.route(/workers\.dev/, r => r.abort()); // the guide's live proxy is never called from a test
  return ctx;
}
// errors: JS exceptions + console errors (same-origin load failures are reported through `failed`, external ones through `external`)
function track(p) {
  const t = { errors: [], failed: [], pendingData: [], external: [], data: {} };
  p.on('pageerror', e => t.errors.push('pageerror: ' + (e.message || e)));
  p.on('console', m => {
    if (m.type() !== 'error') return;
    const u = (m.location() && m.location().url) || '';
    if (/Failed to load resource/.test(m.text())) {
      if (u.startsWith(ORIGIN)) return;
      if (u) { t.external.push(m.text() + ' ' + u); return; }
    }
    t.errors.push('console: ' + m.text() + (u ? ' @ ' + u : ''));
  });
  p.on('response', r => {
    const u = r.url();
    if (u.startsWith(DATA_PREFIX)) t.data[u] = r.status();
    if (!u.startsWith(ORIGIN) || r.status() < 400) return;
    if (u.startsWith(DATA_PREFIX) && r.status() === 404) t.pendingData.push(u); else t.failed.push(r.status() + ' ' + u);
  });
  p.on('requestfailed', r => {
    const u = r.url(), f = (r.failure() && r.failure().errorText) || '';
    if (u.startsWith(ORIGIN) && !/ERR_ABORTED/.test(f)) t.failed.push(f + ' ' + u);
  });
  return t;
}
const errReport = t => [...t.errors, ...t.failed.map(f => 'failed: ' + f)];
// resolves with scrollY once it has been still for 8 frames (or after 4 s)
const settle = p => p.evaluate(() => new Promise(res => { let last = scrollY, n = 0; const t0 = performance.now(); const f = () => { if (Math.abs(scrollY - last) < 1) n++; else { n = 0; last = scrollY } if (n >= 8 || performance.now() - t0 > 4000) res(Math.round(scrollY)); else requestAnimationFrame(f) }; requestAnimationFrame(f) }));
const dashesSettled = p => p.waitForFunction(() => [...document.querySelectorAll('[data-dash],[data-walk]')].every(n => !n.querySelector('.dash__loading') || /could not load/.test(n.textContent)), null, { timeout: 15000 }).catch(() => {});
// scroll the whole page so lazy images and dashboards load, then wait for them
async function scrollThrough(p) {
  await p.evaluate(async () => {
    const wait = ms => new Promise(r => setTimeout(r, ms));
    for (let y = 0; y <= document.documentElement.scrollHeight; y += Math.round(innerHeight * 0.7)) { scrollTo({ top: y, behavior: 'instant' }); await wait(60); }
    scrollTo({ top: document.documentElement.scrollHeight, behavior: 'instant' }); await wait(120);
  });
  await dashesSettled(p);
  await p.waitForFunction(() => [...document.images].every(i => i.complete), null, { timeout: 10000 }).catch(() => {});
}
const toTop = async p => { await p.evaluate(() => scrollTo({ top: 0, behavior: 'instant' })); return settle(p); };
const dashState = (p, sel) => p.evaluate(s => { const n = document.querySelector(s); if (!n) return 'missing'; if (n.querySelector('.kpi, .walk__step')) return 'ready'; if (/could not load/.test(n.textContent)) return 'failed'; return 'loading'; }, sel);
// re-run a page with project.js's swallowed dashboard error logged, to say *why* "could not load" showed although the JSON was 200
async function dashError(proj, sel) {
  const ctx = await context(), p = await ctx.newPage(), msgs = [];
  p.on('console', m => { if (/\[dash\]/.test(m.text())) msgs.push(m.text()) });
  p.on('pageerror', e => msgs.push('pageerror ' + e.message));
  await p.route('**/projects/project.js', async r => { const res = await r.fetch(); const js = (await res.text()).replace(".catch(function () {", ".catch(function (e) { console.error('[dash] ' + (e && e.stack || e));"); await r.fulfill({ response: res, body: js }); });
  await p.goto(pageUrl(proj)); await p.locator(sel).scrollIntoViewIfNeeded();
  await p.waitForFunction(s => /could not load/.test(document.querySelector(s).textContent) || document.querySelector(s + ' .kpi'), sel, { timeout: 15000 }).catch(() => {});
  await ctx.close();
  return msgs.join(' | ').slice(0, 600) || 'no error captured';
}

// ================================================================ 1. generator is current
if (run(1)) {
  section('1 · build_projects.py --check');
  const r = spawnSync('python3', ['tools/build_projects.py', '--check'], { cwd: ROOT, encoding: 'utf8' });
  check('1 python3 tools/build_projects.py --check exits 0', r.status === 0, (r.stdout + r.stderr).trim());
}

// ================================================================ 2. page integrity
const headCache = new Map();
async function headOk(url) { // external links (repo, downloads): follow redirects, any 2xx is fine
  if (headCache.has(url)) return headCache.get(url);
  let v; try { const r = await fetch(url, { method: 'HEAD', redirect: 'follow', signal: AbortSignal.timeout(15000) }); v = { ok: r.ok, status: r.status }; } catch (e) { v = { ok: null, status: String(e.message || e) }; }
  headCache.set(url, v); return v;
}
if (run(2)) {
  section('2 · page integrity');
  const ctx = await context();
  for (const proj of P) for (const variant of ['slash', 'no-slash']) {
    const p = await ctx.newPage(), t = track(p), tag = `2 ${proj.slug} [${variant}]`;
    const url = variant === 'slash' ? pageUrl(proj) : pageUrl(proj).replace(/\/$/, '');
    const resp = await p.goto(url, { waitUntil: 'load' });
    const redirected = !!resp.request().redirectedFrom();
    check(`${tag}: HTTP 200${variant === 'no-slash' ? ', redirected to the slash URL' : ''}`, resp.status() === 200 && p.url() === pageUrl(proj) && (variant === 'slash' || redirected), `status ${resp.status()} · final ${p.url()} · redirected=${redirected}`);
    const playing = await p.waitForSelector('.pd-hero__poster .work-poster.is-play', { timeout: 6000 }).then(() => true, () => false);
    const i = await p.evaluate(() => {
      const q = s => document.querySelector(s);
      return {
        title: document.title, h1: [...document.querySelectorAll('h1')].map(h => h.textContent.trim()), poster: !!q('.pd-hero__poster figure.work-poster'),
        count: q('.pd-count') && q('.pd-count').textContent.trim(), gh: q('.pd-actions a.pd-btn--primary') && q('.pd-actions a.pd-btn--primary').href,
        backs: [...document.querySelectorAll('a.pd-back[data-back]')].map(a => a.href), dls: [...document.querySelectorAll('.pd-actions a[download]')].map(a => a.href),
        canon: q('link[rel=canonical]') && q('link[rel=canonical]').getAttribute('href'), og: q('meta[property="og:url"]') && q('meta[property="og:url"]').getAttribute('content')
      };
    });
    check(`${tag}: <title> contains "${proj.title}"`, i.title.includes(proj.title), i.title);
    check(`${tag}: exactly one h1, equal to the title`, i.h1.length === 1 && i.h1[0] === proj.title, JSON.stringify(i.h1));
    check(`${tag}: hero poster present and gets .is-play`, i.poster && playing, `figure=${i.poster} is-play=${playing}`);
    const cnt = `${String(proj.index + 1).padStart(2, '0')} / ${String(N).padStart(2, '0')}`;
    check(`${tag}: counter reads "${cnt}"`, i.count === cnt, i.count);
    check(`${tag}: GitHub button → ${proj.repo}`, i.gh === proj.repo, i.gh);
    check(`${tag}: back links (bar + footer) → ${BASE}#projects`, i.backs.length === 2 && i.backs.every(h => h === BASE + '#projects'), i.backs.join(', '));
    await scrollThrough(p);
    const imgs = await p.evaluate(() => [...document.images].map(m => ({ src: m.currentSrc || m.src, alt: m.hasAttribute('alt'), w: m.naturalWidth })));
    const bad = imgs.filter(m => !m.w), noAlt = imgs.filter(m => !m.alt);
    check(`${tag}: all ${imgs.length} img load (naturalWidth > 0)`, !bad.length, bad.map(m => m.src).join(', '));
    check(`${tag}: every img has an alt attribute`, !noAlt.length, noAlt.map(m => m.src).join(', '));
    check(`${tag}: zero page errors / console errors`, !t.errors.length, t.errors.join(' | '));
    check(`${tag}: no same-origin request failed`, !t.failed.length, t.failed.join(', '));
    if (t.pendingData.length) skip(`${tag}: dashboard data`, 'data JSON not there yet (404): ' + t.pendingData.join(', '));
    if (t.external.length) note(`${tag}: external load failures (not counted)`, t.external.join(' | '));
    if (variant === 'slash') {
      const canon = `${CONTENT.site}projects/${proj.slug}/`;
      check(`${tag}: canonical + og:url → ${canon}`, i.canon === canon && i.og === canon, `${i.canon} · ${i.og}`);
      const want = (proj.downloads || []).map(d => new URL(d[1]).href);
      check(`${tag}: download links match projects.json`, JSON.stringify(i.dls) === JSON.stringify(want), i.dls.join(', '));
      for (const u of [proj.repo, ...want]) {
        const h = await headOk(u);
        if (h.ok === null) skip(`${tag}: external link reachable ${u}`, 'network: ' + h.status);
        else check(`${tag}: external link reachable ${u}`, h.ok, 'HTTP ' + h.status);
      }
    }
    await p.close();
  }
  await ctx.close();
}

// ================================================================ 3. pager
if (run(3)) {
  section('3 · pager');
  const ctx = await context(), p = await ctx.newPage(), t = track(p);
  for (const proj of P) {
    await p.goto(pageUrl(proj));
    const h = await p.evaluate(() => ({ prev: [...document.querySelectorAll('nav.pd-pager a[rel=prev]')].map(a => a.href), next: [...document.querySelectorAll('nav.pd-pager a[rel=next]')].map(a => a.href) }));
    const pv = P[(proj.index - 1 + N) % N], nx = P[(proj.index + 1) % N];
    check(`3 ${proj.slug}: prev → ${pv.slug}, next → ${nx.slug} (one of each)`, h.prev.length === 1 && h.next.length === 1 && h.prev[0] === pageUrl(pv) && h.next[0] === pageUrl(nx), JSON.stringify(h));
  }
  await p.goto(pageUrl(P[0]));
  for (let k = 1; k <= N; k++) {
    const from = P[k - 1], want = P[k % N];
    const ok = await Promise.all([p.waitForURL(pageUrl(want), { timeout: 10000 }), p.locator('nav.pd-pager a[rel=next]').click()]).then(() => true, e => e.message.split('\n')[0]);
    const h1 = await p.locator('h1').first().textContent().catch(() => '');
    check(`3 click Next on ${from.slug} → ${want.slug}`, ok === true && h1.trim() === want.title, ok === true ? `h1 "${h1.trim()}"` : ok);
  }
  const ok = await Promise.all([p.waitForURL(pageUrl(P[N - 1]), { timeout: 10000 }), p.locator('nav.pd-pager a[rel=prev]').click()]).then(() => true, e => e.message.split('\n')[0]);
  check(`3 click Previous on ${P[0].slug} wraps to ${P[N - 1].slug}`, ok === true, ok === true ? p.url() : ok);
  check('3 pager navigation: zero errors / failed requests', !errReport(t).length, errReport(t).join(' | '));
  await ctx.close();
}

// ================================================================ 4. home ⇄ case study navigation (1440×900)
const rowSel = i => `#projects a.work-row[data-i="${i}"]`;
const rowsLinked = p => p.evaluate(([base, slugs]) => { const r = [...document.querySelectorAll('#projects a.work-row')]; return r.length === slugs.length && r.every(a => a.href === base + 'projects/' + slugs[+a.dataset.i] + '/' && a.target !== '_blank'); }, [BASE, P.map(q => q.slug)]);
async function gotoHome(p, url = BASE) { await p.goto(url, { waitUntil: 'load' }); await p.evaluate(() => document.fonts.ready); }
async function toRow(p, i) {
  await p.evaluate(() => document.getElementById('projects').scrollIntoView({ behavior: 'instant', block: 'start' })); await settle(p);
  await p.evaluate(s => document.querySelector(s).scrollIntoView({ behavior: 'instant', block: 'center' }), rowSel(i));
  return settle(p);
}
const rowBox = (p, i) => p.evaluate(s => { const b = document.querySelector(s).getBoundingClientRect(); return { top: Math.round(b.top), bottom: Math.round(b.bottom), inView: b.top >= 0 && b.bottom <= innerHeight }; }, rowSel(i));
const projectsBox = p => p.evaluate(() => { const b = document.getElementById('projects').getBoundingClientRect(); return { top: Math.round(b.top), bottom: Math.round(b.bottom), y: Math.round(scrollY), inView: b.top <= 140 && b.top >= -40 && b.bottom > innerHeight / 2 }; });
const isHome = u => u.href.startsWith(BASE) && !u.pathname.startsWith(new URL('projects/', BASE).pathname);
async function backToHome(p, how) {
  if (how === 'link') await Promise.all([p.waitForURL(isHome, { timeout: 10000 }), p.locator('.pd-bar a.pd-back').click()]);
  else await p.goBack({ waitUntil: 'load' });
}
// home → row i → case study → back (link | goBack). Returns the page on the home page.
async function roundTrip(ctx, i, how, home = BASE, label = '', soft = false) {
  const p = await ctx.newPage(), t = track(p), proj = P[i], tag = `4 row ${i + 1} (${proj.slug}) → case study → ${how === 'link' ? '"All projects"' : 'page.goBack()'}${label}`;
  await gotoHome(p, home);
  const linked = await rowsLinked(p);
  if (!linked) { skip(tag, 'home rows do not link to projects/<slug>/ yet'); await p.close(); return null; }
  const y0 = await toRow(p, i);
  const nav = await Promise.all([p.waitForURL(pageUrl(proj), { timeout: 10000 }), p.locator(rowSel(i)).click()]).then(() => true, e => e.message.split('\n')[0]);
  if (nav !== true) { check(tag, false, 'row click did not reach the case study: ' + nav); await p.close(); return null; }
  const h1 = (await p.locator('h1').first().textContent()).trim();
  const hist = await p.evaluate(() => ({ ref: document.referrer, len: history.length }));
  await backToHome(p, how);
  await p.waitForFunction(y => Math.abs(scrollY - y) <= 40, y0, { timeout: 4000 }).catch(() => {});
  const y1 = await settle(p), box = await rowBox(p, i);
  const ok = h1 === proj.title && Math.abs(y1 - y0) <= 40 && box.inView, info = `h1 "${h1}" · scrollY before ${y0} after ${y1} (Δ${y1 - y0}) · row top ${box.top}/bottom ${box.bottom} inView=${box.inView} · back URL ${p.url()} · referrer ${hist.ref} history ${hist.len}`;
  if (soft && !ok) warn(tag, info + ' — project.js only steps back when the referrer path equals the link\'s path (/), so /index.html falls back to the #projects link'); else check(tag, ok, info);
  return { p, t, y0, y1 };
}
if (run(4)) {
  section('4 · navigation flows (1440×900)');
  const ctx = await context();
  // a) "All projects" from each row
  for (const i of P.map(q => q.index)) { const r = await roundTrip(ctx, i, 'link'); if (r) { if (errReport(r.t).length) check(`4 row ${i + 1} round trip: zero errors`, false, errReport(r.t).join(' | ')); await r.p.close(); } }
  // a2) does the click run a cross-document view transition (poster morph)? informational
  {
    const c2 = await context(); await c2.addInitScript(() => addEventListener('pagereveal', e => { window.__vt = !!e.viewTransition; }));
    const p = await c2.newPage(); await gotoHome(p); await toRow(p, 3);
    await Promise.all([p.waitForURL(pageUrl(P[3])), p.locator(rowSel(3)).click()]);
    const vt = await p.evaluate(() => window.__vt);
    note('4 home row → case study: cross-document view transition ran (pagereveal.viewTransition)', String(vt));
    await c2.close();
  }
  // b) browser back / forward
  for (const i of [0, 3]) {
    const r = await roundTrip(ctx, i, 'back'); if (!r) continue;
    await r.p.goForward({ waitUntil: 'load' });
    const playing = await r.p.waitForSelector('.pd-hero__poster .work-poster.is-play', { timeout: 6000 }).then(() => true, () => false);
    const h1 = (await r.p.locator('h1').first().textContent()).trim();
    check(`4 row ${i + 1} → back → page.goForward(): case study renders`, r.p.url() === pageUrl(P[i]) && h1 === P[i].title && playing, `${r.p.url()} h1 "${h1}" is-play=${playing}`);
    check(`4 row ${i + 1} back/forward: zero errors`, !errReport(r.t).length, errReport(r.t).join(' | '));
    await r.p.close();
  }
  // c) reload on the case study, then "All projects" still returns to the same spot (referrer survives a reload)
  {
    const p = await ctx.newPage(), t = track(p), i = 3; await gotoHome(p);
    if (await rowsLinked(p)) {
      const y0 = await toRow(p, i);
      await Promise.all([p.waitForURL(pageUrl(P[i])), p.locator(rowSel(i)).click()]);
      await p.reload({ waitUntil: 'load' });
      const playing = await p.waitForSelector('.pd-hero__poster .work-poster.is-play', { timeout: 6000 }).then(() => true, () => false);
      await p.locator('[data-dash]').first().scrollIntoViewIfNeeded().catch(() => {}); await dashesSettled(p);
      const h1 = (await p.locator('h1').first().textContent()).trim(), dstate = await dashState(p, '[data-dash]');
      check('4 reload on a case study: renders (h1, poster, dashboard)', h1 === P[i].title && playing && (dstate === 'ready' || t.pendingData.length > 0), `h1 "${h1}" is-play=${playing} dashboard=${dstate}${t.pendingData.length ? ' (data 404: pending)' : ''}`);
      await toTop(p);
      await backToHome(p, 'link');
      await p.waitForFunction(y => Math.abs(scrollY - y) <= 40, y0, { timeout: 4000 }).catch(() => {});
      const y1 = await settle(p), box = await rowBox(p, i);
      check('4 home → row → reload → "All projects": back at the same spot', Math.abs(y1 - y0) <= 40 && box.inView, `before ${y0} after ${y1} · row inView=${box.inView} · ${p.url()}`);
      check('4 reload flow: zero errors', !errReport(t).length, errReport(t).join(' | '));
    } else skip('4 reload flow', 'home rows not linked yet');
    await p.close();
  }
  // d) row → Next (pager) → "All projects": referrer is another case study, so the link itself is followed to #projects
  {
    const p = await ctx.newPage(), t = track(p), i = 1; await gotoHome(p);
    if (await rowsLinked(p)) {
      await toRow(p, i);
      await Promise.all([p.waitForURL(pageUrl(P[i])), p.locator(rowSel(i)).click()]);
      await Promise.all([p.waitForURL(pageUrl(P[i + 1])), p.locator('nav.pd-pager a[rel=next]').click()]);
      await backToHome(p, 'link'); await settle(p);
      const b = await projectsBox(p);
      check('4 row → pager Next → "All projects": home with #projects in view', p.url() === BASE + '#projects' && b.inView, `${p.url()} · #projects top ${b.top} bottom ${b.bottom} scrollY ${b.y}`);
      check('4 pager-then-back flow: zero errors', !errReport(t).length, errReport(t).join(' | '));
    } else skip('4 pager-then-back flow', 'home rows not linked yet');
    await p.close();
  }
  // e) fresh page (no history, no referrer): "All projects" follows ../../#projects
  for (const proj of [P[0], P[4]]) {
    const c2 = await context(), p = await c2.newPage(), t = track(p);
    await p.goto(pageUrl(proj));
    const ok = await Promise.all([p.waitForURL(isHome, { timeout: 10000 }), p.locator('.pd-bar a.pd-back').click()]).then(() => true, e => e.message.split('\n')[0]);
    await p.waitForFunction(() => { const b = document.getElementById('projects').getBoundingClientRect(); return b.top <= 140 && b.top >= -40; }, null, { timeout: 4000 }).catch(() => {});
    await settle(p);
    const b = await projectsBox(p), u = new URL(p.url());
    check(`4 fresh ${proj.slug} → "All projects": lands on the home page #projects, section in view`, ok === true && (u.pathname === new URL(BASE).pathname || u.pathname.endsWith('/index.html')) && u.hash === '#projects' && b.inView, `${ok === true ? p.url() : ok} · #projects top ${b.top} scrollY ${b.y}`);
    const late = await p.evaluate(() => new Promise(r => setTimeout(() => r(Math.round(document.getElementById('projects').getBoundingClientRect().top)), 1500)));
    if (Math.abs(late - b.top) > 40) warn(`4 fresh ${proj.slug} → #projects drifts after landing`, `top ${b.top} → ${late} 1.5 s later (late layout shift above #projects)`);
    check(`4 fresh ${proj.slug} back-link flow: zero errors`, !errReport(t).length, errReport(t).join(' | '));
    await c2.close();
  }
  // f) home opened as /index.html: the referrer path is /index.html, not / (informational)
  {
    const r = await roundTrip(ctx, 2, 'link', BASE + 'index.html', ' [home opened as /index.html]', true);
    if (r) await r.p.close();
  }
  await ctx.close();
}

// ================================================================ 5. dashboards
const kpiText = (p, sel) => p.evaluate(s => [...document.querySelectorAll(s + ' .kpi')].map(k => ((k.querySelector('.kpi__v') || {}).textContent || '').trim() + ' ' + ((k.querySelector('.kpi__k') || {}).textContent || '').trim()).join(' | '), sel);
const segState = (p, sel) => p.evaluate(s => [...document.querySelectorAll(s + ' .seg')].map(g => [...g.querySelectorAll('button')].map(b => b.getAttribute('aria-pressed') === 'true' ? 1 : 0).join('')).join('/'), sel);
const segGroups = (p, sel) => p.evaluate(s => [...document.querySelectorAll(s + ' .seg')].map(g => { const bs = [...g.querySelectorAll('button')]; return { name: g.getAttribute('aria-label') || '?', labels: bs.map(b => b.textContent.trim()), def: bs.findIndex(b => b.getAttribute('aria-pressed') === 'true') }; }), sel);
const badText = (p, sel) => p.evaluate(s => { const n = document.querySelector(s); const m = (n.textContent + ' ' + [...n.querySelectorAll('[style],[d],[points],[width],[height],[x],[y]')].map(e => ['style', 'points', 'width', 'height', 'x', 'y', 'stroke-dasharray'].map(a => e.getAttribute(a) || '').join(' ')).join(' ')).match(/NaN|undefined|Infinity|\bnull\b/g); return m ? [...new Set(m)].join(',') : ''; }, sel);
async function pokeDisabled(p, sel) {
  const dis = p.locator(`${sel} .seg button:disabled`), n = await dis.count();
  if (!n) return null;
  const label = (await dis.first().textContent()).trim(), k0 = await kpiText(p, sel), s0 = await segState(p, sel);
  await dis.first().click({ force: true, timeout: 2000 }).catch(() => {});
  return { n, label, same: k0 === (await kpiText(p, sel)) && s0 === (await segState(p, sel)) };
}
const pick = async (p, sel, group, label) => {
  const b = p.locator(`${sel} .seg[aria-label="${group}"] button`).filter({ hasText: new RegExp('^\\s*' + label + '\\s*$') });
  if (!(await b.count())) return 'missing'; if (await b.first().isDisabled()) return 'disabled';
  await b.first().click(); return 'ok';
};
const num = s => { const m = String(s).replace(/,/g, '').match(/-?\d+(\.\d+)?/); return m ? +m[0] : NaN; };
if (run(5)) {
  section('5 · dashboards (1440×900)');
  const ctx = await context();
  for (const proj of P) for (const d of dashesOf(proj)) {
    const sel = `[data-dash="${d.id}"]`, tag = `5 ${proj.slug} · ${d.id}`, dataUrl = DATA_PREFIX + d.data;
    const p = await ctx.newPage(), t = track(p);
    await p.goto(pageUrl(proj));
    await p.locator(sel).scrollIntoViewIfNeeded();
    await p.waitForFunction(s => { const n = document.querySelector(s); return n.querySelector('.kpi') || /could not load/.test(n.textContent); }, sel, { timeout: 15000 }).catch(() => {});
    const st = t.data[dataUrl], state = await dashState(p, sel);
    if (st === 404) { skip(`${tag}: dashboard`, `data JSON not there yet: 404 ${dataUrl}`); await p.close(); continue; }
    if (state !== 'ready') { check(`${tag}: renders KPIs`, false, `state=${state}, data HTTP ${st}${state === 'failed' && st === 200 ? ' · render error: ' + await dashError(proj, sel) : ''}`); await p.close(); continue; }
    const base = await kpiText(p, sel), cards = await p.locator(`${sel} .card`).count(), bad0 = await badText(p, sel);
    check(`${tag}: renders KPIs + cards, no NaN/undefined`, base && cards > 0 && !bad0, `${base} · ${cards} cards${bad0 ? ' · BAD: ' + bad0 : ''}`);
    const live = await p.evaluate(s => [...document.querySelectorAll(s + ' .pd-badge__k')].map(b => b.textContent.trim()), sel);
    check(`${tag}: header badge says "Live"`, live.includes('Live'), live.join(','));
    await p.locator(sel).screenshot({ path: path.join(QA, `dash-${d.id}-1440.png`) }).catch(() => {});
    const groups = await segGroups(p, sel), disabled = [];
    if (!groups.length) warn(`${tag}: no filter buttons`, 'the dashboard has no .seg groups');
    for (const [gi, g] of groups.entries()) {
      let changed = 0, tried = 0; const problems = [], seen = [];
      for (let bj = 0; bj < g.labels.length; bj++) {
        if (bj === g.def) continue;
        const btn = p.locator(`${sel} .seg`).nth(gi).locator('button').nth(bj);
        if (await btn.isDisabled()) { const r = await pokeDisabled(p, sel); if (r) disabled.push(`${g.name}=${g.labels[bj]}: ${r.same ? 'unchanged' : 'CHANGED'}`); continue; }
        await btn.click(); tried++;
        const s = await p.evaluate(([s, gi, bj]) => [...document.querySelectorAll(s + ' .seg')[gi].querySelectorAll('button')].every((b, j) => b.getAttribute('aria-pressed') === String(j === bj)), [sel, gi, bj]);
        const k = await kpiText(p, sel), bad = await badText(p, sel);
        if (k !== base) changed++;
        seen.push(`${g.labels[bj]} → ${k.split(' | ').map(x => x.split(' ')[0]).join(' / ')}`);
        if (!s) problems.push(`${g.labels[bj]}: aria-pressed not exclusive`);
        if (bad) problems.push(`${g.labels[bj]}: ${bad} in the dashboard`);
        const r = await pokeDisabled(p, sel); // whatever is disabled in this state must stay inert
        if (r) disabled.push(`${g.name}=${g.labels[bj]}, clicked disabled "${r.label}" (${r.n} disabled): ${r.same ? 'unchanged' : 'CHANGED'}`);
      }
      if (g.def >= 0) await p.locator(`${sel} .seg`).nth(gi).locator('button').nth(g.def).click();
      const back = await kpiText(p, sel);
      check(`${tag}: ${g.name} filter — ${tried} options clicked, KPIs change for ≥1, aria-pressed exclusive, no NaN`, (tried === 0 || changed > 0) && !problems.length, `${changed}/${tried} changed KPIs · ${problems.join('; ')} · ${clip(seen.join(' ; '), 500)}`);
      check(`${tag}: ${g.name} back to "${g.labels[g.def]}" restores the KPIs`, back === base, back);
    }
    if (disabled.length) check(`${tag}: disabled filter buttons do nothing when clicked`, disabled.every(x => !/CHANGED/.test(x)), clip(disabled.join(' ; '), 500));
    else note(`${tag}: disabled buttons`, 'none in any state tried');

    if (d.id === 'hospital') {
      const yrs = groups.find(g => g.name === 'Year'), years = yrs ? yrs.labels.filter(l => l !== 'All') : [];
      const chk = await p.evaluate(s => { const c = document.querySelector(s + ' .dash__check'); return c ? c.textContent : ''; }, sel);
      note(`${tag}: years in the data`, years.join(', ') + (chk ? ` · on-page check line: "${chk}"` : ' · no .dash__check line'));
      // Excel screenshot reads Feb: 431 patients, 36.67 min, 4.72
      const combos = [...(years.includes('2023') ? ['2023'] : []), 'All', ...years.filter(y => y !== '2023')], hits = [];
      for (const y of combos) {
        const a = await pick(p, sel, 'Year', y), b = a === 'ok' ? await pick(p, sel, 'Month', 'Feb') : 'n/a';
        if (a !== 'ok' || b !== 'ok') { note(`${tag}: Year ${y} + Feb`, `year ${a}, Feb ${b}`); continue; }
        const k = await kpiText(p, sel), v = k.split(' | ').map(num);
        const match = v[0] === 431 && Math.abs(v[1] - 36.67) < 0.006 && Math.abs(v[2] - 4.72) < 0.006;
        if (match) hits.push(`Year ${y} + Feb`);
        note(`${tag}: Year ${y} + Month Feb`, `${k}${match ? '   <= matches the Excel screenshot (431 / 36.67 / 4.72)' : ''}`);
      }
      note(`${tag}: Excel Feb numbers (431 / 36.67 min / 4.72) shown by`, hits.length ? hits.join(', ') : 'NO selection');
      // the rest of the Excel screenshot (Feb): admitted 224 / not admitted 207, age bins 42 46 54 68 62 52 54 53, referrals 252 89 46 14 12 6 6 6
      if ((await pick(p, sel, 'Year', 'All')) === 'ok' && (await pick(p, sel, 'Month', 'Feb')) === 'ok') {
        const v = await p.evaluate(s => {
          const cards = [...document.querySelectorAll(s + ' .card')], by = t => cards.find(c => c.querySelector('h3').firstChild.textContent.trim() === t);
          const bars = c => c ? [...c.querySelectorAll('.hbar')].map(h => ({ l: h.querySelector('.hbar__l').textContent, v: h.querySelector('.hbar__v').textContent })) : [];
          const leg = c => c ? [...c.querySelectorAll('.legend li')].map(li => li.textContent) : [];
          return { adm: bars(by('Admission status')), age: by('Patients by age group') ? [...by('Patients by age group').querySelectorAll('.col__v')].map(x => x.textContent) : [], dept: bars(by('Department referrals')), onTime: leg(by('Patients attended on time')), gender: leg(by('Gender')) };
        }, sel);
        const n = x => +String(x).replace(/[^0-9.]/g, '');
        const age = v.age.map(n), dept = v.dept.map(d => n(d.v.split('·')[0])).sort((a, b) => b - a), adm = v.adm.map(d => n(d.v.split('·')[0]));
        const exp = { age: [42, 46, 54, 68, 62, 52, 54, 53], dept: [252, 89, 46, 14, 12, 6, 6, 6], adm: [224, 207] };
        const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
        const okAll = same(age, exp.age) && same(dept, exp.dept) && same(adm, exp.adm);
        (okAll ? note : warn)(`${tag}: Year All + Feb vs the rest of the Excel screenshot`, `age ${age.join(' ')} (Excel ${exp.age.join(' ')}) · referrals ${v.dept.map(d => d.l + ' ' + n(d.v)).join(', ')} (Excel values ${exp.dept.join(' ')}) · admitted/not ${adm.join('/')} (Excel 224/207) · on time: ${v.onTime.join(' | ')} (Excel pie 34% / 66%) · gender: ${v.gender.join(' | ')} (Excel 45% / 55%)`);
      }
      await pick(p, sel, 'Month', 'All'); await pick(p, sel, 'Year', 'All');
      // a month that has no data in the newly chosen year must fall back to All
      let tested = false;
      for (const y1 of years) {
        if (tested) break;
        await pick(p, sel, 'Year', y1);
        const en1 = await p.evaluate(s => [...document.querySelectorAll(s + ' .seg[aria-label="Month"] button')].map(b => !b.disabled), sel);
        for (const y2 of years.filter(y => y !== y1)) {
          await pick(p, sel, 'Year', y2);
          const en2 = await p.evaluate(s => [...document.querySelectorAll(s + ' .seg[aria-label="Month"] button')].map(b => !b.disabled), sel);
          const m = en1.findIndex((e, k) => k > 0 && e && !en2[k]);
          if (m < 0) continue;
          const lbl = groups.find(g => g.name === 'Month').labels[m];
          await pick(p, sel, 'Year', y1); await pick(p, sel, 'Month', lbl); await pick(p, sel, 'Year', y2);
          const after = await kpiText(p, sel), pressed = await p.evaluate(s => [...document.querySelectorAll(s + ' .seg[aria-label="Month"] button')].findIndex(b => b.getAttribute('aria-pressed') === 'true'), sel);
          await pick(p, sel, 'Month', 'All'); const allY2 = await kpiText(p, sel);
          check(`${tag}: Year ${y1} + ${lbl}, then Year ${y2} (no ${lbl} data) → Month falls back to All`, pressed === 0 && after === allY2, `pressed index ${pressed} · ${after} vs ${allY2}`);
          tested = true; break;
        }
      }
      if (!tested) note(`${tag}: month fallback`, 'no year pair with a month missing in only one year');
      await pick(p, sel, 'Year', 'All');
    }
    check(`${tag}: zero errors while filtering`, !errReport(t).length, errReport(t).join(' | '));
    await p.close();
  }
  await ctx.close();
}

// ================================================================ 6. Aadhaar walkthrough
if (run(6)) {
  section('6 · Aadhaar walkthrough');
  const proj = P.find(walkOf);
  if (!proj) skip('6 walkthrough', 'no walkthrough section in projects.json');
  else {
    const steps = walkOf(proj).steps, ctx = await context(), p = await ctx.newPage(), t = track(p);
    await p.goto(pageUrl(proj));
    await p.locator('[data-walk]').scrollIntoViewIfNeeded();
    await p.waitForSelector('[data-walk] .walk__step', { timeout: 10000 }).catch(() => {});
    const st = () => p.evaluate(() => ({ cur: [...document.querySelectorAll('.walk__step')].map(b => b.getAttribute('aria-current')), on: [...document.querySelectorAll('.walk [data-layer].is-on')].map(g => g.getAttribute('data-layer')).sort().join(','), btn: (document.querySelector('.walk__bar button') || {}).textContent }));
    const curIs = (s, k) => s.cur.every((c, j) => j === k ? c === 'step' : c === null);
    const n = await p.locator('.walk__step').count();
    check('6 steps render (one button per step)', n === steps.length, `${n} of ${steps.length}`);
    const layers = await p.evaluate(() => [...document.querySelectorAll('.walk [data-layer]')].map(g => g.getAttribute('data-layer')));
    const missing = [...new Set(steps.flatMap(s => s.layers))].filter(l => !layers.includes(l));
    check('6 every layer named in projects.json exists in the SVG', !missing.length, `svg layers: ${layers.join(',')}${missing.length ? ' · missing: ' + missing : ''}`);
    const s0 = await st();
    check('6 on load: step 1 current, its layers on', curIs(s0, 0) && s0.on === steps[0].layers.slice().sort().join(','), JSON.stringify(s0));
    for (let k = 0; k < steps.length; k++) {
      await p.locator('.walk__step').nth(k).click();
      const s = await st(), want = steps[k].layers.slice().sort().join(',');
      check(`6 click step ${k + 1} "${steps[k].t}": aria-current only on it, layers = ${want}`, curIs(s, k) && s.on === want, `cur ${JSON.stringify(s.cur)} · on ${s.on}`);
    }
    const play = p.locator('[data-walk] .walk__bar button');
    await play.click();
    const s1 = await st();
    check('6 Play: button turns to "Pause" and jumps to step 1', s1.btn === 'Pause' && curIs(s1, 0), JSON.stringify(s1));
    const adv = await p.waitForFunction(() => document.querySelectorAll('.walk__step')[2].getAttribute('aria-current') === 'step', null, { timeout: 7000 }).then(() => true, () => false);
    check('6 Play advances (step 3 reached within 7 s)', adv, JSON.stringify(await st()));
    await play.click();
    const sp = await st(); await p.waitForTimeout(2700); const sp2 = await st(); // a step is 2.2 s: wait longer than one to prove it stopped
    check('6 Pause stops on the current step', sp.btn === 'Play all steps' && JSON.stringify(sp.cur) === JSON.stringify(sp2.cur), `${JSON.stringify(sp)} → ${JSON.stringify(sp2)}`);
    await play.click();
    const end = await p.waitForFunction(n => document.querySelectorAll('.walk__step')[n - 1].getAttribute('aria-current') === 'step', steps.length, { timeout: steps.length * 2200 + 3000 }).then(() => true, () => false);
    const stop = await p.waitForFunction(() => document.querySelector('.walk__bar button').textContent === 'Play all steps', null, { timeout: 4000 }).then(() => true, () => false);
    const se = await st();
    check('6 Play runs to the last step, then the button resets', end && stop && curIs(se, steps.length - 1), JSON.stringify(se));
    await play.click(); await p.locator('.walk__step').nth(3).click();
    const sc = await st(); await p.waitForTimeout(2700); const sc2 = await st();
    check('6 clicking a step while playing stops playback on that step', sc.btn === 'Play all steps' && curIs(sc, 3) && curIs(sc2, 3), `${JSON.stringify(sc)} → ${JSON.stringify(sc2)}`);
    const sim = await p.evaluate(() => [...document.querySelectorAll('[data-walk] .pd-badge__k')].map(b => b.textContent));
    check('6 walkthrough badge says "Simulation"', sim.includes('Simulation'), sim.join(','));
    await p.locator('[data-walk]').screenshot({ path: path.join(QA, 'walk-1440.png') }).catch(() => {});
    { // on a phone the card sits above the list: can you see it change when you tap a step?
      const c2 = await context(VIEWPORTS[2]), q = await c2.newPage();
      await q.goto(pageUrl(proj)); await q.locator('[data-walk]').scrollIntoViewIfNeeded(); await q.waitForSelector('[data-walk] .walk__step', { timeout: 10000 }).catch(() => {});
      const hidden = [];
      for (let k = 0; k < steps.length; k++) {
        await q.locator('.walk__step').nth(k).click();
        const vis = await q.evaluate(() => { const b = document.querySelector('.walk__stage').getBoundingClientRect(), top = document.querySelector('.pd-bar').getBoundingClientRect().bottom; const shown = Math.max(0, Math.min(b.bottom, innerHeight) - Math.max(b.top, top)); return shown / b.height; });
        if (vis < 0.5) hidden.push(`step ${k + 1} (${Math.round(vis * 100)}% of the card on screen)`);
      }
      (hidden.length ? warn : note)('6 390×844: sample card visible while tapping steps', hidden.length ? 'tapping these steps changes a card that is off screen: ' + hidden.join(', ') : 'card at least half visible for every step');
      await c2.close();
    }
    check('6 walkthrough: zero errors', !errReport(t).length, errReport(t).join(' | '));
    await ctx.close();
  }
}

// ================================================================ 7. responsive
if (run(7)) {
  section('7 · responsive');
  for (const vp of VIEWPORTS) {
    const ctx = await context(vp), vtag = `${vp.width}×${vp.height}`;
    for (const proj of P) {
      const p = await ctx.newPage(), t = track(p), tag = `7 ${proj.slug} @${vtag}`;
      await p.goto(pageUrl(proj)); await p.evaluate(() => document.fonts.ready);
      const playing = await p.waitForSelector('.pd-hero__poster .work-poster.is-play', { timeout: 6000 }).then(() => true, () => false);
      const top = await p.evaluate(() => {
        const r = e => { if (typeof e === 'string') e = document.querySelector(e); if (!e) return null; const b = e.getBoundingClientRect(), cs = getComputedStyle(e); return { l: Math.round(b.left), r: Math.round(b.right), t: Math.round(b.top), b: Math.round(b.bottom), w: Math.round(b.width), h: Math.round(b.height), vis: cs.visibility !== 'hidden' && cs.display !== 'none' && +cs.opacity > 0, clipX: e.scrollWidth - e.clientWidth } };
        return { iw: innerWidth, ih: innerHeight, bar: r('.pd-bar'), kids: ['.pd-bar .pd-back', '.pd-bar .pd-brand', '.pd-bar .pd-count'].map(r), copy: r('.pd-hero__copy'), posterBox: r('.pd-hero__poster'), title: r('h1.pd-title'), poster: r('.pd-hero__poster .work-poster') };
      });
      const inX = b => b && b.l >= -1 && b.r <= top.iw + 1;
      check(`${tag}: hero title visible`, top.title && top.title.vis && top.title.w > 0 && top.title.h > 0 && inX(top.title) && top.title.clipX <= 1, JSON.stringify(top.title));
      check(`${tag}: hero poster visible (and playing)`, top.poster && top.poster.vis && top.poster.h > 40 && inX(top.poster) && playing, `${JSON.stringify(top.poster)} is-play=${playing}`);
      if (top.title && top.title.t > top.ih) warn(`${tag}: hero title starts below the fold`, `title top ${top.title.t}px, viewport ${top.ih}px`);
      const ov = (a, b) => a && b && a.r > b.l + 1 && b.r > a.l + 1 && a.b > b.t + 1 && b.b > a.t + 1;
      const kidsOv = [[0, 1], [1, 2], [0, 2]].filter(([a, b]) => ov(top.kids[a], top.kids[b]));
      const kidsOut = top.kids.filter(k => k && (k.l < top.bar.l - 1 || k.r > top.bar.r + 1 || k.clipX > 1));
      check(`${tag}: top bar — back / brand / counter don't overlap, fit, not clipped`, !kidsOv.length && !kidsOut.length, `overlaps ${JSON.stringify(kidsOv)} · ${JSON.stringify(top.kids)}`);
      check(`${tag}: bar does not cover the hero at the top of the page`, top.bar.b <= Math.min(top.copy.t, top.posterBox.t) + 1, `bar bottom ${top.bar.b}, hero copy top ${top.copy.t}, poster top ${top.posterBox.t}`);
      await scrollThrough(p);
      const lay = await p.evaluate(vw => {
        // on a mobile viewport an overflowing page widens innerWidth itself, so compare with the configured width
        const iw = vw, desc = e => e.tagName.toLowerCase() + (e.className && typeof e.className === 'string' ? '.' + e.className.trim().split(/\s+/).join('.') : '');
        const clipped = (e, stop) => { for (let a = e.parentElement; a && a !== stop; a = a.parentElement) if (getComputedStyle(a).overflowX !== 'visible') return true; return false; };
        const textRects = n => { const out = [], w = document.createTreeWalker(n, NodeFilter.SHOW_TEXT); let t; while ((t = w.nextNode())) { if (!t.textContent.trim() || t.parentElement.closest('svg, script, noscript, style')) continue; const r = document.createRange(); r.selectNodeContents(t); const b = r.getBoundingClientRect(); if (b.width) out.push({ t, b }); } return out; };
        const wideEl = [...document.querySelectorAll('body *')].filter(e => { const b = e.getBoundingClientRect(); return b.width && (b.right > iw + 1 || b.left < -1) && !clipped(e, document.body); }).map(e => desc(e) + ' r=' + Math.round(e.getBoundingClientRect().right));
        const wideTxt = textRects(document.body).filter(x => (x.b.right > iw + 1 || x.b.left < -1) && !clipped(x.t, document.body)).map(x => `"${x.t.textContent.trim().slice(0, 24)}" in ${desc(x.t.parentElement)} r=${Math.round(x.b.right)}`);
        const wide = [...wideEl, ...wideTxt].slice(0, 8);
        // content sticking out of its own box (clipped or overlapping text): elements and bare text
        const boxes = '.kpi, .card, .pd-badge, .pd-btn, .pd-pager__link, .pd-facts > div, .seg, .walk__step, .legend li, .hbar, .pd-features li, .pd-steps li, .pd-table > div, .dash__top, .walk__bar';
        const spill = [...document.querySelectorAll(boxes)].flatMap(c => {
          const cb = c.getBoundingClientRect(); if (!cb.width) return [];
          const bad = [...c.querySelectorAll('*')].find(k => { if (k.closest('svg') && k.tagName.toLowerCase() !== 'svg') return false; const b = k.getBoundingClientRect(); return b.width && b.height && !clipped(k, c) && (b.right > cb.right + 1 || b.left < cb.left - 1); });
          if (bad) return [desc(c) + ' ⊃ ' + desc(bad) + ` (${Math.round(bad.getBoundingClientRect().right - cb.right)}px)`];
          const tx = textRects(c).find(x => !clipped(x.t, c) && (x.b.right > cb.right + 1 || x.b.left < cb.left - 1));
          return tx ? [desc(c) + ` ⊃ text "${tx.t.textContent.trim().slice(0, 24)}" (${Math.round(tx.b.right - cb.right)}px past the right edge${getComputedStyle(c).overflowX !== 'visible' ? ', cut off by the box' : ''})`] : [];
        });
        // column charts: every bar needs real width (too many columns + fixed gaps collapse them to 0)
        const thin = [...document.querySelectorAll('.cols')].map(c => { const w = [...c.querySelectorAll('.col')].map(x => x.getBoundingClientRect().width); const card = c.closest('.card'); return { t: card ? card.querySelector('h3').firstChild.textContent : desc(c), n: w.length, min: Math.min(...w), over: Math.round(c.scrollWidth - c.clientWidth) }; }).filter(x => x.min < 1 || x.over > 1).map(x => `"${x.t}": ${x.n} columns, narrowest ${x.min.toFixed(2)}px, row ${x.over}px wider than its box`);
        // value labels over columns that run into each other, and axis labels cut short
        const collide = [...document.querySelectorAll('.cols')].flatMap(c => { const v = [...c.querySelectorAll('.col__v')].filter(x => getComputedStyle(x).display !== 'none').map(x => x.getBoundingClientRect()); const hits = v.filter((r, k) => k && r.width && v[k - 1].width && v[k - 1].right > r.left + 0.5).length; const card = c.closest('.card'); return hits ? [`"${card ? card.querySelector('h3').firstChild.textContent : 'chart'}": ${hits} value labels overlap a neighbour`] : []; });
        const axisCut = [...document.querySelectorAll('.cols__x span')].filter(e => e.textContent && e.clientWidth && e.scrollWidth > e.clientWidth + 1 && getComputedStyle(e).overflowX !== 'visible').map(e => { const card = e.closest('.card'); return `"${card ? card.querySelector('h3').firstChild.textContent : 'chart'}": "${e.textContent}" cut to ${e.clientWidth}px`; });
        // labels meant to sit on one line
        const wrapped = [...document.querySelectorAll('.pd-badge__k, .seg button, .pd-btn, .pd-back, .pd-count, .ctl-name, .pd-eyebrow, .walk__bar .pd-btn')].filter(e => { const cs = getComputedStyle(e), b = e.getBoundingClientRect(); if (!b.height || (parseFloat(cs.minHeight) && b.height <= parseFloat(cs.minHeight) + 1)) return false; const lh = parseFloat(cs.lineHeight) || parseFloat(cs.fontSize) * 1.2, inner = b.height - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom) - parseFloat(cs.borderTopWidth) - parseFloat(cs.borderBottomWidth); return inner > lh * 1.5; }).map(e => `${desc(e)} "${e.textContent.trim().slice(0, 30)}" ${Math.round(e.getBoundingClientRect().height)}px tall`);
        // text that overflows its own box (ellipsis or hidden): KPI values, bars, labels
        const cut = [...document.querySelectorAll('.kpi__v, .kpi__k, .hbar__l, .hbar__v, .pd-facts dd, .pd-title, .pd-pager__title, .pd-badge, .ctl-name, .seg button, .card h3')].filter(e => e.clientWidth && e.scrollWidth > e.clientWidth + 1).map(e => desc(e) + ` "${e.textContent.trim().slice(0, 40)}" ${e.scrollWidth}>${e.clientWidth}`);
        // SVG chart labels cut off by the svg's own box
        const svgCut = [...document.querySelectorAll('.dash svg text, .walk svg text')].filter(x => { const s = x.ownerSVGElement.getBoundingClientRect(), b = x.getBoundingClientRect(); return b.width && (b.left < s.left - 1 || b.right > s.right + 1 || b.top < s.top - 1 || b.bottom > s.bottom + 1); }).map(x => `"${x.textContent}" ${Math.round(x.getBoundingClientRect().left - x.ownerSVGElement.getBoundingClientRect().left)}..${Math.round(x.getBoundingClientRect().right - x.ownerSVGElement.getBoundingClientRect().right)}`);
        return { sw: document.documentElement.scrollWidth, inner: innerWidth, iw, wide, spill: spill.slice(0, 10), nSpill: spill.length, cut: cut.slice(0, 10), nCut: cut.length, svgCut: svgCut.slice(0, 10), thin, wrapped: wrapped.slice(0, 10), nWrapped: wrapped.length, collide, axisCut: axisCut.slice(0, 8), nAxisCut: axisCut.length, h: document.documentElement.scrollHeight };
      }, vp.width);
      check(`${tag}: no horizontal overflow (scrollWidth ${lay.sw}, innerWidth ${lay.inner} ≤ ${lay.iw}+1)`, lay.sw <= lay.iw + 1 && lay.inner <= lay.iw + 1, 'past the right edge: ' + lay.wide.join(', '));
      check(`${tag}: column charts — every bar has width, no row wider than its card`, !lay.thin.length, lay.thin.join(' ; '));
      if (lay.nWrapped) warn(`${tag}: one-line labels wrap`, `${lay.nWrapped}: ${lay.wrapped.join(' ; ')}`);
      if (lay.collide.length || lay.nAxisCut) warn(`${tag}: chart labels collide or are cut`, [...lay.collide, ...(lay.nAxisCut ? [`${lay.nAxisCut} axis labels cut: ${lay.axisCut.join(' ; ')}`] : [])].join(' ; '));
      check(`${tag}: no content spilling out of its box`, !lay.nSpill, `${lay.nSpill}: ${lay.spill.join(' ; ')}`);
      if (lay.nCut) warn(`${tag}: text truncated/clipped in its box`, `${lay.nCut}: ${lay.cut.join(' ; ')}`);
      check(`${tag}: chart/SVG labels inside their SVG`, !lay.svgCut.length, lay.svgCut.join(' ; '));
      if (await p.locator('#explore').count()) { // in-page anchor lands below the sticky bar
        await p.evaluate(() => { location.hash = ''; location.hash = '#explore'; }); await settle(p);
        const a = await p.evaluate(() => ({ h2: Math.round(document.querySelector('#explore h2').getBoundingClientRect().top), bar: Math.round(document.querySelector('.pd-bar').getBoundingClientRect().bottom), sec: Math.round(document.querySelector('#explore').getBoundingClientRect().top) }));
        check(`${tag}: #explore anchor lands below the sticky bar`, a.h2 >= a.bar && a.sec >= a.bar - 1, JSON.stringify(a));
      }
      await toTop(p);
      // let the poster finish its entrance (it resets when it leaves the screen) so the screenshot shows its final frame
      await p.evaluate(() => { const f = document.querySelector('.pd-hero__poster .work-poster'); if (!f) return; const fin = f.getAnimations({ subtree: true }).filter(a => a.effect && a.effect.getComputedTiming().iterations !== Infinity).map(a => a.finished.catch(() => {})); return Promise.race([Promise.all(fin), new Promise(r => setTimeout(r, 6000))]); });
      const file = path.join(QA, `${proj.slug}-${vp.width}x${vp.height}.png`);
      await p.screenshot({ path: file, fullPage: true });
      note(`${tag}: screenshot`, `${file} (page height ${lay.h}px)`);
      check(`${tag}: zero errors`, !errReport(t).length, errReport(t).join(' | '));
      if (t.pendingData.length) skip(`${tag}: dashboard`, 'data JSON 404 (pending)');
      await p.close();
    }
    await ctx.close();
  }
}

// ================================================================ 8. accessibility basics
if (run(8)) {
  section('8 · accessibility');
  const ctx = await context();
  let axeOk = null;
  for (const proj of P) {
    const tag = `8 ${proj.slug}`, p = await ctx.newPage(), t = track(p);
    await p.goto(pageUrl(proj));
    // keyboard: skip link first, then the back link with a visible focus ring
    await p.keyboard.press('Tab');
    const sk = await p.evaluate(() => { const a = document.activeElement, b = a.getBoundingClientRect(); return { cls: a.className, txt: a.textContent.trim(), vis: b.top >= 0 && b.bottom <= innerHeight && b.width > 0 }; });
    check(`${tag}: first Tab focuses a visible skip link`, /pd-skip/.test(sk.cls) && sk.vis, JSON.stringify(sk));
    await p.keyboard.press('Enter');
    await p.waitForFunction(() => location.hash === '#main', null, { timeout: 3000 }).catch(() => {});
    const onMain = await p.evaluate(() => { const m = document.getElementById('main'), a = document.activeElement; return { main: a === m, inside: m.contains(a), hash: location.hash }; });
    await p.keyboard.press('Tab');
    const next = await p.evaluate(() => { const a = document.activeElement; return { inside: document.getElementById('main').contains(a), el: a.tagName + '.' + a.className + ' "' + a.textContent.trim().slice(0, 30) + '"' }; });
    check(`${tag}: skip link moves focus to main (main focused, or next Tab lands inside main)`, onMain.main || onMain.inside || next.inside, `activeElement is main=${onMain.main} · hash ${onMain.hash} · next Tab → ${next.el} (inside main=${next.inside})`);
    if (!onMain.main) note(`${tag}: skip link`, '<main> itself does not take focus (no tabindex="-1"); the sequential focus start point moves there instead');
    await p.goto(pageUrl(proj));
    await p.keyboard.press('Tab'); await p.keyboard.press('Tab');
    const fb = await p.evaluate(() => { const a = document.activeElement, cs = getComputedStyle(a); return { isBack: a.matches('.pd-bar a.pd-back'), outline: `${cs.outlineStyle} ${cs.outlineWidth} ${cs.outlineColor}`, shadow: cs.boxShadow, fv: a.matches(':focus-visible') }; });
    check(`${tag}: second Tab focuses "All projects" with a visible focus indicator`, fb.isBack && ((fb.outline.split(' ')[0] !== 'none' && parseFloat(fb.outline.split(' ')[1]) > 0) || (fb.shadow && fb.shadow !== 'none')), JSON.stringify(fb));
    await scrollThrough(p);
    const a = await p.evaluate(() => {
      const name = e => (e.getAttribute('aria-label') || (e.getAttribute('aria-labelledby') || '').split(/\s+/).filter(Boolean).map(id => (document.getElementById(id) || {}).textContent || '').join(' ') || e.textContent || [...e.querySelectorAll('img[alt]')].map(i => i.alt).join(' ') || e.getAttribute('title') || '').replace(/\s+/g, ' ').trim();
      const ctl = [...document.querySelectorAll('a[href], button')];
      const hs = [...document.querySelectorAll('h1,h2,h3,h4,h5,h6')].map(h => ({ l: +h.tagName[1], t: h.textContent.trim().slice(0, 40) }));
      const skips = hs.map((h, k) => k && h.l > hs[k - 1].l + 1 ? `${hs[k - 1].t}(h${hs[k - 1].l}) → ${h.t}(h${h.l})` : null).filter(Boolean);
      return {
        lang: document.documentElement.getAttribute('lang'), h1: hs.filter(h => h.l === 1).length, first: hs[0] && hs[0].l, skips,
        noName: ctl.filter(e => !name(e)).map(e => e.outerHTML.slice(0, 120)), nCtl: ctl.length,
        hiddenFocus: [...document.querySelectorAll('[aria-hidden="true"] a[href], [aria-hidden="true"] button, [aria-hidden="true"] [tabindex]')].map(e => e.outerHTML.slice(0, 80)),
        heroBadges: [...document.querySelectorAll('.pd-badges .pd-badge')].map(b => ({ kind: (b.className.match(/pd-badge--(\w+)/) || [])[1], k: b.querySelector('.pd-badge__k').textContent.trim(), label: b.textContent.trim() })),
        figTags: [...document.querySelectorAll('.pd-fig')].map(f => (f.querySelector('.pd-badge__k') || {}).textContent || '(none)')
      };
    });
    check(`${tag}: <html lang> set`, !!a.lang, a.lang);
    check(`${tag}: single h1, first heading is the h1`, a.h1 === 1 && a.first === 1, `h1 count ${a.h1}, first h${a.first}`);
    check(`${tag}: no heading-level skips`, !a.skips.length, a.skips.join(' ; '));
    check(`${tag}: all ${a.nCtl} links/buttons have an accessible name`, !a.noName.length, a.noName.join(' | '));
    check(`${tag}: nothing focusable inside aria-hidden`, !a.hiddenFocus.length, a.hiddenFocus.join(' | '));
    const want = proj.experience.map(x => ({ kind: x.kind, k: BADGE[x.kind] }));
    const got = a.heroBadges.map(b => ({ kind: b.kind, k: b.k }));
    const texts = new Set(a.heroBadges.map(b => b.k));
    check(`${tag}: hero badges say ${want.map(w => w.k).join(' / ')} in words (distinct per kind)`, JSON.stringify(got) === JSON.stringify(want) && texts.size === new Set(want.map(w => w.kind)).size, a.heroBadges.map(b => b.label).join(' · '));
    if (a.figTags.length) check(`${tag}: every screenshot figure carries a "Screenshot" badge`, a.figTags.every(x => x === 'Screenshot'), a.figTags.join(','));
    // axe-core (serious/critical = FAIL)
    if (axeOk !== false) {
      try { await p.addScriptTag({ url: AXE }); axeOk = await p.evaluate(() => !!window.axe); } catch (e) { axeOk = false; }
    }
    if (!axeOk) skip(`${tag}: axe-core`, 'could not load axe-core from the CDN');
    else {
      const v = await p.evaluate(async () => (await window.axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'best-practice'] }, resultTypes: ['violations'] })).violations.map(x => ({ id: x.id, impact: x.impact, n: x.nodes.length, t: x.nodes.slice(0, 3).map(nd => nd.target.join(' ') + (nd.any[0] && nd.any[0].data && nd.any[0].data.contrastRatio ? ` (${nd.any[0].data.contrastRatio}:1 ${nd.any[0].data.fgColor} on ${nd.any[0].data.bgColor})` : '')).join(' , ') })));
      const sev = v.filter(x => x.impact === 'serious' || x.impact === 'critical'), rest = v.filter(x => !sev.includes(x));
      check(`${tag}: axe-core — 0 serious/critical violations`, !sev.length, sev.map(x => `${x.id}(${x.impact}, ${x.n}: ${x.t})`).join('; '));
      if (rest.length) note(`${tag}: axe moderate/minor`, rest.map(x => `${x.id}(${x.impact}, ${x.n}: ${clip(x.t, 120)})`).join('; '));
    }
    check(`${tag}: zero errors`, !errReport(t).length, errReport(t).join(' | '));
    await p.close();
  }
  await ctx.close();
  // reduced motion: dashboards and the walkthrough still render, no errors
  const rm = await context(DESK, { reducedMotion: 'reduce' });
  for (const proj of P.filter(q => dashesOf(q).length || walkOf(q))) {
    const tag = `8 reduced motion · ${proj.slug}`, p = await rm.newPage(), t = track(p);
    await p.goto(pageUrl(proj));
    const playing = await p.waitForSelector('.pd-hero__poster .work-poster.is-play', { timeout: 6000 }).then(() => true, () => false);
    await scrollThrough(p);
    const sel = walkOf(proj) ? '[data-walk]' : `[data-dash="${dashesOf(proj)[0].id}"]`, state = await dashState(p, sel);
    const vt = await p.evaluate(() => matchMedia('(prefers-reduced-motion: reduce)').matches);
    if (state !== 'ready' && t.pendingData.length) skip(`${tag}: renders`, 'data JSON 404 (pending)');
    else check(`${tag}: renders (${sel}) with prefers-reduced-motion`, vt && state === 'ready' && playing, `media matches=${vt} state=${state} poster is-play=${playing}`);
    check(`${tag}: zero errors`, !errReport(t).length, errReport(t).join(' | '));
    await p.close();
  }
  await rm.close();
}

// ================================================================ 9. home page rows + index.html diff review
function tokens(s) { return s.match(/[A-Za-z0-9_-]+|\s+|[^A-Za-z0-9_\s-]/g) || []; }
function diffTokens(a, b) { // Myers O(ND); returns edit regions {a0,a1,b0,b1} in token indices
  const n = a.length, m = b.length, max = n + m, off = max + 1, v = new Int32Array(2 * max + 3), trace = [];
  let D = -1;
  outer: for (let d = 0; d <= max; d++) {
    if (d > 6000) return null;
    trace.push(v.slice(off - d - 1, off + d + 2));
    for (let k = -d; k <= d; k += 2) {
      let x = (k === -d || (k !== d && v[off + k - 1] < v[off + k + 1])) ? v[off + k + 1] : v[off + k - 1] + 1, y = x - k;
      while (x < n && y < m && a[x] === b[y]) { x++; y++; }
      v[off + k] = x;
      if (x >= n && y >= m) { D = d; break outer; }
    }
  }
  const ops = []; let x = n, y = m;
  for (let d = D; d > 0; d--) {
    const V = trace[d], at = k => V[k + d + 1], k = x - y;
    const down = k === -d || (k !== d && at(k - 1) < at(k + 1)), pk = down ? k + 1 : k - 1, px = at(pk), py = px - pk;
    ops.push(down ? { op: '+', a: px, b: py } : { op: '-', a: px, b: py });
    x = px; y = py;
  }
  ops.reverse();
  const regs = [];
  for (const o of ops) {
    const r = regs[regs.length - 1];
    if (r && o.a === r.a1 && o.b === r.b1) { if (o.op === '-') r.a1++; else r.b1++; }
    else regs.push(o.op === '-' ? { a0: o.a, a1: o.a + 1, b0: o.b, b1: o.b } : { a0: o.a, a1: o.a, b0: o.b, b1: o.b + 1 });
  }
  return regs;
}
function classify(oldHtml, off, del, ins) {
  const secStart = oldHtml.indexOf('<section class="section projects" id="projects"'), secEnd = secStart >= 0 ? oldHtml.indexOf('</section>', secStart) + 10 : -1;
  if (secStart >= 0 && off >= secStart && off < secEnd) return { where: 'Project Section markup', ok: true };
  const inBlock = tag => { const o = oldHtml.lastIndexOf('<' + tag, off), c = oldHtml.lastIndexOf('</' + tag + '>', off); return o > c; };
  const txt = del + ' ' + ins;
  if (inBlock('style')) {
    const open = oldHtml.lastIndexOf('{', off), close = oldHtml.lastIndexOf('}', off);
    const sel = open > close ? oldHtml.slice(oldHtml.lastIndexOf('}', open) + 1, open) : oldHtml.slice(close + 1, oldHtml.indexOf('{', off));
    const ok = PROJECT_RE.test(sel) || PROJECT_RE.test(txt);
    return { where: `CSS (rule "${clip(sel.replace(/\s+/g, ' ').trim(), 90)}")`, ok };
  }
  if (inBlock('script')) {
    const ctx = oldHtml.slice(Math.max(0, off - 600), off + 600);
    const ok = /workIndex|work-row|work-poster|siteHooks\.project|projects\//.test(ctx) || PROJECT_RE.test(txt);
    return { where: 'JS', ok };
  }
  if (/view-transition/.test(txt)) return { where: 'markup (view transition)', ok: true };
  return { where: 'markup outside the Project Section', ok: false };
}
if (run(9)) {
  section('9 · home page rows + index.html diff');
  const ctx = await context(), p = await ctx.newPage(), t = track(p);
  await gotoHome(p);
  const rows = await p.evaluate(() => [...document.querySelectorAll('#projects a.work-row')].map(a => ({ i: +a.dataset.i, raw: a.getAttribute('href'), href: a.href, target: a.getAttribute('target'), rel: a.getAttribute('rel'), name: a.textContent.replace(/\s+/g, ' ').trim().slice(0, 60) })));
  check('9 home: five .work-row links in #projects', rows.length === N, rows.length + ' rows');
  for (const r of rows) {
    const q = P[r.i];
    check(`9 home row ${r.i + 1} → projects/${q && q.slug}/ in the same tab`, q && r.href === pageUrl(q) && r.target !== '_blank', `href="${r.raw}" target=${r.target} rel=${r.rel}`);
  }
  if (rows.length && rows[0].href === pageUrl(P[0]) && rows[0].target !== '_blank') {
    const pages0 = ctx.pages().length;
    await toRow(p, 0);
    const ok = await Promise.all([p.waitForURL(pageUrl(P[0]), { timeout: 10000 }), p.locator(rowSel(0)).click()]).then(() => true, e => e.message.split('\n')[0]);
    check('9 clicking a row opens the case study in the same tab (no new page)', ok === true && ctx.pages().length === pages0, `${ok === true ? p.url() : ok} · pages ${pages0} → ${ctx.pages().length}`);
  } else skip('9 same-tab click', 'row 1 does not link to its case study yet');
  check('9 home: zero JS errors on load and row click', !t.errors.filter(e => /^pageerror/.test(e)).length, t.errors.join(' | '));
  if (t.errors.some(e => !/^pageerror/.test(e)) || t.failed.length) note('9 home: console/network noise', [...t.errors, ...t.failed].join(' | '));
  await ctx.close();

  const sm = readFileSync(path.join(ROOT, 'sitemap.xml'), 'utf8'), missing = P.map(q => `${CONTENT.site}projects/${q.slug}/`).filter(u => !sm.includes(`<loc>${u}</loc>`));
  check('9 sitemap.xml lists all five case studies', !missing.length, missing.join(', '));
  // diff review: every hunk, every changed span, classified
  const git = args => spawnSync('git', args, { cwd: ROOT, encoding: 'utf8', maxBuffer: 256 << 20 });
  const status = git(['status', '--short']).stdout.trim();
  note('9 git status (context)', status.replace(/\n/g, ' · '));
  const BASE_REF = process.env.PD_BASE || 'HEAD';
  note('9 index.html diff base', BASE_REF + ' (' + git(['log', '-1', '--format=%h %s', BASE_REF]).stdout.trim() + ')');
  const raw = git(['diff', '--unified=0', BASE_REF, '--', 'index.html']).stdout;
  const oldHtml = git(['show', BASE_REF + ':index.html']).stdout, newHtml = readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  const oldLines = oldHtml.split('\n'), newLines = newHtml.split('\n');
  const lineOff = []; { let o = 0; for (const l of oldLines) { lineOff.push(o); o += l.length + 1; } }
  const hunks = [...raw.matchAll(/^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/gm)].map(m => ({ a: +m[1], an: m[2] === undefined ? 1 : +m[2], b: +m[3], bn: m[4] === undefined ? 1 : +m[4] }));
  if (!hunks.length) note('9 index.html diff', 'no changes against ' + BASE_REF);
  const risky = [];
  for (const h of hunks) {
    const oldTxt = h.an ? oldLines.slice(h.a - 1, h.a - 1 + h.an).join('\n') : '', newTxt = h.bn ? newLines.slice(h.b - 1, h.b - 1 + h.bn).join('\n') : '';
    const base = h.an ? lineOff[h.a - 1] : (h.a < oldLines.length ? lineOff[h.a] : oldHtml.length);
    const ta = tokens(oldTxt), tb = tokens(newTxt), pa = [0], pb = [0];
    ta.forEach(x => pa.push(pa[pa.length - 1] + x.length)); tb.forEach(x => pb.push(pb[pb.length - 1] + x.length));
    const regs = (diffTokens(ta, tb) || [{ a0: 0, a1: ta.length, b0: 0, b1: tb.length }]).reduce((acc, r) => { // join edits less than ~60 unchanged chars apart
      const l = acc[acc.length - 1];
      if (l && pa[r.a0] - pa[l.a1] < 60) { l.a1 = r.a1; l.b1 = r.b1; } else acc.push({ ...r });
      return acc;
    }, []);
    console.log(`  hunk @@ -${h.a},${h.an} +${h.b},${h.bn} @@  (${regs.length} changed span${regs.length === 1 ? '' : 's'})`);
    for (const r of regs) {
      const off = base + pa[r.a0], del = ta.slice(r.a0, r.a1).join(''), ins = tb.slice(r.b0, r.b1).join('');
      const c = classify(oldHtml, off, del, ins), ctxL = oldHtml.slice(Math.max(0, off - 50), off).replace(/\s+/g, ' ');
      const line = `[${c.ok ? 'in scope' : 'REGRESSION RISK'}] ${c.where} · L${h.a} · …${ctxL}⟦-${clip(del, 300)}⟧⟦+${clip(ins, 300)}⟧`;
      console.log('    ' + line);
      if (!c.ok) risky.push(line);
    }
  }
  check('9 index.html: every change is inside the Project Section markup/CSS/JS (or the expected view-transition bits)', !risky.length, risky.join(' || '));
}

// ================================================================ 10. weight
if (run(10)) {
  section('10 · weight (same-origin bytes at load, before any scrolling)');
  const ctx = await context();
  const gz = b => zlib.gzipSync(b, { level: 9 }).length, kb = n => (n / 1024).toFixed(1) + ' KB';
  for (const proj of P) {
    const p = await ctx.newPage(), reqs = [];
    p.on('requestfinished', r => reqs.push(r));
    await p.goto(pageUrl(proj), { waitUntil: 'load' }); await p.waitForLoadState('networkidle').catch(() => {});
    const by = {}, data = []; let raw = 0, zipped = 0;
    for (const r of reqs) {
      const u = r.url(); if (!u.startsWith(ORIGIN)) continue;
      const res = await r.response(); if (!res) continue;
      const body = await res.body().catch(() => Buffer.alloc(0)), type = r.resourceType();
      if (u.startsWith(DATA_PREFIX)) { data.push(`${u.slice(DATA_PREFIX.length)} ${kb(body.length)}`); continue; }
      const z = /document|stylesheet|script|fetch|xhr/.test(type) || /\.(svg|json|css|js|html)$/.test(u) ? gz(body) : body.length;
      raw += body.length; zipped += z;
      by[type] = (by[type] || 0) + body.length;
    }
    note(`10 ${proj.slug}`, `${kb(raw)} raw, ≈${kb(zipped)} gzipped (text gzipped, images as is) · ` + Object.entries(by).map(([k, v]) => `${k} ${kb(v)}`).join(' · ') + (data.length ? ` · data fetched at load (not counted): ${data.join(', ')}` : ''));
    if (raw > 1024 * 1024) warn(`10 ${proj.slug}: page weight`, `${kb(raw)} at load`);
    await p.close();
  }
  await ctx.close();
  for (const proj of P) for (const d of dashesOf(proj)) {
    const u = DATA_PREFIX + d.data;
    try {
      const r = await fetch(u);
      if (r.status === 404) { skip(`10 data ${d.data}`, '404 (not there yet)'); continue; }
      const b = Buffer.from(await r.arrayBuffer());
      let valid = true; try { JSON.parse(b.toString('utf8')); } catch (e) { valid = false; }
      check(`10 data ${d.data}: HTTP 200, valid JSON`, r.ok && valid, `${kb(b.length)} raw, ≈${kb(gz(b))} gzipped`);
      if (gz(b) > 300 * 1024) warn(`10 data ${d.data}: heavy`, `${kb(gz(b))} gzipped`);
    } catch (e) { check(`10 data ${d.data}`, false, String(e)); }
  }
}

await browser.close();
const count = st => results.filter(r => r.st === st).length;
const fails = results.filter(r => r.st === 'FAIL');
if (fails.length) { console.log('\nFAILURES:'); fails.forEach(f => console.log(`  - ${f.name}  ${f.info}`)); }
console.log(`\n${count('PASS')} passed, ${fails.length} failed, ${count('SKIP')} skipped, ${count('WARN')} warnings · screenshots in ${QA}`);
process.exit(fails.length ? 1 : 0);
