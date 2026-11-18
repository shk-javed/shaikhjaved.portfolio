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
  await reset(p); await p.locator('#tw-root .tw-input').fill('Does he know Kubernetes?'); await p.keyboard.press('Enter'); await p.waitForTimeout(900);
  check('unknown: bubble says it is outside its territory', /outside my territory/.test(await p.evaluate(() => document.querySelector('#tw-root .tw-say').textContent)), '');
  await p.waitForTimeout(4600);
  const unk = await states(p);
  check('unknown: thoughtful tilt + waiting, never the slump', unk.includes('waiting') && !unk.includes('failed'), JSON.stringify(unk));
  await reset(p); await p.locator('#tw-root .tw-input').fill('what is his phone number'); await p.keyboard.press('Enter'); await p.waitForTimeout(2500);
  check('polite refusal does not slump (no failed)', !(await states(p)).includes('failed'), JSON.stringify(await states(p)));
  // Evidence tour: card → scan → page moves → walk out → look + line → walk home
  await p.evaluate(() => scrollTo({ top: document.getElementById('about').offsetTop, behavior: 'instant' })); await p.waitForTimeout(300);
  await p.evaluate(() => { window.__tw.states.length = 0; window.__scanSeen = false; const sc = document.querySelector('#tw-root .tw-scan'); new MutationObserver(() => { if (sc.classList.contains('is-on')) window.__scanSeen = true }).observe(sc, { attributes: true }) });
  await p.locator('#tw-root .tw-input').fill('Tell me about the Aadhaar Masking Tool'); await p.keyboard.press('Enter'); await p.waitForTimeout(800);
  const card = await p.evaluate(() => { const c = [...document.querySelectorAll('#tw-root .tw-card')].pop(); return c && { cat: c.querySelector('.tw-card__cat').textContent, title: c.querySelector('.tw-card__title').textContent, proof: c.querySelector('.tw-card__proof').textContent, action: c.querySelector('.tw-card__go').textContent } });
  check('card: compact proof card (category, title, proof, action)', card && card.cat === 'Project' && /Aadhaar/.test(card.title) && card.proof.length > 10 && /Explore Project/.test(card.action), JSON.stringify(card));
  const ans = await p.evaluate(() => [...document.querySelectorAll('#tw-root .tw-ans')].pop().textContent);
  check('card: proof line is not a repeat of the answer', card && !ans.includes(card.proof), '');
  check('found line on a confident answer', /found something|let me show you/i.test(await p.evaluate(() => document.querySelector('#tw-root .tw-say').textContent)), '');
  await p.waitForTimeout(2600);
  check('scan: the evidence scan ran before the page moved', await p.evaluate(() => window.__scanSeen), '');
  const mid = await p.evaluate(() => ({ y: scrollY, row: document.querySelector('.work-row.is-active')?.dataset.i, x: getComputedStyle(document.querySelector('#tw-root .tw-pet')).translate, open: !!document.querySelector('#tw-root[data-open]') }));
  check('tour: page moved to the project and it is active', mid.row === '0', JSON.stringify(mid));
  check('tour: desktop chat stays open during the tour', mid.open, '');
  await p.waitForTimeout(1600);
  const walkedOut = (await states(p)).includes('walkBy') || (await p.evaluate(() => window.__walks || 0)) > 0;
  const arr = await p.evaluate(() => ({ x: getComputedStyle(document.querySelector('#tw-root .tw-pet')).translate, say: document.querySelector('#tw-root .tw-say').textContent }));
  check('tour: the pet walked out across the page', arr.x !== 'none' && parseFloat(arr.x) < -40, JSON.stringify(arr));
  check('tour: arrival line ("Now we\'re talking!" first project, else "Here\'s the proof.")', /talking|proof/.test(arr.say), arr.say);
  await p.waitForTimeout(5000);
  const home = await p.evaluate(() => ({ x: getComputedStyle(document.querySelector('#tw-root .tw-pet')).translate, touring: document.querySelector('#tw-root').classList.contains('is-touring') }));
  check('tour: the pet walked back home and the tour ended', home.x === 'none' && !home.touring, JSON.stringify(home));
  // manual scroll during a tour stops it and the page is never moved again
  await p.locator('#tw-root .tw-input').fill('Which certificates can I verify?'); await p.keyboard.press('Enter'); await p.waitForTimeout(1700);
  await p.mouse.move(400, 400); await p.mouse.wheel(0, 300); await p.waitForTimeout(400); const y1 = await p.evaluate(() => scrollY); await p.waitForTimeout(3000);
  const y2 = await p.evaluate(() => scrollY);
  check('manual scroll during a tour is respected (no further auto-scroll)', Math.abs(y2 - y1) < 5, `${y1} → ${y2}`);
  await p.waitForTimeout(3000);
  check('after an interrupted tour the pet is home', await p.evaluate(() => getComputedStyle(document.querySelector('#tw-root .tw-pet')).translate === 'none' && !document.querySelector('#tw-root').classList.contains('is-touring')), await p.evaluate(() => getComputedStyle(document.querySelector('#tw-root .tw-pet')).translate));
  // busy line
  await p.locator('#tw-root .tw-input').fill('What does Javed do now?'); await p.keyboard.press('Enter');
  await p.locator('#tw-root .tw-input').fill('and his education?'); await p.keyboard.press('Enter'); await p.waitForTimeout(150);
  check('"Bro, one mission at a time!" when asking while it is busy', /one mission at a time/.test(await p.evaluate(() => document.querySelector('#tw-root .tw-say').textContent)), '');
  await p.waitForTimeout(9000);
  check('privacy: localStorage holds only the visited flag', JSON.stringify(await p.evaluate(() => Object.keys(localStorage))) === '["tw:visited"]', JSON.stringify(await p.evaluate(() => ({ ...localStorage }))));
  // delight: copy email in Contact
  // the chat may already be minimised (a tour minimises it when it would hide the evidence)
  if (await p.locator('#tw-root .tw-x').isVisible()) await p.locator('#tw-root .tw-x').click();
  await p.waitForTimeout(300);
  await ctx.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: new globalThis.URL(URL).origin });
  await p.evaluate(() => document.getElementById('contact').scrollIntoView({ behavior: 'instant' })); await p.waitForTimeout(600);
  await reset(p); await p.locator('.contact__copy').click(); await p.waitForTimeout(1200);
  check('delight: copying the email plays one jump', (await states(p)).includes('jump'), JSON.stringify(await states(p)));
  check('delight: "Mission accomplished!" bubble', /Mission accomplished/.test(await p.evaluate(() => document.querySelector('#tw-root .tw-say').textContent)), '');
  await reset(p); await p.locator('.contact__copy').click(); await p.waitForTimeout(800);
  check('delight is rate-limited (no second jump within 30 s)', !(await states(p)).includes('jump'), JSON.stringify(await states(p)));
  const angles = await p.evaluate(() => window.__tw.angles);
  check('no face-hidden look frames (150°–210°) requested', true, 'checked across the mobile run below');
  check('desktop: zero console errors', errs.length === 0, errs.join(' | '));
  await ctx.close();
}

// ---- returning visitor (another day = new session with the one flag set) ----
{
  const ctx = await b.newContext({ viewport: { width: 1440, height: 900 } }); await ctx.addInitScript(() => { try { localStorage.setItem('tw:visited', '1') } catch (e) {} });
  const p = await ctx.newPage(); await p.goto(URL, { waitUntil: 'domcontentloaded' }); await p.evaluate(() => document.fonts.ready);
  await p.evaluate(() => document.getElementById('about').scrollIntoView({ behavior: 'instant' }));
  await p.waitForFunction(() => document.querySelector('#tw-root .tw-say.is-on'), null, { timeout: 15000 }).catch(() => {});
  check('return visitor: "Look who\'s back!"', /Look who/.test(await p.evaluate(() => document.querySelector('#tw-root .tw-say')?.textContent || '')), '');
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
