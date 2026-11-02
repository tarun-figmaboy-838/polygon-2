#!/usr/bin/env node
/* The production build: the files the deployment ships, copied into dist/ exactly as Vercel
   takes them from the repository (everything .vercelignore does not exclude), with a size
   report. There is no bundling or minification here, by design: the page is static and its
   sources are what runs (README: "no build step"); the host compresses text on the wire.

     node tools/build-dist.cjs            copy into dist/ and report
     node tools/build-dist.cjs --report   report only, nothing written

   dist/ is ignored by git. Serve it to QA the build itself:  npx serve dist */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const DIST = path.join(ROOT, 'dist');
const reportOnly = process.argv.includes('--report');

/* .vercelignore uses .gitignore's rules; the subset this project uses is:
     name/        a directory of that name anywhere
     name         a file or directory of that name anywhere (with * and ? as globs)
     a/b/c/       a path from the root (a slash before the end anchors it) */
function parseIgnore(text) {
  return text.split('\n').map(l => l.trim()).filter(l => l && !l.startsWith('#')).map(line => {
    const dirOnly = line.endsWith('/');
    const body = line.replace(/\/+$/, '').replace(/^\//, '');
    const anchored = body.includes('/');
    const re = new RegExp('^' + body.split('*').map(s => s.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\?/g, '.')).join('[^/]*') + '$');
    return { dirOnly, anchored, re };
  });
}
const rules = parseIgnore(fs.readFileSync(path.join(ROOT, '.vercelignore'), 'utf8'));
function ignored(rel, isDir) {
  const segs = rel.split('/');
  return rules.some(r => {
    if (r.dirOnly && !isDir) return false;
    if (r.anchored) return r.re.test(rel);
    return r.re.test(segs[segs.length - 1]);
  });
}

const files = [];
function walk(rel) {
  for (const e of fs.readdirSync(path.join(ROOT, rel || '.'), { withFileTypes: true })) {
    const r = rel ? rel + '/' + e.name : e.name;
    if (r === 'dist' || r === '.git' || r === 'node_modules') continue;
    if (ignored(r, e.isDirectory())) continue;
    if (e.isDirectory()) walk(r);
    else files.push(r);
  }
}
walk('');

if (!reportOnly) {
  fs.rmSync(DIST, { recursive: true, force: true });
  for (const f of files) {
    fs.mkdirSync(path.dirname(path.join(DIST, f)), { recursive: true });
    fs.copyFileSync(path.join(ROOT, f), path.join(DIST, f));
  }
}

const kind = f => {
  if (/\.(html?)$/.test(f)) return 'html';
  if (/\.(js|cjs|mjs|json)$/.test(f)) return 'scripts + data';
  if (/\.css$/.test(f)) return 'css';
  if (/\.woff2?$/.test(f)) return 'fonts';
  if (/\.(webp|avif|png|jpe?g|svg|gif)$/.test(f)) return 'images';
  if (/\.(ogg|mp3|wav|flac)$/.test(f)) return 'audio';
  return 'other';
};
const sizes = files.map(f => ({ f, n: fs.statSync(path.join(ROOT, f)).size }));
const total = sizes.reduce((s, x) => s + x.n, 0);
const mb = n => (n / 1048576).toFixed(2) + ' MB';
const by = {};
for (const x of sizes) { const k = kind(x.f); by[k] = by[k] || { n: 0, c: 0 }; by[k].n += x.n; by[k].c++; }
console.log((reportOnly ? 'The deployment would ship ' : 'dist/: ') + files.length + ' files, ' + mb(total));
for (const k of Object.keys(by).sort((a, b) => by[b].n - by[a].n)) console.log('  ' + k.padEnd(16) + mb(by[k].n).padStart(10) + '  (' + by[k].c + ' files)');
console.log('largest:');
for (const x of sizes.sort((a, b) => b.n - a.n).slice(0, 15)) console.log('  ' + mb(x.n).padStart(9) + '  ' + x.f);
