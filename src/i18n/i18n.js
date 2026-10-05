/* THE PAGE'S LANGUAGE: ?lan=<code> in the address, for example ?lan=hi.

   en English (the default and the base), hi Hindi, mr Marathi, te Telugu, gu Gujarati,
   od Odia. It is read forgivingly, because it is typed by hand: ?lang= and ?language= too,
   the language's name as well as its code (?lan=hindi, ?lan=Odia, ?lan=oriya), a region
   after it (hi-IN), a second ? where an & belongs (?dev=1?lan=hi), or after a # (#lan=te).
   Any other code, or none, leaves the page in English.

   Every word the learner meets comes from src/i18n/locales.json: the lesson's lines, its
   buttons, labels, feedback and screen-reader messages, the recap, Swiftee's lines over the
   game, and Frozen Rush's tutorial, plank and controls (game/index.html loads this file too,
   and the lesson passes ?lan= on to the game's frames).

   THE CODE KEEPS ITS ENGLISH. Each line is written in English where it is used, and English
   is what it is compared with, timed by and looked up by (the recordings, the word cues, the
   answers). Only what is SHOWN is put into the language, by t(), at the point it is shown.
   t() finds a line in the JSON by its English: the whole line, the line without its last
   full stop, a line with a {placeholder} in it ("{label} selected. ..."), or, failing those,
   sentence by sentence. A line that is not in the JSON is shown in English.

   KEY WORDS. The English highlights its own key words by name. A translated line marks them
   in the JSON with <strong>; marks() and parts() hand that back per word, with 'open', 'gap'
   or 'curved' for the lesson's orange words and 'term' for the purple ones.

   THE TYPE. Nunito, Baloo 2 and Fredoka have no Indian scripts, so the language's own Baloo
   (Baloo 2 for Devanagari, Baloo Tammudu 2, Baloo Bhai 2, Baloo Bhaina 2) is added under all
   three names, for that script's characters only: English text keeps its faces exactly, and
   only the one file the language needs is fetched (assets/fonts/).

   ready resolves once the words and the font are in, or could not be had (then the page
   stays in English, or in the system's font). It never waits longer than READY_CAP. */
(function () {
  'use strict';
  const script = document.currentScript;
  const BASE = (script && script.src) || location.href;
  const LANGS = ['en', 'hi', 'mr', 'te', 'gu', 'od'];
  const ALIAS = { or: 'od', ori: 'od', odia: 'od', oriya: 'od', odiya: 'od', hindi: 'hi', marathi: 'mr', telugu: 'te',
    gujarati: 'gu', english: 'en', eng: 'en', hin: 'hi', mar: 'mr', tel: 'te', guj: 'gu' };
  const TAG = { od: 'or' };              // Odia is od in the address, or as a language tag
  const READY_CAP = 10000;
  const FONTS = {
    hi: { file: 'baloo-2-devanagari.woff2', range: 'U+0900-097F, U+1CD0-1CF9, U+200C-200D, U+20A8, U+20B9, U+20F0, U+25CC, U+A830-A839, U+A8E0-A8FF' },
    te: { file: 'baloo-tammudu-2-telugu.woff2', range: 'U+0951-0952, U+0964-0965, U+0C00-0C7F, U+1CDA, U+1CF2, U+200C-200D, U+25CC' },
    gu: { file: 'baloo-bhai-2-gujarati.woff2', range: 'U+0951-0952, U+0964-0965, U+0A80-0AFF, U+200C-200D, U+20B9, U+25CC, U+A830-A839' },
    od: { file: 'baloo-bhaina-2-odia.woff2', range: 'U+0951-0952, U+0964-0965, U+0B01-0B77, U+1CDA, U+1CF2, U+200C-200D, U+20B9, U+25CC' }
  };
  FONTS.mr = FONTS.hi;
  /* the three families the page sets text in, with the weights their own faces declare
     (styles/fonts.css, styles/dialogue.css): a face is only joined to a family's other faces
     when its descriptors match theirs */
  const FAMILIES = [['Nunito', '200 1000'], ['Baloo 2', '400 800'], ['Fredoka', '300 700']];

  /* A SECOND ? TYPED WHERE AN & BELONGS (?dev=1?lan=hi) is put right first, before anything
     reads the address, so every script reads it as it was meant: ?dev=1&lan=hi */
  try {
    const s = location.search;
    if (s.indexOf('?', 1) > 0 && history.replaceState) history.replaceState(history.state, '', location.pathname + '?' + s.slice(1).replace(/\?/g, '&') + location.hash);
  } catch (e) { /* the address stays as it is */ }

  const asked = (() => {
    let q = '';
    try { const p = new URLSearchParams(location.search); q = p.get('lan') || p.get('lang') || p.get('language') || ''; } catch (e) { q = ''; }
    // typed by hand: a second ? for an &, or the hash
    if (!q) { const m = /[?&#;]\s*(?:lan|lang|language)\s*=\s*([^&#?;\s]*)/i.exec(String(location.search) + String(location.hash)); q = m ? m[1] : ''; }
    try { q = decodeURIComponent(q); } catch (e) {}
    q = String(q).trim().toLowerCase().replace(/^["']+|["'\/.]+$/g, '').split(/[-_\s]/)[0];
    q = ALIAS[q] || q;
    return LANGS.indexOf(q) >= 0 ? q : 'en';
  })();
  const wanted = asked !== 'en';

  let english = null, local = null, loaded = false;
  const byText = new Map(), byBare = new Map(), templates = [], memo = new Map(), markedOf = new Map();
  let orange = [], letters = null, momo = '';

  const norm = s => String(s).replace(/[’‘]/g, "'").replace(/[“”]/g, '"').replace(/\s+/g, ' ').trim();
  const fold = s => norm(s).toLowerCase();
  const TRAIL = /[\s.!?।…]+$/;
  const strip = s => String(s).replace(/<\/?strong>/g, '');
  const escape = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const LATIN = /[A-Za-z]/;

  function index(L) {
    english = L.en || {};
    local = L[asked] || null;
    if (!local) return false;
    for (const key of Object.keys(english)) {
      const en = english[key];
      if (typeof en !== 'string' || typeof local[key] !== 'string') continue;
      if (/\{[a-zA-Z]+\}/.test(en)) {
        const names = [];
        // a filled-in value never runs over a full stop, so a template is not taken for the
        // first sentence of a longer line ("Option {badge}." is not "Option A. Figure ...")
        const source = escape(norm(en)).replace(/\\\{([a-zA-Z]+)\\\}/g, (m, name) => { names.push(name); return '([^.!?।]+?)'; });
        templates.push({ key, names, re: new RegExp('^' + source + '$', 'i'), size: en.length });
        continue;
      }
      if (!byText.has(fold(en))) byText.set(fold(en), key);
      const bare = fold(en).replace(TRAIL, '');
      if (bare && !byBare.has(bare)) byBare.set(bare, key);
    }
    templates.sort((a, b) => b.size - a.size);
    /* the orange words: open, gap and curved, by their stems (a word's ending changes with the
       sentence: खुली, खुल्या), and only ever inside a <strong> */
    const stem = w => String(w || '').trim().replace(/[\p{Mn}\p{Mc}]+$/u, '');
    orange = [['open', stem(local.termOpen)], ['gap', stem(local.termGap)], ['curved', stem(local.termCurved)]].filter(p => p[1]);
    letters = typeof local.uiOptionLetters === 'string' ? local.uiOptionLetters.split(/\s+/).filter(Boolean) : null;
    momo = typeof local.nameMomo === 'string' ? local.nameMomo : '';
    return true;
  }

  /* a translated line without its marks, remembering the marks for marks()/parts() */
  function shown(marked) {
    const tidy = String(marked).replace(/\s+/g, ' ').trim(), plain = strip(tidy);
    if (plain !== tidy && !markedOf.has(plain)) markedOf.set(plain, tidy);
    return plain;
  }
  function byKey(key, vars) {
    let out = local && typeof local[key] === 'string' ? local[key] : null;
    if (out == null) return null;
    if (vars) out = out.replace(/\{([a-zA-Z]+)\}/g, (m, name) => (vars[name] != null ? String(vars[name]) : m));
    return out;
  }
  const isNumber = v => /^[\d\s.,]+$/.test(v);
  function letter(v) {
    const i = /^[A-H]$/.test(v) ? v.charCodeAt(0) - 65 : -1;
    return i >= 0 && letters && letters[i] ? letters[i] : v;
  }
  /* one line, or null when the JSON does not have it */
  function find(text) {
    const exact = byText.get(fold(text));
    if (exact) return byKey(exact);
    const bare = fold(text).replace(TRAIL, '');
    const near = byBare.get(bare);
    if (near) {
      // the same words with a different ending: keep the ending the line was given
      const end = (norm(text).match(TRAIL) || [''])[0].trim();
      const out = byKey(near).replace(/[\s.!?।…]+(<\/strong>)?$/, '$1');
      const mark = end === '.' && (asked === 'hi' || asked === 'od') ? '।' : end;
      return out + mark;
    }
    const plain = norm(text);
    for (const tp of templates) {
      const m = tp.re.exec(plain);
      if (!m) continue;
      const vars = {};
      tp.names.forEach((name, i) => {
        const v = m[i + 1];
        vars[name] = name === 'badge' ? letter(v) : isNumber(v) ? v : (find(v) == null ? v : strip(find(v)));
      });
      return byKey(tp.key, vars);
    }
    return null;
  }
  /* sentence by sentence, for a line put together from several ("Option A. Figure with
     straight segments. Closed boundary.") */
  function bySentence(text) {
    const parts = norm(text).match(/[^.!?।]+[.!?।]+|[^.!?।]+$/g);
    if (!parts || parts.length < 2) return null;
    const out = [];
    for (const p of parts) { const f = find(p.trim()); if (f == null) return null; out.push(f); }
    return out.join(' ');
  }

  /* THE LINE IN THE PAGE'S LANGUAGE, as plain text (the marks are kept aside, see marks()).
     English, or anything not in the JSON, comes back as it was given. */
  function t(text) {
    if (!loaded || text == null) return text;
    const s = String(text);
    if (!LATIN.test(s)) return s;
    if (memo.has(s)) return memo.get(s);
    const found = find(s) || bySentence(s);
    const out = found == null ? s : shown(found);
    if (memo.size > 4000) memo.clear();
    memo.set(s, out);
    return out;
  }
  /* by key, with {placeholders} filled: I18n.key('a11yPlaced', { label: 'Side' }) */
  function key(name, vars) {
    if (!loaded) { const en = english && english[name]; return en ? en.replace(/\{([a-zA-Z]+)\}/g, (m, k) => (vars && vars[k] != null ? vars[k] : m)) : name; }
    const out = byKey(name, vars);
    return out == null ? (english && english[name]) || name : shown(out);
  }

  /* THE KEY WORDS OF A TRANSLATED LINE, word by word (words as split at white space):
     [{ text, ink, pieces: [{ text, key }] }], ink 'open' | 'gap' | 'curved' | 'term' | null */
  function words(plain) {
    const marked = markedOf.get(plain);
    if (marked == null) return null;
    const out = [];
    let cur = null;
    const re = /<strong>([\s\S]*?)<\/strong>/g;
    const segs = [];
    let last = 0, m;
    while ((m = re.exec(marked))) {
      if (m.index > last) segs.push({ text: marked.slice(last, m.index), key: false });
      segs.push({ text: m[1], key: true, ink: inkOf(m[1]) });
      last = re.lastIndex;
    }
    if (last < marked.length) segs.push({ text: marked.slice(last), key: false });
    for (const seg of segs) {
      for (const piece of seg.text.split(/(\s+)/)) {
        if (!piece) continue;
        if (/^\s+$/.test(piece)) { cur = null; continue; }
        if (!cur) { cur = { text: '', ink: null, pieces: [] }; out.push(cur); }
        cur.text += piece;
        cur.pieces.push({ text: piece, key: seg.key });
        if (seg.key && !cur.ink) cur.ink = seg.ink;
      }
    }
    return out;
  }
  function inkOf(text) {
    const s = String(text).trim();
    for (const [concept, stem] of orange) if (s.indexOf(stem) === 0) return concept;
    return 'term';
  }
  /* per word of a shown line: its ink, or undefined for an ordinary word */
  function marks(plain) {
    if (!loaded) return null;
    const w = words(String(plain).replace(/\s+/g, ' ').trim());
    return w ? w.map(x => x.ink || undefined) : [];
  }
  /* per word, the pieces it is made of, so a key word can be set apart from the full stop
     that follows it (the game's plank) */
  function parts(plain) {
    if (!loaded) return null;
    const p = String(plain).replace(/\s+/g, ' ').trim();
    return words(p) || p.split(' ').filter(Boolean).map(w => ({ text: w, ink: null, pieces: [{ text: w, key: false }] }));
  }
  /* the sentences of a shown line, split as the game splits its English (keeping the
     punctuation, and the Devanagari full stop) */
  function sentences(text) {
    return (String(text || '').match(/[^.!?।]+[.!?।]*/g) || []).map(s => s.trim()).filter(Boolean);
  }
  /* the shown sentence for sentence `i` of an English line: the same sentence of its
     translation when the two have as many sentences, otherwise the whole translation for
     the first and nothing new after it */
  function sentence(line, i) {
    const all = t(line);
    if (all === line) return sentences(line)[i] || '';
    const ours = sentences(all), theirs = sentences(line);
    if (ours.length !== theirs.length) return all;
    // each sentence keeps its own key words, for marks()
    const marked = markedOf.get(all);
    if (marked) { const split = sentences(marked); if (split.length === ours.length) split.forEach(shown); }
    return ours[i] || '';
  }

  /* the page's own fixed words: text, aria-label, title, alt and placeholder. Live regions are
     left alone: what is in them is written, in the language, by the code that fills them */
  function translateDom(root) {
    if (!loaded) return;
    const top = root || document.body;
    if (!top) return;
    const skip = { SCRIPT: 1, STYLE: 1, NOSCRIPT: 1, TEXTAREA: 1 };
    const walker = document.createTreeWalker(top, NodeFilter.SHOW_TEXT, {
      acceptNode: n => (n.parentNode && skip[n.parentNode.nodeName]) || !LATIN.test(n.nodeValue) ||
        (n.parentElement && n.parentElement.closest && n.parentElement.closest('[aria-live]')) ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT
    });
    const nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);
    for (const n of nodes) {
      const raw = n.nodeValue, lead = raw.match(/^\s*/)[0], tail = raw.match(/\s*$/)[0];
      const out = t(raw.trim());
      if (out !== raw.trim()) n.nodeValue = lead + out + tail;
    }
    const els = top.querySelectorAll ? top.querySelectorAll('[aria-label],[title],[alt],[placeholder]') : [];
    for (const el of els) {
      for (const a of ['aria-label', 'title', 'alt', 'placeholder']) {
        const v = el.getAttribute(a);
        if (v && LATIN.test(v)) { const out = t(v); if (out !== v) el.setAttribute(a, out); }
      }
    }
    if (document.title) document.title = t(document.title);
  }

  /* ---------------------------------------------------------------- loading */
  const timeout = ms => new Promise(r => setTimeout(r, ms));
  function loadWords() {
    if (!wanted || typeof fetch !== 'function') return Promise.resolve(false);
    return fetch(new URL('locales.json', BASE).href, { cache: 'no-cache' })
      .then(r => (r.ok ? r.json() : Promise.reject(new Error(r.status))))
      .then(L => { loaded = index(L); return loaded; })
      .catch(e => { try { console.warn('[i18n] the words for "' + asked + '" could not be loaded; the page stays in English.', e); } catch (x) {} return false; });
  }
  function loadFont() {
    const f = FONTS[asked];
    if (!wanted || !f || typeof FontFace !== 'function' || !document.fonts || typeof fetch !== 'function') return Promise.resolve(false);
    const url = new URL('../../assets/fonts/' + f.file, BASE).href;
    // one download, three names
    return fetch(url).then(r => (r.ok ? r.arrayBuffer() : Promise.reject(new Error(r.status)))).then(buf => Promise.all(FAMILIES.map(([family, weight]) => {
      const face = new FontFace(family, buf, { style: 'normal', weight, display: 'swap', unicodeRange: f.range });
      document.fonts.add(face);
      return face.load();
    }))).then(() => true).catch(e => { try { console.warn('[i18n] the ' + asked + ' font could not be loaded.', e); } catch (x) {} return false; });
  }

  /* Indian scripts join their letters: letter-spacing pulls them apart (the line along the
     top of Devanagari breaks into pieces), so it is off for the whole page once it is in one */
  function settle() {
    if (!loaded) return;
    const html = document.documentElement;
    html.lang = TAG[asked] || asked;
    html.classList.add('i18n');
    const css = document.createElement('style');
    css.textContent = 'html.i18n, html.i18n * { letter-spacing: normal !important; }';
    (document.head || html).appendChild(css);
    if (document.title) document.title = t(document.title);
  }
  const ready = !wanted ? Promise.resolve() : Promise.race([
    Promise.all([loadWords(), loadFont()]).then(settle),
    timeout(READY_CAP)
  ]);

  window.PolygonI18n = {
    /** the language asked for in the address (en when none, or not one of ours) */
    code: asked,
    /** its language tag, as <html lang> has it */
    tag: TAG[asked] || asked,
    languages: LANGS.slice(),
    /** true once the page is showing another language than English */
    get on() { return loaded; },
    ready,
    t, key, marks, parts, sentence, sentences, translateDom, letter,
    /** the name of the boy the game is about, as the language writes it */
    get momo() { return loaded ? momo : 'Momo'; }
  };
})();
