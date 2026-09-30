#!/usr/bin/env node
/* Swiftee, loaded the way a learner loads her: a clean browser, no cache, a real (or a slow)
   connection, sampled every 100 ms. Runs against the local build, or against a deployed one:

     node tests/swiftee.test.cjs
     BASE=https://tarun-figmaboy-838.github.io/polygon-2/ node tests/swiftee.test.cjs

   - the sheet table: every clip's sheet is served (200, image/webp), decodes, and is exactly
     its grid (cols x rows cells of the table's cell size), with no more frames than cells
   - first load, cold cache, normal and slow network: while she is on screen her canvas is
     never blank, never collapses to nothing, never jumps across the screen outside a flight;
     she is never shown before her first frame is painted
   - a refresh with the cache warm: the same
   - the state machine: many state requests in a row, only the last one wins; a reaction
     started on one screen does not come back on the next
   - no Swiftee sheet fails, no page error */
const path = require('path');
const ROOT = path.resolve(__dirname, '..');
const pw = require('playwright');
const { serve } = require('./helpers/serve.cjs');
const ENGINE = process.env.ENGINE || 'chromium';

const results = [];
const check = (name, ok, detail) => results.push({ name, ok: !!ok, detail });
const noise = /\{\{|attribute/;
const SLOW = { offline: false, latency: 150, downloadThroughput: 1.6e6 / 8, uploadThroughput: 750e3 / 8 };

async function open(browser, base, opts = {}) {
  const context = opts.context || await browser.newContext({ viewport: { width: 1440, height: 810 } });
  const page = await context.newPage();
  const errors = [], failed = [];
  page.on('pageerror', e => { if (!noise.test(e.message)) errors.push(e.message); });
  page.on('console', m => { if (m.type() === 'error' && !noise.test(m.text())) errors.push(m.text()); if (/\[swiftee\]/.test(m.text())) errors.push(m.text()); });
  page.on('requestfailed', r => { if (/swiftee/i.test(r.url())) failed.push(r.url()); });
  page.on('response', r => { if (/assets\/swiftee\//.test(r.url()) && r.status() >= 400) failed.push(r.status() + ' ' + r.url()); });
  if (ENGINE === 'chromium' && (opts.cold || opts.slow)) {
    const cdp = await context.newCDPSession(page);
    await cdp.send('Network.enable');
    if (opts.cold) await cdp.send('Network.setCacheDisabled', { cacheDisabled: true });
    if (opts.slow) await cdp.send('Network.emulateNetworkConditions', SLOW);
  }
  await page.goto(base + (opts.query || '?intro=0'), { waitUntil: 'domcontentloaded', timeout: 180000 });
  await page.waitForFunction(() => window.__poly && window.__poly.state.ready && window.__poly.guide && window.__poly.guide.sprite, null, { timeout: 180000 });
  return { context, page, errors, failed };
}

/* Sample her for `ms`: on screen or not, a painted frame or a blank canvas, her box, the clip
   she has been told to play and the one on the canvas, and whether the lesson is moving her. */
function sample(page, ms) {
  return page.evaluate(ms => new Promise(resolve => {
    const g = window.__poly, sp = g.guide.sprite, out = [], t0 = performance.now();
    const tick = () => {
      const c = g.guideRef && g.guideRef.current, wrap = c && c.parentElement, vp = wrap && wrap.parentElement;
      let visible = false, blank = true, box = null;
      if (c) {
        const r = c.getBoundingClientRect();
        box = { x: r.x + r.width / 2, y: r.y + r.height / 2, w: r.width, h: r.height };
        const op = [c, wrap, vp].reduce((a, el) => a * (el ? +getComputedStyle(el).opacity : 1), 1);
        visible = op > 0.05 && getComputedStyle(wrap).visibility !== 'hidden' && !g.state.guideHidden && r.bottom > 0 && r.right > 0;
        try { const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; let a = 0; for (let i = 3; i < d.length; i += 64) a += d[i]; blank = a === 0; } catch (e) {}
      }
      const st = g.state;
      out.push({ t: Math.round(performance.now() - t0), visible, blank, box, want: sp.seg ? sp.seg.clip : null, drawn: c ? c.dataset.clip || null : null,
        moving: !!(st.guideFlying || st.boundaryTravel || st.polygonTravel || st.compareHop), k: st.k });
      if (performance.now() - t0 < ms) setTimeout(tick, 100); else resolve(out);
    };
    tick();
  }), ms);
}
function judge(tag, s, errors, failed) {
  const shown = s.filter(x => x.visible);
  const blank = shown.filter(x => x.blank);
  check(tag + ': she is on screen', shown.length > 0, s.length + ' samples');
  check(tag + ': never on screen as an empty cell', !blank.length, blank.slice(0, 5).map(x => x.t + 'ms ' + x.want).join(', '));
  check(tag + ': her first moment on screen already has a frame', shown.length && !shown[0].blank, shown[0] && JSON.stringify(shown[0]));
  const collapsed = shown.filter(x => !x.box || x.box.w < 40 || x.box.h < 40);
  check(tag + ': her box never collapses', !collapsed.length, collapsed.slice(0, 3).map(x => JSON.stringify(x.box)).join(' '));
  const jumps = [];
  for (let i = 1; i < s.length; i++) {
    const a = s[i - 1], b = s[i];
    if (!a.visible || !b.visible || a.moving || b.moving || a.k !== b.k) continue;
    const d = Math.hypot(b.box.x - a.box.x, b.box.y - a.box.y), dz = Math.abs(b.box.w - a.box.w) / Math.max(1, a.box.w);
    if (d > 300 || dz > 0.4) jumps.push(b.t + 'ms moved ' + Math.round(d) + 'px, size x' + (b.box.w / a.box.w).toFixed(2));
  }
  check(tag + ': no teleport, no size jump', !jumps.length, jumps.slice(0, 3).join('; '));
  check(tag + ': no Swiftee sheet failed', !failed.length, failed.join(', '));
  check(tag + ': no page errors', !errors.length, errors.slice(0, 3).join(' | '));
}

(async () => {
  const srv = process.env.BASE ? null : await serve(ROOT);
  const BASE = process.env.BASE || srv.url + '/';
  const browser = await pw[ENGINE].launch();
  console.log('testing ' + BASE);

  /* 1. the sheet table against the sheets actually served */
  try {
    const { context, page } = await open(browser, BASE, { cold: true });
    const audit = await page.evaluate(async () => {
      const S = window.SWIFTEE, out = [];
      for (const [name, c] of Object.entries(S.clips)) {
        const r = await fetch(c.image, { cache: 'no-store' });
        const type = r.headers.get('content-type') || '';
        let w = 0, h = 0, ok = r.ok;
        try { const bmp = await createImageBitmap(await r.blob()); w = bmp.width; h = bmp.height; } catch (e) { ok = false; }
        out.push({ name, url: c.image, status: r.status, type, w, h, cols: c.cols, rows: c.rows, frames: c.frames, cell: S.cell, ok });
      }
      return out;
    });
    const bad = audit.filter(a => !a.ok || a.status !== 200 || !/webp/.test(a.type) || a.w !== a.cols * a.cell || a.h !== a.rows * a.cell || a.frames > a.cols * a.rows || a.frames <= (a.rows - 1) * a.cols);
    check('sheet table: all ' + audit.length + ' sheets are served, decode, and match their grids', audit.length > 30 && !bad.length, bad.map(a => a.name + ' ' + a.status + ' ' + a.type + ' ' + a.w + 'x' + a.h).join('; '));
    await context.close();
  } catch (e) { check('scenario crashed: ' + e.message.split('\n')[0], false); }

  /* 2. first load, cold cache, normal network */
  try {
    const { context, page, errors, failed } = await open(browser, BASE, { cold: true });
    judge('cold, normal network', await sample(page, 9000), errors, failed);
    await context.close();
  } catch (e) { check('scenario crashed: ' + e.message.split('\n')[0], false); }

  /* 3. first load, cold cache, slow network: the lesson waits for her */
  if (ENGINE === 'chromium') try {
    const { context, page, errors, failed } = await open(browser, BASE, { cold: true, slow: true });
    const s = await sample(page, 9000);
    judge('cold, slow network', s, errors, failed);
    const firstShown = s.find(x => x.visible);
    const readyAt = await page.evaluate(() => { const d = window.__poly.guide.sprite.decoded; return d ? d.size : -1; });   // -1: a build without the preloader
    check('cold, slow network: screen 1 waited for her sheets (she arrived with them)', !!firstShown && !firstShown.blank && readyAt >= 11, JSON.stringify({ firstShown, decoded: readyAt }));
    await context.close();
  } catch (e) { check('scenario crashed: ' + e.message.split('\n')[0], false); }

  /* 4. a refresh with the cache warm */
  try {
    const context = await browser.newContext({ viewport: { width: 1440, height: 810 } });
    const first = await open(browser, BASE, { context });
    await sample(first.page, 3000);
    await first.page.close();
    const again = await open(browser, BASE, { context });
    judge('refresh, cache warm', await sample(again.page, 6000), again.errors, again.failed);
    await context.close();
  } catch (e) { check('scenario crashed: ' + e.message.split('\n')[0], false); }

  /* 5. the state machine under rapid requests, and across a screen change */
  try {
    const { context, page, errors } = await open(browser, BASE, { cold: true });
    await page.waitForFunction(() => { const g = window.__poly, d = g.guide.sprite.decoded; return g.state.k === 0 && !g.state.guideFlying && (!d || d.size >= 11); }, null, { timeout: 60000 });
    await page.waitForTimeout(1500);
    const last = await page.evaluate(() => {
      const g = window.__poly.guide;
      g.onSurprise(); g.onInteractionStart(); g.onWrongAttempt(); g.onCorrectAnswer();
      return new Promise(r => setTimeout(() => r(g.sprite.seg && g.sprite.seg.clip), 150));
    });
    const happy = await page.evaluate(() => window.SWIFTEE.states.happy.loop);
    check('rapid state requests: only the last one (the right answer) wins', last === happy, last);
    const after = await page.evaluate(() => new Promise(resolve => {
      const g = window.__poly;
      g.guide.onCorrectAnswer();                  // a reaction on this screen...
      g.setState({ k: 1 }, () => g.runStep(1, false));   // ...then straight on to the next
      setTimeout(() => resolve({ clip: g.guide.sprite.seg && g.guide.sprite.seg.clip, reaction: !!g.guide.reaction }), 2500);
    }));
    check('a reaction from one screen does not come back on the next', after.clip !== happy && !after.reaction, JSON.stringify(after));
    const s = await sample(page, 3000);
    check('after the screen change she is still drawn', s.filter(x => x.visible).every(x => !x.blank), '');
    check('state machine: no page errors', !errors.length, errors.slice(0, 3).join(' | '));
    await context.close();
  } catch (e) { check('scenario crashed: ' + e.message.split('\n')[0], false); }

  await browser.close();
  if (srv) await srv.close();
  results.forEach(r => console.log((r.ok ? 'PASS ' : 'FAIL ') + r.name + (r.detail && !r.ok ? '  — ' + r.detail : '')));
  const failedN = results.filter(r => !r.ok).length;
  console.log(`${results.length - failedN}/${results.length} passed (${ENGINE})`);
  process.exit(failedN ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
