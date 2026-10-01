/* ============================================================================
   THE RECAP — screen 41, the one look back before the quizzes: one screen, what the
   lesson taught, one idea at a time, then Next into the quizzes.

   It is presented the Part 1 Summary Kit's way (polygon-part-1.vercel.app/
   part1-swiftee-lesson/previews/summary-kit.html): its board, its card (the kit's own
   panel.webp), its layout numbers, its states and timings, its word cues, its album of
   collected cards and its final gathering, its speech bubble (Fredoka, each word appearing
   as it is said, the key words orange), its name plates and its blue Next pill. It is
   drawn over the lesson's own background. What it says and shows is this lesson's own:
   its recorded lines and their word times (src/lesson/recordings.js), its terms, its
   Swiftee sheets (window.SWIFTEE). The lesson hands the ideas in (index.html:
   recapConcepts); nothing here teaches anything new, and nothing on it takes a tap but
   Next: it is Swiftee going over the lesson, not a question.

   ONE SCREEN, SEVERAL TEACHING STATES, as state() reports them:
     RECAP_ENTER      the screen opens; nothing else is on it yet
     for each item, in the order the lesson taught them:
       a line with no card ("Let's recall what we learnt today.", and the turn to the names):
       LINE             Swiftee comes up in the clear middle and says it, then goes down
       an idea, on its own card:
       CARD_ENTER       a big card comes into the clear middle
       CONCEPT_REVEAL   the figure on it arrives (drawn round, or faded in)
       SWIFTEE_ENTER    Swiftee rises from behind the card's top edge
       EXPLANATION      her line, word by word on the recording's own times; each key
                        word shows the part of the figure it names as it is said (the
                        polygon on "polygon", the sides on "sides", one corner on "vertex",
                        the angle on "angle", a name's sides counted on its number), and
                        never before
       READING_PAUSE    a breath after the line, the figure held
       SWIFTEE_EXIT     she sinks back behind the card
       CARD_COLLECT     the card shrinks into the album at the side, with its name: the
                        polygon and its parts on the left, the six names on the right
       NEXT_CONCEPT     ...and the next card comes in
     FINAL_SUMMARY    every highlight stops, the albums gather in, a pause to look at it all
     READY            Next comes up
     DONE             Next was pressed; play() resolves true, and the quizzes begin
   Each state waits for the one before it (the voice, the words, the animation), so no two
   overlap, and nothing can be pressed while a line is being said.

   The board is the kit's, 1000 x 562, drawn over the lesson's own 1980 x 1114 stage (the
   same 16:9), so the kit's numbers hold, and the lesson's scaling and letterboxing apply.
   ========================================================================= */
(function () {
  'use strict';
  var NS = 'http://www.w3.org/2000/svg';
  var W = 1000, H = 562, K = 1980 / 1000, STAGE_H = 1980 * 9 / 16;
  var reduced = function () { return !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches); };

  /* the kit's layout, in board units */
  var SUM = {
    card: { cx: 500, cy: 322, w: 300 },
    shape: { cx: 500, cy: 326, r: 86 },
    /* the two albums sit inside the lesson's ice board (board x 50-950, y 54-509), clear of the
       big card in the middle (x 350-650) and below the bubble over it (its foot is at y 88, and
       it drops 6 more as it fades): the polygon and its parts 2 x 2 on the left, the six names
       2 x 3 on the right, each row's name plates a clear 10 above the row under it */
    mini: { w: 112, x: [[128, 272], [728, 872]], y: [[213, 344], [148, 279, 410]], zoom: 1.12, plate: { w: 104, h: 24, size: 14, rim: 2 } },
    enterMs: 420, collectMs: 580, readMs: 700, lookMs: 1200
  };
  var FRAME = { src: 'assets/ui/panel.webp', w: 1024, h: 984 };
  var HI = { fill: '#34b4a4', edge: '#0b4f9e', line: '#eafcff', lit: '#4be0ff' };
  var SHAPE = { fill: '#5f97f0', edge: '#2f5fc4', edgeW: 3.5 };
  var WARM = 'rgba(255, 150, 40, 0.85)';
  /* where Swiftee stands, in board units: behind the card's top edge (peek), or up in the clear
     middle between the albums at the end (middle); `hidden` is how far she sinks out of sight */
  /* ...and how wide her bubble may be there. Over the card, and in the middle at the end, her
     bubble has the top of the stage to itself: its bottom stays well above the album's top row
     (board y 137), and at the end it is no wider than the gap between the two gathered albums,
     so it never comes near a collected card */
  var SPOT = { peek: { x: 500, top: 96, size: 170, hidden: 120, maxW: 0.62 }, middle: { x: 500, top: 112, size: 250, hidden: 260, maxW: 0.36 } };
  var FALLBACK_WORD_MS = 330;

  function mk(tag, attrs, parent) {
    var el = document.createElementNS(NS, tag);
    Object.keys(attrs || {}).forEach(function (k) {
      if (attrs[k] == null) return;
      if (k === 'text') el.textContent = attrs[k]; else el.setAttribute(k, attrs[k]);
    });
    if (parent) parent.appendChild(el);
    return el;
  }
  function el(tag, cls, parent) { var n = document.createElement(tag); if (cls) n.className = cls; if (parent) parent.appendChild(n); return n; }
  function shade(hex, amt) {
    var n = parseInt(hex.slice(1), 16), r = n >> 16, g = (n >> 8) & 255, b = n & 255, t = amt < 0 ? 0 : 255, p = Math.abs(amt);
    var c = function (v) { return Math.round(v + (t - v) * p); };
    return '#' + ((1 << 24) + (c(r) << 16) + (c(g) << 8) + c(b)).toString(16).slice(1);
  }
  function regular(n, r, cx, cy) {
    var out = [];
    for (var i = 0; i < n; i++) { var a = -Math.PI / 2 + i * 2 * Math.PI / n; out.push({ x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) }); }
    return out;
  }
  function centroid(v) { var x = 0, y = 0; v.forEach(function (p) { x += p.x; y += p.y; }); return { x: x / v.length, y: y / v.length }; }
  function pathOf(v) { return v.map(function (p, i) { return (i ? 'L' : 'M') + p.x.toFixed(1) + ' ' + p.y.toFixed(1); }).join(' ') + ' Z'; }
  function word(w) { return String(w).toLowerCase().replace(/[^a-z0-9]/g, ''); }

  var S = null;   // the run on screen

  /** Play the recap into `opts.host()`. Resolves true when Next is pressed, false when stopped.
      opts: { host, concepts: [{ id, text, line } | { id, label, text, album, visual }],
      inkOf(word, text) -> colour | null, sfx(name), onState(state, id) } */
  function play(opts) {
    stop();
    opts = opts || {};
    var run = S = {
      opts: opts, gen: 0, timers: [], cards: {}, collected: [], active: null, state: null, audio: null,
      busy: false, raf: 0
    };
    run.finished = new Promise(function (resolve) { run.resolve = resolve; });
    build(run);
    setState(run, 'RECAP_ENTER');
    sequence(run);
    return run.finished;
  }
  function stop() {
    var run = S;
    if (!run) return;
    S = null;
    run.gen++;
    run.timers.forEach(clearTimeout);
    cancelAnimationFrame(run.raf);
    if (run.audio) { try { run.audio.pause(); run.audio.removeAttribute('src'); run.audio.load(); } catch (e) {} }
    if (run.root && run.root.parentNode) run.root.parentNode.removeChild(run.root);
    run.resolve(false);
  }
  function alive(run, g) { return S === run && run.gen === g; }
  function later(run, ms, fn) { var g = run.gen; var t = setTimeout(function () { if (alive(run, g)) fn(); }, ms); run.timers.push(t); return t; }
  function hold(run, ms) {
    var g = run.gen;
    return new Promise(function (r) {
      if (reduced()) { r(alive(run, g)); return; }
      var t = setTimeout(function () { r(alive(run, g)); }, ms); run.timers.push(t);
    });
  }
  function setState(run, state, id) {
    run.state = state; run.stateId = id || null;
    (run.history = run.history || []).push(state + (id ? ':' + id : ''));
    if (run.root) { run.root.setAttribute('data-state', state); if (id) run.root.setAttribute('data-concept', id); else run.root.removeAttribute('data-concept'); }
    if (run.opts.onState) { try { run.opts.onState(state, id || null); } catch (e) {} }
  }
  function sfx(run, name) { if (run.opts.sfx) { try { run.opts.sfx(name); } catch (e) {} } }

  /* ------------------------------------------------------------------ DOM */
  function build(run) {
    var root = el('div', 'lsum');
    root.setAttribute('role', 'region');
    root.setAttribute('aria-label', "Let's recall what we learnt today");
    var svg = mk('svg', { class: 'lsum-board', viewBox: '0 0 ' + W + ' ' + H, preserveAspectRatio: 'xMidYMid meet', 'aria-hidden': 'true' }, root);
    run.defs = mk('defs', {}, svg);
    run.layer = mk('g', {}, svg);
    run.fx = mk('g', { 'pointer-events': 'none' }, svg);
    run.svg = svg;
    /* SHE IS BEHIND THE CARD: her canvas is under the board, so the card's rim hides her body
       and only her head and shoulders show over its top edge */
    run.presenter = presenter(run, root);
    /* her words, in the kit's bubble: over her head, its tail pointing down to her */
    var say = el('div', 'lsum-bubble', root);
    say.setAttribute('aria-live', 'polite');
    run.say = { el: say, box: say, text: say, spans: [] };
    /* Next: the Part 1 buttons kit's blue pill at the lesson's size */
    var next = el('button', 'kit-btn kit-btn--lesson lsum-next kit-btn--nav kit-btn--next', root);
    next.type = 'button';
    next.textContent = 'Next';
    next.hidden = true;
    next.addEventListener('click', function () {
      if (S !== run || run.state !== 'READY' || run.busy) return;
      next.disabled = true;
      sfx(run, 'tap');
      hush(run);
      setState(run, 'DONE');
      var resolve = run.resolve;
      later(run, 60, function () { resolve(true); });
    });
    run.next = next;
    run.root = root;
    attach(run);
    /* the lesson's renderer can replace the container between frames: keep the screen in it */
    var keep = function () { if (S !== run) return; attach(run); run.raf = requestAnimationFrame(keep); };
    run.raf = requestAnimationFrame(keep);
  }
  function attach(run) {
    var host = null;
    try { host = run.opts.host && run.opts.host(); } catch (e) {}
    if (host && run.root.parentNode !== host) host.appendChild(run.root);
  }

  /* ---------------------------------------------------------------- the card */
  function candy(run, hex) {
    var id = 'lsumc' + hex.slice(1);
    if (run.defs.querySelector('#' + id)) return id;
    var lg = mk('linearGradient', { id: id, x1: 0, y1: 0, x2: 0, y2: 1 }, run.defs);
    [[0, shade(hex, 0.34)], [0.42, hex], [1, shade(hex, -0.2)]].forEach(function (s) { mk('stop', { offset: s[0], 'stop-color': s[1] }, lg); });
    return id;
  }
  /* the kit's name plate: ice white, a navy rim, navy ink */
  function nameTag(parent, x, y, text, o) {
    var g = mk('g', { class: 'badge' }, parent);
    var H0 = (o && o.h) || 50, fs = (o && o.size) || 26;
    var t = mk('text', { x: x, y: y + fs * 0.35, 'text-anchor': 'middle', 'font-size': fs, 'font-weight': 900,
      'font-family': 'Nunito, system-ui, sans-serif', fill: '#0b3f7a', text: text }, g);
    var w = 0; try { w = t.getComputedTextLength(); } catch (e) {}
    if (!w) w = text.length * fs * 0.54;
    var bw = (o && o.w) || (w + 52);
    g.insertBefore(mk('rect', { x: x - bw / 2, y: y - H0 / 2, width: bw, height: H0, rx: H0 * 0.44, fill: '#f3fcff', stroke: HI.edge, 'stroke-width': (o && o.rim) || 3 }), t);
    g._text = t;
    return g;
  }
  function pop(e, delay, big) {
    e.setAttribute('opacity', 1);
    if (reduced() || !e.animate) return;
    e.style.transformBox = 'fill-box'; e.style.transformOrigin = 'center';
    try { e.animate([{ opacity: 0, scale: '.3' }, { opacity: 1, scale: big ? '1.35' : '1.2', offset: 0.6 }, { opacity: 1, scale: '1' }],
      { duration: 320, delay: delay || 0, easing: 'cubic-bezier(.3,1.3,.5,1)', fill: 'backwards' }); } catch (x) {}
  }
  function warmPulse(els, peak) {
    (els || []).filter(Boolean).forEach(function (e, i) {
      if (reduced() || !e.animate) return;
      e.style.transformBox = 'fill-box'; e.style.transformOrigin = 'center';
      try { e.animate([{ scale: '1', filter: 'brightness(1)' }, { scale: peak || '1.4', filter: 'brightness(1.12) drop-shadow(0 0 7px ' + WARM + ')', offset: 0.4 }, { scale: '1', filter: 'brightness(1)' }],
        { duration: 480, delay: i * 60, easing: 'cubic-bezier(.3,1.25,.45,1)' }); } catch (x) {}
    });
  }
  /* a warm copy runs along each line and fades; the line itself is untouched */
  function trace(run, lines) {
    (lines || []).filter(Boolean).forEach(function (src, i) {
      if (reduced()) return;
      var a = { x: +src.getAttribute('x1'), y: +src.getAttribute('y1') }, b = { x: +src.getAttribute('x2'), y: +src.getAttribute('y2') };
      var m = run.svg.getCTM && src.getCTM ? run.svg.getCTM().inverse().multiply(src.getCTM()) : null;
      var P = function (p) { return m ? { x: m.a * p.x + m.c * p.y + m.e, y: m.b * p.x + m.d * p.y + m.f } : p; };
      var A2 = P(a), B2 = P(b), len = Math.hypot(B2.x - A2.x, B2.y - A2.y) || 1;
      var ln = mk('line', { x1: A2.x, y1: A2.y, x2: B2.x, y2: B2.y, stroke: WARM, 'stroke-width': 7, 'stroke-linecap': 'round' }, run.fx);
      ln.style.strokeDasharray = len + ' ' + len;
      try {
        var an = ln.animate([{ strokeDashoffset: len + 'px', opacity: 1 }, { strokeDashoffset: '0px', opacity: 1, offset: 0.6 }, { strokeDashoffset: '0px', opacity: 0 }],
          { duration: 900, delay: i * 120, easing: 'ease-out', fill: 'both' });
        an.onfinish = function () { ln.remove(); };
      } catch (e) { ln.remove(); }
    });
  }
  /* the lesson's side: a solid warm line over the figure's own edge */
  function sideLine(parent, a, b) {
    var ln = mk('line', { x1: a.x, y1: a.y, x2: b.x, y2: b.y, stroke: '#ffe27a', 'stroke-width': 7, 'stroke-linecap': 'round', opacity: 0 }, parent);
    ln.style.filter = 'drop-shadow(0 0 2px #ffb020)';
    return ln;
  }
  function growLine(run, line, a, b, ms) {
    var set = function (t) { line.setAttribute('x2', (a.x + (b.x - a.x) * t).toFixed(1)); line.setAttribute('y2', (a.y + (b.y - a.y) * t).toFixed(1)); };
    line.setAttribute('x1', a.x); line.setAttribute('y1', a.y);
    line.setAttribute('opacity', 1);
    if (reduced()) { set(1); return; }
    set(0);
    var g = run.gen, t0 = null;
    var step = function (now) { if (!alive(run, g)) return; if (t0 == null) t0 = now; var t = Math.min(1, (now - t0) / ms); set(1 - Math.pow(1 - t, 3)); if (t < 1) requestAnimationFrame(step); };
    requestAnimationFrame(step);
  }

  /* one card: the slab, the figure on it in its starting state (hidden), the parts its words
     will show (all hidden), the tag */
  function card(run, c) {
    var V = c.visual || {}, w = SUM.card.w, h = w * FRAME.h / FRAME.w, s = SUM.shape;
    var x = SUM.card.cx - w / 2, y = SUM.card.cy - h / 2;
    var g = mk('g', { class: 'recap-card', 'data-concept': c.id }, run.layer);
    g._rect = { x: x, y: y, w: w, h: h }; g._c = c;
    var pp = mk('g', {}, g); g._pop = pp;
    var img = mk('image', { x: x, y: y, width: w, height: h, preserveAspectRatio: 'none', href: FRAME.src }, pp);
    img.setAttributeNS('http://www.w3.org/1999/xlink', 'href', FRAME.src);
    var vis = mk('g', {}, pp); g._vis = vis;
    var v = regular(V.n || 5, s.r, s.cx, s.cy); g._verts = v;
    g._outline = mk('path', { d: pathOf(v), fill: 'url(#' + candy(run, SHAPE.fill) + ')', stroke: SHAPE.edge, 'stroke-width': SHAPE.edgeW, 'stroke-linejoin': 'round', opacity: 0 }, vis);
    g._lines = mk('g', {}, vis);
    g._marks = mk('g', {}, vis);
    g._tag = nameTag(pp, SUM.card.cx, y + h + 4, c.label || c.id);
    g._tag.setAttribute('opacity', 0);
    return g;
  }
  function vtx(g, i) { var v = g._verts; return v[((i % v.length) + v.length) % v.length]; }
  function knob(g, i) {
    g._knobs = g._knobs || {};
    if (!g._knobs[i]) { var p = vtx(g, i); g._knobs[i] = mk('circle', { cx: p.x, cy: p.y, r: 11, fill: HI.fill, stroke: shade(HI.fill, -0.45), 'stroke-width': 3, opacity: 0 }, g._marks); }
    return g._knobs[i];
  }
  /* the sides at corner i, drawn solid and warm (the lesson's sides) */
  function cornerSides(g, i) {
    g._corner = g._corner || [sideLine(g._lines, vtx(g, i), vtx(g, i - 1)), sideLine(g._lines, vtx(g, i), vtx(g, i + 1))];
    return g._corner;
  }
  function allSides(g) {
    if (!g._sides) { var v = g._verts; g._sides = v.map(function (p, i) { return sideLine(g._lines, p, v[(i + 1) % v.length]); }); }
    return g._sides;
  }
  function wedge(g, i) {
    if (g._wedge) return g._wedge;
    var p = vtx(g, i), q = vtx(g, i - 1), r2 = vtx(g, i + 1), rr = 26, c = centroid(g._verts);
    var a1 = Math.atan2(q.y - p.y, q.x - p.x), a2 = Math.atan2(r2.y - p.y, r2.x - p.x), TAU = 2 * Math.PI;
    var d1 = ((a2 - a1) % TAU + TAU) % TAU, bis = Math.atan2(c.y - p.y, c.x - p.x), db = ((bis - a1) % TAU + TAU) % TAU;
    var sweep = db < d1 ? 1 : 0, span = sweep ? d1 : TAU - d1, large = span > Math.PI ? 1 : 0;
    var arc = 'M' + (p.x + Math.cos(a1) * rr) + ' ' + (p.y + Math.sin(a1) * rr) + ' A' + rr + ' ' + rr + ' 0 ' + large + ' ' + sweep + ' ' + (p.x + Math.cos(a2) * rr) + ' ' + (p.y + Math.sin(a2) * rr);
    g._wedge = mk('g', { opacity: 0 }, g._marks);
    mk('path', { d: 'M' + p.x + ' ' + p.y + ' L' + arc.slice(1) + ' Z', fill: '#ffd24a', 'fill-opacity': 0.9 }, g._wedge);
    mk('path', { d: arc, fill: 'none', stroke: '#fff4c9', 'stroke-width': 2.5, 'stroke-linecap': 'round' }, g._wedge);
    return g._wedge;
  }
  /* the sides counted: 1, 2, 3... just outside the middle of each side, as the lesson's naming
     screens number them (inside, a triangle's three numbers crowd its small middle) */
  function counts(g) {
    if (g._counts) return g._counts;
    var v = g._verts, c = centroid(v);
    g._counts = v.map(function (a, i) {
      var b = v[(i + 1) % v.length], mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2, dx = mx - c.x, dy = my - c.y, d = Math.hypot(dx, dy) || 1;
      var x = mx + dx / d * 21, y = my + dy / d * 21, t = mk('g', { opacity: 0 }, g._marks);
      mk('circle', { cx: x, cy: y, r: 13, fill: '#fffbea', stroke: '#e08a00', 'stroke-width': 2.5 }, t);
      mk('text', { x: x, y: y + 5.5, 'text-anchor': 'middle', 'font-size': 16, 'font-weight': 900, 'font-family': 'Nunito, system-ui, sans-serif', fill: '#7a4100', text: String(i + 1) }, t);
      return t;
    });
    return g._counts;
  }
  function setVerts(g, v) {
    g._verts = v;
    g._outline.setAttribute('d', pathOf(v));
  }

  /* the figure arrives: drawn round (the boundary with no gap) or faded in. Returns its length. */
  function reveal(run, g) {
    var V = g._c.visual || {}, out = g._outline, t = 0;
    out.setAttribute('opacity', 1);
    if (V.draw && !reduced() && out.animate) {
      out.setAttribute('pathLength', 1); out.style.strokeDasharray = '1 1';
      try { out.animate([{ strokeDashoffset: 1, fillOpacity: 0 }, { strokeDashoffset: 0, fillOpacity: 0, offset: 0.55 }, { strokeDashoffset: 0, fillOpacity: 1 }], { duration: 560, easing: 'ease-in-out', fill: 'backwards' }); } catch (e) {}
      later(run, 600, function () { out.style.strokeDasharray = ''; out.removeAttribute('pathLength'); });
      later(run, 40, function () { sfx(run, 'trace'); });
      t = 600;
    } else if (!reduced() && out.animate) { try { out.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 220, fill: 'backwards' }); } catch (e) {} t = 240; }
    return t;
  }

  /* THE WORD CUES: as each key word is said, the part of the figure it names. Nothing a word
     shows is on the card before the word is said. */
  function cue(run, raw) {
    var c = run.active ? run.cards[run.active] : null, w = word(raw);
    if (!c) return;
    var id = c._c.id, V = c._c.visual || {}, i = V.at || 0;
    var edge = function () { trace(run, allSides(c).map(function (l) { l.setAttribute('opacity', 0); return l; })); };
    if (w === 'boundary') edge();                                              // the edge, all the way round
    else if (/^gaps?$/.test(w)) warmPulse([c._outline], '1.04');               // (there are none)
    else if (w === 'closed') { if (id === 'closed') warmPulse([c._tag], '1.08'); else warmPulse([c._outline], '1.05'); }
    else if (/^(straight|segments?)$/.test(w) && id === 'polygon') edge();
    else if (/^(segments?|sides?)$/.test(w) && id === 'sides') {
      allSides(c).forEach(function (l, k) { later(run, k * 110, function () { pop(l, 0); }); });
      later(run, 60, function () { sfx(run, 'trace'); });
      later(run, allSides(c).length * 110 + 120, function () { trace(run, allSides(c)); });
    }
    else if (/^(point|vertex|vertices)$/.test(w)) {
      var k = knob(c, i);
      if (k.getAttribute('opacity') !== '1') { pop(k, 0, true); sfx(run, 'pop'); } else warmPulse([k], '1.5');
      if (!reduced() && w === 'vertex') {
        var ring = mk('circle', { cx: k.getAttribute('cx'), cy: k.getAttribute('cy'), r: 12, fill: 'none', stroke: HI.fill, 'stroke-width': 3, opacity: 0 }, c._marks);
        ring.style.transformBox = 'fill-box'; ring.style.transformOrigin = 'center';
        try { ring.animate([{ opacity: 0.9, scale: '1' }, { opacity: 0, scale: '2.6' }], { duration: 640, iterations: 2, easing: 'ease-out' }); } catch (e) {}
      }
    }
    else if (/^sides?$/.test(w) && (id === 'vertex' || id === 'angle')) {
      var cs = cornerSides(c, i);
      if (cs[0].getAttribute('opacity') !== '1') { cs.forEach(function (l) { growLine(run, l, vtx(c, i), { x: +l.getAttribute('x2'), y: +l.getAttribute('y2') }, 300); }); sfx(run, 'trace'); }
      else trace(run, cs);
    }
    else if (/^angles?$/.test(w)) { var wg = wedge(c, i); if (wg.getAttribute('opacity') !== '1') { pop(wg, 0, true); sfx(run, 'tick'); } else warmPulse([wg], '1.25'); }
    else if (V.count && (w === String(V.n) || w === NUM[V.n])) {
      // a name's number: its sides counted, one after another
      counts(c).forEach(function (n, k) { later(run, k * 130, function () { pop(n, 0); sfx(run, 'tick'); }); });
    }
    else if (V.count && /^sides?$/.test(w)) later(run, (V.n || 5) * 130 + 80, function () { trace(run, allSides(c).map(function (l) { l.setAttribute('opacity', 0); return l; })); });
    else if (V.count && w === word(c._c.label)) warmPulse([c._tag], '1.1');
    else if (/^polygons?$/.test(w) && id === 'polygon') { warmPulse([c._tag], '1.1'); warmPulse([c._outline], '1.06'); }
  }
  var NUM = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine'];
  /* ---------------------------------------------------------- her line, said */
  function hush(run) {
    run.say.el.classList.remove('show');
    if (run.audio) { try { run.audio.pause(); } catch (e) {} run.audio = null; }
  }
  /* the line in the bubble, every word in its place (so the bubble has its size) but unseen until it is said;
     the lesson's key words in the kit's orange */
  function layout(run, text, where) {
    var b = run.say, words = text.split(/\s+/).filter(Boolean);
    b.text.textContent = '';
    b.el.style.width = '';
    b.el.style.maxWidth = (SPOT[where].maxW * 100) + '%';
    b.spans = words.map(function (w, i) {
      if (i) b.text.appendChild(document.createTextNode(' '));
      var sp = el('span', 'w', b.text);
      sp.textContent = w;
      if (run.opts.inkOf && run.opts.inkOf(w, text)) sp.classList.add('key');
      return sp;
    });
    return b.spans;
  }
  /* THE BUBBLE HUGS ITS LINES: wrapped, a max-content box stays as wide as its limit; this sets it
     to its widest line (the lines are balanced, so they keep their breaks) */
  function hug(run) {
    var b = run.say.el, cs = getComputedStyle(b);
    b.style.width = '';
    var rows = {};
    run.say.spans.forEach(function (sp) {
      var k = Math.round(sp.offsetTop), r = rows[k] || (rows[k] = { l: Infinity, r: -Infinity });
      r.l = Math.min(r.l, sp.offsetLeft); r.r = Math.max(r.r, sp.offsetLeft + sp.offsetWidth);
    });
    var widest = 0;
    Object.keys(rows).forEach(function (k) { widest = Math.max(widest, rows[k].r - rows[k].l); });
    if (Object.keys(rows).length < 2 || !widest) return;
    var chrome = parseFloat(cs.paddingLeft) + parseFloat(cs.paddingRight) + parseFloat(cs.borderLeftWidth) + parseFloat(cs.borderRightWidth);
    b.style.width = Math.ceil(widest + chrome + 2) + 'px';
  }
  /* where the bubble sits: over her head, 8 board units above the top of her spot (the kit's) */
  function placeSay(run, where) {
    run.say.el.style.bottom = (STAGE_H - (SPOT[where].top - 8) * K) + 'px';
  }
  function say(run, text, where) {
    var g = run.gen;
    var rec = null;
    try { rec = window.PolygonRecordedVoice && window.PolygonRecordedVoice.find(text); } catch (e) {}
    var spans = layout(run, text, where);
    placeSay(run, where);
    /* never above the stage's top: a line too tall for its spot at that width takes the kit's full
       width instead, and comes out shorter */
    if (run.say.el.offsetHeight > (SPOT[where].top - 8) * K - 12 && SPOT[where].maxW < 0.62) run.say.el.style.maxWidth = '62%';
    hug(run);
    run.say.el.classList.add('show');
    var n = spans.length;
    var at = rec && rec.words && rec.words.length === n ? rec.words.map(function (w) { return w.start * 1000; }) : spans.map(function (_, i) { return 160 + i * FALLBACK_WORD_MS; });
    var total = (rec && rec.duration ? rec.duration * 1000 : at[n - 1] + 700);
    return new Promise(function (resolve) {
      var done = false, i = 0;
      var finish = function () { if (done) return; done = true; while (i < n) { spans[i].classList.add('in'); cue(run, spans[i].textContent); i++; } resolve(alive(run, g)); };
      var start = function (clock) {
        var tick = function () {
          if (!alive(run, g) || done) return;
          var now = clock();
          while (i < n && now >= at[i] - 40) { spans[i].classList.add('in'); cue(run, spans[i].textContent); i++; }
          if (now >= total) { finish(); return; }
          requestAnimationFrame(tick);
        };
        tick();
      };
      var silent = function () { var s0 = performance.now(); start(function () { return performance.now() - s0; }); };
      if (!rec) { silent(); return; }
      var a = run.audio = new Audio(window.polygonAudioSrc ? window.polygonAudioSrc(rec.src) : rec.src);
      a.preload = 'auto';
      var started = false, begin = function (clock) { if (started) return; started = true; start(clock); };
      a.addEventListener('ended', function () { if (run.audio === a) finish(); });
      a.addEventListener('error', function () { begin(function () { return performance.now() - s1; }); });
      var s1 = performance.now();
      var p = a.play();
      if (p && p.then) p.then(function () { begin(function () { return a.currentTime * 1000; }); }, function () { s1 = performance.now(); begin(function () { return performance.now() - s1; }); });
      else begin(function () { return a.currentTime * 1000; });
    }).then(function (live) { return live ? hold(run, SUM.readMs) : false; });
  }

  /* ---------------------------------------------------------------- Swiftee */
  function presenter(run, root) {
    var D = window.SWIFTEE;
    if (!D || !D.clips) return null;
    var cv = el('canvas', 'lsum-presenter', root);
    cv.width = cv.height = 256;
    cv.setAttribute('aria-hidden', 'true');
    var cx = cv.getContext('2d'), imgs = {}, clip = null, t0 = 0, spot = SPOT.peek;
    var image = function (name) {
      var c = D.clips[name]; if (!c) return null;
      if (!imgs[name]) { var im = new Image(); im.decoding = 'async'; im.src = c.image; imgs[name] = im; }
      return imgs[name];
    };
    var loopOf = function (state) { return (D.states[state] && D.states[state].loop) || state; };
    ['happy', 'talking', 'celebrating'].forEach(function (s) { image(loopOf(s)); });
    function pose(state) { var name = loopOf(state); if (D.clips[name]) { clip = name; t0 = performance.now(); } }
    function draw(now) {
      if (S !== run) return;
      requestAnimationFrame(draw);
      var c = clip && D.clips[clip], im = c && image(clip);
      if (!c || !im || !im.complete || !im.naturalWidth) return;       // a frame only once its sheet is in: never a blank
      var f = reduced() ? 0 : Math.floor((now - t0) / (1000 / (D.fps || 20))) % c.frames, cell = im.naturalWidth / c.cols;
      cx.clearRect(0, 0, 256, 256);
      cx.drawImage(im, (f % c.cols) * cell, Math.floor(f / c.cols) * cell, cell, cell, 0, 0, 256, 256);
    }
    requestAnimationFrame(draw);
    pose('happy');
    function place(where, down) {
      spot = SPOT[where] || spot;
      cv.style.width = cv.style.height = (spot.size * K) + 'px';
      cv.style.left = ((spot.x - spot.size / 2) * K) + 'px';
      cv.style.top = (spot.top * K) + 'px';
      cv.style.transform = down ? 'translateY(' + (spot.hidden * K) + 'px)' : 'none';
      cv.style.opacity = down ? '0' : '1';
    }
    place('peek', true);
    var wait = function (ms) { return hold(run, ms); };
    return {
      rise: function (where) { place(where, true); void cv.offsetWidth; pose('happy'); place(where, false); return wait(340); },
      sink: function () { place(null, true); return wait(300); },
      pose: pose,
      where: function () { return spot === SPOT.middle ? 'middle' : 'peek'; }
    };
  }

  /* --------------------------------------------------------------- the flow */
  /* where a card lands: its own album (`album`: 0 the left, 1 the right), filled two across */
  function slot(run, id) {
    var cards = run.opts.concepts.filter(function (k) { return !k.line; });
    var me = cards.filter(function (k) { return k.id === id; })[0] || cards[0];
    var col = me.album ? 1 : 0, k = cards.filter(function (q) { return (q.album ? 1 : 0) === col; }).indexOf(me);
    return { x: SUM.mini.x[col][k % 2], y: SUM.mini.y[col][Math.floor(k / 2)], col: col };
  }
  function show(run, c) {
    var g = run.cards[c.id] || (run.cards[c.id] = card(run, c));
    run.active = c.id; setState(run, 'CARD_ENTER', c.id); sfx(run, 'swap');
    if (!reduced() && g._pop.animate) {
      g._pop.style.transformBox = 'fill-box'; g._pop.style.transformOrigin = 'center';
      try { g._pop.animate([{ opacity: 0, scale: '.82', translate: '0 14px' }, { opacity: 1, scale: '1.03', translate: '0 0', offset: 0.62 }, { opacity: 1, scale: '1', translate: '0 0' }], { duration: SUM.enterMs, easing: 'cubic-bezier(.22,1,.36,1)' }); } catch (e) {}
    }
    return hold(run, SUM.enterMs).then(function (ok) {
      if (!ok) return false;
      setState(run, 'CONCEPT_REVEAL', c.id);
      return hold(run, reveal(run, g) + 60).then(function (ok2) { if (!ok2) return false; pop(g._tag, 0); return hold(run, 260); });
    });
  }
  function collect(run, id, now) {
    var c = run.cards[id]; if (!c || c._done) return Promise.resolve(true);
    c._done = true; if (run.active === id) run.active = null;
    setState(run, 'CARD_COLLECT', id);
    var r = c._rect, cx0 = r.x + r.w / 2, cy0 = r.y + r.h / 2, sl = slot(run, id), k = SUM.mini.w / r.w;
    var zoom = function (e) { var z = 1 + (SUM.mini.zoom - 1) * e, sx = SUM.shape.cx, sy = SUM.shape.cy; c._vis.setAttribute('transform', 'translate(' + sx + ',' + sy + ') scale(' + z.toFixed(4) + ') translate(' + (-sx) + ',' + (-sy) + ')'); };
    var land = function () {
      c.setAttribute('transform', 'translate(' + sl.x + ',' + sl.y + ') scale(' + k.toFixed(4) + ') translate(' + (-cx0) + ',' + (-cy0) + ')');
      c._slot = sl; zoom(1);
      var P = SUM.mini.plate;
      c._mini = nameTag(run.layer, sl.x, sl.y + r.h * k / 2 + 1, c._c.label || id, { h: P.h, size: P.size, w: P.w, rim: P.rim });
      pop(c._mini, 0);
      if (run.collected.indexOf(id) < 0) run.collected.push(id);
      setState(run, 'NEXT_CONCEPT', id);
    };
    c._tag.setAttribute('opacity', 0);
    /* a name's side numbers were for its explanation: they go as the card is collected, so the
       album holds the shapes clean */
    (c._counts || []).forEach(function (n) {
      if (now || reduced() || !n.animate) { n.setAttribute('opacity', 0); return; }
      try { var a = n.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 260, easing: 'ease-out', fill: 'forwards' }); a.onfinish = function () { n.setAttribute('opacity', 0); a.cancel(); }; } catch (e) { n.setAttribute('opacity', 0); }
    });
    if (now || reduced()) { land(); return Promise.resolve(true); }
    sfx(run, 'swap');
    var g0 = run.gen;
    return new Promise(function (resolve) {
      var t0 = null;
      var step = function (ts) {
        if (!alive(run, g0)) { resolve(false); return; }
        if (t0 == null) t0 = ts;
        var t = Math.min(1, (ts - t0) / SUM.collectMs), e = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2, s = 1 + (k - 1) * e;
        zoom(e);
        var x = cx0 + (sl.x - cx0) * e, y = cy0 + (sl.y - cy0) * e - 40 * Math.sin(Math.PI * e);
        c.setAttribute('transform', 'translate(' + x.toFixed(1) + ',' + y.toFixed(1) + ') scale(' + s.toFixed(4) + ') translate(' + (-cx0) + ',' + (-cy0) + ')');
        if (t < 1) { requestAnimationFrame(step); return; }
        land(); sfx(run, 'pop'); resolve(true);
      };
      requestAnimationFrame(step);
    });
  }
  /* the whole recap at rest: every highlight stopped, the albums gathered in a step toward her */
  function gather(run) {
    setState(run, 'FINAL_SUMMARY'); sfx(run, 'done');
    while (run.fx.firstChild) run.fx.removeChild(run.fx.firstChild);
    run.collected.forEach(function (id, i) {
      var c = run.cards[id], dx = c._slot && c._slot.col ? -16 : 16;
      [c, c._mini].forEach(function (e) {
        if (!e) return;
        if (e.getAnimations) e.getAnimations({ subtree: true }).forEach(function (a) { try { a.finish(); } catch (x) {} });
        later(run, reduced() ? 0 : i * 70, function () {
          if (reduced() || !e.animate) { e.style.translate = dx + 'px 0'; return; }
          try {
            var hop = e.animate([{ translate: '0 0' }, { translate: (dx / 2) + 'px -12px', offset: 0.45 }, { translate: dx + 'px 0' }], { duration: 440, easing: 'cubic-bezier(.3,1.2,.5,1)', fill: 'forwards' });
            hop.onfinish = function () { e.style.translate = dx + 'px 0'; hop.cancel(); };
          } catch (x) { e.style.translate = dx + 'px 0'; }
        });
      });
    });
    return hold(run, run.collected.length * 70 + 460);
  }
  function ready(run) {
    setState(run, 'READY');
    run.next.hidden = false;
    run.next.disabled = false;
    void run.next.offsetWidth;
    run.next.classList.add('is-in');
  }
  function sequence(run) {
    var g = run.gen, P = run.presenter, chain = hold(run, 300);
    run.opts.concepts.forEach(function (c) {
      if (c.line) {
        /* a line with no card: she comes up in the clear middle, says it, and goes down */
        chain = chain.then(function (ok) { if (!ok || !alive(run, g)) return false; setState(run, 'LINE', c.id); return P ? P.rise('middle').then(function () { return alive(run, g); }) : true; })
          .then(function (ok) { if (!ok) return false; if (P) P.pose('talking'); return say(run, c.text, 'middle'); })
          .then(function (ok) { if (!ok) return false; hush(run); if (P) P.pose('happy'); return hold(run, 260); })
          .then(function (ok) { if (!ok) return false; return P ? P.sink().then(function () { return alive(run, g); }) : true; });
        return;
      }
      chain = chain.then(function (ok) { return ok && alive(run, g) && show(run, c); })
        .then(function (ok) { if (!ok) return false; setState(run, 'SWIFTEE_ENTER', c.id); return P ? P.rise('peek').then(function () { return alive(run, g); }) : true; })
        .then(function (ok) { if (!ok) return false; setState(run, 'EXPLANATION', c.id); if (P) P.pose('talking'); return say(run, c.text, 'peek'); })
        .then(function (ok) { if (!ok) return false; setState(run, 'READING_PAUSE', c.id); hush(run); if (P) P.pose('happy'); return hold(run, (c.visual && c.visual.hold) || 200); })
        .then(function (ok) { if (!ok) return false; setState(run, 'SWIFTEE_EXIT', c.id); return P ? P.sink().then(function () { return alive(run, g); }) : true; })
        .then(function (ok) { return ok && collect(run, c.id); });
    });
    /* the whole recap, gathered and still, and a moment to look at it before Next */
    chain.then(function (ok) { return ok && hold(run, 400); })
      .then(function (ok) { return ok && gather(run); })
      .then(function (ok) { if (!ok) return false; if (P) { P.rise('middle'); P.pose('happy'); } return hold(run, SUM.lookMs); })
      .then(function (ok) { if (ok && alive(run, g)) ready(run); });
  }

  /* A card in the state its line leaves it in, at once: what every cue would have shown. */
  function settle(run, g) {
    var V = g._c.visual || {}, id = g._c.id, i = V.at || 0, s = SUM.shape;
    g._outline.setAttribute('opacity', 1);
    if (id === 'sides') allSides(g).forEach(function (l) { l.setAttribute('opacity', 1); });
    if (id === 'vertex') knob(g, i).setAttribute('opacity', 1);
    if (id === 'vertex' || id === 'angle') cornerSides(g, i).forEach(function (l) { l.setAttribute('opacity', 1); });
    if (id === 'angle') wedge(g, i).setAttribute('opacity', 1);
    if (V.count) counts(g).forEach(function (n) { n.setAttribute('opacity', 1); });
  }
  /* FOR REVIEW AND THE TESTS (the kit's own shortcut): every card as its line leaves it, in the
     album, and straight to READY, with Next. */
  function skipToEnd() {
    var run = S;
    if (!run || run.state === 'READY' || run.state === 'DONE') return false;
    run.gen++; run.timers.forEach(clearTimeout); run.timers = []; hush(run);
    while (run.fx.firstChild) run.fx.removeChild(run.fx.firstChild);
    run.opts.concepts.filter(function (c) { return !c.line; }).forEach(function (c) {
      var g = run.cards[c.id] || (run.cards[c.id] = card(run, c));
      if (g._pop.getAnimations) g._pop.getAnimations({ subtree: true }).forEach(function (a) { try { a.finish(); } catch (x) {} });
      settle(run, g);
      if (g._done && !g._slot) g._done = false;       // caught flying into the album: land it
      collect(run, c.id, true);
    });
    run.active = null;
    if (run.presenter) { run.presenter.rise('middle'); run.presenter.pose('happy'); }
    ready(run);
    return true;
  }

  window.PolygonRecap = {
    play: play,
    stop: stop,
    skipToEnd: skipToEnd,
    /* for the tests: where the recap is and what is on it */
    state: function () {
      if (!S) return { active: false };
      var run = S;
      return {
        active: true, state: run.state, concept: run.stateId, collected: run.collected.slice(),
        cards: Object.keys(run.cards).length, next: !run.next.hidden, speaking: !!run.say.el.classList.contains('show'),
        words: run.say.spans.length, shown: run.say.spans.filter(function (s) { return s.classList.contains('in'); }).length,
        text: run.say.text.textContent, where: run.presenter ? run.presenter.where() : null,
        history: (run.history || []).slice()
      };
    }
  };
})();
