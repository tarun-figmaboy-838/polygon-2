#!/usr/bin/env node
/* The recap: screen 41, the one look back before the quizzes (src/lesson/recap.js),
   presented the Part 1 Summary Kit's way over the lesson's own background, played with
   its real voice.
     - there is one recap, before the quizzes, and no summary at the end: the last screen
       is Swiftee's line back to Momo
     - every state in order: RECAP_ENTER; the line "Let's recall what we learnt today."; for
       the polygon, its sides, a vertex and an angle CARD_ENTER, CONCEPT_REVEAL, SWIFTEE_ENTER,
       EXPLANATION, READING_PAUSE, SWIFTEE_EXIT, CARD_COLLECT, NEXT_CONCEPT; the line
       "Polygons have different names based on their number of sides."; the same for each
       name, triangle to octagon; then FINAL_SUMMARY and READY. Each line in the lesson's own
       words and recording, word by word
     - nothing a word shows is on the card before the word is said: the corner before
       "point", the lit sides before "segments", the angle before "angle", a name's count
       before its number
     - the bubble stays over Swiftee, inside the stage, clear of the card, the albums and
       her face; the lesson's own Swiftee is out of the way
     - nothing takes a tap but Next, Next is not there before the end, and Next goes on into
       the quizzes
     - on an upright phone and a tablet the whole screen stays in the stage and the ten
       collected cards do not overlap; with reduced motion every state still comes; leaving
       the screen takes the recap away, and coming back starts it again

   node tests/recap.test.cjs          ONLY=play,phones node tests/recap.test.cjs */
const path = require('path');
const fs = require('fs');
const ROOT = path.resolve(__dirname, '..');
const pw = require('playwright');
const { serve } = require('./helpers/serve.cjs');
const ENGINE = process.env.ENGINE || 'chromium';
const ONLY = process.env.ONLY ? process.env.ONLY.split(',') : null;
const OUT = path.join(__dirname, 'output', 'recap');
fs.mkdirSync(OUT, { recursive: true });

const results = [];
const check = (name, ok, detail) => results.push({ name, ok: !!ok, detail });
const noise = /\{\{|attribute/;
const PARTS = ['polygon', 'sides', 'vertex', 'angle'];
const NAMES = ['triangle', 'quad', 'pentagon', 'hexagon', 'heptagon', 'octagon'];
const IDEAS = PARTS.concat(NAMES);
const BEATS = ['CARD_ENTER', 'CONCEPT_REVEAL', 'SWIFTEE_ENTER', 'EXPLANATION', 'READING_PAUSE', 'SWIFTEE_EXIT', 'CARD_COLLECT', 'NEXT_CONCEPT'];
const LAST = 'Now you know everything about polygons. You are ready to help Momo.';
/* each idea's evidence, and the first word that may show it */
const EVIDENCE = {
  vertex: { sel: 'circle[r="11"]', word: 'point' },
  sides: { sel: 'line[stroke="#ffe27a"]', word: 'segments' },
  angle: { sel: 'path[fill="#ffd24a"]', word: 'angle.' }
};
NAMES.forEach((id, i) => { EVIDENCE[id] = { sel: 'text', text: /^[1-8]$/, word: String(i + 3) }; });

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
const recapAt = page => page.evaluate(() => window.__poly.steps().findIndex(s => s.recap));
const toRecap = page => page.evaluate(() => { const g = window.__poly, k = g.steps().findIndex(s => s.recap); g.setState({ k }, () => g.runStep(k, false)); });

/* One sample of the screen, in stage px. Runs in the page. */
function sample(EV) {
  const S = window.PolygonRecap.state();
  const root = document.querySelector('.lsum');
  if (!S.active || !root) return { state: S.state || null };
  const r0 = root.getBoundingClientRect(), f = 1980 / r0.width;
  const R = e => { const q = e.getBoundingClientRect(); return { x: (q.x - r0.x) * f, y: (q.y - r0.y) * f, r: (q.right - r0.x) * f, b: (q.bottom - r0.y) * f }; };
  const hit = (a, b) => a.x < b.r - 1 && b.x < a.r - 1 && a.y < b.b - 1 && b.y < a.b - 1;
  const say = root.querySelector('.lsum-bubble'), box = say;
  const shown = +getComputedStyle(say).opacity > 0.5;
  const cards = [...root.querySelectorAll('.recap-card')];
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
  const guide = document.querySelector('.swiftee-wrap');
  return {
    state: S.state, concept: S.concept, text: S.text, words: words.length, lit: lit.length, litWords: lit,
    bubble: B, inside: !B || (B.x >= 0 && B.y >= 0 && B.r <= 1980 && B.b <= 1113.75),
    overCard: !!(B && active && hit(B, R(active.querySelector('image')))),
    overAlbum: !!(B && album.some(c => hit(B, R(c)))),
    overFace: !!(B && face && hit(B, face)),
    albumN: album.length, next: !!(next && !next.hidden), ev,
    lessonGuide: !!guide && +getComputedStyle(guide).opacity > 0.05
  };
}

const SCENARIOS = {
  /* The whole screen, with its voice, watched every 60 ms. */
  async play(browser, srv) {
    const { page, context, errors } = await open(browser, srv, '?preview=1&bridge=0', {});
    const plan = await page.evaluate(() => window.__poly.steps().map(s => (s.recap ? 'RECAP' : s.sc) + ':' + s.label + ':' + (s.narr || '')));
    const at = plan.findIndex(p => /^RECAP/.test(p)), quiz = plan.findIndex(p => /^C1:/.test(p));
    check('one recap, just before the quizzes; no summary, and the last screen is the line back to Momo',
      at >= 0 && quiz === at + 1 && plan.filter(p => /^RECAP|summary|Summary/i.test(p)).length === 1 &&
      plan[plan.length - 1] === 'END:Finished:' + LAST, plan.slice(-8).join(' | '));
    await toRecap(page);
    const ev = {};
    const t0 = Date.now();
    let prev = null, shots = 0;
    while (Date.now() - t0 < 240000) {
      const s = await page.evaluate(sample, EVIDENCE_JSON).catch(() => null);
      if (!s) break;
      (ev.samples = ev.samples || []).push(s);
      if ((s.state === 'EXPLANATION' || s.state === 'LINE') && s.lit === s.words - 1 && shots < 14) { shots++; await page.screenshot({ path: path.join(OUT, ENGINE + '-' + String(shots).padStart(2, '0') + '-' + s.concept + '.png') }); }
      prev = s;
      if (s.state === 'READY') break;
      await page.waitForTimeout(60);
    }
    const S = ev.samples || [];
    const history = await page.evaluate(() => window.PolygonRecap.state().history);
    const want = ['RECAP_ENTER', 'LINE:recall'].concat(PARTS.flatMap(id => BEATS.map(b => b + ':' + id)), ['LINE:names'],
      NAMES.flatMap(id => BEATS.map(b => b + ':' + id)), ['FINAL_SUMMARY', 'READY']);
    check('every state, in order, and no two at once', history.join(' ') === want.join(' '), history.join(' '));
    const lesson = await page.evaluate(() => window.__poly.recapConcepts());
    const said = lesson.map(c => { const x = S.filter(s => (s.state === 'EXPLANATION' || s.state === 'LINE') && s.concept === c.id).pop(); return x && x.text; });
    check("every line is said in the lesson's own words", said.every((t, i) => t === lesson[i].text), JSON.stringify(said));
    check('it opens on "Let\'s recall what we learnt today." and turns to the names on "Polygons have different names based on their number of sides."',
      lesson[0].text === "Let's recall what we learnt today." && lesson[5].text === 'Polygons have different names based on their number of sides.');
    const rec = await page.evaluate(ts => ts.map(t => !!(window.PolygonRecordedVoice && window.PolygonRecordedVoice.find(t))), lesson.map(c => c.text));
    check('every line has its recording', rec.every(Boolean), JSON.stringify(rec));
    for (const c of lesson) {
      // the samples with this line in the bubble (as it comes up, the bubble still holds the last one)
      const mine = S.filter(s => (s.state === 'EXPLANATION' || s.state === 'LINE') && s.concept === c.id && s.text === c.text);
      const x = mine.map(s => s.lit);
      check(c.id + ': word by word, never the whole line first', x.length > 3 && x[0] < mine[0].words && x.every((n, i) => !i || n >= x[i - 1]), x.join(','));
    }
    for (const [id, e] of Object.entries(EVIDENCE)) {
      const x = S.filter(s => s.concept === id && ['CONCEPT_REVEAL', 'SWIFTEE_ENTER', 'EXPLANATION'].includes(s.state));
      const early = x.filter(s => s.ev[id] && !s.litWords.includes(e.word));
      const later = x.filter(s => s.litWords.includes(e.word));
      check(id + ': its evidence waits for "' + e.word + '", then shows', !early.length && later.some(s => s.ev[id]), early.length + ' early; ' + later.filter(s => s.ev[id]).length + '/' + later.length + ' after');
    }
    const bub = S.filter(s => s.bubble);
    check('the bubble stays inside the stage', bub.every(s => s.inside), JSON.stringify((bub.find(s => !s.inside) || {}).bubble));
    check('the bubble never covers the card, the albums or Swiftee\'s face', bub.every(s => !s.overCard && !s.overAlbum && !s.overFace),
      JSON.stringify(bub.filter(s => s.overCard || s.overAlbum || s.overFace).slice(0, 2).map(s => [s.state, s.concept, s.overCard, s.overAlbum, s.overFace])));
    check("the lesson's own Swiftee is out of the way: one Swiftee on the screen", S.filter(s => s.state).every(s => !s.lessonGuide));
    check('Next is not on the screen before the recap is over', S.filter(s => s.state !== 'READY').every(s => !s.next) && prev && prev.state === 'READY' && prev.next);
    check('ten cards collected, four parts on the left and six names on the right', prev && prev.albumN === 10);
    await page.waitForTimeout(700);
    await page.screenshot({ path: path.join(OUT, ENGINE + '-ready.png') });
    const k = await recapAt(page);
    await page.locator('.lsum .lsum-next').click();
    check('Next goes on into the quizzes', await page.waitForFunction(k => window.__poly.state.k === k + 1 && window.__poly.step().sc === 'C1' && !document.querySelector('.lsum'), k, { timeout: 20000 }).then(() => true, () => false));
    check('no script errors', !errors.length, errors.slice(0, 3).join(' | '));
    await context.close();
  },

  /* An upright phone and a tablet: the screen stays in the lesson's stage. */
  async phones(browser, srv) {
    for (const [tag, vp] of [['phone-port', { width: 390, height: 844 }], ['tablet', { width: 1024, height: 768 }]]) {
      const { page, context, errors } = await open(browser, srv, '?preview=1&bridge=0', { viewport: vp, deviceScaleFactor: 2, hasTouch: true });
      await toRecap(page);
      await page.waitForFunction(() => { const s = window.PolygonRecap.state(); return s.state === 'EXPLANATION' && s.concept === 'polygon' && s.shown > 3; }, null, { timeout: 60000 }).catch(() => {});
      const mid = await page.evaluate(sample, EVIDENCE_JSON);
      const box = await page.evaluate(() => { const st = document.querySelector('[data-lesson]').getBoundingClientRect(), r = document.querySelector('.lsum').getBoundingClientRect(); return { st: [st.x, st.y, st.width, st.height].map(Math.round), r: [r.x, r.y, r.width, r.height].map(Math.round) }; });
      check(tag + ': the recap fills the lesson stage exactly', box.st.join() === box.r.join(), JSON.stringify(box));
      check(tag + ': mid-idea, the bubble is inside the stage and clear of the card and Swiftee\'s face', mid.bubble && mid.inside && !mid.overCard && !mid.overFace, JSON.stringify(mid.bubble));
      await page.screenshot({ path: path.join(OUT, ENGINE + '-' + tag + '-idea.png') });
      await page.evaluate(() => window.PolygonRecap.skipToEnd());
      await page.waitForTimeout(600);
      const nb = await page.locator('.lsum .lsum-next').boundingBox();
      const st = await page.evaluate(() => { const r = document.querySelector('[data-lesson]').getBoundingClientRect(); return { x: r.x, y: r.y, r: r.right, b: r.bottom }; });
      check(tag + ': Next is inside the stage', nb && nb.x >= st.x - 1 && nb.y >= st.y - 1 && nb.x + nb.width <= st.r + 1 && nb.y + nb.height <= st.b + 1, JSON.stringify({ nb, st }));
      const cards = await page.evaluate(() => [...document.querySelectorAll('.lsum .recap-card')].map(c => { const r = c.getBoundingClientRect(); return [r.x, r.y, r.right, r.bottom]; }));
      const overlap = cards.some((a, i) => cards.some((b, j) => j > i && a[0] < b[2] - 2 && b[0] < a[2] - 2 && a[1] < b[3] - 2 && b[1] < a[3] - 2));
      check(tag + ': the ten collected cards do not overlap', cards.length === 10 && !overlap);
      await page.screenshot({ path: path.join(OUT, ENGINE + '-' + tag + '-ready.png') });
      await page.locator('.lsum .lsum-next').tap();
      check(tag + ': a tap on Next goes on into the quizzes', await page.waitForFunction(() => window.__poly.step().sc === 'C1', null, { timeout: 20000 }).then(() => true, () => false));
      check(tag + ': no script errors', !errors.length, errors.slice(0, 2).join(' | '));
      await context.close();
    }
  },

  /* Reduced motion: every state still comes, and it ends on Next. */
  async reduced(browser, srv) {
    const { page, context, errors } = await open(browser, srv, '?preview=1&bridge=0', { reducedMotion: 'reduce' });
    await page.evaluate(() => { window.__sumStates = []; });
    await toRecap(page);
    const done = await page.waitForFunction(() => {
      const s = window.PolygonRecap.state();
      const l = window.__sumStates; const key = s.state + (s.concept ? ':' + s.concept : '');
      if (s.state && l[l.length - 1] !== key) l.push(key);
      return s.state === 'READY';
    }, null, { timeout: 240000, polling: 30 }).then(() => true, () => false);
    const states = await page.evaluate(() => window.__sumStates);
    check('reduced motion: it reaches Next', done);
    check('reduced motion: both lines and every idea are said', IDEAS.every(id => states.includes('EXPLANATION:' + id)) && states.includes('LINE:recall') && states.includes('LINE:names'), states.join(' '));
    check('reduced motion: no script errors', !errors.length, errors.slice(0, 2).join(' | '));
    await context.close();
  },

  /* Leaving the screen takes it away; coming back starts it again; a card takes no tap. */
  async navigation(browser, srv) {
    const { page, context, errors } = await open(browser, srv, '?preview=1&bridge=0&dev=1');
    const k = await recapAt(page);
    await toRecap(page);
    await page.waitForFunction(() => { const s = window.PolygonRecap.state(); return s.state === 'EXPLANATION' && s.concept === 'polygon'; }, null, { timeout: 60000 });
    await page.evaluate(k => { const g = window.__poly; g.setState({ k: k - 1 }, () => g.runStep(k - 1, false)); }, k);
    await page.waitForTimeout(400);
    check('leaving the screen takes the recap away: no layer, no voice, no state', await page.evaluate(() => !document.querySelector('.lsum') && !window.PolygonRecap.state().active));
    await toRecap(page);
    const again = await page.waitForFunction(() => window.PolygonRecap.state().state === 'LINE', null, { timeout: 10000 }).then(() => true, () => false);
    check('coming back starts it from its first line', again && await page.evaluate(() => window.PolygonRecap.state().concept === 'recall' && document.querySelectorAll('.lsum').length === 1));
    await page.evaluate(() => window.PolygonRecap.skipToEnd());
    await page.waitForTimeout(500);
    const box = await page.locator('.lsum .recap-card[data-concept="vertex"]').boundingBox();
    await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
    await page.waitForTimeout(400);
    check('a tap on a collected card does nothing: the recap takes no tap but Next', await page.evaluate(() => window.PolygonRecap.state().state === 'READY' && !window.PolygonRecap.state().speaking));
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
