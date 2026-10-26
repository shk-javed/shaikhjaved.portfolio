/* SHK JAVED pangolin sprite player. Vanilla, no dependencies.
 * const pet = SHKPangolin.mount(el, {manifest, base:'twin/sprites/', reducedMotion});
 * Renders into a 96x104 host box; strips/manifest are built by tools/build_twin_sprites.py. */
(function (root, f) {
  var m = f();
  if (typeof module === 'object' && module.exports) module.exports = m;
  else root.SHKPangolin = m;
})(this, function () {
  'use strict';

  var hasDOM = typeof document !== 'undefined';

  function resolveUrl(base, file) {
    try { return new URL(file, new URL(base, hasDOM ? document.baseURI : 'http://localhost/')).href; }
    catch (e) { return base + file; }
  }
  function rand(a, b) { return a + Math.random() * (b - a); }
  function mod(n, m) { return ((n % m) + m) % m; }

  // Shared image cache across instances: url -> Promise<boolean>
  var cache = {};
  function loadImage(url) {
    if (cache[url]) return cache[url];
    cache[url] = new Promise(function (resolve) {
      if (typeof Image === 'undefined') { resolve(false); return; }
      var img = new Image();
      img.decoding = 'async';
      var done = function (ok) { img.onload = img.onerror = null; resolve(ok); };
      img.onload = function () {
        if (img.decode) img.decode().then(function () { done(true); }, function () { done(true); });
        else done(true);
      };
      img.onerror = function () { delete cache[url]; done(false); };
      img.src = url;
    });
    return cache[url];
  }

  /** Map an angle (deg, 0 = up, clockwise) to a look index 0..15. */
  function lookIndex(deg, avoid) {
    var idx = mod(Math.round(mod(deg, 360) / 22.5), 16);
    var key = String(idx * 22.5);
    if (avoid && typeof avoid[key] === 'number') idx = mod(Math.round(avoid[key] / 22.5), 16);
    return idx;
  }
  /** Shortest index path from -> to on the 16-step dial; ties go via "up" (index 0), never via "down". */
  function lookPath(from, to) {
    var cw = mod(to - from, 16), ccw = mod(from - to, 16), dir;
    if (cw === ccw) {
      // 8 steps either way: pick the direction that does not pass index 8 (down)
      var passesDown = false;
      for (var i = 1; i < cw; i++) if (mod(from + i, 16) === 8) passesDown = true;
      dir = passesDown ? -1 : 1;
    } else dir = cw < ccw ? 1 : -1;
    var steps = Math.min(cw, ccw), out = [];
    for (var s = 1; s <= steps; s++) out.push(mod(from + dir * s, 16));
    return out;
  }
  function angleTo(fromX, fromY, x, y) {
    return mod(Math.atan2(x - fromX, -(y - fromY)) * 180 / Math.PI, 360);
  }

  function mount(el, opts) {
    opts = opts || {};
    var base = opts.base || 'twin/sprites/';
    var manifest = null;
    var rmQuery = null, rmExplicit = typeof opts.reducedMotion === 'boolean';
    var reduced = rmExplicit ? opts.reducedMotion : false;
    if (!rmExplicit && hasDOM && window.matchMedia) {
      rmQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
      reduced = rmQuery.matches;
    }

    var sprite = document.createElement('div');
    sprite.className = 'pg-sprite';
    sprite.setAttribute('aria-hidden', 'true');
    var st = sprite.style;
    st.position = 'absolute'; st.left = '0'; st.top = '0';
    st.width = '100%'; st.height = '100%';
    st.backgroundRepeat = 'no-repeat';
    st.pointerEvents = 'none';
    st.willChange = 'transform';
    if (getComputedStyle(el).position === 'static') el.style.position = 'relative';
    el.appendChild(sprite);

    var W = 96, H = 104, d = 0.5;            // display box + display/native ratio
    var timer = null, clockFn = null, clockDue = 0, clockLeft = 0;
    var paused = false, hidden = false, offscreen = false, destroyed = false;
    var token = 0;                           // increments on every new command (interrupts the old one)
    var cur = { key: null, state: 'poster', frame: 0, mirror: false, lookIdx: null };
    var pendingResolve = null;
    var x = 0, walkAnim = null;
    var api;

    function measure() {
      // unscaled layout box: parent/own CSS transforms must not distort the frame maths
      var w = el.offsetWidth, h = el.offsetHeight;
      if (w > 0) { W = w; H = h || W * 208 / 192; }
      d = manifest ? W / manifest.cell.w : W / 192;
    }

    function setGroundVar() {
      if (!manifest) return;
      el.style.setProperty('--pg-ground', (manifest.refGround * d).toFixed(2) + 'px');
      el.style.setProperty('--pg-ground-bottom', (H - manifest.refGround * d).toFixed(2) + 'px');
    }

    // ---- rendering --------------------------------------------------------
    function rowInfo(key) {
      if (key === 'poster') return { file: manifest ? manifest.poster.file : 'poster.webp', frames: 1, ground: manifest ? manifest.refGround : 191, scale: 1 };
      if (key === 'look-a' || key === 'look-b') {
        var L = manifest.look;
        return { file: L.files[key === 'look-a' ? 0 : 1], frames: L.framesPerFile, ground: L.ground, scale: L.scale };
      }
      return manifest.states[key];
    }
    function draw(key, frame, mirror) {
      if (destroyed) return;
      var info = rowInfo(key);
      var url = resolveUrl(base, info.file);
      if (cur.drawnUrl !== url) {
        st.backgroundImage = 'url("' + url + '")';
        cur.drawnUrl = url;
      }
      st.backgroundSize = (info.frames * W).toFixed(2) + 'px ' + H.toFixed(2) + 'px';
      st.backgroundPosition = (-frame * W).toFixed(2) + 'px 0px';
      var ref = manifest ? manifest.refGround : 191;
      var gy = info.ground * d, dy = (ref - info.ground) * d, k = info.scale || 1;
      st.transformOrigin = '50% ' + gy.toFixed(2) + 'px';
      st.transform = 'translateY(' + dy.toFixed(2) + 'px) scale(' + (mirror ? -k : k) + ',' + k + ')';
      cur.key = key; cur.frame = frame; cur.mirror = !!mirror;
    }
    function drawLook(idx) {
      draw(idx < 8 ? 'look-a' : 'look-b', idx % 8, false);
      cur.lookIdx = idx;
    }

    // ---- clock (setTimeout only; pausable) -------------------------------
    function stopClock() { if (timer) clearTimeout(timer); timer = null; clockFn = null; }
    function schedule(fn, ms) {
      stopClock();
      clockFn = fn; clockLeft = ms;
      if (paused || hidden || offscreen) return;
      clockDue = Date.now() + ms;
      timer = setTimeout(function () { timer = null; var f = clockFn; clockFn = null; if (f) f(); }, ms);
    }
    function freeze() {
      if (timer) { clearTimeout(timer); timer = null; clockLeft = Math.max(0, clockDue - Date.now()); }
      if (walkAnim && walkAnim.playState === 'running') walkAnim.pause();
    }
    function thaw() {
      if (paused || hidden || offscreen || destroyed) return;
      if (clockFn && !timer) { var f = clockFn; schedule(f, clockLeft); }
      if (walkAnim && walkAnim.playState === 'paused') walkAnim.play();
    }

    // ---- command plumbing -------------------------------------------------
    function begin() {
      token++;
      stopClock();
      if (pendingResolve) { var r = pendingResolve; pendingResolve = null; r(false); }
      return token;
    }
    function canonical(state) {
      if (!manifest) return state;
      if (manifest.aliases && manifest.aliases[state]) return manifest.aliases[state];
      return state;
    }
    function resolveState(state) {
      var s = canonical(state), mirror = false;
      if (manifest.mirrors && manifest.mirrors[s]) { s = manifest.mirrors[s]; mirror = true; }
      if (!manifest.states[s]) return null;
      return { key: s, mirror: mirror };
    }
    function urlsFor(names) {
      var out = [];
      (names || []).forEach(function (n) {
        if (n === 'poster') { out.push(resolveUrl(base, manifest.poster.file)); return; }
        if (n === 'look' || n === 'look-a' || n === 'look-b') {
          manifest.look.files.forEach(function (f, i) {
            if (n === 'look' || n === (i ? 'look-b' : 'look-a')) out.push(resolveUrl(base, f));
          });
          return;
        }
        var r = resolveState(n);
        if (r) out.push(resolveUrl(base, manifest.states[r.key].file));
      });
      return out;
    }
    function ensure(names) {
      return Promise.all(urlsFor(names).map(loadImage)).then(function (oks) {
        return oks.every(Boolean);
      });
    }

    // ---- idle loop with long breathing holds ---------------------------
    function runIdle(t) {
      var S = manifest.states.idle;
      if (reduced) { draw('idle', S.still, false); return; }
      var hold = manifest.idleHoldMs || [2000, 5000];
      var f = 0;
      function tick() {
        if (t !== token) return;
        draw('idle', f, false);
        var ms = S.durations[f];
        if (f === 0) ms += rand(hold[0], hold[1]);
        f = (f + 1) % S.frames;
        schedule(tick, ms);
      }
      tick();
    }

    // ---- public API --------------------------------------------------------
    function play(state, o) {
      o = o || {};
      if (!manifest) return api.ready.then(function () { return play(state, o); });
      var t = begin();
      var r = resolveState(state);
      if (!r) return Promise.resolve(false);
      if (r.key === 'idle' && o.loop !== false && typeof o.loop !== 'number') {
        // ambient idle: loops with long holds until the next command
        return ensure(['idle']).then(function (ok) {
          if (t === token) { if (ok) runIdle(t); else draw('poster', 0, false); }
          return ok;
        });
      }
      var S = manifest.states[r.key];
      var loop = o.loop === undefined ? S.loop : o.loop;
      var cycles = loop === true ? Infinity : (typeof loop === 'number' ? Math.max(1, loop) : 1);
      var speed = o.speed > 0 ? o.speed : 1;
      return new Promise(function (resolve) {
        var finished = false;
        function finish(ok) {
          if (finished) return; finished = true;
          if (pendingResolve === finishOuter) pendingResolve = null;
          if (typeof o.onEnd === 'function') { try { o.onEnd(ok); } catch (e) { /* ignore */ } }
          resolve(ok);
        }
        function finishOuter(ok) { finish(ok); }
        pendingResolve = finishOuter;
        ensure([r.key]).then(function (ok) {
          if (t !== token) return;
          if (!ok) { draw('poster', 0, false); finish(false); return; }
          if (reduced) {
            draw(r.key, S.still, r.mirror);
            if (cycles === Infinity) return;      // held until the next command
            schedule(function () {
              if (t !== token) return;
              pendingResolve = null;
              finish(true);
              if (!o.hold) runIdle(begin());
            }, Math.min(2000, S.durations.reduce(function (a, b) { return a + b; }, 0) * (cycles === Infinity ? 1 : cycles)));
            return;
          }
          var f = 0, c = 0;
          function tick() {
            if (t !== token) return;
            draw(r.key, f, r.mirror);
            var ms = (o.frameMs || S.durations[f]) / speed;
            f++;
            if (f >= S.frames) {
              f = 0; c++;
              if (c >= cycles) {
                schedule(function () {
                  if (t !== token) return;
                  pendingResolve = null;
                  finish(true);
                  if (!o.hold) runIdle(begin());
                }, ms);
                return;
              }
            }
            schedule(tick, ms);
          }
          tick();
        });
      });
    }

    function look(deg) {
      if (!manifest) return api.ready.then(function () { return look(deg); });
      var t = begin();
      var target = lookIndex(deg, manifest.look.avoid);
      return new Promise(function (resolve) {
        pendingResolve = resolve;
        ensure(['look']).then(function (ok) {
          if (t !== token) return;
          pendingResolve = null;
          if (!ok) { resolve(false); return; }
          var from = cur.lookIdx != null && (cur.key === 'look-a' || cur.key === 'look-b')
            ? cur.lookIdx : lookIndex(manifest.look.neutral || 270);
          if (reduced || from === target) { drawLook(target); resolve(true); return; }
          var path = lookPath(from, target), i = 0;
          pendingResolve = resolve;
          (function step() {
            if (t !== token) return;
            drawLook(path[i++]);
            if (i >= path.length) { pendingResolve = null; resolve(true); return; }
            schedule(step, manifest.look.inbetweenMs || 60);
          })();
        });
      });
    }

    function lookAt(px, py) {
      var r = el.getBoundingClientRect();
      // eye point: horizontally centred, ~30% down the box
      return look(angleTo(r.left + r.width / 2, r.top + r.height * 0.3, px, py));
    }

    function walkBy(dx, o) {
      o = o || {};
      if (!manifest) return api.ready.then(function () { return walkBy(dx, o); });
      dx = +dx || 0;
      var to = x + dx;
      if (walkAnim) { try { walkAnim.cancel(); } catch (e) { /* ignore */ } walkAnim = null; }
      var setX = function (v) {
        x = v;
        el.style.translate = v ? v.toFixed(1) + 'px 0' : '';
        el.style.setProperty('--pg-x', v.toFixed(1) + 'px');
      };
      if (!dx) return Promise.resolve(true);
      if (reduced || typeof el.animate !== 'function') { setX(to); return Promise.resolve(true); }
      var speed = o.speed > 0 ? o.speed : 70;
      var ms = Math.abs(dx) / speed * 1000;
      var from = x;
      var t;
      play(dx > 0 ? 'run-right' : 'run-left', { loop: true, frameMs: manifest.walkFrameMs || 120 });
      t = token;
      return ensure(['run-left']).then(function () {
        if (t !== token) return false;
        return new Promise(function (resolve) {
          var anim = el.animate([{ translate: from + 'px 0' }, { translate: to + 'px 0' }],
            { duration: ms, easing: 'linear', fill: 'forwards' });
          walkAnim = anim;
          if (paused || hidden || offscreen) anim.pause();
          var outer = pendingResolve;
          pendingResolve = function (ok) {
            // interrupted mid-walk: freeze where we are
            try {
              var p = anim.currentTime / ms;
              setX(from + (to - from) * Math.min(1, Math.max(0, p || 0)));
              anim.cancel();
            } catch (e) { /* ignore */ }
            walkAnim = null;
            if (outer) outer(ok);
            resolve(false);
          };
          anim.onfinish = function () {
            if (walkAnim !== anim) return;
            walkAnim = null;
            setX(to);
            try { anim.cancel(); } catch (e) { /* ignore */ }
            if (t !== token) { resolve(false); return; }
            pendingResolve = outer;     // let begin() settle the run-loop promise
            if (!o.hold) runIdle(begin()); else begin();
            resolve(true);
          };
        });
      });
    }

    function idle() {
      if (!manifest) return api.ready.then(idle);
      var t = begin();
      return ensure(['idle']).then(function (ok) {
        if (t !== token) return false;
        if (ok) runIdle(t); else draw('poster', 0, false);
        return true;
      });
    }

    function still(state, frame) {
      if (!manifest) return api.ready.then(function () { return still(state, frame); });
      var t = begin();
      var r = resolveState(state || 'idle');
      if (!r) { draw('poster', 0, false); return Promise.resolve(false); }
      var S = manifest.states[r.key];
      return ensure([r.key]).then(function (ok) {
        if (t !== token) return false;
        if (ok) draw(r.key, frame == null ? S.still : Math.min(S.frames - 1, frame), r.mirror);
        else draw('poster', 0, false);
        return ok;
      });
    }

    function preload(names) {
      if (!manifest) return api.ready.then(function () { return preload(names); });
      return ensure(names);
    }

    function pause() { paused = true; freeze(); }
    function resume() { paused = false; thaw(); }

    // ---- environment: visibility, off-screen, reduced motion, resize ---------
    function onVis() { hidden = document.hidden; if (hidden) freeze(); else thaw(); }
    document.addEventListener('visibilitychange', onVis);
    hidden = !!document.hidden;
    var io = null;
    if (typeof IntersectionObserver === 'function') {
      io = new IntersectionObserver(function (entries) {
        var e = entries[entries.length - 1];
        offscreen = !e.isIntersecting;
        if (offscreen) freeze(); else thaw();
      });
      io.observe(el);
    }
    function onRM() {
      if (rmExplicit || !rmQuery) return;
      reduced = rmQuery.matches;
      if (reduced && manifest) idle();
    }
    if (rmQuery) {
      if (rmQuery.addEventListener) rmQuery.addEventListener('change', onRM);
      else if (rmQuery.addListener) rmQuery.addListener(onRM);
    }
    var ro = null;
    if (typeof ResizeObserver === 'function') {
      ro = new ResizeObserver(function () {
        measure(); setGroundVar();
        if (manifest && cur.key) draw(cur.key, cur.frame, cur.mirror);
      });
      ro.observe(el);
    }

    function destroy() {
      if (destroyed) return;
      begin();
      destroyed = true;
      if (walkAnim) { try { walkAnim.cancel(); } catch (e) { /* ignore */ } walkAnim = null; }
      document.removeEventListener('visibilitychange', onVis);
      if (io) io.disconnect();
      if (ro) ro.disconnect();
      if (rmQuery) {
        if (rmQuery.removeEventListener) rmQuery.removeEventListener('change', onRM);
        else if (rmQuery.removeListener) rmQuery.removeListener(onRM);
      }
      if (sprite.parentNode) sprite.parentNode.removeChild(sprite);
      el.style.removeProperty('--pg-ground');
      el.style.removeProperty('--pg-ground-bottom');
      el.style.removeProperty('--pg-x');
      el.style.translate = '';
    }

    // ---- manifest -------------------------------------------------------------
    var readyP;
    if (opts.manifest && typeof opts.manifest === 'object') {
      manifest = opts.manifest;
      readyP = Promise.resolve();
    } else {
      var murl = typeof opts.manifest === 'string' ? opts.manifest : resolveUrl(base, 'manifest.json');
      readyP = fetch(murl).then(function (r) { return r.json(); }).then(function (m) { manifest = m; });
    }

    api = {
      ready: null,
      preload: preload,
      play: play,
      look: look,
      lookAt: lookAt,
      walkBy: walkBy,
      idle: idle,
      still: still,
      pause: pause,
      resume: resume,
      destroy: destroy,
      get state() { return cur.key === 'look-a' || cur.key === 'look-b' ? 'look' : cur.key; },
      get reducedMotion() { return reduced; },
      get x() { return x; }
    };
    api.ready = readyP.then(function () {
      measure(); setGroundVar();
      if (!cur.key || cur.key === 'poster') draw('poster', 0, false);
      return api;
    });
    // first paint: poster (idle frame 0) even before the manifest arrives
    measure();
    draw('poster', 0, false);
    return api;
  }

  return { mount: mount, version: '1.0.0', _lookIndex: lookIndex, _lookPath: lookPath, _angleTo: angleTo };
});
