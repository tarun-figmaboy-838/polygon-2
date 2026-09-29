#!/usr/bin/env node
/* Story end-to-end: plays the Momo + Polo story like a child would (tap Play,
   watch to the end) on several screens, and checks:
     - scenes 1-9 in order, each with its own image
     - the exact script, one line at a time, with the right speaker
     - every line voiced, voices clearly above the music, no clipping
     - all five music sections heard (warm, playful, tension, hush, resolve)
     - one handoff, the blizzard, then the lesson from its first screen
     - no listeners left behind
   Screenshots of every scene at its held moment go to tests/output/story/.

   node tests/story.test.cjs                 all devices, Chromium
   DEVICES=desktop,phone-port node tests/story.test.cjs
   ENGINE=webkit node tests/story.test.cjs  Safari's engine (after
                                             `npx playwright install webkit`) */
const path = require('path');
const fs = require('fs');
const ROOT = path.resolve(__dirname, '..');
const pw = require('playwright');
const { serve } = require('./helpers/serve.cjs');

const ENGINE = process.env.ENGINE || 'chromium';
const OUT = path.join(__dirname, 'output', 'story');
const DEVICES = {
  desktop: { viewport: { width: 1920, height: 1080 } },
  laptop: { viewport: { width: 1366, height: 768 } },
  tablet: { viewport: { width: 1024, height: 768 }, deviceScaleFactor: 2, hasTouch: true },
  'phone-land': { viewport: { width: 844, height: 390 }, deviceScaleFactor: 3, hasTouch: true },
  'phone-port': { viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, hasTouch: true },
  reduced: { viewport: { width: 1280, height: 800 }, reducedMotion: 'reduce' }
};
const PICK = process.env.DEVICES ? process.env.DEVICES.split(',') : Object.keys(DEVICES);

const SCRIPT = [
  ['narrator', 'Long ago, Momo the mammoth and Polo the polar bear were best friends.'],
  ['narrator', 'One day, Polo spotted something shiny beneath the ice.'],
  ['polo', 'Momo, look! Something is buried here!'],
  ['momo', 'Let us pull it out!'],
  ['polo', 'Almost there! One more pull!'],
  ['momo', 'Uh-oh...'],
  ['polo', 'Run!'],
  ['momo', 'Polo!'],
  ['polo', 'Momo, keep going! I will find another way!']
];

async function playThrough(browser, srv, tag, device) {
  const context = await browser.newContext(Object.assign({ deviceScaleFactor: 1 }, device));
  await context.addInitScript({ path: path.join(__dirname, 'helpers', 'audio-meter.js') });
  const page = await context.newPage();
  const fail = [];
  page.on('pageerror', e => { if (!/\{\{|attribute/.test(e.message)) fail.push('page error: ' + e.message); });

  await page.goto(srv.url + '/?story=1', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.StoryIntro.state().ready === true, null, { timeout: 30000 });
  await page.waitForTimeout(700);
  await page.screenshot({ path: path.join(OUT, `${tag}-00-start.png`) });
  if (device.hasTouch) await page.tap('.story-play'); else await page.click('.story-play');

  const shot = new Set();
  const levels = [];
  const t0 = Date.now();
  for (;;) {
    const st = await page.evaluate(() => Object.assign(window.StoryIntro.state(), { level: (window.__audioLevel() || [])[0] }));
    if (!st.active) break;
    if (st.level && st.playing) levels.push({ vo: st.isVOPlaying, phase: st.phase, section: st.music && st.music.section, db: st.level.rmsDb, peak: st.level.peak });
    if (st.phase === 'actionHold' && !shot.has(st.scene)) {
      shot.add(st.scene);
      await page.screenshot({ path: path.join(OUT, `${tag}-${String(st.scene).padStart(2, '0')}.png`) });
    }
    if (Date.now() - t0 > 120000) { fail.push('story did not finish within 120s'); break; }
    await page.waitForTimeout(60);
  }
  const seconds = (Date.now() - t0) / 1000;
  const run = await page.evaluate(() => window.StoryIntro.state().lastRun);
  const blizzard = await page.waitForSelector('#ice-intro', { timeout: 5000 }).then(() => true, () => false);
  await page.waitForFunction(() => !document.getElementById('ice-intro'), null, { timeout: 15000 }).catch(() => fail.push('blizzard did not finish'));
  await page.waitForFunction(() => window.__poly && window.__poly.state.narr, null, { timeout: 12000 }).catch(() => {});
  const lesson = await page.evaluate(() => ({ k: window.__poly.state.k, narr: window.__poly.state.narr, overlay: !!document.getElementById('story-intro') }));

  const h = run ? run.history : [];
  const enters = h.filter(e => e.event === 'enter');
  const lines = h.filter(e => e.event === 'line');
  const voices = h.filter(e => e.event === 'voice');
  if (enters.map(e => e.scene).join() !== '1,2,3,4,5,6,7,8,9') fail.push('scene order ' + enters.map(e => e.scene).join());
  enters.forEach((e, i) => { if (e.image !== `scene-${i + 1}.webp`) fail.push(`scene ${i + 1} showed ${e.image}`); });
  /* Each script line is shown one short line at a time; joined, a scene's
     lines must be exactly its script line, all in the right speaker's voice. */
  SCRIPT.forEach(([speaker, line], i) => {
    const mine = lines.filter(b => b.scene === i + 1);
    const joined = mine.map(b => b.text).join(' ');
    if (joined !== line) fail.push(`scene ${i + 1} text "${joined}"`);
    if (mine.some(b => b.speaker !== speaker)) fail.push(`scene ${i + 1} speaker ${mine.map(b => b.speaker).join()}`);
  });
  if (voices.length !== lines.length || voices.some(v => !v.withAudio)) fail.push('voiced lines: ' + voices.filter(v => v.withAudio).length + '/' + lines.length);
  if (h.filter(e => e.event === 'handoff').length !== 1) fail.push('handoff count');
  if (!run || run.listeners !== 0) fail.push('listeners left after the story');
  if (!blizzard) fail.push('blizzard never started');
  if (lesson.overlay) fail.push('story overlay still on the page');
  if (!(lesson.k <= 1 && lesson.narr)) fail.push('lesson did not start from the beginning: ' + JSON.stringify(lesson));

  const heard = levels.filter(l => l.db > -119);
  const avg = a => a.length ? a.reduce((x, y) => x + y, 0) / a.length : -120;
  const voice = avg(heard.filter(l => l.vo).map(l => l.db));
  const bed = avg(heard.filter(l => !l.vo && l.phase === 'actionHold').map(l => l.db));
  const peak = Math.max(0, ...levels.map(l => l.peak));
  const sections = [...new Set(levels.map(l => l.section).filter(Boolean))].join();
  if (!(voice > bed + 6)) fail.push(`voices not clearly above the music (${voice.toFixed(1)} vs ${bed.toFixed(1)} dB)`);
  if (bed < -60) fail.push('music is silent');
  if (peak >= 0.99) fail.push('audio clips');
  if (sections !== 'warm,playful,tension,hush,resolve') fail.push('music sections: ' + sections);

  await context.close();
  return { tag, seconds, fail, sound: `voice ${voice.toFixed(1)} dB, music ${bed.toFixed(1)} dB, peak ${peak.toFixed(2)}` };
}

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const srv = await serve(ROOT);
  const browser = await pw[ENGINE].launch();
  let failed = 0;
  for (const tag of PICK) {
    const r = await playThrough(browser, srv, (ENGINE === 'chromium' ? '' : ENGINE + '-') + tag, DEVICES[tag]);
    console.log(`${r.fail.length ? 'FAIL' : 'PASS'} story on ${r.tag} (${r.seconds.toFixed(1)}s; ${r.sound})${r.fail.length ? '\n  - ' + r.fail.join('\n  - ') : ''}`);
    if (r.fail.length) failed++;
  }
  await browser.close();
  await srv.close();
  process.exit(failed ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
