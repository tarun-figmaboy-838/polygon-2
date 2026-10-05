#!/usr/bin/env node
/* The media formats (README: Media formats): AVIF with WebP behind it, Ogg Opus with MP3
   behind it, and every picture and sound fetched in one format only.

   On disk
     - every .ogg is Ogg Opus, sound only (no cover art riding along as a video stream), and
       has its .mp3; no game MP3 carries a picture
     - every .avif decodes, is the size of its .webp, and is named somewhere that can ask for it
     - game/js/asset-versions.js and game.bundle.js are what tools/build-game-bundle.cjs makes,
       and every ?v= in the game's stylesheets is the table's
     - every image-set() in a stylesheet has the plain WebP before it, or is under @supports
   In the browser, for the opening (the game's cover and PLAY), the lesson (its buttons, the
   recap, the end) and the Help Momo scene:
     - AVIF: a picture with a twin comes as AVIF, the rest as WebP, none in both formats; the
       game decodes every sound from its Ogg Opus file
     - no AVIF (the page's AVIF probe made to fail, and the stylesheets read as a browser that
       has no image-set() reads them): not one AVIF is asked for, each of those pictures comes
       as its WebP, and nothing fails
     - no Ogg (canPlayType says no): every sound comes as its MP3 and the game decodes them all

   node tests/media.test.cjs          ENGINE=webkit node tests/media.test.cjs */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { execFileSync } = require('child_process');
const ROOT = path.resolve(__dirname, '..');
const pw = require('playwright');
const sharp = require('sharp');
const { serve } = require('./helpers/serve.cjs');
const ENGINE = process.env.ENGINE || 'chromium';

const results = [];
const check = (name, ok, detail) => results.push({ name, ok: !!ok, detail });
const noise = /\{\{|attribute/;
const rel = p => path.relative(ROOT, p).split(path.sep).join('/');
function walk(d, out = []) {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, e.name);
    if (e.isDirectory()) walk(p, out); else out.push(p);
  }
  return out;
}
const shipped = walk(path.join(ROOT, 'assets')).concat(walk(path.join(ROOT, 'game', 'assets')))
  .map(rel).filter(f => !f.startsWith('assets/audio/source/'));
const AVIFS = shipped.filter(f => f.endsWith('.avif'));

async function onDisk() {
  /* the sounds */
  const oggs = shipped.filter(f => f.endsWith('.ogg'));
  const notOpus = oggs.filter(f => {
    const head = fs.readFileSync(path.join(ROOT, f)).subarray(0, 4096).toString('latin1');
    return !head.startsWith('OggS') || !head.includes('OpusHead') || /theora|\x01vorbis/.test(head);
  });
  check(`every .ogg is Ogg Opus, sound only (${oggs.length})`, oggs.length > 100 && !notOpus.length, notOpus.join(', '));
  const lone = oggs.filter(f => !fs.existsSync(path.join(ROOT, f.replace(/\.ogg$/, '.mp3'))));
  check('every .ogg has its .mp3', !lone.length, lone.join(', '));
  const pictured = shipped.filter(f => f.startsWith('game/assets/audio/') && f.endsWith('.mp3')).filter(f => {
    const d = fs.readFileSync(path.join(ROOT, f)).subarray(0, 65536);
    return d.subarray(0, 3).toString() === 'ID3' && d.indexOf('APIC') > 0;
  });
  check('no game MP3 carries a picture', !pictured.length, pictured.join(', '));

  /* the pictures */
  const bad = [];
  for (const f of AVIFS) {
    const webp = f.replace(/\.avif$/, '.webp');
    try {
      const a = await sharp(path.join(ROOT, f)).metadata(), w = await sharp(path.join(ROOT, webp)).metadata();
      if (a.width !== w.width || a.height !== w.height || !!a.hasAlpha !== !!w.hasAlpha) bad.push(f + ' is not the size of its WebP');
    } catch (e) { bad.push(f + ': ' + e.message); }
  }
  check(`every .avif decodes and is the size of its .webp (${AVIFS.length})`, AVIFS.length > 0 && !bad.length, bad.join(', '));
  const code = ['index.html', 'src/lesson/recap.js', 'styles/cards.css', 'styles/buttons-kit.css', 'game/css/screens.css', 'game/css/style.css']
    .map(f => fs.readFileSync(path.join(ROOT, f), 'utf8')).join('\n');
  const V = fs.readFileSync(path.join(ROOT, 'game/js/asset-versions.js'), 'utf8');
  const unasked = AVIFS.filter(f => {
    const base = path.basename(f, '.avif');
    if (f.startsWith('game/assets/')) return !V.includes('"' + f.slice(5) + '"');
    return !code.includes(base + '.avif') && !(new RegExp("'" + f.replace(/\.avif$/, '.webp').replace(/[.]/g, '\\.') + "'").test(code));
  });
  check('every .avif is named where it can be asked for (the game\'s table, the lesson\'s code, a stylesheet)', !unasked.length, unasked.join(', '));
  const named = (code.match(/[\w./@-]+\.avif/g) || []).map(u => u.replace(/^(\.\.\/)+/, '')).filter(u => !/^a\.avif$/.test(u));
  const missing = [...new Set(named)].filter(u => !fs.existsSync(path.join(ROOT, u)) && !fs.existsSync(path.join(ROOT, 'game', u)));
  check('every .avif a stylesheet or the page names is on disk', !missing.length, missing.join(', '));

  /* the game's generated files and its stylesheets' versions */
  let fresh = true, why = '';
  try { execFileSync(process.execPath, [path.join(ROOT, 'tools/build-game-bundle.cjs'), '--check'], { stdio: 'pipe' }); }
  catch (e) { fresh = false; why = String(e.stderr || e.message); }
  check('game/js/asset-versions.js and game.bundle.js are up to date (tools/build-game-bundle.cjs --check)', fresh, why);
  const table = {}; for (const m of V.matchAll(/"([^"]+)": "([0-9a-f]{8})"/g)) table[m[1]] = m[2];
  const wrongV = [];
  for (const f of ['game/css/screens.css', 'game/css/style.css', 'game/index.html']) {
    for (const m of fs.readFileSync(path.join(ROOT, f), 'utf8').matchAll(/(assets\/[^"?')\s]+)\?v=([0-9a-f]{8})/g)) {
      if (table[m[1]] !== m[2]) wrongV.push(f + ': ' + m[0]);
    }
  }
  check('every ?v= in the game\'s stylesheets and page is the table\'s', !wrongV.length, wrongV.join(', '));
  const md5 = f => crypto.createHash('md5').update(fs.readFileSync(path.join(ROOT, 'game', f))).digest('hex').slice(0, 8);
  const wrongHash = Object.keys(table).filter(f => !fs.existsSync(path.join(ROOT, 'game', f)) || md5(f) !== table[f]);
  check('every entry in the game\'s table is a file on disk, with its hash', !wrongHash.length, wrongHash.join(', '));

  /* every image-set() has its fallback */
  const loose = [];
  for (const f of ['styles/cards.css', 'styles/buttons-kit.css', 'game/css/screens.css', 'game/css/style.css']) {
    const css = fs.readFileSync(path.join(ROOT, f), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
    const supports = [];
    for (const m of css.matchAll(/@supports[^{]*image-set[^{]*\{/g)) {
      let depth = 1, i = m.index + m[0].length;
      while (depth && i < css.length) { if (css[i] === '{') depth++; else if (css[i] === '}') depth--; i++; }
      supports.push([m.index, i]);
    }
    for (const m of css.matchAll(/([a-z-]+)\s*:([^;{}]*image-set\([^;{}]*);/gi)) {
      if (supports.some(([a, b]) => m.index > a && m.index < b)) continue;
      const before = css.slice(0, m.index), open = before.lastIndexOf('{');
      const prev = before.slice(open + 1).split(';').map(s => s.trim()).filter(Boolean).pop() || '';
      if (!new RegExp('^' + m[1] + '\\s*:[\\s\\S]*url\\([^)]*\\.webp').test(prev)) loose.push(f + ': ' + m[1]);
    }
  }
  check('every image-set() in a stylesheet has its WebP before it, or is under @supports', !loose.length, loose.join(', '));
}

/* The page's AVIF probe made to fail, and CSS.supports() saying no to image-set(): the page
   then answers no to AVIF and preloads the WebP, as a browser without AVIF would. */
const NO_AVIF = `(() => {
  const d = Object.getOwnPropertyDescriptor(HTMLImageElement.prototype, 'src');
  Object.defineProperty(HTMLImageElement.prototype, 'src', { configurable: true, enumerable: d.enumerable,
    get() { return d.get.call(this); },
    set(v) { d.set.call(this, /^data:image\\/avif/.test(String(v)) ? 'data:image/avif;base64,AAAA' : v); } });
  const sup = CSS.supports.bind(CSS);
  CSS.supports = function (a, b) { return /image-set/.test(String(a) + ' ' + String(b)) ? false : sup.apply(null, arguments); };
})();`;
const NO_OGG = `(() => {
  const c = HTMLMediaElement.prototype.canPlayType;
  HTMLMediaElement.prototype.canPlayType = function (t) { return /ogg/i.test(String(t)) ? '' : c.call(this, t); };
})();`;
/* ...and every stylesheet read as a browser without image-set() reads it: those declarations dropped. */
const dropImageSets = css => css.replace(/[a-z-]+\s*:[^;{}]*image-set\([^;{}]*;/gi, '');

async function run(browser, srv, mode) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 810 } });
  if (mode === 'no-avif') {
    await context.addInitScript(NO_AVIF);
    await context.route(/\.css(\?|$)/, async route => {
      const r = await route.fetch();
      route.fulfill({ response: r, body: dropImageSets(await r.text()), headers: Object.assign({}, r.headers(), { 'content-type': 'text/css' }) });
    });
  }
  if (mode === 'no-ogg') await context.addInitScript(NO_OGG);
  const reqs = [], errors = [], failed = [];
  context.on('request', r => reqs.push(new URL(r.url()).pathname.replace(/^\//, '')));
  context.on('requestfailed', r => { if (!/^data:/.test(r.url())) failed.push(r.url() + ' ' + (r.failure() || {}).errorText); });
  context.on('response', r => { if (r.status() >= 400) failed.push(r.status() + ' ' + r.url()); });
  const watch = page => {
    page.on('pageerror', e => { if (!noise.test(e.message)) errors.push(e.message); });
    page.on('console', m => { if (m.type() === 'error' && !noise.test(m.text())) errors.push(m.text()); });
  };
  const out = { reqs, errors, failed };

  /* 1. the opening: the game's cover, its stylesheet's pictures on the page, then PLAY and its sounds */
  const a = await context.newPage(); watch(a);
  await a.goto(srv.url + '/?intro=1', { waitUntil: 'domcontentloaded' });
  const up = await a.waitForFunction(() => window.RunnerStage && RunnerStage.state().opening.said.includes('ready'), null, { timeout: 90000 }).then(() => true, () => false);
  const f = a.frames().find(x => /lesson=intro/.test(x.url()));
  out.cover = up && !!f;
  if (f) {
    await f.evaluate(() => {
      for (const c of ['instruction-pill', 'tut-hand', 'hand-hint', 'btn-play-face']) {
        const d = document.createElement('div'); d.className = c;
        // the plank sizes its middle by the stage's --k, set on the game's stage
        d.style.cssText = 'position:fixed;left:0;top:0;width:900px;height:180px;opacity:0.01;pointer-events:none;--sign-h:180px;--k:calc(180px / 478)';
        document.body.appendChild(d);
      }
    });
    await f.click('#btn-play').catch(() => {});
    out.sounds = await f.waitForFunction(() => {
      const t = window.iceAgeGame && window.iceAgeGame._sfxTable && window.iceAgeGame._sfxTable();
      return t && Object.keys(t).length >= 8 && Object.values(t).every(s => s && s.buf && s.buf.duration > 0.5) ? Object.keys(t).length : false;
    }, null, { timeout: 30000 }).then(h => h.jsonValue(), () => 0);
    out.voice = await f.evaluate(() => { const g = window.iceAgeGame; return !!(g && g._voBytes && g._voBytes()); }).catch(() => false);
    out.oggChoice = await f.evaluate(() => new Audio().canPlayType('audio/ogg; codecs="opus"'));
  }
  await a.waitForTimeout(1500);
  await a.close();

  /* 2. the lesson: its board, its pill buttons, then the recap and the end */
  const b = await context.newPage(); watch(b);
  await b.goto(srv.url + '/?intro=0&game=0', { waitUntil: 'domcontentloaded' });
  out.lesson = await b.waitForFunction(() => window.__poly && window.__poly.state.ready, null, { timeout: 60000 }).then(() => true, () => false);
  out.avifAnswer = await b.evaluate(() => window.polygonAvif && window.polygonAvif());
  out.audioSrc = await b.evaluate(() => window.polygonAudioSrc('assets/audio/sfx/correct.mp3'));
  await b.evaluate(() => {
    for (const c of ['primary', 'nav', 'success', 'danger']) {
      const k = document.createElement('button'); k.className = 'kit-btn kit-btn--' + c; k.textContent = c;
      k.style.cssText = 'position:fixed;left:0;top:0;opacity:0.01;pointer-events:none';
      document.body.appendChild(k);
    }
  });
  await b.waitForTimeout(1500);
  const recapK = await b.evaluate(() => window.__poly.steps().findIndex(x => x.recap));
  await b.evaluate(k => { const g = window.__poly; g.setState({ k }); g.runStep(k, false); }, recapK);
  out.recap = await b.waitForFunction(() => document.querySelectorAll('.recap-card image').length > 0, null, { timeout: 30000 }).then(() => true, () => false);
  await b.waitForTimeout(2500);
  out.pictures = await b.evaluate(() => [...document.querySelectorAll('img.lesson-background, img.end-world')]
    .map(i => ({ src: i.getAttribute('src'), ok: i.complete && i.naturalWidth > 0 })));
  out.panel = await b.evaluate(() => { const i = document.querySelector('.recap-card image'); return i && i.getAttribute('href'); });
  await b.close();

  /* 3. the Help Momo scene, which draws from the game's art */
  const c = await context.newPage(); watch(c);
  await c.goto(srv.url + '/?bridge=1', { waitUntil: 'domcontentloaded' });
  await c.waitForTimeout(6000);
  await c.close();
  await context.close();
  return out;
}

const pictureOf = u => u.replace(/\.(avif|webp|png)$/, '');
const isPicture = u => /^(assets|game\/assets)\/.+\.(avif|webp|png)$/.test(u);
const MUST = ['game/assets/env/path', 'game/assets/env/rock-tall', 'game/assets/env/rock-wide', 'game/assets/env/rock-band',
  'game/assets/env/cap-l', 'game/assets/env/cap-r', 'game/assets/env/obs-log-stump', 'game/assets/sky/03-morning',
  'game/assets/ui/btn-play', 'game/assets/ui/plank-l', 'game/assets/ui/plank-m', 'game/assets/ui/plank-r', 'game/assets/ui/icons/touch',
  'assets/images/instruction-board', 'assets/images/lesson-background', 'assets/images/end-world', 'assets/ui/panel',
  'assets/ui/btn-uiPrimary', 'assets/ui/btn-uiNav', 'assets/ui/btn-uiSuccess', 'assets/ui/btn-uiDanger'];

(async () => {
  await onDisk();
  const srv = await serve(ROOT);
  const browser = await pw[ENGINE].launch();

  const A = await run(browser, srv, 'avif');
  const twins = new Set(AVIFS.map(pictureOf));
  const picsA = A.reqs.filter(isPicture);
  check('AVIF: the page and the game come up', A.cover && A.lesson && A.recap);
  check('AVIF: the page says yes to AVIF', A.avifAnswer === true, String(A.avifAnswer));
  const asWebp = picsA.filter(u => u.endsWith('.webp') && twins.has(pictureOf(u)));
  check('AVIF: no picture with an AVIF twin is fetched as WebP', !asWebp.length, [...new Set(asWebp)].join(', '));
  const notAsked = MUST.filter(p => !picsA.includes(p + '.avif'));
  check('AVIF: each of the pictures with a twin comes as AVIF', !notAsked.length, notAsked.join(', '));
  const strays = picsA.filter(u => u.endsWith('.avif') && !twins.has(pictureOf(u)));
  check('AVIF: nothing asks for an AVIF that is not there', !strays.length, strays.join(', '));
  check('AVIF: the lesson\'s pictures are the AVIFs and decode', A.pictures.length === 2 && A.pictures.every(p => p.ok && /\.avif$/.test(p.src)) && /panel\.avif$/.test(A.panel || ''), JSON.stringify(A.pictures) + ' ' + A.panel);
  check('AVIF: the game decodes all eight sounds from their files, and has its voice', A.sounds >= 8 && A.voice, A.sounds + ' ' + A.voice);
  const gameAudio = A.reqs.filter(u => /^game\/assets\/audio\//.test(u));
  check('AVIF: the game\'s sounds come as Ogg Opus, not MP3', A.oggChoice && gameAudio.length >= 9 && gameAudio.every(u => u.endsWith('.ogg')), gameAudio.join(', '));
  check('AVIF: the lesson\'s sounds come as Ogg Opus', /\.ogg$/.test(A.audioSrc), A.audioSrc);
  check('AVIF: every request succeeds', !A.failed.length, A.failed.join(', '));
  check('AVIF: no script errors', !A.errors.length, A.errors.join(' | '));

  const B = await run(browser, srv, 'no-avif');
  const picsB = B.reqs.filter(isPicture);
  check('no AVIF: the page and the game come up', B.cover && B.lesson && B.recap);
  check('no AVIF: the page says no to AVIF', B.avifAnswer === false, String(B.avifAnswer));
  const avifB = picsB.filter(u => u.endsWith('.avif'));
  check('no AVIF: not one AVIF is asked for', !avifB.length, [...new Set(avifB)].join(', '));
  const noWebp = MUST.filter(p => !picsB.includes(p + '.webp'));
  check('no AVIF: each of those pictures comes as its WebP instead', !noWebp.length, noWebp.join(', '));
  check('no AVIF: the lesson\'s pictures are the WebPs and decode', B.pictures.length === 2 && B.pictures.every(p => p.ok && /\.webp$/.test(p.src)) && /panel\.webp$/.test(B.panel || ''), JSON.stringify(B.pictures) + ' ' + B.panel);
  check('no AVIF: the game still decodes all eight sounds', B.sounds >= 8, String(B.sounds));
  check('no AVIF: every request succeeds', !B.failed.length, B.failed.join(', '));
  check('no AVIF: no script errors', !B.errors.length, B.errors.join(' | '));

  const C = await run(browser, srv, 'no-ogg');
  const gameAudioC = C.reqs.filter(u => /^(game\/)?assets\/audio\//.test(u));
  check('no Ogg: every sound comes as its MP3', gameAudioC.length >= 9 && gameAudioC.every(u => u.endsWith('.mp3')), [...new Set(gameAudioC.filter(u => !u.endsWith('.mp3')))].join(', '));
  check('no Ogg: the lesson asks for MP3', /\.mp3$/.test(C.audioSrc), C.audioSrc);
  check('no Ogg: the game decodes all eight sounds from the MP3s, and has its voice', C.sounds >= 8 && C.voice, C.sounds + ' ' + C.voice);
  check('no Ogg: every request succeeds', !C.failed.length, C.failed.join(', '));
  check('no Ogg: no script errors', !C.errors.length, C.errors.join(' | '));

  /* one format per picture, in every run */
  for (const [name, R] of [['AVIF', A], ['no AVIF', B]]) {
    const formats = {};
    for (const u of R.reqs.filter(isPicture)) (formats[pictureOf(u)] = formats[pictureOf(u)] || new Set()).add(u.split('.').pop());
    const both = Object.keys(formats).filter(k => formats[k].size > 1);
    check(name + ': no picture is fetched in two formats', !both.length, both.join(', '));
  }

  await browser.close();
  await srv.close();
  let failed = 0;
  for (const r of results) {
    if (!r.ok) failed++;
    console.log((r.ok ? 'PASS ' : 'FAIL ') + r.name + (r.ok || !r.detail ? '' : '\n     ' + r.detail));
  }
  console.log(`\n${results.length - failed}/${results.length} passed (${ENGINE})`);
  process.exit(failed ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
