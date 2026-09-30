#!/usr/bin/env node
/* The Frozen Pass hand-off: the runner game in game/ takes the screen after the lesson.
     - ?game=1 opens straight on the game: its cover and PLAY are up, its engine reports
       TITLE, the lesson underneath is hidden, the story and the blizzard never ran, no
       request fails and nothing throws in either document
     - with the story into Part 2 left out (?bridge=0), the completion screen offers Help
       Momo beside Play again, the game is already loading behind it, and pressing Help Momo
       brings the game up at its cover (the story itself: tests/bridge.test.cjs)
     - ?game=0 leaves the game out: Play again alone, and nothing loaded
     - Momo's jump is the Momo jump kit's (mammoth-jump-v2): the push-off cell, the flight
       cells in order with the arc, the three landing cells, and the run picked up on cell 24,
       at the base size and on a hi-DPI screen (the hd/ sheet)

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
    await fr.waitForFunction(() => { const c = document.getElementById('cover'); return c && !c.classList.contains('loading'); }, null, { timeout: 60000 });
    await fr.locator('#btn-play').click({ force: true });
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
