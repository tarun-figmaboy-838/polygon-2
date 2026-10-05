#!/usr/bin/env node
/* Rebuilds the runner game's two generated files from what is in game/, the way
   tools/build-bundle.mjs in the running-mammoth repository does (the bundle comes out byte
   for byte as that tool made it), so a change to a module or to game/assets can be carried
   here without that repository:

     game/js/asset-versions.js   the first 8 hex of the MD5 of every file under game/assets,
                                 which the engine puts on each asset URL as ?v=
     game/js/game.bundle.js      the modules in their order, as one classic script for
                                 opening game/index.html straight off the disk: each import
                                 dropped (one renamed on import becomes a const), `export `
                                 taken off, the whole wrapped in one function

     node tools/build-game-bundle.cjs           write both
     node tools/build-game-bundle.cjs --check   write nothing; exit 1 if either is out of date

   The game's stylesheets name a few pictures with a ?v= of their own; those are kept by hand
   (tests/media.test.cjs checks the raster ones against this table). */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const GAME = path.resolve(__dirname, '..', 'game');
const JS = path.join(GAME, 'js');
const ORDER = ['asset-versions.js', 'polygons.js', 'option-shapes.js', 'avalanche.js', 'engine.js',
  'bubble.js', 'hud.js', 'frontend.js', 'tutorial.js', 'main.js'];

function walk(d, out = []) {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (!e.name.startsWith('.')) out.push(p);
  }
  return out;
}

function versions() {
  const file = path.join(JS, 'asset-versions.js');
  const head = fs.readFileSync(file, 'utf8').split('export const ASSET_V = {')[0];
  const rows = walk(path.join(GAME, 'assets'))
    .map(p => path.relative(GAME, p).split(path.sep).join('/'))
    .sort()
    .map(f => `  "${f}": "${crypto.createHash('md5').update(fs.readFileSync(path.join(GAME, f))).digest('hex').slice(0, 8)}"`);
  return head + 'export const ASSET_V = {\n' + rows.join(',\n') + '\n};\n';
}

function bundle(sources) {
  const head = fs.readFileSync(path.join(JS, 'game.bundle.js'), 'utf8').split('/* ==================== ')[0];
  let out = head;
  for (const name of ORDER) {
    let src = sources[name];
    const alias = [];
    src = src.replace(/^import\s*\{([^}]*)\}\s*from\s*'[^']+';\n/gm, (m, names) => {
      for (const part of names.split(',')) {
        const mm = part.trim().match(/^(\w+)\s+as\s+(\w+)$/);
        if (mm) alias.push(`const ${mm[2]} = ${mm[1]};\n`);
      }
      return '';
    });
    src = src.replace(/^export (?=(const|let|var|function|async function|class)\b)/gm, '');
    out += `/* ==================== ${name} ==================== */\n` + alias.join('') + src + '\n\n';
  }
  return out.replace(/\n\n$/, '\n') + '\n})();\n';
}

const check = process.argv.includes('--check');
const sources = {};
for (const name of ORDER) sources[name] = fs.readFileSync(path.join(JS, name), 'utf8');
sources['asset-versions.js'] = versions();
const outputs = { 'asset-versions.js': sources['asset-versions.js'], 'game.bundle.js': bundle(sources) };
let stale = 0;
for (const [name, text] of Object.entries(outputs)) {
  const file = path.join(JS, name);
  const same = fs.readFileSync(file, 'utf8') === text;
  if (check) { if (!same) { stale++; console.error(`game/js/${name} is out of date: run node tools/build-game-bundle.cjs`); } }
  else if (!same) { fs.writeFileSync(file, text); console.log(`wrote game/js/${name}`); }
  else console.log(`game/js/${name} is up to date`);
}
process.exit(stale ? 1 : 0);
