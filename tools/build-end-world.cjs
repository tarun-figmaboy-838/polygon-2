#!/usr/bin/env node
/* The lesson's last screen, drawn by the game: Frozen Rush's world at its first ditch.

   Swiftee says her line back to Momo ("Now you know everything about polygons. You are ready
   to help Momo.") standing on the game's own ice path, with the gap she is sending the learner
   to just ahead of her. This renders that picture with the game itself, so it is the game's
   sky, mountains, path, caps and crevasse exactly as the learner sees them a moment later:
   the run is played to the first break and held the instant the ice has fully opened (before
   the ropes and the pieces arrive), Momo is left out (Swiftee stands where he would be), the
   loose snow puffs are cleared, and the frame is taken at twice the stage's resolution.

   The game's 1920 x 1080 stage is the lesson's 1980 x 1114 at the same 16:9, so the picture
   covers the lesson's stage as it is; the walking surface (CFG.surfaceY, 840) lands at 866 of
   1114, which is where the last screen puts Swiftee's feet (index.html: END_GUIDE).

   Usage:  node tools/build-end-world.cjs        (npm run build:end-world)
   Output: assets/images/end-world.webp           Needs Playwright's Chromium and sharp. */
const fs = require('fs');
const path = require('path');
const pw = require('playwright');
const sharp = require('sharp');
const { serve } = require('../tests/helpers/serve.cjs');

const ROOT = path.resolve(__dirname, '..');
const OUT = path.join(ROOT, 'assets', 'images', 'end-world.webp');
const WIDTH = 2560;                       // written at 2560 x 1440: crisp on a hi-DPI screen

(async () => {
  const srv = await serve(ROOT);
  const browser = await pw.chromium.launch({ args: ['--mute-audio'] });
  try {
    const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
    // straight into the run, no tutorial, silent, reduced motion (no falling snow baked into a still)
    await page.goto(srv.url + '/game/index.html?skip=1&tutorial=0&sound=0&intro=0&reduced=1&rs=2&hd=1&fast=3', { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => window.iceAgeGame && !['BOOT', 'TITLE'].includes(window.iceAgeGame.state()), null, { timeout: 120000 });
    await page.evaluate(() => { window.iceAgeGame._player().draw = function () {}; });
    const end = Date.now() + 180000;
    let shot = null;
    while (!shot && Date.now() < end) {
      const s = await page.evaluate(() => {
        const G = window.iceAgeGame.debug(), g = (G.gapsThisPhase || [])[0];
        return { open: g ? g.open || 0 : 0, l1: !!G.l1, gap: g ? [Math.round(g.x0 - G.worldX), Math.round(g.x1 - G.worldX)] : null };
      });
      if (s.open >= 0.999 && !s.l1) {
        shot = await page.evaluate(() => {
          const game = window.iceAgeGame;
          game.setPaused(true);
          const P = game._particles();
          if (P && P.list) P.list.length = 0;
          game._renderOnce();
          return document.getElementById('game-canvas').toDataURL('image/png');
        });
        console.log('the ice is open: gap at ' + s.gap.join('-') + ' of the 1920 stage');
        break;
      }
      await page.evaluate(() => window.iceAgeGame.jump && window.iceAgeGame.jump());
      await page.waitForTimeout(40);
    }
    if (!shot) throw new Error('the run never reached its first break');
    await sharp(Buffer.from(shot.split(',')[1], 'base64'))
      .resize({ width: WIDTH })
      .webp({ quality: 82 })
      .toFile(OUT);
    console.log('wrote ' + path.relative(ROOT, OUT) + ' (' + Math.round(fs.statSync(OUT).size / 1024) + ' KB)');
  } finally {
    await browser.close();
    await srv.close();
  }
})().catch(e => { console.error(e); process.exit(1); });
