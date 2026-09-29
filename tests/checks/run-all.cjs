#!/usr/bin/env node
/* Runs every lesson check in this folder, one at a time, and prints a
   summary. Browser checks ask for Google Chrome; without it installed,
   Playwright's own Chromium stands in (tests/helpers/bundled-chromium.cjs).

     npm run test:checks
     ONLY=check-sfx.cjs,check-morph.cjs npm run test:checks */
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');
const SHIM = path.join(__dirname, '..', 'helpers', 'bundled-chromium.cjs');
const only = process.env.ONLY ? process.env.ONLY.split(',') : null;
const TIMEOUT = Number(process.env.TIMEOUT || 420000);
const files = fs.readdirSync(__dirname)
  .filter(f => /^(check-|playwright-).*\.cjs$/.test(f) && (!only || only.includes(f)))
  .sort();

(async () => {
  const failed = [];
  for (const f of files) {
    const t0 = Date.now();
    const { code, out } = await new Promise(resolve => {
      const child = spawn(process.execPath, ['-r', SHIM, path.join(__dirname, f)], { cwd: ROOT, env: process.env });
      let out = '';
      const keep = d => { out = (out + d).slice(-20000); };
      child.stdout.on('data', keep);
      child.stderr.on('data', keep);
      const timer = setTimeout(() => { child.kill('SIGKILL'); out += '\n[timed out]'; }, TIMEOUT);
      child.on('close', c => { clearTimeout(timer); resolve({ code: c, out }); });
    });
    const secs = Math.round((Date.now() - t0) / 1000);
    if (code === 0) console.log(`PASS ${f} (${secs}s)`);
    else {
      failed.push(f);
      console.log(`FAIL ${f} (${secs}s)\n    ` + out.trim().split('\n').slice(-4).join('\n    '));
    }
  }
  console.log(`\n${files.length - failed.length}/${files.length} checks passed`);
  process.exit(failed.length ? 1 : 0);
})();
