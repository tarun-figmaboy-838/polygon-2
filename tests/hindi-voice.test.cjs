#!/usr/bin/env node
/* THE HINDI VOICE, in the browser, start to end (?lan=hi; src/lesson/recordings-hi.js, Frozen
   Rush's CFG.vo.langs.hi). With real audio playing:
     - every screen of the lesson: it plays its Hindi take, and the words on the board keep to it:
       none before the voice says it, each one as it is said (sampled against the take's clock)
     - no English take of a lesson line is fetched in Hindi
     - the recap says its lines in Hindi, its words coming in, and reaches Next
     - the opening: the game's tutorial in its Hindi take (its words timed by it), Swiftee's two
       lines over the game in her Hindi takes
     - the end: her last line in Hindi; the return: Swiftee at the ditch, the plank's line and its
       question, all in the Hindi takes
     - Marathi and English keep the English takes
   node tests/hindi-voice.test.cjs        PART=lesson|recap|opening|end|others */
const path = require('path');
const fs = require('fs');
const ROOT = path.resolve(__dirname, '..');
const pw = require('playwright');
const { serve } = require('./helpers/serve.cjs');
const ENGINE = process.env.ENGINE || 'chromium';
const PART = process.env.PART || 'all';
const part = p => PART === 'all' || PART.split(',').includes(p);

const results = [];
const check = (name, ok, detail) => results.push({ name, ok: !!ok, detail });
const noise = /\{\{|attribute/;
const L = JSON.parse(fs.readFileSync(path.join(ROOT, 'src/i18n/locales.json'), 'utf8'));
const plain = s => s.replace(/<\/?strong>/g, '');

async function open(browser, srv, query) {
  const page = await browser.newPage({ viewport: { width: 1440, height: 810 } });
  const errors = [];
  page.on('pageerror', e => { if (!noise.test(e.message)) errors.push(e.message); });
  page.on('console', m => { if (m.type() === 'error' && !noise.test(m.text())) errors.push(m.text()); });
  /* the lesson's voice on a media element whose clock can be read: every one made is kept */
  await page.addInitScript(() => {
    window.POLYGON_VOICE_VIA_CONTEXT = false;
    const A = window.Audio;
    window.__voices = [];
    window.Audio = function (src) { const a = new A(src); window.__voices.push(a); return a; };
    window.Audio.prototype = A.prototype;
  });
  const before = srv.requests.length;
  await page.goto(srv.url + '/' + query, { waitUntil: 'domcontentloaded' });
  const fetched = () => srv.requests.slice(before);
  const missing = () => fetched().filter(r => r.status !== 200).map(r => r.status + ' ' + r.path);
  return { page, errors, fetched, missing };
}
const goTo = (page, index) => page.evaluate(i => {
  const game = window.__poly, step = game.steps()[i];
  game.unlockAudio();
  game.setState({ k: i, placed: {}, sortAt: {}, dd: [null, null, null, null], ddWrong: [false, false, false, false], userPts: null, dragged: false,
    drawn: step.sc === 'S1' && !['point', 'draw'].includes(step.ph), numsB: 0 }, () => game.runStep(i, false));
}, index);
const lessonAudio = rs => rs.filter(r => /^\/assets\/audio\/lesson\//.test(r.path)).map(r => r.path);

(async () => {
  const srv = await serve(ROOT);
  const browser = await pw[ENGINE].launch(ENGINE === 'chromium' ? { args: ['--autoplay-policy=no-user-gesture-required'] } : {});

  /* ------------------------------------------------------------ 1. every screen, in step */
  if (part('lesson')) {
    const a = await open(browser, srv, '?preview=1&game=0&lan=hi');
    await a.page.waitForFunction(() => window.__poly && window.__poly.state.ready, null, { timeout: 60000 });
    const on = await a.page.evaluate(() => ({ voiced: PolygonI18n.voiced, rows: (window.POLYGON_VOICES && window.POLYGON_VOICES.hi || []).length }));
    check('lesson (hi): the page speaks Hindi: its takes are loaded with its words', on.voiced && on.rows > 80, JSON.stringify(on));
    const steps = await a.page.evaluate(() => window.__poly.steps().length);
    const late = [], wrongFile = [], silent = [];
    let heard = 0;
    for (let k = 0; k < steps; k++) {
      const n0 = await a.page.evaluate(() => window.__voices.length);
      await goTo(a.page, k);
      const expect = await a.page.evaluate(i => {
        const s = window.__poly.steps()[i], row = s.narr && window.PolygonRecordedVoice.find(s.narr);
        if (!row) return null;
        // the words on the board: the take's, or (a shorter line shown) spread over the take's words
        const shown = (PolygonI18n.t(s.show || s.narr).match(/\S+/g) || []).length;
        const own = window.PolygonRecordedVoice.spokenStarts(row, PolygonI18n.t(s.show || s.narr));
        const starts = own || Array.from({ length: shown }, (w, j) => row.spoken[Math.floor(j * row.spoken.length / shown)].start);
        return { src: row.src, starts, text: s.narr };
      }, k);
      if (!expect) continue;
      // the samples: the take's clock, and the words on the board at that moment
      const samples = await a.page.evaluate(async ({ n0, src }) => {
        const t0 = performance.now(), out = [];
        let a = null;
        while (performance.now() - t0 < 15000) {
          a = window.__voices.slice(n0).reverse().find(v => v.src.includes(src.replace(/\.mp3$/, '')));
          if (a && !a.paused) break;
          await new Promise(r => setTimeout(r, 20));
        }
        if (!a || a.paused) return { src: a ? a.src : '', out };
        const playing = a.src;          // (the player lets go of its src when the line ends)
        // until the voice stops: at its end the player pauses the element and lets go of it
        while (!a.ended && !a.paused && performance.now() - t0 < 25000) {
          const g = window.__poly.state;
          out.push({ t: a.currentTime, shown: g.revealedWords, reveal: g.wordReveal });
          await new Promise(r => setTimeout(r, 37));
        }
        return { src: playing, out };
      }, { n0, src: expect.src });
      if (!samples.out.length) { silent.push((k + 1) + ' ' + expect.text); continue; }
      if (!/\/assets\/audio\/lesson\/hi\//.test(samples.src)) wrongFile.push((k + 1) + ': ' + samples.src);
      heard++;
      for (const s of samples.out) {
        if (s.reveal !== 'recorded') continue;
        // a frame either side of the sample: never ahead of the voice, never a word behind it
        const lo = expect.starts.filter(x => x <= s.t - 0.09).length, hi = expect.starts.filter(x => x <= s.t + 0.04).length;
        if (s.shown < lo || s.shown > hi) { late.push((k + 1) + ' @' + s.t.toFixed(2) + 's: ' + s.shown + ' shown, ' + lo + '-' + hi + ' said'); break; }
      }
      await a.page.waitForTimeout(250);
    }
    check('lesson (hi): every screen\'s line plays, in its Hindi take (' + heard + ' screens)', heard > 30 && !wrongFile.length && !silent.length, wrongFile.concat(silent.map(s => 'silent: ' + s)).join(' | '));
    check('lesson (hi): the words come in as the take says them: none early, none a word behind', !late.length, late.join(' | '));
    const english = lessonAudio(a.fetched()).filter(p => !/\/hi\//.test(p));
    check('lesson (hi): no English take of a lesson line is fetched', !english.length, english.join(' '));
    check('lesson (hi): no script errors, every request found', !a.errors.length && !a.missing().length, a.errors.concat(a.missing()).join(' | '));
    await a.page.close();
  }

  /* ------------------------------------------------------------ 2. the recap */
  if (part('recap')) {
    const a = await open(browser, srv, '?preview=1&game=0&lan=hi');
    await a.page.waitForFunction(() => window.__poly && window.__poly.state.ready, null, { timeout: 60000 });
    const k = await a.page.evaluate(() => window.__poly.steps().findIndex(s => s.recap));
    await goTo(a.page, k);
    const words = [];
    const t0 = Date.now();
    let state = '';
    while (Date.now() - t0 < 180000) {
      const r = await a.page.evaluate(() => window.PolygonRecap.state()).catch(() => ({}));
      state = r.state || state;
      // a line caught part-said: its words coming in, not all at once
      if (r.words && r.shown > 0 && r.shown < r.words && !words.includes(r.text)) words.push(r.text);
      if (state === 'READY' || state === 'DONE') break;
      await a.page.waitForTimeout(80);
    }
    const said = lessonAudio(a.fetched());
    check('recap (hi): its lines are said in their Hindi takes', said.length >= 10 && said.every(p => /\/hi\//.test(p)) &&
      said.some(p => /91_Lets_recall/.test(p)) && said.some(p => /92_Polygons_have_different_names/.test(p)), said.join(' '));
    check('recap (hi): its words come in one by one, in Hindi, and Next comes up', state === 'READY' && words.length >= 8 && words.every(w => !/[A-Za-z]{2}/.test(w)),
      state + ' | ' + words.slice(0, 4).join(' / '));
    check('recap (hi): no script errors', !a.errors.length, a.errors.join(' | '));
    await a.page.close();
  }

  /* ------------------------------------------------------------ 3. the opening */
  if (part('opening')) {
    const a = await open(browser, srv, '?intro=1&lan=hi');
    await a.page.waitForFunction(() => window.RunnerStage && RunnerStage.state().opening.said.includes('ready'), null, { timeout: 90000 }).catch(() => {});
    const f = a.page.frames().find(x => /lesson=intro/.test(x.url()));
    await f.click('#btn-play');
    let timed = false, asked = false;
    const t0 = Date.now();
    while (Date.now() - t0 < 150000) {
      const st = await a.page.evaluate(() => RunnerStage.state().opening.phase);
      if (st !== 'OPENING_COVER' && st !== 'OPENING_TUTORIAL') break;
      const r = await f.evaluate(() => { const t = document.getElementById('tut-text'); return t ? { text: t.textContent.trim(), w0: t.dataset.w0 } : {}; }).catch(() => ({}));
      if (r.w0 != null && r.text && !/[A-Za-z]{2}/.test(r.text)) timed = true;
      if (r.text === plain(L.hi.gameTapJump)) asked = true;
      if (asked) await f.evaluate(() => window.iceAgeGame.jump && window.iceAgeGame.jump()).catch(() => {});
      await a.page.waitForTimeout(150);
    }
    const voice = await f.evaluate(() => ({ lang: window.iceAgeGame.voLang(), said: window.iceAgeGame._voice().said })).catch(e => ({ err: String(e) }));
    const take = a.fetched().filter(r => /vo-lines/.test(r.path)).map(r => r.path);
    check('opening (hi): the game speaks its Hindi take', voice.lang === 'hi' && take.length && take.every(p => /vo-lines-hi\./.test(p)), JSON.stringify(voice) + ' ' + take.join(' '));
    check('opening (hi): the tutorial\'s lines were spoken, and its Hindi words timed by the take', ['tut-1-meet', 'tut-2-goal', 'tut-3-watch', 'tut-4-jump', 'tut-5-broken']
      .every(id => (voice.said || []).some(s => s === id || s.startsWith(id + ':ctx') || s.startsWith(id + ':after'))) && timed, JSON.stringify(voice.said) + ' timed:' + timed);
    await a.page.waitForFunction(() => window.SwifteeCameo.state().history.filter(h => h.event === 'said').length >= 2, null, { timeout: 40000 }).catch(() => {});
    const cameo = await a.page.evaluate(() => window.SwifteeCameo.state().history.filter(h => h.event === 'say'));
    const hers = lessonAudio(a.fetched());
    check('opening (hi): Swiftee says her two lines over the game in her Hindi takes', cameo.length === 2 && cameo.every(h => h.voice) &&
      hers.some(p => /\/hi\/92_Momo_needs_your_help/.test(p)) && hers.some(p => /\/hi\/91_But_to_help_Momo/.test(p)) && !hers.some(p => !/\/hi\//.test(p)), JSON.stringify(cameo) + ' ' + hers.join(' '));
    check('opening (hi): no script errors', !a.errors.length, a.errors.join(' | '));
    await a.page.close();
  }

  /* ------------------------------------------------------------ 4. the end and the return */
  if (part('end')) {
    const b = await open(browser, srv, '?preview=1&lan=hi');
    await b.page.waitForFunction(() => window.__poly && window.__poly.state.ready, null, { timeout: 30000 });
    await b.page.evaluate(() => { const g = window.__poly, k = g.steps().length - 1; g.unlockAudio(); g.setState({ k }, () => g.runStep(k, false)); });
    await b.page.waitForFunction(() => RunnerStage.state().phase === 'FROZEN_RUSH_RUNNING', null, { timeout: 120000 }).catch(() => {});
    const last = lessonAudio(b.fetched());
    check('end (hi): her last line in its Hindi take', last.some(p => /\/hi\/93_Now_you_know_everything/.test(p)) && last.every(p => /\/hi\//.test(p)), last.join(' '));
    const g = b.page.frames().find(x => /lesson=end/.test(x.url()));
    let activeAt = 0, voice = {};
    const t1 = Date.now();
    while (g && Date.now() - t1 < 150000) {
      const r = await g.evaluate(() => ({ state: window.iceAgeGame.debug().state, lang: window.iceAgeGame.voLang(), said: window.iceAgeGame._voice().said })).catch(() => null);
      if (r && r.said.length >= ((voice.said || []).length)) voice = { lang: r.lang, said: r.said };
      if (r && r.state === 'PHASE_ACTIVE' && !activeAt) activeAt = Date.now();
      if (activeAt && Date.now() - activeAt > 6000) break;
      await g.evaluate(() => window.iceAgeGame.jump && window.iceAgeGame.jump()).catch(() => {});
      await b.page.waitForTimeout(700);
    }
    const spoke = id => (voice.said || []).some(s => s === id || s.startsWith(id + ':ctx') || s.startsWith(id + ':after'));
    check('return (hi): the plank\'s line and its question in the Hindi take', voice.lang === 'hi' && spoke('tut-6b-piece') && spoke('sign-triangle'), JSON.stringify(voice));
    const ditch = lessonAudio(b.fetched());
    check('return (hi): Swiftee at the ditch in her Hindi take', ditch.some(p => /\/hi\/90_Now_lets_help_Momo/.test(p)), ditch.join(' '));
    check('end (hi): no script errors', !b.errors.length, b.errors.join(' | '));
    await b.page.close();
  }

  /* ------------------------------------------------------------ 5. the others keep the English takes */
  if (part('others')) {
    for (const lan of ['mr', 'en']) {
      const a = await open(browser, srv, '?preview=1&game=0' + (lan === 'en' ? '' : '&lan=' + lan));
      await a.page.waitForFunction(() => window.__poly && window.__poly.state.ready, null, { timeout: 60000 });
      await goTo(a.page, 4);
      await a.page.waitForTimeout(3000);
      const said = lessonAudio(a.fetched());
      const loaded = await a.page.evaluate(() => !!window.POLYGON_VOICES || performance.getEntriesByType('resource').some(e => /recordings-hi/.test(e.name)));
      check(lan + ': the English takes, and nothing of the Hindi voice fetched', said.length && said.every(p => !/\/hi\//.test(p)) && !loaded, said.join(' ') + ' hi:' + loaded);
      await a.page.close();
    }
  }

  await browser.close();
  await srv.close();
  const failed = results.filter(r => !r.ok);
  for (const r of results) console.log((r.ok ? 'PASS ' : 'FAIL ') + r.name + (r.ok || !r.detail ? '' : '\n      ' + r.detail));
  console.log('\n' + (results.length - failed.length) + '/' + results.length + ' passed');
  process.exit(failed.length ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
