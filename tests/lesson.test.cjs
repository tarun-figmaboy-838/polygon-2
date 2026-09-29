#!/usr/bin/env node
/* Lesson smoke test, fast: the game opens exactly as a user gets it and the
   lesson's first screen starts talking; nothing it asks for is missing.
     - default load: story (skipped for automated browsers) -> blizzard ->
       screen 1 narration
     - ?preview=1 authoring mode still goes straight to screen 1
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
  await b.page.close();

  await browser.close();
  await srv.close();
  results.forEach(r => console.log((r.ok ? 'PASS ' : 'FAIL ') + r.name + (r.detail && (!r.ok || /s$/.test(r.detail)) ? '  — ' + r.detail : '')));
  const failed = results.filter(r => !r.ok).length;
  console.log(`${results.length - failed}/${results.length} passed (${ENGINE})`);
  process.exit(failed ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
