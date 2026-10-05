/* ============================================================================
   SWIFTEE IN THE GAME — she flies in over Frozen Rush to say what Momo needs.

   The game stops at the broken path (game/js/tutorial.js: the end of the 'intro' script, and
   the 'end' script's host step) and tells the page where Momo's head and the far lip of the
   hole are. Swiftee flies in from the sky on the game's own whoosh, lands on the path at the
   far lip facing Momo, takes in what has happened (a curious look at the broken ice), and
   speaks in her own Part 1 dialogue box: her recorded voice where the line
   has a take (src/lesson/recordings.js), the words alone, at a reading pace, where it does
   not. Then she flies off (or, before the lesson, stays for the snow that takes the screen).

   She is drawn by the page, over the game's frame, from the lesson's own sheets
   (src/lesson/swiftee-sheets.js), so nothing of hers is added to the game. Nothing here can
   hold anything up: a line that cannot be heard is read, a missing sheet leaves her out, and
   every promise settles on a clock.

     SwifteeCameo.preload()                          her sheets, the whoosh, the takes
     SwifteeCameo.visit({ frame, where, lines,       resolves once the lines are said
                          audio, leave })            (leave: 'left' | 'right' | 'stay')
     SwifteeCameo.leave(dir)                         fly off now; resolves when she is gone
   ========================================================================= */
(function () {
  'use strict';

  var SW = window.SWIFTEE;
  var STAGE_W = 1920, STAGE_H = 1080;     // the game's stage
  var BIRD = 280;                         // stage px her 256px cell is drawn at (the Help Momo scene's)
  var HEAD = 0.1;                         // the top of her head in her cell
  var FLY_IN = 1400, FLY_OUT = 950, SETTLE = 300, WATCH = 1300, BETWEEN = 260;
  var WORD = 0.32, START_WAIT = 1200;     // seconds a word with no take; the longest a take may take to start
  var HOLD = 1000;                        // once a line is complete, a second to see it before anything moves on
  var SAY = { font: 44, maxW: 640, tailX: 34, tip: { x: 12, y: 54 }, hang: 10 };
  var WHOOSH = 'game/assets/audio/dragon-studio-heavy-whoosh-06-414584';
  var CLIPS = ['flying', 'talk_start', 'talking', 'talk_stop', 'blinking', 'curious_start', 'curious'];

  var C = null;                           // the visit on screen
  var cache = {};                         // fetched bytes, by url
  var history = [];

  function clip(name) { return SW && SW.clips ? SW.clips[name] : null; }
  function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }
  function reduced() { return !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches); }
  function el(tag, cls, parent) { var n = document.createElement(tag); if (cls) n.className = cls; if (parent) parent.appendChild(n); return n; }
  function oggOr(base) {
    var ogg = false;
    try { ogg = document.createElement('audio').canPlayType('audio/ogg; codecs="opus"') !== ''; } catch (e) {}
    return base + (ogg ? '.ogg' : '.mp3');
  }
  function bytes(url) {
    if (!cache[url]) cache[url] = fetch(url).then(function (r) { return r.ok ? r.arrayBuffer() : null; }).catch(function () { return null; });
    return cache[url];
  }
  function take(text) {
    var V = window.PolygonRecordedVoice, rec = V && V.find ? V.find(text) : null;
    if (!rec) return null;
    // a take in the page's language (?lan=hi) times the words it shows, which are its own
    var starts = rec.spoken && V.spokenStarts ? V.spokenStarts(rec, rec.shown) : V.wordStarts(rec, text);
    return { src: window.polygonAudioSrc ? window.polygonAudioSrc(rec.src) : rec.src, starts: starts, dur: rec.duration };
  }

  function preload(texts) {
    CLIPS.forEach(function (n) { var c = clip(n); if (c) { var im = new Image(); im.src = c.image; } });
    if (location.protocol !== 'file:') {
      bytes(oggOr(WHOOSH));
      // her takes once the page's language has settled: in Hindi they are her Hindi ones (take())
      var I = window.PolygonI18n, takes = function () { (texts || []).forEach(function (t) { var k = take(t); if (k) bytes(k.src); }); };
      if (I && I.ready && I.code !== 'en') I.ready.then(takes, takes); else takes();
    }
  }

  /* ---- the sprite: a cell of a sheet, stepped as a background ---- */
  function frame(name, i) {
    var c = clip(name);
    if (!c || !C) return;
    var n = Math.max(1, c.frames), f = clamp(i, 0, n - 1), col = f % c.cols, row = Math.floor(f / c.cols);
    var s = C.bird.style;
    if (C.sheet !== name) {
      C.sheet = name;
      s.backgroundImage = 'url("' + c.image + '")';
      s.backgroundSize = (c.cols * 100) + '% ' + (c.rows * 100) + '%';
    }
    s.backgroundPosition = (c.cols > 1 ? col / (c.cols - 1) * 100 : 0) + '% ' + (c.rows > 1 ? row / (c.rows - 1) * 100 : 0) + '%';
  }
  function pose(name, loop) { if (C) { C.pose = name; C.loop = loop !== false; C.poseAt = performance.now(); } }
  function place(x, y, flip) {
    // x, y: the bottom-centre of her cell (her feet when she stands), in page px
    if (!C) return;
    C.at = { x: x, y: y };
    C.bird.style.transform = 'translate(' + (x - C.size / 2).toFixed(1) + 'px,' + (y - C.size).toFixed(1) + 'px)' + (flip ? ' scaleX(-1)' : '');
  }
  function tick(now) {
    if (!C) return;
    var c = clip(C.pose);
    if (c) {
      var i = Math.floor((now - C.poseAt) / 1000 * ((SW && SW.fps) || 20));
      frame(C.pose, C.loop ? i % c.frames : i);
    }
    if (C.move) {
      var m = C.move, u = clamp((now - m.t0) / m.ms, 0, 1), e = m.ease(u);
      var x = (1 - e) * (1 - e) * m.a.x + 2 * (1 - e) * e * m.c.x + e * e * m.b.x;
      var y = (1 - e) * (1 - e) * m.a.y + 2 * (1 - e) * e * m.c.y + e * e * m.b.y;
      place(x, y, m.flip);
      if (m.fade) C.root.style.opacity = String(1 - u);
      if (u >= 1) { C.move = null; m.done(); }
    }
    C.raf = requestAnimationFrame(tick);
  }
  function fly(a, b, c, ms, flip, ease, fade) {
    return new Promise(function (done) {
      if (!C) { done(); return; }
      C.move = { a: a, b: b, c: c, ms: ms, flip: flip, ease: ease, fade: fade, t0: performance.now(), done: done };
    });
  }
  var easeIn = function (u) { return 1 - Math.pow(1 - u, 3); };
  var easeOut = function (u) { return u * u; };

  /* ---- the game's whoosh, lighter for a small bird (as the Help Momo scene plays it) ---- */
  function whoosh(ctx) {
    if (!ctx || location.protocol === 'file:') return;
    bytes(oggOr(WHOOSH)).then(function (buf) {
      if (!buf || !C) return null;
      return ctx.decodeAudioData(buf.slice(0));
    }).then(function (b) {
      if (!b || !C || ctx.state !== 'running') return;
      var d = b.getChannelData(0), peak = 0, i, at = 0;
      for (i = 0; i < d.length; i += 64) peak = Math.max(peak, Math.abs(d[i]));
      for (i = 0; i < d.length; i += 64) if (Math.abs(d[i]) > peak * 0.12) { at = i / b.sampleRate; break; }
      var src = ctx.createBufferSource(), g = ctx.createGain(), t = ctx.currentTime;
      src.buffer = b; src.playbackRate.value = 1.5;
      g.gain.setValueAtTime(0.16 * 0.7, t); g.gain.setTargetAtTime(0, t + 0.3, 0.06);
      src.connect(g); g.connect(ctx.destination);
      src.start(t, Math.max(0, at - 0.02), 0.55);
    }).catch(function () {});
  }

  /* ---- her dialogue box: the lesson's own markup and classes (styles/dialogue.css) ---- */
  function build() {
    var root = el('div', '', document.body);
    root.id = 'swiftee-cameo';
    root.setAttribute('aria-hidden', 'true');
    var bird = el('div', 'cameo-bird', root);
    var say = el('div', 'cameo-say', root);
    var box = el('div', 'comic-dialogue dialogue-box cameo-box', say);
    var inner = el('div', 'dialogue-inner', box);
    var dtext = el('div', 'dialogue-text', inner);
    var text = el('div', 'cameo-say-text', dtext);
    var ns = 'http://www.w3.org/2000/svg', tail = document.createElementNS(ns, 'svg');
    tail.setAttribute('class', 'dialogue-tail'); tail.setAttribute('viewBox', '0 0 60 60'); tail.setAttribute('aria-hidden', 'true');
    [['dialogue-tail-fill', 'M14 0 H46 V12 C44 26 34 40 12 54 C16 40 18 26 14 12 Z'], ['dialogue-tail-stroke', 'M46 12 C44 26 34 40 12 54 C16 40 18 26 14 12']].forEach(function (p) {
      var path = document.createElementNS(ns, 'path'); path.setAttribute('class', p[0]); path.setAttribute('d', p[1]); tail.appendChild(path);
    });
    box.appendChild(tail);
    var live = el('div', 'cameo-live', root);
    live.setAttribute('aria-live', 'polite');
    return { root: root, bird: bird, say: say, box: box, text: text, live: live };
  }
  function widest(node) {
    try {
      var drawn = node.getBoundingClientRect().width, sc = node.offsetWidth && drawn ? drawn / node.offsetWidth : 1;
      var r = document.createRange(), rows = {}, w = 0;
      r.selectNodeContents(node);
      Array.prototype.forEach.call(r.getClientRects(), function (q) {
        if (q.width < 1) return;
        var key = Math.round(q.top / 4), row = rows[key] || (rows[key] = { l: q.left, r: q.right });
        row.l = Math.min(row.l, q.left); row.r = Math.max(row.r, q.right);
      });
      for (var k in rows) w = Math.max(w, rows[k].r - rows[k].l);
      return w / sc;
    } catch (e) { return 0; }
  }
  /* over her head, the tip of the tail just above it, the box out to the side away from Momo */
  function placeSay() {
    if (!C) return;
    var b = C, margin = 16, vw = window.innerWidth, k = Math.max(C.scale, 18 / SAY.font);
    var head = { x: C.perch.x, y: C.perch.y - C.size + HEAD * C.size };
    var L = margin, R = vw - margin;
    b.say.style.transform = 'none';
    b.box.style.width = '';
    b.box.style.maxWidth = Math.floor(Math.min(SAY.maxW, (R - L) / k)) + 'px';
    var pad = b.box.offsetWidth - b.text.offsetWidth, line = widest(b.text);
    if (line > 0) b.box.style.width = Math.ceil(line + pad + 2) + 'px';
    var w = b.box.offsetWidth, h = b.box.offsetHeight;
    var tipX = SAY.tailX + SAY.tip.x, tipY = h - SAY.hang + SAY.tip.y;
    var left = clamp(head.x - tipX * k, L, Math.max(L, R - w * k));
    var tailX = clamp((head.x - left) / k - SAY.tip.x, 22, w - 64);
    var top = Math.max(margin, head.y - 4 - tipY * k);
    b.box.style.setProperty('--dialogue-tail-x', tailX.toFixed(1) + 'px');
    b.box.style.setProperty('--ox', (tailX + 30).toFixed(1) + 'px');
    b.say.style.left = Math.round(left) + 'px';
    b.say.style.top = Math.round(top) + 'px';
    b.say.style.transform = 'scale(' + k.toFixed(4) + ')';
  }
  /* THE PAGE'S LANGUAGE (?lan=, src/i18n/i18n.js): her lines are shown in it, with the words its
     translation marks and the boy's name set apart, as the English sets apart Momo and polygons.
     The history stays English. The take is the language's own where it has one (?lan=hi, see
     take()), its words coming in as they are said; otherwise the English take, the shown words
     coming in as the same share of the line as it has said. */
  function local() { var I = window.PolygonI18n; return I && I.on ? I : null; }
  function layout(text) {
    var I = local(), shown = I ? I.t(text) : text, marks = I ? I.marks(shown) : null, name = I ? I.momo : '';
    C.text.textContent = '';
    C.spans = shown.split(' ').map(function (w, i) {
      if (i) C.text.appendChild(document.createTextNode(' '));
      var key = I ? !!marks[i] || (!!name && w.indexOf(name) === 0) : /^(Momo|polygons)\b/.test(w);
      var sp = el('span', key ? 'w k' : 'w', C.text);
      sp.textContent = w;
      return sp;
    });
    placeSay();
  }

  /* ONE LINE: her take through the lesson's context, or the words alone at a reading pace.
     Resolves once it has been said and had a moment to be read. */
  function speak(line, ctx) {
    return new Promise(function (resolve) {
      if (!C) { resolve(); return; }
      var mine = C, words = line.text.split(' '), k = take(line.text);
      layout(line.text);
      C.live.textContent = local() ? local().t(line.text) : line.text;
      C.say.classList.remove('out'); void C.say.offsetWidth; C.say.classList.add('show');
      pose('talking');
      var starts = null, dur = 0, clock = null, started = false, finished = false, wall0 = 0;
      var silent = function () {
        if (started || finished) return;
        started = true;
        starts = words.map(function (w, i) { return 0.12 + i * WORD; });
        dur = starts[starts.length - 1] + 0.5;
        var t0 = performance.now();
        wall0 = t0;
        clock = function () { return (performance.now() - t0) / 1000; };
        history.push({ event: 'say', text: line.text, voice: false });
      };
      setTimeout(silent, k ? START_WAIT : 0);
      if (k && location.protocol === 'file:') {
        /* off the disk a fetch is refused, so the take plays as an element */
        try {
          var a = new Audio(k.src);
          a.addEventListener('playing', function () {
            if (started || C !== mine) { try { a.pause(); } catch (e) {} return; }
            started = true;
            mine.voice = { stop: function () { try { a.pause(); } catch (e) {} } };
            starts = k.starts || words.map(function (w, i) { return i * (k.dur || 2) / words.length; });
            dur = a.duration && isFinite(a.duration) ? a.duration : (k.dur || 2);
            wall0 = performance.now();
            clock = function () { return a.currentTime; };
            history.push({ event: 'say', text: line.text, voice: true });
          });
          var p = a.play(); if (p && p.catch) p.catch(function () {});
        } catch (e) {}
      } else if (k && ctx) {
        if (ctx.state === 'suspended') { try { ctx.resume(); } catch (e) {} }
        bytes(k.src).then(function (buf) { return buf ? ctx.decodeAudioData(buf.slice(0)) : null; }).then(function (b) {
          if (!b || started || C !== mine || ctx.state !== 'running') return;
          started = true;
          var src = ctx.createBufferSource();
          src.buffer = b; src.connect(ctx.destination);
          var t0 = ctx.currentTime + 0.03;
          src.start(t0);
          mine.voice = src;
          starts = k.starts || words.map(function (w, i) { return i * b.duration / words.length; });
          dur = b.duration;
          wall0 = performance.now();
          clock = function () { return ctx.currentTime - t0; };
          history.push({ event: 'say', text: line.text, voice: true });
        }).catch(function () {});
      }
      (function look() {
        if (C !== mine) { resolve(); return; }
        if (clock) {
          /* THE VOICE'S CLOCK, WITH THE WALL CLOCK BEHIND IT. The words follow the take; but a
             clock that stops (Safari can stop a context's clock under it) must not hold the
             line up, so the wall clock, a quarter second behind, carries the words on, and the
             line is over by the take's length plus a little whatever the audio says. */
          var wall = (performance.now() - wall0) / 1000;
          var t = Math.max(clock(), wall - 0.25);
          if (C.spans.length === starts.length) C.spans.forEach(function (sp, i) { if (t + 0.04 >= starts[i]) sp.classList.add('in'); });
          else {
            // another language: its words come in as the same share of the line as has been said
            var said = 0;
            starts.forEach(function (s0) { if (t + 0.04 >= s0) said++; });
            var upTo = Math.min(C.spans.length, Math.ceil(said / Math.max(1, starts.length) * C.spans.length));
            C.spans.forEach(function (sp, i) { if (i < upTo) sp.classList.add('in'); });
          }
          if (!finished && (t >= dur || wall >= dur + 0.6)) {
            finished = true;
            C.spans.forEach(function (sp) { sp.classList.add('in'); });
            pose('blinking');
            history.push({ event: 'said', text: line.text });
            setTimeout(function () { resolve(); }, HOLD);
            return;
          }
        }
        setTimeout(look, 30);
      })();
    });
  }
  function hideSay() { if (C) { C.say.classList.remove('show'); C.say.classList.add('out'); } }

  /* ---- a visit ---- */
  function visit(opts) {
    opts = opts || {};
    if (C) teardown();
    if (!SW || !clip('flying') || !document.body) return Promise.resolve(false);
    var frameEl = opts.frame, where = opts.where || {};
    var fr = frameEl && frameEl.getBoundingClientRect ? frameEl.getBoundingClientRect() : { left: 0, top: 0, width: window.innerWidth, height: window.innerHeight };
    var st = where.stage || { x: 0, y: 0, w: 1, h: 1 }, zoom = where.zoom || 1;
    var toPage = function (sx, sy) {
      return { x: fr.left + (st.x + sx / STAGE_W * st.w) * fr.width, y: fr.top + (st.y + sy / STAGE_H * st.h) * fr.height };
    };
    var scale = st.w * fr.width / STAGE_W;
    var lip = where.lip || { x: 1460, y: 845 };
    var feet = toPage(clamp(lip.x + 150 * zoom, lip.x + 100 * zoom, STAGE_W - 150 * zoom), lip.y);
    var parts = build();
    C = parts;
    C.scale = scale;
    C.size = BIRD * zoom * scale;
    C.perch = { x: feet.x, y: feet.y + (1 - ((SW && SW.baseline) || 0.877)) * C.size };   // her cell's bottom, so her feet are on the ice
    C.bird.style.width = C.bird.style.height = Math.round(C.size) + 'px';
    C.raf = requestAnimationFrame(tick);
    history.push({ event: 'visit', lines: (opts.lines || []).map(function (l) { return l.text; }) });
    var ctx = null;
    try { ctx = opts.audio ? opts.audio() : null; } catch (e) { ctx = null; }
    var still = reduced(), vw = window.innerWidth;
    var from = { x: vw + C.size, y: Math.max(C.size * 0.6, window.innerHeight * 0.12) };
    var mine = C;
    var arrive = still
      ? new Promise(function (done) { pose('blinking'); place(C.perch.x, C.perch.y, true); C.root.style.opacity = '0';
          requestAnimationFrame(function () { if (C === mine) { C.root.style.transition = 'opacity 300ms ease'; C.root.style.opacity = '1'; } setTimeout(done, 320); }); })
      : (function () {
          pose('flying'); place(from.x, from.y, true); whoosh(ctx);
          var ctrl = { x: C.perch.x + (from.x - C.perch.x) * 0.25, y: C.perch.y - C.size * 1.5 };
          return fly(from, C.perch, ctrl, FLY_IN, true, easeIn).then(function () {
            if (C !== mine) return;
            // landed: she looks at the broken path and at Momo before she says anything
            pose('curious_start', false);
            history.push({ event: 'watch' });
            var c = clip('curious_start'), lead = c ? Math.round(c.frames / ((SW && SW.fps) || 20) * 1000) : SETTLE;
            return new Promise(function (d) { setTimeout(d, lead); }).then(function () {
              if (C !== mine) return;
              pose('curious');
              return new Promise(function (d) { setTimeout(d, WATCH); });
            });
          });
        })();
    return arrive.then(function () {
      var chain = Promise.resolve();
      (opts.lines || []).forEach(function (line, i) {
        chain = chain.then(function () {
          if (C !== mine) return;
          if (i) { hideSay(); return new Promise(function (d) { setTimeout(d, BETWEEN); }).then(function () { return speak(line, ctx); }); }
          return speak(line, ctx);
        });
      });
      return chain;
    }).then(function () {
      if (C !== mine) return true;
      if (opts.leave && opts.leave !== 'stay') return leave(opts.leave).then(function () { return true; });
      return true;
    });
  }
  /* fly off up and out of the side she is told, and take the box with her */
  function leave(dir) {
    if (!C) return Promise.resolve();
    var mine = C;
    hideSay();
    if (C.voice) { try { C.voice.stop(); } catch (e) {} C.voice = null; }
    if (reduced()) {
      C.root.style.transition = 'opacity 300ms ease'; C.root.style.opacity = '0';
      return new Promise(function (d) { setTimeout(function () { if (C === mine) teardown(); d(); }, 320); });
    }
    var vw = window.innerWidth, left = dir === 'left';
    var to = { x: left ? -C.size : vw + C.size, y: -C.size * 0.4 };
    var ctrl = { x: C.at.x + (to.x - C.at.x) * 0.35, y: C.at.y - C.size * 1.2 };
    pose('flying');
    return fly(C.at, to, ctrl, FLY_OUT, left, easeOut, true).then(function () { if (C === mine) teardown(); });
  }
  function teardown() {
    if (!C) return;
    cancelAnimationFrame(C.raf);
    if (C.voice) { try { C.voice.stop(); } catch (e) {} }
    if (C.root.parentNode) C.root.parentNode.removeChild(C.root);
    C = null;
  }

  window.SwifteeCameo = {
    preload: preload,
    visit: visit,
    leave: leave,
    close: teardown,
    /* for the tests: is she up, where, and what has been said */
    state: function () {
      return { on: !!C, pose: C ? C.pose : null, flying: !!(C && C.move), at: C && C.at ? { x: Math.round(C.at.x), y: Math.round(C.at.y) } : null,
               size: C ? Math.round(C.size) : 0, say: C && C.spans ? { text: C.text.textContent, shown: C.spans.filter(function (s) { return s.classList.contains('in'); }).length, words: C.spans.length,
               up: C.say.classList.contains('show') } : null, history: history.slice() };
    }
  };
})();
