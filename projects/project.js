/* Project case studies: navigation, the poster, and the interactive dashboards / walkthrough.
   Vanilla, no dependencies. Dashboards fetch their own small JSON (projects/data/) only when they come near the screen,
   and render with plain HTML/SVG (textContent only, never innerHTML with data). */
(function () {
  'use strict';
  var d = document, w = window;
  var RM = w.matchMedia('(prefers-reduced-motion: reduce)');
  var NF = new Intl.NumberFormat('en-US');
  var MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  /* ---------- back to projects: when we came from the home page, step back in history so it returns to the same spot ---------- */
  d.addEventListener('click', function (e) {
    var a = e.target.closest && e.target.closest('a[data-back]');
    if (!a || e.defaultPrevented || e.button || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    try {
      var ref = d.referrer ? new URL(d.referrer) : null, home = new URL(a.getAttribute('href'), location.href);
      if (ref && ref.origin === location.origin && ref.pathname.replace(/index\.html$/, '') === home.pathname && history.length > 1) { e.preventDefault(); history.back(); }
    } catch (x) { /* fall back to the link */ }
  });

  /* ---------- the poster plays while it is on screen (same play/reset hooks as the home page) ---------- */
  var poster = d.querySelector('.pd-hero__poster .work-poster');
  if (poster) {
    if ('IntersectionObserver' in w) {
      new IntersectionObserver(function (es) {
        var on = es[es.length - 1].isIntersecting;
        if (on) poster.classList.add('is-play');
        else if (poster.classList.contains('is-play')) { poster.classList.remove('is-play'); poster.classList.add('is-reset'); void poster.offsetWidth; poster.classList.remove('is-reset'); }
      }, { threshold: 0.25 }).observe(poster);
    } else poster.classList.add('is-play');
  }

  /* ---------- tiny DOM helpers ---------- */
  function el(tag, cls, text) { var n = d.createElement(tag); if (cls) n.className = cls; if (text != null) n.textContent = text; return n; }
  var SVGNS = 'http://www.w3.org/2000/svg';
  function sv(tag, attrs) { var n = d.createElementNS(SVGNS, tag); for (var k in attrs) n.setAttribute(k, attrs[k]); return n; }
  function clear(n) { while (n.firstChild) n.removeChild(n.firstChild); return n; }
  function fmt(n, dp) { return dp ? (Math.round(n * Math.pow(10, dp)) / Math.pow(10, dp)).toFixed(dp) : NF.format(Math.round(n)); }
  function compact(n) { return n >= 1e9 ? (n / 1e9).toFixed(n >= 9.95e9 ? 0 : 1) + 'B' : n >= 1e6 ? (n / 1e6).toFixed(n >= 1e8 ? 0 : 1) + 'M' : n >= 1e3 ? (n / 1e3).toFixed(1) + 'K' : String(Math.round(n)); }
  function pct(a, b) { return b ? Math.round(a / b * 100) : 0; }

  function seg(name, opts, value, onChange, cls) {
    var wrap = el('div', 'dash__ctl'), group = el('div', 'seg' + (cls ? ' ' + cls : ''));
    var label = el('span', 'ctl-name', name);
    group.setAttribute('role', 'group');
    group.setAttribute('aria-label', name);
    var buttons = opts.map(function (o) {
      var b = el('button', null, o.label);
      b.type = 'button';
      b.setAttribute('aria-pressed', String(o.value === value));
      if (o.title) b.title = o.title;
      b.addEventListener('click', function () {
        if (b.disabled) return;
        buttons.forEach(function (x) { x.setAttribute('aria-pressed', String(x === b)); });
        onChange(o.value);
      });
      group.appendChild(b);
      return b;
    });
    wrap.appendChild(label); wrap.appendChild(group);
    wrap.style.display = 'flex'; wrap.style.flexWrap = 'wrap'; wrap.style.alignItems = 'center'; wrap.style.gap = '.5rem';
    return { node: wrap, buttons: buttons, opts: opts };
  }
  function kpis(list) {
    var g = el('div', 'kpis');
    list.forEach(function (k) {
      var c = el('div', 'kpi'), v = el('span', 'kpi__v', k.v);
      if (k.u) v.appendChild(el('small', null, k.u));
      c.appendChild(v); c.appendChild(el('span', 'kpi__k', k.k));
      g.appendChild(c);
    });
    return g;
  }
  function card(title, sub, span) {
    var c = el('div', 'card' + (span ? ' card--' + span : '')), h = el('h3', null, title);
    if (sub) h.appendChild(el('small', null, sub));
    c.appendChild(h);
    return c;
  }
  function hbars(items, fmtV) {
    var max = Math.max.apply(null, items.map(function (i) { return i.v; }).concat([1])), box = el('div', 'hbars');
    items.forEach(function (i) {
      var row = el('div', 'hbar'), t = el('span', 'hbar__t'), f = el('span', 'hbar__f');
      var l = el('span', 'hbar__l', i.l); l.title = i.l;
      f.style.width = (i.v / max * 100).toFixed(2) + '%';
      t.appendChild(f);
      row.appendChild(l); row.appendChild(t); row.appendChild(el('span', 'hbar__v', fmtV ? fmtV(i.v) : fmt(i.v)));
      box.appendChild(row);
    });
    return box;
  }
  function cols(items, opts) {
    opts = opts || {};
    var max = Math.max.apply(null, items.map(function (i) { return i.v; }).concat([1])), peak = -1, pv = -1;
    items.forEach(function (i, k) { if (i.v > pv) { pv = i.v; peak = k; } });
    var wrap = el('div'), box = el('div', 'cols' + (opts.dense ? ' cols--dense' : '') + (items.length > 8 ? ' cols--many' : '')), x = el('div', 'cols__x' + (opts.dense ? ' cols__x--dense' : ''));
    items.forEach(function (i, k) {
      var c = el('div', 'col'), f = el('span', 'col__f' + (k === peak && opts.peak ? ' is-peak' : ''));
      c.style.setProperty('--h', (i.v / max * 84).toFixed(2) + '%'); // headroom so the value sits above its bar
      f.title = i.l + ': ' + fmt(i.v);
      c.appendChild(el('span', 'col__v', opts.fmt ? opts.fmt(i.v) : fmt(i.v)));
      c.appendChild(f);
      box.appendChild(c);
      x.appendChild(el('span', null, (opts.every && k % opts.every) || (opts.dense && k > items.length - 8) ? '' : i.l)); // no label hanging off the last bars
    });
    box.setAttribute('role', 'img');
    box.setAttribute('aria-label', items.map(function (i) { return i.l + ' ' + fmt(i.v); }).join(', '));
    wrap.appendChild(box); wrap.appendChild(x);
    return wrap;
  }
  var PAL = ['#00251a', '#7a8f3c', '#006064', '#BCC88B', '#26a69a', '#8d6e63', '#9e9e9e'];
  function donut(parts, center, sub) {
    var total = parts.reduce(function (s, p) { return s + p.v; }, 0) || 1, box = el('div', 'donut');
    var svg = sv('svg', { viewBox: '0 0 120 120', role: 'img', 'aria-label': parts.map(function (p) { return p.l + ' ' + pct(p.v, total) + '%'; }).join(', ') });
    var r = 46, C = 2 * Math.PI * r, off = 0;
    svg.appendChild(sv('circle', { cx: 60, cy: 60, r: r, fill: 'none', stroke: 'rgba(0,77,64,.08)', 'stroke-width': 16 }));
    parts.forEach(function (p, k) {
      var len = p.v / total * C;
      svg.appendChild(sv('circle', { cx: 60, cy: 60, r: r, fill: 'none', stroke: p.c || PAL[k % PAL.length], 'stroke-width': 16, 'stroke-dasharray': len + ' ' + (C - len), 'stroke-dashoffset': -off, transform: 'rotate(-90 60 60)' }));
      off += len;
    });
    var t = sv('text', { x: 60, y: 62, 'text-anchor': 'middle', class: 'donut__c' }); t.textContent = center; svg.appendChild(t);
    var s = sv('text', { x: 60, y: 76, 'text-anchor': 'middle', class: 'donut__s' }); s.textContent = sub || ''; svg.appendChild(s);
    var lg = el('ul', 'legend');
    parts.forEach(function (p, k) {
      var li = el('li'), sw = el('i'); sw.style.background = p.c || PAL[k % PAL.length];
      li.appendChild(sw); li.appendChild(el('span', null, p.l)); li.appendChild(el('b', null, pct(p.v, total) + '% · ' + fmt(p.v)));
      lg.appendChild(li);
    });
    box.appendChild(svg); box.appendChild(lg);
    return box;
  }
  function radar(axes) {
    var n = axes.length, cx = 170, cy = 150, R = 105, box = el('div', 'radar');
    var svg = sv('svg', { viewBox: '0 0 340 300', role: 'img', 'aria-label': axes.map(function (a) { return a.l + ' ' + Math.round(a.v); }).join(', ') });
    function pt(k, v) { var a = -Math.PI / 2 + k * 2 * Math.PI / n; return [cx + Math.cos(a) * R * v / 100, cy + Math.sin(a) * R * v / 100]; }
    [25, 50, 75, 100].forEach(function (lv) { svg.appendChild(sv('polygon', { class: 'radar__grid', points: axes.map(function (_, k) { return pt(k, lv).join(','); }).join(' ') })); });
    axes.forEach(function (a, k) { var p = pt(k, 100); svg.appendChild(sv('line', { class: 'radar__grid', x1: cx, y1: cy, x2: p[0], y2: p[1] })); });
    svg.appendChild(sv('polygon', { class: 'radar__shape', points: axes.map(function (a, k) { return pt(k, a.v).join(','); }).join(' ') }));
    axes.forEach(function (a, k) {
      var p = pt(k, 122), t = sv('text', { x: p[0], y: p[1], 'text-anchor': Math.abs(p[0] - cx) < 8 ? 'middle' : p[0] > cx ? 'start' : 'end', class: 'radar__lbl' });
      t.textContent = a.l; svg.appendChild(t);
      var v = sv('text', { x: p[0], y: p[1] + 11, 'text-anchor': Math.abs(p[0] - cx) < 8 ? 'middle' : p[0] > cx ? 'start' : 'end', class: 'radar__val' });
      v.textContent = Math.round(a.v) + '%'; svg.appendChild(v);
    });
    box.appendChild(svg);
    return box;
  }
  function head(root, label) {
    var top = el('div', 'dash__top'), l = el('span', 'dash__label');
    var b = el('span', 'pd-badge pd-badge--live'), k = el('span', 'pd-badge__k', 'Live');
    b.appendChild(k); b.appendChild(d.createTextNode(label));
    l.appendChild(b);
    top.appendChild(l);
    root.appendChild(top);
    return top;
  }

  /* ---------- Hospital ER: the Excel dashboard's views, filterable by year and month (pre-aggregated cube) ---------- */
  function hospital(root, D) {
    var S = { y: 'all', m: 'all' }, body = el('div');
    clear(root);
    head(root, 'Rebuilt from the project’s dataset · ' + fmt(D.source.rows) + ' records');
    var ctl = el('div', 'dash__controls');
    var yrs = seg('Year', [{ label: 'All', value: 'all' }].concat(D.dims.years.map(function (y) { return { label: String(y), value: y }; })), 'all', function (v) { S.y = v; sync(); draw(); });
    var mos = seg('Month', [{ label: 'All', value: 'all' }].concat(MONTHS.map(function (m, k) { return { label: m, value: k + 1 }; })), 'all', function (v) { S.m = v; draw(); }, 'seg--months');
    ctl.appendChild(yrs.node); ctl.appendChild(mos.node);
    root.appendChild(ctl); root.appendChild(body);
    var chk = el('p', 'dash__check');
    chk.appendChild(el('b', null, 'Check it against the original: '));
    chk.appendChild(d.createTextNode('pick Year All and Feb, and you get the Excel screenshot below exactly: 431 patients, 36.67 min, 4.72. (In the workbook the Year slicer isn\u2019t connected to the KPIs, so its Feb is February 2024, the only February in the data.)'));
    root.appendChild(chk);
    var note = el('p', 'dash__note');
    note.textContent = 'On time = waited 30 minutes or less, the workbook\u2019s own rule. Satisfaction is out of 10, averaged over the visits that recorded a score (27%). Age bins use the workbook\u2019s labels. Data: April 2023 to October 2024.';
    root.appendChild(note);
    function sync() { // months with no data for the chosen year are disabled
      mos.buttons.forEach(function (b, k) {
        if (!k) return;
        var has = D.cells.some(function (c) { return c.m === k && (S.y === 'all' || c.y === S.y); });
        b.disabled = !has;
        if (!has && S.m === k) { S.m = 'all'; mos.buttons.forEach(function (x, j) { x.setAttribute('aria-pressed', String(j === 0)); }); }
      });
    }
    function sum() {
      var a = { n: 0, waitSum: 0, satSum: 0, satN: 0, onTime: 0, admitted: 0, notAdmitted: 0, gender: {}, age: D.dims.ageGroups.map(function () { return 0; }), dept: {} };
      D.cells.forEach(function (c) {
        if ((S.y !== 'all' && c.y !== S.y) || (S.m !== 'all' && c.m !== S.m)) return;
        ['n', 'waitSum', 'satSum', 'satN', 'onTime', 'admitted', 'notAdmitted'].forEach(function (k) { a[k] += c[k] || 0; });
        Object.keys(c.gender || {}).forEach(function (g) { a.gender[g] = (a.gender[g] || 0) + c.gender[g]; });
        (c.age || []).forEach(function (v, k) { a.age[k] += v; });
        Object.keys(c.dept || {}).forEach(function (g) { a.dept[g] = (a.dept[g] || 0) + c.dept[g]; });
      });
      return a;
    }
    function draw() {
      var a = sum();
      clear(body);
      body.appendChild(kpis([
        { v: fmt(a.n), k: 'Patients' },
        { v: a.n ? fmt(a.waitSum / a.n, 2) : '–', u: 'min', k: 'Average wait' },
        { v: a.satN ? fmt(a.satSum / a.satN, 2) : '–', u: '/ 10', k: 'Satisfaction (avg)' },
        { v: a.n ? pct(a.admitted, a.n) + '%' : '–', k: 'Admitted' }
      ]));
      var g = el('div', 'cards');
      var c1 = card('Patients attended on time', D.rules && D.rules.onTimeShort ? D.rules.onTimeShort : null, 4);
      c1.appendChild(donut([{ l: 'On time', v: a.onTime, c: '#7a8f3c' }, { l: 'Delayed', v: a.n - a.onTime, c: '#00251a' }], pct(a.onTime, a.n) + '%', 'on time'));
      var c2 = card('Gender', null, 4);
      c2.appendChild(donut(Object.keys(a.gender).map(function (k, i) { return { l: { F: 'Female', M: 'Male', NC: 'Not stated' }[k] || k, v: a.gender[k], c: PAL[i] }; }), fmt(a.n), 'patients'));
      var c3 = card('Admission status', null, 4);
      c3.appendChild(hbars([{ l: 'Admitted', v: a.admitted }, { l: 'Not admitted', v: a.notAdmitted }], function (v) { return fmt(v) + ' · ' + pct(v, a.n) + '%'; }));
      var c4 = card('Patients by age group', null, 6);
      c4.appendChild(cols(D.dims.ageGroups.map(function (l, k) { return { l: l, v: a.age[k] }; }), { peak: true }));
      var c5 = card('Department referrals', 'Patients referred to each department', 6);
      c5.appendChild(hbars(Object.keys(a.dept).map(function (k) { return { l: k, v: a.dept[k] }; }).sort(function (x, y) { return y.v - x.v; })));
      [c1, c2, c3, c4, c5].forEach(function (c) { g.appendChild(c); });
      body.appendChild(g);
    }
    sync(); draw();
  }

  function dayISO(zero, n) { var t = new Date(zero + 'T00:00:00Z'); t.setUTCDate(t.getUTCDate() + n); return t.toISOString().slice(0, 10); }

  /* ---------- Customer Service MIS: complaints by day, hour, state, status and channel (row-level, compact) ---------- */
  function service(root, D) {
    var F = {}; D.fields.forEach(function (f, i) { F[f] = i; });
    var dict = D.dicts || {};
    var rows = D.rows.map(function (r) {
      var dv = r[F.d], date = typeof dv === 'string' ? dv : (typeof dv === 'number' && D.source && D.source.dayZero ? dayISO(D.source.dayZero, dv) : null);
      return { date: date, month: date ? date.slice(0, 7) : null, h: F.h != null ? r[F.h] : null, s: dict.state ? dict.state[r[F.s]] : null, st: dict.status ? dict.status[r[F.st]] : null, v: dict.via && F.v != null ? dict.via[r[F.v]] : null, cat: dict.category && F.cat != null ? dict.category[r[F.cat]] : null };
    });
    var months = Array.from(new Set(rows.map(function (r) { return r.month; }).filter(Boolean))).sort();
    var vias = dict.via || [];
    var S = { m: 'all', v: 'all' }, body = el('div');
    function isResolved(st) { return /closed|solved|resolved/i.test(st || ''); }
    clear(root);
    head(root, 'Rebuilt from the project’s dataset · ' + fmt(rows.length) + ' complaints');
    var ctl = el('div', 'dash__controls');
    if (months.length > 1) ctl.appendChild(seg('Month', [{ label: 'All', value: 'all' }].concat(months.map(function (m) { return { label: MONTHS[+m.slice(5, 7) - 1] + ' ' + m.slice(0, 4), value: m }; })), 'all', function (v) { S.m = v; draw(); }, 'seg--months').node);
    if (vias.length > 1) ctl.appendChild(seg('Channel', [{ label: 'All', value: 'all' }].concat(vias.map(function (v) { return { label: v, value: v }; })), 'all', function (v) { S.v = v; draw(); }).node);
    root.appendChild(ctl); root.appendChild(body);
    var note = el('p', 'dash__note');
    note.textContent = 'Dates corrected: the source file swaps day and month for 572 complaints; fixed here, every complaint falls between 1 April and 30 June 2015. Resolved = Solved or Closed. Themes are an approximate keyword grouping of the complaint text, not the original Power BI categories.';
    root.appendChild(note);
    function count(list, key) { var o = {}; list.forEach(function (r) { var k = r[key]; if (k != null) o[k] = (o[k] || 0) + 1; }); return o; }
    function draw() {
      var L = rows.filter(function (r) { return (S.m === 'all' || r.month === S.m) && (S.v === 'all' || r.v === S.v); });
      var res = L.filter(function (r) { return isResolved(r.st); }).length;
      var hours = new Array(24).fill(0); L.forEach(function (r) { if (r.h != null) hours[r.h]++; });
      var peakH = hours.indexOf(Math.max.apply(null, hours));
      clear(body);
      body.appendChild(kpis([
        { v: fmt(L.length), k: 'Complaints' },
        { v: L.length ? pct(res, L.length) + '%' : '–', k: 'Resolved' },
        { v: fmt(L.length - res), k: 'Still open / pending' },
        { v: F.h != null && L.length ? String(peakH).padStart(2, '0') + ':00' : '–', k: 'Peak hour' }
      ]));
      var g = el('div', 'cards');
      var days = count(L, 'date'), dk = Object.keys(days).sort();
      if (dk.length > 1) {
        var c0 = card('Complaints per day', dk[0] + ' to ' + dk[dk.length - 1], 12);
        c0.appendChild(cols(dk.map(function (k) { return { l: +k.slice(8, 10) + ' ' + MONTHS[+k.slice(5, 7) - 1], v: days[k] }; }), { dense: true, every: 15, peak: true }));
        g.appendChild(c0);
      }
      if (F.h != null) {
        var c1 = card('Complaints by hour of day', null, 8);
        c1.appendChild(cols(hours.map(function (v, k) { return { l: String(k).padStart(2, '0'), v: v }; }), { dense: true, every: 3, peak: true }));
        g.appendChild(c1);
      }
      var st = count(L, 'st'), c2 = card('Status', null, 4);
      c2.appendChild(donut(Object.keys(st).sort(function (a, b) { return st[b] - st[a]; }).map(function (k, i) { return { l: k, v: st[k], c: PAL[i] }; }), pct(res, L.length) + '%', 'resolved'));
      g.appendChild(c2);
      var ss = count(L, 's'), c3 = card('Top states', 'By number of complaints', 6);
      c3.appendChild(hbars(Object.keys(ss).map(function (k) { return { l: k, v: ss[k] }; }).sort(function (a, b) { return b.v - a.v; }).slice(0, 10)));
      g.appendChild(c3);
      if (dict.category) {
        var cc = count(L, 'cat'), c4 = card('Complaint themes', 'Keyword grouping of the complaint text (approximate)', 6);
        c4.appendChild(hbars(Object.keys(cc).map(function (k) { return { l: k, v: cc[k] }; }).sort(function (a, b) { return b.v - a.v; })));
        g.appendChild(c4);
      }
      body.appendChild(g);
    }
    draw();
  }

  /* ---------- Spotify 2023: rankings, decades and audio features, filterable by release era (row-level) ---------- */
  function spotify(root, D) {
    var F = {}; D.fields.forEach(function (f, i) { F[f] = i; });
    var rows = D.rows;
    var ERAS = [
      { label: 'All', value: 'all', test: function () { return true; } },
      { label: 'Before 2000', value: 'pre', test: function (y) { return y < 2000; } },
      { label: '2000s', value: '2000', test: function (y) { return y >= 2000 && y < 2010; } },
      { label: '2010s', value: '2010', test: function (y) { return y >= 2010 && y < 2020; } },
      { label: '2020–21', value: '2020', test: function (y) { return y >= 2020 && y < 2022; } },
      { label: '2022', value: '2022', test: function (y) { return y === 2022; } },
      { label: '2023', value: '2023', test: function (y) { return y === 2023; } }
    ];
    var S = { era: 'all' }, body = el('div');
    clear(root);
    head(root, 'Rebuilt from the project’s dataset · ' + fmt(rows.length) + ' tracks');
    var ctl = el('div', 'dash__controls');
    ctl.appendChild(seg('Released', ERAS.map(function (e) { return { label: e.label, value: e.value }; }), 'all', function (v) { S.era = v; draw(); }).node);
    root.appendChild(ctl); root.appendChild(body);
    var note = el('p', 'dash__note');
    note.textContent = 'Streams are all-time Spotify streams as recorded in the 2023 dataset (Kaggle; 932 tracks in the project\u2019s workbook). Audio features are Spotify\u2019s 0–100 scores, averaged over the tracks shown. A few names show \u201c\ufffd\u201d where the source file lost characters.';
    root.appendChild(note);
    function draw() {
      var era = ERAS.filter(function (e) { return e.value === S.era; })[0];
      var L = rows.filter(function (r) { return era.test(r[F.y]); });
      var total = L.reduce(function (s, r) { return s + (r[F.streams] || 0); }, 0);
      clear(body);
      body.appendChild(kpis([
        { v: fmt(L.length), k: 'Tracks' },
        { v: compact(total), k: 'Total streams' },
        { v: L.length ? compact(total / L.length) : '–', k: 'Average streams per track' },
        { v: L.length ? fmt(L.reduce(function (s, r) { return s + (r[F.bpm] || 0); }, 0) / L.length) : '–', u: 'bpm', k: 'Average tempo' }
      ]));
      var g = el('div', 'cards');
      var c1 = card('Top 10 tracks', 'By streams', 6);
      c1.appendChild(hbars(L.slice().sort(function (a, b) { return b[F.streams] - a[F.streams]; }).slice(0, 10).map(function (r) { return { l: r[F.t] + ' · ' + r[F.a], v: r[F.streams] }; }), compact));
      var by = {}; L.forEach(function (r) { by[r[F.a]] = (by[r[F.a]] || 0) + r[F.streams]; });
      var c2 = card('Top 10 artists', 'Total streams, by the artist credit as listed', 6);
      c2.appendChild(hbars(Object.keys(by).map(function (k) { return { l: k, v: by[k] }; }).sort(function (a, b) { return b.v - a.v; }).slice(0, 10), compact));
      var dec = {}; rows.forEach(function (r) { var k = Math.floor(r[F.y] / 10) * 10; dec[k] = dec[k] || { n: 0, s: 0 }; dec[k].n++; dec[k].s += r[F.streams]; });
      var dks = Object.keys(dec).map(Number).sort(function (a, b) { return a - b; });
      var c3 = card('Streams by release decade', 'All tracks · total streams', 6);
      c3.appendChild(cols(dks.map(function (k) { return { l: k + 's', v: dec[k].s }; }), { fmt: compact, peak: true }));
      var feats = [['dance', 'Dance'], ['energy', 'Energy'], ['valence', 'Mood'], ['acoustic', 'Acoustic'], ['live', 'Live'], ['speech', 'Speech'], ['instrumental', 'Instrum.']].filter(function (f) { return F[f[0]] != null; });
      var c4 = card('Audio features', 'Average over the tracks shown', 6);
      c4.appendChild(radar(feats.map(function (f) { return { l: f[1], v: L.length ? L.reduce(function (s, r) { return s + (r[F[f[0]]] || 0); }, 0) / L.length : 0 }; })));
      [c1, c2, c3, c4].forEach(function (c) { g.appendChild(c); });
      body.appendChild(g);
    }
    draw();
  }

  /* ---------- Virat Kohli: career splits from the project's dataset (a summary table, so no per-match filtering) ---------- */
  function virat(root, D) {
    var F = {}; D.fields.forEach(function (f, i) { F[f] = i; });
    var SPLITS = [['In Format', 'Format'], ['By Year', 'Year'], ['vs Team', 'Opponent'], ['In Host Country', 'Host country'], ['Home vs Away', 'Home / away'],
      ['Batting Position', 'Batting position'], ['Captain Status', 'Captaincy'], ['Match Result', 'Result'], ['In Major Trophies', 'Trophies']].filter(function (s) { return D.cats[s[0]]; });
    var METRICS = [['Runs', 'Runs'], ['Avg', 'Average'], ['SR', 'Strike rate'], ['100s', 'Hundreds']];
    var KEEP_ORDER = { 'By Year': 1, 'Batting Position': 1, 'In Format': 1 };
    var S = { split: SPLITS[0][0], m: 'Runs' }, body = el('div');
    var ov = (D.cats['Career Averages'] || [])[0];
    function label(sub) { return sub.replace(/^(vs|in) /, '').replace(/^(\d)(st|nd|rd|th) position$/, 'No. $1').replace(/^is (not )?captain$/, function (m, n) { return n ? 'Not captain' : 'Captain'; }).replace(/^./, function (c) { return c.toUpperCase(); }); }
    clear(root);
    head(root, 'Rebuilt from the project’s dataset · career splits, 2008–2026');
    var ctl = el('div', 'dash__controls');
    ctl.appendChild(seg('Split by', SPLITS.map(function (x) { return { label: x[1], value: x[0] }; }), S.split, function (v) { S.split = v; draw(); }).node);
    ctl.appendChild(seg('Measure', METRICS.map(function (x) { return { label: x[1], value: x[0] }; }), S.m, function (v) { S.m = v; draw(); }).node);
    root.appendChild(ctl);
    if (ov) root.appendChild(kpis([
      { v: fmt(ov[F.Runs]), k: 'Career runs' },
      { v: fmt(ov[F.Avg], 2), k: 'Average' },
      { v: fmt(ov[F['100s']]), k: 'Hundreds' },
      { v: String(ov[F.HS]), k: 'Highest score' }
    ]));
    root.appendChild(body);
    var note = el('p', 'dash__note');
    note.textContent = 'The dataset is a career summary (one row per split), so splits can’t be combined. For average and strike rate, splits with fewer than 5 innings are hidden so one-off matches don’t top the list.';
    root.appendChild(note);
    function draw() {
      var rate = S.m === 'Avg' || S.m === 'SR';
      var list = (D.cats[S.split] || []).filter(function (r) { return r[F[S.m]] != null && (!rate || (r[F.Inns] || 0) >= 5); })
        .map(function (r) { return { l: label(r[F.sub]), v: r[F[S.m]], inns: r[F.Inns] }; });
      if (!KEEP_ORDER[S.split]) list.sort(function (a, b) { return b.v - a.v; });
      var name = METRICS.filter(function (m) { return m[0] === S.m; })[0][1], split = SPLITS.filter(function (x) { return x[0] === S.split; })[0][1];
      clear(body);
      var g = el('div', 'cards'), c = card(name + ' by ' + split.toLowerCase(), list.length + ' splits' + (rate ? ' with 5+ innings' : ''), 12);
      var f = rate ? function (v) { return fmt(v, 2); } : function (v) { return fmt(v); };
      c.appendChild(S.split === 'By Year' ? cols(list, { fmt: f, peak: true }) : hbars(list.slice(0, 14), f));
      g.appendChild(c); body.appendChild(g);
    }
    draw();
  }

  /* ---------- Aadhaar walkthrough: a SIMULATION of the pipeline with a made-up number; no OCR runs, nothing is uploaded ---------- */
  function walkthrough(root) {
    var src = root.querySelector('script[data-walk-steps]'), STEPS = [];
    try { STEPS = JSON.parse(src ? src.textContent : '[]'); } catch (e) { STEPS = []; }
    clear(root);
    var top = el('div', 'walk__bar'), lab = el('span', 'dash__label'), badge = el('span', 'pd-badge pd-badge--sim');
    badge.appendChild(el('span', 'pd-badge__k', 'Simulation'));
    badge.appendChild(d.createTextNode('Runs in your browser · made-up number · no upload'));
    lab.appendChild(badge); top.appendChild(lab);
    var play = el('button', 'pd-btn', 'Play all steps'); play.type = 'button';
    top.appendChild(play);
    root.appendChild(top);
    var grid = el('div', 'walk__grid'), stage = el('div', 'walk__stage'), list = el('ol', 'walk__steps');
    stage.appendChild(cardSvg());
    grid.appendChild(stage); grid.appendChild(list);
    root.appendChild(grid);
    var note = el('p', 'dash__note');
    note.textContent = 'The sample number starts with 1, so it can never be a real Aadhaar number (real ones start with 2–9). The real app does this with PaddleOCR and Tesseract on the server; this animation only shows the order of the steps.';
    root.appendChild(note);
    var btns = STEPS.map(function (s, k) {
      var li = el('li'), b = el('button', 'walk__step');
      b.type = 'button';
      var n = el('span', 'pd-steps__n', String(k + 1).padStart(2, '0')), t = el('span');
      t.appendChild(el('strong', null, s.t)); t.appendChild(el('span', 'd', s.d));
      b.appendChild(n); b.appendChild(t);
      b.addEventListener('click', function () { stop(); go(k); });
      li.appendChild(b); list.appendChild(li);
      return b;
    });
    var timer = 0;
    function go(k) {
      btns.forEach(function (b, j) { if (j === k) b.setAttribute('aria-current', 'step'); else b.removeAttribute('aria-current'); });
      var layers = (STEPS[k] && STEPS[k].layers) || [];
      stage.querySelectorAll('[data-layer]').forEach(function (n) { n.classList.toggle('is-on', layers.indexOf(n.getAttribute('data-layer')) >= 0); });
    }
    function stop() { clearTimeout(timer); timer = 0; play.textContent = 'Play all steps'; }
    play.addEventListener('click', function () {
      if (timer) { stop(); return; }
      play.textContent = 'Pause';
      (function next(k) { go(k); timer = setTimeout(function () { if (k + 1 < STEPS.length) next(k + 1); else stop(); }, RM.matches ? 2600 : 2200); })(0);
    });
    go(0);
  }
  // A generic ID-style sample card (deliberately not the real Aadhaar design) with overlay layers for each step.
  function cardSvg() {
    var s = sv('svg', { viewBox: '0 0 400 250', role: 'img', 'aria-label': 'Sample ID card used for the simulation, with the made-up number 1234 5678 9012' });
    s.appendChild(sv('rect', { x: 6, y: 6, width: 388, height: 238, rx: 18, fill: '#f6f7f1', stroke: '#c9d1b3' }));
    s.appendChild(sv('rect', { x: 6, y: 6, width: 388, height: 44, rx: 18, fill: '#D7DDBA' }));
    s.appendChild(sv('rect', { x: 6, y: 34, width: 388, height: 16, fill: '#D7DDBA' }));
    var t = function (x, y, txt, size, weight, fill) { var n = sv('text', { x: x, y: y, 'font-size': size, 'font-weight': weight || 500, fill: fill || '#2b3a35', 'font-family': 'Inter, system-ui, sans-serif' }); n.textContent = txt; s.appendChild(n); return n; };
    t(22, 34, 'SAMPLE ID CARD · FOR THE DEMO ONLY', 12, 700, '#00251a');
    s.appendChild(sv('rect', { x: 24, y: 70, width: 84, height: 100, rx: 10, fill: '#e2e6d2' }));
    s.appendChild(sv('circle', { cx: 66, cy: 105, r: 18, fill: '#c9d1b3' }));
    s.appendChild(sv('rect', { x: 40, y: 128, width: 52, height: 30, rx: 14, fill: '#c9d1b3' }));
    t(128, 88, 'Name', 10, 600, '#6b7a72'); t(128, 106, 'A. Sample', 15, 700);
    t(128, 130, 'Date of birth', 10, 600, '#6b7a72'); t(128, 148, '01/01/2000', 14, 600);
    t(128, 172, 'This card is fictional.', 11, 500, '#6b7a72');
    var num = t(200, 216, '1234 5678 9012', 26, 800, '#00251a'); num.setAttribute('text-anchor', 'middle'); num.setAttribute('letter-spacing', '2');
    // layer: upload frame / pages
    var g1 = sv('g', { 'data-layer': 'file' });
    g1.appendChild(sv('rect', { x: 2, y: 2, width: 396, height: 246, rx: 20, fill: 'none', stroke: '#006064', 'stroke-width': 2, 'stroke-dasharray': '8 6' }));
    s.appendChild(g1);
    // layer: preprocessing scan line
    var g2 = sv('g', { 'data-layer': 'scan' });
    var line = sv('rect', { x: 10, y: 52, width: 380, height: 3, fill: '#26a69a', class: 'w-scan' });
    g2.appendChild(line); s.appendChild(g2);
    // layer: OCR boxes
    var g3 = sv('g', { 'data-layer': 'ocr' });
    [[124, 92, 120, 20], [124, 135, 96, 18], [124, 158, 150, 18], [88, 190, 224, 36], [18, 18, 300, 22]].forEach(function (b) { g3.appendChild(sv('rect', { x: b[0], y: b[1], width: b[2], height: b[3], rx: 4, class: 'w-box' })); });
    s.appendChild(g3);
    // layer: the 12-digit match
    var g4 = sv('g', { 'data-layer': 'hit' });
    g4.appendChild(sv('rect', { x: 88, y: 190, width: 224, height: 36, rx: 6, class: 'w-hit' }));
    var tag = sv('text', { x: 200, y: 184, 'text-anchor': 'middle', 'font-size': 10, 'font-weight': 700, fill: '#0a8f4a', 'font-family': 'JetBrains Mono, monospace' }); tag.textContent = '12 DIGITS · PATTERN OK';
    g4.appendChild(tag); s.appendChild(g4);
    // layer: the mask over the first eight digits
    var g5 = sv('g', { 'data-layer': 'mask' });
    g5.appendChild(sv('rect', { x: 90, y: 192, width: 150, height: 32, rx: 4, class: 'w-mask' }));
    var x = sv('text', { x: 165, y: 214, 'text-anchor': 'middle', 'font-size': 16, 'font-weight': 800, fill: '#D7DDBA', 'font-family': 'JetBrains Mono, monospace', 'letter-spacing': '3' }); x.textContent = 'XXXX XXXX';
    g5.appendChild(x); s.appendChild(g5);
    // layer: download stamp
    var g6 = sv('g', { 'data-layer': 'done' });
    g6.appendChild(sv('rect', { x: 286, y: 64, width: 96, height: 30, rx: 15, fill: '#00251a' }));
    var dl = sv('text', { x: 334, y: 84, 'text-anchor': 'middle', 'font-size': 11, 'font-weight': 700, fill: '#D7DDBA', 'font-family': 'JetBrains Mono, monospace' }); dl.textContent = 'MASKED ✓';
    g6.appendChild(dl); s.appendChild(g6);
    return s;
  }

  /* ---------- lazy start: dashboards load their data only when they come near the screen ---------- */
  var RENDER = { hospital: hospital, service: service, spotify: spotify, virat: virat };
  function start(node) {
    if (node.hasAttribute('data-walk')) { walkthrough(node); return; }
    var kind = node.getAttribute('data-dash'), src = node.getAttribute('data-src');
    fetch(src, { credentials: 'same-origin' }).then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); }).then(function (data) {
      RENDER[kind](node, data);
    }).catch(function () {
      clear(node).appendChild(el('p', 'dash__loading', 'The interactive dashboard could not load. The original dashboard and files are linked on this page.'));
    });
  }
  var nodes = [].slice.call(d.querySelectorAll('[data-dash],[data-walk]'));
  if ('IntersectionObserver' in w) {
    var io = new IntersectionObserver(function (es) { es.forEach(function (e) { if (e.isIntersecting) { io.unobserve(e.target); start(e.target); } }); }, { rootMargin: '600px 0px' });
    nodes.forEach(function (n) { io.observe(n); });
  } else nodes.forEach(start);
})();
