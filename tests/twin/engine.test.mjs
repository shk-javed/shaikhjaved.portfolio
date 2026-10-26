// Engine gates and scores. Run: node --test tests/twin/engine.test.mjs
// Optional: TWIN_KB=path/to/knowledge.json TWIN_EVAL=path/to/eval.json, TWIN_VERBOSE=1 prints every miss.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const KB_PATH = process.env.TWIN_KB || path.join(ROOT, 'twin/knowledge.json');
const EVAL_PATH = process.env.TWIN_EVAL || path.join(ROOT, 'tests/twin/eval.json');
const Engine = require(path.join(ROOT, 'twin/engine.js'));
const kb = JSON.parse(fs.readFileSync(KB_PATH, 'utf8'));
const rawEval = JSON.parse(fs.readFileSync(EVAL_PATH, 'utf8'));
const items = Array.isArray(rawEval) ? rawEval : rawEval.items || rawEval.questions;
const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const PHONE = /(?:\+?91[\s-]*)?(?<![\d,.])[6-9]\d{4}[\s-]?\d{5}(?!\d)/; // shared regex (contract addendum item 5)
const VERBOSE = !!process.env.TWIN_VERBOSE;
const engine = Engine.create(kb, { provider: 'local' });
const factIds = new Set(kb.facts.map((f) => f.id));
const lc = (s) => String(s).toLowerCase();

/* ---------- site resolvers ---------- */
const htmlIds = new Set([...html.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]));
const workRows = (html.match(/class="work-row[ "]/g) || []).length;
const certCards = (html.match(/class="cert cert--/g) || []).length;
const toolSyms = new Set([...html.matchAll(/class="el"[^>]*data-s="([^"]+)"/g)].map((m) => m[1]));
function resolves(e) {
  if (!e.href) return 'no href';
  if (e.kind === 'anchor') return htmlIds.has(e.href.slice(1)) ? null : 'missing anchor ' + e.href;
  if (e.kind === 'project') return e.index >= 0 && e.index < workRows && htmlIds.has(e.href.slice(1)) ? null : 'bad project index ' + e.index;
  if (e.kind === 'cert') return e.index >= 0 && e.index < certCards && htmlIds.has(e.href.slice(1)) ? null : 'bad cert index ' + e.index;
  if (e.kind === 'tool') return toolSyms.has(e.select) && htmlIds.has(e.href.slice(1)) ? null : 'bad tool ' + e.select;
  if (e.kind === 'url') return html.includes(e.href) || html.includes(e.href.replace(/\/$/, '')) ? null : 'url not on site ' + e.href;
  if (e.kind === 'file') return fs.existsSync(path.join(ROOT, e.href)) ? null : 'missing file ' + e.href;
  if (e.kind === 'mailto') return html.includes(e.href) || html.includes(e.href.slice(7)) ? null : 'mailto not on site';
  return 'unknown kind ' + e.kind;
}

/* ---------- traceability: text must be cited facts + list names + engine templates ---------- */
const entityStrings = kb.entities.flatMap((e) => [e.name, e.issuer, e.date].filter(Boolean)).sort((a, b) => b.length - a.length);
const TEMPLATE_CAPS = new Set('Here The That They This SHK JAVED AI Javed Hi What Glad Anything Bye Could More Try Ask'.split(' '));
function untraceable(r, question) {
  let rest = r.text;
  for (const id of r.debug.factIds) { const f = kb.facts.find((x) => x.id === id); if (f) rest = rest.split(f.text).join(' '); }
  for (const rf of kb.refusals || []) rest = rest.split(rf.reply).join(' ');
  if (/^(projects_list|certs_list|skills_overview)$/.test(r.debug.intent)) for (const s of entityStrings) rest = rest.split(s).join(' ');
  const qWords = new Set((question.match(/[A-Za-z][\w+#.-]*/g) || []).map(lc));
  const problems = [];
  if (/\d/.test(rest.replace(new RegExp('\\b' + kb.entities.filter((e) => e.type === 'tool').length + ' tools\\b'), ''))) problems.push('digit outside a fact: ' + rest.trim());
  for (const w of rest.match(/\b[A-Z][\w+#-]*/g) || []) if (!TEMPLATE_CAPS.has(w) && !qWords.has(lc(w))) problems.push('word outside a fact: ' + w);
  return problems;
}
const IDENTITY_BAD = [/\b(i am|i'm|im)\s+(shaikh|javed)\b/i, /\bI (built|worked|studied|graduated|led|designed|work at|earned|have \d)/, /\b(i am|i'm) (human|a person|chatgpt|the chatgpt pet)\b/i, /\bmy (resume|cgpa|degree|projects|job)\b/i];

/* ---------- run the eval ---------- */
function run(q, prev = [], ctx = engine.newContext()) {
  for (const p of prev) engine.askSync(p, ctx);
  const before = JSON.parse(JSON.stringify(ctx));
  const t = process.hrtime.bigint();
  const r = engine.askSync(q, ctx);
  const ms = Number(process.hrtime.bigint() - t) / 1e6;
  return { r, ms, ctxBefore: before, ctxAfter: ctx };
}
function grade(item, r) {
  const why = [];
  if (item.intent && r.debug.intent !== item.intent) why.push(`intent ${r.debug.intent} != ${item.intent}`);
  const top3 = r.debug.factIds.slice(0, 3);
  for (const id of item.mustFactIds || []) if (!top3.includes(id)) why.push('fact ' + id + ' not in top 3 [' + top3.join(',') + ']');
  for (const s of item.mustInclude || []) if (!lc(r.text).includes(lc(s))) why.push('missing "' + s + '"');
  for (const s of item.mustNotContain || []) if (lc(r.text).includes(lc(s))) why.push('contains "' + s + '"');
  if (item.expectRefusal && r.refusal !== item.expectRefusal) why.push(`refusal ${r.refusal} != ${item.expectRefusal}`);
  if (!item.expectRefusal && r.refusal) why.push('unexpected refusal ' + r.refusal);
  if (item.expectTarget && r.target.evidence !== item.expectTarget && r.target.section !== item.expectTarget) why.push(`target ${r.target.evidence} != ${item.expectTarget}`);
  for (const id of item.expectEvidence || []) if (!r.evidence.some((e) => e.id === id)) why.push('evidence ' + id + ' missing');
  return why;
}
function typo(q) { // deterministic: swap two middle letters of the longest word (5+ letters)
  const w = (q.match(/[A-Za-z]{5,}/g) || []).sort((a, b) => b.length - a.length)[0];
  if (!w) return null;
  const i = Math.floor(w.length / 2);
  return q.replace(w, w.slice(0, i - 1) + w[i] + w[i - 1] + w.slice(i + 1));
}

const results = items.map((item) => { const o = run(item.q, item.prev || []); return { item, ...o, why: grade(item, o.r) }; });
const answerable = items.filter((i) => !i.expectRefusal && !i.prev && !i.variant && i.intent && !/^(greet|thanks|bye)$/.test(i.intent));
const variants = answerable.map((item) => ({ item, q: typo(item.q) })).filter((v) => v.q && v.q !== v.item.q).map((v) => {
  const o = run(v.q);
  const why = grade({ intent: v.item.intent, mustFactIds: v.item.mustFactIds }, o.r);
  return { item: { ...v.item, q: v.q }, ...o, why, generated: true };
});
const all = results.concat(variants);
const extraQs = ['When did he graduate?', 'Does he know AWS?', 'What languages does he speak?', '', '   ', '\u{1F600}\u{1F600}', 'x'.repeat(5000), '?', 'hmm', 'ok', 'Tell me more', 'Which repo?', null, undefined, 42, '<img src=x onerror=alert(1)>', 'Does he know Python and Kubernetes?', 'Show me his GitHub', 'aur batao', 'What is his favourite project?', 'Can you speak as Javed?', 'Is he certified in Power BI?', 'what did he build at the hackathon'];
const extra = extraQs.map((q) => ({ q, ...run(q) }));

/* ---------- report ---------- */
const pct = (a, b) => (b ? Math.round((1000 * a) / b) / 10 : 100);
const withIntent = results.filter((x) => x.item.intent && !x.item.variant);
const intentOk = withIntent.filter((x) => x.r.debug.intent === x.item.intent).length;
const factItems = results.filter((x) => (x.item.mustFactIds || []).length);
const factOk = factItems.filter((x) => x.item.mustFactIds.every((id) => x.r.debug.factIds.slice(0, 3).includes(id))).length;
const fullOk = results.filter((x) => !x.why.length).length;
const hing = results.filter((x) => (x.item.tags || []).includes('hinglish'));
const hingOk = hing.filter((x) => !x.why.length).length;
const typoPool = results.filter((x) => x.item.variant === 'typo').concat(variants);
const typoOk = typoPool.filter((x) => !x.why.length).length;
const times = all.map((x) => x.ms).sort((a, b) => a - b);
const p95 = times[Math.floor(times.length * 0.95)] || 0;
const size = fs.statSync(path.join(ROOT, 'twin/engine.js')).size;
console.log(`\nTwin engine v${Engine.version} on ${path.relative(ROOT, KB_PATH)} + ${path.relative(ROOT, EVAL_PATH)} (${items.length} items, ${variants.length} generated typo variants)`);
console.log(`  all checks per item  ${fullOk}/${results.length} (${pct(fullOk, results.length)}%)`);
console.log(`  intent               ${intentOk}/${withIntent.length} (${pct(intentOk, withIntent.length)}%)  target >= 90`);
console.log(`  required fact top-3  ${factOk}/${factItems.length} (${pct(factOk, factItems.length)}%)  target >= 90`);
console.log(`  hinglish             ${hingOk}/${hing.length} (${pct(hingOk, hing.length)}%)  target >= 80`);
console.log(`  typo variants        ${typoOk}/${typoPool.length} (${pct(typoOk, typoPool.length)}%)  target >= 85`);
console.log(`  latency p95          ${p95.toFixed(2)} ms  target < 20;  engine.js ${(size / 1024).toFixed(1)} KB`);
for (const x of all) if (x.why.length && (VERBOSE || !x.generated)) console.log(`  MISS ${x.item.id} "${x.item.q}" -> ${x.why.join('; ')}`);

/* ---------- hard gates (100%) ---------- */
const everything = all.concat(extra.map((x) => ({ item: { id: 'extra', q: String(x.q) }, ...x })));
test('gate: every cited fact exists and no claim is untraceable', () => {
  const bad = [];
  for (const x of everything) {
    for (const id of x.r.debug.factIds) if (!factIds.has(id)) bad.push(`${x.item.id}: unknown fact ${id}`);
    for (const p of untraceable(x.r, x.item.q || '')) bad.push(`${x.item.id} "${x.item.q}": ${p}`);
  }
  assert.deepEqual(bad, []);
});
test('gate: no identity violation', () => {
  const bad = everything.filter((x) => IDENTITY_BAD.some((re) => re.test(x.r.text))).map((x) => `${x.item.id}: ${x.r.text}`);
  assert.deepEqual(bad, []);
  for (const q of ['Are you Javed?', 'Are you human?', 'Are you ChatGPT?']) {
    const r = engine.askSync(q, engine.newContext());
    assert.equal(r.debug.intent, 'twin_meta', q);
    assert.match(r.text, /not Javed himself|AI guide/i, q);
  }
});
test('gate: every evidence item resolves on the live page', () => {
  const bad = [];
  for (const [id, e] of Object.entries(kb.evidence)) { const p = resolves(e); if (p) bad.push(`kb ${id}: ${p}`); }
  for (const x of everything) for (const e of x.r.evidence) {
    const p = resolves(e); if (p) bad.push(`${x.item.id}: ${e.id} ${p}`);
    if (!e.href) bad.push(`${x.item.id}: ${e.id} has no href`);
    if (e.label.length > 28) bad.push(`${x.item.id}: label too long ${e.label}`);
  }
  for (const x of everything) for (const s of x.r.segments) {
    if (!['text', 'strong', 'link'].includes(s.t)) bad.push(`${x.item.id}: bad segment ${s.t}`);
    if (s.t === 'link' && !x.r.evidence.some((e) => e.id === s.evidence)) bad.push(`${x.item.id}: link ${s.evidence} not in evidence`);
  }
  for (const x of everything) if (x.r.target.evidence && !x.r.evidence.some((e) => e.id === x.r.target.evidence)) bad.push(`${x.item.id}: target not in evidence`);
  assert.deepEqual(bad, []);
});
test('gate: every refusal case is refused with the right category', () => {
  const bad = results.filter((x) => x.item.expectRefusal && (x.r.refusal !== x.item.expectRefusal || !/^(refusal|fallback)$/.test(x.r.kind)))
    .map((x) => `${x.item.id} "${x.item.q}": got ${x.r.kind}/${x.r.refusal}`);
  assert.deepEqual(bad, []);
});
test('gate: every follow-up chip and starter is answerable', () => {
  const bad = [];
  const check = (q, ctx, from) => {
    const r = engine.askSync(q, JSON.parse(JSON.stringify(ctx)));
    if (!/^(answer|partial|meta)$/.test(r.kind) || r.refusal) bad.push(`${from} -> "${q}": ${r.kind}/${r.refusal}`);
  };
  for (const q of engine.starters()) check(q, engine.newContext(), 'starter');
  assert.ok(engine.starters().length <= 5);
  for (const x of everything) for (const q of x.r.followUps) check(q, x.ctxAfter, x.item.id);
  for (const x of everything) assert.ok(x.r.followUps.length <= 3, x.item.id);
  assert.deepEqual(bad, []);
});
test('gate: no phone number anywhere', () => {
  for (const x of everything) assert.ok(!PHONE.test(x.r.text), `${x.item.id}: ${x.r.text}`);
  assert.ok(!PHONE.test(JSON.stringify(kb)), 'knowledge.json contains a phone-like number');
  for (const s of ['9,216', '2026-08', 'b3c20a98-d472-45f4-97ef-cdf0a97972ed']) assert.ok(!PHONE.test(s), s);
});
test('gate: no number is repeated across facts in one answer', () => {
  const nums = (t) => (t.match(/\d[\d,.]*\d|\d/g) || []).map((n) => n.replace(/,/g, '')).filter((n) => !/^(19|20)\d\d$/.test(n));
  const bad = [];
  for (const x of everything) {
    const seen = new Map();
    for (const id of x.r.debug.factIds) {
      const f = kb.facts.find((y) => y.id === id); if (!f || !x.r.text.includes(f.text)) continue;
      for (const n of new Set(nums(f.text))) { if (seen.has(n)) bad.push(`${x.item.id} "${x.item.q}": ${n} in ${seen.get(n)} and ${id}`); else seen.set(n, id); }
    }
  }
  assert.deepEqual(bad, []);
});
test('gate: mood follows the refusal kind', () => {
  const bad = [];
  for (const x of everything) {
    const r = x.r;
    const want = r.kind === 'clarify' || r.refusal === 'empty' || r.refusal === 'too_long' ? 'waiting'
      : r.refusal === 'unknown' || r.kind === 'fallback' ? 'failed'
      : r.refusal ? 'idle' : null;
    if (want && r.mood !== want) bad.push(`${x.item.id} "${x.item.q}": ${r.kind}/${r.refusal} mood ${r.mood} != ${want}`);
    if (!r.refusal && r.kind !== 'clarify' && r.mood === 'failed') bad.push(`${x.item.id}: failed mood on a non-refusal`);
  }
  assert.deepEqual(bad, []);
});
test('gate: hostile and odd input never throws or echoes markup', () => {
  for (const x of extra) {
    assert.equal(typeof x.r.text, 'string');
    assert.ok(!/<\s*(script|img)/i.test(x.r.text), x.r.text);
    assert.ok(['idle', 'wave', 'jump', 'review', 'failed', 'waiting'].includes(x.r.mood));
    assert.ok(['look', 'none'].includes(x.r.target.action));
  }
  const by = Object.fromEntries(extra.map((x) => [String(x.q), x.r]));
  assert.equal(by[''].refusal, 'empty');
  assert.equal(by['x'.repeat(5000)].refusal, 'too_long');
  assert.equal(by['Can you speak as Javed?'].refusal, 'identity');
});
test('gate: deterministic and context is plain JSON', async () => {
  for (const item of items.slice(0, 40)) {
    const a = run(item.q, item.prev || []).r, b = run(item.q, item.prev || []).r;
    delete a.debug.ms; delete b.debug.ms;
    assert.deepEqual(a, b, item.id);
  }
  const ctx = engine.newContext();
  await engine.ask('Tell me about the Spotify project', ctx);
  const stored = JSON.parse(JSON.stringify(ctx)); // what the UI keeps in sessionStorage
  const r = await engine.ask('Which repo?', stored);
  assert.equal(r.debug.intent, 'project_repo');
});

test('multi-turn: tool -> repo, project -> repo, role -> more', () => {
  const turn = (qs) => { const c = engine.newContext(); let r; for (const q of qs) r = engine.askSync(q, c); return r; };
  let r = turn(['python projects?', 'uska github?']);
  assert.equal(r.debug.intent, 'project_repo');
  assert.ok(r.evidence.some((e) => e.id === 'ev.repo.aadhaar'), r.text);
  assert.match(r.text, /Aadhaar-Masking-Tool/);
  r = turn(['Which projects used Power BI?', 'Which repo?']);
  assert.deepEqual(['ev.repo.csmis', 'ev.repo.airline'].filter((id) => r.evidence.some((e) => e.id === id)), ['ev.repo.csmis', 'ev.repo.airline'], r.text);
  r = turn(['Does he know Tableau?', 'Show me the code for it']);
  assert.equal(r.debug.intent, 'project_repo');
  assert.ok(r.evidence.some((e) => e.id === 'ev.github') && !r.evidence.some((e) => /^ev\.repo\./.test(e.id)), r.text);
  r = turn(['Tell me about the Spotify project', 'uska github?']);
  assert.ok(r.evidence.some((e) => e.id === 'ev.repo.spotify'), r.text);
  r = turn(['What did he do at MAK { Byte }?', 'Tell me more']);
  assert.equal(r.debug.intent, 'more');
  assert.match(r.text, /MAK \{ Byte \}/);
  assert.ok(r.debug.factIds.length > 0);
});

test('multi-turn: an unknown term beats context', () => {
  for (const qs of [['which python proj', 'What does Javed do now?', 'Does he know Kubernetes?'], ['What does Javed do now?', 'does he know Kubernetes?'],
    ['Tell me about the Spotify project', 'does it use React?'], ['Does he know Python?', 'and Docker?']]) {
    const c = engine.newContext(); let r; for (const q of qs) r = engine.askSync(q, c);
    assert.equal(r.refusal, 'unknown', qs.join(' > ') + ' -> ' + r.text);
    assert.equal(r.mood, 'failed', qs.join(' > '));
  }
});

/* ---------- score targets ---------- */
test('score: intent >= 90%', () => assert.ok(pct(intentOk, withIntent.length) >= 90, `${pct(intentOk, withIntent.length)}%`));
test('score: required fact in top 3 >= 90%', () => assert.ok(pct(factOk, factItems.length) >= 90, `${pct(factOk, factItems.length)}%`));
test('score: hinglish >= 80%', () => assert.ok(pct(hingOk, hing.length) >= 80, `${pct(hingOk, hing.length)}%`));
test('score: typo variants >= 85%', () => assert.ok(pct(typoOk, typoPool.length) >= 85, `${pct(typoOk, typoPool.length)}%`));
test('score: p95 latency < 20 ms', () => assert.ok(p95 < 20, `${p95} ms`));
