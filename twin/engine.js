/* SHK JAVED "Talk to Me" engine (twin/engine.js).
   Local, deterministic and grounded: every sentence it shows comes from twin/knowledge.json.
   No network, no storage, no DOM. The UI renders `segments` with textContent only.
   Same file runs in the browser (window.SHKTwinEngine) and in Node tests (require). */
(function (root, f) { var m = f(); if (typeof module === 'object' && module.exports) module.exports = m; else root.SHKTwinEngine = m; })(this, function () {
  'use strict';
  var VERSION = '1.0.0', MAX_IN = 600;

  /* ---------- text normalisation ---------- */
  function words(s) { return s.split(' ').filter(Boolean); }
  function set(s) { var o = {}; words(s).forEach(function (w) { o[w] = 1; }); return o; }
  var STOP = set('a an the is are was were be been being am do does did done has have had having he his him himself she her it its i me my mine you your yours we us our they them their of in on at to for from by with about into over and or but so if then than that this these those there here what which who whom whose when where why how can could would should will shall may might must any some all tell show give please let like just also ever very much many kindly ok okay yes no not s t mr sir javed shaikh shk hai hain ho tha thi ka ke ki ko mein me mai se par pe bhi de dena na naa toh bhai yaar yar bro ji wala wali wale kar karo ek ya kuch sab raha rahe rahi get got see find one');
  var HING = {
    kya: 'what', kyaa: 'what', wat: 'what', wht: 'what', whats: 'what', kaun: 'who', kon: 'who', kaunsa: 'which', kaunse: 'which', kaunsi: 'which', konsa: 'which', konse: 'which', kis: 'which',
    kahan: 'where', kaha: 'where', kahaan: 'where', kidhar: 'where', kab: 'when', kaise: 'how', kese: 'how', kitna: 'how much', kitni: 'how much', kitne: 'how many',
    kyun: 'why', kyu: 'why', batao: 'tell', bata: 'tell', btao: 'tell', bataiye: 'tell', bataao: 'tell', dikhao: 'show', dikha: 'show', kaam: 'work',
    karta: 'do', karte: 'do', karti: 'do', kiya: 'did', kiye: 'did', kari: 'did', banaya: 'built', banayi: 'built', banaye: 'built', banai: 'built',
    padhai: 'study', padha: 'studied', naukri: 'job', abhi: 'currently', filhal: 'currently', abi: 'currently', pehle: 'before', pahle: 'before',
    uska: 'its', uski: 'its', uske: 'its', iska: 'its', iski: 'its', iske: 'its', unka: 'its', unki: 'its', unke: 'its', woh: 'he', wo: 'he', vo: 'he',
    rehta: 'live', rehti: 'live', rahta: 'live', sheher: 'city', shahar: 'city', paas: 'have', abt: 'about', u: 'you', ur: 'your', r: 'are', pls: 'please', plz: 'please',
    exp: 'experience', yrs: 'years', yr: 'year', certs: 'certificates', cert: 'certificate', thnx: 'thanks', thx: 'thanks', ty: 'thanks', thanku: 'thanks',
    shukriya: 'thanks', dhanyavad: 'thanks', dhanyawad: 'thanks', namaste: 'hi', namaskar: 'hi', salaam: 'hi', salam: 'hi', hii: 'hi', hiii: 'hi', helo: 'hi', hlo: 'hi', alvida: 'bye'
  };
  var GREET = set('hi hello hey heya hola yo sup greetings morning evening afternoon good'), THANKS = set('thanks thank cheers great awesome nice cool helpful perfect'), BYE = set('bye goodbye cya later night farewell');

  function stripTags(s) {
    return String(s == null ? '' : s).replace(/<(script|style)[^>]*>[\s\S]*?<\/\1\s*>/gi, ' ').replace(/<[^>]*>/g, ' ')
      .replace(/[\u0000-\u001f\u007f\u200b-\u200f\u2028\u2029\ufeff]/g, ' ').replace(/\s+/g, ' ').trim();
  }
  function norm(s) {
    s = String(s || '');
    if (s.normalize) s = s.normalize('NFKD').replace(/[\u0300-\u036f]/g, '');
    return s.toLowerCase().replace(/&/g, ' and ').replace(/[\u2018\u2019`]/g, "'").replace(/'s\b/g, '').replace(/\bb\.sc\b\.?/g, 'bsc')
      .replace(/(\d),(?=\d{3}\b)/g, '$1').replace(/(\d)\.(\d)/g, '$1\u0001$2').replace(/[^a-z0-9#+\u0001]+/g, ' ').replace(/\u0001/g, '.').trim();
  }
  function stem(w) {
    if (w.length <= 3 || /\d/.test(w)) return w;
    if (/ies$/.test(w) && w.length > 4) return w.slice(0, -3) + 'y';
    if (/(ss|us|is)$/.test(w)) return w;
    if (/ing$/.test(w) && w.length > 5) w = w.slice(0, -3);
    else if (/ed$/.test(w) && w.length > 4) w = w.slice(0, -2);
    else if (/s$/.test(w)) w = w.slice(0, -1);
    if (/e$/.test(w) && w.length > 4) w = w.slice(0, -1);
    return w;
  }
  function osa(a, b, max) { // optimal string alignment distance with early exit
    if (Math.abs(a.length - b.length) > max) return max + 1;
    var d = [], i, j;
    for (i = 0; i <= a.length; i++) { d[i] = [i]; }
    for (j = 0; j <= b.length; j++) d[0][j] = j;
    for (i = 1; i <= a.length; i++) {
      var best = 1e9;
      for (j = 1; j <= b.length; j++) {
        var c = a[i - 1] === b[j - 1] ? 0 : 1;
        var v = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + c);
        if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) v = Math.min(v, d[i - 2][j - 2] + 1);
        d[i][j] = v; if (v < best) best = v;
      }
      if (best > max) return max + 1;
    }
    return d[a.length][b.length];
  }

  /* ---------- intent cues (run on the mapped, normalised text) ---------- */
  var NOWW = '(currently|current|right now|now|still|presently|present|these days|nowadays)', JOBW = '(work|works|working|job|role|company|employer|position|do|doing|designation|title)';
  var CUES = [
    ['current_role', new RegExp('\\b' + NOWW + '\\b.*\\b' + JOBW + '\\b|\\b' + JOBW + '\\b.*\\b' + NOWW + '\\b|\\bjob title\\b|\\bdesignation\\b|\\bwhere (does|do|is) (he|javed) (work|working)\\b|\\bwhat (does|is) (he|javed) do(ing)?\\b')],
    ['metrics', /\b(achieve|achieved|achievements?|impact|accomplish\w*|results?|metrics?|measurable|improv\w*|outcomes?)\b/],
    ['resume', /\b(resume|cv|biodata)\b/],
    ['contact', /\b(contact|email|mail|reach|hire|connect|linkedin|message|get in touch|talk to (him|javed)|socials?|social media)\b/],
    ['availability', /\b(available|availability|open to|looking for|job change|opportunit\w*|hiring|open for work|seeking|job search|new role)\b/],
    ['education', /\b(education|degree|college|university|graduat\w*|study|studied|studies|studying|cgpa|gpa|marks|grades?|bsc|bachelor\w*|academic\w*|qualification\w*|subjects?|curriculum)\b/],
    ['cert_verify', /\b(verify|verified|verification|verifiable)\b.*\bcertificat\w*|\bcertificat\w*.*\b(verify|verified|verifiable|proof)\b/],
    ['certs_list', /\b(certificat\w*|certified|credentials?|courses?|badges?)\b/],
    ['leadership', /\b(lead|led|leader|leadership|leading|hackathons?|team|ambassador|community|devfest|speaker|spoke|stage|talks?|events?|open source|volunteer\w*|club|extracurricular)\b/],
    ['experience', /\b(experience\w*|years?|how long|career|work history|worked|previous\w*|before|past|fresher|employment|jobs|companies)\b/],
    ['skills_overview', /\b(skills?|toolkit|tools|tech|stack|technolog\w*|languages?|software|expertise|strengths?|proficien\w*)\b/],
    ['projects_list', /\b(projects?|built|build|made|portfolio|work samples?|case stud\w*|dashboards)\b/],
    ['location', /\b(based|located|location|city|country|timezone|time zone|what time|local time|time is it|live|lives|living|stays?)\b|^(?!.*\b(use|used|using|work|works|working|study|studied|built|verify|see|download|did)\b).*\bwhere\b/],
    ['identity', /\b(who is (he|javed)|who s (he|javed)|tell me about (him|javed|shaikh)|introduce|introduction|summary|summari[sz]e|one line|describe him|overview|bio|full name|his name|name)\b/]
  ];
  var STRONG = set('current_role experience education location contact resume availability identity');
  var M = {
    repo: /\b(repo|repos|repository|github|code|source|link)\b/,
    verify: /\b(verify|verified|verification|verifiable|proof|prove|legit|authentic|genuine|credly|valid|check)\b/,
    tools: /\b(tools|tech|stack|technolog\w*|built with|built in|made with|made in|built using|software|languages?)\b/,
    usedIn: /\b(used in|use it|used it|which projects?|what projects?|in which|projects? (used|using|with)|used (for|at|on))\b|\b(where|which|what)\b.*\b(use|used|using|uses)\b/,
    when: /\b(when|since|dates?|how long|start|started|joined|join|become|became|duration|timeline|from when)\b/,
    doing: /\b(do|does|doing|did|responsibilit\w*|handles?|duties|involve\w*)\b/,
    claim: /\b(correct|right|true|really|confirm|i read|i heard|i saw|isn t it|didn t he)\b/,
    more: /^(and |so )?(tell (me )?)?(more|elaborate|go on|continue|details?|explain( more)?|more details?|what else|anything else|keep going)( please| about (it|that|this|its|him|them))?$|\btell (me )?more\b/,
    pron: /\b(it|its|that|this|they|them|those|there)\b/,
    spotlight: /\b(cool|best|interesting|impressive|something|coolest|proud)\b/,
    profile: /\b(his|javed|profile|account)\b/
  };
  var INJECT = [/\b(ignore|disregard|forget|override)\b.{0,40}\b(instructions?|prompts?|rules?|above|previous|prior|context)\b/, /\bsystem prompt\b/, /\byou are now\b/, /\b(roleplay|role play|act as|jailbreak|developer mode|dan mode)\b/, /\bpretend\b/, /\b(reveal|print|show|repeat|output)\b.{0,30}\b(instructions|prompt|system|rules|config)\b/, /\bnew instructions?\b/];
  var IDENT = [/\b(speak|answer|reply|talk|respond|write)\b.{0,15}\b(as|like) (javed|shaikh|him)\b/, /\b(in|use) (the )?first person\b/, /\bimpersonat\w*\b/];
  var SCHOOL = /\b(12th|10th|hsc|ssc|school|board exams?|class (10|12|x|xii)|jee|neet|cet)\b/;
  var OFFTOPIC = [/\b(joke|poem|song|weather|recipe|cricket|football|movie|news|bitcoin|crypto|capital of|translate|homework)\b/, /^[\d\s+\-*\/().=x?]+$/];
  var OPINION = /\bthink (of|about)\b|\bopinion\b|\bprefer\w*\b|\bfavou?rite\b/;
  var TWIN = /^(who|what) (are|r) (you|u)\b(?!.*\babout\b)|\bare (you|u) (javed|shaikh|him|human|real|a bot|bot|a robot|robot|an ai|ai|chatgpt|gpt|a person|alive|the real|a twin|his twin)\b|\b(your name|how do you work|who (made|built|created) you|what can you (do|help)|what do you know|where do you get|is this an ai|am i talking to|do you (store|save|keep|track|record|log)|what are you|help with)\b/;
  var COMMON = set('yourself myself everything anything something stuff things thing well really good great nice work job life field area domain industry details info information today time way lot bit sure kind type');
  var CUEVOCAB = (function () { var o = {}; CUES.map(function (c) { return c[1].source; }).concat(Object.keys(M).map(function (k) { return M[k].source; }), [TWIN.source, SCHOOL.source, OPINION.source]).join(' ').replace(/\\[bsdw]/g, ' ').replace(/[^a-z ]+/g, ' ').split(' ').forEach(function (w) { if (w.length > 2) o[w] = 1; }); return o; })();

  /* ---------- engine ---------- */
  function create(kb, opts) {
    opts = opts || {};
    if (!kb || !kb.facts || !kb.entities || !kb.evidence) throw new Error('SHKTwinEngine: invalid knowledge base');
    var facts = kb.facts, ents = {}, entList = kb.entities, ev = kb.evidence, refusals = (kb.refusals || []).slice();
    var factById = {}, factsByEnt = {}, parentOf = {};
    entList.forEach(function (e) { ents[e.id] = e; (e.children || []).forEach(function (c) { parentOf[c] = e.id; }); });
    facts.forEach(function (f, i) { f._i = i; factById[f.id] = f; (factsByEnt[f.entity] = factsByEnt[f.entity] || []).push(f); });
    var refById = {}; refusals.forEach(function (r) { refById[r.id] = r; });
    refusals.sort(function (a, b) { return (b.hard ? 1 : 0) - (a.hard ? 1 : 0); });
    var curRole = entList.filter(function (e) { return e.type === 'role' && e.end === null; })[0];
    var projects = entList.filter(function (e) { return e.type === 'project' && e.featured !== false; }).sort(function (a, b) { return (a.index || 0) - (b.index || 0); });
    var certs = entList.filter(function (e) { return e.type === 'cert'; }).sort(function (a, b) { return (a.index || 0) - (b.index || 0); });

    /* vocabulary + BM25 */
    var vocab = {}, freq = {};
    function addVocab(s) { words(norm(s)).forEach(function (w) { vocab[w] = 1; freq[w] = (freq[w] || 0) + 1; }); }
    facts.forEach(function (f) { addVocab(f.text); addVocab((f.tags || []).join(' ')); });
    entList.forEach(function (e) { addVocab(e.name); addVocab((e.aliases || []).join(' ')); if (e.title) addVocab(e.title); });
    Object.keys(CUEVOCAB).concat(Object.keys(STOP), Object.keys(HING), Object.keys(GREET), Object.keys(THANKS), Object.keys(BYE)).forEach(function (w) { vocab[w] = 1; });
    refusals.forEach(function (r) { addVocab((r.triggers || []).join(' ')); });
    var vlist = Object.keys(vocab).filter(function (w) { return w.length >= 4 && /^[a-z]+$/.test(w); });
    var corpus = ' ' + facts.map(function (f) { return norm(f.text + ' ' + (f.tags || []).join(' ')); }).join(' ') + ' ';

    var docs = facts.map(function (f) {
      var e = ents[f.entity] || {}, toks = [];
      function push(s, k) { words(norm(s)).forEach(function (w) { if (!STOP[w]) for (var i = 0; i < k; i++) toks.push(stem(w)); }); }
      push(f.text, 1); push((f.tags || []).join(' '), 2); push((e.name || '') + ' ' + (e.aliases || []).join(' '), 1);
      var tf = {}; toks.forEach(function (t) { tf[t] = (tf[t] || 0) + 1; });
      return { tf: tf, len: toks.length };
    });
    var df = {}, avgdl = 0;
    docs.forEach(function (d) { avgdl += d.len; Object.keys(d.tf).forEach(function (t) { df[t] = (df[t] || 0) + 1; }); });
    avgdl /= docs.length || 1;
    function bm25(q, f) {
      var d = docs[f._i], s = 0;
      q.forEach(function (t) { var tf = d.tf[t]; if (!tf) return; var idf = Math.log(1 + (facts.length - df[t] + 0.5) / (df[t] + 0.5)); s += idf * tf * 2.2 / (tf + 1.2 * (0.25 + 0.75 * d.len / avgdl)); });
      return s;
    }

    /* aliases */
    var aliasIdx = {}, compactIdx = {};
    function addAlias(text, id, w) {
      var t = words(norm(text)); if (!t.length) return;
      var key = t.join(' ');
      (aliasIdx[t[0]] = aliasIdx[t[0]] || []);
      if (aliasIdx[t[0]].some(function (a) { return a.key === key; })) return;
      aliasIdx[t[0]].push({ key: key, toks: t, id: id, w: w });
      if (t.length > 1 && key.replace(/ /g, '').length >= 5 && !compactIdx[key.replace(/ /g, '')]) compactIdx[key.replace(/ /g, '')] = { id: id, n: t.length, key: key };
    }
    var shortCaps = [];
    entList.forEach(function (e) { (e.aliases || []).forEach(function (a) { addAlias(a, e.id, 1); }); });
    entList.forEach(function (e) {
      addAlias(e.name.replace(/\s*\(.*?\)\s*/g, ' '), e.id, 0.9);
      e.name.split(/\s+[\u00b7\/]\s+/).forEach(function (p) { if (p !== e.name) addAlias(p, e.id, 0.8); });
      if (e.title) addAlias(e.title, e.id, 0.9);
      (e.name.match(/\b[A-Z]{2}\b/g) || []).forEach(function (c) {
        if (entList.filter(function (o) { return new RegExp('\\b' + c + '\\b').test(o.name); }).length === 1) shortCaps.push({ re: new RegExp('\\b' + c + '\\b'), id: e.id });
      });
    });

    function matchEntities(q, raw, mtext) {
      var found = [], i = 0, used = {};
      while (i < q.length) {
        var best = null, st = stem(q[i]);
        (aliasIdx[q[i]] || []).concat(st !== q[i] ? aliasIdx[st] || [] : []).forEach(function (a) {
          for (var k = 0; k < a.toks.length; k++) { var x = q[i + k]; if (x == null || (x !== a.toks[k] && stem(x) !== stem(a.toks[k]))) return; }
          if (!best || a.toks.length > best.n || (a.toks.length === best.n && a.w > best.w)) best = { id: a.id, n: a.toks.length, w: a.w, key: a.key };
        });
        for (var L = 3; L >= 1; L--) {
          var c = compactIdx[q.slice(i, i + L).join('')];
          if (c && i + L <= q.length && (!best || L >= best.n)) { if (!best || c.n > best.n) best = { id: c.id, n: L, w: 1, key: c.key }; break; }
        }
        if (best) {
          var e = ents[best.id];
          if (!(e.type === 'tool' && /^(github|git hub)$/.test(best.key) && M.repo.test(mtext))) { found.push(best); for (var u = i; u < i + best.n; u++) used[u] = 1; }
          i += best.n;
        } else i++;
      }
      shortCaps.forEach(function (s) { if (s.re.test(raw)) found.push({ id: s.id, n: 1, w: 0.8, key: '' }); });
      var seen = {}, out = [];
      found.forEach(function (f) { if (!seen[f.id]) { seen[f.id] = 1; out.push(ents[f.id]); } });
      out.free = q.filter(function (w, k) { return !used[k]; }).join(' ');
      return out;
    }

    /* evidence + segments */
    function evItem(id, factId) {
      var e = ev[id]; if (!e) return null;
      var href = e.href || e.target || ({ project: '#projects', cert: '#certificates', tool: '#skills' })[e.kind] || null;
      var label = String(e.label || id); if (label.length > 28) label = label.slice(0, 27) + '\u2026';
      var o = { id: id, label: label, kind: e.kind, href: href, external: e.kind === 'url', factId: factId || null };
      if (e.index != null) o.index = e.index; if (e.select != null) o.select = e.select;
      return o;
    }
    function bare(u) { return String(u).replace(/^mailto:/, '').replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, ''); }
    function linkify(text, evIds) {
      var segs = [], re = /[\w.+-]+@[\w-]+\.[\w.]+\w|(?:[a-z0-9-]+\.)+(?:com|org|io|net|in)(?:\/[\w\-\/.]*\w)?/gi, last = 0, m;
      while ((m = re.exec(text))) {
        var hit = null, s = m[0].toLowerCase();
        evIds.forEach(function (id) { var e = ev[id]; if (!hit && e && bare(e.href || e.target).toLowerCase() === s) hit = id; });
        if (!hit) continue;
        if (m.index > last) segs.push({ t: 'text', v: text.slice(last, m.index) });
        segs.push({ t: 'link', v: m[0], evidence: hit }); last = m.index + m[0].length;
      }
      if (last < text.length) segs.push({ t: 'text', v: text.slice(last) });
      return segs;
    }

    /* fact selection */
    function family(id) {
      var e = ents[id]; if (!e) return [];
      var ids = [id].concat(e.children || []);
      return ids;
    }
    function pool(types, scope) {
      return facts.filter(function (f) { return types.indexOf(f.type) >= 0 && (!scope || scope.indexOf(f.entity) >= 0); });
    }
    function rank(list, qs, n, minFrac) {
      if (!list.length) return [];
      var sc = list.map(function (f) { return { f: f, s: bm25(qs, f) }; });
      var top = Math.max.apply(null, sc.map(function (x) { return x.s; }));
      if (top <= 0.3) return list.slice().sort(generic).slice(0, n);
      return sc.filter(function (x) { return x.s >= top * (minFrac || 0.5); }).sort(function (a, b) { return (a.f.status === 'resume_only') - (b.f.status === 'resume_only') || b.s - a.s || a.f._i - b.f._i; }).slice(0, n).map(function (x) { return x.f; });
    }
    function generic(a, b) { // person-level summaries first, canonical before resume-only, then KB order
      function w(f) { return (f.entity === 'person' ? 0 : 1) + (f.status === 'resume_only' ? 2 : 0); }
      return w(a) - w(b) || a._i - b._i;
    }
    function scoped(types, ent, qs, n) {
      var sc = ent ? family(ent.id) : null, l = pool(types, sc);
      if (!l.length && ent && parentOf[ent.id]) l = pool(types, family(parentOf[ent.id]));
      if (!l.length && !ent) l = pool(types, null);
      return rank(l, qs, n);
    }
    function F(id) { return factById[id] ? [factById[id]] : []; }

    /* ---------- answer builders ---------- */
    function build(o) {
      // o: {intent, kind, facts, segs(pre), list(segs after), evExtra, target, mood, follow, conf, refusal, ents, note}
      var segs = [], evIds = [], evOwner = {};
      if (o.lead) segs.push({ t: 'text', v: o.lead + ' ' });
      (o.facts || []).forEach(function (f, i) {
        (f.evidence || []).forEach(function (id) { if (evIds.indexOf(id) < 0) { evIds.push(id); evOwner[id] = f.id; } });
        if (i) segs.push({ t: 'text', v: ' ' });
        segs = segs.concat(linkify(f.text, f.evidence || []));
      });
      if (o.list && o.list.length) segs = segs.concat(o.list);
      if (o.tail) segs.push({ t: 'text', v: (segs.length ? ' ' : '') + o.tail });
      (o.evExtra || []).forEach(function (id) { if (ev[id] && evIds.indexOf(id) < 0) evIds.push(id); });
      var cap = Math.max(4, evIds.filter(function (id) { return segs.some(function (s) { return s.evidence === id; }); }).length);
      var evidence = [], linked = {};
      segs.forEach(function (s) { if (s.t === 'link') linked[s.evidence] = 1; });
      evIds.forEach(function (id) { if (evidence.length < cap || linked[id]) { var it = evItem(id, evOwner[id]); if (it) evidence.push(it); } });
      var internal = function (e) { return /^(anchor|project|cert|tool)$/.test(e.kind); };
      var tgt = o.targetId ? evidence.filter(function (e) { return e.id === o.targetId; })[0] : null;
      tgt = tgt || evidence.filter(internal)[0] || null;
      var text = segs.map(function (s) { return s.v; }).join('');
      return {
        segments: segs, text: text, evidence: evidence, followUps: o.follow || [],
        mood: o.mood || 'review',
        target: tgt ? { evidence: tgt.id, section: tgt.href, action: 'look' } : { evidence: null, section: null, action: 'none' },
        kind: o.kind || 'answer', confidence: o.conf == null ? 0.85 : o.conf, refusal: o.refusal || null,
        debug: { intent: o.intent, factIds: (o.facts || []).map(function (f) { return f.id; }).concat(o.cite || []), entities: (o.ents || []).map(function (e) { return e.id; }), ms: 0 }
      };
    }
    function refuse(r, intentCat, reply, extraEv) {
      var cat = (r && r.category) || intentCat || 'unknown';
      return { intent: 'refusal', kind: r && r.fallback ? 'fallback' : 'refusal', refusal: cat, mood: cat === 'empty' || cat === 'too_long' ? 'waiting' : cat === 'unknown' ? 'failed' : 'idle',
        tail: reply || (r && r.reply) || 'That isn\u2019t something the guide can answer.', evExtra: (r && r.redirect ? [r.redirect] : []).concat(extraEv || []), conf: 1, follow: starters().slice(0, 3), noCtx: true };
    }

    var FOLLOW = {
      identity: ['What does Javed do now?', 'Which projects has he built?', 'What\u2019s in his toolkit?'],
      current_role: [curRole ? 'What does he do at ' + curRole.name + '?' : null, 'How many years of experience does he have?', curRole ? 'Which tools does he use at ' + curRole.name + '?' : null],
      experience: ['What did he achieve at MAK { Byte }?', 'What did he do as an intern?', 'What does Javed do now?'],
      role_detail: ['What did he achieve at MAK { Byte }?', 'How many years of experience does he have?', 'Which projects has he built?'],
      metrics: ['What did he do at MAK { Byte }?', 'Which projects has he built?', 'How can I contact him?'],
      education: ['What was his CGPA?', 'What did his degree cover?', 'List his certificates.'],
      leadership: ['What was Maayura?', 'What happened at DevFest?', 'Was he a Google Student Ambassador?'],
      projects_list: projects[0] ? ['Tell me about the ' + projects[0].name, 'Which projects used Power BI?', 'Show me the code for the ' + projects[0].name] : [],
      certs_list: ['Which certificates can I verify?', 'Tell me about the Google Analytics certificate', 'What\u2019s in his toolkit?'],
      skills_overview: ['Which projects used Power BI?', 'Does he know Python?', 'What does the Automate stage of his toolkit include?'],
      contact: ['Can I download his resume?', 'Where is he based?', 'What does Javed do now?'],
      resume: ['How can I contact him?', 'What does Javed do now?'],
      availability: ['How can I contact him?', 'What does Javed do now?'],
      location: ['How can I contact him?', 'What does Javed do now?'],
      twin_meta: null, refusal: null
    };
    function follow(intent, ent, q, extra) {
      var l = (ent && ent.type === 'tool' ? [] : extra || []).concat(FOLLOW[intent] || []);
      if (ent && ent.type === 'project' && ent.featured !== false) {
        var nx = projects[(projects.indexOf(ent) + 1) % projects.length];
        l = ['Show me the code for the ' + ent.name, 'What tools went into the ' + ent.name + '?', nx && nx !== ent ? 'Tell me about the ' + nx.name : null].concat(l);
        if (intent === 'project_repo') l.shift();
      } else if (ent && ent.type === 'tool') {
        var used = projects.filter(function (p) { return (extra || []).indexOf(p.id) >= 0; }).map(function (p) { return 'Tell me about the ' + p.name; });
        l = (intent === 'tool_usage' ? [] : ['Which projects used ' + ent.name + '?']).concat(used, l, ['What\u2019s in his toolkit?']);
        extra = [];
      } else if (ent && ent.type === 'cert') {
        l = [ent.verify && intent !== 'cert_verify' ? 'Can I verify the ' + ent.name + ' certificate?' : null, 'List his certificates.', 'Which certificates can I verify?'].concat(l);
      } else if (ent && ent.type === 'leadership') {
        l = l.filter(function (s) { return !s || norm(s).indexOf(norm(ent.name.split(' \u00b7 ')[0]).split(' ')[0]) < 0; });
      }
      if (!l.length) l = starters();
      var nq = norm(q), out = [];
      l.forEach(function (s) { if (s && out.length < 3 && norm(s) !== nq && out.indexOf(s) < 0) out.push(s); });
      return out;
    }
    function starters() { return (kb.starters && kb.starters.length ? kb.starters : ['What does Javed do now?', 'Which projects has he built?', 'How can I contact him?']).slice(0, 5); }

    /* ---------- the router ---------- */
    function route(text, ctx) {
      var raw = String(text == null ? '' : text);
      if (raw.length > MAX_IN) return refuse(null, 'too_long', 'That\u2019s a long one. Could you ask it as one short question?');
      var clean = stripTags(raw);
      if (!clean || !/[a-z0-9]/i.test(clean)) return refuse(null, 'empty', 'Ask the guide anything about Javed\u2019s work, projects, certificates or toolkit.');
      var n0 = norm(clean), t0 = words(n0);
      var n1 = n0.replace(/\baur (batao|bata|btao|bataiye|bataao|kuch|kuchh)\b/g, 'tell me more').replace(/\b(does|do|did) (he|javed|you) no\b/g, '$1 $2 know').replace(/\be mail\b/g, 'email').replace(/\bgit hub\b/g, 'github');
      var q = [], unknownRaw = [];
      words(n1).forEach(function (w, i, all) {
        var m = HING[w] != null ? HING[w] : w;
        if (m !== w) { q = q.concat(words(m)); return; }
        if (!vocab[w] && /^[a-z]+$/.test(w) && w.length >= 4) {
          var max = w.length >= 8 ? 2 : 1, best = null, bd = 9;
          vlist.forEach(function (v) {
            if (w.length === 4 && v.length < 5 && osa(w, v, 1) && v.split('').sort().join('') !== w.split('').sort().join('')) return;
            var d = osa(w, v, max);
            if (d <= max && (d < bd || (d === bd && ((v[0] === w[0]) - (best[0] === w[0]) > 0 || ((v[0] === w[0]) === (best[0] === w[0]) && (freq[v] || 0) > (freq[best] || 0)))))) { bd = d; best = v; }
          });
          if (best) { q.push(best); return; }
        }
        if (!vocab[w] && !STOP[w] && !COMMON[w] && !/^\d+$/.test(w) && w.length >= 2) {
          var prev = all[i - 1] || '', rw = (clean.match(new RegExp('\\b' + w.replace(/[+#.]/g, '\\$&') + '\\b', 'i')) || [w])[0];
          if (/^(know|knows|use|uses|used|using|with|in|and|or|of|about|learn|learned|learnt)$/.test(prev) || (/^[A-Z]/.test(rw) && i > 0) || (/\d/.test(w) && /[a-z]/.test(w))) unknownRaw.push(rw.replace(/[^\w+#.\- ]/g, ''));
        }
        q.push(w);
      });
      var mt = q.join(' '), padded = ' ' + n0 + ' ', paddedM = ' ' + mt + ' ';

      /* 1. refusals (KB triggers, whole phrases) */
      for (var r = 0; r < refusals.length; r++) {
        var R = refusals[r];
        for (var k = 0; k < (R.triggers || []).length; k++) {
          var ph = ' ' + norm(R.triggers[k]) + ' ';
          if (ph.trim() && (padded.indexOf(ph) >= 0 || paddedM.indexOf(ph) >= 0) && (R.hard || corpus.indexOf(ph) < 0)) return refuse(R);
        }
      }
      if (INJECT.some(function (re) { return re.test(n0); })) return refuse(refById['r.injection'], 'injection');
      if (IDENT.some(function (re) { return re.test(n0); })) return refuse(refById['r.identity'], 'identity');
      if (OPINION.test(mt)) return refuse(refById['r.opinion'], 'unknown');
      if (SCHOOL.test(mt)) return refuse(refById['r.unknown'], 'unknown', 'The site doesn\u2019t list Javed\u2019s school results, only his degree.', ['ev.education']);
      if (OFFTOPIC.some(function (re) { return re.test(mt); })) return refuse(refById['r.offtopic'], 'offtopic');

      /* 2. small talk */
      var content = q.filter(function (w) { return !STOP[w] && !GREET[w] && !THANKS[w] && !BYE[w] && w !== 'you' && w !== 'that' && w !== 'helpful'; });
      if (!content.length) {
        if (q.some(function (w) { return BYE[w]; })) return { intent: 'bye', kind: 'greeting', mood: 'wave', tail: 'Bye for now. The guide will be here if you have more questions about Javed.', noCtx: true, follow: [] };
        if (q.some(function (w) { return THANKS[w]; })) return { intent: 'thanks', kind: 'greeting', mood: 'jump', tail: 'Glad that helped. Anything else you\u2019d like to know about Javed?', noCtx: true, follow: starters().slice(0, 3) };
        if (GREET[q[0]] || q[0] === 'hi') return { intent: 'greet', kind: 'greeting', mood: 'wave', tail: 'Hi! This is SHK JAVED, an AI guide to Javed\u2019s portfolio. The guide answers only from this site\u2019s verified facts. What would you like to know?', noCtx: true, follow: starters().slice(0, 3) };
      }

      var E = matchEntities(q, clean, mt), cue = null, mo = {};
      CUES.some(function (c) { if (c[1].test(mt)) { cue = c[0]; return true; } return false; });
      Object.keys(M).forEach(function (k) { mo[k] = M[k].test(k === 'more' || k === 'pron' || k === 'claim' ? mt : E.free); });
      var titleQ = /\b(title|designation)\b/.test(mt), nowQ = new RegExp('\\b' + NOWW + '\\b').test(mt);
      var freeW = set(E.free), qs = content.filter(function (w) { return freeW[w] && !/^\d{1,2}$/.test(w); }).map(stem), claimLead = mo.claim && (/\d/.test(n0) || E.length) ? 'Here\u2019s what the site says:' : null;

      /* 3. the guide itself */
      if (TWIN.test(mt) || E.some(function (e) { return e.type === 'twin'; })) {
        return { intent: 'twin_meta', kind: 'meta', mood: 'idle', facts: rank(pool(['twin_meta'], null), qs, 1), follow: starters().slice(0, 3), noCtx: true, conf: 0.95 };
      }
      if ((!content.length || (content.length === 1 && !vocab[content[0]])) && !cue && !E.length && !unknownRaw.length) return { intent: 'clarify', kind: 'clarify', mood: 'waiting', tail: 'Could you say a bit more? The guide can talk about Javed\u2019s current role, projects, certificates or toolkit.', follow: starters().slice(0, 3), noCtx: true, conf: 0.2 };

      var spec = E.filter(function (e) { return e.type !== 'person' && e.type !== 'twin'; });
      var hasG = spec.some(function (e) { return e.type === 'skill-group'; });
      if (hasG && !(cue === 'skills_overview' || /\b(stage|group|toolkit)\b/.test(mt) || content.length === 1)) spec = spec.filter(function (e) { return e.type !== 'skill-group'; });
      var fromCtx = false;
      if (!spec.length && !unknownRaw.length && ctx.entities && ctx.entities.length && ents[ctx.entities[0]]) {
        var pr = mo.pron && !(cue && STRONG[cue]);
        if (mo.more || pr || (!cue && (mo.repo && !mo.profile || mo.verify || mo.when || mo.tools || mo.usedIn || content.length <= 2))) { spec = [ents[ctx.entities[0]]]; fromCtx = true; }
      }
      var unknownNote = unknownRaw.length ? 'The site doesn\u2019t mention ' + unknownRaw[0] + '.' : null;

      /* 4. "tell me more" */
      if (mo.more && (spec.length || ctx.intent)) {
        var ent = spec[0], shown = ctx.shown || [], fam = ent ? family(ent.id) : null;
        if (ent && ent.type === 'person') fam = ['person'];
        var rest = (fam ? facts.filter(function (f) { return fam.indexOf(f.entity) >= 0; }) : pool([ctx.intent], null))
          .filter(function (f) { return shown.indexOf(f.id) < 0 && f.type !== 'twin_meta'; }).sort(generic);
        if (!rest.length) return { intent: 'more', kind: 'partial', tail: 'That\u2019s everything the site says about ' + (ent ? ent.name : 'that') + '.', ents: ent ? [ent] : [], follow: follow(ctx.intent, ent, mt), conf: 0.7 };
        return { intent: 'more', facts: rest.slice(0, 2), ents: ent ? [ent] : [], follow: follow(ctx.intent, ent, mt), conf: 0.8 };
      }
      if (mo.more && !spec.length) return { intent: 'clarify', kind: 'clarify', mood: 'waiting', tail: 'More about what? Try a project, a certificate or a tool.', follow: starters().slice(0, 3), noCtx: true, conf: 0.2 };

      /* 5. entity routes */
      var P = spec.filter(function (e) { return e.type === 'project'; })[0], T = spec.filter(function (e) { return e.type === 'tool'; }),
        C = spec.filter(function (e) { return e.type === 'cert'; })[0], Rl = spec.filter(function (e) { return e.type === 'role' || e.type === 'org'; })[0],
        L = spec.filter(function (e) { return e.type === 'leadership'; })[0], D = spec.filter(function (e) { return e.type === 'education'; })[0],
        G = spec.filter(function (e) { return e.type === 'skill-group'; })[0];
      var conf = fromCtx ? 0.8 : 0.9, res = null;
      var rowOf = function (e) { return (e.evidence || []).filter(function (id) { return ev[id] && ev[id].kind === 'project'; })[0] || null; };
      if (P && mo.repo && !(mo.profile && fromCtx)) res = { intent: 'project_repo', facts: scoped(['project_repo'], P, qs, 1), ents: [P], evExtra: [rowOf(P)], targetId: rowOf(P) };
      else if (T.length && !P && mo.repo && !(mo.profile && !fromCtx)) {
        var tp = projects.filter(function (p) { return T.some(function (t) { return (p.tools || []).indexOf(t.symbol) >= 0; }); }).slice(0, 3);
        res = tp.length
          ? { intent: 'project_repo', facts: tp.map(function (p) { return scoped(['project_repo'], p, [], 1)[0]; }).filter(Boolean), ents: tp, evExtra: tp.map(rowOf), targetId: rowOf(tp[0]) }
          : { intent: 'project_repo', facts: pool(['tool_usage'], [T[0].id]).slice(0, 1).concat(pool(['contact'], null).filter(function (f) { return /github/i.test(f.text); }).slice(0, 1)), ents: [T[0]] };
      } else if (C && (mo.verify || cue === 'cert_verify')) {
        var vf = scoped(['cert_verify'], C, qs, 1).filter(function (f) { return f.entity === C.id; });
        res = { intent: 'cert_verify', facts: vf.length ? vf : F('f.cert.noverify').length ? F('f.cert.noverify') : scoped(['cert_detail'], C, qs, 1), ents: [C], targetId: (C.evidence || [])[0] };
      } else if (G && !T.length && !P) res = { intent: 'skills_overview', facts: scoped(['skills_overview'], G, qs, 1), ents: [G] };
      else if (T.length && !P && (mo.usedIn || cue === 'projects_list')) res = { intent: 'tool_usage', facts: T.slice(0, 2).map(function (t) { return scoped(['tool_usage'], t, qs, 1)[0]; }).filter(Boolean), ents: T.slice(0, 2) };
      else if (P && (mo.tools || T.length)) res = { intent: 'project_detail', targetId: rowOf(P), facts: uniq(pool(['tool_usage'], [P.id]).concat(pool(['project_detail'], [P.id]).filter(function (f) { return /\b(built|uses|stack)\b/.test(f.text) && (f.tags || []).indexOf('stack') >= 0; }))).slice(0, 2), ents: [P], lead: claimLead };
      else if (Rl && mo.tools && !T.length) res = { intent: 'tool_usage', facts: scoped(['tool_usage'], Rl, qs, 1), ents: [Rl] };
      else if (Rl && cue === 'metrics') res = { intent: 'metrics', facts: scoped(['metrics'], Rl, qs, 4), ents: [Rl] };
      else if (P) res = { intent: 'project_detail', facts: scoped(['project_detail'], P, qs, 2), ents: [P], lead: claimLead, targetId: rowOf(P) };
      else if (C) res = { intent: 'cert_detail', facts: scoped(['cert_detail'], C, qs, 2), ents: [C] };
      else if (T.length) {
        var tf = [];
        T.slice(0, 3).forEach(function (t) {
          tf = tf.concat(pool(['tool_usage'], [t.id]).slice(0, 1), T.length === 1 ? pool(['tool_detail'], [t.id]).slice(0, 1) : []);
          var rc = certs.filter(function (c) { return (c.aliases || []).some(function (a) { return (t.aliases || []).concat([t.name]).some(function (ta) { return norm(a) === norm(ta) + ' certificate'; }); }); })[0];
          if (rc && T.length === 1) tf = tf.concat(rc.verify ? pool(['cert_verify'], [rc.id]).slice(0, 1) : pool(['cert_detail'], [rc.id]).slice(0, 1));
        });
        res = { intent: 'tool_detail', facts: tf, ents: T.slice(0, 3), lead: claimLead, partialNote: unknownNote };
      } else if (L) res = { intent: 'leadership', facts: scoped(['leadership'], L, qs, 2), ents: [L] };
      else if (D) res = { intent: 'education', facts: scoped(['education'], D, qs, 2), ents: [D] };
      else if (Rl) {
        var isCur = Rl.end === null && Rl.type === 'role';
        if (isCur && (mo.when || titleQ || nowQ)) res = { intent: 'current_role', facts: currentFacts(mt, mo, titleQ, false), ents: [Rl], lead: claimLead };
        else if (!isCur && (mo.when || cue === 'experience')) res = { intent: 'experience', facts: scoped(['experience'], Rl, qs, 2), ents: [Rl] };
        else res = { intent: 'role_detail', facts: scoped(['role_detail'], Rl, qs.length ? qs : ['work', 'responsibiliti', 'handl', 'build'], isCur ? 2 : 3), ents: [Rl] };
      }
      if (res) { res.conf = conf; return res; }

      /* 6. topic beats a broad cue ("Has he built web apps?") */
      var specific = content.filter(function (w) { return !CUEVOCAB[w] && !CUEVOCAB[stem(w)] && !/^\d{1,2}$/.test(w); }).map(stem);
      if (!cue || cue === 'projects_list' || cue === 'skills_overview') {
        var best = topFacts(specific.length ? specific : qs);
        if (best && best.s >= (cue ? 2.5 : 1.6) && (specific.length || !cue)) {
          var fs = best.list.filter(function (f) { return f.type === best.list[0].type; }).slice(0, 2);
          return { intent: fs[0].type, facts: fs, conf: best.s >= 4 ? 0.7 : 0.55, kind: best.s >= 3 ? 'answer' : 'partial', lead: best.s >= 3 ? claimLead : 'The closest match on the site:', partialNote: unknownNote };
        }
      }

      /* 7. cue routes */
      var Q = qs;
      switch (cue) {
        case 'current_role': return { intent: 'current_role', facts: currentFacts(mt, mo, titleQ, true), ents: curRole ? [curRole] : [], lead: claimLead, conf: 0.85 };
        case 'metrics': return { intent: 'metrics', facts: rank(pool(['metrics'], null).filter(function (f) { return f.status !== 'resume_only'; }), Q, 4, 0.2), conf: 0.8 };
        case 'resume': return { intent: 'resume', facts: pool(['resume'], null).slice(0, 1), conf: 0.9 };
        case 'contact': {
          var ct = pool(['contact'], null);
          ct = /\bgithub\b/.test(mt) ? ct.filter(function (f) { return /github/.test(f.id + f.text.toLowerCase()); }) : /\blinkedin\b/.test(mt) ? ct.filter(function (f) { return /linkedin/i.test(f.text); }) : ct.slice(0, 2);
          return { intent: 'contact', facts: ct, mood: 'jump', targetId: ev['ev.contact'] ? 'ev.contact' : null, evExtra: ['ev.contact'], conf: 0.9 };
        }
        case 'availability': return { intent: 'availability', facts: pool(['availability'], null).slice(0, 1), conf: 0.85 };
        case 'education': return { intent: 'education', facts: rank(pool(['education'], null), Q, 2), conf: 0.85 };
        case 'cert_verify': return { intent: 'cert_verify', facts: pool(['cert_verify'], null), conf: 0.85 };
        case 'certs_list': return listCerts();
        case 'leadership': return { intent: 'leadership', facts: rank(pool(['leadership'], null), Q, 2), conf: 0.8 };
        case 'experience': return { intent: 'experience', facts: rank(pool(['experience'], null), Q, 3), lead: claimLead, conf: 0.8, partialNote: unknownNote };
        case 'skills_overview': return listSkills(unknownNote);
        case 'projects_list':
          if (mo.spotlight && projects[0]) return { intent: 'project_detail', facts: pool(['project_detail'], [projects[0].id]).slice(0, 2), ents: [projects[0]], conf: 0.75 };
          return listProjects(unknownNote);
        case 'location': return { intent: 'location', facts: pool(['location'], null).slice(0, 1), conf: 0.9 };
        case 'identity': return { intent: 'identity', facts: rank(pool(['identity'], ['person']), Q, 3), conf: 0.85 };
      }
      if (unknownRaw.length) return refuse(refById['r.unknown'], 'unknown', 'The site doesn\u2019t mention ' + unknownRaw[0] + ', so the guide can\u2019t confirm it. The site\u2019s toolkit lists the ' + entList.filter(function (e) { return e.type === 'tool'; }).length + ' tools Javed does use.', ['ev.skills']);
      var r2 = refById['r.unknown'] || { fallback: true, category: 'unknown' };
      var o = refuse(r2, 'unknown'); o.kind = 'fallback'; o.conf = 0.2; return o;
    }
    function currentFacts(mt, mo, titleQ, addWork) {
      var sc = curRole ? [curRole.id] : null, title = pool(['identity'], ['person']).filter(function (f) { return (f.tags || []).indexOf('title') >= 0; });
      var cf = titleQ && title.length ? title.slice(0, 1) : pool(['current_role'], sc).slice(0, 1);
      if (addWork && mo.doing && !titleQ) cf = cf.concat(rank(pool(['role_detail'], sc), ['work', 'responsibiliti', 'handl'], 1));
      if (/\b(resume|cv)\b/.test(mt)) cf = cf.concat(pool(['resume'], null).slice(0, 1));
      return cf;
    }
    function numbersIn(t) { return (t.match(/\d[\d,.]*\d|\d/g) || []).map(function (n) { return n.replace(/,/g, ''); }).filter(function (n) { return !/^(19|20)\d\d$/.test(n); }); }
    function uniq(l) { var s = {}; return l.filter(function (f) { if (s[f.id]) return false; s[f.id] = 1; return true; }); }
    function topFacts(qs) {
      if (!qs.length) return null;
      var sc = facts.filter(function (f) { return f.type !== 'twin_meta'; }).map(function (f) { return { f: f, s: bm25(qs, f) }; }).sort(function (a, b) { return b.s - a.s || generic(a.f, b.f); });
      if (!sc[0] || sc[0].s <= 0) return null;
      return { s: sc[0].s, list: sc.filter(function (x) { return x.s >= sc[0].s * 0.7; }).map(function (x) { return x.f; }) };
    }
    function listProjects(note) {
      var lst = [{ t: 'text', v: ' They are: ' }];
      projects.forEach(function (p, i) { lst.push({ t: 'strong', v: p.name }); lst.push({ t: 'text', v: i === projects.length - 1 ? '.' : i === projects.length - 2 ? ' and ' : ', ' }); });
      return { intent: 'projects_list', facts: pool(['projects_list'], null).slice(0, 1), list: lst, cite: projects.map(function (p) { var d = pool(['project_detail'], [p.id])[0]; return d ? d.id : null; }).filter(Boolean), evExtra: projects.map(function (p) { return (p.evidence || [])[0]; }).filter(Boolean), conf: 0.85, partialNote: note };
    }
    function listCerts() {
      var lst = [{ t: 'text', v: '\n' }], cite = [];
      certs.forEach(function (c, i) {
        lst.push({ t: 'strong', v: c.name }); lst.push({ t: 'text', v: (c.issuer ? ' (' + c.issuer + (c.date ? ', ' + c.date : '') + ')' : '') + (i < certs.length - 1 ? '\n' : '') });
        var d = pool(['cert_detail'], [c.id])[0]; if (d) cite.push(d.id);
      });
      return { intent: 'certs_list', facts: pool(['certs_list'], null).slice(0, 1), list: lst, cite: cite, conf: 0.85 };
    }
    function listSkills(note) {
      var lst = [{ t: 'text', v: '\n' }], cite = [], groups = entList.filter(function (e) { return e.type === 'skill-group'; });
      groups.forEach(function (g, i) {
        var names = (g.tools || []).map(function (s) { var t = ents['tool.' + s]; return t ? t.name : null; }).filter(Boolean);
        lst.push({ t: 'strong', v: g.name }); lst.push({ t: 'text', v: ': ' + names.join(', ') + (i < groups.length - 1 ? '\n' : '') });
        var d = pool(['skills_overview'], [g.id])[0]; if (d) cite.push(d.id);
      });
      return { intent: 'skills_overview', facts: F('f.tool.count').length ? F('f.tool.count') : pool(['skills_overview'], ['person']).slice(0, 1), list: lst, cite: cite, conf: 0.85, partialNote: note };
    }

    /* ---------- public API ---------- */
    function ask(text, ctx) {
      var t0 = Date.now();
      ctx = ctx && typeof ctx === 'object' ? ctx : newContext();
      if (!ctx.entities) ctx.entities = []; if (!ctx.shown) ctx.shown = [];
      var o = route(text, ctx);
      if (o.partialNote && o.kind !== 'refusal') { o.lead = o.partialNote + (o.lead ? ' ' + o.lead : ' Here\u2019s what the site does say:'); o.kind = 'partial'; o.conf = Math.min(o.conf || 0.6, 0.6); }
      if (o.facts && !o.facts.length && !o.list && !o.tail) { o = refuse(refById['r.unknown'], 'unknown'); o.kind = 'fallback'; o.conf = 0.2; }
      if (o.facts && o.facts.length > 1) {
        var seenN = {};
        o.facts = o.facts.filter(function (f, i) {
          var ns = numbersIn(f.text), dup = i > 0 && ns.some(function (n) { return seenN[n]; });
          if (!dup) ns.forEach(function (n) { seenN[n] = 1; });
          return !dup;
        });
      }
      var ent0 = (o.ents || [])[0];
      if (!o.follow) {
        var projEv = []; (o.facts || []).forEach(function (f) { (f.evidence || []).forEach(function (id) { projects.forEach(function (p) { if ((p.evidence || []).indexOf(id) >= 0 && ev[id].kind === 'project' && projEv.indexOf(p.id) < 0) projEv.push(p.id); }); }); });
        o.follow = follow(o.intent, ent0, norm(stripTags(text)), ent0 && ent0.type === 'tool' ? projEv : null);
      }
      var res = build(o);
      res.debug.ms = Date.now() - t0;
      ctx.turn = (ctx.turn || 0) + 1;
      if (!o.noCtx) {
        ctx.intent = o.intent === 'more' ? ctx.intent : o.intent;
        if (o.ents && o.ents.length) ctx.entities = o.ents.map(function (e) { return e.id; }).slice(0, 3);
        else if (o.intent !== 'more') ctx.entities = [];
        ctx.shown = ctx.shown.concat(res.debug.factIds.filter(function (id) { return ctx.shown.indexOf(id) < 0; })).slice(-80);
      }
      return res;
    }
    function newContext() { return { v: 1, turn: 0, intent: null, entities: [], shown: [] }; }

    return {
      version: VERSION,
      provider: opts.provider || 'local',
      newContext: newContext,
      starters: starters,
      ask: function (text, ctx) { try { return Promise.resolve(ask(text, ctx)); } catch (e) { return Promise.reject(e); } },
      askSync: ask
    };
  }
  return { create: create, version: VERSION, normalize: norm };
});
