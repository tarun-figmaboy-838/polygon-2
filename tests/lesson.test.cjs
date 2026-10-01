#!/usr/bin/env node
/* Lesson smoke test, fast: the game opens exactly as a user gets it and the
   lesson's first screen starts talking; nothing it asks for is missing.
     - default load: story (skipped for automated browsers) -> blizzard ->
       screen 1 narration
     - ?preview=1 authoring mode still goes straight to screen 1
     - the screen navigator (Screens, Back, Next) is not on the page for a learner,
       and is there with ?dev=1
     - the Part 1 buttons kit is in: the story's round gold Play (with its crystals), and
       the summary's blue Next pill, and with ?game=0 its gold Play again
     - no request returns an error, no script error (the lesson template's
       own {{ }} placeholder warnings are known and ignored)
     - every narration recording in the catalog exists in its shipped format,
       Ogg and the MP3 fallback, and every story file exists

   node tests/lesson.test.cjs          ENGINE=webkit node tests/lesson.test.cjs */
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
  const t0 = Date.now();
  const started = await page.waitForFunction(() => window.__poly && window.__poly.state.k === 0 && window.__poly.state.narr, null, { timeout: 30000 })
    .then(() => (Date.now() - t0) / 1000, () => null);
  await page.waitForTimeout(1500);
  const missing = srv.requests.slice(before).filter(r => r.status !== 200).map(r => r.status + ' ' + r.path);
  return { page, errors, started, missing };
}

(async () => {
  const srv = await serve(ROOT);
  const browser = await pw[ENGINE].launch();

  const a = await open(browser, srv, '');
  check('default load reaches screen 1 narration', a.started !== null, a.started === null ? 'never started' : a.started.toFixed(1) + 's');
  check('default load: every request succeeds', !a.missing.length, a.missing.join(', '));
  check('default load: no script errors', !a.errors.length, a.errors.join(' | '));

  // Every file the lesson and story can ask for exists, in each format.
  const catalog = await a.page.evaluate(() => ({
    lesson: (window.POLYGON_RECORDINGS || []).map(r => r.src),
    story: window.STORY_VOICE && window.STORY_VOICE.src ? [window.STORY_VOICE.src] : [],
    music: window.STORY_DATA && window.STORY_DATA.music && window.STORY_DATA.music.src,
    art: window.STORY_DATA ? window.STORY_DATA.scenes.map(s => window.STORY_DATA.imageBase + s.image) : []
  }));
  const urls = [];
  catalog.lesson.forEach(src => { urls.push(src); urls.push(src.replace(/\.(mp3|wav)$/i, '.ogg')); });
  catalog.story.concat(catalog.music ? [catalog.music] : []).forEach(src => { urls.push(src + '.ogg'); urls.push(src + '.mp3'); });
  catalog.art.forEach(src => urls.push(src));
  const absent = [];
  for (const u of urls) {
    const status = await a.page.evaluate(async (url) => (await fetch(url, { method: 'HEAD' })).status, u);
    if (status !== 200) absent.push(status + ' ' + decodeURIComponent(u));
  }
  check(`all ${urls.length} media files exist (lesson Ogg + MP3, story Ogg + MP3, scene art)`, !absent.length, absent.slice(0, 10).join(', '));
  await a.page.close();

  const b = await open(browser, srv, '?preview=1');
  check('?preview=1 goes straight to screen 1', b.started !== null && b.started < 12, b.started === null ? 'never started' : b.started.toFixed(1) + 's');
  check('?preview=1: no script errors', !b.errors.length, b.errors.join(' | '));
  check('no screen navigator (Screens, Back, Next) for a learner', await b.page.evaluate(() => !document.getElementById('polygon-screen-navigator')));
  await b.page.close();

  const d = await open(browser, srv, '?preview=1&dev=1');
  const nav = await d.page.evaluate(() => {
    const host = document.getElementById('polygon-screen-navigator'), root = host && host.shadowRoot;
    return !!root && !!root.getElementById('toggle') && !!root.getElementById('back') && !!root.getElementById('next');
  });
  check('?dev=1: the screen navigator is there (Screens, Back, Next)', nav);
  check('?dev=1: no script errors', !d.errors.length, d.errors.join(' | '));
  await d.page.close();

  /* THE BUTTONS KIT */
  const e = await browser.newPage({ viewport: { width: 1440, height: 810 } });
  const eErrors = [];
  e.on('pageerror', x => { if (!noise.test(x.message)) eErrors.push(x.message); });
  await e.goto(srv.url + '/?story=1', { waitUntil: 'domcontentloaded' });
  await e.waitForFunction(() => window.StoryIntro && window.StoryIntro.state().ready, null, { timeout: 30000 });
  await e.waitForTimeout(700);
  const play = await e.evaluate(() => {
    const b = document.querySelector('#story-intro .story-play'), i = b && b.querySelector('img');
    return { kit: !!b && b.classList.contains('kit-play'), art: !!i && i.complete && i.naturalWidth === 320,
      crystals: document.querySelectorAll('#story-intro .kit-play-sparks svg').length, shown: !!b && getComputedStyle(b).opacity === '1' };
  });
  check("the story's start card has the kit's round gold Play, with its crystals", play.kit && play.art && play.crystals >= 5 && play.shown, JSON.stringify(play));
  await e.click('#story-intro .story-play');
  check('the gold Play starts the story', await e.waitForFunction(() => window.StoryIntro.state().playing, null, { timeout: 5000 }).then(() => true, () => false));
  await e.goto(srv.url + '/?preview=1&bridge=0', { waitUntil: 'domcontentloaded' });
  await e.waitForFunction(() => window.__poly && window.__poly.state.ready, null, { timeout: 30000 });
  const endPill = async (query) => {
    await e.goto(srv.url + '/' + query, { waitUntil: 'domcontentloaded' });
    await e.waitForFunction(() => window.__poly && window.__poly.state.ready, null, { timeout: 30000 });
    await e.evaluate(() => { const g = window.__poly, k = g.steps().length - 1; g.setState({ k }, () => g.runStep(k, false)); });
    await e.waitForFunction(() => window.PolygonSummary && window.PolygonSummary.state().active, null, { timeout: 20000 }).catch(() => {});
    await e.evaluate(() => window.PolygonSummary.skipToEnd());
    await e.waitForTimeout(400);
    return e.evaluate(() => [...document.querySelectorAll('.lsum .kit-btn')].filter(b => !b.hidden).map(b => ({
      text: b.textContent.trim(), nav: b.classList.contains('kit-btn--nav'), gold: b.classList.contains('kit-btn--primary'),
      ice: b.classList.contains('ice-button'), art: getComputedStyle(b).borderImageSource })));
  };
  const next = await endPill('?preview=1&bridge=0');
  check("the summary ends on Next, the kit's blue pill", next.length === 1 && next[0].text === 'Next' && next[0].nav && /btn-uiNav/.test(next[0].art) && !next[0].ice, JSON.stringify(next));
  const again = await endPill('?preview=1&game=0');
  check("without the game (?game=0) it ends on Play again, the kit's gold pill", again.length === 1 && again[0].text === 'Play again' && again[0].gold && /btn-uiPrimary/.test(again[0].art), JSON.stringify(again));
  check('buttons kit: no script errors', !eErrors.length, eErrors.join(' | '));
  await e.close();

  await browser.close();
  await srv.close();
  results.forEach(r => console.log((r.ok ? 'PASS ' : 'FAIL ') + r.name + (r.detail && (!r.ok || /s$/.test(r.detail)) ? '  — ' + r.detail : '')));
  const failed = results.filter(r => !r.ok).length;
  console.log(`${results.length - failed}/${results.length} passed (${ENGINE})`);
  process.exit(failed ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
