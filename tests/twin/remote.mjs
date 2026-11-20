/* Optional Gemini phrasing tests (Playwright). The proxy is mocked; nothing leaves the machine.
 *   empty endpoint = fully local, no switch · valid reply replaces only the answer text (card proof, chips, tour stay) ·
 *   invented number, ok:false, 500 and malformed JSON show the local answer · while the reply is on its way the local
 *   answer is a grey draft (no card yet); when it lands the text turns final with the "Phrased by Gemini" label · refusals, unknowns and
 *   greetings never call the proxy · repo/contact answers (URL or email in the facts) skip it · Local mode switch · request body is exactly {v,q,factIds} with credentials omitted.
 * Run from the repo root with the site served on :8813 (python3 -m http.server 8813):
 *   PLAYWRIGHT_DIR=/path/to/node_modules/playwright node tests/twin/remote.mjs
 */
const { chromium } = await import(process.env.PLAYWRIGHT_DIR ? process.env.PLAYWRIGHT_DIR + '/index.mjs' : 'playwright');
const URL = process.env.TW_URL || 'http://localhost:8813/index.html';
const EP = 'https://twin.example.test/';
const LOCAL_LINE = 'Answers are built on this page. Nothing you type leaves it; this browser only remembers that you’ve visited.';
const REMOTE_LINE = 'Answers use only this site’s verified facts. To phrase replies, your question is sent to Google Gemini — don’t share personal info.';
const Q = 'Tell me about the Aadhaar Masking Tool';
const GOOD = 'The Aadhaar Masking Tool is Javed’s privacy project: it uses OCR to find Aadhaar numbers in images and PDFs, checks them with regex and masks the first eight digits. It is built with Python, Django, OpenCV and PaddleOCR.';
const results = []; const check = (name, ok, info = '') => { results.push({ name, ok: !!ok, info }); console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}  ${info}`) };
const b = await chromium.launch();

// endpoint: the value injected into data-tw-endpoint before boot runs (null = empty, i.e. fully local).
// index.html carries the live worker URL, so it is always replaced: no test ever reaches the real proxy.
async function setup(endpoint) {
  const ctx = await b.newContext({ viewport: { width: 1440, height: 900 } }); const p = await ctx.newPage(); const errs = [], posts = [];
  const state = { mode: 'good', calls: [] };
  p.on('pageerror', e => errs.push(String(e))); p.on('console', m => m.type() === 'error' && errs.push(m.text()));
  p.on('request', r => { if (r.method() === 'POST') posts.push(r.url()) });
  // record the fetch options the app passes (to prove credentials:'omit')
  await p.addInitScript(() => { const f = window.fetch; window.__fx = []; window.fetch = function (u, o) { if (o && o.method === 'POST') window.__fx.push({ u: String(u), credentials: o.credentials, keys: Object.keys(o).sort() }); return f.apply(this, arguments) } });
  await p.route('**/index.html', async route => {
    const res = await route.fetch(); const html = await res.text();
    await route.fulfill({ response: res, body: html.replace(/data-tw-endpoint="[^"]*"/, `data-tw-endpoint="${endpoint || ''}"`) });
  });
  await p.route('https://twin.example.test/**', async route => {
    const req = route.request(), cors = { 'access-control-allow-origin': '*', 'access-control-allow-methods': 'POST, OPTIONS', 'access-control-allow-headers': 'content-type' };
    if (req.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: cors });
    const body = req.postDataJSON(); state.calls.push({ body, headers: await req.allHeaders() });
    const json = o => route.fulfill({ status: 200, headers: { ...cors, 'content-type': 'application/json' }, body: JSON.stringify(o) });
    const used = [body.factIds[0]];
    switch (state.mode) {
      case 'good': return json({ ok: true, answer: GOOD, used });
      case 'number': return json({ ok: true, answer: GOOD.replace('eight', '10'), used });
      case 'unsent': return json({ ok: true, answer: GOOD, used: ['f.contact.email'] });
      case 'markdown': return json({ ok: true, answer: '**' + GOOD + '**', used });
      case 'self': return json({ ok: true, answer: 'I built the Aadhaar Masking Tool with Python.', used });
      case 'false': return json({ ok: false, reason: 'quota' });
      case '500': return route.fulfill({ status: 500, headers: cors, body: 'boom' });
      case 'malformed': return route.fulfill({ status: 200, headers: { ...cors, 'content-type': 'application/json' }, body: '{"ok":true,"answer":' });
      case 'slow': await new Promise(r => setTimeout(r, 6500)); try { await json({ ok: true, answer: GOOD, used }) } catch (e) { /* aborted by the client */ } return;
    }
  });
  await p.goto(URL, { waitUntil: 'domcontentloaded' }); await p.evaluate(() => document.fonts.ready);
  await p.evaluate(() => document.getElementById('about').scrollIntoView({ behavior: 'instant' }));
  await p.waitForFunction(() => document.querySelector('#tw-root .tw-stage.is-live'), null, { timeout: 15000 }); await p.waitForTimeout(1200);
  await open(p);
  return { ctx, p, errs, posts, state };
}
async function open(p) {
  if (!(await p.evaluate(() => !!document.querySelector('#tw-root[data-open]')))) await p.locator('#tw-root .tw-dock__btn').click();
  await p.waitForFunction(() => { const i = document.querySelector('#tw-root .tw-input'); return i && i.offsetParent });
}
// ask and return the final answer (grey draft over) plus timing
async function ask(p, q) {
  await open(p);
  await p.waitForFunction(() => !document.getElementById('tw-root').classList.contains('is-searching'), null, { timeout: 15000 });
  const n = await p.locator('#tw-root .tw-msg--bot').count(), t0 = Date.now();
  await p.locator('#tw-root .tw-input').fill(q); await p.keyboard.press('Enter');
  await p.waitForFunction(n => { const l = document.querySelectorAll('#tw-root .tw-msg--bot'); return l.length > n && !l[l.length - 1].classList.contains('is-draft'); }, n, { timeout: 14000 });
  return { text: await p.evaluate(() => [...document.querySelectorAll('#tw-root .tw-ans')].pop().textContent), ms: Date.now() - t0 };
}
const foot = p => p.evaluate(() => ({ txt: document.querySelector('#tw-root .tw-foot__txt')?.textContent, sw: document.querySelector('#tw-root .tw-local')?.getAttribute('aria-pressed') ?? null }));
const settle = p => p.waitForTimeout(400);

// ---- 1. empty endpoint: fully local ----
let LOCAL;
{
  const { ctx, p, errs, posts } = await setup(null);
  const f = await foot(p);
  check('empty endpoint: current footer line, no Local mode switch', f.txt === LOCAL_LINE && f.sw === null, JSON.stringify(f));
  LOCAL = (await ask(p, Q)).text; await settle(p);
  check('empty endpoint: answer shown, zero POST requests', LOCAL.startsWith('Javed’s Aadhaar') || LOCAL.startsWith("Javed's Aadhaar") ? posts.length === 0 : false, `${posts.length} posts · ${LOCAL.slice(0, 60)}`);
  check('empty endpoint: zero console errors', errs.length === 0, errs.join(' | '));
  await ctx.close();
}

// ---- non-https endpoint is ignored ----
{
  const { ctx, p, posts } = await setup('http://twin.example.test/');
  const f = await foot(p);
  await ask(p, Q); await settle(p);
  check('http:// (non-local) endpoint is ignored: local footer, no switch, no request', f.txt === LOCAL_LINE && f.sw === null && posts.length === 0, JSON.stringify(f) + ` posts=${posts.length}`);
  await ctx.close();
}

// ---- 2–7. endpoint set (mocked) ----
{
  const { ctx, p, errs, posts, state } = await setup(EP);
  const f = await foot(p);
  check('endpoint set: Gemini privacy line + Local mode switch (aria-pressed=false)', f.txt === REMOTE_LINE && f.sw === 'false', JSON.stringify(f));

  // 2. valid ok:true
  await p.evaluate(() => { window.__touring = false; const r = document.getElementById('tw-root'); new MutationObserver(() => { if (r.classList.contains('is-touring')) window.__touring = true }).observe(r, { attributes: true, attributeFilter: ['class'] }) });
  state.mode = 'good'; const g = await ask(p, Q);
  check('valid reply: Gemini text is shown', g.text === GOOD, g.text.slice(0, 80));
  const card = await p.evaluate(async () => {
    const kb = await (await fetch('twin/knowledge.json')).json(), li = [...document.querySelectorAll('#tw-root .tw-msg--bot')].pop(), c = li.querySelector('.tw-card');
    return { proof: c && c.querySelector('.tw-card__proof').textContent, verbatim: !!c && kb.facts.some(f => f.text === c.querySelector('.tw-card__proof').textContent), chips: li.querySelectorAll('.tw-ev a, .tw-card__go').length, fus: li.querySelectorAll('.tw-fu').length, html: li.querySelector('.tw-ans').children.length };
  });
  check('valid reply: evidence card proof is word for word from the KB', card.verbatim, card.proof);
  check('valid reply: evidence links and follow-ups stay', card.chips > 0 && card.fus > 0, JSON.stringify(card));
  check('valid reply: rendered as plain text (no child elements)', card.html === 0, '');
  await p.waitForTimeout(2600);
  check('valid reply: auto-tour still runs', await p.evaluate(() => window.__touring), '');
  const call = state.calls[0] || { body: {}, headers: {} };
  check('request body is exactly {v,q,factIds}', JSON.stringify(Object.keys(call.body).sort()) === '["factIds","q","v"]' && call.body.v === 1 && call.body.q === Q, JSON.stringify(call.body));
  check('factIds: 1..6 unique KB ids from the local answer', Array.isArray(call.body.factIds) && call.body.factIds.length >= 1 && call.body.factIds.length <= 6 && new Set(call.body.factIds).size === call.body.factIds.length && call.body.factIds.every(id => /^f\.proj\.aadhaar\./.test(id)), JSON.stringify(call.body.factIds));
  const fx = await p.evaluate(() => window.__fx[0]);
  check("fetch uses credentials:'omit', no cookie header sent", fx && fx.credentials === 'omit' && !('cookie' in call.headers), JSON.stringify(fx));
  await p.waitForTimeout(5000);

  // 3. invented number + other client-side rejections
  for (const mode of ['number', 'unsent', 'markdown', 'self']) {
    state.mode = mode; const r = await ask(p, Q); await settle(p);
    check(`rejected reply (${mode}) → local answer shown`, r.text === LOCAL, r.text.slice(0, 60));
  }

  // 4. failures
  for (const mode of ['false', '500', 'malformed']) {
    state.mode = mode; const r = await ask(p, Q); await settle(p);
    check(`failure (${mode}) → local answer shown`, r.text === LOCAL, r.text.slice(0, 60));
  }
  state.mode = 'slow';
  const slowP = ask(p, Q); await p.waitForTimeout(2500);
  const draft = await p.evaluate(() => { const li = [...document.querySelectorAll('#tw-root .tw-msg--bot')].pop(), c = li.querySelector('.tw-card'); return { draft: li.classList.contains('is-draft'), text: li.querySelector('.tw-ans').textContent, color: getComputedStyle(li.querySelector('.tw-ans')).color, wait: li.querySelector('.tw-ans__by.is-wait')?.textContent, card: !!c && c.offsetParent !== null, searching: document.getElementById('tw-root').classList.contains('is-searching'), scan: document.querySelector('#tw-root .tw-scan').classList.contains('is-search') }; });
  check('slow reply: grey local draft while waiting, no card yet, pet searching, scan looping', draft.draft && draft.text === LOCAL && draft.color === 'rgb(167, 174, 171)' && /Gemini is checking/.test(draft.wait || '') && !draft.card && draft.searching && draft.scan, JSON.stringify(draft));
  const slow = await slowP;
  const after = await p.evaluate(() => { const li = [...document.querySelectorAll('#tw-root .tw-msg--bot')].pop(), c = li.querySelector('.tw-card'); return { by: li.querySelector('.tw-ans__by')?.textContent, card: !!c && c.offsetParent !== null, kids: li.querySelector('.tw-ans').children.length, saved: JSON.parse(sessionStorage.getItem('tw:v1')).msgs.pop().gem === true }; });
  check('slow reply: lands (~6.5 s) as the final answer: Gemini text, label, card shown, plain text, saved', slow.text === GOOD && slow.ms > 6000 && slow.ms < 8500 && after.by === 'Phrased by Gemini' && after.card && after.kids === 0 && after.saved, `${slow.ms} ms ` + JSON.stringify(after));
  await p.waitForTimeout(4000);

  // 5. refusal / unknown / greeting never call the proxy
  const before = state.calls.length;
  for (const q of ['what is his phone number', 'Does he know Kubernetes?', 'hi']) { await ask(p, q); await settle(p) }
  check('refusal, unknown and greeting: no request at all', state.calls.length === before, `${state.calls.length - before} calls`);
  const repo = await ask(p, 'Show me the GitHub repo for the Spotify dashboard.'); await settle(p);
  check('repo-link answer (URL in the facts): no request, local answer', state.calls.length === before && /github\.com/.test(repo.text), repo.text.slice(0, 70));

  // 6. Local mode switch
  await open(p); await p.locator('#tw-root .tw-local').click();
  const lf = await foot(p), saved = await p.evaluate(() => JSON.parse(sessionStorage.getItem('tw:v1')).local);
  check('Local mode on: aria-pressed=true, local footer line, saved in sessionStorage', lf.sw === 'true' && lf.txt === LOCAL_LINE && saved === true, JSON.stringify(lf));
  const nPosts = posts.length; state.mode = 'good'; const lr = await ask(p, Q); await settle(p);
  check('Local mode on: no request, local answer', posts.length === nPosts && lr.text === LOCAL, `${posts.length - nPosts} posts`);
  await open(p); await p.locator('#tw-root .tw-local').click();
  const off = await foot(p);
  check('Local mode off again: Gemini line returns', off.sw === 'false' && off.txt === REMOTE_LINE, JSON.stringify(off));

  // 7. privacy: nothing extra persisted, question never logged
  const store = await p.evaluate(() => sessionStorage.getItem('tw:v1'));
  check('r.debug never persisted', !/"debug"|factIds/.test(store), '');
  // 8. console: the 500 mock makes Chrome log one network line; anything else is a real error
  const real = errs.filter(e => !/status of 500/.test(e));
  check('endpoint set: zero console errors (besides the mocked 500 network line)', real.length === 0, real.join(' | '));
  await ctx.close();
}
await b.close();
const fail = results.filter(r => !r.ok).length;
console.log(`\n${results.length - fail} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
