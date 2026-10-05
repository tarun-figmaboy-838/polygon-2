#!/usr/bin/env node
/* The translations side by side, for reading them over: docs/i18n/translations-review.html,
   made from src/i18n/locales.json. Run it after changing the JSON:

     npm run build:i18n-review

   Each row is one key: its English (the game's own words, as written in the code) and the
   five translations, the key words marked with <strong> shown in colour. */
const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..', '..');
const L = JSON.parse(fs.readFileSync(path.join(ROOT, 'src/i18n/locales.json'), 'utf8'));
const CODES = ['en', 'hi', 'mr', 'te', 'gu', 'od'];
const TAG = { od: 'or' };
const NAMES = L.languageLabels.en;
const GROUPS = [
  ['Titles, buttons and labels', k => /^(lessonTitle|swifteeGuideLabel|ui|lang)/.test(k)],
  ['The game\'s tutorial', k => /^game(Meet|Goal|WatchOut|TapJump|PathBroken|UseIcePiece|UsePiece|PerfectFit)$/.test(k)],
  ['The plank\'s questions', k => /^sign/.test(k)],
  ['Swiftee over the game', k => /^swiftee/.test(k)],
  ['The lesson\'s lines and feedback', k => /^(s\d\d|oc|fb|polygonRule|countCarefully)/.test(k)],
  ['The recap', k => /^recap/.test(k)],
  ['The quizzes', k => /^c\d/.test(k)],
  ['The end', k => /^endReady$/.test(k)],
  ['Screen readers', k => /^a11y/.test(k)],
  ['The game\'s page and controls', k => /^game/.test(k)],
  ['Names', k => /^name/.test(k)],
  ['The words themselves (key words and labels)', k => /^term/.test(k)]
];
const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const cell = s => esc(s).replace(/&lt;strong&gt;/g, '<strong>').replace(/&lt;\/strong&gt;/g, '</strong>');
const keys = Object.keys(L.en);
const placed = new Set();
let rows = '';
for (const [title, test] of GROUPS) {
  const mine = keys.filter(k => !placed.has(k) && test(k));
  if (!mine.length) continue;
  mine.forEach(k => placed.add(k));
  rows += `<tr class="g"><th colspan="${CODES.length + 1}">${esc(title)} <span>(${mine.length})</span></th></tr>`;
  for (const k of mine) rows += `<tr><td class="k">${esc(k)}</td>${CODES.map(c => `<td lang="${TAG[c] || c}">${cell(L[c][k])}</td>`).join('')}</tr>`;
}
const rest = keys.filter(k => !placed.has(k));
if (rest.length) {
  rows += `<tr class="g"><th colspan="${CODES.length + 1}">Other <span>(${rest.length})</span></th></tr>`;
  for (const k of rest) rows += `<tr><td class="k">${esc(k)}</td>${CODES.map(c => `<td lang="${TAG[c] || c}">${cell(L[c][k])}</td>`).join('')}</tr>`;
}
const head = CODES.map(c => `<th>${esc(NAMES[c])}<br><small>${esc(L.languageLabels[c][c])}</small></th>`).join('');
const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Polygon Translations</title><style>
:root{--bg:#f5f8fc;--card:#fff;--ink:#14263d;--soft:#5b6c82;--line:#dbe4ee;--hl:#7b249c;--group:#e8f0fa}
@media (prefers-color-scheme:dark){:root{--bg:#0e1828;--card:#15233a;--ink:#e6eef8;--soft:#9fb1c7;--line:#26395a;--hl:#d79cf0;--group:#1c2e4a}}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--ink);font:15px/1.45 system-ui,-apple-system,"Segoe UI",sans-serif}
main{padding:24px 16px 60px}h1{font-size:24px;margin:0 0 6px}p{color:var(--soft);margin:0 0 6px;max-width:900px}
.wrap{overflow:auto;border:1px solid var(--line);border-radius:12px;background:var(--card);margin-top:14px}
table{border-collapse:collapse;min-width:1300px;width:100%}th,td{padding:8px 10px;border-bottom:1px solid var(--line);vertical-align:top;text-align:left}
thead th{position:sticky;top:0;background:var(--card);z-index:1;font-size:13px}thead small{color:var(--soft);font-weight:400}
tr.g th{background:var(--group);font-size:14px}tr.g span{color:var(--soft);font-weight:400}
td.k{font:12px ui-monospace,Menlo,monospace;color:var(--soft);white-space:nowrap}strong{color:var(--hl)}
</style></head><body><main><h1>Polygon Adventure: translations</h1>
<p>${keys.length} entries in ${CODES.length} languages, from <code>src/i18n/locales.json</code>. English is the game's own text, word for word. Open the game in a language with <code>?lan=</code>: <code>hi</code>, <code>mr</code>, <code>te</code>, <code>gu</code>, <code>od</code>.</p>
<p><strong>Coloured words</strong> are the key words the game highlights (marked <code>&lt;strong&gt;</code> in the file). In English the game finds them by itself, so the English text has no marks. Placeholders like <code>{label}</code> are filled in by the game.</p>
<div class="wrap"><table><thead><tr><th>Key</th>${head}</tr></thead><tbody>${rows}</tbody></table></div></main></body></html>
`;
fs.writeFileSync(path.join(ROOT, 'docs/i18n/translations-review.html'), html);
console.log('docs/i18n/translations-review.html: ' + keys.length + ' entries');
