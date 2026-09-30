/* ============================================================================
   THE BROKEN PATH — the story between Part 1 and Part 2.

   Part 1, the polygon lesson, ends on its completion screen: Swiftee's "You did
   it!", the confetti, then a short pause. The lesson then calls start(). It does
   not cut to a new screen. The ice frosts over the lesson and clears on this
   scene, which is set in the Part 2 game's own world and drawn from its own art
   (game/assets), placed the way game/js/engine.js places it:

     Momo runs in along the ice path and the path starts to scroll. The break
     comes into view ahead, and he skids to a stop short of the edge. He looks
     down at the drop, trembles a little and settles. Swiftee flies in on a
     curve, slows, and lands between him and the edge. She looks at the gap,
     looks back at Momo, and then speaks in her own Part 1 dialogue box: the two
     lines Part 2 already has recorded for this moment, word by word with the
     owner's own take. When the last line has been read, Next appears.

   THE SOUND is the game's own: its recorded snow footsteps on each footfall, its
   skid, its cartoon pips as Momo shivers at the edge, its whoosh (lighter, for a
   small bird) as Swiftee swoops in, and its interface tap on Next.

   Next hands over to RunnerStage (src/runner/runner-stage.js), which fades to
   the Part 2 cover: the Frozen Rush banner and its Play button. Play starts the
   game. That cover is the game's own (game/js/frontend.js), and it already
   ignores a second press and starts the run once. Nothing in game/ is changed
   by this file; it only reads the game's art, its voice take and its state.

   THE STATES, in order, as state().phase reports them:
     PART1_COMPLETE   the lesson's last line is done and start() was called
     STORY_ENTER      the ice frosts over the lesson and clears on the scene
     MOMO_RUNNING     Momo runs in; the path scrolls; the break comes into view
     MOMO_AT_DITCH    he has stopped short of the edge and looks down
     SWIFTEE_ENTER    Swiftee flies in and lands
     SWIFTEE_OBSERVE  she looks at the gap, then at Momo
     DIALOGUE         her two lines, word by word with the voice
     STORY_READY      the last line is said; it stays up to be read
     NEXT_ENABLED     Next is on screen and takes a tap
     PART2_BANNER     Next was pressed; the Part 2 cover is coming up
     PLAY_READY       the cover is up and its Play takes a tap
     PART2_START      Play was pressed; Part 2 is running
   The last two are read from the game itself (RunnerStage.state()), not guessed.

   NOTHING ELSE TAKES A TAP OR A KEY. From start() until the hand-off, the page
   under the scene is inert, the scene swallows every pointer and key that is
   not meant for Next, and Next does not exist on screen until NEXT_ENABLED. A
   tap cannot skip Swiftee's entrance, start a line twice or press Next early.

   THE VOICE. The lines are windows in the game's one recorded take
   (game/assets/audio/vo-lines.*), with the word times the game itself uses
   (CFG.vo.lines in game/js/engine.js; tests/bridge.test.cjs holds that the two
   copies agree). The take plays through the lesson's own AudioContext, which the
   learner's taps have already unlocked, so the scene can speak without asking
   for another tap. Where there is no sound (no context, blocked autoplay, a
   failed download), the words still arrive on the same clock, silently, and
   the scene carries on. A story that cannot talk is never a story that stops.

   URL flags:
     ?bridge=0   leave this scene out: the completion screen keeps Help Momo and
                 Play again, as it did before
     ?bridge=1   open straight on this scene (the story, the blizzard and the
                 lesson are skipped), for review and for the tests
   With ?game=0 there is no Part 2, so there is no scene either.
   ========================================================================= */
(function () {
  'use strict';

  function params() {
    try { return new URLSearchParams(window.location.search); } catch (e) { return null; }
  }
  var q = params();
  var flag = q ? q.get('bridge') : null;
  var RS = window.RunnerStage;
  var enabled = !!(RS && RS.enabled && !RS.autostart) && flag !== '0';
  var autostart = enabled && flag === '1';

  /* ------------------------------------------------------------ the world */
  /* Every number here is the game's own (game/js/engine.js), so this scene's ground is
     the ground the game opens on: the same stage, walking line, path art and scale. */
  var GAME = 'game/';
  var W = 1920, H = 1080;                 // CFG.W, CFG.H
  var SURFACE = 840;                      // CFG.surfaceY: the walking line
  var WATER = SURFACE + 190;              // CFG.levelOne.waterDepth: open water under the shelf
  var PATH = { tileX: 56, tileW: 1536, srcH: 530, scale: 1.24, surfaceRatio: 0.4377, contentBottom: 0.7321 };
  var TILE_W = Math.round(PATH.tileW * PATH.scale), TILE_H = Math.round(PATH.srcH * PATH.scale);
  var TILE_Y = SURFACE - PATH.surfaceRatio * TILE_H;
  var FACE_H = (PATH.contentBottom - PATH.surfaceRatio) * TILE_H;   // the path's carved face below the snow
  /* The lips are the ends of the platform art (cap-l / cap-r), scaled so their face is
     as tall as the path's and their snow row sits on the walking line. */
  var CAP = { w: 150, h: 227, snowTop: 52, rockEnd: 226, overlap: 8, fade: 0.4 };
  var CAP_S = FACE_H / (CAP.rockEnd - CAP.snowTop);
  var SKY = { x: -48, y: -27, w: 2016, h: 1134 };   // the game draws each sky at this rect

  /* The mammoth sheets: 420x320 cells in six columns (630x480 in hd/), the foot line 27
     source px above the cell's bottom, drawn at 1.75x. */
  var CHAR = { cw: 420, ch: 320, cols: 6, baseGap: 27, scale: 1.75, hd: 1.5 };
  /* The run cycle is driven by ground covered, not by a clock, as in the game: 1120 px
     of ground is one 36-frame stride, so the feet stay planted at any speed. */
  var RUN = { speed: 520, stride: 1120, frames: 36, contacts: [3, 11, 21, 30] };
  /* The stop: 140 ms still at full speed, then the skid sheet across a 1260 ms slide at
     speed (1 - u)^1.4, which is the game's own braking curve (CFG.timing.breakSkid). */
  var SKID = { hold: 140, slide: 1260, k: 1.4, frames: 36 };
  /* HE LOOKS DOWN — the game's tremble sheet, acted by a plan of [frame, ms] steps the way
     CFG.sprite.tremble acts it, but QUIETER: one pass of the 4-5-6 shiver instead of three,
     and none of the knock the game adds on top. He notices the drop and looks down (0-3),
     shivers once (4-6), looks up and settles (7-11). About two seconds. */
  var LOOK = [[0, 200], [1, 180], [2, 220], [3, 200], [4, 110], [5, 95], [6, 85], [5, 90], [4, 110],
              [7, 150], [8, 150], [9, 140], [10, 150], [11, 200]];
  var IDLE = { frames: 12, fps: 9 };     // the game's idle: twelve poses at 9 fps, crossfaded

  /* THE COMPOSITION, in stage px: Momo stops at MOMO_X; the near lip of the break is at
     LIP and the break is GAP wide; Swiftee lands at PERCH, between his trunk (~740) and
     the edge. FACE_R is the right side of his face: her bubble stays to the right of it,
     so it never covers him. SUBJECT_W is how much of the stage must fit across the
     screen, which is what lets an upright phone show the whole scene. */
  var MOMO_X = 520, LIP = 1040, GAP = 440, FACE_R = 800, SUBJECT_W = 1380;
  var PERCH = 880, BIRD = 280;            // her landing spot and the size her 256px cell is drawn at
  var FLY_FEET = 0.76;                    // where her feet sit in a flight frame (standing: SWIFTEE.baseline)
  var HEAD = 0.1;                         // the top of her head in her cell

  /* The two lines, and the window each takes out of the game's recorded take. The
     numbers are CFG.vo.lines['tut-5-broken'] and ['tut-2-goal'] in game/js/engine.js:
     [start, length] in seconds and each word's start inside the window. */
  var LINES = [
    { id: 'tut-5-broken', text: 'Oh no! The path is broken.', at: 11.23, dur: 2.86,
      words: [0.06, 0.34, 1.13, 1.40, 1.86, 2.46], focus: { 'broken.': 1 } },
    { id: 'tut-2-goal', text: 'Help Momo cross the Frozen Pass!', at: 4.28, dur: 2.95,
      words: [0.07, 0.33, 0.95, 1.40, 1.65, 2.30], focus: { 'Frozen': 1, 'Pass!': 1 } }
  ];
  var VO_SRC = 'assets/audio/vo-lines.mp3';
  /* THE GAME'S OWN SOUNDS (CFG.sfx in game/js/engine.js), at its gains under its 0.7 master:
     the recorded snow footsteps, cut at each footfall found in the waveform and taken in
     turn; the owner's cartoon pips for the tremble at the edge; the whoosh, pitched up
     and quiet for a small bird swooping in; and the interface tap the cover's Play uses. */
  var MASTER = 0.7;
  var SFX = {
    step:    { src: 'assets/audio/freesound_community-foot_steps_snow_heavy-38297.mp3', mode: 'onset', dur: 0.40, gain: 0.42, rate: 0.10 },
    tremble: { src: 'assets/audio/dragon-studio-cartoon-blinking-372481.mp3', mode: 'window', at: 0.04, dur: 0.50, gain: 0.55, rate: 0.03 },
    whoosh:  { src: 'assets/audio/dragon-studio-heavy-whoosh-06-414584.mp3', mode: 'onset', dur: 0.55, gain: 0.16, rate: 0.04, pitch: 1.5 },
    ui:      { src: 'assets/audio/floraphonic-punchy-taps-ui-5-183901.mp3', mode: 'onset', dur: 0.22, gain: 0.45, rate: 0.08 }
  };

  /* THE TIMELINE, in ms of scene time. The run is short on purpose: in, a stretch of
     running while the break comes into view, the stop. */
  var T = {
    frost: 440,        // the ice wipes over the lesson
    loadCap: 8000,     // longest the scene waits for its art under the frost
    enter: 1730,       // Momo runs in while the path picks up speed
    cruise: 900,       // running, with the break in view
    beforeBird: 450,   // he has settled; a breath before Swiftee
    fly: 1900,         // her flight in, slowing to the end
    settle: 500,       // wings folding after the touchdown
    lookGap: 700,      // she looks at the break
    lookMomo: 450,     // she looks back at Momo
    partOut: 160,      // a line fading out before the next takes the box
    lineGap: 420,      // the pause between the two lines
    read: 900,         // the last line stays up alone before Next
    stillLook: 900     // reduced motion: how long he is shown looking down
  };
  var WORD_LEAD = 0.04;  // a word shows this far ahead of its sound

  /* The run, integrated in closed form, so where he stops never depends on the frame
     rate: the break is placed exactly LIP px ahead of the spot he comes to rest on. */
  var RUN_END = T.enter + T.cruise + SKID.hold, STOP_AT = RUN_END + SKID.slide;
  function worldAt(t) {
    var v = RUN.speed / 1000;
    if (t <= 0) return 0;
    if (t < T.enter) { var u = t / T.enter; return v * T.enter * u * u / 2; }   // the path picks up speed
    if (t < RUN_END) return v * (T.enter / 2 + (t - T.enter));
    var s = Math.min(1, (t - RUN_END) / SKID.slide);
    return v * (T.enter / 2 + T.cruise + SKID.hold) +
      v * SKID.slide * (1 - Math.pow(1 - s, SKID.k + 1)) / (SKID.k + 1);
  }
  var HOLE_WX = worldAt(STOP_AT) + LIP;   // the near lip, in world px from where the run starts

  var SW = window.SWIFTEE || null;
  var BIRD_CLIPS = ['flying', 'flapping', 'blinking', 'curious', 'talk_start', 'talking', 'talk_stop'];
  var REQUIRED = ['sky', 'path', 'capL', 'capR', 'run', 'skid', 'tremble', 'idle', 'bird:flying', 'bird:blinking', 'bird:talking'];

  var S = null;          // the run on screen, or null
  var last = null;       // what the last run left behind, for state()
  var loading = null;    // the preload, shared by every caller
  var art = {};          // loaded images, by name
  var bytes = {};        // fetched audio, by name
  var ctxHint = null;    // the lesson's AudioContext, when it was handed over early
  var versionsP = null;

  function noop() {}
  function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function easeOut(t, p) { return 1 - Math.pow(1 - clamp(t, 0, 1), p || 2); }
  function reducedMotion() {
    return !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  }
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

  /* ---------------------------------------------------------------- assets */
  /* The game appends a content hash to every asset URL (game/js/asset-versions.js). The
     same table is read here, so this scene asks for exactly the URLs the game will, and
     the game finds its sheets already in the cache. Without the table, the plain URL. */
  function versions() {
    if (versionsP) return versionsP;
    versionsP = new Promise(function (resolve) {
      try {
        import(new URL(GAME + 'js/asset-versions.js', document.baseURI).href)
          .then(function (m) { resolve((m && m.ASSET_V) || {}); }, function () { resolve({}); });
      } catch (e) { resolve({}); }
    });
    return versionsP;
  }
  function gameUrl(V, src) { return GAME + src + (V[src] ? '?v=' + V[src] : ''); }
  /* The game's own choice of sound file: Ogg Vorbis where the browser plays it, MP3
     elsewhere. The word times were measured on the same take, so either serves. */
  function gameAudioUrl(V, src) {
    var ogg = false;
    try { ogg = location.protocol !== 'file:' && !!new Audio().canPlayType('audio/ogg; codecs="vorbis"'); } catch (e) {}
    if (ogg) { var o = src.replace(/\.mp3$/, '.ogg'); if (V[o]) src = o; }
    return gameUrl(V, src);
  }
  function loadImg(url) {
    return new Promise(function (resolve) {
      var i = new Image();
      i.decoding = 'async';
      i.onload = function () { if (i.decode) i.decode().then(function () { resolve(i); }, function () { resolve(i); }); else resolve(i); };
      i.onerror = function () { resolve(null); };
      i.src = url;
    });
  }
  function fetchBytes(url) {
    if (!window.fetch) return Promise.resolve(null);
    return fetch(url).then(function (r) { return r.ok ? r.arrayBuffer() : null; }).catch(function () { return null; });
  }
  /* The hi-DPI mammoth sheets when the scene will be drawn at 1.15x or more, as the game
     decides; phones stay on the base set. */
  function pickHd() {
    var dpr = Math.min(2, window.devicePixelRatio || 1);
    var s = Math.min((window.innerWidth || W) / SUBJECT_W, (window.innerHeight || H) / H);
    return dpr * s >= 1.15;
  }
  /* A faded copy of each lip, made once: the cap is a different piece of the sheet from
     the path tile it meets, so its inner 40% fades to nothing to hide the seam. */
  function fadedCap(img, side) {
    try {
      var c = document.createElement('canvas');
      c.width = CAP.w; c.height = CAP.h;
      var g = c.getContext('2d');
      g.drawImage(img, 0, 0, CAP.w, CAP.h);
      g.globalCompositeOperation = 'destination-out';
      var fw = CAP.w * CAP.fade, gr;
      if (side === 'l') { gr = g.createLinearGradient(0, 0, fw, 0); gr.addColorStop(0, 'rgba(0,0,0,1)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gr; g.fillRect(0, 0, fw, CAP.h); }
      else { gr = g.createLinearGradient(CAP.w - fw, 0, CAP.w, 0); gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(1, 'rgba(0,0,0,1)'); g.fillStyle = gr; g.fillRect(CAP.w - fw, 0, fw, CAP.h); }
      /* and no snow mounds on the part that fades: half-faded, a mound reads as a ghost
         of one laid over the path's own. The lip keeps the snow at its end. */
      g.fillStyle = '#000';
      var keep = CAP.w * 0.32, mound = CAP.snowTop - 6;
      if (side === 'l') g.fillRect(0, 0, CAP.w - keep, mound);
      else g.fillRect(keep, 0, CAP.w - keep, mound);
      return c;
    } catch (e) { return img; }
  }

  /* THE PATH TILE, AND ITS MIRROR. The path art is a finished segment, not a seamless
     tile, so the game lays it out A A' A A': every join then meets its own reflection
     and there is no seam. The same two tiles here, cropped as the game crops them. */
  function pathTile(img, mirror) {
    try {
      var c = document.createElement('canvas');
      c.width = PATH.tileW; c.height = PATH.srcH;
      var g = c.getContext('2d');
      if (mirror) { g.translate(PATH.tileW, 0); g.scale(-1, 1); }
      g.drawImage(img, PATH.tileX, 0, PATH.tileW, PATH.srcH, 0, 0, PATH.tileW, PATH.srcH);
      return c;
    } catch (e) { return null; }
  }

  /* Load everything the scene draws and says. Called as the completion screen opens, so
     it is all in by the time the last line has been read. The game's frame is asked to
     load after the scene's own art (or after 2.5 s, whichever comes first), so the two
     do not fight over a slow connection for the part that is needed first. */
  function preload(opts) {
    if (!enabled) return Promise.resolve(false);
    if (opts && opts.audioContext) ctxHint = opts.audioContext;
    if (loading) return loading;
    var hd = pickHd();
    var runner = function () { if (RS && RS.preload) RS.preload(); };
    setTimeout(runner, 2500);
    loading = versions().then(function (V) {
      var jobs = [];
      var add = function (key, url) { jobs.push(loadImg(url).then(function (im) { art[key] = im; })); };
      add('sky', gameUrl(V, 'assets/sky/01-dawn.webp'));   // the game opens at dawn
      add('path', gameUrl(V, 'assets/env/path.webp'));
      add('capL', gameUrl(V, 'assets/env/cap-l.webp'));
      add('capR', gameUrl(V, 'assets/env/cap-r.webp'));
      add('rock', gameUrl(V, 'assets/env/rock-band.webp'));
      ['run', 'skid', 'tremble', 'idle'].forEach(function (k) {
        add(k, gameUrl(V, 'assets/char/' + (hd ? 'hd/' : '') + 'mammoth-' + k + '.webp'));
      });
      if (SW && SW.clips) BIRD_CLIPS.forEach(function (c) { if (SW.clips[c]) add('bird:' + c, SW.clips[c].image); });
      if (document.fonts && document.fonts.load) jobs.push(document.fonts.load('600 46px Fredoka').catch(noop));
      bytes.voice = fetchBytes(gameAudioUrl(V, VO_SRC));
      Object.keys(SFX).forEach(function (k) { bytes[k] = fetchBytes(gameAudioUrl(V, SFX[k].src)); });
      return Promise.all(jobs).then(function () {
        art.hd = hd;
        if (art.path) { art.tileA = pathTile(art.path, false); art.tileB = pathTile(art.path, true); }
        if (art.capL) art.capLf = fadedCap(art.capL, 'l');
        if (art.capR) art.capRf = fadedCap(art.capR, 'r');
        return REQUIRED.every(function (k) { return !!art[k]; });
      });
    });
    loading.then(runner, runner);
    return loading;
  }

  /* ----------------------------------------------------------------- sound */
  function openAudio(given) {
    var ctx = given || ctxHint, own = false;
    if (!ctx || ctx.state === 'closed') {
      var A = window.AudioContext || window.webkitAudioContext;
      ctx = null;
      if (A) { try { ctx = new A(); own = true; } catch (e) { ctx = null; } }
    }
    if (!ctx) return null;
    var out;
    try { out = ctx.createGain(); out.gain.value = 1; out.connect(ctx.destination); } catch (e) { return null; }
    var A2 = { ctx: ctx, own: own, out: out, live: [], buf: {}, hits: {}, next: {} };
    if (ctx.state === 'suspended') { try { ctx.resume().catch(noop); } catch (e) {} }
    /* Decode the take and the sounds with this context, once preload has started fetching
       them. decodeAudioData detaches what it is given, so each gets a copy. */
    versions().then(function () { ['voice'].concat(Object.keys(SFX)).forEach(function (name) {
      if (!bytes[name]) return;
      bytes[name].then(function (ab) {
        if (!ab || !S || S.audio !== A2) return;
        var done = function (b) {
          if (!b || !S || S.audio !== A2 || A2.buf[name]) return;
          A2.buf[name] = b;
          if (SFX[name] && SFX[name].mode === 'onset') A2.hits[name] = onsets(b);
        };
        try {
          var p = ctx.decodeAudioData(ab.slice(0), done, noop);
          if (p && p.then) p.then(done, noop);
        } catch (e) {}
      });
    }); });
    return A2;
  }
  /* WHERE EACH HIT STARTS, found the way the game finds them (AudioManager._onsets): a 10 ms
     energy envelope, a hit where it rises through 24% of the peak, re-armed below 10%, and
     never two inside 90 ms. */
  function onsets(buf) {
    var d = buf.getChannelData(0), sr = buf.sampleRate, win = Math.max(1, Math.round(sr * 0.01));
    var n = Math.floor(d.length / win), env = new Float32Array(n), peak = 0, i, k;
    for (i = 0; i < n; i++) {
      var sum = 0;
      for (k = 0; k < win; k++) { var v = d[i * win + k]; sum += v * v; }
      env[i] = Math.sqrt(sum / win);
      if (env[i] > peak) peak = env[i];
    }
    if (peak <= 0) return [0];
    var open = peak * 0.24, shut = peak * 0.10, hits = [], armed = true, lastAt = -1;
    for (i = 1; i < n; i++) {
      if (armed && env[i] > open) {
        var t = (i * win) / sr;
        if (lastAt < 0 || t - lastAt > 0.09) { hits.push(Math.max(0, t - 0.01)); lastAt = t; }
        armed = false;
      } else if (!armed && env[i] < shut) armed = true;
    }
    return hits.length ? hits : [0];
  }
  function running() { return !!(S && S.audio && S.audio.ctx.state === 'running'); }
  function track(src) {
    var A = S.audio;
    A.live.push(src);
    src.onended = function () { var i = A.live.indexOf(src); if (i >= 0) A.live.splice(i, 1); };
  }
  function heard(name) { S.sounds.push({ name: name, at: Math.round(S.clock) }); }
  /* One of the game's cues from its file, as the game plays it (AudioManager._play): the
     next hit in turn, a bite of the cue's length, a little rate jitter, a short ramp at each
     end so a slice never clicks. False when the sound is not here. */
  function cue(name) {
    var c = SFX[name];
    if (!c || !running() || !S.audio.buf[name]) return false;
    try {
      var A = S.audio, buf = A.buf[name], at;
      if (c.mode === 'onset') {
        var hs = A.hits[name] || [0];
        A.next[name] = (A.next[name] || 0) + 1;
        at = hs[(A.next[name] - 1) % hs.length];
      } else at = c.at || 0;
      var dur = Math.min(c.dur, Math.max(0.02, buf.duration - at));
      if (dur <= 0.02) return false;
      var t = A.ctx.currentTime, rate = (c.pitch || 1) * (1 + (Math.random() * 2 - 1) * (c.rate || 0));
      var src = A.ctx.createBufferSource(); src.buffer = buf; src.playbackRate.value = rate;
      var g = A.ctx.createGain(), len = dur / rate, ramp = Math.min(0.012, len / 4);
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(c.gain * MASTER, t + ramp);
      g.gain.setValueAtTime(c.gain * MASTER, t + len - ramp);
      g.gain.linearRampToValueAtTime(0, t + len);
      src.connect(g); g.connect(A.out);
      src.start(t, at, dur);
      src.stop(t + len + 0.02);
      track(src);
      heard(name);
      return true;
    } catch (e) { return false; }
  }
  function noiseBuffer() {
    var A = S.audio;
    if (A.noise) return A.noise;
    var n = Math.floor(A.ctx.sampleRate), b = A.ctx.createBuffer(1, n, A.ctx.sampleRate), d = b.getChannelData(0);
    for (var i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
    return (A.noise = b);
  }
  /* The game's synthesised voices (AudioManager._noise and _warble), for the cues the game
     itself still makes rather than plays from a file: the skid, and the wing beats. */
  function noise(dur, freq, type, gain, qv, delay, sweepTo) {
    if (!running()) return;
    try {
      var c = S.audio.ctx, t = c.currentTime + (delay || 0);
      var src = c.createBufferSource(); src.buffer = noiseBuffer();
      src.playbackRate.value = 0.8 + Math.random() * 0.4;
      var f = c.createBiquadFilter(); f.type = type || 'bandpass'; f.Q.value = qv || 1.2;
      f.frequency.setValueAtTime(freq, t);
      if (sweepTo) f.frequency.exponentialRampToValueAtTime(Math.max(60, sweepTo), t + dur);
      var g = c.createGain();
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(gain * MASTER, t + 0.012);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      src.connect(f); f.connect(g); g.connect(S.audio.out);
      src.start(t); src.stop(t + dur + 0.05);
      track(src);
    } catch (e) {}
  }
  function warble(freq, dur, gain, type, slide, depth, rate, delay) {
    if (!running()) return;
    try {
      var c = S.audio.ctx, t = c.currentTime + (delay || 0);
      var o = c.createOscillator(); o.type = type || 'sine';
      o.frequency.setValueAtTime(freq, t);
      if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(40, slide), t + dur);
      var lfo = c.createOscillator(); lfo.type = 'sine'; lfo.frequency.setValueAtTime(rate || 14, t);
      var lg = c.createGain(); lg.gain.setValueAtTime(depth || 40, t); lg.gain.exponentialRampToValueAtTime(0.5, t + dur);
      lfo.connect(lg); lg.connect(o.frequency);
      var g = c.createGain();
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(gain * MASTER, t + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(g); g.connect(S.audio.out);
      o.start(t); o.stop(t + dur + 0.05);
      lfo.start(t); lfo.stop(t + dur + 0.05);
      track(o); track(lfo);
    } catch (e) {}
  }
  function tone(freq, dur, type, gain) {
    if (!running()) return;
    try {
      var c = S.audio.ctx, t = c.currentTime;
      var o = c.createOscillator(), g = c.createGain();
      o.type = type; o.frequency.value = freq;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(gain, t + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(g); g.connect(S.audio.out);
      o.start(t); o.stop(t + dur + 0.02);
      track(o);
    } catch (e) {}
  }
  /* A window of a decoded recording. Returns the context time it starts at, or null. */
  function clip(name, at, dur, gain, delay) {
    if (!running() || !S.audio.buf[name]) return null;
    try {
      var c = S.audio.ctx, t = c.currentTime + (delay || 0);
      var src = c.createBufferSource(); src.buffer = S.audio.buf[name];
      var g = c.createGain(); g.gain.value = gain;
      src.connect(g); g.connect(S.audio.out);
      src.start(t, at, dur);
      track(src);
      return t;
    } catch (e) { return null; }
  }
  var sfx = {
    /* a footfall: the recorded crunch, or the game's own synthesised one without it */
    step: function () {
      if (cue('step')) return;
      S.alt = !S.alt;
      if (running()) { noise(0.075, S.alt ? 1250 : 880, 'bandpass', 0.055, 2.4); heard('step'); }
    },
    /* THE GAME'S SKID (AudioManager.skid), fitted to this stop: the feet hissing all the way
       down, the comic squeal sliding, and the thump of coming to rest. */
    skid: function () {
      if (!running()) return;
      noise(1.45, 1750, 'bandpass', 0.055, 9, 0, 480);
      warble(820, 1.35, 0.028, 'sawtooth', 240, 60, 22);
      noise(0.3, 420, 'lowpass', 0.05, 0.8, 1.3, 160);
      heard('skid');
    },
    tremble: function () { cue('tremble'); },
    whoosh: function () { cue('whoosh'); },
    /* her wings as she touches down: three soft beats */
    flutter: function () {
      if (!running()) return;
      [0, 0.07, 0.15].forEach(function (d) { noise(0.05, 2600, 'bandpass', 0.04, 1.4, d); });
      heard('flutter');
    },
    tap: function () { if (!cue('ui')) tone(520, 0.08, 'triangle', 0.05); }
  };

  /* ----------------------------------------------------------------- build */
  function build() {
    var root = el('div', '');
    root.id = 'bridge-story';
    root.tabIndex = -1;
    root.setAttribute('role', 'dialog');
    root.setAttribute('aria-modal', 'true');
    root.setAttribute('aria-label', 'Momo reaches the broken path');

    var canvas = el('canvas', 'bridge-canvas', root);
    canvas.setAttribute('aria-hidden', 'true');

    /* SWIFTEE'S OWN DIALOGUE BOX, the one she speaks in all through Part 1: the lesson's
       markup and classes (styles/dialogue.css), cream paper, a teal edge with a soft glow,
       the catch-light, and the curved tail that is one silhouette with the box. It is built
       at the lesson's own sizes and scaled as one piece to the scene. */
    var say = el('div', 'bridge-say', root);
    say.setAttribute('aria-hidden', 'true');
    var box = el('div', 'comic-dialogue dialogue-box bridge-box', say);
    var inner = el('div', 'dialogue-inner', box);
    var dtext = el('div', 'dialogue-text', inner);
    var text = el('div', 'bridge-say-text', dtext);
    var tail = svgEl('svg', { class: 'dialogue-tail', viewBox: '0 0 60 60', 'aria-hidden': 'true' }, box);
    svgEl('path', { class: 'dialogue-tail-fill', d: 'M14 0 H46 V12 C44 26 34 40 12 54 C16 40 18 26 14 12 Z' }, tail);
    svgEl('path', { class: 'dialogue-tail-stroke', d: 'M46 12 C44 26 34 40 12 54 C16 40 18 26 14 12' }, tail);

    var live = el('div', 'bridge-live', root);
    live.setAttribute('aria-live', 'polite');

    /* the Part 1 buttons kit's blue navigation pill (styles/buttons-kit.css) */
    var next = el('button', 'kit-btn kit-btn--nav bridge-next', root);
    next.type = 'button';
    next.hidden = true;
    next.disabled = true;
    next.innerHTML = '<span>Next</span><span class="chev" aria-hidden="true">&#9654;</span>';

    var frost = el('div', 'bridge-frost', root);
    frost.setAttribute('aria-hidden', 'true');

    document.body.appendChild(root);
    S.root = root; S.canvas = canvas; S.ctx = canvas.getContext('2d'); S.next = next; S.live = live;
    S.say = { el: say, box: box, text: text, spans: [], line: null, shown: false };
  }

  /* ---------------------------------------------------------------- camera */
  /* The stage is the game's 1920x1080. It is fitted so that SUBJECT_W of it always fits
     across the screen and the whole height fits in a landscape one; whatever else the
     screen shows is more of the same world (the path runs on, the sky and the water
     reach the edges), never a letterbox. An upright phone sees the scene from further
     back, with the walking line at 60% of its height. */
  function fit() {
    if (!S) return;
    var vw = S.root.clientWidth || window.innerWidth || W;
    var vh = S.root.clientHeight || window.innerHeight || H;
    var dpr = Math.min(2, window.devicePixelRatio || 1);
    var s = Math.min(vw / SUBJECT_W, vh / H);
    var w = vw / s, h = vh / s;
    var cx = W / 2 - clamp((W - w) / 2, 0, 90);
    S.cam = { vw: vw, vh: vh, dpr: dpr, s: s, w: w, h: h, l: cx - w / 2, t: Math.min((H - h) / 2, SURFACE - 0.6 * h) };
    S.canvas.width = Math.max(1, Math.round(vw * dpr));
    S.canvas.height = Math.max(1, Math.round(vh * dpr));
    S.canvas.style.width = vw + 'px';
    S.canvas.style.height = vh + 'px';
    S.backdrop = null;
    if (S.say.line) placeSay();
  }
  function toScreen(x, y) { var c = S.cam; return { x: (x - c.l) * c.s, y: (y - c.t) * c.s }; }

  /* The sky and the water, which never move, drawn once per size into a canvas the
     size of the screen. The sky is the game's rect, scaled about the middle of the
     walking line only as far as it takes to reach every edge of the view above the
     water; below the water line it is the game's sea. */
  function backdrop() {
    if (S.backdrop) return S.backdrop;
    var c = S.cam, cv = document.createElement('canvas');
    cv.width = S.canvas.width; cv.height = S.canvas.height;
    var g = cv.getContext('2d'), k = c.dpr * c.s;
    g.setTransform(k, 0, 0, k, -c.l * k, -c.t * k);
    var ax = W / 2, ay = SURFACE;
    var f = Math.max(1, (ax - c.l) / (ax - SKY.x), (c.l + c.w - ax) / (SKY.x + SKY.w - ax), (ay - c.t) / (ay - SKY.y));
    var sx = ax - (ax - SKY.x) * f, sy = ay - (ay - SKY.y) * f;
    if (art.sky) g.drawImage(art.sky, sx, sy, SKY.w * f, SKY.h * f);
    var bottom = Math.max(H + 40, c.t + c.h + 40);
    var body = g.createLinearGradient(0, WATER, 0, WATER + 320);
    body.addColorStop(0, '#2E9FC9'); body.addColorStop(0.3, '#1B7BA8'); body.addColorStop(1, '#0C4A70');
    g.fillStyle = body; g.fillRect(c.l - 10, WATER, c.w + 20, bottom - WATER);
    var refl = g.createLinearGradient(0, WATER, 0, WATER + 46);
    refl.addColorStop(0, 'rgba(196,236,252,0.46)'); refl.addColorStop(1, 'rgba(174,224,248,0)');
    g.fillStyle = refl; g.fillRect(c.l - 10, WATER, c.w + 20, 46);
    S.backdrop = cv;
    return cv;
  }

  /* ------------------------------------------------------------------ draw */
  function draw() {
    var ctx = S.ctx, c = S.cam;
    if (!c) return;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, S.canvas.width, S.canvas.height);
    if (!S.open) return;
    ctx.drawImage(backdrop(), 0, 0);
    var k = c.dpr * c.s;
    ctx.setTransform(k, 0, 0, k, -c.l * k, -c.t * k);
    var wx = S.worldX, x0 = HOLE_WX - wx, x1 = x0 + GAP;
    var holeSeen = x0 < c.l + c.w + CAP.w * CAP_S && x1 > c.l - CAP.w * CAP_S;
    var crack = holeSeen ? crackPath(x0, x1) : null;
    if (crack) drawHole(ctx, x0, x1, crack);
    drawPath(ctx, wx, crack);
    if (crack) drawLips(ctx, x0, x1);
    drawMomo(ctx);
    drawBird(ctx);
  }

  /* The path, A A' A A', cut by the crack's outline where the break is (the game cuts
     it the same way, with an even-odd clip), so the lips are the only edge it has. */
  function drawPath(ctx, wx, crack) {
    if (!art.tileA) return;
    var c = S.cam, from = c.l - 20, to = c.l + c.w + 20;
    ctx.save();
    if (crack) {
      var p = new Path2D();
      p.rect(from, TILE_Y - 40, to - from, TILE_H + 80);
      p.addPath(crack);
      ctx.clip(p, 'evenodd');
    }
    for (var k = Math.floor((from + wx) / TILE_W); k * TILE_W - wx < to; k++) {
      ctx.drawImage((k & 1) ? art.tileB : art.tileA, Math.round(k * TILE_W - wx), TILE_Y, TILE_W, TILE_H);
    }
    ctx.restore();
  }
  /* THE CRACK'S OUTLINE: straight down at the lips (the caps sit over those cuts), a
     chewed top edge a few pixels above the walking line across the mouth, so the snow's
     own fringe never hangs into it, and open to the water. Seeded, so it never jitters. */
  function crackPath(x0, x1) {
    if (!S.crackTop) {
      var seed = 4817;
      var rnd = function () { seed = (seed * 9301 + 49297) % 233280; return seed / 233280; };
      S.crackTop = [];
      for (var i = 0; i <= 18; i++) {
        var u = i / 18, edge = Math.min(u, 1 - u);
        S.crackTop.push({ u: u, dy: edge < 0.06 ? -3 - rnd() * 4 : -12 + rnd() * 8 });
      }
    }
    var top = S.crackTop, w = x1 - x0, p = new Path2D();
    p.moveTo(x0, H + 80);
    p.lineTo(x0, SURFACE + top[0].dy);
    for (var j = 0; j < top.length - 1; j++) {
      var a = top[j], b = top[j + 1], ax = x0 + w * a.u, bx = x0 + w * b.u;
      p.quadraticCurveTo(ax, SURFACE + a.dy, (ax + bx) / 2, SURFACE + (a.dy + b.dy) / 2);
    }
    p.lineTo(x1, SURFACE + top[top.length - 1].dy);
    p.lineTo(x1, H + 80);
    p.closePath();
    return p;
  }

  /* The break, in the game's colours: the body of the crack (brighter toward the water,
     which bounces light up), the platform's own rock band tiled across the far wall and
     pulled into the dark, the shadow under the snow lip, darker side walls, and the
     cold mist over the water. A simpler cut of the game's crevasse, from the same parts. */
  function drawHole(ctx, x0, x1, crack) {
    var w = x1 - x0, top = SURFACE - 16;
    ctx.save();
    ctx.clip(crack);
    var body = ctx.createLinearGradient(0, SURFACE - 16, 0, WATER);
    body.addColorStop(0, '#0E3358'); body.addColorStop(0.4, '#123F69'); body.addColorStop(0.82, '#1C5F8E'); body.addColorStop(1, '#2A7BA8');
    ctx.fillStyle = body; ctx.fillRect(x0 - 2, top, w + 4, WATER - top + 2);
    /* the far wall: the platform's rock band, bigger and fewer than the lips' so it reads
       as further back, alternate courses mirrored, and pulled well into the dark */
    if (art.rock) stoneCourses(ctx, x0, x1, SURFACE + 14, WATER, CAP_S * 1.05, function (row) { return Math.max(0.1, 0.3 - row * 0.07); }, 61);
    /* soft vertical ice facets down the far wall */
    [[0.18, 26], [0.37, 14], [0.55, 34], [0.74, 18], [0.88, 12]].forEach(function (fc, i) {
      var fx = x0 + w * fc[0], g = ctx.createLinearGradient(0, SURFACE, 0, WATER);
      g.addColorStop(0, 'rgba(150,210,245,0)'); g.addColorStop(0.35, 'rgba(150,210,245,' + (0.1 + (i % 2) * 0.04) + ')'); g.addColorStop(1, 'rgba(150,210,245,0)');
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.moveTo(fx, SURFACE); ctx.lineTo(fx + fc[1], SURFACE); ctx.lineTo(fx + fc[1] * 0.4, WATER); ctx.lineTo(fx - fc[1] * 0.3, WATER); ctx.closePath(); ctx.fill();
    });
    drawWall(ctx, x0, w, 1);
    drawWall(ctx, x1, w, -1);
    var sh = ctx.createLinearGradient(0, top, 0, SURFACE + 70);
    sh.addColorStop(0, 'rgba(3,16,38,0.72)'); sh.addColorStop(1, 'rgba(3,16,38,0)');
    ctx.fillStyle = sh; ctx.fillRect(x0 - 6, top, w + 12, 94);
    var side = Math.min(150, w * 0.3);
    var gl = ctx.createLinearGradient(x0, 0, x0 + side, 0);
    gl.addColorStop(0, 'rgba(6,24,52,0.6)'); gl.addColorStop(1, 'rgba(6,24,52,0)');
    ctx.fillStyle = gl; ctx.fillRect(x0 - 6, top, side + 6, WATER - top);
    var gr = ctx.createLinearGradient(x1, 0, x1 - side, 0);
    gr.addColorStop(0, 'rgba(6,24,52,0.6)'); gr.addColorStop(1, 'rgba(6,24,52,0)');
    ctx.fillStyle = gr; ctx.fillRect(x1 - side, top, side + 6, WATER - top);
    var mist = ctx.createLinearGradient(0, WATER - 150, 0, WATER + 4);
    mist.addColorStop(0, 'rgba(176,222,246,0)'); mist.addColorStop(0.7, 'rgba(176,222,246,0.28)'); mist.addColorStop(1, 'rgba(196,232,250,0.5)');
    ctx.fillStyle = mist; ctx.fillRect(x0 - 6, WATER - 150, w + 12, 154);
    ctx.restore();
  }
  /* Courses of the platform's stone (the rock band's lower rows, below its icicles),
     each shifted and every other one mirrored so no repeat shows. */
  function stoneCourses(ctx, xa, xb, ya, yb, scale, alphaFor, seed) {
    var im = art.rock, sy = 36, sh = im.naturalHeight - sy;
    var rw = im.naturalWidth * scale, rh = sh * scale;
    for (var row = 0, y = ya; y < yb; row++, y += rh * 0.92) {
      var shift = (row * 173 + seed) % rw;
      ctx.globalAlpha = alphaFor(row);
      for (var x = xa - shift; x < xb; x += rw) {
        if (row % 2) { ctx.save(); ctx.translate(x + rw, y); ctx.scale(-1, 1); ctx.drawImage(im, 0, sy, im.naturalWidth, sh, 0, 0, rw, rh); ctx.restore(); }
        else ctx.drawImage(im, 0, sy, im.naturalWidth, sh, x, y, rw, rh);
      }
    }
    ctx.globalAlpha = 1;
  }
  /* A SIDE WALL: stone coming down from the lip, bulging in toward the middle of the drop
     and falling back toward the water, its inner edge broken course by course. Darker the
     deeper it goes. It is what makes the break a crack in the ice rather than a box. */
  function drawWall(ctx, xl, w, dir) {
    if (!S.walls) {
      var seed = 9173;
      var rnd = function () { seed = (seed * 9301 + 49297) % 233280; return seed / 233280; };
      var mk = function () {
        var out = [];
        for (var i = 0; i <= 12; i++) { var v = i / 12; out.push({ v: v, f: 0.035 + Math.sin(v * Math.PI) * (0.12 + rnd() * 0.05) + (rnd() - 0.5) * 0.05 }); }
        return out;
      };
      S.walls = { l: mk(), r: mk() };
    }
    var prof = dir > 0 ? S.walls.l : S.walls.r, y0 = SURFACE + 6, span = WATER + 6 - y0;
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(xl, y0);
    prof.forEach(function (p) { ctx.lineTo(xl + dir * w * p.f, y0 + span * p.v); });
    ctx.lineTo(xl, WATER + 6);
    ctx.closePath();
    ctx.fillStyle = '#23324d';
    ctx.fill();
    ctx.clip();
    if (art.rock) stoneCourses(ctx, dir > 0 ? xl - 10 : xl - w * 0.3, dir > 0 ? xl + w * 0.3 : xl + 10, y0, WATER + 6, CAP_S, function () { return 0.9; }, dir > 0 ? 17 : 131);
    var g = ctx.createLinearGradient(0, y0, 0, WATER);
    g.addColorStop(0, 'rgba(8,26,54,0.3)'); g.addColorStop(1, 'rgba(8,26,54,0.72)');
    ctx.fillStyle = g;
    ctx.fillRect(Math.min(xl, xl + dir * w * 0.3) - 10, y0, w * 0.3 + 20, span + 6);
    var e = ctx.createLinearGradient(xl, 0, xl + dir * w * 0.2, 0);
    e.addColorStop(0, 'rgba(8,26,54,0)'); e.addColorStop(1, 'rgba(8,26,54,0.35)');
    ctx.fillStyle = e;
    ctx.fillRect(Math.min(xl, xl + dir * w * 0.3) - 10, y0, w * 0.3 + 20, span + 6);
    ctx.restore();
  }
  function drawLips(ctx, x0, x1) {
    // seated as the game seats them: row 52 just above the foot line, the face 8 px into the hole
    var cw = CAP.w * CAP_S, ch = CAP.h * CAP_S, y = SURFACE - 4 - CAP.snowTop * CAP_S, o = CAP.overlap;
    if (art.capLf) ctx.drawImage(art.capLf, x0 + o - cw, y, cw, ch);
    if (art.capRf) ctx.drawImage(art.capRf, x1 - o, y, cw, ch);
  }

  /* ------------------------------------------------------------------ Momo */
  /* His pose, read off the scene clock: the run and the skid in closed form, the look
     and the idle from when each began. Frames are the game's own, drawn about his feet. */
  function momoPose() {
    var m = S.momo, t = S.clock - m.t0;
    if (m.mode === 'run') {
      var x = t < T.enter ? lerp(m.from, MOMO_X, easeOut(t / T.enter, 2)) : MOMO_X;
      var wx = worldAt(t);
      if (t < RUN_END) {
        var dist = wx + (x - m.from);
        return { sheet: 'run', f: Math.floor(dist / RUN.stride * RUN.frames) % RUN.frames, x: x, wx: wx };
      }
      var u = clamp((t - RUN_END) / SKID.slide, 0, 1);
      return { sheet: 'skid', f: Math.min(SKID.frames - 1, Math.floor(u * SKID.frames)), x: x, wx: wx };
    }
    if (m.mode === 'look') {
      var acc = 0;
      for (var i = 0; i < LOOK.length; i++) {
        var st = LOOK[i];
        if (t < acc + st[1] || i === LOOK.length - 1) {
          var nx = LOOK[Math.min(i + 1, LOOK.length - 1)], into = (t - acc) / st[1];
          var blend = st[1] >= 150 && nx[0] !== st[0] ? Math.max(0, (into - 0.6) / 0.4) : 0;
          return { sheet: 'tremble', f: st[0], bf: nx[0], bu: Math.min(1, blend), x: MOMO_X, step: i, done: t >= acc + st[1] };
        }
        acc += st[1];
      }
    }
    if (m.mode === 'idle') {
      if (S.reduced) return { sheet: 'idle', f: 0, x: MOMO_X };
      var p = t / 1000 * IDLE.fps, f = Math.floor(p) % IDLE.frames;
      return { sheet: 'idle', f: f, bf: (f + 1) % IDLE.frames, bu: p - Math.floor(p), x: MOMO_X };
    }
    return { sheet: m.sheet || 'idle', f: m.f || 0, x: MOMO_X };
  }
  function momoMode(mode, extra) {
    var prev = S.pose;
    if (prev) S.hand = { sheet: prev.sheet, f: prev.f, at: S.clock, dur: extra && extra.hand || 120 };
    S.momo = Object.assign({ mode: mode, t0: S.clock, from: S.momo ? S.momo.from : MOMO_X }, extra || {});
  }
  function drawCell(ctx, sheet, f, x, alpha) {
    var im = art[sheet];
    if (!im || alpha <= 0.01) return;
    var k = art.hd ? CHAR.hd : 1, cw = CHAR.cw * k, ch = CHAR.ch * k, sc = CHAR.scale / k;
    ctx.globalAlpha = Math.min(1, alpha);
    ctx.drawImage(im, (f % CHAR.cols) * cw, Math.floor(f / CHAR.cols) * ch, cw, ch,
      x - cw * sc / 2, SURFACE - ch * sc + CHAR.baseGap * k * sc, cw * sc, ch * sc);
    ctx.globalAlpha = 1;
  }
  function drawMomo(ctx) {
    var p = S.pose;
    if (!p) return;
    /* his contact shadow, as the game draws it: a soft radial falloff at the foot line */
    ctx.save();
    ctx.translate(p.x + 4, SURFACE + 2);
    ctx.scale(1, 15 / 92);
    var rg = ctx.createRadialGradient(0, 0, 0, 0, 0, 92);
    rg.addColorStop(0, 'rgba(18,59,104,0.34)'); rg.addColorStop(0.5, 'rgba(18,59,104,0.19)');
    rg.addColorStop(0.8, 'rgba(18,59,104,0.06)'); rg.addColorStop(1, 'rgba(18,59,104,0)');
    ctx.fillStyle = rg; ctx.beginPath(); ctx.arc(0, 0, 92, 0, 6.2832); ctx.fill();
    ctx.restore();
    drawCell(ctx, p.sheet, p.f, p.x, 1);
    if (p.bu > 0) drawCell(ctx, p.sheet, p.bf, p.x, p.bu);
    /* a hand-over dissolves: the pose he came from is drawn over the new one, fading */
    var hd = S.hand;
    if (hd && S.clock < hd.at + hd.dur) drawCell(ctx, hd.sheet, hd.f, p.x, 1 - (S.clock - hd.at) / hd.dur);
  }

  /* --------------------------------------------------------------- Swiftee */
  /* Her sheets are the lesson's (window.SWIFTEE): 256px cells, 20 fps, played as a queue
     of segments the way the lesson's SwifteeSprite plays them. A pose change dissolves
     over 120 ms, so she never snaps from one drawing to the next. */
  function birdSeg(name, frames, onEnd) { return { clip: name, frames: frames, onEnd: onEnd, shown: 0 }; }
  function birdSet(segs, fade) {
    var b = S.bird;
    if (b.seg && fade) b.prev = { clip: b.seg.clip, i: birdFrame(b.seg), flip: b.flip, cx: b.cx, cy: b.cy, at: S.clock, dur: fade };
    b.queue = segs.slice();
    /* reduced motion holds one picture per pose: straight to the pose she rests in */
    if (S.reduced && b.queue.length > 1) b.queue = b.queue.slice(-1);
    b.seg = b.queue.shift() || null;
    b.acc = 0;
  }
  function birdFrame(seg) {
    var c = SW && SW.clips[seg.clip];
    if (!c) return 0;
    if (S.reduced && seg.clip !== 'flying') return Math.floor(c.frames / 2);
    return seg.shown % c.frames;
  }
  function birdTick(dt) {
    var b = S.bird;
    if (!b.seg || !SW) return;
    if (S.reduced) return;              // reduced motion: each pose is one held frame
    b.acc += dt;
    var per = 1000 / (SW.fps || 20);
    while (b.acc >= per && b.seg) {
      b.acc -= per;
      b.seg.shown += 1;
      if (b.seg.shown >= b.seg.frames) {
        var done = b.seg;
        b.seg = b.queue.shift() || null;
        if (!b.seg) b.seg = birdSeg(done.clip, Infinity);   // hold on the last clip rather than vanish
        if (done.onEnd) done.onEnd();
      }
    }
  }
  function birdPose(name, frames) {
    var st = SW && SW.states && SW.states[name], out = [];
    if (st) {
      if (SW.clips[st.start] && art['bird:' + st.start]) out.push(birdSeg(st.start, SW.clips[st.start].frames));
      out.push(birdSeg(st.loop, frames || Infinity));
    } else out.push(birdSeg(name, frames || Infinity));
    return out.filter(function (sg) { return !!art['bird:' + sg.clip]; });
  }
  function drawBirdCell(ctx, name, i, cx, cy, flip, alpha, sx, sy) {
    var im = art['bird:' + name], c = SW && SW.clips[name];
    if (!im || !c || alpha <= 0.01) return;
    var cell = SW.cell || 256;
    ctx.save();
    ctx.globalAlpha = Math.min(1, alpha);
    ctx.translate(cx, cy + BIRD / 2);                 // about the bottom of her cell, so a squash stays on the ground
    ctx.rotate(S.bird.rot || 0);
    ctx.scale((flip ? -1 : 1) * (sx || 1), sy || 1);
    ctx.drawImage(im, (i % c.cols) * cell, Math.floor(i / c.cols) * cell, cell, cell, -BIRD / 2, -BIRD, BIRD, BIRD);
    ctx.restore();
  }
  function drawBird(ctx) {
    var b = S.bird;
    if (!b.on || !b.seg) return;
    var feet = b.standing ? SURFACE : b.cy + (FLY_FEET - 0.5) * BIRD;
    var over = b.cx > HOLE_WX - S.worldX - 20 && b.cx < HOLE_WX - S.worldX + GAP + 20;
    var lift = SURFACE - feet, sa = clamp(1 - lift / 420, 0, 1) * 0.3 * b.alpha;
    if (sa > 0.01 && !over) {
      ctx.save();
      ctx.translate(b.cx, SURFACE + 3); ctx.scale(1, 0.18);
      var rg = ctx.createRadialGradient(0, 0, 0, 0, 0, 52);
      rg.addColorStop(0, 'rgba(18,59,104,' + sa.toFixed(3) + ')'); rg.addColorStop(1, 'rgba(18,59,104,0)');
      ctx.fillStyle = rg; ctx.beginPath(); ctx.arc(0, 0, 52, 0, 6.2832); ctx.fill();
      ctx.restore();
    }
    var sx = 1, sy = 1;
    if (b.squashAt != null && !S.reduced) {
      var u = clamp((S.clock - b.squashAt) / 180, 0, 1), e = Math.sin(u * Math.PI) * (1 - u * 0.4);
      sx = 1 + 0.07 * e; sy = 1 - 0.1 * e;
    }
    drawBirdCell(ctx, b.seg.clip, birdFrame(b.seg), b.cx, b.cy, b.flip, b.alpha, sx, sy);
    var pv = b.prev;
    if (pv && S.clock < pv.at + pv.dur) drawBirdCell(ctx, pv.clip, pv.i, pv.cx, pv.cy, pv.flip, b.alpha * (1 - (S.clock - pv.at) / pv.dur), 1, 1);
  }
  function standCy() { return SURFACE - ((SW && SW.baseline) || 0.877) * BIRD + BIRD / 2; }
  function bezier(p, u) {
    var v = 1 - u;
    return {
      x: v * v * v * p[0].x + 3 * v * v * u * p[1].x + 3 * v * u * u * p[2].x + u * u * u * p[3].x,
      y: v * v * v * p[0].y + 3 * v * v * u * p[1].y + 3 * v * u * u * p[2].y + u * u * u * p[3].y
    };
  }

  /* ------------------------------------------------------------ the bubble */
  /* The lesson's sizes, in its own units: 44px Nunito on a 20px side padding (NARR_TYPE and
     .dialogue-box), the tail 60x60 hung from 10px above the box's bottom edge, its tip at
     (12, 54) in the tail's own box. At the scene's scale that is the size her box is in the
     lesson on the same screen; it never goes under 18px. */
  var SAY = { font: 44, maxW: 640, tailX: 34, tip: { x: 12, y: 54 }, hang: 10 };
  /* The words of a line, each its own span, laid out at their final size before one is
     seen. A key word takes the lesson's accent ink, as "polygon" does in Part 1. */
  function layoutSay(line) {
    var b = S.say, focus = line.focus || {};
    b.el.className = 'bridge-say';
    b.shown = false;
    b.text.textContent = '';
    b.spans = line.text.split(' ').map(function (w, i) {
      if (i) b.text.appendChild(document.createTextNode(' '));
      var sp = el('span', focus[w] ? 'w k' : 'w', b.text);
      sp.textContent = w;
      return sp;
    });
    b.line = line;
    placeSay();
  }
  /* The widest line the text has actually broken into, in unscaled px. Client rects come
     after every transform on the way up (the box's own entrance scale among them), so they
     are divided by the scale the text is actually drawn at. */
  function widestLine(node) {
    try {
      var drawn = node.getBoundingClientRect().width, sc = node.offsetWidth && drawn ? drawn / node.offsetWidth : 1;
      var r = document.createRange();
      r.selectNodeContents(node);
      var rows = {};
      Array.prototype.forEach.call(r.getClientRects(), function (q) {
        if (q.width < 1) return;
        var key = Math.round(q.top / 4);
        var row = rows[key] || (rows[key] = { l: q.left, r: q.right });
        row.l = Math.min(row.l, q.left); row.r = Math.max(row.r, q.right);
      });
      var w = 0;
      for (var k in rows) w = Math.max(w, rows[k].r - rows[k].l);
      return w / sc;
    } catch (e) { return 0; }
  }
  /* Over Swiftee's head with the tail's tip just above it, the box to her right so it
     never covers Momo's face, and inside the screen. The box hugs its text: a line that
     has to wrap is balanced into even rows and the box is as wide as the widest. */
  function placeSay() {
    var b = S.say, c = S.cam;
    if (!b.line || !c) return;
    var margin = 16, k = Math.max(c.s, 18 / SAY.font);
    var head = toScreen(PERCH, standCy() - BIRD / 2 + HEAD * BIRD);
    var L = Math.max(margin, toScreen(FACE_R, 0).x), R = c.vw - margin;
    if (R - L < 140) L = margin;           // only a very narrow screen lets it over his face
    b.el.style.transform = 'none';
    b.box.style.width = '';
    b.box.style.maxWidth = Math.floor(Math.min(SAY.maxW, (R - L) / k)) + 'px';
    var pad = b.box.offsetWidth - b.text.offsetWidth, line = widestLine(b.text);
    if (line > 0) b.box.style.width = Math.ceil(line + pad + 2) + 'px';
    var w = b.box.offsetWidth, h = b.box.offsetHeight;
    var tipX = SAY.tailX + SAY.tip.x, tipY = h - SAY.hang + SAY.tip.y;
    var left = clamp(head.x - tipX * k, L, Math.max(L, R - w * k));
    var tailX = clamp((head.x - left) / k - SAY.tip.x, 22, w - 64);
    var top = Math.max(margin, head.y - 4 - (h - SAY.hang + SAY.tip.y) * k);
    b.box.style.setProperty('--dialogue-tail-x', tailX.toFixed(1) + 'px');
    b.box.style.setProperty('--ox', (tailX + 30).toFixed(1) + 'px');
    b.el.style.left = Math.round(left) + 'px';
    b.el.style.top = Math.round(top) + 'px';
    b.el.style.transform = 'scale(' + k.toFixed(4) + ')';
    S.sayBox = { left: Math.round(left), top: Math.round(top), w: Math.round(w * k), h: Math.round(h * k),
      tail: { x: left + (tailX + SAY.tip.x) * k, y: top + tipY * k }, font: SAY.font * k };
  }
  /* The box stays away until it has a word to show, then arrives already carrying it, as
     the lesson's sign does. A second line takes the box after the first has faded. */
  function showSay() {
    var e = S.say.el;
    if (S.say.shown) return;
    S.say.shown = true;
    e.classList.remove('out');
    void e.offsetWidth;
    e.classList.add('show');
  }
  function hideSay() {
    var e = S.say.el;
    e.classList.remove('show');
    e.classList.add('out');
  }

  /* ------------------------------------------------------------- the clock */
  /* Everything waits on the scene's own clock, which only runs while the page is shown:
     a hidden tab freezes the scene (and its sound) and it carries on where it stopped. */
  function waitUntil(test) {
    return new Promise(function (resolve) { S.waiters.push({ test: test, resolve: resolve }); });
  }
  function waitMs(ms) { var at = S.clock + ms; return waitUntil(function () { return S.clock >= at; }); }
  function flush() {
    var ws = S.waiters;
    for (var i = ws.length - 1; i >= 0; i--) {
      if (ws[i].test()) { var w = ws[i]; ws.splice(i, 1); w.resolve(); }
    }
  }
  function tick(now) {
    if (!S) return;
    S.raf = requestAnimationFrame(tick);
    var dt = S.lastT ? Math.min(100, Math.max(0, now - S.lastT)) : 16;
    S.lastT = now;
    if (S.paused) return;
    S.clock += dt;
    update(dt);
    draw();
    flush();
  }
  function update(dt) {
    if (!S.open) return;
    var pose = momoPose(), m = S.momo;
    if (m.mode === 'run') {
      S.worldX = pose.wx;
      if (pose.sheet === 'run') {
        if (RUN.contacts.indexOf(pose.f) >= 0 && pose.f !== S.lastStep) sfx.step();
        S.lastStep = pose.f;
      } else if (!S.skidded) { S.skidded = true; S.hand = { sheet: 'run', f: S.pose ? S.pose.f : 0, at: S.clock, dur: 80 }; sfx.skid(); }
    }
    if (m.mode === 'look' && pose.step === 4 && !S.shivered) { S.shivered = true; sfx.tremble(); }
    S.pose = pose;
    var b = S.bird;
    if (b.fly) {
      var u = clamp((S.clock - b.fly.t0) / T.fly, 0, 1), e = 1 - Math.pow(1 - u, 2.2);
      var p = bezier(b.fly.p, e), vx = (p.x - b.cx) / Math.max(1, dt) * 1000;
      b.cx = p.x; b.cy = p.y;
      b.rot = lerp(b.rot || 0, clamp(vx / 1000 * 0.1, -0.16, 0.16), 0.15);
      if (u >= 1) { b.fly = null; b.rot = 0; if (b.landed) b.landed(); }
    }
    birdTick(dt);
    if (S.speak) {
      var sp = S.speak, t = sp.clock();
      while (sp.shown < sp.line.words.length && t >= sp.line.words[sp.shown] - WORD_LEAD) {
        var span = S.say.spans[sp.shown];
        if (span) span.classList.add('in');
        if (sp.shown === 0) showSay();
        sp.shown += 1;
      }
    }
  }

  /* ----------------------------------------------------------- the story */
  function phase(name) {
    if (!S) return;
    S.phase = name;
    S.history.push({ event: 'phase', phase: name, at: Math.round(S.clock) });
    if (S.root) S.root.setAttribute('data-phase', name);
  }
  function alive(gen) { return !!S && S.gen === gen && !S.handedOff; }
  function guard(gen, fn) { return function (v) { if (alive(gen)) return fn(v); return new Promise(noop); }; }

  function withTimeout(p, ms) {
    return Promise.race([p, waitMs(ms).then(function () { return false; })]);
  }

  function run(gen) {
    phase('STORY_ENTER');
    requestAnimationFrame(function () { if (alive(gen)) S.root.classList.add('is-frosting'); });
    return Promise.all([waitMs(T.frost), withTimeout(loading || preload(), T.loadCap)])
      .then(guard(gen, function (r) {
        if (!r[1]) { S.history.push({ event: 'fallback', reason: 'art', at: Math.round(S.clock) }); handOff('no-art'); return new Promise(noop); }
        return openScene(gen);
      }))
      .then(guard(gen, function () { return S.reduced ? stillOpening() : momoRuns(); }))
      .then(guard(gen, function () { return waitMs(T.beforeBird); }))
      .then(guard(gen, function () { phase('SWIFTEE_ENTER'); return birdArrives(); }))
      .then(guard(gen, function () { phase('SWIFTEE_OBSERVE'); return birdObserves(); }))
      .then(guard(gen, function () { phase('DIALOGUE'); return dialogue(gen); }))
      .then(guard(gen, function () { phase('STORY_READY'); return waitMs(T.read); }))
      .then(guard(gen, function () { showNext(); }));
  }

  /* The scene is under the frost now: the lesson stops painting, the scene starts, and
     the frost clears on Momo already running. */
  function openScene() {
    S.open = true;
    document.documentElement.setAttribute('data-bridge', 'on');
    S.root.classList.add('is-open');
    S.worldX = 0;
    S.momo = { mode: 'run', t0: S.clock, from: Math.min(MOMO_X - 900, S.cam.l - 380) };
    S.pose = null;
    if (!S.reduced) phase('MOMO_RUNNING');
    return Promise.resolve();
  }
  function momoRuns() {
    return waitMs(STOP_AT).then(function () {
      S.worldX = worldAt(STOP_AT);
      momoMode('look', { hand: 120 });
      phase('MOMO_AT_DITCH');
      return waitUntil(function () { return S.momo.mode === 'look' && S.pose && S.pose.done; });
    }).then(function () { momoMode('idle', { hand: 120 }); });
  }
  /* Reduced motion: no run, no scroll, no flight. He is already at the edge, looking
     down; then he looks up. Every beat of the story is still there, as held pictures. */
  function stillOpening() {
    S.worldX = worldAt(STOP_AT);
    S.momo = { mode: 'still', t0: S.clock, sheet: 'tremble', f: 3, from: MOMO_X };
    phase('MOMO_AT_DITCH');
    return waitMs(T.stillLook).then(function () { S.momo = { mode: 'still', t0: S.clock, sheet: 'tremble', f: 9, from: MOMO_X }; });
  }

  /* SHE FLIES IN on a curve from the top corner beyond the break, slowing all the way, and
     comes down on her feet between Momo and the edge. Reduced motion: she fades in there. */
  function birdArrives() {
    var b = S.bird, c = S.cam;
    b.on = true;
    b.flip = false;
    if (S.reduced) {
      b.standing = true; b.cx = PERCH; b.cy = standCy(); b.alpha = 0;
      birdSet(birdPose('blinking'));
      var t0 = S.clock;
      return waitUntil(function () { b.alpha = clamp((S.clock - t0) / 300, 0, 1); return b.alpha >= 1; })
        .then(function () { S.history.push({ event: 'landed', at: Math.round(S.clock) }); });
    }
    var land = { x: PERCH, y: SURFACE - (FLY_FEET - 0.5) * BIRD };
    var start = { x: c.l + c.w + BIRD, y: c.t + Math.max(60, c.h * 0.1) };
    b.fly = { t0: S.clock, p: [start, { x: LIP + GAP + 160, y: 200 }, { x: PERCH + 260, y: SURFACE - 360 }, land] };
    b.cx = start.x; b.cy = start.y; b.alpha = 1; b.standing = false;
    birdSet([birdSeg('flying', Infinity)]);
    sfx.whoosh();
    return new Promise(function (resolve) { b.landed = resolve; }).then(function () {
      b.landed = null;
      /* the flight frame dissolves into the standing one where it was, and the standing
         cell is then seated on her feet */
      var settle = art['bird:flapping'] ? [birdSeg('flapping', Math.round(T.settle / 50))] : [];
      birdSet(settle.concat(birdPose('blinking')), 120);
      b.standing = true;
      b.cy = standCy();
      b.squashAt = S.clock;
      S.history.push({ event: 'landed', at: Math.round(S.clock) });
      sfx.flutter();
      return waitMs(T.settle);
    });
  }
  /* SHE LOOKS BEFORE SHE SPEAKS: at the break (her curious pose faces that way), then back
     at Momo (the same pose, turned), and only then the first word. */
  function birdObserves() {
    var b = S.bird;
    /* the curious loop itself, dissolved into: the sheet's own start clip is drawn as a
       see-through morph, which over the snow reads as a ghost of her */
    birdSet([birdSeg('curious', Infinity)], 160);
    S.history.push({ event: 'look', at: 'gap', t: Math.round(S.clock) });
    return waitMs(T.lookGap).then(function () {
      birdSet([birdSeg(b.seg ? b.seg.clip : 'curious', Infinity)], 140);
      b.flip = true;
      S.history.push({ event: 'look', at: 'momo', t: Math.round(S.clock) });
      return waitMs(T.lookMomo);
    });
  }
  function dialogue() {
    birdSet(birdPose('talking'), 120);
    return say(LINES[0], false)
      .then(function () { return waitMs(T.lineGap); })
      .then(function () { return say(LINES[1], true); })
      .then(function () {
        var stop = art['bird:talk_stop'] ? [birdSeg('talk_stop', SW.clips.talk_stop.frames)] : [];
        birdSet(stop.concat(birdPose('blinking')), 120);
      });
  }
  /* One line: the box comes up laid out at its final size, the voice starts, and each
     word pops in on the voice's clock. Without sound the words keep the same times. */
  function say(line, again) {
    var ready = again ? (hideSay(), waitMs(T.partOut)) : Promise.resolve();
    return ready.then(function () {
      layoutSay(line);
      S.live.textContent = line.text;
    }).then(function () {
      var at = clip('voice', line.at, line.dur, 1, 0.02), c0 = S.clock, ctx = S.audio && S.audio.ctx;
      var clock = at !== null ? function () { return ctx.currentTime - at; } : function () { return (S.clock - c0) / 1000; };
      S.speak = { line: line, clock: clock, shown: 0 };
      S.history.push({ event: 'say', id: line.id, text: line.text, withAudio: at !== null, at: Math.round(S.clock) });
      return waitUntil(function () { return clock() >= line.dur; });
    }).then(function () {
      S.say.spans.forEach(function (sp) { sp.classList.add('in'); });
      S.speak = null;
      S.history.push({ event: 'said', id: line.id, at: Math.round(S.clock) });
    });
  }

  /* NEXT, once the story has been told: a small entrance and no loop. It takes one press;
     the second finds it already disabled. */
  function showNext() {
    var n = S.next;
    n.hidden = false;
    n.disabled = false;
    n.removeAttribute('aria-disabled');
    void n.offsetWidth;
    n.classList.add('is-in');
    S.nextOn = true;
    phase('NEXT_ENABLED');
    /* Not focused for the learner: focusing it here drew the kit's white focus ring round it
       the moment it arrived. A key press still finds it: Tab (and nothing else) goes to Next. */
  }
  function onNext(e) {
    if (e) e.preventDefault();
    if (!S || !S.nextOn || S.handedOff) return;
    S.nextOn = false;
    S.next.disabled = true;
    S.next.setAttribute('aria-disabled', 'true');
    S.next.classList.add('is-pressed');
    sfx.tap();
    S.history.push({ event: 'next', at: Math.round(S.clock) });
    handOff('next');
  }
  /* Part 2 takes the screen: RunnerStage fades to the game's cover. The scene stays under
     the curtain until the cover is up, then clears itself away. */
  function handOff(reason) {
    if (!S || S.handedOff) return;
    S.handedOff = true;
    S.history.push({ event: 'handoff', reason: reason, at: Math.round(S.clock) });
    phase('PART2_BANNER');
    var done = function () { destroy(); };
    var p = RS && RS.start ? RS.start() : Promise.resolve(false);
    p.then(done, done);
  }

  /* ------------------------------------------------------------- locking */
  /* The page under the scene cannot be reached: every other child of <body> is inert (and
     anything the lesson adds later), so neither Tab nor a screen reader can land on the
     lesson's buttons. The runner's stage is left alone; it is what comes next. */
  function lockPage() {
    S.inerted = [];
    var lock = function (n) {
      if (n === S.root || n.id === 'runner-stage' || n.nodeType !== 1 || n.tagName === 'SCRIPT' || n.hasAttribute('inert')) return;
      n.setAttribute('inert', '');
      S.inerted.push(n);
    };
    Array.prototype.forEach.call(document.body.children, lock);
    if (window.MutationObserver) {
      S.observer = new MutationObserver(function (list) {
        list.forEach(function (m) { Array.prototype.forEach.call(m.addedNodes, lock); });
      });
      S.observer.observe(document.body, { childList: true });
    }
  }
  function unlockPage() {
    if (S.observer) S.observer.disconnect();
    (S.inerted || []).forEach(function (n) { n.removeAttribute('inert'); });
    S.inerted = [];
  }
  function isNext(target) { return !!(S && S.nextOn && S.next && (target === S.next || S.next.contains(target))); }
  function swallow(e) {
    if (!S) return;
    if (e.type === 'pointerdown' && S.audio && S.audio.ctx.state === 'suspended') { try { S.audio.ctx.resume().catch(noop); } catch (x) {} }
    if (isNext(e.target)) return;
    e.preventDefault();
    e.stopPropagation();
  }
  function onKey(e) {
    if (!S || S.handedOff) return;
    if (e.ctrlKey || e.metaKey || e.altKey) return;       // the browser's own shortcuts
    if (isNext(e.target) && (e.key === 'Enter' || e.key === ' ' || e.key === 'Spacebar')) return;
    e.preventDefault();
    e.stopImmediatePropagation();
    if (e.key === 'Tab' && S.nextOn) { try { S.next.focus({ preventScroll: true }); } catch (x) {} }
  }
  function onVisibility() {
    if (!S) return;
    var A = S.audio;
    if (document.hidden) {
      S.paused = true;
      if (A) { try { A.ctx.suspend().catch(noop); } catch (e) {} }
    } else {
      S.paused = false;
      S.lastT = 0;
      if (A) { try { A.ctx.resume().catch(noop); } catch (e) {} }
    }
  }
  function on(target, type, fn, opts) {
    target.addEventListener(type, fn, opts);
    S.listeners.push([target, type, fn, opts]);
  }

  /* ------------------------------------------------------- start / finish */
  function start(opts) {
    if (!enabled) return Promise.resolve(false);
    if (S) return S.done;
    if (!document.body) return Promise.resolve(false);
    opts = opts || {};
    preload(opts);
    var gen = (last && last.gen || 0) + 1;
    S = {
      gen: gen, clock: 0, lastT: 0, paused: false, open: false, handedOff: false, nextOn: false,
      reduced: reducedMotion(), phase: 'PART1_COMPLETE', history: [], waiters: [], listeners: [],
      worldX: 0, momo: null, pose: null, hand: null, bird: { on: false, alpha: 1, rot: 0 },
      speak: null, sayBox: null, audio: null, sounds: []
    };
    S.history.push({ event: 'phase', phase: 'PART1_COMPLETE', at: 0 });
    S.done = new Promise(function (resolve) { S.resolveDone = resolve; });
    build();
    S.audio = openAudio(opts.audioContext);
    fit();
    lockPage();
    on(window, 'resize', fit);
    on(window, 'orientationchange', fit);
    on(document, 'visibilitychange', onVisibility);
    on(window, 'keydown', onKey, true);
    ['pointerdown', 'pointerup', 'click', 'dblclick', 'contextmenu', 'touchstart', 'wheel'].forEach(function (t) {
      on(S.root, t, swallow, t === 'touchstart' || t === 'wheel' ? { passive: false } : false);
    });
    on(S.next, 'click', onNext);
    try { S.root.focus({ preventScroll: true }); } catch (e) {}
    S.raf = requestAnimationFrame(tick);
    run(gen);
    return S.done;
  }

  function destroy() {
    if (!S) return;
    cancelAnimationFrame(S.raf);
    S.listeners.forEach(function (l) { l[0].removeEventListener(l[1], l[2], l[3]); });
    unlockPage();
    var A = S.audio;
    if (A) {
      A.live.slice().forEach(function (src) { try { src.stop(); } catch (e) {} });
      try { A.out.disconnect(); } catch (e) {}
      if (A.own) { try { A.ctx.close(); } catch (e) {} }
    }
    document.documentElement.removeAttribute('data-bridge');
    if (S.root && S.root.parentNode) S.root.parentNode.removeChild(S.root);
    last = { gen: S.gen, phase: S.phase, history: S.history, sounds: S.sounds, handedOff: S.handedOff, listeners: 0 };
    var resolve = S.resolveDone;
    S = null;
    if (resolve) resolve(true);
  }

  /* After the hand-off the phase is read from Part 2 itself: the cover is up and its
     Play is available (the game's front end holds Play while its art is loading), or the
     learner has pressed Play and the game has left its title state. */
  function coverReady() {
    try {
      var host = document.getElementById('runner-stage'), fr = host && host.querySelector('iframe');
      var doc = fr && fr.contentDocument, cover = doc && doc.getElementById('cover');
      // the curtain has finished lifting (is-arriving goes when it has) and Play is not held
      return !!(host && host.classList.contains('is-on') && !host.classList.contains('is-arriving') &&
        cover && !cover.hidden && !cover.classList.contains('loading'));
    } catch (e) { return false; }
  }
  function phaseNow() {
    var ph = S ? S.phase : last ? last.phase : (enabled ? 'IDLE' : 'OFF');
    if (ph !== 'PART2_BANNER') return ph;
    var rs = RS && RS.state ? RS.state() : null, g = rs && rs.game;
    if (!rs || !rs.shown || !g || g === 'BOOT') return 'PART2_BANNER';
    if (g === 'TITLE') return coverReady() ? 'PLAY_READY' : 'PART2_BANNER';
    return 'PART2_START';
  }

  window.BridgeStory = {
    enabled: enabled,
    autostart: autostart,
    preload: preload,
    start: start,
    /* For the tests: where the story is, what has happened, and what is on screen. */
    state: function () {
      var src = S || last || {};
      var out = {
        enabled: enabled, autostart: autostart, active: !!S, phase: phaseNow(),
        history: (src.history || []).slice(), sounds: (src.sounds || []).slice(), nextShown: !!(S && S.next && !S.next.hidden),
        nextEnabled: !!(S && S.nextOn), lastRun: last ? { listeners: last.listeners, handedOff: last.handedOff } : null,
        holeWorldX: HOLE_WX, lip: LIP, momoX: MOMO_X, perch: PERCH
      };
      if (S) {
        out.reduced = S.reduced;
        out.clock = Math.round(S.clock);
        out.paused = S.paused;
        out.worldX = S.worldX;
        out.hd = !!art.hd;
        out.audio = S.audio ? S.audio.ctx.state : 'none';
        out.voiceDecoded = !!(S.audio && S.audio.buf.voice);
        out.decoded = S.audio ? Object.keys(S.audio.buf) : [];
        out.momo = S.pose ? { mode: S.momo.mode, sheet: S.pose.sheet, frame: S.pose.f, x: Math.round(S.pose.x) } : null;
        var b = S.bird;
        out.swiftee = b.on && b.seg ? { clip: b.seg.clip, standing: !!b.standing, flying: !!b.fly, flip: !!b.flip,
          x: Math.round(b.cx), y: Math.round(b.cy), screen: toScreen(b.cx, b.cy) } : null;
        out.say = S.say.line ? { id: S.say.line.id, text: S.say.text.textContent,
          shown: S.say.spans.filter(function (s) { return s.classList.contains('in'); }).length,
          words: S.say.spans.length, box: S.sayBox } : null;
        out.cam = S.cam ? { s: S.cam.s, l: S.cam.l, t: S.cam.t, w: S.cam.w, h: S.cam.h } : null;
      }
      return out;
    },
    /* The numbers this scene takes from the game, for the check that they still agree. */
    lines: LINES.map(function (l) { return { id: l.id, text: l.text, at: l.at, dur: l.dur, words: l.words.slice() }; })
  };

  if (autostart) {
    var go = function () { preload(); start({}); };
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', go, { once: true });
    else go();
  }
})();
