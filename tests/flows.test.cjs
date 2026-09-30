#!/usr/bin/env node
/* User-behaviour tests for the story, each in a fresh page: Escape (mid-story
   and on the start card; the page has no Skip button), a double tap on Play,
   switching tabs mid-line, replay, Ogg failing (MP3 fallback), all audio
   failing (text still runs), and a missing scene image (straight to the
   lesson, never stuck).

   node tests/flows.test.cjs          ENGINE=webkit node tests/flows.test.cjs
   ONLY=replay,escapeKey node tests/flows.test.cjs */
const path = require('path');
const ROOT = path.resolve(__dirname, '..');
const pw = require('playwright');
const { serve } = require('./helpers/serve.cjs');
const ENGINE = process.env.ENGINE || 'chromium';
const ONLY = process.env.ONLY ? process.env.ONLY.split(',') : null;

const results = [];
function check(name, ok, detail) { results.push({ name, ok: !!ok, detail }); }

async function fresh(browser, srv, opts = {}) {
  const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  if (opts.route) await context.route(opts.route.pattern, opts.route.handler);
  const page = await context.newPage();
  const errors = [];
  const lessonNoise = /\{\{|attribute|reading 'C'|this\.P\.C/;
  page.on('pageerror', e => { if (!lessonNoise.test(e.message)) errors.push(e.message); });
  page.on('console', m => { if (m.type() === 'error' && !lessonNoise.test(m.text())) errors.push(m.text()); });
  await page.goto(srv.url + '/?story=1', { waitUntil: 'domcontentloaded' });
  return { context, page, errors };
}
const state = (page) => page.evaluate(() => window.StoryIntro.state());
const ready = (page) => page.waitForFunction(() => window.StoryIntro.state().ready || !window.StoryIntro.state().active, null, { timeout: 30000 });
const until = (page, fn, arg, ms = 60000) => page.waitForFunction(fn, arg, { timeout: ms });
async function lessonStarted(page, ms = 20000) {
  return page.waitForFunction(() => !document.getElementById('story-intro') && !document.getElementById('ice-intro') && window.__poly && window.__poly.state.k === 0 && !!window.__poly.state.narr, null, { timeout: ms }).then(() => true, () => false);
}

const SCENARIOS = {
  async skipMidStory(browser, srv) {
    const { page, context, errors } = await fresh(browser, srv);
    await ready(page); await page.click('.story-play');
    await until(page, () => { const s = window.StoryIntro.state(); return s.scene === 3 && s.phase === 'dialogue'; });
    const skipButton = await page.evaluate(() => [...document.querySelectorAll('#story-intro button')]
      .some(b => /skip/i.test(b.textContent + ' ' + (b.getAttribute('aria-label') || ''))));
    check('no Skip button on the story', !skipButton);
    const t = Date.now();
    await page.keyboard.press('Escape');
    const gone = await until(page, () => !document.getElementById('story-intro'), null, 3000).then(() => Date.now() - t, () => -1);
    const run = await page.evaluate(() => window.StoryIntro.state().lastRun);
    check('skip mid-story: overlay leaves quickly', gone > 0 && gone < 1500, gone + 'ms');
    check('skip mid-story: one handoff', run && run.history.filter(e => e.event === 'handoff').length === 1);
    check('skip mid-story: lesson starts', await lessonStarted(page));
    check('skip mid-story: no page errors', !errors.length, errors.join(' | '));
    await context.close();
  },

  async skipAtStart(browser, srv) {
    const { page, context } = await fresh(browser, srv);
    await ready(page);
    await page.keyboard.press('Escape');
    check('skip on start card: lesson starts', await lessonStarted(page));
    await context.close();
  },

  async escapeKey(browser, srv) {
    const { page, context } = await fresh(browser, srv);
    await ready(page); await page.click('.story-play');
    await until(page, () => window.StoryIntro.state().scene === 2);
    await page.keyboard.press('Escape');
    check('Escape skips the story', await lessonStarted(page));
    await context.close();
  },

  async doubleTapPlay(browser, srv) {
    const { page, context } = await fresh(browser, srv);
    await ready(page);
    await page.click('.story-play', { clickCount: 2 });
    await page.evaluate(() => window.StoryIntro.play());
    await until(page, () => window.StoryIntro.state().scene === 2);
    const h = (await state(page)).history;
    check('double tap Play: one start', h.filter(e => e.event === 'play').length === 1);
    check('double tap Play: scene 1 entered once', h.filter(e => e.event === 'enter' && e.scene === 1).length === 1);
    check('double tap Play: one voice at a time', h.filter(e => e.event === 'voice' && e.scene === 1 && e.line === 1).length === 1);
    await page.keyboard.press('Escape');
    await context.close();
  },

  async tabSwitchPauses(browser, srv) {
    const { page, context } = await fresh(browser, srv);
    await ready(page); await page.click('.story-play');
    await until(page, () => { const s = window.StoryIntro.state(); return s.scene === 2 && s.phase === 'dialogue'; });
    const hide = (hidden) => page.evaluate((h) => {
      Object.defineProperty(document, 'hidden', { value: h, configurable: true });
      Object.defineProperty(document, 'visibilityState', { value: h ? 'hidden' : 'visible', configurable: true });
      document.dispatchEvent(new Event('visibilitychange'));
    }, hidden);
    await hide(true);
    const a = await state(page);
    await page.waitForTimeout(3000);
    const b = await state(page);
    check('tab hidden: story clock stops', Math.abs(b.clock - a.clock) < 150, `${a.clock} -> ${b.clock}`);
    check('tab hidden: stays on the same scene', a.scene === b.scene && b.scene === 2);
    check('tab hidden: audio suspended', b.audio === 'suspended', b.audio);
    await hide(false);
    await page.waitForTimeout(1500);
    const c = await state(page);
    check('tab visible again: story resumes', c.clock > b.clock + 800 && c.audio === 'running', `${b.clock} -> ${c.clock}, ${c.audio}`);
    await page.keyboard.press('Escape');
    await context.close();
  },

  async replay(browser, srv) {
    const { page, context, errors } = await fresh(browser, srv);
    await ready(page); await page.click('.story-play');
    await until(page, () => window.StoryIntro.state().scene === 3);
    // Mid-story: restart in place from the start card.
    await page.evaluate(() => { window.StoryIntro.replay(); });
    await ready(page);
    const card = await state(page);
    check('replay mid-story: back to the start card', card.phase === 'ready' && card.scene === 0 && !card.playing);
    await page.click('.story-play');
    await until(page, () => window.StoryIntro.state().scene === 3);
    const mid = await state(page);
    check('replay mid-story: plays from scene 1 again', mid.history.filter(e => e.event === 'enter').map(e => e.scene).join() === '1,2,3');
    check('replay mid-story: one voice at a time', mid.history.filter(e => e.event === 'voice').length <= 8);
    await page.keyboard.press('Escape');
    const started = await lessonStarted(page);
    check('replay mid-story: lesson starts once after', started);
    check('replay: listeners released', (await page.evaluate(() => window.StoryIntro.state().lastRun.listeners)) === 0);
    // After the lesson has begun: the whole experience starts over.
    const nav = page.waitForNavigation({ timeout: 10000 }).then(() => true, () => false);
    await page.evaluate(() => { window.StoryIntro.replay(); });
    check('replay after the lesson began: reloads from the start', await nav);
    await ready(page);
    check('replay after reload: start card is back', (await state(page)).phase === 'ready');
    check('replay: no page errors', !errors.length, errors.join(' | '));
    await context.close();
  },

  async oggFallsBackToMp3(browser, srv) {
    const { page, context } = await fresh(browser, srv, { route: { pattern: '**/assets/audio/story/*.ogg', handler: r => r.fulfill({ status: 404, body: '' }) } });
    await ready(page); await page.click('.story-play');
    await until(page, () => window.StoryIntro.state().scene === 3);
    const s = await state(page);
    check('Ogg missing: voices fall back to MP3', s.history.filter(e => e.event === 'voice').every(e => e.withAudio) && s.voiceLoaded, JSON.stringify(s.history.filter(e => e.event === 'voice')));
    check('Ogg missing: music falls back to MP3', s.music && s.music.loaded);
    await page.keyboard.press('Escape');
    await context.close();
  },

  async noAudioAtAll(browser, srv) {
    const { page, context } = await fresh(browser, srv, { route: { pattern: '**/assets/audio/story/*', handler: r => r.fulfill({ status: 404, body: '' }) } });
    await ready(page); await page.click('.story-play');
    const done = await until(page, () => !window.StoryIntro.state().active, null, 90000).then(() => true, () => false);
    const run = await page.evaluate(() => window.StoryIntro.state().lastRun);
    const scenes = run ? new Set(run.history.filter(e => e.event === 'line').map(e => e.scene)).size : 0;
    check('no audio: story still plays every line as text', done && scenes === 9, 'scenes with text ' + scenes);
    check('no audio: lesson starts afterwards', await lessonStarted(page));
    await context.close();
  },

  async missingArt(browser, srv) {
    const { page, context } = await fresh(browser, srv, { route: { pattern: '**/assets/story/scene-5.webp', handler: r => r.fulfill({ status: 404, body: '' }) } });
    check('missing scene art: goes straight to the lesson', await lessonStarted(page, 30000));
    await context.close();
  }
};

(async () => {
  const srv = await serve(ROOT);
  const browser = await pw[ENGINE].launch();
  for (const [name, fn] of Object.entries(SCENARIOS)) {
    if (ONLY && !ONLY.includes(name)) continue;
    try { await fn(browser, srv); } catch (e) { check(name + ' (crashed)', false, e.message.split('\n')[0]); }
  }
  await browser.close(); await srv.close();
  results.forEach(r => console.log((r.ok ? 'PASS ' : 'FAIL ') + r.name + (r.detail && !r.ok ? '  — ' + r.detail : '')));
  const failed = results.filter(r => !r.ok).length;
  console.log(`${results.length - failed}/${results.length} passed (${ENGINE})`);
  process.exit(failed ? 1 : 0);
})();
