#!/usr/bin/env node
/* The Frozen Pass hand-off: the runner game in game/ takes the screen after the lesson.
     - ?game=1 opens straight on the game: its cover and PLAY are up, its engine reports
       TITLE, the lesson underneath is hidden, the story and the blizzard never ran, no
       request fails and nothing throws in either document
     - with the story into Part 2 left out (?bridge=0), the completion screen offers Help
       Momo beside Play again, the game is already loading behind it, and pressing Help Momo
       brings the game up at its cover (the story itself: tests/bridge.test.cjs)
     - ?game=0 leaves the game out: Play again alone, and nothing loaded

   node tests/runner.test.cjs          ENGINE=webkit node tests/runner.test.cjs */
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

/** Jump the lesson to its completion screen and let its last line finish. */
async function toEnd(page) {
  await page.waitForFunction(() => window.__poly && window.__poly.state.ready, null, { timeout: 30000 });
  await page.evaluate(() => {
    const g = window.__poly, k = g.steps().length - 1;
    g.setState({ k }, () => g.runStep(k, false));
  });
  await page.waitForFunction(() => {
    const g = window.__poly;
    return g.state.k === g.steps().length - 1 && g.state.storyControls && !g.locked();
  }, null, { timeout: 60000 });
}

(async () => {
  const srv = await serve(ROOT);
  const browser = await pw[ENGINE].launch();

  /* 1. straight to the game */
  const a = await open(browser, srv, '?game=1');
  const up = await waitForGame(a.page).then(() => true, () => false);
  const s1 = await stage(a.page);
  check('?game=1: the game is up and at its cover', up && s1 && s1.game === 'TITLE', JSON.stringify(s1));
  const f1 = gameFrame(a.page);
  const coverUp = !!f1 && await f1.locator('#cover').isVisible() && await f1.locator('#btn-play').isVisible();
  check('?game=1: the cover and PLAY are visible in the frame', coverUp);
  check('?game=1: the curtain has lifted on the game', await waitOn(a.page));
  check('?game=1: the lesson underneath is hidden', await a.page.evaluate(() => {
    const v = document.querySelector('.game-viewport');
    return !!v && getComputedStyle(v).visibility === 'hidden';
  }));
  check('?game=1: no story and no blizzard', await a.page.evaluate(() => !document.getElementById('story-intro') && !document.getElementById('ice-intro')));
  await a.page.waitForTimeout(1500);
  const miss = a.missing();
  check('?game=1: every request succeeds', !miss.length, miss.join(', '));
  check('?game=1: no script errors', !a.errors.length, a.errors.join(' | '));
  await a.page.close();

  /* 2. the hand-off from the completion screen, without the story between */
  const b = await open(browser, srv, '?preview=1&bridge=0');
  await toEnd(b.page);
  const help = b.page.getByRole('button', { name: 'Help Momo', exact: true });
  const again = b.page.getByRole('button', { name: 'Play again', exact: true });
  check('completion screen: Help Momo and Play again are both offered', await help.count() === 1 && await again.count() === 1);
  check('completion screen: the game is already loading underneath', await b.page.evaluate(() => {
    const s = window.RunnerStage.state();
    return s.loaded && !s.shown && document.getElementById('runner-stage').classList.contains('is-loading');
  }));
  await help.click();
  const handed = await waitForGame(b.page).then(() => true, () => false);
  const s2 = await stage(b.page);
  check('Help Momo brings the game up at its cover', handed && s2 && s2.game === 'TITLE', JSON.stringify(s2));
  check('hand-off: the curtain has lifted and the stage covers the lesson', await waitOn(b.page));
  check('hand-off: no script errors', !b.errors.length, b.errors.join(' | '));
  await b.page.close();

  /* 3. without the game */
  const c = await open(browser, srv, '?preview=1&game=0');
  await toEnd(c.page);
  check('?game=0: Play again alone on the completion screen',
    await c.page.getByRole('button', { name: 'Help Momo', exact: true }).count() === 0 &&
    await c.page.getByRole('button', { name: 'Play again', exact: true }).count() === 1);
  check('?game=0: nothing was loaded', await c.page.evaluate(() => !document.getElementById('runner-stage')));
  check('?game=0: no script errors', !c.errors.length, c.errors.join(' | '));
  await c.page.close();

  await browser.close();
  await srv.close();
  results.forEach(r => console.log((r.ok ? 'PASS ' : 'FAIL ') + r.name + (r.detail && !r.ok ? '  — ' + r.detail : '')));
  const failed = results.filter(r => !r.ok).length;
  console.log(`${results.length - failed}/${results.length} passed (${ENGINE})`);
  process.exit(failed ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
