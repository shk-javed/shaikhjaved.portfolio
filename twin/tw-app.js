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
  // Evidence card: category + action per entity type (the proof sentence comes word for word from knowledge.json).
  var CATS = { project: ['Project', 'Explore Project'], cert: ['Certificate', 'View Certificate'], tool: ['Skill', 'See in Toolkit'], 'skill-group': ['Skill', 'See in Toolkit'],
    role: ['Experience', 'View Experience'], org: ['Experience', 'View Experience'], education: ['Education', 'View Education'], leadership: ['Leadership', 'View Leadership'], person: ['About', 'View About'] };
  var KIND_CAT = { project: 'project', cert: 'cert', tool: 'tool' };
  var SECTION_CAT = { '#experience': 'role', '#education': 'education', '#leadership': 'leadership', '#about': 'person', '#projects': 'project', '#certificates': 'cert', '#skills': 'tool' };
  // Mini posters, one per Work-index project (same motifs as the posters): fingerprint, resolved squares, split-flap, stopwatch, equalizer.
  var MINI = [
    '<path d="M16 9a7 7 0 0 1 7 7v2M9 16a7 7 0 0 1 3-5.7M12 22v-6a4 4 0 0 1 8 0v4M16 16v7" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>',
    '<g fill="currentColor"><rect x="8" y="9" width="4" height="4" rx="1"/><rect x="14" y="9" width="4" height="4" rx="1"/><rect x="20" y="9" width="4" height="4" rx="1"/><rect x="8" y="15" width="4" height="4" rx="1"/><rect x="14" y="15" width="4" height="4" rx="1"/><rect x="20" y="15" width="4" height="4" rx="1" opacity=".35"/><rect x="8" y="21" width="4" height="4" rx="1"/><rect x="14" y="21" width="4" height="4" rx="1" opacity=".35"/><rect x="20" y="21" width="4" height="4" rx="1" opacity=".35"/></g>',
    '<g fill="none" stroke="currentColor" stroke-width="1.6"><rect x="7" y="9" width="8" height="14" rx="2"/><rect x="17" y="9" width="8" height="14" rx="2"/><path d="M7 16h8M17 16h8"/></g>',
    '<g fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><circle cx="16" cy="17" r="7.5"/><path d="M16 17l3.5-4M14 7.5h4"/></g>',
    '<g fill="currentColor"><rect x="8" y="14" width="2.6" height="10" rx="1.3"/><rect x="12.4" y="9" width="2.6" height="15" rx="1.3"/><rect x="16.8" y="12" width="2.6" height="12" rx="1.3"/><rect x="21.2" y="16" width="2.6" height="8" rx="1.3"/></g>'
  ];
  var FOUND = ['Aha! Found something.', 'Arre, found something!', 'Got it. Let me show you.'];
  var PHONE = w.matchMedia('(max-width: 640px)');
  var HEX = '<svg viewBox="0 0 16 16" aria-hidden="true" focusable="false"><path d="M8 1.2 13.9 4.6v6.8L8 14.8 2.1 11.4V4.6Z" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="m5.4 8.1 1.8 1.8 3.5-3.6" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>';

  T.__app = function (kit) {
    var ui = kit.ui(), panel, log, body, typing, input, form, sendBtn, opener = null, busy = false, navBusy = false;
    var kb = null, engine = null, ctx = (function (c) { return c && typeof c === 'object' ? c : null; })(kit.read().ctx), msgs = (kit.read().msgs || []).slice(-MAX_MSGS), spotTimer = 0, spotScroll = null;

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
        '<div class="tw-foot"><span>Answers are built on this page. Nothing you type leaves it; this browser only remembers that you’ve visited.</span><button type="button" class="tw-hide">Hide for this visit</button></div>';
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
          kb = x.kb;
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
    // Static, built-in icon markup only (never engine or visitor text), parsed as SVG rather than injected as HTML.
    function svgFrom(markup) {
      if (markup.indexOf('xmlns') < 0) markup = markup.replace('<svg ', '<svg xmlns="http://www.w3.org/2000/svg" ');
      return d.importNode(new DOMParser().parseFromString(markup, 'image/svg+xml').documentElement, true);
    }
    // Compact proof card for the answer's target evidence: title, category, one verified sentence, action.
    function cardFor(r, ev) {
      if (!kb || !ev || !isInternal(ev)) return null;
      var f = null, en = null, i;
      for (i = 0; i < kb.facts.length && !f; i++) if (kb.facts[i].id === ev.factId) f = kb.facts[i];
      if (f) for (i = 0; i < kb.entities.length && !en; i++) if (kb.entities[i].id === f.entity) en = kb.entities[i];
      var type = en && CATS[en.type] ? en.type : (KIND_CAT[ev.kind] || SECTION_CAT[ev.target || ev.href] || null);
      if (!f || !type) return null;
      var c = CATS[type], title = en ? (en.type === 'role' && en.title ? en.title : en.name) : ev.label;
      // The proof line: a short verified fact about the same thing that the answer hasn't already said,
      // preferring a concrete figure; repo links and tool lists are left to the chips.
      var said = String(r.text || ''), proof = f.text, best = null, bestScore = -1;
      if (en) for (i = 0; i < kb.facts.length; i++) {
        var g = kb.facts[i];
        if (g.entity !== en.id || g.status === 'resume_only' || g.type === 'project_repo' || g.type === 'tool_usage' || g.text.length > 150 || said.indexOf(g.text) >= 0) continue;
        var score = (/\d/.test(g.text.replace(/\b(19|20)\d\d\b/g, '')) ? 2 : 0) + (150 - g.text.length) / 150;
        if (score > bestScore) { best = g; bestScore = score; }
      }
      if (best) proof = best.text;
      return { cat: c[0], action: c[1], title: String(title || ev.label), proof: proof, ev: ev.id, mini: ev.kind === 'project' && typeof ev.index === 'number' && ev.index < MINI.length ? ev.index : -1 };
    }
    function renderCard(r, c) {
      var ev = evidenceFor(r, c.ev);
      if (!ev) return null;
      var box = el('div', 'tw-card');
      box.setAttribute('role', 'group');
      box.setAttribute('aria-label', 'Evidence: ' + c.title);
      var icon = el('span', 'tw-card__icon');
      icon.setAttribute('aria-hidden', 'true');
      icon.appendChild(svgFrom(c.mini >= 0 ? '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" focusable="false">' + MINI[c.mini] + '</svg>' : HEX));
      box.appendChild(icon);
      var txt = el('div', 'tw-card__txt');
      txt.appendChild(el('span', 'tw-card__cat', c.cat));
      txt.appendChild(el('strong', 'tw-card__title', c.title));
      txt.appendChild(el('p', 'tw-card__proof', c.proof));
      var go = linkFor(ev, c.action, 'tw-card__go');
      go.appendChild(el('span', 'tw-card__arrow', '\u2192')).setAttribute('aria-hidden', 'true');
      txt.appendChild(go);
      box.appendChild(txt);
      return box;
    }
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
        var card = m.card ? renderCard(r, m.card) : null;
        if (card) li.appendChild(card);
        if (r.evidence && r.evidence.length) {
          var ul = el('ul', 'tw-ev');
          ul.setAttribute('aria-label', 'Evidence');
          var goId = r.target && r.target.evidence, list = r.evidence.slice(0, 4);
          // The answer's target evidence leads as the filled "Show me" chip.
          list.sort(function (a, b) { return (b && b.id === goId) - (a && a.id === goId); });
          list.forEach(function (ev) {
            if (!ev || !ev.href || !ev.label || (card && m.card.ev === ev.id)) return;
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
    var foundCount = 0, lastNag = 0;
    function nag() {
      var now = Date.now();
      if (now - lastNag < 6000) return;
      lastNag = now;
      kit.say('Bro, one mission at a time!', 2200);
    }
    // A "complex" question: long, or several questions or topics at once.
    function complex(q) {
      var words = q.split(' ').length, marks = (q.match(/\?/g) || []).length, joins = (q.match(/\b(and|aur|also|plus)\b/gi) || []).length;
      return words >= 14 || marks >= 2 || joins >= 2;
    }
    // Unknown / unverifiable: a thoughtful head tilt, then the expectant pose (never the slump).
    function ponder() {
      var p = kit.pet();
      kit.say('Umm\u2026 that\u2019s outside my territory.', 2800);
      if (!p) return;
      whenFree(function () {
        if (kit.rm()) { p.still('waiting'); return; }
        p.look(67.5);
        setTimeout(function () { if (kit.pet() === p && !navBusy && !busy) p.play('waiting', { loop: false }); }, 520);
      });
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
      if (q && busy) { nag(); return false; }
      if (!q) return false;
      if (activeTour) activeTour.stop();
      busy = true;
      dropFollowUps();
      push({ role: 'user', text: q.slice(0, 280) });
      setTyping(true);
      var p = kit.pet();
      clearTimeout(listenTimer);
      if (p) p.play('working', { loop: true });
      if (complex(q) && !kit.read().gta) { kit.save({ gta: true }); setTimeout(function () { kit.say('Oh sh*t, here we go again.', 2400); }, 120); }
      var t0 = Date.now(), minWait = kit.rm() ? 150 : 520;
      getEngine().then(function (E) {
        return E.ask(q, ctx);
      }).then(function (r) {
        return new Promise(function (ok) { setTimeout(function () { ok(r); }, Math.max(0, minWait - (Date.now() - t0))); });
      }).then(function (r) {
        r = r || {};
        var m = { role: 'bot', r: { kind: r.kind, text: r.text, segments: r.segments, evidence: r.evidence, followUps: r.followUps, target: r.target ? { evidence: r.target.evidence || null } : null } }; // never r.debug: it holds the visitor's question
        // Evidence Scan runs only for a confident answer that has verified evidence and a section to show.
        var goEv = r.kind === 'answer' && r.mood === 'review' && r.target && r.target.evidence ? evidenceFor(r, r.target.evidence) : null;
        if (goEv && !isInternal(goEv)) goEv = null;
        var c = goEv ? cardFor(r, goEv) : null;
        if (c) m.card = c;
        setTyping(false);
        push(m);
        kit.announce('SHK JAVED: ' + (r.text || '') + (r.evidence && r.evidence.length ? ' ' + r.evidence.length + (r.evidence.length === 1 ? ' evidence link' : ' evidence links') + ' below.' : ''));
        var mine = msgs.length;
        if (r.mood === 'failed') { ponder(); return; }
        if (goEv) {
          kit.say(FOUND[(foundCount++) % FOUND.length]);
          var pr = kit.pet();
          if (pr) pr.play('review', { loop: false });
          // card first (the visitor reads the answer), then the scan, then the page moves: once per answer,
          // and never after the visitor already started a tour by hand (gen changed).
          var gen = tourGen;
          setTimeout(function () { whenFree(function () { if (msgs.length === mine && !busy && gen === tourGen) tour(goEv, { auto: true }); }); }, kit.rm() ? 200 : 900);
          return;
        }
        petMood(r.mood);
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
        ponder();
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
      // clamp below the real header and above the phone tour strip, so no edge of the frame is hidden
      var hd = d.getElementById('site-header'), floor = vh - (stripOn() ? stripEl().offsetHeight : 0) - 6;
      var top = Math.max(r.top - pad, (hd ? hd.getBoundingClientRect().bottom : 70) + 6), bottom = Math.min(r.bottom + pad, floor), left = Math.max(r.left - pad, 6), right = Math.min(r.right + pad, vw - 6);
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
    // The page scan: a thin kale line sweeps toward where the evidence is (down or up), once, then the page moves.
    function scan(down) {
      var sc = ui.scan;
      if (!sc || kit.rm()) return Promise.resolve();
      return new Promise(function (ok) {
        sc.classList.remove('is-on', 'is-up');
        void sc.offsetWidth;
        if (!down) sc.classList.add('is-up');
        sc.classList.add('is-on');
        var done = false, fin = function () { if (done) return; done = true; sc.classList.remove('is-on', 'is-up'); ok(); };
        sc.addEventListener('animationend', fin, { once: true });
        setTimeout(fin, 900);
      });
    }
    // t = the element the visitor needs to read (a cert's whole slide with its copy, a section's key card).
    function coveredByPanel(t) {
      if (!isOpen()) return false;
      var a = t.getBoundingClientRect(), b = panel.getBoundingClientRect();
      var top = Math.max(a.top, 0), bottom = Math.min(a.bottom, w.innerHeight), vis = Math.max(0, bottom - top) * Math.max(0, a.width);
      if (!vis) return false;
      var ox = Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left)), oy = Math.max(0, Math.min(bottom, b.bottom) - Math.max(top, b.top));
      return ox * oy / vis > 0.25;
    }
    // A whole section is too big to frame: spotlight its first visible key card, else its heading.
    var KEY_BLOCK = '.education__card,.timeline-item,.lead-card--feature,.about__statement';
    function spotOf(t) {
      if (t.tagName !== 'SECTION') return t;
      var list = t.querySelectorAll(KEY_BLOCK), i, r;
      for (i = 0; i < list.length; i++) { r = list[i].getBoundingClientRect(); if (r.height && r.top < w.innerHeight * 0.85 && r.bottom > 90) return list[i]; }
      return t.querySelector('h2') || t;
    }
    // Phones on tour: the small pet walks inside a slim strip along the bottom edge (tw.css .tw-strip).
    function stripEl() { return ui.root.querySelector('.tw-strip'); }
    function stripOn() { return PHONE.matches && !isOpen() && kit.touringNow(); }
    // Where the speech bubble goes (kit.say): beside the pet inside the strip; right of the open chat on desktop (or beside
    // the pet when the chat sits above it); never on the chat. null = the default spot above the pet.
    kit.placer(function (r, b) {
      var vw = w.innerWidth, cx = r.left + r.width / 2, right;
      if (stripOn()) {
        var roomL = r.left - 14, roomR = vw - r.right - 14;
        right = roomR > roomL;
        b.classList.add('is-side');
        if (right) b.classList.add('is-right');
        return (right ? 'left:' + Math.round(r.right + 6) : 'right:' + Math.round(vw - r.left + 6)) + 'px;top:' + Math.round(w.innerHeight - stripEl().offsetHeight + 34) +
          'px;max-width:' + Math.round(Math.min(220, Math.max(90, right ? roomR : roomL))) + 'px';
      }
      if (!isOpen() || PHONE.matches) return null;
      var p = panel.getBoundingClientRect(), col = vw - p.right - 12, top = 'px;top:' + Math.round(Math.max(76, r.top - 14)) + 'px;max-width:';
      if (cx > p.right && col >= 100) return 'right:6' + top + Math.round(col) + 'px';
      if (cx < p.left) return 'right:' + Math.round(Math.max(vw - p.left + 8, vw - cx - 28)) + top + Math.round(Math.min(260, p.left - 16)) + 'px';
      b.classList.add('is-side');
      return 'right:' + Math.round(vw - r.left + 6) + 'px;top:' + Math.round(r.top + r.height / 2) + 'px;max-width:' + Math.round(Math.min(260, r.left - 16)) + 'px';
    });
    // Evidence tour: scan, move the page once, walk toward the evidence, look at it, say a line, then walk home.
    // The visitor stays in charge: a wheel, touch or key scroll, or a new question, ends the tour at once and the pet
    // goes straight home; the page is never moved again by that tour.
    var activeTour = null, tourGen = 0;
    // Lazy images near the evidence get their real size before the page moves. Otherwise scroll anchoring nudges
    // the page again as each one loads after the jump (extra jumps, back and forth). Capped, so a slow image never holds the tour.
    function settleImages(sec) {
      if (!sec) return Promise.resolve();
      var r = sec.getBoundingClientRect(), vh = w.innerHeight, list = [];
      Array.prototype.forEach.call(d.querySelectorAll('main img[loading="lazy"]'), function (img) {
        if (img.complete) return;
        var ir = img.getBoundingClientRect();
        if (ir.top > r.bottom || ir.bottom < r.top - vh * 2) return;
        list.push(new Promise(function (ok) { img.addEventListener('load', ok, { once: true }); img.addEventListener('error', ok, { once: true }); }));
        img.loading = 'eager';
      });
      if (!list.length) return Promise.resolve();
      return Promise.race([Promise.all(list), new Promise(function (ok) { setTimeout(ok, 600); })]);
    }
    function whenFree(fn, delay) {
      var t0 = Date.now();
      (function wait() { if (!navBusy) fn(); else if (Date.now() - t0 < 5000) setTimeout(wait, 150); })();
    }
    function tour(ev, how) {
      if (!(how && how.auto)) tourGen++;
      if (navBusy) {
        if (activeTour && !(how && how.auto)) { activeTour.manual = true; if (activeTour.target) focusTarget(activeTour.target); }
        return;
      }
      navBusy = true;
      var auto = !!(how && how.auto), phone = PHONE.matches, rm = kit.rm(), p = kit.pet();
      var T = { stopped: false, ended: false, phase: 'scan', timer: 0, k: 1 }; // k: the pet's on-screen scale (phones: .6)
      activeTour = T;
      var arg = { kind: ev.kind, index: ev.index, select: ev.select, target: ev.target || (ev.href && ev.href.charAt(0) === '#' ? ev.href : null) };
      var onKey = function (e) { if (e.target !== input && /^(PageUp|PageDown|ArrowUp|ArrowDown|Home|End| )$/.test(e.key)) T.stop(); };
      var onUser = function () { T.stop(); };
      w.addEventListener('wheel', onUser, { passive: true });
      w.addEventListener('touchmove', onUser, { passive: true });
      d.addEventListener('keydown', onKey);
      function end() {
        if (T.ended) return;
        T.ended = true;
        clearTimeout(T.timer);
        w.removeEventListener('wheel', onUser);
        w.removeEventListener('touchmove', onUser);
        d.removeEventListener('keydown', onKey);
        var pp = kit.pet();
        var finish = function () { if (activeTour === T) activeTour = null; kit.touring(false); navBusy = false; if (pp && pp.state !== 'look') pp.idle(); };
        if (!pp) { finish(); return; }
        pp.idle(); // freezes a walk wherever it is, so "home" is measured from the real position
        var back = -(pp.x || 0);
        if (!back) { finish(); return; }
        if (rm) { pp.walkBy(back).then(finish); return; }
        pp.walkBy(back, { speed: (T.stopped ? 700 : (phone ? 240 : 380)) / T.k }).then(function (ok) {
          if (!ok && pp.x) { pp.idle(); return pp.walkBy(-pp.x, { speed: 2400 / T.k }).then(finish); }
          finish();
        });
      }
      T.stop = function () { if (T.stopped) return; T.stopped = true; kit.hush(); if (T.phase !== 'scan') end(); };
      if (phone || !isOpen()) close(false); // phones: the sheet steps aside so the section is visible (one tap brings it back)
      kit.touring(true);
      if (p) {
        p.play('review', { loop: true });
        if (!rm) Promise.resolve(p.preload(['run-left', 'jump'])).then(function (ok) { if (ok) jumpReady = true; }, function () {});
      }
      var guess = d.querySelector(arg.target || '#' + ({ project: 'projects', cert: 'certificates', tool: 'skills' }[ev.kind] || 'about'));
      var down = !guess || guess.getBoundingClientRect().top > w.innerHeight * 0.3;
      Promise.all([scan(down), settleImages(guess)]).then(function () {
        if (T.stopped) return null;
        T.phase = 'move';
        if (w.SHKSite && typeof w.SHKSite.go === 'function') return w.SHKSite.go(arg);
        var t = arg.target ? d.querySelector(arg.target) : null;
        if (t) t.scrollIntoView({ block: 'start', behavior: rm ? 'auto' : 'smooth' });
        return new Promise(function (ok) { setTimeout(function () { ok(t); }, rm ? 80 : 750); });
      }).then(function (t) {
        if (T.stopped || !t) { if (!t && !T.stopped) kit.announce('That section is not on the page.'); end(); return; }
        var spot = spotOf(t);
        // desktop keeps the chat open unless it would hide what the visitor needs to read
        if (coveredByPanel(t.closest('.cert') || spot)) close(false);
        spotlight(spot);
        T.target = t;
        if (!auto || T.manual || phone || !isOpen()) focusTarget(t);
        kit.announce('Moved to ' + (ev.label || 'the evidence') + (isOpen() ? '.' : '. Press the guide button to return to the conversation.'));
        // walk toward the evidence along the bottom edge (desktop: across the page; phones: inside the strip only)
        var pp = kit.pet(), dx = 0, vw = w.innerWidth;
        if (pp && !rm) {
          var tr = spot.getBoundingClientRect(), pr = ui.stage.getBoundingClientRect(), mid = tr.left + tr.width / 2;
          var aim = phone ? Math.max(vw * 0.3, Math.min(vw * 0.7, mid)) : Math.max(tr.left + 40, Math.min(tr.right - 60, mid));
          T.k = pr.width / 96 || 1; // walkBy moves in the pet's own (unscaled) pixels
          dx = Math.round(aim - (pr.left + pr.width / 2));
          dx = Math.min(0, Math.max(dx, -(phone ? vw * 0.7 : Math.min(620, vw * 0.5))));
          if (dx > -40) dx = 0;
        }
        T.phase = 'walk';
        if (dx) kit.hush(true); // the pet is about to leave: the current line ends once it has been readable
        return (dx ? pp.walkBy(dx / T.k, { speed: (phone ? 240 : 380) / T.k }) : Promise.resolve(true)).then(function () {
          if (T.stopped || T.ended) return;
          T.phase = 'arrive';
          var p2 = kit.pet(), first = ev.kind === 'project' && !kit.read().cheered;
          if (first) kit.save({ cheered: true });
          if (p2) {
            if (first && !rm) hop(p2, { loop: false }).then(function () { if (!T.stopped && kit.pet() === p2) look(spot); });
            else look(spot);
          }
          kit.say(first ? 'Now we\u2019re talking!' : 'Here\u2019s the proof.', 2400);
          if (!isOpen()) kit.showHint(3000);
          T.timer = setTimeout(end, 2600);
        });
      }).catch(function (e) { if (w.console) console.warn(e); end(); });
    }
    function showMe(ev) { tour(ev, { auto: false }); }

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
