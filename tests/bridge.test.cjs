#!/usr/bin/env node
/* The Broken Path: the story between Part 1 (the lesson) and Part 2 (the runner game).
     - ?bridge=1 plays it straight away: every state in order, Momo runs in and stops short
       of the edge, the path scrolls, Swiftee flies a curve and lands before she speaks,
       she looks at the gap and at Momo, her two lines come word by word with the recorded
       voice, and Next is not on the page until the last line has been read
     - nothing but Next takes a tap or a key: clicks, Enter, Space, arrows and Escape
       during the story change nothing, and Tab cannot reach the lesson underneath
     - Next takes one press; Part 2's cover comes up with its Play; Play starts the game
       once and its voice says each line once
     - from the lesson: the completion screen has no buttons, its line plays out, and the
       story starts by itself after a pause
     - without sound, with reduced motion, on an upright and a sideways phone, and in a
       hidden tab, it still gets to Next
     - the voice windows it takes from the game still match the game's own table

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
const ORDER = ['PART1_COMPLETE', 'STORY_ENTER', 'MOMO_RUNNING', 'MOMO_AT_DITCH', 'SWIFTEE_ENTER',
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
    check('?bridge=1: the story, the blizzard and the lesson are skipped', await page.waitForFunction(() =>
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
    check('both lines were said, in order' + (AUDIO ? ', with the recorded voice' : ''), says.map(s => s.id).join(',') === 'tut-5-broken,tut-2-goal' && (!AUDIO || says.every(s => s.withAudio)),
      JSON.stringify(says));
    const lastSaid = r.history.filter(h => h.event === 'said').pop().at;
    check('Next waits for a reading pause after the last line', r.history.find(h => h.phase === 'NEXT_ENABLED').at - lastSaid >= 800);
    check('every word of the last line is up', r.say.shown === r.say.words);
    if (AUDIO) {
      const heard = r.sounds.map(x => x.name), first = n => heard.indexOf(n);
      check("the game's sounds were all decoded", ['voice', 'step', 'tremble', 'whoosh', 'ui'].every(n => r.decoded.includes(n)), r.decoded.join(','));
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

    /* the hand-off: one press, the Part 2 cover, then Play */
    await page.locator('#bridge-story .bridge-next').dblclick();
    await page.mouse.click(nb.x + nb.width / 2, nb.y + nb.height / 2);
    const cover = await page.waitForFunction(() => window.BridgeStory.state().phase === 'PLAY_READY', null, { timeout: 120000 }).then(() => true, () => false);
    const h = await state(page);
    if (AUDIO) check("Next taps with the game's own interface sound", h.sounds.filter(x => x.name === 'ui').length === 1, JSON.stringify(h.sounds.slice(-3)));
    check('Next takes one press: one hand-off', h.history.filter(e => e.event === 'next').length === 1 && h.history.filter(e => e.event === 'handoff').length === 1,
      JSON.stringify(h.history.filter(e => e.event === 'next' || e.event === 'handoff')));
    check('Part 2 banner: the cover is up and Play is available', cover, h.phase);
    /* it stays under the runner's curtain until the curtain has lifted, then goes */
    await page.waitForFunction(() => !window.BridgeStory.state().active, null, { timeout: 5000 }).catch(() => {});
    check('the story has cleared itself away', await page.evaluate(() => !document.getElementById('bridge-story') && !document.documentElement.hasAttribute('data-bridge')));
    check('the page is no longer inert', await page.evaluate(() => [...document.body.children].every(n => !n.hasAttribute('inert'))));
    const frame = gameFrame(page);
    const before = await frame.evaluate(() => ({ state: window.iceAgeGame.state(), said: window.iceAgeGame._voice().said.length }));
    check('Part 2 waits at its cover: no gameplay and no voice before Play', before.state === 'TITLE' && before.said === 0, JSON.stringify(before));
    await page.screenshot({ path: path.join(OUT, ENGINE + '-6-part2-cover.png') });
    await frame.locator('#btn-play').dblclick();
    const started = await page.waitForFunction(() => window.BridgeStory.state().phase === 'PART2_START', null, { timeout: 15000 }).then(() => true, () => false);
    check('Play starts Part 2', started, (await state(page)).phase);
    await page.waitForTimeout(6000);
    /* the game's own log: 'id' when a line plays, 'id:queued' / 'id:after' while it waits */
    const said = await frame.evaluate(() => window.iceAgeGame._voice().said.map(String));
    const spoken = said.filter(x => !/:(queued|after|too-late|no-window|muted)$/.test(x)).map(x => x.split(':')[0]);
    check('Part 2 says each line once (a double tap on Play starts it once)', spoken.length > 0 && new Set(spoken).size === spoken.length, said.join(','));
    check('no request failed', !missing().length, missing().join(', '));
    check('no script errors', !errors.length, errors.join(' | '));
    await context.close();
  },

  /* From the lesson's completion screen, with no hands on it. */
  async lesson(browser, srv) {
    const { page, context, errors } = await open(browser, srv, '?preview=1');
    await page.waitForFunction(() => window.__poly && window.__poly.state.ready, null, { timeout: 30000 });
    await page.evaluate(() => { const g = window.__poly, k = g.steps().length - 1; g.setState({ k }, () => g.runStep(k, false)); });
    await page.waitForFunction(() => { const g = window.__poly; return g.state.k === g.steps().length - 1 && g.state.storyControls && !g._voiceLocked; }, null, { timeout: 60000 });
    const lineDone = Date.now();
    check('completion screen: nothing to press (the story follows by itself)',
      await page.getByRole('button', { name: 'Help Momo', exact: true }).count() === 0 &&
      await page.getByRole('button', { name: 'Play again', exact: true }).count() === 0);
    check('the story is loading behind the completion screen', await page.evaluate(() => !window.BridgeStory.state().active));
    const began = await page.waitForFunction(() => window.BridgeStory.state().active, null, { timeout: 15000 }).then(() => Date.now() - lineDone, () => -1);
    check('after the line, a pause, then the story starts by itself', began >= 1000 && began < 4000, began + 'ms');
    check('the lesson is locked under it', await page.evaluate(() => window.__poly.locked()));
    await page.waitForTimeout(250);
    await page.screenshot({ path: path.join(OUT, ENGINE + '-0-ice-wipe.png') });
    check('from the lesson: every state in order, with the voice', await reached(page, 'NEXT_ENABLED', 60000) &&
      await page.evaluate(({ o, a }) => { const s = window.BridgeStory.state(); return s.history.filter(h => h.event === 'phase').map(h => h.phase).join(' ') === o &&
        (!a || s.history.filter(h => h.event === 'say').every(h => h.withAudio)); }, { o: ORDER.join(' '), a: AUDIO }));
    check('the lesson stays on its completion screen underneath', await page.evaluate(() => { const g = window.__poly; return g.state.k === g.steps().length - 1; }));
    await page.locator('#bridge-story .bridge-next').click();
    check('Next brings up the Part 2 cover', await page.waitForFunction(() => window.BridgeStory.state().phase === 'PLAY_READY', null, { timeout: 120000 }).then(() => true, () => false));
    check('from the lesson: no script errors', !errors.length, errors.join(' | '));
    await context.close();
  },

  /* No sound at all: the words keep their times and the story still reaches Next. */
  async silent(browser, srv) {
    const { page, context, errors } = await open(browser, srv, '?bridge=1', { route: { pattern: '**/game/assets/audio/**', handler: r => r.fulfill({ status: 404, body: '' }) } });
    const ok = await reached(page, 'NEXT_ENABLED', 60000);
    const s = await state(page);
    check('without sound: the story still reaches Next', ok, s.phase);
    check('without sound: both lines were shown, silently', s.history.filter(h => h.event === 'say').length === 2 && s.history.filter(h => h.event === 'say').every(h => !h.withAudio));
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
      check(tag + ': a tap on Next hands over to Part 2', await page.waitForFunction(() => window.BridgeStory.state().history.some(h => h.event === 'handoff'), null, { timeout: 5000 }).then(() => true, () => false));
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
