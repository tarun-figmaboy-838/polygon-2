#!/usr/bin/env node
/* The production build, and what Vercel serves (vercel.json: buildCommand, outputDirectory):
   the files the game needs (everything .vercelignore does not exclude, less the build's own
   inputs), copied into dist/, with their comments taken out. The sources keep every comment;
   only the shipped copy loses them, and nothing else about the code changes: no renaming, no
   rewriting (terser with compress and mangle off), so what runs is what the sources say.
   Scripts, the scripts and markup inside the two HTML pages, and the stylesheets are stripped;
   licence comments (/*! or @license) stay. A size report follows.

     node tools/build-dist.cjs            build dist/ and report
     node tools/build-dist.cjs --report   report only, nothing written
     node tools/build-dist.cjs --keep-comments   copy without stripping

   dist/ is ignored by git. Serve it to QA the build itself:  npx serve dist */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const DIST = path.join(ROOT, 'dist');
const reportOnly = process.argv.includes('--report');
const keepComments = process.argv.includes('--keep-comments');
/* The build's own inputs: uploaded to Vercel so it can run this, never shipped. */
const NOT_SHIPPED = new Set(['package.json', 'package-lock.json', 'tools', '.vercelignore', '.gitignore', '.gitattributes']);

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
    if (r === 'dist' || r === '.git' || r === 'node_modules' || NOT_SHIPPED.has(r)) continue;
    if (ignored(r, e.isDirectory())) continue;
    if (e.isDirectory()) walk(r);
    else files.push(r);
  }
}
walk('');

/* ---- comments out of the shipped copy ---- */
const TERSER = { compress: false, mangle: false, ecma: 2022, format: { comments: 'some', ecma: 2022 } };
async function js(code, file) {
  const { minify } = require('terser');
  const module = /^\s*(import|export)\b/m.test(code);
  const out = await minify(code, Object.assign({}, TERSER, { module }));
  if (typeof out.code !== 'string') throw new Error('terser gave nothing for ' + file);
  return out.code;
}
/* A stylesheet's comments, reading past strings so a "/*" inside one is left alone. */
function css(text) {
  let out = '', i = 0, q = null;
  while (i < text.length) {
    const c = text[i];
    if (q) { out += c; if (c === '\\') { out += text[i + 1] || ''; i += 2; continue; } if (c === q) q = null; i++; continue; }
    if (c === '"' || c === "'") { q = c; out += c; i++; continue; }
    if (c === '/' && text[i + 1] === '*') {
      const end = text.indexOf('*/', i + 2);
      if (text[i + 2] === '!') { out += text.slice(i, end + 2); }
      i = end < 0 ? text.length : end + 2; continue;
    }
    out += c; i++;
  }
  return out.replace(/\n\s*\n+/g, '\n');
}
/* A page: its markup comments out, and each inline script's and style's comments too. Read in
   order, so a "<script>" written inside a comment is taken for the comment it is. */
async function html(text, file) {
  let out = '', i = 0;
  const lower = text.toLowerCase();
  while (i < text.length) {
    const lt = text.indexOf('<', i);
    if (lt < 0) { out += text.slice(i); break; }
    out += text.slice(i, lt); i = lt;
    if (text.startsWith('<!--', i)) {
      const end = text.indexOf('-->', i + 4);
      i = end < 0 ? text.length : end + 3;
      continue;
    }
    const tag = lower.startsWith('<script', i) ? 'script' : lower.startsWith('<style', i) ? 'style' : null;
    if (!tag) { out += '<'; i++; continue; }
    const open = text.indexOf('>', i) + 1, close = lower.indexOf('</' + tag, open);
    const head = text.slice(i, open), body = text.slice(open, close), shut = text.indexOf('>', close) + 1;
    if (tag === 'style') out += head + css(body) + text.slice(close, shut);
    else if (body.trim() && !/\bsrc=/i.test(head)) out += head + '\n' + await js(body, file) + '\n' + text.slice(close, shut);
    else out += text.slice(i, shut);
    i = shut;
  }
  return out.replace(/\n\s*\n+/g, '\n');
}
async function strip(f) {
  const p = path.join(DIST, f), text = fs.readFileSync(p, 'utf8');
  let out = text;
  if (/\.min\.js$/.test(f)) return;
  if (/\.(js|mjs)$/.test(f)) out = await js(text, f);
  else if (/\.css$/.test(f)) out = css(text);
  else if (/\.html?$/.test(f)) out = await html(text, f);
  else return;
  if (out.length < text.length) fs.writeFileSync(p, out);
}

(async () => {
if (!reportOnly) {
  fs.rmSync(DIST, { recursive: true, force: true });
  for (const f of files) {
    fs.mkdirSync(path.dirname(path.join(DIST, f)), { recursive: true });
    fs.copyFileSync(path.join(ROOT, f), path.join(DIST, f));
  }
  if (!keepComments) for (const f of files) await strip(f);
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
const sizes = files.map(f => ({ f, n: fs.statSync(path.join(reportOnly ? ROOT : DIST, f)).size }));
const total = sizes.reduce((s, x) => s + x.n, 0);
const mb = n => (n / 1048576).toFixed(2) + ' MB';
const by = {};
for (const x of sizes) { const k = kind(x.f); by[k] = by[k] || { n: 0, c: 0 }; by[k].n += x.n; by[k].c++; }
console.log((reportOnly ? 'The deployment would ship ' : 'dist/: ') + files.length + ' files, ' + mb(total));
for (const k of Object.keys(by).sort((a, b) => by[b].n - by[a].n)) console.log('  ' + k.padEnd(16) + mb(by[k].n).padStart(10) + '  (' + by[k].c + ' files)');
console.log('largest:');
for (const x of sizes.sort((a, b) => b.n - a.n).slice(0, 15)) console.log('  ' + mb(x.n).padStart(9) + '  ' + x.f);
})().catch(e => { console.error(e); process.exit(1); });
