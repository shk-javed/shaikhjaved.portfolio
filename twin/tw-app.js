/* SHK JAVED, the portfolio's AI guide: conversation panel (Experience).
   Loaded by tw-boot.js on the first hover, focus or click on an opener. It renders engine answers from segments with
   textContent only (never HTML), turns evidence into real links, and runs "Show me": SHKSite.go(evidence),
   then the spotlight, then the pangolin looks at the target, then focus moves to it.
   A non-modal dialog: Esc closes it and returns focus to the opener. */
(function () {
  'use strict';
  var w = window, d = document, T = w.SHKTwin;
  if (!T || T.__app) return;

  var NOTE = 'AI guide · not Javed himself · answers only from this site’s verified facts';
  var INTERNAL = { anchor: 1, project: 1, cert: 1, tool: 1 };
  var MOODS = { idle: 1, wave: 1, jump: 1, review: 1, failed: 1, waiting: 1 };
  var FOCUSABLE = 'a[href],button,input,select,textarea,summary,[tabindex]';
  var MAX_MSGS = 40;
  var HEX = '<svg viewBox="0 0 16 16" aria-hidden="true" focusable="false"><path d="M8 1.2 13.9 4.6v6.8L8 14.8 2.1 11.4V4.6Z" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="m5.4 8.1 1.8 1.8 3.5-3.6" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>';

  T.__app = function (kit) {
    var ui = kit.ui(), panel, log, body, typing, input, form, sendBtn, opener = null, busy = false, navBusy = false;
    var engine = null, ctx = (function (c) { return c && typeof c === 'object' ? c : null; })(kit.read().ctx), msgs = (kit.read().msgs || []).slice(-MAX_MSGS), spotTimer = 0, spotScroll = null;

    /* ---------- build ---------- */
    function el(tag, cls, text) {
      var n = d.createElement(tag);
      if (cls) n.className = cls;
      if (text != null) n.textContent = text;
      return n;
    }
    function build() {
      panel = el('section', 'tw-panel');
      panel.id = 'tw-panel';
      panel.hidden = true;
      panel.setAttribute('role', 'dialog');
      panel.setAttribute('aria-modal', 'false');
      panel.setAttribute('aria-labelledby', 'tw-title');
      panel.setAttribute('aria-describedby', 'tw-note');
      panel.innerHTML =
        '<div class="tw-head">' +
          '<span class="tw-head__hex">' + HEX + '</span>' +
          '<div class="tw-head__txt"><h2 class="tw-title" id="tw-title">SHK JAVED</h2><p class="tw-note" id="tw-note"></p></div>' +
          '<button type="button" class="tw-x" aria-label="Close the guide"><svg viewBox="0 0 16 16" aria-hidden="true" focusable="false"><path d="m4 4 8 8M12 4l-8 8" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg></button>' +
        '</div>' +
        '<div class="tw-body"><ol class="tw-log" aria-label="Conversation"></ol>' +
          '<div class="tw-typing" role="status"><span class="tw-dots" aria-hidden="true"><i></i><i></i><i></i></span><span class="tw-typing__txt"></span></div>' +
        '</div>' +
        '<form class="tw-form" novalidate>' +
          '<label class="tw-sr" for="tw-input">Ask SHK JAVED about Javed</label>' +
          '<input class="tw-input" id="tw-input" type="text" maxlength="280" autocomplete="off" autocapitalize="sentences" enterkeyhint="send" placeholder="Ask about his work, projects, tools…">' +
          '<button type="submit" class="tw-send" aria-label="Send"><svg viewBox="0 0 16 16" aria-hidden="true" focusable="false"><path d="M3 8h9.5M8.5 3.5 13 8l-4.5 4.5" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg></button>' +
        '</form>' +
        '<div class="tw-foot"><span>Answers are built on this page. Nothing you type leaves it.</span><button type="button" class="tw-hide">Hide for this visit</button></div>';
      panel.querySelector('.tw-note').textContent = NOTE;
      ui.root.insertBefore(panel, ui.dock); // before the dock, so the phone sheet can seat the pet in its header
      log = panel.querySelector('.tw-log');
      body = panel.querySelector('.tw-body');
      typing = panel.querySelector('.tw-typing');
      form = panel.querySelector('.tw-form');
      input = panel.querySelector('.tw-input');
      sendBtn = panel.querySelector('.tw-send');

      panel.querySelector('.tw-x').addEventListener('click', function () { close(true); });
      panel.querySelector('.tw-hide').addEventListener('click', hide);
      form.addEventListener('submit', function (e) { e.preventDefault(); var q = input.value; if (ask(q)) input.value = ''; });
      panel.addEventListener('keydown', function (e) { if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); close(true); } });
      panel.addEventListener('click', onPanelClick);

      if ('ResizeObserver' in w) new ResizeObserver(function () {
        ui.root.style.setProperty('--tw-sheet-h', panel.offsetHeight + 'px');
        ui.root.style.setProperty('--tw-head-h', panel.querySelector('.tw-head').offsetHeight + 'px');
      }).observe(panel);
      // Keyboard: iOS keeps fixed elements on the layout viewport, so the sheet is lifted by the keyboard's height (--tw-kb) and
      // sized to the visual viewport (--tw-vvh). data-kb (input focused on a short visual viewport) lets the transcript give way first.
      var vv = w.visualViewport, kbUp = false;
      function syncViewport() {
        if (!vv) return;
        var kb = Math.max(0, Math.round(w.innerHeight - vv.height - vv.offsetTop)), typingNow = d.activeElement === input;
        ui.root.style.setProperty('--tw-vvh', Math.round(vv.height) + 'px');
        ui.root.style.setProperty('--tw-kb', kb + 'px');
        var up = typingNow && (kb > 40 || vv.height < 480);
        ui.root.toggleAttribute('data-kb', up);
        if (up && !kbUp) body.scrollTop = body.scrollHeight; // keep the latest answer in view above the keyboard
        kbUp = up;
      }
      if (vv) { vv.addEventListener('resize', syncViewport, { passive: true }); vv.addEventListener('scroll', syncViewport, { passive: true }); }
      input.addEventListener('focus', function () { setTimeout(syncViewport, 60); listen(); });
      input.addEventListener('blur', function () { setTimeout(syncViewport, 60); settle(); });
      input.addEventListener('input', listen);

      msgs.forEach(function (m, i) { render(m, i === msgs.length - 1, false); });
    }

    /* ---------- engine ---------- */
    function getEngine() {
      return kit.engine().then(function (x) {
        if (!engine) {
          engine = x.E.create(x.kb, { provider: 'local' });
          if (!ctx) ctx = engine.newContext(); // the stored ctx (restored at start) wins, so "tell me more" survives a reload
        }
        return engine;
      });
    }

    /* ---------- rendering (textContent only) ---------- */
    function evidenceFor(r, id) {
      var list = r.evidence || [];
      for (var i = 0; i < list.length; i++) if (list[i].id === id) return list[i];
      return null;
    }
    function isInternal(ev) { return ev && INTERNAL[ev.kind] && !ev.external; }
    function linkFor(ev, text, cls) {
      var a = el('a', cls);
      a.href = ev.href || '#';
      a.setAttribute('data-ev', JSON.stringify({ kind: ev.kind, index: ev.index, select: ev.select, target: ev.target, href: ev.href, label: ev.label }));
      if (cls === 'tw-chip') { a.insertAdjacentHTML('afterbegin', HEX); a.appendChild(el('span', 'tw-chip__label', text)); }
      else a.textContent = text;
      if (!isInternal(ev)) {
        if (ev.kind !== 'mailto') { a.target = '_blank'; a.rel = 'noopener noreferrer'; }
        if (cls === 'tw-chip' && ev.kind !== 'mailto') a.appendChild(el('span', 'tw-chip__ext', '↗')).setAttribute('aria-hidden', 'true');
        if (ev.kind !== 'mailto') a.appendChild(el('span', 'tw-sr', ' (opens in a new tab)'));
      } else {
        a.setAttribute('data-show', '');
      }
      return a;
    }
    function render(m, latest, animate) {
      var li = el('li', 'tw-msg tw-msg--' + (m.role === 'user' ? 'you' : 'bot'));
      li.appendChild(el('span', 'tw-sr', m.role === 'user' ? 'You: ' : 'SHK JAVED: '));
      if (m.role === 'user') {
        li.appendChild(el('span', 'tw-msg__txt', m.text));
      } else {
        var r = m.r || {}, p = el('p', 'tw-ans');
        (r.segments && r.segments.length ? r.segments : [{ t: 'text', v: r.text || '' }]).forEach(function (s) {
          if (!s || typeof s.v !== 'string') return;
          if (s.t === 'strong') p.appendChild(el('strong', null, s.v));
          else if (s.t === 'link') {
            var ev = evidenceFor(r, s.evidence);
            p.appendChild(ev ? linkFor(ev, s.v, 'tw-inline') : d.createTextNode(s.v));
          } else p.appendChild(d.createTextNode(s.v));
        });
        li.appendChild(p);
        if (r.evidence && r.evidence.length) {
          var ul = el('ul', 'tw-ev');
          ul.setAttribute('aria-label', 'Evidence');
          var goId = r.target && r.target.evidence, list = r.evidence.slice(0, 4);
          // The answer's target evidence leads as the filled "Show me" chip.
          list.sort(function (a, b) { return (b && b.id === goId) - (a && a.id === goId); });
          list.forEach(function (ev) {
            if (!ev || !ev.href || !ev.label) return;
            var item = el('li'), a = linkFor(ev, String(ev.label).slice(0, 28), 'tw-chip');
            if (ev.id === goId && isInternal(ev)) { a.classList.add('tw-chip--go'); a.insertBefore(el('span', 'tw-sr', 'Show me: '), a.firstChild); }
            item.appendChild(a);
            ul.appendChild(item);
          });
          if (ul.children.length) li.appendChild(ul);
        }
        var fus = (m.starters || r.followUps || []).slice(0, m.starters ? 5 : 3);
        if (latest && fus.length) li.appendChild(followUps(fus, m.starters ? 'Try asking' : 'Ask next'));
      }
      if (animate && !kit.rm()) li.classList.add('is-new');
      log.appendChild(li);
      return li;
    }
    function followUps(list, label) {
      var g = el('div', 'tw-fus');
      g.setAttribute('role', 'group');
      g.setAttribute('aria-label', label);
      g.appendChild(el('span', 'tw-fus__label', label)).setAttribute('aria-hidden', 'true');
      list.forEach(function (q) {
        if (typeof q !== 'string' || !q) return;
        var b = el('button', 'tw-fu', q);
        b.type = 'button';
        b.setAttribute('data-ask', q);
        g.appendChild(b);
      });
      return g;
    }
    function dropFollowUps() {
      var old = log.querySelectorAll('.tw-fus');
      for (var i = 0; i < old.length; i++) old[i].remove();
    }
    function reveal(li) {
      // Scroll the conversation (never the page) so the new message starts in view.
      var top = li.offsetTop - 12;
      body.scrollTo({ top: Math.max(0, top), behavior: kit.rm() ? 'auto' : 'smooth' });
    }
    function persist() {
      msgs = msgs.slice(-MAX_MSGS);
      var patch = { msgs: msgs };
      if (ctx) patch.ctx = ctx; // never overwrite a saved ctx with null
      kit.save(patch);
    }
    function push(m) {
      msgs.push(m);
      persist();
      var li = render(m, true, true);
      reveal(li);
      return li;
    }

    /* ---------- conversation ---------- */
    function setTyping(on) {
      panel.classList.toggle('is-thinking', on);
      typing.querySelector('.tw-typing__txt').textContent = on ? 'SHK JAVED is looking through the archive…' : '';
      sendBtn.setAttribute('aria-disabled', on ? 'true' : 'false');
    }
    // jump is lazy-on-first-use: until its strip has loaded, use review (eager) and fetch jump in the background.
    var jumpReady = false;
    function hop(p, opts) {
      if (jumpReady) return p.play('jump', opts);
      Promise.resolve(p.preload(['jump'])).then(function (ok) { if (ok) jumpReady = true; }, function () {});
      return p.play('review', opts);
    }
    function petMood(mood) {
      var p = kit.pet();
      if (!p) return Promise.resolve(false);
      if (mood === 'idle' || !MOODS[mood]) { p.idle(); return Promise.resolve(true); }
      // Resolves true when the one-shot finishes (the pet then idles by itself), false if a later command interrupted it.
      return Promise.resolve(mood === 'jump' ? hop(p, { loop: false }) : p.play(mood, { loop: false }));
    }
    function greet() {
      var intro = {
        role: 'bot',
        r: { kind: 'greeting', segments: [
          { t: 'text', v: 'Hi, I’m ' }, { t: 'strong', v: 'SHK JAVED' },
          { t: 'text', v: ', an AI guide to Javed’s portfolio. I’m not Javed himself. I answer only from facts on this site, and I link the proof so you can check it.' }
        ] }
      };
      getEngine().then(function (E) {
        intro.starters = (E.starters() || []).slice(0, 5);
      }).catch(function () {}).then(function () {
        if (msgs.length) return;
        push(intro);
      });
    }
    function ask(q) {
      q = String(q || '').replace(/\s+/g, ' ').trim();
      if (!q || busy) return false;
      busy = true;
      dropFollowUps();
      push({ role: 'user', text: q.slice(0, 280) });
      setTyping(true);
      var p = kit.pet();
      clearTimeout(listenTimer);
      if (p) p.play('working', { loop: true });
      var t0 = Date.now(), minWait = kit.rm() ? 150 : 480;
      getEngine().then(function (E) {
        return E.ask(q, ctx);
      }).then(function (r) {
        return new Promise(function (ok) { setTimeout(function () { ok(r); }, Math.max(0, minWait - (Date.now() - t0))); });
      }).then(function (r) {
        r = r || {};
        var m = { role: 'bot', r: { kind: r.kind, text: r.text, segments: r.segments, evidence: r.evidence, followUps: r.followUps, target: r.target ? { evidence: r.target.evidence || null } : null } }; // never r.debug: it holds the visitor's question
        setTyping(false);
        push(m);
        kit.announce('SHK JAVED: ' + (r.text || '') + (r.evidence && r.evidence.length ? ' ' + r.evidence.length + (r.evidence.length === 1 ? ' evidence link' : ' evidence links') + ' below.' : ''));
        var mine = msgs.length;
        petMood(r.mood).then(function (done) {
          // Look only after the mood has played out, and only if nothing newer has happened since.
          if (done && msgs.length === mine && !navBusy) lookAtSection(r.target);
        });
      }).catch(function (e) {
        if (w.console) console.warn(e);
        setTyping(false);
        push({ role: 'bot', r: {
          kind: 'fallback',
          segments: [{ t: 'text', v: 'I couldn’t open my notes just now. Everything is still on the page: his work, credentials, toolkit and contact details.' }],
          evidence: [
            { id: 'f1', kind: 'anchor', target: '#projects', href: '#projects', label: 'Work' },
            { id: 'f2', kind: 'anchor', target: '#certificates', href: '#certificates', label: 'Credentials' },
            { id: 'f3', kind: 'anchor', target: '#contact', href: '#contact', label: 'Contact' }
          ] } });
        kit.announce('SHK JAVED could not load its notes. Links to the main sections are below.');
        petMood('failed');
      }).then(function () { busy = false; });
      return true;
    }

    /* ---------- show me ---------- */
    function onPanelClick(e) {
      var fu = e.target.closest('[data-ask]');
      if (fu) { ask(fu.getAttribute('data-ask')); input.focus({ preventScroll: true }); return; }
      var a = e.target.closest('a[data-show]');
      if (!a || e.defaultPrevented || e.button > 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      e.preventDefault();
      var ev;
      try { ev = JSON.parse(a.getAttribute('data-ev')); } catch (x) { return; }
      showMe(ev);
    }
    function onDark(node) { return !!(node.closest && node.closest('.on-dark,#hero,.footer,.lead-card,.cert-viewer')); }
    function spotlight(target) {
      var s = ui.spot, r = target.getBoundingClientRect(), vh = w.innerHeight, vw = w.innerWidth, pad = 8;
      var top = Math.max(r.top - pad, 76), bottom = Math.min(r.bottom + pad, vh - 6), left = Math.max(r.left - pad, 6), right = Math.min(r.right + pad, vw - 6);
      if (bottom - top < 24 || right - left < 24) return;
      clearTimeout(spotTimer);
      s.classList.remove('is-on');
      s.style.cssText = 'top:' + top + 'px;left:' + left + 'px;width:' + (right - left) + 'px;height:' + (bottom - top) + 'px';
      s.setAttribute('data-tone', onDark(target) ? 'dark' : 'light');
      void s.offsetWidth;
      s.classList.add('is-on');
      var y0 = w.scrollY;
      var off = function () { s.classList.remove('is-on'); w.removeEventListener('scroll', spotScroll); spotScroll = null; };
      if (spotScroll) w.removeEventListener('scroll', spotScroll);
      spotScroll = function () { if (Math.abs(w.scrollY - y0) > 48) off(); };
      w.addEventListener('scroll', spotScroll, { passive: true });
      spotTimer = setTimeout(off, 3200);
    }
    function look(target) {
      var p = kit.pet();
      if (!p || !target) return;
      var r = target.getBoundingClientRect();
      kit.lookToward(r.left + r.width / 2, r.top + Math.min(r.height / 2, w.innerHeight / 2));
      setTimeout(function () { if (kit.pet() === p && !busy && p.state === 'look') p.idle(); }, 2400);
    }
    // Listening: while the visitor types, the pet watches the input; a pause in typing (or blur) lets it settle back to idle.
    var listenTimer = 0, lastListen = 0;
    function listen() {
      var p = kit.pet(), now = Date.now();
      if (!p || busy || kit.rm() || !isOpen()) return;
      clearTimeout(listenTimer);
      listenTimer = setTimeout(settle, 2600);
      if (now - lastListen < 350 || (p.state !== 'idle' && p.state !== 'look')) return;
      lastListen = now;
      var r = input.getBoundingClientRect();
      kit.lookToward(r.left + Math.min(r.width * 0.55, 40 + input.value.length * 8), r.top + r.height / 2);
    }
    function settle() {
      clearTimeout(listenTimer);
      var p = kit.pet();
      if (p && !busy && p.state === 'look') p.idle();
    }
    function lookAtSection(target) {
      if (!target || target.action !== 'look' || !target.section) return;
      var s;
      try { s = d.querySelector(target.section); } catch (e) { return; }
      if (!s) return;
      var r = s.getBoundingClientRect();
      if (r.bottom > 0 && r.top < w.innerHeight) look(s);
    }
    function focusTarget(t) {
      if (!t.matches(FOCUSABLE)) {
        t.setAttribute('tabindex', '-1');
        t.classList.add('tw-focus-target');
        t.addEventListener('blur', function () { t.removeAttribute('tabindex'); t.classList.remove('tw-focus-target'); }, { once: true });
      }
      t.focus({ preventScroll: true });
    }
    function showMe(ev) {
      if (navBusy) return;
      navBusy = true;
      var p = kit.pet(), arg = { kind: ev.kind, index: ev.index, select: ev.select, target: ev.target || (ev.href && ev.href.charAt(0) === '#' ? ev.href : null) };
      close(false); // minimise to the dock so the evidence is fully visible; the transcript stays
      var lift = p && !kit.rm() ? Promise.race([Promise.resolve(hop(p, { loop: false })), new Promise(function (ok) { setTimeout(ok, 700); })]) : Promise.resolve();
      lift.then(function () {
        if (w.SHKSite && typeof w.SHKSite.go === 'function') return w.SHKSite.go(arg);
        var t = arg.target ? d.querySelector(arg.target) : null;
        if (t) t.scrollIntoView({ block: 'start', behavior: kit.rm() ? 'auto' : 'smooth' });
        return new Promise(function (ok) { setTimeout(function () { ok(t); }, kit.rm() ? 80 : 750); });
      }).then(function (t) {
        if (!t) { if (p) p.idle(); kit.announce('That section is not on the page.'); return; }
        spotlight(t);
        look(t);
        focusTarget(t);
        kit.announce('Moved to ' + (ev.label || 'the evidence') + '. Press the guide button to return to the conversation.');
        if (!isOpen()) kit.showHint(3000);
      }).catch(function (e) { if (w.console) console.warn(e); }).then(function () { navBusy = false; });
    }

    /* ---------- open, close, hide ---------- */
    function isOpen() { return !!panel && !panel.hidden; }
    function open(from, opts) {
      opts = opts || {};
      if (!panel) build();
      if (from) opener = from;
      ui.dock.classList.remove('is-hinting');
      kit.setMode('full');
      panel.hidden = false;
      ui.root.setAttribute('data-open', '');
      ui.btn.setAttribute('aria-expanded', 'true');
      kit.save({ open: true });
      ui.root.style.setProperty('--tw-sheet-h', panel.offsetHeight + 'px');
      if (opts.focus !== false) input.focus({ preventScroll: true });
      kit.petReady().then(function (p) {
        if (!p) return;
        p.resume();
        if (opts.focus !== false && !kit.rm() && !busy) p.play('wave', { loop: false }); // a welcome, then idle by itself
        Promise.resolve(p.preload(['working', 'look-a', 'look-b', 'review'])).catch(function () {}); // jump is lazy: see hop()
      });
      if (!msgs.length) greet();
      else reveal(log.lastElementChild || log);
    }
    function close(restore) {
      if (!isOpen()) return;
      panel.hidden = true;
      ui.root.removeAttribute('data-open');
      ui.btn.setAttribute('aria-expanded', 'false');
      kit.save({ open: false });
      ui.root.removeAttribute('data-kb');
      clearTimeout(listenTimer);
      if (restore) {
        var back = opener && opener.isConnected && opener.getClientRects().length && opener !== ui.btn ? opener : ui.btn;
        back.focus({ preventScroll: true });
      }
      kit.sample();
    }
    function hide() {
      var back = opener && opener !== ui.btn && opener.isConnected ? opener : null;
      close(false);
      kit.hide();
      kit.announce('Guide hidden for this visit. The “Ask my AI guide” button in Contact brings it back.');
      if (back) { back.focus({ preventScroll: true }); return; }
      // Otherwise land on the heading of the section in view, so focus is never lost.
      var mid = w.innerHeight / 2, secs = d.querySelectorAll('main > section'), i, r, h;
      for (i = 0; i < secs.length; i++) {
        r = secs[i].getBoundingClientRect();
        if (r.top <= mid && r.bottom >= mid) { h = secs[i].querySelector('h2, h1') || secs[i]; focusTarget(h); return; }
      }
    }

    build();
    return { open: open, close: close, isOpen: isOpen, ask: ask };
  };
})();
