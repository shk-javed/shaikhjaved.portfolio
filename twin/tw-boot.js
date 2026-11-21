/* SHK JAVED, the portfolio's AI guide: boot loader (Experience).
   Loaded with `defer`. While the hero is on screen it only listens: no CSS, no images and no other scripts load.
   When the visitor leaves the hero, it injects tw.css, slides the poster dock in once per session and mounts the pangolin.
   The panel (tw-app.js), engine.js and knowledge.json load on the first hover, focus or click on an opener.
   Globals: window.SHKTwin only. State: sessionStorage "tw:v1" (tab only, never sent anywhere).
   Optional phrasing endpoint: data-tw-endpoint on this script tag (https only; http://localhost / 127.0.0.1 for testing).
   Empty = everything stays on the page. */
(function () {
  'use strict';
  var w = window, d = document;
  if (w.SHKTwin || !d.querySelector) return;

  var me = d.currentScript, BASE = me && me.src ? me.src.replace(/[^\/]*$/, '') : 'twin/';
  var KEY = 'tw:v1', RMQ = w.matchMedia ? w.matchMedia('(prefers-reduced-motion: reduce)') : null;
  var INTERACTIVE = 'a[href],button,input,select,textarea,summary,label,[tabindex]:not([tabindex="-1"]),[contenteditable="true"],.cert-foot';
  var rm = function () { return !!(RMQ && RMQ.matches); };
  // The Gemini phrasing proxy (tw-app.js uses it only for verified answers, and never in Local mode).
  var ENDPOINT = (function (tag) {
    var raw = tag && tag.dataset ? String(tag.dataset.twEndpoint || '').trim() : '';
    if (!raw) return '';
    try {
      var u = new URL(raw);
      if (u.username || u.password) return '';
      if (u.protocol === 'https:' || (u.protocol === 'http:' && (u.hostname === 'localhost' || u.hostname === '127.0.0.1'))) return u.href;
    } catch (e) { /* not a URL: stay local */ }
    return '';
  })(d.querySelector('script[src$="tw-boot.js"]') || me);

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
  // Written at once, so the region is never left empty mid-update; a repeat of the same message gets a trailing
  // no-break space so screen readers still hear it.
  function announce(text) {
    if (!ui || !text) return;
    ui.live.textContent = ui.live.textContent === text ? text + ' ' : text;
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
      '<div class="tw-strip" aria-hidden="true"></div>' +
      '<div class="tw-scan" aria-hidden="true"><span class="tw-scan__label">Evidence scan</span></div>' +
      '<p class="tw-say" aria-hidden="true"></p>' +
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
      scan: root.querySelector('.tw-scan'),
      say: root.querySelector('.tw-say'),
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
  // Speech bubble: decorative (aria-hidden) one-liners beside wherever the pet stands right now. Lines queue: each
  // stays at least 1.6 s before the next replaces it (reduced motion: same timing, no animation).
  // hush(true) ends the current line once it has had its 1.6 s; hush() clears at once.
  var sayTimer = 0, sayWait = 0, sayTok = 0, sayQ = [], cur = null, placer = null;
  function hush(soft) {
    if (!ui) return;
    sayQ.length = 0; clearTimeout(sayWait);
    if (soft && cur) { cur.ms = Math.min(cur.ms, 1600); arm(); return; }
    cur = null; sayTok++; clearTimeout(sayTimer); ui.say.classList.remove('is-on');
  }
  function say(text, ms) {
    if (!ui || !text) return;
    sayQ.push([text, ms || 2600]);
    if (sayQ.length > 2) sayQ.shift();
    pump();
  }
  function pump() {
    clearTimeout(sayWait);
    if (!sayQ.length) return;
    var left = cur ? (cur.at || Date.now()) + 1600 - Date.now() : 0;
    if (left > 0) { sayWait = setTimeout(pump, left); return; }
    var c = cur = { text: sayQ[0][0], ms: sayQ.shift()[1], at: 0 }, tok = ++sayTok;
    clearTimeout(sayTimer);
    ui.say.classList.remove('is-on');
    // Two frames later: the phone sheet may still be growing with a new answer, and the pet rides on its header.
    requestAnimationFrame(function () { requestAnimationFrame(function () { if (tok === sayTok) { c.at = Date.now(); place(c.text); arm(); } }); });
  }
  function arm() {
    clearTimeout(sayTimer);
    var c = cur;
    if (c && c.at) sayTimer = setTimeout(function () { if (cur === c) { cur = null; ui.say.classList.remove('is-on'); pump(); } }, Math.max(0, c.at + c.ms - Date.now()));
  }
  function place(text) {
    var b = ui.say, r = (pet && ui.petHost ? ui.petHost : ui.stage).getBoundingClientRect();
    b.textContent = text;
    b.className = 'tw-say';
    // The panel / tour strip (tw-app) may pick a better spot: beside the pet in the strip, or right of the open chat.
    var css = placer && placer(r, b);
    if (!css) {
      var bw = Math.min(260, Math.max(120, text.length * 7.2 + 28)), vw = w.innerWidth;
      css = 'left:' + Math.round(Math.max(8, Math.min(vw - bw - 8, r.left + r.width / 2 - bw + 28))) + 'px;top:' + Math.round(Math.max(76, r.top - 14)) + 'px;max-width:' + bw + 'px';
    }
    b.style.cssText = css;
    void b.offsetWidth;
    b.classList.add('is-on');
  }
  // The pet changed place (tour strip / dock): the current line fades and comes back beside it.
  function follow() {
    var c = cur;
    if (!c || !c.at) return;
    ui.say.classList.remove('is-on');
    setTimeout(function () { if (cur === c) place(c.text); }, 340);
  }
  // "Look who's back!": ONE flag in this browser (no chat, no date, no id), never sent anywhere.
  function visitedBefore() { try { return w.localStorage.getItem('tw:visited') === '1'; } catch (e) { return false; } }
  function markVisited() { try { w.localStorage.setItem('tw:visited', '1'); } catch (e) { /* storage blocked: fine */ } }
  // While the pet tours the page: the full-size dock on wider screens; phones (≤640px) keep it small and it walks
  // inside a slim strip along the bottom edge (tw.css), never over the text.
  var touring = false, strip = w.matchMedia('(max-width: 640px)');
  function setTouring(on) {
    touring = !!on;
    if (!ui) return;
    ui.root.classList.toggle('is-touring', touring);
    if (touring) { if (!strip.matches) setMode('full'); setTabY(0); } else sample();
    follow();
  }
  var lifeTimer = 0, lastDelight = 0;
  function calm() { return !!pet && !touring && !rm() && !d.hidden && zone === 'page' && mode === 'full' && !state.hidden && !(app && app.isOpen()); }
  function scheduleLife() {
    clearTimeout(lifeTimer);
    lifeTimer = setTimeout(function () {
      if (calm() && pet.state === 'idle' && !asleep && !dancing && Date.now() - lastPointer > 5000) {
        pet.look([247.5, 270, 292.5, 315][Math.floor(Math.random() * 4)]);
        setTimeout(function () { if (pet && pet.state === 'look' && calm()) pet.idle(); }, 1300);
      }
      scheduleLife();
    }, 11000 + Math.random() * 5000);
  }
  var overDock = false;
  function attend(on) {
    overDock = !!on;
    if (!calm()) return;
    if (on && (pet.state === 'idle' || pet.state === 'look')) pet.look(315);
    else if (!on && pet.state === 'look') pet.idle();
  }

  /* ---------- cursor follow (desktop): the face turns toward the pointer wherever it moves on the page ----------
     Only while the pet is idle or already looking (never over a tour, search, dance, nap or a pose); it settles back to
     idle 2.6 s after the pointer stops. Touch screens have no cursor, so phones keep the calm idle. */
  var fine = w.matchMedia('(hover: hover) and (pointer: fine)'), followRaf = 0, followIdx = -1, followRest = 0, lastPointer = 0, ptrX = 0, ptrY = 0;
  function canFollow() {
    return !!pet && !!ui && fine.matches && !touring && !rm() && !d.hidden && zone === 'page' && mode === 'full' && !state.hidden &&
      !dancing && !asleep && !overDock && !ui.root.classList.contains('is-searching') && (pet.state === 'idle' || pet.state === 'look');
  }
  function followStep() {
    followRaf = 0;
    if (!canFollow()) { followIdx = -1; return; }
    var r = ui.stage.getBoundingClientRect(), cx = r.left + r.width / 2, cy = r.top + r.height * 0.3;
    if (Math.abs(ptrX - cx) + Math.abs(ptrY - cy) < 80) return; // right on top of it: no frantic spinning
    var deg = (Math.atan2(ptrX - cx, cy - ptrY) * 180 / Math.PI + 360) % 360;
    if (deg > 150 && deg < 210) deg = deg < 180 ? 135 : 225; // those frames hide the face
    var idx = Math.round(deg / 22.5) % 16;
    if (idx !== followIdx || pet.state !== 'look') { followIdx = idx; pet.look(idx * 22.5); }
    clearTimeout(followRest);
    followRest = setTimeout(function () { if (pet && pet.state === 'look' && canFollow()) { followIdx = -1; pet.idle(); } }, 2600);
  }
  d.addEventListener('pointermove', function (e) {
    if (e.pointerType && e.pointerType !== 'mouse') return;
    ptrX = e.clientX; ptrY = e.clientY; lastPointer = Date.now();
    wake();
    if (!followRaf) followRaf = requestAnimationFrame(followStep);
  }, { passive: true });

  /* ---------- nap: 45 s with no pointer, scroll, key or touch and the docked pet dozes off (zzz); any activity wakes it with a start ---------- */
  var asleep = false, sleepTimer = 0, lastArm = 0;
  function armSleep(force) {
    var now = Date.now();
    if (!force && now - lastArm < 1000) return;
    lastArm = now; clearTimeout(sleepTimer); sleepTimer = setTimeout(doze, 45000);
  }
  function doze() {
    if (!pet || !ui || !calm() || dancing || pet.state !== 'idle') { armSleep(true); return; }
    asleep = true;
    ui.root.classList.add('is-asleep');
    pet.still('failed', 3); // head down, eyes shut
  }
  function wake() {
    if (!asleep) { armSleep(); return; }
    asleep = false;
    ui.root.classList.remove('is-asleep');
    armSleep(true);
    if (!pet) return;
    if (rm()) { pet.idle(); return; }
    Promise.resolve(pet.preload(['jump'])).then(function (ok) { if (pet && !asleep && pet.state === 'failed') { if (ok) pet.play('jump', { loop: false }); else pet.idle(); } }, function () {});
    say('Huh! I’m awake, I’m awake!', 2000);
  }
  function wakeQuiet() { if (asleep && ui) { asleep = false; ui.root.classList.remove('is-asleep'); } armSleep(true); }
  ['keydown', 'pointerdown', 'touchstart'].forEach(function (t) { d.addEventListener(t, wake, { passive: true }); });
  w.addEventListener('scroll', wake, { passive: true });

  /* ---------- easter egg: the wedding-uncle dance ----------
     Asked for in the chat ("dance", "nacho", "party", "shaadi"…) or as a reward for reaching the footer. Hands-up light-bulb
     twist (wave frames) -> a slightly wobbly uncle twirl -> head shake -> "Balle balle!" jump, with floating notes; ~5.5 s.
     Reduced motion: a still pose and the line only. */
  var dancing = false, lastDance = 0, danceTimers = [];
  function notes() {
    var r = ui.petHost.getBoundingClientRect();
    for (var i = 0; i < 5; i++) {
      var n = d.createElement('span');
      n.className = 'tw-note';
      n.setAttribute('aria-hidden', 'true');
      n.textContent = i % 2 ? '♫' : '♪';
      n.style.left = Math.round(r.left + r.width * (0.2 + 0.15 * i)) + 'px';
      n.style.top = Math.round(r.top + 4) + 'px';
      n.style.animationDelay = (i * 0.5) + 's';
      ui.root.appendChild(n);
      setTimeout(function (x) { return function () { x.remove(); }; }(n), 2200 + i * 500);
    }
  }
  function stopDance() {
    danceTimers.forEach(clearTimeout); danceTimers = [];
    if (ui) ui.petHost.classList.remove('is-dancing', 'is-tipsy');
    dancing = false;
  }
  function dance(line) {
    var now = Date.now();
    if (!pet || !ui || dancing || now - lastDance < 6000) return false;
    lastDance = now;
    wakeQuiet();
    say(line || 'Shaadi mode ON! 🕺', 2000);
    if (rm()) { pet.still('wave'); danceTimers.push(setTimeout(function () { if (pet) pet.idle(); }, 2200)); return true; }
    dancing = true;
    var host = ui.petHost, p = pet, at = function (ms, fn) { danceTimers.push(setTimeout(function () { if (dancing && pet === p) fn(); }, ms)); };
    host.classList.add('is-dancing');
    notes();
    Promise.resolve(p.preload(['waiting', 'jump'])).catch(function () {});
    p.play('wave', { loop: true, frameMs: 120 });                          // hands up: the light-bulb twist
    at(1700, function () { host.classList.add('is-tipsy'); p.play('waiting', { loop: true, frameMs: 130 }); say('DJ, volume badhao!', 1700); }); // the wobbly uncle twirl
    at(3400, function () {                                                   // head shake
      host.classList.remove('is-tipsy');
      var n = 0;
      (function head() { if (!dancing || pet !== p || n >= 6) return; p.look(n++ % 2 ? 90 : 270); danceTimers.push(setTimeout(head, 210)); })();
    });
    at(4700, function () { host.classList.remove('is-dancing'); p.play('jump', { loop: false }); say('Balle balle!', 1600); });
    at(5600, stopDance);
    return true;
  }
  function watchFooter() {
    var f = d.querySelector('.footer');
    if (!f || !('IntersectionObserver' in w)) return;
    var io = new IntersectionObserver(function (es) {
      if (!es[es.length - 1].isIntersecting || !calm() || asleep || (pet.state !== 'idle' && pet.state !== 'look')) return;
      if (dance('You made it to the end! 🎉')) io.disconnect(); // once per page view
    }, { threshold: 0.6 });
    io.observe(f);
  }
  d.addEventListener('click', function (e) {
    if (!e.target || !e.target.closest || !e.target.closest('.contact__copy')) return;
    var now = Date.now();
    if (!pet || now - lastDelight < 30000 || zone !== 'page') return;
    lastDelight = now;
    setTimeout(function () { say('Mission accomplished!'); }, rm() ? 0 : 260);
    if (rm()) return;
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
      var first = !state.entered, back = first && visitedBefore();
      state = save({ entered: true });
      markVisited();
      var greet = function () {
        mountPet().then(function (p) {
          if (!p) { if (first) showHint(); return; }
          if (back) {
            if (!rm()) p.play('wave');
            say('Look who\u2019s back!', 3000);
          } else if (first && !rm()) {
            p.play('wave'); // a one-shot: the pet returns to idle by itself
            showHint();
          } else {
            p.idle();
          }
          if (zone === 'hero') p.pause();
          scheduleLife();
          armSleep(true);
          watchFooter();
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
    if (!ui || touring || zone === 'hero' || (app && app.isOpen())) return;
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
    base: BASE, js: js, json: json, read: read, save: save, rm: rm, announce: announce, endpoint: ENDPOINT,
    ui: function () { return ui; },
    pet: function () { return pet; },
    lookToward: lookToward,
    dance: function (line) { return dance(line); },
    stopDance: stopDance,
    wake: wakeQuiet,
    say: say,
    hush: hush,
    placer: function (fn) { placer = fn; },
    touring: setTouring,
    touringNow: function () { return touring; },
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
