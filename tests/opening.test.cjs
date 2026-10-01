#!/usr/bin/env node
/* The opening and the return: Frozen Rush opens the experience and closes it.
     - the game's own cover is the page at once (?intro=1 asks for it in an automated browser):
       its banner and PLAY, the lesson waiting underneath, no story and no Help Momo scene, and
       no Skip and no Skip to ending anywhere in the game
     - PLAY: the avalanche, the run and the tutorial as far as the broken path, its lines in
       order; nothing past it (no plank, no cut, no "Perfect fit!")
     - Swiftee flies in over the frozen game, lands on the path across the ditch facing Momo,
       looks at it, and says "Momo needs your help." (no take yet: read) and her recorded
       "But for that first you need to learn about polygons."
     - the hand-over in the snow: the flurry, the game fading away onto the lesson, the frame
       taken off the page, and the lesson on screen 1 with its voice and its music, no tap,
       nothing blank and nothing to press in between
     - the return, after the lesson: the avalanche and the run with no tutorial; at the ditch
       the game stops for Swiftee ("Now let's help Momo."), then the plank's recorded "Use the
       right ice piece to fix the path." and its own question, "Cut the TRIANGLE."
     - ?story=1 still opens on the drafted story, with no game in front of it

   node tests/opening.test.cjs          ENGINE=webkit node tests/opening.test.cjs */
const path = require('path');
const ROOT = path.resolve(__dirname, '..');
const pw = require('playwright');
const { serve } = require('./helpers/serve.cjs');
const ENGINE = process.env.ENGINE || 'chromium';

const results = [];
const check = (name, ok, detail) => results.push({ name, ok: !!ok, detail });
const noise = /\{\{|attribute/;

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
/** What the tutorial layer and the plank are showing in a game frame. */
const showing = f => f.evaluate(() => {
  const G = window.iceAgeGame.debug(), lay = document.getElementById('tutorial'), t = document.getElementById('tut-text');
  return { tut: lay && !lay.hidden && t ? t.textContent.trim() : '', plank: G.signSay || '', state: G.state, paused: window.iceAgeGame.isPaused() };
}).catch(() => null);
const cameo = page => page.evaluate(() => window.SwifteeCameo.state());
const noSkips = f => f.evaluate(() => !document.getElementById('tut-skip') && !document.getElementById('btn-skip-end'));

const OPENING = ['This is Momo.', 'He needs to find his friend.', 'Help Momo cross the Frozen Pass!', 'Watch out!',
  'Tap to jump over obstacles.', 'Oh no!', 'The path is broken.'];
const SWIFTEE_OPENING = ['Momo needs your help.', 'But for that first you need to learn about polygons.'];

(async () => {
  const srv = await serve(ROOT);
  const browser = await pw[ENGINE].launch();

  /* 1. the game's cover first */
  const a = await open(browser, srv, '?intro=1');
  const up = await a.page.waitForFunction(() => window.RunnerStage && RunnerStage.state().opening.said.includes('ready'), null, { timeout: 90000 }).then(() => true, () => false);
  const f = a.page.frames().find(x => /lesson=intro/.test(x.url()));
  check('the game\'s cover is the page: its banner and PLAY', up && !!f && await f.locator('#cover').isVisible() && await f.locator('#btn-play').isVisible());
  check('the lesson waits underneath, hidden, and nothing of the story or the Help Momo scene is there', await a.page.evaluate(() =>
    !window.__poly._voiceStarted && getComputedStyle(document.querySelector('.game-viewport')).visibility === 'hidden' &&
    !document.getElementById('story-intro') && !document.getElementById('bridge-story') && !window.BridgeStory.enabled));
  check('no Skip and no Skip to ending in the game', await noSkips(f));

  /* 2. PLAY, and the tutorial to the broken path */
  await f.click('#btn-play');
  const seen = [];
  let asked = false, last = null;
  const t0 = Date.now();
  while (Date.now() - t0 < 150000) {
    const st = await a.page.evaluate(() => RunnerStage.state().opening.phase);
    if (st !== 'OPENING_COVER' && st !== 'OPENING_TUTORIAL') break;
    const r = await showing(f);
    if (r) {
      last = r;
      for (const line of [r.tut, r.plank]) if (line && seen[seen.length - 1] !== line) seen.push(line);
      if (r.tut === 'Tap to jump over obstacles.') asked = true;
    }
    if (asked) await f.evaluate(() => window.iceAgeGame.jump && window.iceAgeGame.jump()).catch(() => {});
    await a.page.waitForTimeout(150);
  }
  check('PLAY: the tutorial\'s lines in order, as far as the broken path', JSON.stringify(seen) === JSON.stringify(OPENING), seen.join(' > '));
  check('it stops at the broken path, frozen: no plank line, no cut, no "Perfect fit!"', last && !last.plank &&
    !seen.some(l => /ice piece|Perfect fit/.test(l)) && ['PHASE_INTRO', 'PHASE_ACTIVE'].includes(last.state), JSON.stringify(last));

  /* 3. Swiftee flies in */
  const flying = await a.page.waitForFunction(() => window.SwifteeCameo.state().on, null, { timeout: 8000 }).then(() => true, () => false);
  const first = await cameo(a.page);
  check('Swiftee comes, flying, over the frozen game', flying && first.pose === 'flying' && await f.evaluate(() => window.iceAgeGame.isPaused()), JSON.stringify(first));
  const landed = await a.page.waitForFunction(() => window.SwifteeCameo.state().history.some(h => h.event === 'watch'), null, { timeout: 8000 }).then(() => true, () => false);
  const perch = await cameo(a.page);
  check('she lands on the path across the ditch and looks at it before she speaks', landed && /curious/.test(perch.pose) && !perch.say &&
    perch.at && perch.at.x > 720 && perch.at.y > 560 && perch.at.y < 810, JSON.stringify(perch));
  await a.page.waitForFunction(() => RunnerStage.state().opening.phase === 'OPENING_TO_LESSON', null, { timeout: 30000 }).catch(() => {});
  const said = (await cameo(a.page)).history.filter(h => h.event === 'say');
  check('she says "Momo needs your help." and then, in her recorded voice, "But for that first..."',
    JSON.stringify(said.map(h => h.text)) === JSON.stringify(SWIFTEE_OPENING) && said[1] && said[1].voice === true, JSON.stringify(said));

  /* 4. the hand-over, in the snow */
  const snow = await a.page.evaluate(() => document.querySelectorAll('.opening-snow .opening-flake').length);
  check('the snow comes as the game hands over', snow > 30, String(snow));
  const handed = await a.page.waitForFunction(() => RunnerStage.state().opening.phase === 'OPENING_DONE', null, { timeout: 10000 }).then(() => true, () => false);
  check('the game fades away onto the lesson, and its frame is taken off the page', handed && await a.page.evaluate(() =>
    !document.getElementById('runner-opening') && !document.querySelector('iframe') && !document.documentElement.hasAttribute('data-runner') &&
    !window.SwifteeCameo.state().on));
  const lesson = await a.page.waitForFunction(() => window.__poly._voiceStarted && window.__poly.state.k === 0, null, { timeout: 15000 }).then(() => true, () => false);
  check('the lesson opens on screen 1, by itself', lesson);
  await a.page.waitForTimeout(2500);
  const heard = await a.page.evaluate(() => ({ ac: window.__poly._ac && window.__poly._ac.state, voiceError: window.__poly.state.voiceError,
    music: window.LessonMusic.state() }));
  check('the lesson is heard with no tap of its own: its voice and its music', heard.ac === 'running' && !heard.voiceError && heard.music.playing, JSON.stringify(heard));
  check('opening: every request succeeds', !a.missing().length, a.missing().join(', '));
  check('opening: no script errors', !a.errors.length, a.errors.join(' | '));
  await a.page.close();

  /* 5. the return, after the lesson */
  const b = await open(browser, srv, '?preview=1');
  await b.page.waitForFunction(() => window.__poly && window.__poly.state.ready, null, { timeout: 30000 });
  await b.page.evaluate(() => { const g = window.__poly, k = g.steps().length - 1; g.setState({ k }, () => g.runStep(k, false)); });
  const running = await b.page.waitForFunction(() => RunnerStage.state().phase === 'FROZEN_RUSH_RUNNING', null, { timeout: 120000 }).then(() => true, () => false);
  const g = b.page.frames().find(x => /lesson=end/.test(x.url()));
  const start = g && await showing(g);
  check('the return: the game takes over by itself and opens on its avalanche', running && !!g && !!start && start.state === 'AVALANCHE', JSON.stringify(start));
  check('the return: no Skip and no Skip to ending', !!g && await noSkips(g));
  const back = [];
  let activeAt = 0, swifteeAt = -1, plankAt = -1;
  const t1 = Date.now();
  while (Date.now() - t1 < 150000) {
    const r = await showing(g);
    const c = await cameo(b.page);
    if (c.say && swifteeAt < 0) swifteeAt = back.length;
    if (c.say && c.say.text && back[back.length - 1] !== 'swiftee: ' + c.say.text) back.push('swiftee: ' + c.say.text);
    if (r) {
      for (const line of [r.tut, r.plank]) if (line && back[back.length - 1] !== line) { back.push(line); if (r.plank && plankAt < 0) plankAt = back.length; }
      if (r.state === 'PHASE_ACTIVE' && !activeAt) activeAt = Date.now();
    }
    if (activeAt && Date.now() - activeAt > 6000) break;
    await g.evaluate(() => window.iceAgeGame.jump && window.iceAgeGame.jump()).catch(() => {});
    await b.page.waitForTimeout(150);
  }
  check('the return: nothing until the ditch; there Swiftee says "Now let\'s help Momo.", then the plank its line',
    JSON.stringify(back) === JSON.stringify(["swiftee: Now let's help Momo.", 'Use the right ice piece to fix the path.']), back.join(' > '));
  const question = await g.evaluate(() => (document.querySelector('#instruction') || {}).textContent || '').catch(() => '');
  check('the return: then the plank asks its own question', /Cut the TRIANGLE/i.test(question), question);
  check('the return: Swiftee has flown off', !(await cameo(b.page)).on);
  check('the return: no script errors', !b.errors.length, b.errors.join(' | '));
  await b.page.close();

  /* 6. the drafted story */
  const c = await open(browser, srv, '?story=1');
  const story = await c.page.waitForFunction(() => !!document.getElementById('story-intro'), null, { timeout: 15000 }).then(() => true, () => false);
  check('?story=1: the drafted story opens the page, with no game in front of it', story && await c.page.evaluate(() =>
    !document.getElementById('runner-opening') && window.RunnerStage.state().opening.phase === 'IDLE'));
  await c.page.close();

  await browser.close();
  await srv.close();
  let failed = 0;
  for (const r of results) {
    if (!r.ok) failed++;
    console.log((r.ok ? 'PASS ' : 'FAIL ') + r.name + (r.ok || !r.detail ? '' : '\n     ' + r.detail));
  }
  console.log(`\n${results.length - failed}/${results.length} passed (${ENGINE})`);
  process.exit(failed ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
