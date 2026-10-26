/* SHK JAVED, the portfolio's AI guide: boot loader (Experience).
   Loaded with `defer`. While the hero is on screen it only listens: no CSS, no images and no other scripts load.
   When the visitor leaves the hero, it injects tw.css, slides the poster dock in once per session and mounts the pangolin.
   The panel (tw-app.js), engine.js and knowledge.json load on the first hover, focus or click on an opener.
   Globals: window.SHKTwin only. State: sessionStorage "tw:v1" (tab only, never sent anywhere). */
(function () {
  'use strict';
  var w = window, d = document;
  if (w.SHKTwin || !d.querySelector) return;

  var me = d.currentScript, BASE = me && me.src ? me.src.replace(/[^\/]*$/, '') : 'twin/';
  var KEY = 'tw:v1', RMQ = w.matchMedia ? w.matchMedia('(prefers-reduced-motion: reduce)') : null;
  var INTERACTIVE = 'a[href],button,input,select,textarea,summary,label,[tabindex]:not([tabindex="-1"]),[contenteditable="true"],.cert-foot';
  var rm = function () { return !!(RMQ && RMQ.matches); };

  function read() { try { return JSON.parse(sessionStorage.getItem(KEY)) || {}; } catch (e) { return {}; } }
  function save(patch) {
    var s = read(), k;
    for (k in patch) s[k] = patch[k];
    try { sessionStorage.setItem(KEY, JSON.stringify(s)); } catch (e) { /* private mode: work without persistence */ }
    return s;
  }

  var cache = {};
  function js(src) {
    return cache[src] || (cache[src] = new Promise(function (ok, fail) {
      var s = d.createElement('script');
      s.src = BASE + src; s.async = true;
      s.onload = ok;
      s.onerror = function () { delete cache[src]; s.remove(); fail(new Error('tw: could not load ' + src)); };
      d.head.appendChild(s);
    }));
  }
  function json(src) {
    return cache[src] || (cache[src] = fetch(BASE + src, { credentials: 'same-origin' })
      .then(function (r) { if (!r.ok) throw new Error('tw: ' + src + ' ' + r.status); return r.json(); })
      .catch(function (e) { delete cache[src]; throw e; }));
  }
  function css() {
    return cache.css || (cache.css = new Promise(function (ok) {
      var l = d.createElement('link');
      l.rel = 'stylesheet'; l.href = BASE + 'tw.css';
      l.onload = ok; l.onerror = ok;
      d.head.appendChild(l);
    }));
  }

  var state = read(), ui = null, pet = null, petReady = null, app = null, appReady = null, engineReady = null;
  var zone = 'hero', mode = 'full', sampleTimer = 0, hintTimer = 0;

  /* ---------- live region (outside the panel, so it survives "hide") ---------- */
  function announce(text) {
    if (!ui) return;
    ui.live.textContent = '';
    setTimeout(function () { ui.live.textContent = text; }, 60);
  }

  /* ---------- dock ---------- */
  function build() {
    if (ui) return ui;
    var root = d.createElement('div');
    root.className = 'tw-root';
    root.id = 'tw-root';
    root.setAttribute('data-zone', zone);
    root.innerHTML =
      '<div class="tw-spot" aria-hidden="true"></div>' +
      '<div class="tw-dock" data-mode="full">' +
        '<span class="tw-hint" aria-hidden="true">Ask me about Javed</span>' +
        '<button type="button" class="tw-dock__btn" aria-expanded="false" aria-controls="tw-panel" aria-label="Ask SHK JAVED, an AI guide to Javed’s work">' +
          '<span class="tw-stage" aria-hidden="true"><span class="tw-pet">' +
            '<span class="tw-disc"></span>' +
            '<img class="tw-poster" src="' + BASE + 'sprites/poster.webp" alt="" width="96" height="104" decoding="async">' +
          '</span></span>' +
        '</button>' +
      '</div>' +
      '<p class="tw-sr" id="tw-live" aria-live="polite"></p>';
    d.body.appendChild(root);
    ui = {
      root: root,
      dock: root.querySelector('.tw-dock'),
      btn: root.querySelector('.tw-dock__btn'),
      stage: root.querySelector('.tw-stage'),
      petHost: root.querySelector('.tw-pet'),
      hint: root.querySelector('.tw-hint'),
      spot: root.querySelector('.tw-spot'),
      live: root.querySelector('#tw-live')
    };
    ui.btn.addEventListener('click', function () { toggle(ui.btn); });
    ui.btn.addEventListener('pointerenter', prefetch, { passive: true });
    ui.btn.addEventListener('focus', prefetch);
    ui.btn.addEventListener('pointerenter', function (e) { if (e.pointerType === 'mouse') attend(true); });
    ui.btn.addEventListener('pointerleave', function (e) { if (e.pointerType === 'mouse') attend(false); });
    ui.btn.addEventListener('focus', function () { attend(true); });
    ui.btn.addEventListener('blur', function () { attend(false); });
    ui.btn.addEventListener('keydown', function (e) { if (e.key === 'Escape' && app && app.isOpen()) { e.preventDefault(); app.close(true); } });
    return ui;
  }

  function mountPet() {
    if (petReady) return petReady;
    petReady = Promise.all([js('pangolin.js'), json('sprites/manifest.json')]).then(function (r) {
      if (!w.SHKPangolin) throw new Error('tw: SHKPangolin missing');
      pet = w.SHKPangolin.mount(ui.petHost, { manifest: r[1], base: BASE + 'sprites/' }); // tracks reduced motion itself
      return Promise.resolve(pet.preload(['idle', 'wave'])).then(function () {
        ui.stage.classList.add('is-live');
        return pet;
      });
    }).catch(function (e) {
      pet = null;
      if (w.console) console.warn(e && e.message ? e.message : e);
      return null; // the poster stays: a still guide is still a guide
    });
    return petReady;
  }


  /* ---------- state-driven life while docked (no conversation running) ----------
     attentive: a hover or keyboard focus on the dock makes the pet look up toward the page;
     ambient: every 11–16 s an idle, docked pet glances around once, then settles;
     delight: copying Javed's email in Contact earns one small jump (at most every 30 s).
     All of it stops under reduced motion, while the hero is on screen, while the panel is open or the tab is hidden. */
  // Look from the pet toward a viewport point (0° = up, clockwise). The 150°–210° frames hide the face, so they snap to 135° / 225°.
  function lookToward(x, y) {
    if (!pet || !ui) return;
    var r = ui.stage.getBoundingClientRect(), cx = r.left + r.width / 2, cy = r.top + r.height * 0.3;
    var deg = (Math.atan2(x - cx, cy - y) * 180 / Math.PI + 360) % 360;
    if (deg > 150 && deg < 210) deg = deg < 180 ? 135 : 225;
    pet.look(deg);
  }
  var lifeTimer = 0, lastDelight = 0;
  function calm() { return !!pet && !rm() && !d.hidden && zone === 'page' && mode === 'full' && !state.hidden && !(app && app.isOpen()); }
  function scheduleLife() {
    clearTimeout(lifeTimer);
    lifeTimer = setTimeout(function () {
      if (calm() && pet.state === 'idle') {
        pet.look([247.5, 270, 292.5, 315][Math.floor(Math.random() * 4)]);
        setTimeout(function () { if (pet && pet.state === 'look' && calm()) pet.idle(); }, 1300);
      }
      scheduleLife();
    }, 11000 + Math.random() * 5000);
  }
  function attend(on) {
    if (!calm()) return;
    if (on && pet.state === 'idle') pet.look(315);
    else if (!on && pet.state === 'look') pet.idle();
  }
  d.addEventListener('click', function (e) {
    if (!e.target || !e.target.closest || !e.target.closest('.contact__copy')) return;
    var now = Date.now();
    if (!pet || rm() || now - lastDelight < 30000 || zone !== 'page') return;
    lastDelight = now;
    Promise.resolve(pet.preload(['jump'])).then(function (ok) { if (ok && pet) pet.play('jump', { loop: false }); }, function () {});
  });

  function showHint(ms) {
    if (!ui || (app && app.isOpen())) return;
    clearTimeout(hintTimer);
    ui.dock.classList.add('is-hinting');
    hintTimer = setTimeout(function () { ui.dock.classList.remove('is-hinting'); }, ms || 4500);
  }

  var arrived = false;
  function arrive() {
    if (arrived || state.hidden) return;
    arrived = true;
    css().then(function () {
      build();
      var first = !state.entered;
      state = save({ entered: true });
      var greet = function () {
        mountPet().then(function (p) {
          if (!p) { if (first) showHint(); return; }
          if (first && !rm()) {
            p.play('wave'); // a one-shot: the pet returns to idle by itself
            showHint();
          } else {
            p.idle();
          }
          if (zone === 'hero') p.pause();
          scheduleLife();
        });
      };
      if (first && !rm()) {
        ui.dock.classList.add('is-entering');
        var done = false, finish = function () {
          if (done) return; done = true;
          ui.dock.classList.remove('is-entering');
          greet();
        };
        ui.dock.addEventListener('animationend', finish, { once: true });
        setTimeout(finish, 1400); // if animations are off or interrupted
      } else {
        greet();
      }
      watchCover();
      if (state.open && !d.querySelector('dialog[open]')) prefetch().then(function (a) { if (a) a.open(null, { focus: false }); });
    });
  }

  /* ---------- zone: hidden while the hero film owns the screen ---------- */
  function setZone(z) {
    zone = z;
    if (ui) {
      ui.root.setAttribute('data-zone', z);
      if (pet) { if (z === 'hero' && !(app && app.isOpen())) pet.pause(); else pet.resume(); }
    }
    if (z === 'page') arrive();
  }
  function watchZone() {
    var hero = d.getElementById('hero');
    if (!hero || !('IntersectionObserver' in w)) { setZone('page'); return; }
    // The hero counts as "on screen" while it still covers the bottom quarter of the viewport.
    new IntersectionObserver(function (entries) {
      setZone(entries[entries.length - 1].isIntersecting ? 'hero' : 'page');
    }, { rootMargin: '-75% 0px 0px 0px' }).observe(hero);
  }

  /* ---------- dock avoidance: compact to a tab over interactive content ---------- */
  function hits(left, top, right, bottom) {
    // A dense grid (about every 18px) so small links such as "back to top" are caught.
    var cols = Math.max(2, Math.ceil((right - left) / 18)), rows = Math.max(2, Math.ceil((bottom - top) / 18));
    for (var i = 0; i <= cols; i++) for (var j = 0; j <= rows; j++) {
      var x = left + 3 + (right - left - 6) * i / cols, y = top + 3 + (bottom - top - 6) * j / rows;
      if (x < 0 || y < 0 || x >= w.innerWidth || y >= w.innerHeight) continue;
      var stack = d.elementsFromPoint(x, y);
      for (var k = 0; k < stack.length; k++) {
        var el = stack[k];
        if (ui.root.contains(el)) continue;
        if (el === d.body || el === d.documentElement) break;
        if (el.closest(INTERACTIVE)) return true;
      }
    }
    return false;
  }
  function pinned() {
    var stage = d.querySelector('.cert-stage');
    if (!stage) return false;
    var sr = stage.getBoundingClientRect();
    return sr.top <= 1 && sr.bottom >= w.innerHeight - 1 && getComputedStyle(stage).position === 'sticky';
  }
  function setTabY(px) { ui.dock.style.setProperty('--tw-tab-y', px ? -px + 'px' : '0px'); }
  function setMode(m) {
    if (m === mode) return;
    mode = m;
    ui.dock.setAttribute('data-mode', m);
  }
  var narrow = w.matchMedia('(max-width: 560px)');
  function sample() {
    sampleTimer = 0;
    if (!ui || zone === 'hero' || (app && app.isOpen())) return;
    var r = ui.dock.getBoundingClientRect();
    // Phones: the full dock would sit on body text, so the compact tab is the default there.
    if (!narrow.matches && !pinned() && !hits(r.left, r.top, r.right, r.bottom)) { setMode('full'); setTabY(0); return; }
    setMode('tab');
    // Find a free spot for the 48px tab along the right edge, stepping up from the dock.
    var vw = w.innerWidth, limit = w.innerHeight * 0.55;
    for (var dy = 0; dy <= limit; dy += 64) {
      if (!hits(vw - 48, r.bottom - 56 - dy, vw, r.bottom - dy)) { setTabY(dy); return; }
    }
    setTabY(0);
  }
  var watching = false;
  function watchCover() {
    if (watching) { sample(); return; }
    watching = true;
    var settle = 0, queue = function () {
      if (!sampleTimer) sampleTimer = setTimeout(sample, 200);
      clearTimeout(settle); settle = setTimeout(sample, 800); // re-check once scroll-linked reveals have finished
    };
    w.addEventListener('scroll', queue, { passive: true });
    w.addEventListener('resize', queue, { passive: true });
    sample();
  }

  /* ---------- panel loading ---------- */
  function prefetch() {
    if (appReady) return appReady;
    if (!engineReady) engineReady = Promise.all([js('engine.js'), json('knowledge.json')]).then(function (r) {
      if (!w.SHKTwinEngine) throw new Error('tw: SHKTwinEngine missing');
      return { E: w.SHKTwinEngine, kb: r[1] };
    });
    engineReady.catch(function () {}); // the app shows its own fallback
    appReady = Promise.all([css(), js('tw-app.js')]).then(function () {
      build();
      app = w.SHKTwin.__app(kit);
      return app;
    }).catch(function (e) {
      appReady = null;
      if (w.console) console.warn(e && e.message ? e.message : e);
      return null;
    });
    return appReady;
  }

  function open(opener, opts) {
    if (state.hidden) { state = save({ hidden: false }); }
    build();
    ui.root.hidden = false;
    if (!arrived) arrive();
    if (ui.btn) ui.btn.setAttribute('aria-busy', 'true');
    return prefetch().then(function (a) {
      ui.btn.removeAttribute('aria-busy');
      if (!a) { announce('The guide could not load. Every section is still on the page.'); return null; }
      a.open(opener || ui.btn, opts);
      return a;
    });
  }
  function toggle(opener) {
    if (app && app.isOpen()) { app.close(true); return; }
    open(opener);
  }

  var kit = {
    base: BASE, js: js, json: json, read: read, save: save, rm: rm, announce: announce,
    ui: function () { return ui; },
    pet: function () { return pet; },
    lookToward: lookToward,
    petReady: function () { return petReady || mountPet(); },
    engine: function () { return engineReady; },
    setMode: function (m) { if (ui) setMode(m); },
    sample: function () { if (ui) sample(); },
    showHint: showHint,
    hide: function () {
      state = save({ hidden: true, open: false });
      if (ui) ui.root.hidden = true;
      if (pet) pet.pause();
      arrived = false;
    }
  };

  w.SHKTwin = {
    version: '1.0.0',
    open: function (opener) { return open(opener); },
    close: function () { if (app) app.close(true); },
    __app: null // filled by tw-app.js
  };

  /* ---------- openers: the dock and any [data-tw-open] element ---------- */
  d.addEventListener('click', function (e) {
    var t = e.target && e.target.closest ? e.target.closest('[data-tw-open]') : null;
    if (!t || (ui && ui.root.contains(t))) return;
    e.preventDefault();
    open(t);
  });
  ['pointerover', 'focusin'].forEach(function (type) {
    d.addEventListener(type, function (e) {
      if (e.target && e.target.closest && e.target.closest('[data-tw-open]')) prefetch();
    }, { passive: true });
  });

  function start() {
    watchZone();
    // Warm the 8 KB poster once the page (and the hero film) has settled, so the entrance never waits on it.
    var warm = function () { if (!state.hidden) { var i = new Image(); i.decoding = 'async'; i.src = BASE + 'sprites/poster.webp'; } };
    var idle = w.requestIdleCallback || function (f) { return setTimeout(f, 1200); };
    if (d.readyState === 'complete') idle(warm, { timeout: 4000 });
    else w.addEventListener('load', function () { idle(warm, { timeout: 4000 }); }, { once: true });
  }
  if (d.readyState === 'loading') d.addEventListener('DOMContentLoaded', start, { once: true });
  else start();
})();
