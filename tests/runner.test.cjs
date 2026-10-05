#!/usr/bin/env node
/* The Frozen Pass hand-off: the runner game in game/ takes the screen after the lesson, by
   itself, with no cover and no PLAY.
     - ?game=1 opens straight on the game: no cover and no PLAY, its run starts by itself, the
       lesson underneath is hidden, the story never ran, no request fails and nothing throws
       in either document
     - the lesson's last screen: Swiftee's line back to Momo, with no Next and no Play; the
       game loads behind it and stays down until the line has been said, then comes up and
       starts its run by itself, once, in order (TRANSITION_TO_GAME, FROZEN_RUSH_INIT,
       FROZEN_RUSH_RUNNING); the lesson's voice has stopped by then (?bridge=0 changes
       nothing here: it only leaves the Help Momo scene out, tests/bridge.test.cjs)
     - ?game=0 leaves the game out: the last screen ends on Play again, and nothing loaded
     - Momo's jump is the Momo jump kit's (mammoth-jump-v2): the push-off cell, the flight
       cells in order with the arc, the three landing cells, and the run picked up on cell 24,
       at the base size and on a hi-DPI screen (the hd/ sheet)
     - the game's fourteen polygons are the shapes their classification says (helpers/verify-polygons.cjs)

   node tests/runner.test.cjs          ENGINE=webkit node tests/runner.test.cjs */
const path = require('path');
const ROOT = path.resolve(__dirname, '..');
const pw = require('playwright');
const { serve } = require('./helpers/serve.cjs');
const { verifyPolygons } = require('./helpers/verify-polygons.cjs');
const ENGINE = process.env.ENGINE || 'chromium';

const results = [];
const check = (name, ok, detail) => results.push({ name, ok: !!ok, detail });
const noise = /\{\{|attribute/;

async function open(browser, srv, query) {
  const page = await browser.newPage({ viewport: { width: 1440, height: 810 } });
  const errors = [];
  // pageerror and console cover the frame's document as well as the page's own
  page.on('pageerror', e => { if (!noise.test(e.message)) errors.push(e.message); });
  page.on('console', m => { if (m.type() === 'error' && !noise.test(m.text())) errors.push(m.text()); });
  const before = srv.requests.length;
  await page.goto(srv.url + '/' + query, { waitUntil: 'domcontentloaded' });
  const missing = () => srv.requests.slice(before).filter(r => r.status !== 200).map(r => r.status + ' ' + r.path);
  return { page, errors, missing };
}

/** What the stage reports: loaded, shown, and the game engine's own state. */
const stage = page => page.evaluate(() => window.RunnerStage ? window.RunnerStage.state() : null);
/** The game is on screen and its engine has booted (it preloads ~20MB of art first). */
const waitForGame = (page, ms = 120000) => page.waitForFunction(() => {
  const s = window.RunnerStage && window.RunnerStage.state();
  return !!(s && s.shown && s.game && s.game !== 'BOOT');
}, null, { timeout: ms });
const gameFrame = page => page.frames().find(f => /\/game\/index\.html/.test(f.url()));
/** The curtain has lifted: the stage is on and the lesson is hidden under it. Waited for,
    not read at once — the game is usually at its cover before Help Momo is pressed, so the
    engine reports TITLE a few hundred milliseconds before the curtain's own moves finish. */
const waitOn = (page, ms = 8000) => page.waitForFunction(() => {
  const h = document.getElementById('runner-stage');
  return !!h && h.classList.contains('is-on') && !h.classList.contains('is-loading') &&
    document.documentElement.getAttribute('data-runner') === 'on';
}, null, { timeout: ms }).then(() => true, () => false);

/** Jump the lesson to its last screen, Swiftee's line back to Momo. */
async function toEnd(page) {
  await page.waitForFunction(() => window.__poly && window.__poly.state.ready, null, { timeout: 30000 });
  await page.evaluate(() => {
    const g = window.__poly, k = g.steps().length - 1;
    g.setState({ k }, () => g.runStep(k, false));
  });
  await page.waitForFunction(() => window.__poly.state.endPhase === 'MOMO_READY_MESSAGE' && window.__poly.state.speaking, null, { timeout: 30000 });
}
/** The game's run is going: past its title, in the opening or after it. */
const RUNNING = ['AVALANCHE', 'RUN_SEGMENT_1', 'TUTORIAL'];

(async () => {
  // the fourteen polygons the game draws are the shapes they are meant to be
  const problems = await verifyPolygons();
  check('game/js/polygons.js: every polygon is the shape its classification says', !problems.length, problems.join('; '));

  const srv = await serve(ROOT);
  const browser = await pw[ENGINE].launch();

  /* 1. straight to the game */
  const a = await open(browser, srv, '?game=1');
  const up = await waitForGame(a.page).then(() => true, () => false);
  const runs = await a.page.waitForFunction(names => {
    const s = window.RunnerStage.state();
    return s.phase === 'FROZEN_RUSH_RUNNING' && names.includes(s.game);
  }, RUNNING, { timeout: 60000 }).then(() => true, () => false);
  const s1 = await stage(a.page);
  check('?game=1: the game is up and its run starts by itself', up && runs, JSON.stringify(s1));
  const f1 = gameFrame(a.page);
  check('?game=1: no cover and no PLAY in the frame', !!f1 && !(await f1.locator('#cover').isVisible()) && !(await f1.locator('#btn-play').isVisible()));
  check('?game=1: the curtain has lifted on the game', await waitOn(a.page));
  check('?game=1: the lesson underneath is hidden', await a.page.evaluate(() => {
    const v = document.querySelector('.game-viewport');
    return !!v && getComputedStyle(v).visibility === 'hidden';
  }));
  check('?game=1: no story', await a.page.evaluate(() => !document.getElementById('story-intro')));
  await a.page.waitForTimeout(1500);
  const miss = a.missing();
  check('?game=1: every request succeeds', !miss.length, miss.join(', '));
  check('?game=1: no script errors', !a.errors.length, a.errors.join(' | '));
  await a.page.close();

  /* 2. the hand-off from the last screen, without the story between */
  const b = await open(browser, srv, '?preview=1&bridge=0');
  await toEnd(b.page);
  check('the last screen: no Next and no Play while Swiftee says her line',
    await b.page.getByRole('button', { name: 'Next', exact: true }).count() === 0 &&
    await b.page.getByRole('button', { name: 'Play', exact: true }).count() === 0 &&
    await b.page.getByRole('button', { name: 'Play again', exact: true }).count() === 0);
  check('the last screen: the game is loading underneath, and stays down', await b.page.evaluate(() => {
    const s = window.RunnerStage.state();
    return s.loaded && !s.shown && s.phase === 'IDLE' && document.getElementById('runner-stage').classList.contains('is-loading');
  }));
  const phases = await b.page.evaluate(() => new Promise(resolve => {
    const seen = [], t0 = performance.now();
    (function look() {
      const tag = window.__poly.state.endPhase + '/' + window.RunnerStage.state().phase + '/' + (window.__poly.state.speaking ? 'speaking' : 'quiet');
      if (seen[seen.length - 1] !== tag) seen.push(tag);
      if (window.RunnerStage.state().phase === 'FROZEN_RUSH_RUNNING' || performance.now() - t0 > 60000) resolve(seen); else setTimeout(look, 50);
    })();
  }));
  check('it hands over by itself, in order, only once the line has been said', phases[0] === 'MOMO_READY_MESSAGE/IDLE/speaking' &&
    phases.includes('TRANSITION_TO_GAME/TRANSITION_TO_GAME/quiet') && phases[phases.length - 1] === 'TRANSITION_TO_GAME/FROZEN_RUSH_RUNNING/quiet' &&
    !phases.some(p => /speaking/.test(p) && !/^MOMO_READY_MESSAGE\/IDLE/.test(p)), phases.join(' > '));
  const runs2 = await b.page.waitForFunction(names => names.includes(window.RunnerStage.state().game), RUNNING, { timeout: 60000 }).then(() => true, () => false);
  check('the game starts its run with no Play pressed', runs2, JSON.stringify(await stage(b.page)));
  check('hand-off: the curtain has lifted and the stage covers the lesson', await waitOn(b.page));
  const f2 = gameFrame(b.page);
  check('hand-off: no cover and no PLAY in the frame', !!f2 && !(await f2.locator('#cover').isVisible()) && !(await f2.locator('#btn-play').isVisible()));
  const once = await f2.evaluate(() => new Promise(resolve => {
    // a second start would reset the run: the ground covered would go back to nothing
    const g = window.iceAgeGame, before = g.debug().worldX;
    window.iceAgeBegin(); window.iceAgeBegin();
    setTimeout(() => resolve({ before, after: g.debug().worldX, state: g.state() }), 400);
  }));
  check('it starts once: asking again does not restart the run', once.after > once.before, JSON.stringify(once));
  check("hand-off: the lesson's voice has stopped", await b.page.evaluate(() => !window.__poly.state.speaking && !window.__poly._voiceLocked));
  check('hand-off: no script errors', !b.errors.length, b.errors.join(' | '));
  await b.page.close();

  /* 3. without the game */
  const c = await open(browser, srv, '?preview=1&game=0');
  await toEnd(c.page);
  const again = c.page.getByRole('button', { name: 'Play again', exact: true });
  check('?game=0: once the line is said, the last screen ends on Play again alone',
    await again.waitFor({ timeout: 30000 }).then(() => true, () => false) &&
    await c.page.getByRole('button', { name: 'Next', exact: true }).count() === 0);
  await again.click();
  check('?game=0: Play again starts the lesson over', await c.page.waitForFunction(() => window.__poly.state.k === 0, null, { timeout: 10000 }).then(() => true, () => false));
  check('?game=0: nothing was loaded', await c.page.evaluate(() => !document.getElementById('runner-stage')));
  check('?game=0: no script errors', !c.errors.length, c.errors.join(' | '));
  await c.page.close();

  /* 4. the jump, played in the game: base sheets, then the hi-DPI set */
  for (const [tag, dsf] of [['base', 1], ['hd', 2]]) {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 810 }, deviceScaleFactor: dsf });
    const pg = await ctx.newPage();
    const jerr = [];
    pg.on('pageerror', e => { if (!noise.test(e.message)) jerr.push(e.message); });
    const before = srv.requests.length;
    await pg.goto(srv.url + '/?game=1&tutorial=0&sound=0', { waitUntil: 'domcontentloaded' });
    await waitForGame(pg);
    const fr = gameFrame(pg);
    // no cover: the run starts by itself, with the opening avalanche before it
    await fr.waitForFunction(() => window.iceAgeGame.state() === 'RUN_SEGMENT_1' && window.iceAgeGame.debug().jumpEnabled === true, null, { timeout: 60000 });
    const seen = await fr.evaluate(() => new Promise(resolve => {
      const g = window.iceAgeGame, out = [];
      g.jump();
      const t0 = performance.now();
      (function tick() {
        out.push(g.mammothState() + ' ' + g.mammothFrame());
        if (performance.now() - t0 < 1800) requestAnimationFrame(tick); else resolve({ out, art: g.artSet() });
      })();
    }));
    const rows = seen.out.map(r => { const [st, sf] = r.split(' '); const [sheet, fn] = sf.split(':'); return { st, sheet, f: +fn }; });
    const jump = rows.filter(r => r.sheet === 'jump');
    const air = [...new Set(rows.filter(r => r.st === 'JUMP_AIR').map(r => r.f))];
    const landIdx = rows.findIndex(r => r.st === 'LAND');
    const back = rows.slice(landIdx).find(r => r.st === 'RUN');
    const req = srv.requests.slice(before).filter(r => /mammoth-jump/.test(r.path));
    check(tag + ': the jump plays the new sheet (' + (tag === 'hd' ? 'hd/' : '') + 'mammoth-jump-v2), and nothing asks for the old one',
      req.length > 0 && req.every(r => r.status === 200 && /mammoth-jump-v2/.test(r.path)) && seen.art === tag && req.some(r => (tag === 'hd') === /\/hd\//.test(r.path)),
      JSON.stringify({ art: seen.art, req: req.map(r => r.status + ' ' + r.path) }));
    check(tag + ': take-off on the push-off cell (12)', rows.some(r => r.st === 'JUMP_START' && r.sheet === 'jump' && r.f === 12), rows.slice(0, 6).map(r => r.st + ':' + r.f).join(' '));
    check(tag + ': the flight runs through cells 12-20 in order, with the arc', air.length >= 6 && air.every((v, i) => i === 0 || v > air[i - 1]) && air.every(v => v >= 12 && v <= 20), air.join(','));
    check(tag + ': the landing plays cells 21-23', rows.filter(r => r.st === 'LAND').every(r => r.f >= 21 && r.f <= 23) && rows.some(r => r.st === 'LAND' && r.f === 21), rows.filter(r => r.st === 'LAND').map(r => r.f).join(','));
    check(tag + ': the run picks up on cell 24, the pose nearest the landing', !!back && back.sheet === 'run' && back.f >= 24 && back.f <= 26, JSON.stringify(back));
    check(tag + ': every jump cell is one of the 24', jump.every(r => r.f >= 0 && r.f < 24));
    check(tag + ': no script errors', !jerr.length, jerr.join(' | '));
    await ctx.close();
  }

  await browser.close();
  await srv.close();
  results.forEach(r => console.log((r.ok ? 'PASS ' : 'FAIL ') + r.name + (r.detail && !r.ok ? '  — ' + r.detail : '')));
  const failed = results.filter(r => !r.ok).length;
  console.log(`${results.length - failed}/${results.length} passed (${ENGINE})`);
  process.exit(failed ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
