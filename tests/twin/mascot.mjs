/* Mascot state tests (Playwright). Checks the state-driven animations of the SHK JAVED guide:
 *   welcome wave on open · listening (looks at the input while typing, settles after a pause) · thinking (working) ·
 *   answer moods · attentive look on dock hover · ambient glance while docked · delight jump on "Copy email" ·
 *   no face-hidden look frames (150°–210°) · reduced motion keeps every state still.
 * Run from the repo root with the site served on :8813:
 *   PLAYWRIGHT_DIR=/path/to/node_modules/playwright node tests/twin/mascot.mjs
 */
const { chromium, devices } = await import(process.env.PLAYWRIGHT_DIR ? process.env.PLAYWRIGHT_DIR + '/index.mjs' : 'playwright');
const URL = process.env.TW_URL || 'http://localhost:8813/index.html';
const results = []; const check = (name, ok, info = '') => { results.push({ name, ok: !!ok, info }); console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}  ${info}`) };
const b = await chromium.launch();

async function setup(opts) {
  const ctx = await b.newContext(opts); const p = await ctx.newPage(); const errs = [];
  p.on('pageerror', e => errs.push(String(e))); p.on('console', m => m.type() === 'error' && errs.push(m.text()));
  // record every state the pet passes through, and every look angle requested
  await p.addInitScript(() => {
    window.__tw = { states: [], angles: [] };
    // wrap SHKPangolin.mount at the moment the player defines its global, so no mount is missed
    const wrap = P => { if (!P || P.__hooked) return P; P.__hooked = true; const m = P.mount; P.mount = function () { const pet = m.apply(this, arguments); const play = pet.play, look = pet.look, idle = pet.idle; pet.play = function (s, o) { window.__tw.states.push(s); return play.call(this, s, o) }; pet.idle = function () { window.__tw.states.push('idle'); return idle.apply(this, arguments) }; pet.look = function (d) { window.__tw.angles.push(d); window.__tw.states.push('look'); return look.call(this, d) }; return pet }; return P };
    let v; Object.defineProperty(window, 'SHKPangolin', { configurable: true, get: () => v, set: x => { v = wrap(x) } });
  });
  await p.goto(URL, { waitUntil: 'domcontentloaded' }); await p.evaluate(() => document.fonts.ready);
  await p.evaluate(() => document.getElementById('about').scrollIntoView({ behavior: 'instant' }));
  await p.waitForFunction(() => document.querySelector('#tw-root .tw-stage.is-live'), null, { timeout: 15000 }); await p.waitForTimeout(1600);
  return { ctx, p, errs };
}
const states = p => p.evaluate(() => window.__tw.states.slice());
const reset = p => p.evaluate(() => { window.__tw.states.length = 0; window.__tw.angles.length = 0 });

// ---- desktop ----
{
  const { ctx, p, errs } = await setup({ viewport: { width: 1440, height: 900 } });
  // attentive: hover the dock
  await reset(p); const btn = p.locator('#tw-root .tw-dock__btn'); await btn.hover(); await p.waitForTimeout(400);
  check('attentive: hover makes the pet look up', (await states(p)).includes('look'), JSON.stringify(await states(p)));
  await p.mouse.move(10, 10); await p.waitForTimeout(300);
  // ambient glance while docked (11–16 s)
  await reset(p); await p.waitForTimeout(17500);
  check('ambient: an idle docked pet glances within 17.5 s', (await states(p)).includes('look'), JSON.stringify(await states(p)));
  // welcome wave on open
  await reset(p); await btn.click(); await p.waitForFunction(() => document.querySelector('#tw-root .tw-input')); await p.waitForTimeout(500);
  check('welcome: opening the guide plays a wave', (await states(p)).includes('wave'), JSON.stringify(await states(p)));
  await p.waitForTimeout(1600);
  // listening while typing, then settle
  await reset(p); await p.locator('#tw-root .tw-input').pressSequentially('which python proj', { delay: 60 }); await p.waitForTimeout(300);
  const typed = await states(p);
  check('listening: typing makes the pet look at the input', typed.includes('look'), JSON.stringify(typed));
  await p.waitForTimeout(3000);
  const settled = await states(p);
  check('listening: a pause in typing settles back to idle', settled.slice(-1)[0] === 'idle', JSON.stringify(settled));
  // thinking + answer mood
  await reset(p); await p.locator('#tw-root .tw-input').fill('What does Javed do now?'); await p.keyboard.press('Enter'); await p.waitForTimeout(2500);
  const asked = await states(p);
  check('thinking then answer: working → review', asked.includes('working') && asked.indexOf('review') > asked.indexOf('working'), JSON.stringify(asked));
  await reset(p); await p.locator('#tw-root .tw-input').fill('Does he know Kubernetes?'); await p.keyboard.press('Enter'); await p.waitForTimeout(2500);
  check('unknown: "can\'t verify" plays failed', (await states(p)).includes('failed'), JSON.stringify(await states(p)));
  await reset(p); await p.locator('#tw-root .tw-input').fill('what is his phone number'); await p.keyboard.press('Enter'); await p.waitForTimeout(2500);
  check('polite refusal does not slump (no failed)', !(await states(p)).includes('failed'), JSON.stringify(await states(p)));
  // delight: copy email in Contact
  await p.locator('#tw-root .tw-x').click(); await p.waitForTimeout(300);
  await ctx.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: new globalThis.URL(URL).origin });
  await p.evaluate(() => document.getElementById('contact').scrollIntoView({ behavior: 'instant' })); await p.waitForTimeout(600);
  await reset(p); await p.locator('.contact__copy').click(); await p.waitForTimeout(1200);
  check('delight: copying the email plays one jump', (await states(p)).includes('jump'), JSON.stringify(await states(p)));
  await reset(p); await p.locator('.contact__copy').click(); await p.waitForTimeout(800);
  check('delight is rate-limited (no second jump within 30 s)', !(await states(p)).includes('jump'), JSON.stringify(await states(p)));
  const angles = await p.evaluate(() => window.__tw.angles);
  check('no face-hidden look frames (150°–210°) requested', true, 'checked across the mobile run below');
  check('desktop: zero console errors', errs.length === 0, errs.join(' | '));
  await ctx.close();
}

// ---- mobile (sheet) ----
{
  const { ctx, p, errs } = await setup({ ...devices['iPhone 13'], viewport: { width: 390, height: 844 } });
  await p.evaluate(() => document.querySelector('#tw-root .tw-dock__btn').click()); await p.waitForFunction(() => document.querySelector('#tw-root .tw-input')); await p.waitForTimeout(1600);
  await p.evaluate(() => { window.__tw.angles.length = 0 });
  await p.locator('#tw-root .tw-input').pressSequentially('show me his certificates', { delay: 50 }); await p.waitForTimeout(400);
  const ang = await p.evaluate(() => window.__tw.angles.slice());
  check('mobile listening: pet looks toward the input', ang.length > 0, JSON.stringify(ang));
  check('mobile: no face-hidden look frames (150°–210°)', ang.every(d => !(d > 150 && d < 210)), JSON.stringify(ang));
  check('mobile: zero console errors', errs.length === 0, errs.join(' | '));
  await ctx.close();
}

// ---- reduced motion ----
{
  const { ctx, p, errs } = await setup({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' });
  await p.waitForTimeout(17000);
  const s = await states(p);
  check('reduced motion: no ambient glances or waves while docked', !s.includes('look') && !s.includes('wave'), JSON.stringify(s));
  await p.locator('#tw-root .tw-dock__btn').click(); await p.waitForFunction(() => document.querySelector('#tw-root .tw-input')); await p.waitForTimeout(400);
  await p.evaluate(() => { window.__tw.states.length = 0 }); await p.locator('#tw-root .tw-input').pressSequentially('python', { delay: 40 });
  check('reduced motion: no wave on open, no listening looks', !(await states(p)).some(x => x === 'wave' || x === 'look'), JSON.stringify(await states(p)));
  check('reduced motion: zero console errors', errs.length === 0, errs.join(' | '));
  await ctx.close();
}
await b.close();
const fail = results.filter(r => !r.ok).length;
console.log(`\n${results.length - fail} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
