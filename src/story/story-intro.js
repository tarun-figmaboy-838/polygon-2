/* ============================================================================
   MOMO + POPO STORY — the sequence controller.

   A self-contained overlay that plays the nine-scene story before the Help
   Momo scene and then takes itself out. The lesson is untouched: the opening
   (src/intro/opening.js) waits on StoryIntro.gate, and the lesson waits on the
   opening, so nothing starts underneath the story.

   It is told like a comic: each scene is a panel on a comic page, and the
   words appear in ONE box, a short part of the line at a time — the dialogue
   kit's story box from POLYGON Part 1 (see "the narration box" below). The
   narrator's label drops in; Momo's and Popo's bubbles boing out of their
   tails, which point at whoever is talking; the box shakes for a shout and
   trembles when someone is worried. Each word pops in as it is said, the key
   words in colour. Sounds, music, sparkles, hearts, ink emanata, speed lines
   and gentle shakes keep it lively.

   One controller, one clock:
     - A single requestAnimationFrame tick advances the story clock, reveals
       words, fires cues and draws the snow. There are no free-running timers:
       every wait is a "waiter" on that clock, so pausing the tab or a stalled
       audio device pauses the whole story together, and cleanup is one list.
     - While a line is speaking, word timing reads the audio clock itself
       (AudioContext.currentTime), so text and voice cannot drift apart.
     - Scenes run strictly in order from STORY_DATA.scenes; each one passes
       through entering -> dialogue -> actionHold -> exiting. A generation
       number is bumped on every scene change, skip and replay, so a stale
       callback can never touch a newer scene.

   Scene content is data in src/story/story-data.js; voice takes and word
   starts are in src/story/story-voice.js; the art is assets/story/; the voice
   and music files are assets/audio/story/ (Ogg Opus, MP3 where Ogg won't play).

   ON DRAFT. The experience opens on the game's own cover and tutorial now
   (src/intro/opening.js); this story plays only with ?story=1, and then the
   Help Momo scene follows it as before.
   ========================================================================= */
(function () {
  'use strict';

  var DATA = window.STORY_DATA;
  var VOICE = window.STORY_VOICE || {};
  var W = DATA ? DATA.width : 1980;
  var H = DATA ? DATA.height : 1080;
  var SCENES = DATA ? DATA.scenes : [];

  var PANEL_FIT = 0.95;           // the panel sits on the page with a gutter
  var DUCK_LEVEL = 0.55;          // music under a spoken line
  var DUCK_SECONDS = 0.28;
  var WORD_LEAD = 0.04;           // show a word this far ahead of its sound
  var LINE_GAP = 350;             // default pause before the next line, ms
  var LINE_VOICE_DELAY = 180;     // a line appears, then its voice starts, ms
  var INK = '#151515';

  function Cancelled() {}

  var resolveGate;
  var gateSettled = false;
  var gate = new Promise(function (res) { resolveGate = res; });
  function releaseGate() {
    if (gateSettled) return;
    gateSettled = true;
    resolveGate();
  }

  var S = null;   // the one live run; null when no story is on screen

  function freshState() {
    return {
      root: null, stage: null, layersHost: null, dialogueHost: null, canvas: null, ctx2d: null,
      vignette: null, veil: null, curtain: null, start: null, play: null, progress: null,
      live: null, captionHost: null,
      phase: 'loading', scene: 0, isTransitioning: false, isVOPlaying: false, canContinue: false,
      runGen: 0, sceneGen: 0,
      clock: 0, sceneStart: 0, lastFrame: 0, raf: 0, paused: false,
      waiters: [], liveAnims: [], listeners: [],
      prepared: {}, currentLayer: null,
      voiceBuffer: null, imageFailed: false, ready: false, playing: false,
      handedOff: false, finished: false,
      voice: null, box: null,
      scale: 1, reduced: false, caption: false,
      snow: { flakes: [], density: 0, target: 0, speed: 0.5, wind: 0.2 },
      bits: [], emitters: [],
      audio: null, history: [], replayDone: null
    };
  }

  /* ------------------------------------------------------------ helpers */

  function params() {
    try { return new URLSearchParams(window.location.search); } catch (e) { return null; }
  }
  /* ON DRAFT: the experience opens on the game's own cover and tutorial now
     (src/intro/opening.js). The story is kept, and plays only when asked for with ?story=1. */
  function skipRequested() {
    var q = params();
    return !(q && q.get('story') === '1');
  }
  function reducedMotion() {
    return !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  }
  function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }
  function rand(lo, hi) { return lo + Math.random() * (hi - lo); }
  function el(tag, cls, parent) {
    var node = document.createElement(tag);
    if (cls) node.className = cls;
    if (parent) parent.appendChild(node);
    return node;
  }
  function svgEl(tag, attrs, parent) {
    var node = document.createElementNS('http://www.w3.org/2000/svg', tag);
    for (var k in attrs) node.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(node);
    return node;
  }
  var uid = 0;
  function nextId(prefix) { return prefix + '-' + (++uid); }
  function on(target, type, fn, opts) {
    target.addEventListener(type, fn, opts);
    S.listeners.push([target, type, fn, opts]);
  }
  function offAll(state) {
    state.listeners.forEach(function (l) { l[0].removeEventListener(l[1], l[2], l[3]); });
    state.listeners = [];
  }
  function fx(n) { return n.toFixed(1); }

  /* Web Animations, tracked so they can be paused with the tab and cancelled
     at cleanup. Without the API the end state is applied directly. */
  function animate(node, frames, opts) {
    if (!node.animate) {
      var last = frames[frames.length - 1];
      for (var k in last) if (k !== 'offset' && k !== 'easing') node.style[k] = last[k];
      return { cancel: function () {}, finished: Promise.resolve() };
    }
    var a = node.animate(frames, opts);
    S.liveAnims.push(a);
    var drop = function () {
      if (!S) return;
      var i = S.liveAnims.indexOf(a);
      if (i >= 0 && !(opts.fill === 'forwards' || opts.fill === 'both')) S.liveAnims.splice(i, 1);
    };
    a.onfinish = drop;
    a.oncancel = function () {
      if (!S) return;
      var i = S.liveAnims.indexOf(a);
      if (i >= 0) S.liveAnims.splice(i, 1);
    };
    if (S.paused) a.pause();
    return a;
  }
  function cancelAnimsOf(node) {
    if (!S) return;
    S.liveAnims.slice().forEach(function (a) {
      var t = a.effect && a.effect.target;
      if (t && (t === node || node.contains(t))) a.cancel();
    });
  }
  /* Removes a finished decoration. */
  function removeAfter(anim, node) {
    anim.finished.then(function () { if (node.parentNode) node.parentNode.removeChild(node); }, function () {});
  }

  /* ------------------------------------------------------------- clock */

  /* Every wait in the story is one of these. `scene` ties it to a scene so
     cleanupStoryScene() drops it; `gen` ties it to a run so skip/replay
     unwinds the controller instead of leaving it suspended. */
  function waitUntil(at, gen) {
    return new Promise(function (resolve, reject) {
      S.waiters.push({ at: at, resolve: resolve, reject: reject, gen: gen });
    });
  }
  function wait(ms, gen) { return waitUntil(S.clock + ms, gen); }
  function untilScene(ms, gen) { return waitUntil(S.sceneStart + ms, gen); }
  function afterScene(ms, fn) {
    S.waiters.push({ at: S.sceneStart + ms, fn: fn, scene: S.sceneGen });
  }
  function afterDelay(ms, fn) {
    S.waiters.push({ at: S.clock + ms, fn: fn, scene: S.sceneGen });
  }
  function dropWaiters(pred) {
    var keep = [];
    S.waiters.forEach(function (w) {
      if (pred(w)) { if (w.reject) w.reject(new Cancelled()); } else keep.push(w);
    });
    S.waiters = keep;
  }

  function tick(now) {
    if (!S || S.finished) return;
    S.raf = requestAnimationFrame(tick);
    var dt = S.lastFrame ? clamp(now - S.lastFrame, 0, 100) : 16;
    S.lastFrame = now;
    var audio = S.audio;
    var stalled = S.voice && S.voice.usesAudio && audio && audio.ctx.state !== 'running';
    var running = S.playing && !S.paused && !stalled;
    if (running) S.clock += dt;

    if (S.voice) updateVoice();

    if (running) {
      var due = [];
      S.waiters = S.waiters.filter(function (w) {
        if (S.clock >= w.at) { due.push(w); return false; }
        return true;
      });
      due.forEach(function (w) {
        try { if (w.fn) w.fn(); else w.resolve(); } catch (e) { console.error(e); }
      });
    }
    drawParticles(running ? dt / 1000 : 0);
  }

  function setPhase(p) {
    S.phase = p;
    if (S.root) S.root.setAttribute('data-phase', p);
  }

  /* --------------------------------------------------------------- DOM */

  function build() {
    var root = el('div', '', null);
    root.id = 'story-intro';
    root.setAttribute('role', 'dialog');
    root.setAttribute('aria-modal', 'true');
    root.setAttribute('aria-label', 'Story: Momo and Popo');
    root.setAttribute('data-phase', 'loading');
    root.setAttribute('data-scene', '0');

    var stage = el('div', 'story-stage', root);
    S.layersHost = el('div', 'story-layers', stage);
    S.canvas = el('canvas', 'story-particles', stage);
    S.ctx2d = S.canvas.getContext && S.canvas.getContext('2d');
    S.vignette = el('div', 'story-vignette', stage);
    S.dialogueHost = el('div', 'story-dialogue', stage);
    S.veil = el('div', 'story-veil', stage);

    /* THE NARRATION BOX (the dialogue kit's story box): the narrator's label, or a
       character's bubble whose outline and tail are one drawn path — see place(). */
    var box = el('div', 'story-say', S.dialogueHost);
    box.setAttribute('data-who', 'narrator');
    var shape = svgEl('svg', { class: 'story-say-shape', 'aria-hidden': 'true' }, box);
    var shade = svgEl('path', { class: 'shade', transform: 'translate(0 6)' }, shape);
    var fill = svgEl('path', { class: 'fill' }, shape);
    var text = el('span', 'story-say-text', box);
    S.box = { el: box, shape: shape, shade: shade, fill: fill, text: text, sc: null, line: -1, spans: [], shown: false };

    /* THE ROUND GOLD PLAY from the Part 1 buttons kit (styles/buttons-kit.css, and its
       motion in src/fx/play-fx.js): held back while the story loads, it pops in when it can
       be pressed, the glow behind it breathes and crystals turn on its rim, and a press
       squashes it and knocks a ring of crystals off. */
    var start = el('div', 'story-start', root);
    var playWrap = el('div', 'kit-play-wrap story-play-wrap', start);
    var play = el('button', 'kit-play story-play', playWrap);
    play.type = 'button';
    play.setAttribute('aria-disabled', 'true');
    play.setAttribute('aria-label', 'Loading the story');
    play.innerHTML = '<span class="kit-play-halo" aria-hidden="true"></span><img src="assets/ui/play.webp" alt="" draggable="false">';
    var sparks = el('span', 'kit-play-sparks', playWrap);
    sparks.setAttribute('aria-hidden', 'true');
    var progress = el('div', 'story-progress', start);
    el('i', '', progress);
    var tip = el('div', 'story-rotate', start);
    tip.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 3h6a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2zm0 2v14h6V5H7zm11.5 3.2a6 6 0 0 1 0 7.6l-1.4-1.4a4 4 0 0 0 0-4.8l1.4-1.4z" fill="currentColor"/></svg><span>Turn your phone sideways for a bigger picture</span>';

    /* On an upright phone the balloon sits under the picture, big enough to
       read, instead of inside a picture too small to read from. */
    S.captionHost = el('div', 'story-caption', root);

    /* No Skip button on the page: the story plays through. Escape, or ?story=0 in
       the address, still goes straight to the lesson. */

    var live = el('div', 'story-live', root);
    live.setAttribute('aria-live', 'polite');

    /* The whole page fades to the story's dark at the end, which the next scene comes up out of. */
    S.curtain = el('div', 'story-curtain', root);

    S.root = root; S.stage = stage; S.start = start; S.play = play; S.playWrap = playWrap;
    S.progress = progress; S.live = live;
    document.body.appendChild(root);
  }

  function fit() {
    if (!S || !S.root) return;
    var vw = S.root.clientWidth || window.innerWidth;
    var vh = S.root.clientHeight || window.innerHeight;
    if (!vw || !vh) return;
    var contain = Math.min(vw / W, vh / H);
    var caption = vh > vw * 1.1 && contain * 50 < 15;   // balloon text would be under 15px
    S.scale = contain * (caption ? 0.96 : PANEL_FIT);
    S.root.style.setProperty('--story-scale', S.scale.toFixed(5));
    /* The ink frame and its shadow stay the same on-screen size at any scale. */
    S.root.style.setProperty('--panel-ink', (Math.max(3, Math.min(7, vw / 260)) / S.scale).toFixed(2) + 'px');
    if (caption) {
      var stageH = H * S.scale;
      var centre = Math.max(80 + stageH / 2, vh * 0.3);
      S.root.style.setProperty('--stage-centre', centre.toFixed(1) + 'px');
      S.root.style.setProperty('--caption-top', (centre + stageH / 2 + 20).toFixed(1) + 'px');
    }
    if (caption !== S.caption) {
      S.caption = caption;
      S.root.classList.toggle('is-caption', caption);
      (caption ? S.captionHost : S.dialogueHost).appendChild(S.box.el);
    }
    if (S.box.sc) place();
    if (S.canvas) {
      /* Particles are soft and small: draw them at the size they are seen,
         never above the artwork's own resolution. */
      var k = clamp(S.scale * (window.devicePixelRatio || 1), 0.25, 1);
      var cw = Math.round(W * k), ch = Math.round(H * k);
      if (S.canvas.width !== cw || S.canvas.height !== ch) {
        S.canvas.width = cw; S.canvas.height = ch;
        S.canvasK = k;
      }
    }
  }

  /* ------------------------------------------------------------ preload */

  function setProgress(f) {
    var bar = S.progress && S.progress.firstChild;
    if (bar) bar.style.width = Math.round(clamp(f, 0, 1) * 100) + '%';
  }

  function loadImage(sc) {
    return new Promise(function (resolve) {
      var img = new Image();
      var done = function (ok) {
        if (!ok) S.imageFailed = true;
        resolve();
      };
      img.onload = function () {
        if (img.decode) img.decode().then(function () { done(true); }, function () { done(true); });
        else done(true);
      };
      img.onerror = function () { done(false); };
      img.src = DATA.imageBase + sc.image;
    });
  }

  /* Every line's take is in one voice file. */
  function loadVoice() {
    if (!VOICE.src || !S.audio) return Promise.resolve();
    var state = S;
    return S.audio.load(VOICE.src)
      .then(function (buf) { state.voiceBuffer = buf; })
      .catch(function (err) { console.warn('[story] voice unavailable, text will run on its own timing:', err); });
  }

  function loadMusic() {
    if (!DATA.music || !S.audio) return Promise.resolve();
    var audio = S.audio;
    return audio.load(DATA.music.src)
      .then(function (buf) { audio.music = buf; })
      .catch(function (err) { console.warn('[story] music unavailable, the story plays without it:', err); });
  }

  /* The lesson's runtime mounts underneath while the start card is up; the
     story waits for it so that mount cannot stutter the first panel. */
  function lessonMounted(capMs) {
    return new Promise(function (resolve) {
      var t0 = Date.now();
      (function poll() {
        if (!S) return resolve();
        if (window.__poly || Date.now() - t0 > capMs) return resolve();
        setTimeout(poll, 100);
      })();
    });
  }

  function preload() {
    var tasks = [];
    SCENES.forEach(function (sc) { tasks.push(loadImage(sc)); });
    tasks.push(loadVoice());
    tasks.push(loadMusic());
    if (document.fonts && document.fonts.load) {
      tasks.push(Promise.all([
        document.fonts.load('600 44px Fredoka'),
        document.fonts.load('800 39px Nunito'),
        document.fonts.load('600 30px "Baloo 2"')
      ]).catch(function () {}));
    }
    tasks.push(lessonMounted(8000));
    var done = 0;
    tasks.forEach(function (p) { p.then(function () { if (S) setProgress(++done / tasks.length); }); });
    return Promise.all(tasks);
  }

  /* ------------------------------------------------------------- layers */

  function prepareLayer(i) {
    if (S.prepared[i]) return S.prepared[i];
    var sc = SCENES[i];
    var layer = el('div', 'story-layer');
    layer.setAttribute('data-scene', String(sc.id));
    var shake = el('div', 'story-shake', layer);
    var cam = el('div', 'story-cam', shake);
    var img = el('img', '', cam);
    img.alt = '';
    img.decoding = 'sync';
    img.draggable = false;
    img.setAttribute('data-scene-image', sc.image);
    img.src = DATA.imageBase + sc.image;
    var fxHost = el('div', 'story-fx', cam);
    var o = sc.camera && sc.camera.origin;
    if (o) cam.style.transformOrigin = o[0] + 'px ' + o[1] + 'px';
    var ready = img.decode ? img.decode().catch(function () {}) : Promise.resolve();
    S.prepared[i] = { el: layer, shake: shake, cam: cam, fx: fxHost, img: img, ready: ready };
    return S.prepared[i];
  }

  /* Camera keyframes never uncover the panel edge: any translation is paid
     for with at least as much zoom. */
  function camTransform(k) {
    var s = Math.max(k.s || 1,
      1 + (2 * Math.abs(k.x || 0) + (k.x ? 2 : 0)) / W,
      1 + (2 * Math.abs(k.y || 0) + (k.y ? 2 : 0)) / H);
    return 'translate(' + (k.x || 0) + 'px,' + (k.y || 0) + 'px) scale(' + s.toFixed(4) + ')';
  }

  function showLayer(p, sc, first) {
    var prev = S.currentLayer;
    S.layersHost.appendChild(p.el);
    S.currentLayer = p;
    var reduced = S.reduced;
    if (first) {
      p.el.classList.add('is-shown');
      animate(S.veil, [{ opacity: 1 }, { opacity: 0 }], { duration: sc.enter, easing: 'ease-out', fill: 'forwards' });
    } else {
      /* The new panel is laid over the old one, which stays opaque below it,
         so there is never a frame of dark between them. */
      animate(p.el, reduced
        ? [{ opacity: 0 }, { opacity: 1 }]
        : [{ opacity: 0, transform: 'scale(1.01)' }, { opacity: 1, transform: 'scale(1)' }],
        { duration: sc.enter, easing: 'cubic-bezier(.4,0,.2,1)', fill: 'forwards' });
      if (prev && !reduced) {
        animate(prev.el, [{ transform: 'scale(1)' }, { transform: 'scale(1.01)' }],
          { duration: sc.enter, easing: 'ease-in', fill: 'forwards' });
      }
    }
    var cam = sc.camera;
    if (cam && !reduced) {
      animate(p.cam, [{ transform: camTransform(cam.from) }, { transform: camTransform(cam.to) }],
        { duration: cam.ms, easing: cam.ease || 'cubic-bezier(.33,0,.25,1)', fill: 'forwards' });
    }
  }

  function retireLayers() {
    Array.prototype.slice.call(S.layersHost.children).forEach(function (node) {
      if (S.currentLayer && node === S.currentLayer.el) return;
      cancelAnimsOf(node);
      node.parentNode.removeChild(node);
    });
    Object.keys(S.prepared).forEach(function (k) {
      var p = S.prepared[k];
      if (p !== S.currentLayer && !p.el.parentNode && Number(k) < S.scene) delete S.prepared[k];
    });
  }

  /* ---------------------------------------------------------------- fx */

  function fxGlint(layer, c) {
    var size = c.size || 60;
    var g = el('div', 'story-glint', layer.fx);
    g.style.left = (c.x - size / 2) + 'px';
    g.style.top = (c.y - size / 2) + 'px';
    g.style.width = g.style.height = size + 'px';
    var id = nextId('story-glint');
    var svg = svgEl('svg', { viewBox: '-50 -50 100 100', 'aria-hidden': 'true' }, g);
    var grad = svgEl('radialGradient', { id: id }, svgEl('defs', {}, svg));
    svgEl('stop', { offset: '0', 'stop-color': '#ffffff' }, grad);
    svgEl('stop', { offset: '0.45', 'stop-color': '#fff4c8' }, grad);
    svgEl('stop', { offset: '1', 'stop-color': '#ffd766', 'stop-opacity': '0' }, grad);
    svgEl('path', {
      d: 'M0,-50 C3,-9 9,-3 50,0 C9,3 3,9 0,50 C-3,9 -9,3 -50,0 C-9,-3 -3,-9 0,-50Z',
      fill: 'url(#' + id + ')'
    }, svg);
    removeAfter(animate(g, S.reduced
      ? [{ opacity: 0 }, { opacity: 0.9, offset: 0.4 }, { opacity: 0 }]
      : [{ opacity: 0, transform: 'scale(.2) rotate(0deg)' },
         { opacity: 1, transform: 'scale(1) rotate(18deg)', offset: 0.4 },
         { opacity: 0, transform: 'scale(.35) rotate(40deg)' }],
      { duration: 780, easing: 'ease-out' }), g);
  }

  function fxGlow(layer, c, cls) {
    var r = c.r || 80;
    var span = cls === 'story-light' ? 1 : 1.7;
    var g = el('div', cls || 'story-glow', layer.fx);
    g.style.left = (c.x - r * span) + 'px';
    g.style.top = (c.y - r * span) + 'px';
    g.style.width = g.style.height = (2 * r * span) + 'px';
    if (cls === 'story-light') {
      animate(g, [{ opacity: 0 }, { opacity: c.amount || 0.15 }], { duration: c.ms || 1500, easing: 'ease-out', fill: 'forwards' });
      return;
    }
    /* 100% -> ~115% -> 100%: one or two soft breaths, never a flash. */
    animate(g, [{ opacity: 0 }, { opacity: 0.42, offset: 0.5 }, { opacity: 0 }],
      { duration: c.ms || 2000, iterations: c.pulses || 1, easing: 'ease-in-out' });
  }

  function fxShake(layer, c) {
    if (S.reduced) return;
    var amp = c.amp || 2;
    var s = (1 + (2 * amp + 2) / H).toFixed(4);
    var f = function (x, y, sc) { return { transform: 'translate(' + x + 'px,' + y + 'px) scale(' + sc + ')' }; };
    animate(layer.shake, [
      f(0, 0, 1), f(-amp, amp * 0.3, s), f(amp * 0.85, -amp * 0.25, s),
      f(-amp * 0.55, amp * 0.2, s), f(amp * 0.3, 0, s), f(0, 0, 1)
    ], { duration: c.ms || 320, easing: 'ease-out' });
  }

  /* Hearts float up between the two friends. */
  function fxHearts(layer, c) {
    for (var i = 0; i < 3; i++) {
      var size = 40 + i * 6;
      var g = el('div', 'story-heart', layer.fx);
      var x = c.x + (i - 1) * 44, y = c.y + (i % 2) * 18;
      g.style.left = fx(x - size / 2) + 'px';
      g.style.top = fx(y - size / 2) + 'px';
      g.style.width = g.style.height = size + 'px';
      var svg = svgEl('svg', { viewBox: '-15 -17 30 26', 'aria-hidden': 'true' }, g);
      svgEl('path', {
        d: 'M0 7 C-5 3 -13 -2 -13 -8 C-13 -14 -6 -16 0 -10 C6 -16 13 -14 13 -8 C13 -2 5 3 0 7 Z',
        fill: '#ff4f7b', stroke: INK, 'stroke-width': 2, 'stroke-linejoin': 'round'
      }, svg);
      svgEl('ellipse', { cx: -6, cy: -9, rx: 2.4, ry: 1.6, fill: '#ffffff', opacity: 0.85 }, svg);
      var drift = (i - 1) * 18, turn = (i - 1) * 14;
      removeAfter(animate(g, S.reduced
        ? [{ opacity: 0 }, { opacity: 1, offset: 0.3 }, { opacity: 0 }]
        : [{ opacity: 0, transform: 'translate(0,0) scale(.2) rotate(0deg)' },
           { opacity: 1, transform: 'translate(' + drift * 0.3 + 'px,-30px) scale(1.15) rotate(' + turn * 0.5 + 'deg)', offset: 0.25 },
           { opacity: 1, transform: 'translate(' + drift * 0.7 + 'px,-80px) scale(1) rotate(' + turn + 'deg)', offset: 0.7 },
           { opacity: 0, transform: 'translate(' + drift + 'px,-130px) scale(.9) rotate(' + turn + 'deg)' }],
        { duration: 1700, delay: i * 170, easing: 'ease-out', fill: 'backwards' }), g);
    }
  }

  /* A nervous sweat drop that slides down and fades. */
  function fxSweat(layer, c) {
    var size = c.size || 54;
    var g = el('div', 'story-sweat', layer.fx);
    g.style.left = fx(c.x - size / 2) + 'px';
    g.style.top = fx(c.y - size / 2) + 'px';
    g.style.width = g.style.height = size + 'px';
    var svg = svgEl('svg', { viewBox: '-16 -22 32 45', 'aria-hidden': 'true' }, g);
    svgEl('path', {
      d: 'M0,-20 C8,-6 14,2 14,9 C14,17 8,22 0,22 C-8,22 -14,17 -14,9 C-14,2 -8,-6 0,-20 Z',
      fill: '#bfe8ff', stroke: INK, 'stroke-width': 3, 'stroke-linejoin': 'round'
    }, svg);
    svgEl('ellipse', { cx: -5, cy: 8, rx: 3, ry: 5, fill: '#ffffff', opacity: 0.9 }, svg);
    removeAfter(animate(g, S.reduced
      ? [{ opacity: 0 }, { opacity: 1, offset: 0.2 }, { opacity: 1, offset: 0.7 }, { opacity: 0 }]
      : [{ opacity: 0, transform: 'translateY(-6px) scale(.3)' },
         { opacity: 1, transform: 'translateY(0) scale(1.1)', offset: 0.18 },
         { opacity: 1, transform: 'translateY(4px) scale(1)', offset: 0.3 },
         { opacity: 1, transform: 'translateY(22px) scale(1)', offset: 0.8 },
         { opacity: 0, transform: 'translateY(30px) scale(.9)' }],
      { duration: 1900, easing: 'ease-in-out', fill: 'forwards' }), g);
  }

  /* Comic emanata: a few short ink strokes fanned round a point (surprise,
     effort, a shout), popping out and fading. No words. */
  function fxLines(layer, c) {
    var r = c.r || 60, len = c.len || 44, n = c.count || 3;
    var from = (c.from == null ? -60 : c.from) * Math.PI / 180;
    var to = (c.to == null ? 60 : c.to) * Math.PI / 180;
    var size = (r + len) * 2 + 20;
    var g = el('div', 'story-lines', layer.fx);
    g.style.left = fx(c.x - size / 2) + 'px';
    g.style.top = fx(c.y - size / 2) + 'px';
    g.style.width = g.style.height = fx(size) + 'px';
    var svg = svgEl('svg', { viewBox: [-size / 2, -size / 2, size, size].map(fx).join(' '), 'aria-hidden': 'true' }, g);
    for (var i = 0; i < n; i++) {
      var t = n === 1 ? (from + to) / 2 : from + (to - from) * i / (n - 1);
      var cs = Math.cos(t), sn = Math.sin(t);
      svgEl('line', {
        x1: fx(cs * r), y1: fx(sn * r), x2: fx(cs * (r + len)), y2: fx(sn * (r + len)),
        stroke: INK, 'stroke-width': 8, 'stroke-linecap': 'round'
      }, svg);
    }
    removeAfter(animate(g, S.reduced
      ? [{ opacity: 0 }, { opacity: 1, offset: 0.2 }, { opacity: 1, offset: 0.75 }, { opacity: 0 }]
      : [{ opacity: 0, transform: 'scale(.5)' },
         { opacity: 1, transform: 'scale(1.12)', offset: 0.18 },
         { opacity: 1, transform: 'scale(1)', offset: 0.3 },
         { opacity: 1, transform: 'scale(1)', offset: 0.78 },
         { opacity: 0, transform: 'scale(1.08)' }],
      { duration: 1300, easing: 'ease-out', fill: 'forwards' }), g);
  }

  function runCue(c) {
    var layer = S.currentLayer;
    if (c.sfx && S.audio) S.audio.sfx(c.sfx);
    if (!c.fx || !layer) return;
    if (c.fx === 'glint') fxGlint(layer, c);
    else if (c.fx === 'glow') fxGlow(layer, c);
    else if (c.fx === 'light') fxGlow(layer, c, 'story-light');
    else if (c.fx === 'shake') fxShake(layer, c);
    else if (c.fx === 'hearts') fxHearts(layer, c);
    else if (c.fx === 'sweat') fxSweat(layer, c);
    else if (c.fx === 'lines') fxLines(layer, c);
    else if (c.fx === 'shimmer') addEmitter({ kind: 'twinkle', x: c.x, y: c.y, spread: c.spread, count: c.count, ms: c.ms });
    else if (c.fx === 'speed' && !S.reduced) addEmitter({ kind: 'speed', count: c.count || 24, ms: 1300 });
  }

  /* ---------------------------------------------------------- particles */

  var flakeSprite = null;
  function sprite() {
    if (flakeSprite) return flakeSprite;
    var c = document.createElement('canvas');
    c.width = c.height = 32;
    var g = c.getContext('2d');
    var grad = g.createRadialGradient(16, 16, 0, 16, 16, 16);
    grad.addColorStop(0, 'rgba(255,255,255,1)');
    grad.addColorStop(0.45, 'rgba(255,255,255,0.85)');
    grad.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grad;
    g.fillRect(0, 0, 32, 32);
    flakeSprite = c;
    return c;
  }

  function newFlake(fromTop) {
    var depth = Math.random();
    return {
      x: rand(-40, W + 120),
      y: fromTop ? rand(-60, -8) : rand(-20, H),
      r: 2.2 + depth * 5.2,
      vy: 34 + depth * 70,
      vx: -(10 + depth * 30),
      sway: rand(6, 18), phase: rand(0, Math.PI * 2), freq: rand(0.4, 1.1),
      alpha: 0.45 + depth * 0.5
    };
  }

  function setWeather(sc) {
    var w = sc.snow || { density: 0.4, speed: 0.5, wind: 0.2 };
    S.snow.target = S.reduced ? 0 : w.density;
    S.snow.speed = w.speed;
    S.snow.wind = w.wind;
    if (sc.particles && !S.reduced) addEmitter(sc.particles);
  }

  function addEmitter(spec) {
    var ms = spec.ms || (spec.kind === 'debris' ? 1500 : 4200);
    S.emitters.push({ spec: spec, left: spec.count || 12, rate: (spec.count || 12) / (ms / 1000), acc: 0, scene: S.sceneGen });
  }

  function spawnBit(spec) {
    if (spec.kind === 'speed') {
      /* Speed lines: long streaks racing past behind the runners. */
      var dark = Math.random() < 0.3;
      /* On the ice below the runners, never across a face. */
      return { kind: 'line', x: W + rand(0, 240), y: rand(760, 1030), vx: -rand(2600, 3600), vy: 0, g: 0,
        life: 1.2, age: 0, size: rand(160, 380), thick: rand(3, 7), dark: dark, rot: 0, vr: 0 };
    }
    var a = rand(0, Math.PI * 2), d = Math.sqrt(Math.random()) * (spec.spread || 150);
    var x = spec.x + Math.cos(a) * d, y = spec.y + Math.sin(a) * d * 0.45;
    if (spec.kind === 'debris') {
      return { kind: 'shard', x: x, y: y, vx: -rand(220, 460), vy: -rand(40, 190), g: 420, life: rand(0.7, 1.3), age: 0, size: rand(5, 11), rot: rand(0, 6), vr: rand(-6, 6) };
    }
    if (spec.kind === 'twinkle') {
      return { kind: 'twinkle', x: x, y: y, vx: 0, vy: 0, g: 0, life: rand(0.5, 0.8), age: 0, size: rand(10, 20), rot: 0, vr: 0 };
    }
    return { kind: 'shard', x: x, y: y, vx: rand(-40, 40), vy: -rand(40, 110), g: 170, life: rand(0.9, 1.5), age: 0, size: rand(3, 7), rot: rand(0, 6), vr: rand(-3, 3) };
  }

  function drawParticles(dt) {
    var g = S.ctx2d;
    if (!g) return;
    var k = S.canvasK || 1;
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.clearRect(0, 0, S.canvas.width, S.canvas.height);
    g.setTransform(k, 0, 0, k, 0, 0);

    /* Snow thickens and thins toward the panel's density a flake at a time. */
    var snow = S.snow;
    snow.density += (snow.target - snow.density) * Math.min(1, dt * 1.2);
    var want = Math.round(86 * snow.density);
    while (snow.flakes.length < want) snow.flakes.push(newFlake(snow.flakes.length > 0 && dt > 0));
    var img = sprite();
    var t = S.clock / 1000;
    for (var i = snow.flakes.length - 1; i >= 0; i--) {
      var f = snow.flakes[i];
      f.y += f.vy * snow.speed * dt;
      f.x += (f.vx * (0.4 + snow.wind * 2.2)) * snow.speed * dt;
      var sx = f.x + Math.sin(t * f.freq + f.phase) * f.sway;
      if (f.y > H + 20 || sx < -60) {
        if (snow.flakes.length > want) { snow.flakes.splice(i, 1); continue; }
        snow.flakes[i] = f = newFlake(true);
        continue;
      }
      g.globalAlpha = f.alpha;
      g.drawImage(img, sx - f.r, f.y - f.r, f.r * 2, f.r * 2);
    }

    /* Local effects: crystals near the ball, debris and speed lines. */
    S.emitters = S.emitters.filter(function (em) {
      if (em.scene !== S.sceneGen) return false;
      em.acc += em.rate * dt;
      while (em.acc >= 1 && em.left > 0) { em.acc -= 1; em.left--; S.bits.push(spawnBit(em.spec)); }
      return em.left > 0;
    });
    for (var j = S.bits.length - 1; j >= 0; j--) {
      var b = S.bits[j];
      b.age += dt;
      if (b.age >= b.life || (b.kind === 'line' && b.x + b.size < 0)) { S.bits.splice(j, 1); continue; }
      b.vy += b.g * dt; b.x += b.vx * dt; b.y += b.vy * dt; b.rot += b.vr * dt;
      var life = b.age / b.life;
      if (b.kind === 'line') {
        g.globalAlpha = b.dark ? 0.28 : 0.75;
        g.strokeStyle = b.dark ? INK : '#ffffff';
        g.lineWidth = b.thick;
        g.lineCap = 'round';
        g.beginPath();
        g.moveTo(b.x, b.y);
        g.lineTo(b.x + b.size, b.y);
        g.stroke();
        continue;
      }
      g.save();
      g.translate(b.x, b.y);
      if (b.kind === 'twinkle') {
        var tw = Math.sin(Math.PI * life);
        g.globalAlpha = tw * 0.9;
        g.scale(0.4 + tw * 0.6, 0.4 + tw * 0.6);
        g.fillStyle = '#ffffff';
        g.beginPath();
        var s = b.size;
        g.moveTo(0, -s); g.quadraticCurveTo(s * 0.12, -s * 0.12, s, 0);
        g.quadraticCurveTo(s * 0.12, s * 0.12, 0, s); g.quadraticCurveTo(-s * 0.12, s * 0.12, -s, 0);
        g.quadraticCurveTo(-s * 0.12, -s * 0.12, 0, -s);
        g.fill();
      } else {
        g.globalAlpha = (1 - life) * 0.85;
        g.rotate(b.rot);
        g.fillStyle = life < 0.5 ? '#f4fbff' : '#cfeaff';
        g.beginPath();
        g.moveTo(0, -b.size); g.lineTo(b.size * 0.6, 0); g.lineTo(0, b.size); g.lineTo(-b.size * 0.6, 0);
        g.closePath();
        g.fill();
      }
      g.restore();
    }
    g.globalAlpha = 1;
  }

  /* ------------------------------------------------- the narration box */
  /* THE DIALOGUE KIT'S STORY BOX (POLYGON Part 1: story.js partsOf / bubblePath /
     layoutSay / place / showSay / hideSay, as previews/dialogue-kit.html carries
     them), driving this story's own script and voice. A scene's `lines` are the
     parts of its text: the first takes the box with the speaker's entrance — the
     narrator's label drops in, a character's bubble boings out of its tail — and
     each later part comes up in its place with a smaller pop once the one before
     has been said. A part is laid out at its final size before a word is seen; the
     words then pop in on the voice's own clock (updateVoice), the key words in
     colour. Coordinates are the story's stage pixels (1980 x 1080), as story-data.js
     writes them: `box.x` is the box's centre (a bubble slides from it to hang over the
     head), `tail` the top of the speaker's head (a bubble hangs TAIL_HANG above it),
     and `box.y` places the narrator's label. On
     an upright phone the box sits in the caption row under the picture instead, slid
     along the row to under the speaker, its tail rising TAIL_UP as a short wedge. */
  var PART_OUT = 130;     // a part leaving before the next takes the box (the kit's partOut)
  var TAIL_UP = 30;       // under the picture, how far the tail rises from under the speaker
  /* A CHARACTER'S BUBBLE HANGS JUST ABOVE THE HEAD, the kit's way: its bottom edge this
     far above the tail's tip, so the tail is a short, wide-based wedge. It was placed
     from the scene's `box.y` — in the sky, 150 to 230 stage px above the head — and
     the same path then ran the tail all the way down as a long thin spike: the
     stretched pointer this replaces. (The kit's own story hangs its bubbles 40-44 px
     over the speaker.) */
  var TAIL_HANG = 44;

  function linesOf(sc) {
    return sc.lines && sc.lines.length ? sc.lines : [{ text: sc.text }];
  }

  /* THE BUBBLE AND ITS TAIL ARE ONE OUTLINE: a rounded box whose bottom edge runs out
     to the speaker's head and back. The base leans toward the speaker. The kit's
     bubblePath, as it is. */
  function tailBase(w, h) {
    var r = Math.min(30, h / 2 - 1), bw = Math.max(36, Math.min(64, w * 0.16));
    return { r: r, bw: bw, edge: r + bw / 2 + 4 };   // edge: the nearest a base's centre comes to a side
  }
  /* The tip may lean this far past the base's reach — a wedge on a slight slant, never
     a sliver running sideways to a head the box was not over. */
  var TAIL_LEAN = 12;
  function bubblePath(w, h, tx, ty) {
    var t = tailBase(w, h), r = t.r, bw = t.bw;
    var bx = Math.max(t.edge, Math.min(w - t.edge, tx + (w / 2 - tx) * 0.2));
    var x1 = bx - bw / 2, x2 = bx + bw / 2, dy = Math.max(14, ty - h);
    ty = h + dy;
    var n = function (v) { return Math.round(v * 10) / 10; };
    return 'M' + n(r) + ',0 H' + n(w - r) + ' A' + n(r) + ',' + n(r) + ' 0 0 1 ' + n(w) + ',' + n(r) + ' V' + n(h - r) +
      ' A' + n(r) + ',' + n(r) + ' 0 0 1 ' + n(w - r) + ',' + n(h) + ' H' + n(x2) +
      ' Q' + n(x2 + (tx - x2) * 0.25) + ',' + n(h + dy * 0.62) + ' ' + n(tx) + ',' + n(ty) +
      ' Q' + n(x1 + (tx - x1) * 0.62) + ',' + n(h + dy * 0.28) + ' ' + n(x1) + ',' + n(h) +
      ' H' + n(r) + ' A' + n(r) + ',' + n(r) + ' 0 0 1 0,' + n(h - r) + ' V' + n(r) + ' A' + n(r) + ',' + n(r) + ' 0 0 1 ' + n(r) + ',0 Z';
  }

  /* The words of part k, each its own span, laid out at their final size before a
     word is seen. A key word's letters take its colour (data-focus) and the mark
     after it stays ink. */
  function layoutSay(sc, k) {
    var b = S.box, line = linesOf(sc)[k], focus = line.focus || {};
    b.el.className = 'story-say';
    b.el.setAttribute('data-who', sc.speaker);
    b.el.setAttribute('data-scene', String(sc.id));
    b.text.textContent = '';
    b.spans = line.text.split(' ').map(function (w, i) {
      if (i) b.text.appendChild(document.createTextNode(' '));
      var cat = focus[w], sp = el('span', cat ? 'w k' : 'w', b.text);
      if (cat) {
        sp.setAttribute('data-focus', cat);
        var m = /^(.*?[^,.!?;:—…])([,.!?;:—…]+)$/.exec(w);
        el('span', 'kw', sp).textContent = m ? m[1] : w;
        if (m) sp.appendChild(document.createTextNode(m[2]));
      } else sp.textContent = w;
      return sp;
    });
    b.sc = sc; b.line = k;
    S.history.push({ scene: sc.id, event: 'line', line: k + 1, speaker: sc.speaker, text: b.text.textContent });
    place();
  }

  /* EVERY PART ON ONE LINE, the box closed round it. Only if it would be wider than
     the room it has does its type come down — just enough to fit, never under 20
     stage px (13 under the picture). Then it is placed: centred on `box`, clamped to
     the stage, with the tail drawn to `tail` for a character. Under the picture on an
     upright phone it sits in the caption row instead, its tail rising toward the
     speaker's side of the picture. Called again on every resize. */
  function place() {
    var b = S.box, sc = b.sc;
    if (!sc) return;
    var cap = S.caption, box = sc.box || {};
    var talking = sc.speaker !== 'narrator' && !!box.tail;
    b.el.style.fontSize = '';
    b.el.style.left = cap ? '' : '0px';
    b.el.style.top = cap ? '' : '0px';
    var room = cap ? Math.max(120, S.captionHost.clientWidth - 24) : W - 80;
    var wide = b.el.offsetWidth, padX = wide - b.text.offsetWidth;
    var f0 = parseFloat(getComputedStyle(b.el).fontSize) || 0;
    if (wide > room && f0 > 0 && wide > padX) {
      b.el.style.fontSize = Math.max(cap ? 13 : 20, Math.floor(f0 * (room - padX) / (wide - padX) * 10) / 10) + 'px';
    }
    var w = b.el.offsetWidth, h = b.el.offsetHeight, tx, ty;
    if (cap) {
      /* Under the picture the box slides along its row to sit under the speaker, and
         the tail rises from under the speaker as a short wedge. It used to stay centred
         and send its tail slanting across the row to the speaker's side. */
      var hostW = S.captionHost.clientWidth, left0 = (hostW - w) / 2, dx = 0;
      if (talking) {
        var edge = tailBase(w, h).edge;
        var sx = box.tail[0] / W * hostW;                     // the speaker, along the row
        var want = clamp(sx - left0, edge, w - edge);         // the tip's spot in the box, off its corners
        dx = Math.round(clamp(sx - (left0 + want), -left0, hostW - w - left0));
        tx = clamp(sx - (left0 + dx), edge - TAIL_LEAN, w - edge + TAIL_LEAN);
      } else tx = w / 2;
      ty = h + TAIL_UP;
      b.el.style.translate = dx ? dx + 'px 0' : '';
      b.el.setAttribute('data-tail', 'up');
    } else {
      var left = (box.x != null ? box.x : W / 2) - w / 2, e = talking ? tailBase(w, h).edge : 0;
      /* A bubble hangs TAIL_HANG above the head it points at, slid from box.x as far as
         it must for the head to be under its bottom edge's straight run (a lean past
         it allowed), so the tail is a wedge. A narrow bubble at the scene's box.x could
         be 150 stage px to one side of the head, its tail a sliver running across. */
      if (talking) left = clamp(left, box.tail[0] - (w - e + TAIL_LEAN), box.tail[0] - (e - TAIL_LEAN));
      left = Math.round(clamp(left, 24, W - 24 - w));
      var cy = talking ? box.tail[1] - TAIL_HANG - h / 2 : (box.y != null ? box.y : 112);   // the narrator's label sits at box.y
      var top = Math.round(clamp(cy - h / 2, 24, H - 24 - h));
      b.el.style.left = left + 'px';
      b.el.style.top = top + 'px';
      b.el.style.translate = '';
      tx = talking ? clamp(box.tail[0] - left, e - TAIL_LEAN, w - e + TAIL_LEAN) : w / 2;
      ty = talking ? box.tail[1] - top : h;
      b.el.removeAttribute('data-tail');
    }
    if (talking && w && h) {
      var d = bubblePath(w, h, tx, ty);
      b.shape.setAttribute('width', String(w)); b.shape.setAttribute('height', String(h));
      b.shape.setAttribute('viewBox', '0 0 ' + w + ' ' + h);
      b.shade.setAttribute('d', d); b.fill.setAttribute('d', d);
      // the hard shadow falls below the bubble whichever way up the shape is
      b.shade.setAttribute('transform', cap ? 'translate(0 -6)' : 'translate(0 6)');
      // it pops from where the tail leaves the box: the speaker's side
      b.el.style.setProperty('--ox', fx(clamp(tx, 0, w)) + 'px');
      b.el.style.setProperty('--oy', cap ? '0px' : fx(h) + 'px');
    } else {
      b.shade.removeAttribute('d'); b.fill.removeAttribute('d');
      b.el.style.setProperty('--ox', '50%');
      b.el.style.setProperty('--oy', '0px');
    }
  }

  /* In: the first part pops out (a bubble) or drops in (the narrator); a later part
     comes up with the smaller pop. The words stay hidden (revealing) until the voice
     reaches them. */
  function showSay(again) {
    var b = S.box;
    /* THE NARRATOR IS HEARD, NOT SHOWN. Their lines keep their voice, their timing and their
       place in the story (and the screen reader still hears each one, from the live region),
       but no box comes up for them: only Momo and Popo speak in bubbles. */
    if (b.sc && b.sc.speaker === 'narrator') { b.shown = true; return; }
    b.el.classList.add('revealing');
    if (again) b.el.classList.add('again');
    void b.el.offsetWidth;
    b.el.classList.add('show', 'enter');
    b.shown = true;
  }
  /* The box for a scene: its first part with the speaker's entrance, then the shout's
     shake or the worry's tremble once that entrance has landed. */
  function showBox(sc) {
    var b = S.box;
    cancelAnimsOf(b.el);
    layoutSay(sc, 0);
    showSay(false);
    if (S.audio && sc.speaker !== 'narrator') S.audio.sfx('pop');
    if (S.reduced) return;
    if (sc.feel === 'shout') {
      afterDelay(560, function () {
        animate(b.el, [0, -9, 8, -6, 4, -2, 0].map(function (x) { return { transform: 'translateX(' + x + 'px)' }; }),
          { duration: 380, easing: 'ease-out' });
      });
    } else if (sc.feel === 'worry') {
      afterDelay(560, function () {
        animate(b.el, [0, 1.6, -1.6, 1.1, -1.1, 0].map(function (r) { return { transform: 'rotate(' + r + 'deg)' }; }),
          { duration: 560, iterations: 2, easing: 'ease-in-out' });
      });
    }
  }
  /* Part k takes the box: the part before leaves, and after PART_OUT the next comes up
     in its place with the smaller pop. */
  function nextPart(sc, k, gen) {
    hideSay();
    return wait(PART_OUT, gen).then(function () {
      layoutSay(sc, k);
      showSay(true);
    });
  }
  function hideSay() {
    var b = S.box;
    if (!b.el.classList.contains('show')) return false;
    b.el.classList.remove('enter', 'again', 'show');
    b.el.classList.add('out');
    return true;
  }
  function hideBox(ms, gen) {
    var b = S.box;
    if (!b.shown) return Promise.resolve();
    cancelAnimsOf(b.el);
    hideSay();
    return wait(ms, gen).then(resetBox);
  }
  function resetBox() {
    var b = S.box;
    if (!b) return;
    cancelAnimsOf(b.el);
    b.el.className = 'story-say';
    b.el.removeAttribute('data-tail');
    b.el.style.translate = '';
    b.text.textContent = '';
    b.shade.removeAttribute('d'); b.fill.removeAttribute('d');
    b.spans = [];
    b.sc = null;
    b.line = -1;
    b.shown = false;
  }

  /* ---------------------------------------------------------------- voice */

  function pauseWeight(word) {
    if (/\.\.\.$/.test(word)) return 1.4;
    if (/[.!?]$/.test(word)) return 0.9;
    if (/[,;:]$/.test(word)) return 0.5;
    return 0;
  }
  function syllables(word) {
    var m = word.toLowerCase().replace(/[^a-z]/g, '').match(/[aeiouy]+/g);
    return Math.max(1, m ? m.length : 1);
  }
  /* Used only when a take is missing or its word list does not match the
     line: reading-paced starts spread over the take (or an estimate). */
  function estimateStarts(words, duration) {
    var units = words.map(function (w, i) { return syllables(w) + (i < words.length - 1 ? pauseWeight(w) : 0); });
    var total = units.reduce(function (x, y) { return x + y; }, 0) || 1;
    var acc = 0;
    return words.map(function (w, i) { var s = duration * 0.9 * acc / total; acc += units[i]; return s; });
  }
  function estimateDuration(words) {
    return 0.35 + words.reduce(function (x, w) { return x + syllables(w) * 0.22 + pauseWeight(w) * 0.3; }, 0);
  }

  function lineCues(sc, k) {
    return (sc.cues || []).filter(function (c) {
      return c.line === k + 1 && typeof c.word === 'number' && !(k > 0 && c.word === 0 && c.offset < 0);
    });
  }

  /* Speaks line k: its own take from the joined voice file, words shown as
     the audio clock reaches them. */
  function speak(sc, k, gen) {
    return new Promise(function (resolve, reject) {
      var line = linesOf(sc)[k];
      var words = line.text.split(' ');
      var entry = VOICE.parts && VOICE.parts[sc.voice + '/' + (k + 1)];
      var usesAudio = !!(entry && S.voiceBuffer && S.audio && S.audio.ctx.state === 'running');
      var duration = entry ? entry.duration : estimateDuration(words);
      var starts = entry && entry.words && entry.words.length === words.length &&
        entry.words.every(function (x, i) { return x.text === words[i]; })
        ? entry.words.map(function (x) { return x.start; })
        : estimateStarts(words, duration);
      var v = {
        gen: gen, scene: sc.id, line: k, spans: S.box.spans, starts: starts, duration: duration,
        usesAudio: usesAudio, shown: 0, resolve: resolve, reject: reject, c0: S.clock,
        cues: lineCues(sc, k).map(function (c) { return { at: (starts[c.word] || 0) + (c.offset || 0), cue: c, fired: false }; })
      };
      if (usesAudio) {
        v.source = S.audio.playVoice(S.voiceBuffer, entry.offset, entry.duration);
        v.t0 = v.source.startAt;
      }
      S.voice = v;
      S.isVOPlaying = true;
      if (S.audio) S.audio.duck(true);
      if (S.live) S.live.textContent = line.text;
      S.history.push({ scene: sc.id, event: 'voice', line: k + 1, key: sc.voice + '/' + (k + 1), withAudio: usesAudio, duration: duration });
    });
  }

  function updateVoice() {
    var v = S.voice;
    var p = v.usesAudio ? S.audio.ctx.currentTime - v.t0 : (S.clock - v.c0) / 1000;
    while (v.shown < v.spans.length && v.starts[v.shown] <= p + WORD_LEAD) {
      v.spans[v.shown++].classList.add('in');
    }
    v.cues.forEach(function (c) {
      if (!c.fired && p >= c.at) { c.fired = true; runCue(c.cue); }
    });
    if (p >= v.duration) endVoice(true);
  }

  function endVoice(complete) {
    var v = S.voice;
    if (!v) return;
    S.voice = null;
    S.isVOPlaying = false;
    if (S.audio) { S.audio.stopVoice(v.source); S.audio.duck(false); }
    if (complete) {
      v.spans.forEach(function (s) { s.classList.add('in'); });
      v.resolve();
    } else {
      v.reject(new Cancelled());
    }
  }

  /* ------------------------------------------------------------- cleanup */

  /* One place that clears everything a scene started: its voice, its cues
     and waits, its box and word state, its sounds, its local particles.
     Called on every scene exit, on skip, and on replay. */
  function cleanupStoryScene() {
    if (!S) return;
    endVoice(false);
    var sceneGen = S.sceneGen;
    dropWaiters(function (w) { return w.scene === sceneGen; });
    resetBox();
    if (S.audio) S.audio.stopSceneSounds();
    S.emitters = [];
    S.bits = [];
    S.isVOPlaying = false;
    S.canContinue = false;
    S.sceneGen++;
  }

  /* ---------------------------------------------------------- sequencing */

  /* Line after line in the one box: the first arrives with the box, each
     later one replaces it after its gap, then is spoken. */
  function runLines(sc, gen) {
    var lines = linesOf(sc);
    var chain = Promise.resolve();
    lines.forEach(function (line, k) {
      chain = chain.then(function () {
        if (k === 0) {
          showBox(sc);
          return untilScene(Math.max(sc.voiceAt, sc.boxAt), gen);
        }
        var gap = line.gap || LINE_GAP;
        /* Effects written against the start of this line's first word with
           a negative offset land in the pause before it. */
        (sc.cues || []).forEach(function (c) {
          if (c.line === k + 1 && c.word === 0 && c.offset < 0) {
            afterDelay(Math.max(0, gap + PART_OUT + LINE_VOICE_DELAY + c.offset * 1000), function () { runCue(c); });
          }
        });
        return wait(gap, gen).then(function () {
          return nextPart(sc, k, gen);
        }).then(function () {
          return wait(LINE_VOICE_DELAY, gen);
        });
      }).then(function () {
        setPhase('dialogue');
        return speak(sc, k, gen);
      });
    });
    return chain;
  }

  /* `cut`: the run starts here rather than at scene 1 (a review jump), so the panel
     arrives the way the first one does, out of the dark, with nothing to cross-fade from. */
  function playScene(i, gen, cut) {
    var sc = SCENES[i];
    var p = prepareLayer(i);
    return p.ready.then(function () {
      if (gen !== S.runGen) throw new Cancelled();
      cleanupStoryScene();
      S.reduced = reducedMotion();
      S.scene = sc.id;
      if (S.nav) S.nav.sync();
      S.sceneStart = S.clock;
      S.root.setAttribute('data-scene', String(sc.id));
      setPhase('entering');
      S.isTransitioning = true;
      S.history.push({ scene: sc.id, event: 'enter', image: p.img.getAttribute('data-scene-image'), speaker: sc.speaker, at: S.clock });

      showLayer(p, sc, i === 0 || cut);
      setWeather(sc);
      if (S.vignette) S.vignette.style.opacity = String(sc.vignette == null ? 0.12 : sc.vignette);
      if (S.audio) S.audio.mood(sc.mood);
      (sc.cues || []).forEach(function (c) {
        if (typeof c.at === 'number') afterScene(c.at, function () { runCue(c); });
      });
      afterScene(sc.enter, function () { S.isTransitioning = false; retireLayers(); });
      if (i + 1 < SCENES.length) afterScene(sc.enter + 50, function () { prepareLayer(i + 1); });
      return untilScene(sc.boxAt, gen);
    }).then(function () {
      return runLines(sc, gen);
    }).then(function () {
      setPhase('actionHold');
      S.canContinue = true;
      return wait(sc.hold, gen);
    }).then(function () {
      setPhase('exiting');
      S.canContinue = false;
      return hideBox(sc.boxOut || 200, gen);
    });
  }

  function runStory() {
    S.clock = 0;
    return runFrom(0, ++S.runGen);
  }
  function runFrom(from, gen) {
    var chain = Promise.resolve();
    SCENES.forEach(function (sc, i) {
      if (i >= from) chain = chain.then(function () { return playScene(i, gen, i === from && from > 0); });
    });
    return chain.then(function () {
      return finishStory(gen, 950);
    }).catch(function (err) {
      if (err instanceof Cancelled) return;
      console.error('[story]', err);
      if (S && !S.handedOff) finishStory(++S.runGen, 300);
    });
  }

  /* Fade the whole page to the story's dark, then hand over.
     Used by the natural ending, by skip (Escape), and after any error; only ever once. */
  function finishStory(gen, fadeMs) {
    if (!S || S.handedOff || S.ending) return Promise.resolve();
    S.ending = true;
    S.runGen = gen;
    cleanupStoryScene();
    setPhase('complete');
    S.root.classList.add('is-ending');
    if (S.audio) S.audio.fadeOut(fadeMs / 1000 + 0.4);
    animate(S.curtain, [{ opacity: 0 }, { opacity: 1 }], { duration: fadeMs, easing: 'ease-in', fill: 'forwards' });
    S.playing = true;   // keep the clock running for the fade
    return wait(fadeMs + 40, gen).then(handOff, handOff);
  }

  function handOff() {
    if (!S || S.handedOff) return;
    S.handedOff = true;
    S.history.push({ event: 'handoff', at: S.clock });
    var state = S;
    var done = state.replayDone;
    releaseGate();
    /* What comes next (the Help Momo scene, or the opening's veil of the same dark) is put
       up synchronously off the gate;
       leave ours in place two frames so there is no frame of lesson between. */
    requestAnimationFrame(function () {
      requestAnimationFrame(function () {
        teardown(state);
        if (done) done();
      });
    });
  }

  function teardown(state) {
    if (!state || state.finished) return;
    state.finished = true;
    cancelAnimationFrame(state.raf);
    offAll(state);
    state.waiters.forEach(function (w) { if (w.reject) w.reject(new Cancelled()); });
    state.waiters = [];
    state.liveAnims.slice().forEach(function (a) { try { a.cancel(); } catch (e) {} });
    state.liveAnims = [];
    if (state.stopPlayFx) { state.stopPlayFx(); state.stopPlayFx = null; }
    if (state.nav) { state.nav.dispose(); state.nav = null; }
    if (state.audio) state.audio.close();
    if (state.root && state.root.parentNode) state.root.parentNode.removeChild(state.root);
    StoryIntro.lastRun = { history: state.history, listeners: state.listeners.length };
    if (S === state) S = null;
  }

  /* ---------------------------------------------------------- start / skip */

  function begin(event) {
    if (!S || !S.ready || S.playing || S.handedOff) return;   // one start per run
    if (event) event.preventDefault();
    S.playing = true;
    S.play.setAttribute('aria-disabled', 'true');
    S.start.classList.add('is-gone');
    if (S.audio) S.audio.unlock();      // inside the gesture, or iOS keeps it muted
    S.history.push({ event: 'play', at: S.clock });
    runStory();
  }

  function skip() {
    if (!S || S.handedOff) return;
    S.history.push({ event: 'skip', scene: S.scene, at: S.clock });
    S.start.classList.add('is-gone');
    dropWaiters(function () { return true; });
    finishStory(++S.runGen, 320);
  }

  /* REVIEW ONLY (?dev=1, the lesson navigator's switch): play the story on from scene
     index i. It unwinds the run on screen exactly as skip does (its voice, its waits and
     cues, its box, its sounds) and takes every panel away, then plays from that scene to
     the end and hands over to the lesson as usual. Before Play, the jump is the tap that
     starts the story. */
  function jumpTo(i) {
    if (!S || !S.ready || S.handedOff || S.ending || i < 0 || i >= SCENES.length) return;
    if (!S.playing) {
      S.playing = true;
      S.play.setAttribute('aria-disabled', 'true');
      S.start.classList.add('is-gone');
      if (S.audio) S.audio.unlock();      // inside the tap, or iOS keeps it muted
    }
    var gen = ++S.runGen;
    dropWaiters(function () { return true; });
    cleanupStoryScene();
    Array.prototype.slice.call(S.layersHost.children).forEach(function (node) {
      cancelAnimsOf(node);
      node.parentNode.removeChild(node);
    });
    S.prepared = {};
    S.currentLayer = null;
    S.history.push({ event: 'jump', scene: SCENES[i].id, at: S.clock });
    S.scene = SCENES[i].id;               // so a second Next, before the panel arrives, goes on from here
    if (S.nav) S.nav.sync();
    runFrom(i, gen);
  }
  function sceneIndex() {
    for (var i = 0; i < SCENES.length; i++) if (SCENES[i].id === S.scene) return i;
    return 0;   // before Play: the first panel is behind the start card
  }
  function mountNavigator(state) {
    var N = window.PolygonScreenNavigator;
    var who = { narrator: 'Narrator', momo: 'Momo', polo: 'Popo' };
    state.nav = N && N.panel && N.panel({
      id: 'story-scene-navigator', word: 'Scenes', title: 'Jump to a scene', name: 'Story scene navigator',
      list: 'Story scenes', steps: 'Scene navigation', close: 'Close scene navigator',
      search: 'Search scene, speaker or line', searchLabel: 'Search scenes',
      items: function () { return SCENES.map(function (sc) { return { label: 'Scene ' + sc.id + ' · ' + (who[sc.speaker] || sc.speaker), detail: sc.text }; }); },
      current: function () { return S === state ? sceneIndex() : -1; },
      ready: function () { return S === state && state.ready && !state.handedOff && !state.ending; },
      go: jumpTo
    });
    if (state.nav) { state.root.appendChild(state.nav.host); state.nav.sync(); }
  }

  function onVisibility() {
    if (!S) return;
    if (document.hidden) {
      S.paused = true;
      S.liveAnims.forEach(function (a) { try { a.pause(); } catch (e) {} });
      if (S.audio) S.audio.suspend();
    } else {
      S.paused = false;
      S.lastFrame = 0;
      S.liveAnims.forEach(function (a) { try { if (a.playState === 'paused') a.play(); } catch (e) {} });
      if (S.audio && S.playing) S.audio.resume();
    }
  }

  function mount() {
    if (!DATA || !SCENES.length || !document.body) { releaseGate(); return; }
    S = freshState();
    S.reduced = reducedMotion();
    S.audio = createAudio();
    build();
    fit();
    on(window, 'resize', fit);
    on(window, 'orientationchange', fit);
    on(document, 'visibilitychange', onVisibility);
    on(S.play, 'click', begin);
    on(window, 'keydown', function (e) { if (e.key === 'Escape') skip(); });
    /* A browser that parks audio (a call, a lock screen) gets it back on the
       next touch; the story clock waits for it meanwhile. */
    on(S.root, 'pointerdown', function () { if (S && S.playing && S.audio) S.audio.resume(); });
    S.raf = requestAnimationFrame(tick);
    mountNavigator(S);

    /* The first panel sits behind the start card, dimmed, as soon as it has
       arrived, so the card is never an empty screen. */
    var first = prepareLayer(0);
    first.ready.then(function () {
      if (!S || S.playing) return;
      S.layersHost.appendChild(first.el);
      first.el.classList.add('is-shown');
      S.veil.style.opacity = '0.6';
      animate(S.veil, [{ opacity: 1 }, { opacity: 0.6 }], { duration: 700, easing: 'ease-out' });
    });

    var state = S;
    preload().then(function () {
      if (S !== state || state.finished) return;
      if (state.imageFailed) {
        /* Missing artwork must never block the lesson. */
        console.warn('[story] a scene image did not load; going straight to the lesson');
        finishStory(++state.runGen, 250);
        return;
      }
      state.ready = true;
      setPhase('ready');
      state.progress.classList.add('is-done');
      state.play.setAttribute('aria-disabled', 'false');
      state.play.setAttribute('aria-label', 'Play the story');
      state.play.classList.add('enter');
      if (window.PlayFx && !state.stopPlayFx) state.stopPlayFx = window.PlayFx.mount(state.playWrap);
      if (state.nav) state.nav.sync();
      try { state.play.focus({ preventScroll: true }); } catch (e) {}
    });
  }

  /* --------------------------------------------------------------- audio */

  var NOTE = { C: -9, D: -7, E: -5, F: -4, G: -2, A: 0, B: 2 };
  function hz(name) {
    var m = /^([A-G])(#|b)?(\d)$/.exec(name);
    var semis = NOTE[m[1]] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0) + (Number(m[3]) - 4) * 12;
    return 440 * Math.pow(2, semis / 12);
  }

  /* Wind under the music, per mood: a breath of Arctic air, dropped right
     down when the friends are separated. */
  var AMBIENCE = { warm: 0.05, playful: 0.045, tension: 0.06, hush: 0.02, resolve: 0.035 };

  /* Ogg Opus where the browser plays it, MP3 everywhere else (older Safari). */
  function preferredExt() {
    try {
      var a = document.createElement('audio');
      return a.canPlayType && a.canPlayType('audio/ogg; codecs="opus"') ? 'ogg' : 'mp3';
    } catch (e) { return 'mp3'; }
  }

  function createAudio() {
    var Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return null;
    var ctx;
    try { ctx = new Ctx(); } catch (e) { return null; }

    var master = ctx.createGain();
    master.gain.value = 0.9;
    var limiter = ctx.createDynamicsCompressor();
    limiter.threshold.value = -10; limiter.knee.value = 10;
    limiter.ratio.value = 6; limiter.attack.value = 0.004; limiter.release.value = 0.2;
    master.connect(limiter); limiter.connect(ctx.destination);

    var voiceBus = ctx.createGain(); voiceBus.connect(master);
    var sfxBus = ctx.createGain(); sfxBus.gain.value = 1; sfxBus.connect(master);
    /* Music: section sources -> mood filter -> mood level -> duck -> master. */
    var duckGain = ctx.createGain(); duckGain.gain.value = 1; duckGain.connect(master);
    var moodGain = ctx.createGain(); moodGain.gain.value = 0; moodGain.connect(duckGain);
    var musicFilter = ctx.createBiquadFilter();
    musicFilter.type = 'lowpass'; musicFilter.Q.value = 0.5; musicFilter.frequency.value = 12000;
    musicFilter.connect(moodGain);
    var ambGain = ctx.createGain(); ambGain.gain.value = 0; ambGain.connect(master);

    function noise(seconds, brown) {
      var buf = ctx.createBuffer(1, Math.floor(ctx.sampleRate * seconds), ctx.sampleRate);
      var d = buf.getChannelData(0), last = 0;
      for (var i = 0; i < d.length; i++) {
        var white = Math.random() * 2 - 1;
        if (brown) { last = (last + 0.021 * white) / 1.021; d[i] = last * 3.2; } else d[i] = white;
      }
      return buf;
    }
    var white = noise(2, false);
    var brown = noise(4, true);

    var A = {
      ctx: ctx, ext: preferredExt(), music: null, section: null, sectionSrc: null, sectionGain: null,
      scene: [], ambient: null, closed: false
    };

    function ramp(param, value, seconds) {
      var now = ctx.currentTime;
      param.cancelScheduledValues(now);
      param.setValueAtTime(param.value, now);
      param.linearRampToValueAtTime(value, now + seconds);
    }

    A.decode = function (ab) {
      return new Promise(function (resolve, reject) {
        var p = ctx.decodeAudioData(ab, resolve, reject);
        if (p && p.then) p.then(resolve, reject);
      });
    };

    /* Fetch and decode `base` + .ogg (or .mp3). If the Ogg file will not
       decode here, the MP3 is tried before giving up. */
    A.load = function (base) {
      var get = function (ext) {
        var ctrl = window.AbortController ? new AbortController() : null;
        var timer = setTimeout(function () { if (ctrl) ctrl.abort(); }, 15000);
        return fetch(base + '.' + ext, ctrl ? { signal: ctrl.signal } : undefined)
          .then(function (r) { if (!r.ok) throw new Error(base + '.' + ext + ' ' + r.status); return r.arrayBuffer(); })
          .then(function (ab) { clearTimeout(timer); return A.decode(ab); },
                function (err) { clearTimeout(timer); throw err; });
      };
      return get(A.ext).catch(function (err) {
        if (A.ext === 'mp3') throw err;
        return get('mp3');
      });
    };

    A.unlock = function () {
      try { ctx.resume(); } catch (e) {}
      try {
        var b = ctx.createBuffer(1, 1, ctx.sampleRate);
        var s = ctx.createBufferSource();
        s.buffer = b; s.connect(ctx.destination); s.start(0);
      } catch (e) {}
      A.startAmbience();
    };
    A.resume = function () { if (!A.closed && ctx.state !== 'running') { try { ctx.resume(); } catch (e) {} } };
    A.suspend = function () { if (!A.closed && ctx.state === 'running') { try { ctx.suspend(); } catch (e) {} } };

    /* One line's take out of the joined voice file. */
    A.playVoice = function (buf, offset, duration) {
      var src = ctx.createBufferSource();
      src.buffer = buf;
      src.connect(voiceBus);
      src.startAt = ctx.currentTime + 0.03;
      src.start(src.startAt, offset || 0, (duration || buf.duration) + 0.04);
      return src;
    };
    A.stopVoice = function (src) {
      if (!src) return;
      try { src.stop(); } catch (e) {}
      try { src.disconnect(); } catch (e) {}
    };
    A.duck = function (down) { ramp(duckGain.gain, down ? DUCK_LEVEL : 1, DUCK_SECONDS); };

    A.startAmbience = function () {
      if (A.ambient) return;
      var src = ctx.createBufferSource();
      src.buffer = brown; src.loop = true;
      var lp = ctx.createBiquadFilter();
      lp.type = 'lowpass'; lp.frequency.value = 420; lp.Q.value = 0.7;
      src.connect(lp); lp.connect(ambGain);
      src.start(ctx.currentTime, Math.random() * 2);
      A.ambient = src;
    };

    /* One music file, one section per mood. A mood change crossfades into
       the next section instead of restarting anything; level and tone glide. */
    A.mood = function (name) {
      ramp(ambGain.gain, AMBIENCE[name] || 0.04, 1.6);
      var cfg = DATA.music && DATA.music.sections[name];
      if (!cfg || !A.music || A.section === name) return;
      A.section = name;
      var now = ctx.currentTime;
      var fade = name === 'tension' ? 0.7 : 1.4;
      if (A.sectionSrc) {
        var og = A.sectionGain;
        og.gain.cancelScheduledValues(now);
        og.gain.setValueAtTime(og.gain.value, now);
        og.gain.linearRampToValueAtTime(0, now + fade);
        try { A.sectionSrc.stop(now + fade + 0.05); } catch (e) {}
      }
      var src = ctx.createBufferSource();
      src.buffer = A.music;
      var g = ctx.createGain();
      g.gain.setValueAtTime(0, now);
      g.gain.linearRampToValueAtTime(1, now + fade);
      src.connect(g); g.connect(musicFilter);
      if (cfg.loop) {
        src.loop = true; src.loopStart = cfg.start; src.loopEnd = cfg.end;
        src.start(now, cfg.start);
      } else {
        src.start(now, cfg.start, cfg.end - cfg.start);
      }
      A.sectionSrc = src; A.sectionGain = g;
      ramp(moodGain.gain, (DATA.music.level || 0.12) * (cfg.gain || 1), fade);
      ramp(musicFilter.frequency, cfg.cutoff || 12000, fade);
    };

    A.fadeOut = function (seconds) {
      ramp(moodGain.gain, 0, seconds);
      ramp(ambGain.gain, 0, seconds);
      ramp(sfxBus.gain, 0, seconds);
    };

    /* ---- effects, all synthesised on the same graph ---- */
    function track(node, until) {
      A.scene.push({ node: node, until: until });
      return node;
    }
    function env(at, peak, attack, decay) {
      var g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, at);
      g.gain.linearRampToValueAtTime(peak, at + attack);
      g.gain.exponentialRampToValueAtTime(0.0001, at + attack + decay);
      g.connect(sfxBus);
      return g;
    }
    function bell(freq, at, peak, decay) {
      var g = env(at, peak, 0.006, decay);
      [[1, 1], [2.76, 0.22], [5.4, 0.06]].forEach(function (p) {
        var o = ctx.createOscillator();
        o.type = 'sine'; o.frequency.value = freq * p[0];
        var pg = ctx.createGain(); pg.gain.value = p[1];
        o.connect(pg); pg.connect(g);
        o.start(at); o.stop(at + decay + 0.1);
        track(o, at + decay);
      });
    }
    function burst(at, peak, decay, hp, bp) {
      var src = ctx.createBufferSource();
      src.buffer = white;
      var f1 = ctx.createBiquadFilter(); f1.type = 'highpass'; f1.frequency.value = hp;
      var f2 = ctx.createBiquadFilter(); f2.type = 'bandpass'; f2.frequency.value = bp; f2.Q.value = 0.8;
      var g = env(at, peak, 0.0015, decay);
      src.connect(f1); f1.connect(f2); f2.connect(g);
      src.start(at, Math.random() * 1.5); src.stop(at + decay + 0.05);
      track(src, at + decay);
    }
    function thump(at, peak, from, to, len) {
      var o = ctx.createOscillator();
      o.type = 'sine';
      o.frequency.setValueAtTime(from, at);
      o.frequency.exponentialRampToValueAtTime(to, at + len);
      var g = env(at, peak, 0.006, len);
      o.connect(g); o.start(at); o.stop(at + len + 0.05);
      track(o, at + len);
    }
    function blip(at, peak, from, to, len) {
      var o = ctx.createOscillator();
      o.type = 'sine';
      o.frequency.setValueAtTime(from, at);
      o.frequency.exponentialRampToValueAtTime(to, at + len * 0.6);
      var g = env(at, peak, 0.004, len);
      o.connect(g); o.start(at); o.stop(at + len + 0.05);
      track(o, at + len);
    }
    function crack(at, strength) {
      var n = 3 + Math.round(strength * 2);
      var t = at;
      for (var i = 0; i < n; i++) {
        burst(t, (0.16 - i * 0.022) * strength, rand(0.04, 0.09), 1500, rand(2200, 4200));
        t += rand(0.025, 0.07);
      }
      thump(at, 0.1 * strength, 110, 48, 0.22);
    }
    function sweep(at, peak, dur, f0, f1, f2, source) {
      var src = ctx.createBufferSource();
      src.buffer = source; src.loop = true;
      var f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.Q.value = 1.1;
      f.frequency.setValueAtTime(f0, at);
      f.frequency.exponentialRampToValueAtTime(f1, at + dur * 0.4);
      f.frequency.exponentialRampToValueAtTime(f2, at + dur);
      var g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, at);
      g.gain.linearRampToValueAtTime(peak, at + dur * 0.35);
      g.gain.linearRampToValueAtTime(0.0001, at + dur);
      g.connect(sfxBus);
      src.connect(f); f.connect(g);
      src.start(at, Math.random() * 1.5); src.stop(at + dur + 0.05);
      track(src, at + dur);
    }
    function rumble(at, peak, dur) {
      var src = ctx.createBufferSource();
      src.buffer = brown; src.loop = true;
      var f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 110;
      var g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, at);
      g.gain.linearRampToValueAtTime(peak, at + dur * 0.3);
      g.gain.linearRampToValueAtTime(0.0001, at + dur);
      g.connect(sfxBus);
      src.connect(f); f.connect(g);
      src.start(at, Math.random() * 2); src.stop(at + dur + 0.05);
      track(src, at + dur);
    }

    var SFX = {
      ambience: function () { ramp(ambGain.gain, 0.055, 2.2); },
      hush: function () { ramp(ambGain.gain, 0.018, 1.2); },
      /* The speech balloon pops up. */
      pop: function (t) { blip(t, 0.05, 420, 1050, 0.1); burst(t, 0.012, 0.02, 2500, 3500); },
      hearts: function (t) { ['E6', 'G6', 'B6'].forEach(function (n, i) { bell(hz(n), t + i * 0.09, 0.02, 0.8); }); },
      chime: function (t) { ['E6', 'G#6', 'B6'].forEach(function (n, i) { bell(hz(n), t + i * 0.09, 0.045, 1.5); }); },
      sparkle: function (t) {
        [2637, 3520, 3136, 4186, 3951].forEach(function (f, i) { bell(f, t + i * 0.05, 0.02, 0.32); });
      },
      effort: function (t) {
        sweep(t, 0.05, 0.45, 700, 1300, 800, white);
        thump(t + 0.05, 0.06, 90, 60, 0.14);
      },
      'crack-small': function (t) { crack(t, 0.7); },
      'crack-rumble': function (t) { crack(t, 0.8); rumble(t + 0.05, 0.3, 1.7); },
      'crack-big': function (t) { crack(t, 1.15); crack(t + 0.18, 0.8); rumble(t, 0.22, 1.1); },
      whoosh: function (t) { sweep(t, 0.07, 0.75, 300, 1800, 500, white); },
      /* The cartoon "uh-oh": a slide whistle falling away. */
      'whistle-down': function (t) {
        var o = ctx.createOscillator();
        o.type = 'sine';
        o.frequency.setValueAtTime(1500, t);
        o.frequency.exponentialRampToValueAtTime(430, t + 0.55);
        var vib = ctx.createOscillator(); vib.frequency.value = 7;
        var depth = ctx.createGain(); depth.gain.value = 16;
        vib.connect(depth); depth.connect(o.frequency);
        var g = ctx.createGain();
        g.gain.setValueAtTime(0.0001, t);
        g.gain.linearRampToValueAtTime(0.04, t + 0.05);
        g.gain.setValueAtTime(0.04, t + 0.45);
        g.gain.linearRampToValueAtTime(0.0001, t + 0.6);
        g.connect(sfxBus);
        o.connect(g);
        o.start(t); o.stop(t + 0.62); vib.start(t); vib.stop(t + 0.62);
        track(o, t + 0.6); track(vib, t + 0.6);
      },
      'warm-cue': function (t) { ['C5', 'E5', 'G5', 'C6'].forEach(function (n, i) { bell(hz(n), t + i * 0.14, 0.03, 2.2); }); }
    };
    A.sfx = function (name) {
      if (ctx.state !== 'running' || !SFX[name]) return;
      SFX[name](ctx.currentTime + 0.01);
    };
    /* A scene's sounds end with the scene: a short fade, never a click. */
    A.stopSceneSounds = function () {
      var now = ctx.currentTime;
      A.scene.forEach(function (s) {
        if (s.until > now + 0.2) { try { s.node.stop(now + 0.15); } catch (e) {} }
      });
      A.scene = [];
    };

    A.close = function () {
      if (A.closed) return;
      A.closed = true;
      try { A.fadeOut(0.25); } catch (e) {}
      setTimeout(function () { try { ctx.close(); } catch (e) {} }, 400);
    };
    return A;
  }

  /* ------------------------------------------------------------------ API */

  var StoryIntro = {
    gate: gate,
    /* For tests and tools: the live controller state. */
    state: function () {
      if (!S) return { active: false, finished: true, lastRun: StoryIntro.lastRun || null };
      return {
        active: true, phase: S.phase, scene: S.scene, clock: Math.round(S.clock),
        isTransitioning: S.isTransitioning, isVOPlaying: S.isVOPlaying, canContinue: S.canContinue,
        ready: S.ready, playing: S.playing, handedOff: S.handedOff,
        waiters: S.waiters.length, listeners: S.listeners.length, animations: S.liveAnims.length,
        layers: S.layersHost ? S.layersHost.children.length : 0, boxShown: !!(S.box && S.box.shown),
        audio: S.audio ? S.audio.ctx.state : 'none',
        music: S.audio ? { loaded: !!S.audio.music, section: S.audio.section, format: S.audio.ext } : null,
        voiceLoaded: !!S.voiceBuffer, history: S.history.slice()
      };
    },
    play: function () { begin(null); },
    skip: skip,
    /* Play on from scene index i (the ?dev=1 Scenes menu uses it). */
    jump: jumpTo,
    /* Start the story again from its start card. While the story is still
       on screen it restarts in place; once the lesson has begun, the whole
       experience reloads, because the lesson cannot be paused underneath.
       The lesson gate is released once, ever. */
    replay: function () {
      if (gateSettled && !S) {
        window.location.reload();
        return new Promise(function () {});
      }
      if (S) teardown(S);
      return new Promise(function (resolve) {
        mount();
        if (S) S.replayDone = resolve; else resolve();
      });
    },
    lastRun: null
  };
  window.StoryIntro = StoryIntro;

  function autostart() {
    if (skipRequested()) { releaseGate(); return; }
    mount();
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', autostart, { once: true });
  } else {
    autostart();
  }
})();
