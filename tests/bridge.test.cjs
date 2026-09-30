#!/usr/bin/env node
/* Help Momo, the Broken Path: the scene between the story and the lesson, and the lesson's
   own ending, which leads to Part 2 (the runner game).
     - ?bridge=1 plays it straight away: every state in order, Momo runs in and stops short
       of the edge, the path scrolls, Swiftee flies a curve and lands before she speaks,
       she looks at the gap and at Momo, her three lines come word by word with the voice
       ("Oh no! The path is broken.", "Help Momo cross the Frozen Pass!", "But for that
       first you need to learn about polygons."), and Next is not on the page until the
       last line has been read; the lesson does not start underneath
     - nothing but Next takes a tap or a key: clicks, Enter, Space, arrows and Escape
       during the story change nothing, and Tab cannot reach the lesson underneath
     - Next takes one press, and the lesson begins at screen 1
     - after the story: the story's hand-over brings the scene up, and its Next goes on
       through the blizzard into the lesson; ?bridge=0 leaves the scene out
     - the lesson's ending: its completion line, then "You know all about polygons now.
       You are ready to help Momo." word by word, nothing to press, and only then the Part
       2 cover; Play starts the game once and its voice says each line once; the scene is
       not shown again
     - without sound, with reduced motion, on an upright and a sideways phone, and in a
       hidden tab, it still gets to Next
     - the voice windows it takes from the game still match the game's own table, and its
       last line is a lesson recording with a time for every word

   node tests/bridge.test.cjs          ENGINE=webkit node tests/bridge.test.cjs
   ONLY=order,lesson node tests/bridge.test.cjs */
const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..');
const pw = require('playwright');
const { serve } = require('./helpers/serve.cjs');
const ENGINE = process.env.ENGINE || 'chromium';
const ONLY = process.env.ONLY ? process.env.ONLY.split(',') : null;
const OUT = path.join(__dirname, 'output', 'bridge');
fs.mkdirSync(OUT, { recursive: true });

const results = [];
const check = (name, ok, detail) => results.push({ name, ok: !!ok, detail });
const noise = /\{\{|attribute/;
/* Chromium is launched with autoplay allowed, as a learner's page is after their taps in the
   lesson; other engines block sound without a tap here, so there the voice is not required. */
const AUDIO = ENGINE === 'chromium';
const ORDER = ['STORY_COMPLETE', 'STORY_ENTER', 'MOMO_RUNNING', 'MOMO_AT_DITCH', 'SWIFTEE_ENTER',
  'SWIFTEE_OBSERVE', 'DIALOGUE', 'STORY_READY', 'NEXT_ENABLED'];

async function open(browser, srv, query, opts = {}) {
  const context = await browser.newContext(Object.assign({ viewport: { width: 1440, height: 810 } }, opts.context || {}));
  if (opts.route) await context.route(opts.route.pattern, opts.route.handler);
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', e => { if (!noise.test(e.message)) errors.push(e.message); });
  page.on('console', m => { if (m.type() === 'error' && !noise.test(m.text()) && !/404|Failed to load resource/.test(m.text())) errors.push(m.text()); });
  const before = srv.requests.length;
  await page.goto(srv.url + '/' + query, { waitUntil: 'domcontentloaded' });
  const missing = () => srv.requests.slice(before).filter(r => r.status !== 200).map(r => r.status + ' ' + r.path);
  return { context, page, errors, missing };
}
const state = page => page.evaluate(() => window.BridgeStory.state());
const reached = (page, phase, ms = 60000) => page.waitForFunction(
  p => window.BridgeStory.state().history.some(h => h.phase === p), phase, { timeout: ms }).then(() => true, () => false);
const phases = s => s.history.filter(h => h.event === 'phase').map(h => h.phase);
const gameFrame = page => page.frames().find(f => /\/game\/index\.html/.test(f.url()));

const SCENARIOS = {
  /* The whole story, watched: order, motion, locking, voice, Next, and the hand-off. */
  async order(browser, srv) {
    const { page, context, errors, missing } = await open(browser, srv, '?bridge=1');
    check('?bridge=1: the story and the blizzard are skipped, and the scene opens the page', await page.waitForFunction(() =>
      window.BridgeStory && window.BridgeStory.state().active && !document.getElementById('story-intro') && !document.getElementById('ice-intro'),
      null, { timeout: 15000 }).then(() => true, () => false));

    /* MOMO_RUNNING: sample him and the path, and poke at everything */
    await reached(page, 'MOMO_RUNNING');
    const samples = [];
    for (let i = 0; i < 14; i++) {
      const s = await state(page);
      if (s.momo) samples.push({ t: s.clock, x: s.momo.x, wx: s.worldX, phase: s.phase, next: s.nextShown, cam: s.cam });
      if (i === 3) {
        await page.mouse.click(720, 400);
        await page.mouse.click(1300, 740);
        for (const key of ['Enter', ' ', 'ArrowRight', 'ArrowLeft', 'Escape', 'Tab']) await page.keyboard.press(key);
      }
      await page.waitForTimeout(220);
    }
    const run = samples.filter(s => s.phase === 'MOMO_RUNNING');
    check('Momo enters from off the left of the screen', run.length && run[0].x < run[0].cam.l + 200, JSON.stringify(run[0]));
    /* judged as a speed on the scene's own clock, so a sample that happens to land late is not
       a jump: he enters at ~1.04 px/ms (easing out), so anything past 1.4 would be a skip */
    const steps = run.slice(1).map((s, i) => ({ dx: s.x - run[i].x, dt: Math.max(1, s.t - run[i].t) }));
    check('Momo runs in smoothly: never a jump, never backwards', steps.every(v => v.dx >= -1 && v.dx / v.dt < 1.4),
      steps.map(v => v.dx + 'px/' + v.dt + 'ms').join(','));
    check('the path scrolls while he runs', run.length > 2 && run[run.length - 1].wx > run[0].wx + 300, run.map(s => Math.round(s.wx)).join(','));
    check('Next is not on the page while he runs', samples.every(s => !s.next));
    const afterPoke = await state(page);
    check('taps and keys during the run skip nothing', afterPoke.history.filter(h => h.event === 'next' || h.event === 'handoff').length === 0 &&
      ['SWIFTEE_ENTER', 'DIALOGUE'].every(p => !phases(afterPoke).includes(p) || afterPoke.clock > 6000), phases(afterPoke).join(' '));
    check('Tab cannot reach the page under the story', await page.evaluate(() => {
      const a = document.activeElement;
      return !a || a === document.body || !!a.closest('#bridge-story');
    }));
    check('the page under the story is inert', await page.evaluate(() =>
      [...document.body.children].filter(n => n.id !== 'bridge-story' && n.id !== 'runner-stage' && n.tagName !== 'SCRIPT').every(n => n.hasAttribute('inert'))));
    await page.screenshot({ path: path.join(OUT, ENGINE + '-1-running.png') });

    /* MOMO_AT_DITCH: stopped, short of the edge */
    await reached(page, 'MOMO_AT_DITCH');
    await page.waitForTimeout(200);          // his pose is taken on the next frame
    const at = await state(page);
    const lipOnScreen = at.holeWorldX - at.worldX;
    check('he stops with the edge exactly where it was placed', Math.abs(lipOnScreen - at.lip) < 1, lipOnScreen);
    check('he stops short of the edge, not over it', at.momo.x + 0.3 * 735 < lipOnScreen - 150, `trunk ~${Math.round(at.momo.x + 0.3 * 735)}, lip ${Math.round(lipOnScreen)}`);
    check('he reacts at the edge: the look-down sheet', at.momo.sheet === 'tremble', at.momo.sheet);
    check('no Swiftee yet', !at.swiftee);
    await page.waitForTimeout(800);
    await page.screenshot({ path: path.join(OUT, ENGINE + '-2-at-the-edge.png') });

    /* SWIFTEE_ENTER: a curve, slowing, then down on her feet */
    await reached(page, 'SWIFTEE_ENTER');
    const flight = [];
    while (flight.length < 40) {
      const s = await state(page);
      if (s.swiftee) flight.push({ t: s.clock, x: s.swiftee.x, y: s.swiftee.y, flying: s.swiftee.flying, say: !!s.say });
      if (s.swiftee && !s.swiftee.flying && s.swiftee.standing) break;
      if (flight.length === 8) await page.screenshot({ path: path.join(OUT, ENGINE + '-3-swiftee-flying.png') });
      await page.waitForTimeout(90);
    }
    const air = flight.filter(f => f.flying);
    check('Swiftee flies in (not spawned at her spot)', air.length >= 6 && Math.hypot(air[0].x - 880, air[0].y - 767) > 500, air.length + ' samples');
    if (air.length >= 6) {
      const a = air[0], b = air[air.length - 1], m = air[Math.floor(air.length / 2)];
      const off = Math.abs((b.x - a.x) * (a.y - m.y) - (a.x - m.x) * (b.y - a.y)) / Math.hypot(b.x - a.x, b.y - a.y);
      check('her flight is a curve, not a straight line', off > 40, Math.round(off) + 'px off the chord');
      const v = (p, q) => Math.hypot(q.x - p.x, q.y - p.y) / Math.max(1, q.t - p.t);
      check('she slows as she comes in', v(air[air.length - 2], air[air.length - 1]) < v(air[0], air[1]) * 0.6,
        v(air[0], air[1]).toFixed(2) + ' -> ' + v(air[air.length - 2], air[air.length - 1]).toFixed(2));
    }
    check('no words while she is flying', flight.every(f => !f.say));

    /* SWIFTEE_OBSERVE: she looks, then speaks */
    await reached(page, 'DIALOGUE');
    const d = await state(page);
    const ev = name => d.history.find(h => h.event === name);
    const looks = d.history.filter(h => h.event === 'look').map(h => h.at);
    check('she looks at the gap, then at Momo', looks.join(',') === 'gap,momo', looks.join(','));
    const landed = ev('landed').at;
    const firstPhase = p => d.history.find(h => h.phase === p).at;
    check('the dialogue waits for her to land and look (at least 300 ms)', firstPhase('DIALOGUE') - landed >= 300, (firstPhase('DIALOGUE') - landed) + 'ms');
    await page.waitForTimeout(1400);
    const mid = await state(page);
    check('the first line arrives word by word', mid.say && mid.say.id === 'tut-5-broken' && mid.say.shown > 0 && mid.say.shown < mid.say.words, JSON.stringify(mid.say && { shown: mid.say.shown, words: mid.say.words }));
    const box = mid.say && mid.say.box, vp = page.viewportSize();
    check('the bubble is on the screen', box && box.left >= 0 && box.top >= 0 && box.left + box.w <= vp.width && box.top + box.h <= vp.height, JSON.stringify(box));
    const head = mid.swiftee && mid.swiftee.screen;
    check('its tail reaches down to Swiftee, short, as in the lesson', box && head && Math.abs(box.tail.x - head.x) < 40 && box.tail.y - (box.top + box.h) < 80 && box.tail.y - (box.top + box.h) > 5,
      JSON.stringify({ tail: box && box.tail, head }));
    check("it is Swiftee's own Part 1 dialogue box (the lesson's teal edge and cream paper, Nunito)", await page.evaluate(() => {
      const b = document.querySelector('#bridge-story .bridge-box.comic-dialogue.dialogue-box'), cs = b && getComputedStyle(b);
      const t = document.querySelector('#bridge-story .bridge-say-text');
      return !!cs && cs.borderTopColor === 'rgb(22, 159, 153)' && cs.backgroundColor === 'rgb(255, 251, 234)' &&
        !!document.querySelector('#bridge-story .bridge-box .dialogue-tail') && /Nunito/.test(getComputedStyle(t).fontFamily);
    }));
    await page.screenshot({ path: path.join(OUT, ENGINE + '-4-dialogue.png') });

    /* NEXT_ENABLED only after the last line has been read */
    const nextSeenEarly = await page.evaluate(() => {
      const n = document.querySelector('#bridge-story .bridge-next');
      return !!n && !n.hidden && !n.disabled;
    });
    check('Next is still hidden during the dialogue', !nextSeenEarly);
    check('Next appears', await reached(page, 'NEXT_ENABLED', 30000));
    const r = await state(page);
    check('every state came, in order', phases(r).join(' ') === ORDER.join(' '), phases(r).join(' '));
    const says = r.history.filter(h => h.event === 'say');
    check('all three lines were said, in order' + (AUDIO ? ', with the voice' : ''), says.map(s => s.id).join(',') === 'tut-5-broken,tut-2-goal,learn-first' && (!AUDIO || says.every(s => s.withAudio)),
      JSON.stringify(says));
    check('the last line is word for word "But for that first you need to learn about polygons."', r.say && r.say.text === 'But for that first you need to learn about polygons.', r.say && r.say.text);
    check('the lesson has not started underneath', await page.evaluate(() => !window.__poly._voiceStarted && window.__poly.state.k === 0));
    const lastSaid = r.history.filter(h => h.event === 'said').pop().at;
    check('Next waits for a reading pause after the last line', r.history.find(h => h.phase === 'NEXT_ENABLED').at - lastSaid >= 800);
    check('every word of the last line is up', r.say.shown === r.say.words);
    if (AUDIO) {
      const heard = r.sounds.map(x => x.name), first = n => heard.indexOf(n);
      check("the game's sounds and the lesson's take were all decoded", ['voice', 'learn-first', 'step', 'tremble', 'whoosh', 'ui'].every(n => r.decoded.includes(n)), r.decoded.join(','));
      check('footsteps on his run (the recorded crunch)', heard.filter(n => n === 'step').length >= 4, heard.join(','));
      check('the skid as he stops, the pips as he shivers, a whoosh and wing beats for Swiftee, in that order',
        ['skid', 'tremble', 'whoosh', 'flutter'].every(n => heard.filter(x => x === n).length === 1) &&
        first('skid') < first('tremble') && first('tremble') < first('whoosh') && first('whoosh') < first('flutter'), heard.join(','));
      check('no footsteps once he has stopped', r.sounds.filter(x => x.name === 'step').every(x => x.at <= r.history.find(h => h.phase === 'MOMO_AT_DITCH').at));
    }
    const nb = await page.locator('#bridge-story .bridge-next').boundingBox();
    check("Next is the Part 1 buttons kit's blue pill", await page.evaluate(() => {
      const n = document.querySelector('#bridge-story .bridge-next');
      return n.classList.contains('kit-btn') && n.classList.contains('kit-btn--nav') && /btn-uiNav/.test(getComputedStyle(n).borderImageSource);
    }));
    check('Next is on the screen and clear of the bubble', nb && nb.x + nb.width <= vp.width && nb.y + nb.height <= vp.height &&
      (nb.x > r.say.box.left + r.say.box.w || nb.y > r.say.box.top + r.say.box.h), JSON.stringify({ nb, box: r.say.box }));
    await page.waitForTimeout(500);
    await page.screenshot({ path: path.join(OUT, ENGINE + '-5-next.png') });

    /* the hand-off: one press, and the lesson begins */
    await page.locator('#bridge-story .bridge-next').dblclick();
    await page.mouse.click(nb.x + nb.width / 2, nb.y + nb.height / 2);
    const gone = await page.waitForFunction(() => !window.BridgeStory.state().active, null, { timeout: 5000 }).then(() => true, () => false);
    const h = await state(page);
    if (AUDIO) check("Next taps with the game's own interface sound", h.sounds.filter(x => x.name === 'ui').length === 1, JSON.stringify(h.sounds.slice(-3)));
    check('Next takes one press: one hand-off', h.history.filter(e => e.event === 'next').length === 1 && h.history.filter(e => e.event === 'handoff').length === 1,
      JSON.stringify(h.history.filter(e => e.event === 'next' || e.event === 'handoff')));
    check('Next ends the scene (LESSON_START) and it clears itself away', gone && h.phase === 'LESSON_START' &&
      await page.evaluate(() => !document.getElementById('bridge-story') && !document.documentElement.hasAttribute('data-bridge')), h.phase);
    check('the page is no longer inert', await page.evaluate(() => [...document.body.children].every(n => !n.hasAttribute('inert'))));
    check('the lesson begins at screen 1', await page.waitForFunction(() => window.__poly.state.k === 0 && window.__poly.state.narrShow === 'Look! A point.', null, { timeout: 20000 }).then(() => true, () => false));
    await page.waitForTimeout(600);
    await page.screenshot({ path: path.join(OUT, ENGINE + '-6-lesson.png') });
    check('no request failed', !missing().length, missing().join(', '));
    check('no script errors', !errors.length, errors.join(' | '));
    await context.close();
  },

  /* After the story: its hand-over brings the scene up; its Next goes on into the lesson. */
  async story(browser, srv) {
    const { page, context, errors } = await open(browser, srv, '?story=1');
    await page.waitForFunction(() => window.StoryIntro && StoryIntro.state().ready, null, { timeout: 60000 });
    await page.locator('#story-intro .story-play').click();
    await page.waitForTimeout(600);
    await page.evaluate(() => StoryIntro.jump(8));             // on to the last scene
    const up = await page.waitForFunction(() => window.BridgeStory.state().active, null, { timeout: 60000 }).then(() => true, () => false);
    check('after the story: the Help Momo scene comes up', up);
    const at = await page.evaluate(() => ({ story: StoryIntro.state(), lessonStarted: !!window.__poly._voiceStarted, blizzard: !!document.getElementById('ice-intro') }));
    check('it follows the story\'s last scene, before the blizzard and before the lesson', !at.lessonStarted && !at.blizzard &&
      (at.story.active ? at.story.phase === 'complete' : at.story.lastRun && at.story.lastRun.history.some(e => e.event === 'handoff')), JSON.stringify({ lesson: at.lessonStarted, blizzard: at.blizzard, phase: at.story.phase }));
    check('after the story: every state in order, all three lines', await reached(page, 'NEXT_ENABLED', 60000) &&
      await page.evaluate(o => { const s = window.BridgeStory.state(); return s.history.filter(h => h.event === 'phase').map(h => h.phase).join(' ') === o &&
        s.history.filter(h => h.event === 'say').length === 3; }, ORDER.join(' ')));
    check('the lesson is still waiting', await page.evaluate(() => !window.__poly._voiceStarted));
    await page.locator('#bridge-story .bridge-next').click();
    check('Next goes on through the blizzard', await page.waitForFunction(() => !!document.getElementById('ice-intro'), null, { timeout: 5000 }).then(() => true, () => false));
    check('and the lesson begins at screen 1', await page.waitForFunction(() => window.__poly.state.k === 0 && window.__poly.state.narrShow === 'Look! A point.', null, { timeout: 60000 }).then(() => true, () => false));
    check('after the story: no script errors', !errors.length, errors.join(' | '));
    await context.close();
    /* ?bridge=0: the lesson follows the story directly */
    const b = await open(browser, srv, '?story=1&bridge=0');
    await b.page.waitForFunction(() => window.StoryIntro && StoryIntro.state().ready, null, { timeout: 60000 });
    await b.page.locator('#story-intro .story-play').click();
    await b.page.waitForTimeout(600);
    await b.page.evaluate(() => StoryIntro.jump(8));
    const straight = await b.page.waitForFunction(() => !!document.getElementById('ice-intro') || window.__poly._voiceStarted, null, { timeout: 60000 }).then(() => true, () => false);
    check('?bridge=0: no scene; the blizzard and the lesson follow the story', straight && await b.page.evaluate(() => !window.BridgeStory.enabled && !document.getElementById('bridge-story')));
    await b.context.close();
  },

  /* The lesson's ending, with no hands on it: two lines, then the Part 2 cover. */
  async lesson(browser, srv) {
    const { page, context, errors } = await open(browser, srv, '?preview=1');
    await page.waitForFunction(() => window.__poly && window.__poly.state.ready, null, { timeout: 30000 });
    await page.evaluate(() => { const g = window.__poly, k = g.steps().length - 1; g.setState({ k }, () => g.runStep(k, false)); });
    const READY = 'You know all about polygons now. You are ready to help Momo.';
    const first = await page.waitForFunction(() => { const g = window.__poly; return g.state.k === g.steps().length - 1 && g.state.narrShow === g.step().narr && !g._voiceLocked; }, null, { timeout: 60000 }).then(() => true, () => false);
    check('the completion screen says its line first', first);
    check('completion screen: nothing to press (Part 2 follows by itself)',
      await page.getByRole('button', { name: 'Help Momo', exact: true }).count() === 0 &&
      await page.getByRole('button', { name: 'Play again', exact: true }).count() === 0);
    const reveal = [];
    const ready = await page.waitForFunction(r => window.__poly.state.narrShow === r, READY, { timeout: 15000 }).then(() => true, () => false);
    check('then, after a pause, "' + READY + '"', ready);
    for (let i = 0; i < 40; i++) {
      const s = await page.evaluate(() => ({ words: window.__poly.state.revealedWords, reveal: window.__poly.state.wordReveal, locked: window.__poly.locked(),
        cover: !!(window.RunnerStage.state && window.RunnerStage.state().shown) }));
      reveal.push(s);
      if (s.reveal === 'complete' || s.cover) break;
      await page.waitForTimeout(120);
    }
    const counts = reveal.filter(r => r.reveal === 'recorded').map(r => r.words);
    check('it comes word by word with the voice', counts.length > 3 && counts[0] < 12 && counts.every((n, i) => !i || n >= counts[i - 1]), counts.join(','));
    check('the lesson stays locked while it is said', reveal.filter(r => r.reveal === 'recorded').every(r => r.locked));
    check('the Part 2 cover does not come up while it is said', reveal.every(r => !r.cover));
    await page.waitForTimeout(200);
    await page.screenshot({ path: path.join(OUT, ENGINE + '-7-ready-to-help-momo.png') });
    const lineDone = Date.now();
    const cover = await page.waitForFunction(() => window.RunnerStage.state && window.RunnerStage.state().shown, null, { timeout: 15000 }).then(() => Date.now() - lineDone, () => -1);
    check('after a reading pause, the Part 2 cover comes up by itself', cover >= 600 && cover < 6000, cover + 'ms');
    check('the Help Momo scene is not shown again', await page.evaluate(() => !window.BridgeStory.state().active && !window.BridgeStory.state().history.length));
    const frame = await (async () => { for (let i = 0; i < 100; i++) { const f = gameFrame(page); if (f) return f; await page.waitForTimeout(200); } return null; })();
    const loaded = frame && await frame.waitForFunction(() => window.iceAgeGame && window.iceAgeGame.state() === 'TITLE', null, { timeout: 120000 }).then(() => true, () => false);
    const before = loaded && await frame.evaluate(() => ({ state: window.iceAgeGame.state(), said: window.iceAgeGame._voice().said.length }));
    check('Part 2 waits at its cover: no gameplay and no voice before Play', before && before.state === 'TITLE' && before.said === 0, JSON.stringify(before));
    await page.waitForTimeout(1500);
    await page.screenshot({ path: path.join(OUT, ENGINE + '-8-part2-cover.png') });
    if (loaded) {
      await frame.locator('#btn-play').dblclick();
      const started = await frame.waitForFunction(() => window.iceAgeGame.state() !== 'TITLE', null, { timeout: 15000 }).then(() => true, () => false);
      check('Play starts Part 2', started);
      await page.waitForTimeout(6000);
      /* the game's own log: 'id' when a line plays, 'id:queued' / 'id:after' while it waits */
      const said = await frame.evaluate(() => window.iceAgeGame._voice().said.map(String));
      const spoken = said.filter(x => !/:(queued|after|too-late|no-window|muted)$/.test(x)).map(x => x.split(':')[0]);
      check('Part 2 says each line once (a double tap on Play starts it once)', spoken.length > 0 && new Set(spoken).size === spoken.length, said.join(','));
    }
    check('the ending: no script errors', !errors.length, errors.join(' | '));
    await context.close();
  },

  /* No sound at all: the words keep their times and the story still reaches Next. */
  async silent(browser, srv) {
    const { page, context, errors } = await open(browser, srv, '?bridge=1', { route: { pattern: '**/audio/**', handler: r => r.fulfill({ status: 404, body: '' }) } });
    const ok = await reached(page, 'NEXT_ENABLED', 60000);
    const s = await state(page);
    check('without sound: the story still reaches Next', ok, s.phase);
    check('without sound: all three lines were shown, silently', s.history.filter(h => h.event === 'say').length === 3 && s.history.filter(h => h.event === 'say').every(h => !h.withAudio));
    check('without sound: every word is up', s.say && s.say.shown === s.say.words);
    check('without sound: no script errors', !errors.length, errors.join(' | '));
    await context.close();
  },

  /* Reduced motion: no run, no flight; every beat still told, as held pictures. */
  async reduced(browser, srv) {
    const { page, context, errors } = await open(browser, srv, '?bridge=1', { context: { reducedMotion: 'reduce' } });
    const flights = [], worlds = [];
    const done = reached(page, 'NEXT_ENABLED', 60000);
    for (let i = 0; i < 30; i++) {
      const s = await state(page);
      if (s.swiftee) flights.push(s.swiftee.flying);
      if (s.momo) worlds.push(s.worldX);
      if (s.phase === 'NEXT_ENABLED') break;
      await page.waitForTimeout(300);
    }
    check('reduced motion: the story reaches Next', await done);
    const s = await state(page);
    check('reduced motion: every beat but the run, in order', phases(s).join(' ') === ORDER.filter(p => p !== 'MOMO_RUNNING').join(' '), phases(s).join(' '));
    check('reduced motion: Swiftee does not fly', flights.length > 0 && flights.every(f => !f));
    check('reduced motion: the path does not scroll: he is at the edge from the start', worlds.length > 3 &&
      worlds.every(w => Math.abs(w - (s.holeWorldX - s.lip)) < 0.5), worlds.map(Math.round).join(','));
    await page.screenshot({ path: path.join(OUT, ENGINE + '-reduced.png') });
    check('reduced motion: no script errors', !errors.length, errors.join(' | '));
    await context.close();
  },

  /* Phones, both ways up: the scene fits, the bubble and Next are on screen and apart. */
  async phones(browser, srv) {
    for (const [tag, viewport] of [['phone-port', { width: 390, height: 844 }], ['phone-land', { width: 844, height: 390 }]]) {
      const { page, context, errors } = await open(browser, srv, '?bridge=1', { context: { viewport, deviceScaleFactor: 2, hasTouch: true } });
      const ok = await reached(page, 'NEXT_ENABLED', 60000);
      await page.waitForTimeout(500);
      const s = await state(page), b = s.say && s.say.box;
      const nb = await page.locator('#bridge-story .bridge-next').boundingBox();
      check(tag + ': the story reaches Next', ok);
      check(tag + ': the bubble is on the screen', b && b.left >= 0 && b.top >= 0 && b.left + b.w <= viewport.width && b.top + b.h <= viewport.height, JSON.stringify(b));
      check(tag + ': its type is at least 18px', b && b.font >= 18, b && b.font);
      check(tag + ': Next is on the screen and clear of the bubble', nb && nb.x >= 0 && nb.y >= 0 && nb.x + nb.width <= viewport.width && nb.y + nb.height <= viewport.height &&
        (nb.x >= b.left + b.w || nb.y >= b.top + b.h || nb.x + nb.width <= b.left || nb.y + nb.height <= b.top), JSON.stringify({ nb, b }));
      check(tag + ': Momo and Swiftee are both on the screen', s.swiftee && s.swiftee.screen.x > 0 && s.swiftee.screen.x < viewport.width &&
        (s.momoX - s.cam.l) * s.cam.s > 0 && (s.momoX - s.cam.l) * s.cam.s < viewport.width);
      await page.screenshot({ path: path.join(OUT, ENGINE + '-' + tag + '.png') });
      await page.locator('#bridge-story .bridge-next').tap();
      check(tag + ': a tap on Next hands over to the lesson', await page.waitForFunction(() => window.BridgeStory.state().history.some(h => h.event === 'handoff'), null, { timeout: 5000 }).then(() => true, () => false));
      check(tag + ': no script errors', !errors.length, errors.join(' | '));
      await context.close();
    }
  },

  /* A hidden tab freezes the story, and it carries on where it stopped. */
  async hidden(browser, srv) {
    const { page, context } = await open(browser, srv, '?bridge=1');
    await reached(page, 'MOMO_RUNNING');
    await page.waitForTimeout(600);
    const hide = h => page.evaluate(v => {
      Object.defineProperty(document, 'hidden', { value: v, configurable: true });
      Object.defineProperty(document, 'visibilityState', { value: v ? 'hidden' : 'visible', configurable: true });
      document.dispatchEvent(new Event('visibilitychange'));
    }, h);
    await hide(true);
    const a = await state(page);
    await page.waitForTimeout(1500);
    const b = await state(page);
    check('hidden tab: the story clock stops', Math.abs(b.clock - a.clock) < 60 && b.paused, `${a.clock} -> ${b.clock}`);
    await hide(false);
    await page.waitForTimeout(800);
    const c = await state(page);
    check('visible again: it carries on from where it was', c.clock > b.clock + 400 && !c.paused && c.phase === a.phase || phases(c).length >= phases(a).length, `${b.clock} -> ${c.clock}`);
    await context.close();
  },

  /* The voice windows are the game's own: the same ids, text, starts, lengths and word times. */
  async data(browser, srv) {
    const src = fs.readFileSync(path.join(ROOT, 'game', 'js', 'engine.js'), 'utf8');
    const { page, context } = await open(browser, srv, '?bridge=1');
    const lines = await page.evaluate(() => window.BridgeStory.lines);
    for (const l of lines) {
      const m = new RegExp("'" + l.id + "':\\s*\\[([\\d.]+),\\s*([\\d.]+),\\s*\\[([^\\]]*)\\]\\],\\s*//\\s*\"([^\"]+)\"").exec(src);
      const words = m ? m[3].split(',').map(Number) : [];
      check('voice window ' + l.id + ' matches the game', m && +m[1] === l.at && +m[2] === l.dur && m[4] === l.text &&
        words.length === l.words.length && words.every((w, i) => w === l.words[i]), m ? m.slice(1).join(' | ') : 'not found in engine.js');
      check('line ' + l.id + ' has a time for every word', l.text.split(' ').length === l.words.length);
    }
    const lesson = await page.evaluate(() => window.BridgeStory.lessonLines);
    check('its last line is a lesson recording, word for word, with a time for every word', lesson.length === 1 &&
      lesson[0].text === 'But for that first you need to learn about polygons.' && /^assets\/audio\/lesson\/.+\.mp3$/.test(lesson[0].src || '') &&
      lesson[0].words.length === lesson[0].text.split(' ').length && lesson[0].words.every((w, i) => !i || w > lesson[0].words[i - 1]), JSON.stringify(lesson));
    await context.close();
  }
};

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
