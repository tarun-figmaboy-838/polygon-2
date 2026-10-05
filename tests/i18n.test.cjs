#!/usr/bin/env node
/* The page in another language: ?lan=hi, and mr, te, gu, od (src/i18n/i18n.js).
     - src/i18n/locales.json: every language has every key; its {placeholders} and <strong>
       marks are whole; no English is left in a translation (bar Escape, a key's name); each
       language ends a sentence with its own full stop (। in Hindi and Odia)
     - every line the learner can be shown, in each language: the lesson's sentences, its
       buttons, labels, feedback and screen-reader messages (the ones made up as it goes too),
       the recap's, Swiftee's over the game, and the game's tutorial, plank and controls
     - the page itself: <html lang>, the title, the language's own font loaded and in use
     - the lesson's screens walked: no English word on the stage, in its text or its labels
       (Hindi every screen; the others a sample, or every screen with WALK=all)
     - the game in Hindi: the opening's tutorial and Swiftee's lines, the snow into the lesson;
       on the return Swiftee at the ditch, the plank's line and its question; no English in it
     - ?lan=xx (not one of ours) leaves the page in English, and English is untouched

   node tests/i18n.test.cjs        LANGS=hi,te WALK=all node tests/i18n.test.cjs */
const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..');
const pw = require('playwright');
const { serve } = require('./helpers/serve.cjs');
const ENGINE = process.env.ENGINE || 'chromium';
const LANGS = (process.env.LANGS || 'hi,mr,te,gu,od').split(',').filter(Boolean);
const WALK_ALL = process.env.WALK === 'all';

const results = [];
const check = (name, ok, detail) => results.push({ name, ok: !!ok, detail });
const noise = /\{\{|attribute/;
const LATIN = /[A-Za-z][A-Za-z'’-]+/g;
const ALLOWED = /^(Escape)$/;
const english = s => (String(s || '').match(LATIN) || []).filter(w => !ALLOWED.test(w));

/* ------------------------------------------------------------ 1. the JSON */
const L = JSON.parse(fs.readFileSync(path.join(ROOT, 'src/i18n/locales.json'), 'utf8'));
const KEYS = Object.keys(L.en);
check('locales.json: English and the five languages', ['en', 'hi', 'mr', 'te', 'gu', 'od'].every(c => L[c] && typeof L[c] === 'object') &&
  L.defaultLanguage === 'en', Object.keys(L).join(', '));
for (const c of ['hi', 'mr', 'te', 'gu', 'od']) {
  const bad = [];
  for (const k of KEYS) {
    const en = L.en[k], v = L[c][k];
    if (typeof v !== 'string' || !v.trim()) { bad.push(k + ': missing'); continue; }
    const ph = s => (s.match(/\{[a-zA-Z]+\}/g) || []).sort().join();
    if (ph(en) !== ph(v)) bad.push(k + ': placeholders differ');
    if ((v.match(/<strong>/g) || []).length !== (v.match(/<\/strong>/g) || []).length || /<(?!\/?strong>)/.test(v)) bad.push(k + ': marks');
    const words = english(v.replace(/<[^>]+>|\{[a-zA-Z]+\}/g, ''));
    if (words.length) bad.push(k + ': English left: ' + words.join(' '));
    if (/[^.]\.$/.test(en.trim()) && !en.trim().endsWith('...')) {
      const stop = c === 'hi' || c === 'od' ? '।' : '.';
      if (!v.replace(/<\/?strong>/g, '').trim().endsWith(stop)) bad.push(k + ': ends without ' + stop);
    }
    if (/[!?]$/.test(en.trim()) && !v.replace(/<\/?strong>/g, '').trim().endsWith(en.trim().slice(-1))) bad.push(k + ': ends without ' + en.trim().slice(-1));
  }
  const extra = Object.keys(L[c]).filter(k => !(k in L.en));
  check('locales.json (' + c + '): every key, whole and in the language', !bad.length && !extra.length, bad.concat(extra.map(k => k + ': not in English')).join(' | '));
}

/* ------------------------------------------------------------ 2. every line the learner can be shown */
/* the sentences and labels written in the code, as they are written there */
const read = f => fs.readFileSync(path.join(ROOT, f), 'utf8');
function literals(src) {
  src = src.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:'"\\])\/\/[^\n]*/g, '$1');
  const out = new Set();
  const re = /'((?:[^'\\\n]|\\.)*)'|"((?:[^"\\\n]|\\.)*)"/g;
  let m;
  while ((m = re.exec(src))) {
    const s = (m[1] != null ? m[1] : m[2]).replace(/\\'/g, "'").replace(/\\"/g, '"');
    if (!/[A-Za-z]{2}/.test(s) || /[{}<>#;=\/\\_@$()[\]]|px\b|^\s|\s$|^[a-z.]/.test(s) || !/^[A-Z]/.test(s)) continue;
    if (/^[A-Z0-9_]+$/.test(s) && s !== 'POLYGON') continue;
    if (/·|^\d\d |^CFU \d$/.test(s)) continue;                       // the review labels (?dev=1)
    out.add(s);
  }
  return [...out];
}
/* written in the code but never shown: key names, class and state names, the page's
   description for search engines, a console message */
const NOT_SHOWN = new Set(['ArrowDown', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'Enter', 'Escape', 'Tab', 'Class', 'Cued', 'Feedback',
  'Hidden', 'Retired', 'Role', 'Finished', 'Drawing audio unavailable', 'Audio unavailable', 'Nunito, sans-serif',
  'Explore shapes, sides, vertices, and angles with Swiftee in a playful polygon adventure.']);
const LESSON_LINES = literals(read('index.html')).filter(s => !NOT_SHOWN.has(s));
const field = (src, name) => [...src.matchAll(new RegExp(name + ":\\s*(['\"])((?:(?!\\1).)+)\\1", 'g'))].map(m => m[2]);
const GAME_LINES = [...new Set([
  ...field(read('game/js/tutorial.js'), 'text'),
  ...field(read('game/js/engine.js'), 'instruction').filter(s => s !== 'Cut the shape along its diagonal.'),   // the parked level 2
  'Resume', 'Pause', 'Sound on', 'Sound off'
])];
const SWIFTEE_LINES = field(read('src/runner/runner-stage.js'), 'text').concat(['Frozen Rush', 'Help Momo cross the Frozen Pass']);
const RECAP_LINES = ['Next', "Let's recall what we learnt today"];
/* and the ones made up as the lesson goes */
const MADE = ['Side selected. Choose a question-mark target. Press Escape to cancel.', 'Vertex selection cancelled.',
  'Angle correctly placed.', 'Side, correctly placed', 'Correct. Placed in the polygon column. 1 of 4 sorted.',
  'Correct. Placed in the not a polygon column. 4 of 4 sorted.', 'Not the hexagon column. The figure is back with the others.',
  'Option A. Figure with straight segments. Closed boundary.', 'Option D. Figure containing curved lines. Open boundary.',
  'Figure with straight segments. Open boundary.', 'Figure 2: Curved', '5 sides', '1 side', 'Drag any vertex'];
check('the lines are found in the code (lesson ' + LESSON_LINES.length + ', game ' + GAME_LINES.length + ')', LESSON_LINES.length > 100 && GAME_LINES.length >= 15,
  LESSON_LINES.length + ' / ' + GAME_LINES.length);

async function open(browser, srv, query) {
  const page = await browser.newPage({ viewport: { width: 1440, height: 810 } });
  const errors = [];
  page.on('pageerror', e => { if (!noise.test(e.message)) errors.push(e.message); });
  page.on('console', m => { if (m.type() === 'error' && !noise.test(m.text())) errors.push(m.text()); });
  const before = srv.requests.length;
  await page.goto(srv.url + '/' + query, { waitUntil: 'domcontentloaded' });
  const missing = () => srv.requests.slice(before).filter(r => r.status !== 200).map(r => r.status + ' ' + r.path);
  return { page, errors, missing };
}
/* what the learner can see on the lesson's stage: its text, and the names read out for it */
const onStage = page => page.evaluate(() => {
  const root = document.querySelector('.game-viewport'), out = [];
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  while (walker.nextNode()) {
    const n = walker.currentNode, el = n.parentElement;
    if (!el || el.closest('.canvas-navigation,[hidden]') || /^(SCRIPT|STYLE)$/.test(el.nodeName)) continue;
    const cs = getComputedStyle(el);
    if (cs.display === 'none' || cs.visibility === 'hidden' || !n.nodeValue.trim()) continue;
    out.push(n.nodeValue.trim());
  }
  root.querySelectorAll('[aria-label],[title],[alt]').forEach(el => {
    if (el.closest('.canvas-navigation')) return;
    for (const a of ['aria-label', 'title', 'alt']) if (el.getAttribute(a)) out.push(el.getAttribute(a));
  });
  return out;
});
/* a screen as the dev menu opens one (src/lesson/screen-navigator.js) */
const goTo = (page, index) => page.evaluate(i => {
  const game = window.__poly, step = game.steps()[i];
  game.unlockAudio();
  game.setState({ k: i, placed: {}, sortAt: {}, dd: [null, null, null, null], ddWrong: [false, false, false, false], userPts: null, dragged: false,
    drawn: step.sc === 'S1' && !['point', 'draw'].includes(step.ph), numsB: 0 }, () => game.runStep(i, false));
}, index);

(async () => {
  const srv = await serve(ROOT);
  const browser = await pw[ENGINE].launch(ENGINE === 'chromium' ? { args: ['--autoplay-policy=no-user-gesture-required'] } : {});

  for (const lan of LANGS) {
    const a = await open(browser, srv, '?preview=1&game=0&lan=' + lan);
    await a.page.waitForFunction(() => window.__poly && window.__poly.state.ready, null, { timeout: 60000 });
    const page = await a.page.evaluate(() => ({ on: PolygonI18n.on, code: PolygonI18n.code, lang: document.documentElement.lang, title: document.title,
      cls: document.documentElement.classList.contains('i18n'), sample: (window.PolygonI18n.t('Check') || '') }));
    const tag = lan === 'od' ? 'or' : lan;
    check(lan + ': the page is in the language: <html lang="' + tag + '">, its title', page.on && page.lang === tag && page.cls && page.title === L[lan].lessonTitle, JSON.stringify(page));
    // the language's face, added under each family for its own script's characters, and loaded
    const fonts = await a.page.evaluate(() => ['Nunito', 'Baloo 2', 'Fredoka'].map(family =>
      [...document.fonts].some(f => f.family.replace(/["']/g, '') === family && f.unicodeRange !== 'U+0-10FFFF' && f.status === 'loaded')));
    check(lan + ': its own font is loaded under Nunito, Baloo 2 and Fredoka', fonts.every(Boolean), JSON.stringify(fonts));

    /* every line, through the page's own t() */
    const lines = { lesson: LESSON_LINES, made: MADE, recap: RECAP_LINES, swiftee: SWIFTEE_LINES, game: GAME_LINES };
    const shown = await a.page.evaluate(all => {
      const out = {};
      for (const k of Object.keys(all)) out[k] = all[k].map(s => [s, PolygonI18n.t(s)]);
      return out;
    }, lines);
    for (const k of Object.keys(shown)) {
      const left = shown[k].filter(([s, t]) => t === s || english(t).length).map(([s, t]) => s + (t === s ? '' : ' → ' + t));
      check(lan + ': every ' + k + ' line is shown in the language (' + shown[k].length + ')', !left.length, left.join(' | '));
    }
    /* key words carry their ink: the orange ones are open, gap and curved */
    const inks = await a.page.evaluate(() => {
      const t = s => PolygonI18n.t(s), m = s => PolygonI18n.marks(t(s)) || [];
      return { open: m('Is it open or closed?'), gap: m('There are no gaps in its boundary.'), curved: m('Some are straight and some are curved.') };
    });
    check(lan + ': its key words are marked, open / gap / curved in orange', inks.open.includes('open') && inks.open.includes('term') &&
      inks.gap.includes('gap') && inks.curved.includes('curved'), JSON.stringify(inks));

    /* the screens */
    const steps = await a.page.evaluate(() => window.__poly.steps().length);
    const sample = WALK_ALL || lan === 'hi' ? [...Array(steps).keys()] : [4, 13, 16, 22, 23, 35, 40, 42, 45, steps - 1];
    const left = [];
    for (const k of sample) {
      await goTo(a.page, k);
      const t0 = Date.now();
      await a.page.waitForTimeout(800);
      while (Date.now() - t0 < 9000) {
        const st = await a.page.evaluate(() => ({ s: !!window.__poly.state.speaking, r: window.__poly.state.wordReveal })).catch(() => ({}));
        if (!st.s || st.r === 'complete') break;
        await a.page.waitForTimeout(200);
      }
      const seen = await onStage(a.page);
      const words = [...new Set(seen.flatMap(english))];
      if (words.length) left.push((k + 1) + ': ' + words.join(' ') + '  «' + seen.filter(s => english(s).length).slice(0, 3).join(' / ').slice(0, 120) + '»');
    }
    check(lan + ': no English on the lesson\'s stage, ' + (sample.length === steps ? 'every screen' : sample.length + ' screens'), !left.length, left.join(' | '));
    check(lan + ': no script errors, every request found', !a.errors.length && !a.missing().length, a.errors.concat(a.missing()).join(' | '));
    await a.page.close();
  }

  /* ------------------------------------------------------------ 3. the game, in Hindi */
  if (LANGS.includes('hi')) {
    const H = L.hi, plain = s => s.replace(/<\/?strong>/g, '');
    const sentences = s => (plain(s).match(/[^.!?।]+[.!?।]*/g) || []).map(x => x.trim()).filter(Boolean);
    const OPENING = [H.gameMeet, H.gameGoal, H.gameWatchOut, H.gameTapJump, H.gamePathBroken].flatMap(sentences);
    const a = await open(browser, srv, '?intro=1&lan=hi');
    const up = await a.page.waitForFunction(() => window.RunnerStage && RunnerStage.state().opening.said.includes('ready'), null, { timeout: 90000 }).then(() => true, () => false);
    const f = a.page.frames().find(x => /lesson=intro/.test(x.url()));
    check('game (hi): the frame is asked for in Hindi', !!f && /[?&]lan=hi\b/.test(f.url()), f && f.url());
    const dom = f && await f.evaluate(() => {
      const out = [];
      const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
      while (walker.nextNode()) { const n = walker.currentNode; if (n.parentElement && !/^(SCRIPT|STYLE|NOSCRIPT)$/.test(n.parentElement.nodeName) && n.nodeValue.trim()) out.push(n.nodeValue.trim()); }
      document.querySelectorAll('[aria-label],[title]').forEach(el => out.push(el.getAttribute('aria-label') || el.getAttribute('title')));
      return { out, title: document.title, lang: document.documentElement.lang };
    });
    const domLeft = dom ? [...new Set(dom.out.flatMap(english))] : ['no frame'];
    check('game (hi): its page is in Hindi: title, labels and buttons', up && dom && dom.lang === 'hi' && dom.title === H.gamePageTitle && !domLeft.length, domLeft.join(' ') + ' ' + (dom && dom.title));
    await f.click('#btn-play');
    const seen = [];
    let asked = false;
    const t0 = Date.now();
    while (Date.now() - t0 < 150000) {
      const st = await a.page.evaluate(() => RunnerStage.state().opening.phase);
      if (st !== 'OPENING_COVER' && st !== 'OPENING_TUTORIAL') break;
      const r = await f.evaluate(() => { const lay = document.getElementById('tutorial'), t = document.getElementById('tut-text'); return lay && !lay.hidden && t ? t.textContent.trim() : ''; }).catch(() => '');
      if (r && seen[seen.length - 1] !== r) seen.push(r);
      if (r === plain(H.gameTapJump)) asked = true;
      if (asked) await f.evaluate(() => window.iceAgeGame.jump && window.iceAgeGame.jump()).catch(() => {});
      await a.page.waitForTimeout(150);
    }
    check('game (hi): the tutorial\'s lines, in Hindi, in order, as far as the broken path', JSON.stringify(seen) === JSON.stringify(OPENING), seen.join(' > '));
    await a.page.waitForFunction(() => window.SwifteeCameo.state().history.filter(h => h.event === 'said').length >= 2, null, { timeout: 40000 }).catch(() => {});
    const cameo = await a.page.evaluate(() => ({ text: (document.querySelector('.cameo-say-text') || {}).textContent || '', said: window.SwifteeCameo.state().history.filter(h => h.event === 'say') }));
    check('game (hi): Swiftee over the game says her lines in her recorded voice, shown in Hindi', cameo.said.length === 2 && cameo.said.every(h => h.voice) &&
      cameo.text.trim() === plain(H.swifteeLearnFirst), JSON.stringify(cameo));
    const lesson = await a.page.waitForFunction(() => window.__poly._voiceStarted && window.__poly.state.k === 0 && RunnerStage.state().opening.phase === 'OPENING_DONE', null, { timeout: 30000 }).then(() => true, () => false);
    check('game (hi): the snow carries it on into the lesson, by itself', lesson);
    check('game (hi): opening, no script errors', !a.errors.length, a.errors.join(' | '));
    await a.page.close();

    const b = await open(browser, srv, '?preview=1&lan=hi');
    await b.page.waitForFunction(() => window.__poly && window.__poly.state.ready, null, { timeout: 30000 });
    await b.page.evaluate(() => { const g = window.__poly, k = g.steps().length - 1; g.setState({ k }, () => g.runStep(k, false)); });
    await b.page.waitForFunction(() => RunnerStage.state().phase === 'FROZEN_RUSH_RUNNING', null, { timeout: 120000 }).catch(() => {});
    const g = b.page.frames().find(x => /lesson=end/.test(x.url()));
    check('game (hi): the return is asked for in Hindi', !!g && /[?&]lan=hi\b/.test(g.url()), g && g.url());
    const back = [];
    let activeAt = 0;
    const t1 = Date.now();
    while (g && Date.now() - t1 < 150000) {
      const r = await g.evaluate(() => { const G = window.iceAgeGame.debug(), i = document.getElementById('instruction'), t = document.getElementById('instruction-text');
        return { plank: i && !i.hidden && t ? t.textContent.trim() : '', state: G.state }; }).catch(() => null);
      const c = await b.page.evaluate(() => (window.SwifteeCameo.state().on && document.querySelector('.cameo-say-text') ? document.querySelector('.cameo-say-text').textContent.trim() : ''));
      for (const line of [c && 'swiftee: ' + c, r && r.plank]) if (line && line !== 'swiftee: ' && back[back.length - 1] !== line) back.push(line);
      if (r && r.state === 'PHASE_ACTIVE' && !activeAt) activeAt = Date.now();
      if (activeAt && Date.now() - activeAt > 6000) break;
      await g.evaluate(() => window.iceAgeGame.jump && window.iceAgeGame.jump()).catch(() => {});
      await b.page.waitForTimeout(150);
    }
    check('game (hi): at the ditch Swiftee, then the plank\'s line and its question, all in Hindi',
      JSON.stringify(back) === JSON.stringify(['swiftee: ' + plain(H.swifteeLetsHelp), plain(H.gameUsePiece), plain(H.signTriangle)]), back.join(' > '));
    const key = g && await g.evaluate(() => [...document.querySelectorAll('#instruction-text .key')].map(e => e.textContent).join(' '));
    check('game (hi): the question\'s key word is the shape\'s name', key === 'त्रिभुज', key);
    check('game (hi): the return, no script errors', !b.errors.length, b.errors.join(' | '));
    await b.page.close();
  }

  /* ------------------------------------------------------------ 4. a code that is not ours */
  const c = await open(browser, srv, '?preview=1&game=0&lan=xx');
  await c.page.waitForFunction(() => window.__poly && window.__poly.state.ready, null, { timeout: 60000 });
  await goTo(c.page, 4);
  await c.page.waitForTimeout(2500);
  const en = await c.page.evaluate(() => ({ on: PolygonI18n.on, lang: document.documentElement.lang, title: document.title, shown: window.__poly.state.narrShow,
    fetched: performance.getEntriesByType('resource').some(e => /locales\.json|devanagari|telugu|gujarati|odia/.test(e.name)) }));
  check('?lan=xx: English, as without it, and nothing of the languages is fetched', !en.on && en.lang === 'en' && en.title === 'Polygon Adventure' &&
    en.shown === 'Is it open or closed?' && !en.fetched, JSON.stringify(en));
  await c.page.close();

  await browser.close();
  await srv.close();
  const failed = results.filter(r => !r.ok);
  for (const r of results) console.log((r.ok ? 'PASS ' : 'FAIL ') + r.name + (r.ok || !r.detail ? '' : '\n      ' + r.detail));
  console.log('\n' + (results.length - failed.length) + '/' + results.length + ' passed');
  process.exit(failed.length ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
