#!/usr/bin/env node
/* The summary: the lesson's one last screen (src/lesson/summary.js), after the Part 1
   Summary Kit, played with its real voice.
     - there is one summary, and it is the last screen: the old recap screen and the old
       completion grid are gone
     - every state in order, SUMMARY_ENTER, then for each idea CARD_ENTER, CONCEPT_REVEAL,
       SWIFTEE_ENTER, EXPLANATION, READING_PAUSE, SWIFTEE_EXIT, CARD_COLLECT, NEXT_CONCEPT, then
       FINAL_SUMMARY, COMPLETION and READY; the ideas are the lesson's, in the order it taught
       them, each said in its own words and recording, word by word
     - nothing a word shows is on the card before the word is said: the corner before "point"
       or "vertex", the lit sides before "segments", the angle before "angle", the count before
       "5"
     - the collected cards stay as they are while an idea is explained, as in the kit
     - the bubble stays over Swiftee, inside the stage, clear of the card, the album and her face
     - Swiftee's last line is word for word "You know all about polygons now. You are ready to
       help Momo.", after the last idea; Next is not on the screen before it has been said, and
       Next brings up the game's cover
     - on an upright phone and a tablet the whole screen stays in the stage; with reduced
       motion every state still comes; leaving the screen takes the summary away; a tap on a
       collected card says its idea again; without the game (?game=0) it ends on Play again

   node tests/summary.test.cjs          ONLY=play,phones node tests/summary.test.cjs */
const path = require('path');
const fs = require('fs');
const ROOT = path.resolve(__dirname, '..');
const pw = require('playwright');
const { serve } = require('./helpers/serve.cjs');
const ENGINE = process.env.ENGINE || 'chromium';
const ONLY = process.env.ONLY ? process.env.ONLY.split(',') : null;
const OUT = path.join(__dirname, 'output', 'summary');
fs.mkdirSync(OUT, { recursive: true });

const results = [];
const check = (name, ok, detail) => results.push({ name, ok: !!ok, detail });
const noise = /\{\{|attribute/;
const IDEAS = ['closed', 'polygon', 'sides', 'vertex', 'angle', 'still5', 'names'];
const BEATS = ['CARD_ENTER', 'CONCEPT_REVEAL', 'SWIFTEE_ENTER', 'EXPLANATION', 'READING_PAUSE', 'SWIFTEE_EXIT', 'CARD_COLLECT', 'NEXT_CONCEPT'];
const DONE = 'You know all about polygons now. You are ready to help Momo.';
/* each idea's evidence, and the first word that may show it */
const EVIDENCE = {
  vertex: { sel: 'circle[r="11"]', word: 'point' },
  sides: { sel: 'line[stroke="#ffe27a"]', word: 'segments' },
  angle: { sel: 'path[fill="#ffd24a"]', word: 'angle.' },
  still5: { sel: 'text', text: /^[1-5]$/, word: '5' }
};

async function open(browser, srv, query, ctxOpts = {}) {
  const context = await browser.newContext(Object.assign({ viewport: { width: 1440, height: 810 } }, ctxOpts));
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', e => { if (!noise.test(e.message)) errors.push(e.message); });
  page.on('console', m => { if (m.type() === 'error' && !noise.test(m.text()) && !/Failed to load resource/.test(m.text())) errors.push(m.text()); });
  await page.goto(srv.url + '/' + query, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.__poly && window.__poly.state.ready && window.__poly._voiceStarted, null, { timeout: 90000 });
  return { context, page, errors };
}
const toSummary = page => page.evaluate(() => { const g = window.__poly, k = g.steps().length - 1; g.setState({ k }, () => g.runStep(k, false)); });

/* One sample of the screen, in stage px. Runs in the page. */
function sample(EV) {
  const S = window.PolygonSummary.state();
  const root = document.querySelector('.lsum');
  if (!S.active || !root) return { state: S.state || null };
  const r0 = root.getBoundingClientRect(), f = 1980 / r0.width;
  const R = e => { const q = e.getBoundingClientRect(); return { x: (q.x - r0.x) * f, y: (q.y - r0.y) * f, r: (q.right - r0.x) * f, b: (q.bottom - r0.y) * f }; };
  const hit = (a, b) => a.x < b.r - 1 && b.x < a.r - 1 && a.y < b.b - 1 && b.y < a.b - 1;
  const say = root.querySelector('.lsum-bubble'), box = say;
  const shown = +getComputedStyle(say).opacity > 0.5;
  const cards = [...root.querySelectorAll('.summary-card')];
  const active = S.concept && cards.find(c => c.getAttribute('data-concept') === S.concept && !c.getAttribute('transform'));
  const album = cards.filter(c => c.getAttribute('transform'));
  const words = [...root.querySelectorAll('.lsum-bubble .w')];
  const lit = words.filter(w => w.classList.contains('in')).map(w => w.textContent);
  const ev = {};
  for (const [id, e] of Object.entries(EV)) {
    const c = cards.find(k => k.getAttribute('data-concept') === id);
    if (!c) continue;
    const re = e.text ? new RegExp(e.text) : null;
    const els = [...c.querySelectorAll(e.sel)].filter(n => !re || re.test(n.textContent));
    // shown: its own opacity, or its group's (a count, an angle), is up
    ev[id] = els.some(n => { const own = n.getAttribute('opacity'), grp = n.parentElement && n.parentElement.getAttribute('opacity'); return +(own != null ? own : grp != null ? grp : 1) > 0.5; });
  }
  const bird = root.querySelector('.lsum-presenter');
  const birdR = bird && +getComputedStyle(bird).opacity > 0.5 ? R(bird) : null;
  const face = birdR && { x: birdR.x + (birdR.r - birdR.x) * 0.3, y: birdR.y + (birdR.b - birdR.y) * 0.2, r: birdR.x + (birdR.r - birdR.x) * 0.7, b: birdR.y + (birdR.b - birdR.y) * 0.55 };
  const B = shown ? R(box) : null;
  const next = root.querySelector('.lsum-next');
  return {
    state: S.state, concept: S.concept, text: S.text, words: words.length, lit: lit.length, litWords: lit,
    bubble: B, inside: !B || (B.x >= 0 && B.y >= 0 && B.r <= 1980 && B.b <= 1113.75),
    overCard: !!(B && active && hit(B, R(active.querySelector('image')))),
    overAlbum: !!(B && album.some(c => hit(B, R(c)))),
    overFace: !!(B && face && hit(B, face)),
    dimmed: album.length ? album.every(c => c.style.opacity === '0.45' || c.style.opacity === '.45') : null,
    albumN: album.length, next: !!(next && !next.hidden), ev
  };
}

const SCENARIOS = {
  /* The whole screen, with its voice, watched every 60 ms. */
  async play(browser, srv) {
    const { page, context, errors } = await open(browser, srv, '?preview=1&bridge=0', {});
    const plan = await page.evaluate(() => window.__poly.steps().map(s => s.sc + ':' + s.label));
    check('one summary, the last screen: no recap screen before it, no completion grid', plan.filter(p => /SUMMARY|END|Summary|Finished|recap/i.test(p)).join() === 'END:Summary' && /^END/.test(plan[plan.length - 1]), plan.slice(-8).join(' | '));
    await toSummary(page);
    const seen = [], ev = {};
    const t0 = Date.now();
    let prev = null, shots = 0;
    while (Date.now() - t0 < 150000) {
      const s = await page.evaluate(sample, EVIDENCE_JSON).catch(() => null);
      if (!s) break;
      if (!prev || s.state !== prev.state || s.concept !== prev.concept) seen.push(s.state + (s.concept ? ':' + s.concept : ''));
      (ev.samples = ev.samples || []).push(s);
      if (s.state === 'EXPLANATION' && s.lit === s.words - 1 && shots < 12) { shots++; await page.screenshot({ path: path.join(OUT, ENGINE + '-' + String(shots).padStart(2, '0') + '-' + s.concept + '.png') }); }
      prev = s;
      if (s.state === 'READY') break;
      await page.waitForTimeout(60);
    }
    const S = ev.samples || [];
    const history = await page.evaluate(() => window.PolygonSummary.state().history);
    const want = ['SUMMARY_ENTER'].concat(IDEAS.flatMap(id => BEATS.map(b => b + ':' + id)), ['FINAL_SUMMARY', 'COMPLETION', 'READY']);
    check('every state, in order, and no two at once', history.join(' ') === want.join(' '), history.join(' '));
    const lesson = await page.evaluate(() => window.__poly.summaryConcepts().map(c => c.text));
    const said = IDEAS.map(id => { const x = S.filter(s => s.state === 'EXPLANATION' && s.concept === id).pop(); return x && x.text; });
    check("each idea is said in the lesson's own words", said.every((t, i) => t === lesson[i]), JSON.stringify(said));
    const rec = await page.evaluate(ts => ts.map(t => !!(window.PolygonRecordedVoice && window.PolygonRecordedVoice.find(t))), lesson.concat([DONE]));
    check('every line has its recording', rec.every(Boolean), JSON.stringify(rec));
    for (const id of IDEAS) {
      const x = S.filter(s => s.state === 'EXPLANATION' && s.concept === id).map(s => s.lit);
      check(id + ': word by word, never the whole line first', x.length > 3 && x[0] < S.find(s => s.state === 'EXPLANATION' && s.concept === id).words && x.every((n, i) => !i || n >= x[i - 1]), x.join(','));
    }
    for (const [id, e] of Object.entries(EVIDENCE)) {
      const x = S.filter(s => s.concept === id && ['CONCEPT_REVEAL', 'SWIFTEE_ENTER', 'EXPLANATION'].includes(s.state));
      const early = x.filter(s => s.ev[id] && !s.litWords.includes(e.word));
      const later = x.filter(s => s.litWords.includes(e.word));
      check(id + ': its evidence waits for "' + e.word + '", then shows', !early.length && later.some(s => s.ev[id]), early.length + ' early; ' + later.filter(s => s.ev[id]).length + '/' + later.length + ' after');
    }
    const expl = S.filter(s => s.state === 'EXPLANATION');
    check('the collected cards stay as they are while an idea is explained (the kit\'s album)', expl.filter(s => s.albumN).every(s => !s.dimmed), expl.filter(s => s.albumN && s.dimmed).length + ' dimmed');
    const bub = S.filter(s => s.bubble);
    check('the bubble stays inside the stage', bub.every(s => s.inside), JSON.stringify((bub.find(s => !s.inside) || {}).bubble));
    check('the bubble never covers the card, the album or Swiftee\'s face', bub.every(s => !s.overCard && !s.overAlbum && !s.overFace),
      JSON.stringify(bub.filter(s => s.overCard || s.overAlbum || s.overFace).slice(0, 2).map(s => [s.state, s.concept, s.overCard, s.overAlbum, s.overFace])));
    const comp = S.filter(s => s.state === 'COMPLETION' && s.text === DONE);
    check('then, after the last idea, "' + DONE + '", word by word', comp.length > 3 && comp[0].lit < comp[0].words && comp[comp.length - 1].lit >= comp[0].words - 1, comp.map(s => s.lit).join(','));
    check('Next is not on the screen before that line has been said', S.filter(s => s.state !== 'READY').every(s => !s.next) && prev && prev.state === 'READY' && prev.next);
    await page.waitForTimeout(700);
    await page.screenshot({ path: path.join(OUT, ENGINE + '-ready.png') });
    await page.locator('.lsum .lsum-next').click();
    check("Next brings up the game's cover", await page.waitForFunction(() => window.RunnerStage.state && window.RunnerStage.state().shown, null, { timeout: 20000 }).then(() => true, () => false));
    check('no script errors', !errors.length, errors.slice(0, 3).join(' | '));
    await context.close();
  },

  /* An upright phone and a tablet: the screen stays in the lesson's stage. */
  async phones(browser, srv) {
    for (const [tag, vp] of [['phone-port', { width: 390, height: 844 }], ['tablet', { width: 1024, height: 768 }]]) {
      const { page, context, errors } = await open(browser, srv, '?preview=1&bridge=0', { viewport: vp, deviceScaleFactor: 2, hasTouch: true });
      await toSummary(page);
      await page.waitForFunction(() => { const s = window.PolygonSummary.state(); return s.state === 'EXPLANATION' && s.concept === 'polygon' && s.shown > 3; }, null, { timeout: 60000 }).catch(() => {});
      const mid = await page.evaluate(sample, EVIDENCE_JSON);
      const box = await page.evaluate(() => { const st = document.querySelector('[data-lesson]').getBoundingClientRect(), r = document.querySelector('.lsum').getBoundingClientRect(); return { st: [st.x, st.y, st.width, st.height].map(Math.round), r: [r.x, r.y, r.width, r.height].map(Math.round) }; });
      check(tag + ': the summary fills the lesson stage exactly', box.st.join() === box.r.join(), JSON.stringify(box));
      check(tag + ': mid-idea, the bubble is inside the stage and clear of the card and Swiftee\'s face', mid.bubble && mid.inside && !mid.overCard && !mid.overFace, JSON.stringify(mid.bubble));
      await page.screenshot({ path: path.join(OUT, ENGINE + '-' + tag + '-idea.png') });
      await page.evaluate(() => window.PolygonSummary.skipToEnd());
      await page.waitForTimeout(600);
      const nb = await page.locator('.lsum .lsum-next').boundingBox();
      const st = await page.evaluate(() => { const r = document.querySelector('[data-lesson]').getBoundingClientRect(); return { x: r.x, y: r.y, r: r.right, b: r.bottom }; });
      check(tag + ': Next is inside the stage', nb && nb.x >= st.x - 1 && nb.y >= st.y - 1 && nb.x + nb.width <= st.r + 1 && nb.y + nb.height <= st.b + 1, JSON.stringify({ nb, st }));
      const cards = await page.evaluate(() => [...document.querySelectorAll('.lsum .summary-card')].map(c => { const r = c.getBoundingClientRect(); return [r.x, r.y, r.right, r.bottom]; }));
      const overlap = cards.some((a, i) => cards.some((b, j) => j > i && a[0] < b[2] - 2 && b[0] < a[2] - 2 && a[1] < b[3] - 2 && b[1] < a[3] - 2));
      check(tag + ': the seven collected cards do not overlap', cards.length === 7 && !overlap);
      await page.screenshot({ path: path.join(OUT, ENGINE + '-' + tag + '-ready.png') });
      await page.locator('.lsum .lsum-next').tap();
      check(tag + ': a tap on Next brings up the game', await page.waitForFunction(() => window.RunnerStage.state().shown, null, { timeout: 20000 }).then(() => true, () => false));
      check(tag + ': no script errors', !errors.length, errors.slice(0, 2).join(' | '));
      await context.close();
    }
  },

  /* Reduced motion: every state still comes, and it ends on Next. */
  async reduced(browser, srv) {
    const { page, context, errors } = await open(browser, srv, '?preview=1&bridge=0', { reducedMotion: 'reduce' });
    await page.evaluate(() => { window.__sumStates = []; });
    await toSummary(page);
    const done = await page.waitForFunction(() => {
      const s = window.PolygonSummary.state();
      const l = window.__sumStates; const key = s.state + (s.concept ? ':' + s.concept : '');
      if (s.state && l[l.length - 1] !== key) l.push(key);
      return s.state === 'READY';
    }, null, { timeout: 150000, polling: 30 }).then(() => true, () => false);
    const states = await page.evaluate(() => window.__sumStates);
    check('reduced motion: it reaches Next', done);
    check('reduced motion: every idea is explained, then the last line', IDEAS.every(id => states.includes('EXPLANATION:' + id)) && states.includes('COMPLETION'), states.join(' '));
    check('reduced motion: no script errors', !errors.length, errors.slice(0, 2).join(' | '));
    await context.close();
  },

  /* Leaving the screen takes it away; coming back starts it again; a card says its idea again. */
  async navigation(browser, srv) {
    const { page, context, errors } = await open(browser, srv, '?preview=1&bridge=0&game=0&dev=1');
    await toSummary(page);
    await page.waitForFunction(() => { const s = window.PolygonSummary.state(); return s.state === 'EXPLANATION' && s.concept === 'polygon'; }, null, { timeout: 60000 });
    await page.evaluate(() => { const g = window.__poly; g.setState({ k: 40 }, () => g.runStep(40, false)); });
    await page.waitForTimeout(400);
    check('leaving the screen takes the summary away: no layer, no voice, no state', await page.evaluate(() => !document.querySelector('.lsum') && !window.PolygonSummary.state().active));
    await toSummary(page);
    const again = await page.waitForFunction(() => window.PolygonSummary.state().state === 'CARD_ENTER', null, { timeout: 10000 }).then(() => true, () => false);
    check('coming back starts it from its first idea', again && await page.evaluate(() => window.PolygonSummary.state().concept === 'closed' && document.querySelectorAll('.lsum').length === 1));
    await page.evaluate(() => window.PolygonSummary.skipToEnd());
    await page.waitForTimeout(500);
    const box = await page.locator('.lsum .summary-card[data-concept="vertex"]').boundingBox();
    await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
    const replay = await page.waitForFunction(() => { const s = window.PolygonSummary.state(); return s.state === 'CARD_REPLAY' && s.concept === 'vertex'; }, null, { timeout: 5000 }).then(() => true, () => false);
    const rest = await page.evaluate(() => [...document.querySelectorAll('.lsum .summary-card')].filter(c => c.getAttribute('data-concept') !== 'vertex').every(c => c.style.opacity === '0.42' || c.style.opacity === '.42'));
    check('a tap on a collected card says its idea again, the others resting', replay && rest);
    const back = await page.waitForFunction(() => window.PolygonSummary.state().state === 'READY', null, { timeout: 20000 }).then(() => true, () => false);
    check('...and it comes back to Next', back);
    const btn = page.getByRole('button', { name: 'Play again', exact: true });
    check('without the game (?game=0) it ends on Play again', await btn.count() === 1);
    await btn.click();
    check('Play again starts the lesson over', await page.waitForFunction(() => window.__poly.state.k === 0 && !document.querySelector('.lsum'), null, { timeout: 10000 }).then(() => true, () => false));
    check('navigation: no script errors', !errors.length, errors.slice(0, 2).join(' | '));
    await context.close();
  }
};
const EVIDENCE_JSON = Object.fromEntries(Object.entries(EVIDENCE).map(([k, v]) => [k, { sel: v.sel, text: v.text ? v.text.source : null }]));

(async () => {
  const srv = await serve(ROOT);
  const args = ENGINE === 'chromium' ? ['--autoplay-policy=no-user-gesture-required'] : [];
  const browser = await pw[ENGINE].launch({ args });
  for (const [name, fn] of Object.entries(SCENARIOS)) {
    if (ONLY && !ONLY.includes(name)) continue;
    try { await fn(browser, srv); } catch (e) { check(name + ' (crashed)', false, e.message.split('\n')[0]); }
  }
  await browser.close();
  await srv.close();
  results.forEach(r => console.log((r.ok ? 'PASS ' : 'FAIL ') + r.name + (r.detail !== undefined && !r.ok ? '  — ' + r.detail : '')));
  const failed = results.filter(r => !r.ok).length;
  console.log(`${results.length - failed}/${results.length} passed (${ENGINE})`);
  process.exit(failed ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
