/* ============================================================================
   THE FROZEN PASS — the runner game, which opens the experience and closes it.

   Momo has been through the story, the broken path and the polygon lesson; this
   is where what the lesson taught is put to work. The game itself lives in
   game/ (its contract is docs/game/RUNNER.md): a mammoth runs across an ice
   shelf, the ice gives way, glacier blocks hang on ropes above the hole, and
   the learner cuts the rope of the polygon the sign asks for. Seven crossings,
   then the friend waiting at the end of the road.

   WHY AN IFRAME. The game is a whole page with its own stylesheet, its own
   audio graphs and its own URL flags, and its stylesheet carries global rules
   (a `* { box-sizing }`, `body` type, generic .card / .overlay / .stage names)
   that would reach into the lesson if the two shared a document — and the
   lesson's would reach into it. In a frame each keeps its own document, its own
   location.search, its own focus, and the game's own test suite still holds
   against exactly the files that ship here. The frame is same-origin, so this
   controller can still read the game's state (window.iceAgeGame) for the
   checks without touching a line of the game.

   WHEN. The lesson calls preload() as the recap begins (screen 41), so the game
   loads its art (about 20 MB) while the recap and the quizzes play; at the end,
   once Swiftee's last line has been said and the game is ready, by itself,
   start(): the lesson dims to the game's night blue, the run begins under the
   curtain and the curtain lifts on it. There is no cover and no PLAY: the game
   is loaded with ?cover=0, which makes it wait for the page to start its run
   (window.iceAgeBegin in game/js/main.js), and it is started once.

   AND FIRST, THE OPENING (opening()). The experience starts on the game itself: its own
   cover and PLAY, its opening avalanche, and its tutorial as far as the broken path, where it
   says why the learner must learn about polygons first (game/js/tutorial.js, the 'intro'
   script; the frame is loaded with ?lesson=intro). There the game holds its world still and
   says 'lesson', and the two change places IN THE SNOW: a flurry blows across the screen,
   the lesson starts underneath, and the game fades away under the snow to show it, Swiftee
   already flying in. No curtain, no Play, nothing blank in between (src/intro/opening.js
   opens the lesson). After the lesson the game is loaded again with ?lesson=end: Momo runs,
   and nothing is said until the ditch.

   opening() reports where it is in `opening.phase`, in order:
     OPENING_COVER         the game's cover is the page (PLAY waits for its art)
     OPENING_TUTORIAL      PLAY has been pressed: the avalanche, the run, the tutorial
     OPENING_SWIFTEE       the game is frozen at the broken path and Swiftee is speaking
     OPENING_TO_LESSON     the game has said 'lesson': the snow, the lesson starting under it
     OPENING_DONE          the frame is gone and the lesson has the screen

   start() reports where it is in `phase`, in order:
     TRANSITION_TO_GAME    the lesson is dimming to the night blue
     FROZEN_RUSH_INIT      the game is the page, under the curtain, waiting for its art
     FROZEN_RUSH_RUNNING   its run has begun (the opening avalanche, then the tutorial)

     ?game=0   no game: the lesson's last screen ends on "Play again"
     ?game=1   straight to the game — the story and the lesson are skipped —
               for review and for the tests

   The game's own playtest flags travel with it: ?sound=0, ?reduced=1, ?fast=N,
   ?speed=N, ?tutorial=0|1, ?rs=N, ?hd=0|1. Its ?intro and ?skip deliberately do
   NOT pass through: ?intro=0 means "skip the story" on this
   page and "no opening avalanche" on that one.
   ========================================================================= */
(function () {
  'use strict';

  var GAME_URL = 'game/index.html';
  var PASS_THROUGH = ['sound', 'reduced', 'fast', 'speed', 'tutorial', 'rs', 'hd'];
  /* The opening's safety nets: no cover after this long (the game failed to load), or no
     hand-over this long after PLAY (it stopped), and the lesson opens anyway. */
  var OPENING_LOAD_CAP = 45000, OPENING_PLAY_CAP = 180000;
  /* The hand-over in the snow: the flurry thickens for SNOW_LEAD before the game starts to fade,
     the fade takes SNOW_FADE, and the flakes go on falling over the lesson after it. */
  var SNOW_LEAD = 420, SNOW_FADE = 1300;
  /* Swiftee's lines over the frozen game (src/intro/swiftee-cameo.js): before the lesson, why
     the learner must learn first; after it, at the ditch. A visit that has not finished by
     SWIFTEE_CAP lets the game go on regardless. */
  /* Every word she says over the game is her own voice (src/lesson/recordings.js), joined from
     her recorded words where nobody recorded the line whole (docs/voice/cue-map.json, joins J1-J3):
     at the broken path "Momo needs your help." and "But to help Momo, you need to learn about
     polygons."; at the ditch "Now let's help Momo." A line marked `whenRecorded` is said only
     if it has a take. ("Help Momo cross the Frozen Pass!" is the game narrator's, at the start of
     the run, not hers.) */
  var OPENING_LINES = [{ text: 'Momo needs your help.', whenRecorded: true }, { text: 'But to help Momo, you need to learn about polygons.' }];
  var DITCH_LINES = [{ text: "Now let's help Momo." }];
  function sayable(lines) {
    var V = window.PolygonRecordedVoice;
    return lines.filter(function (l) { return !l.whenRecorded || !!(V && V.find && V.find(l.text)); });
  }
  var SWIFTEE_CAP = 20000;
  function lessonAudio() {
    try { return window.__poly && window.__poly.ac ? window.__poly.ac() : null; } catch (e) { return null; }
  }
  /* Swiftee flies in over a frame and says her lines; resolves when she has, or at the cap. */
  function swiftee(f, where, lines, leave) {
    var S = window.SwifteeCameo;
    if (!S) return Promise.resolve(false);
    var visit = S.visit({ frame: f, where: where, lines: sayable(lines), audio: lessonAudio, leave: leave }).catch(function () { return false; });
    return Promise.race([visit, new Promise(function (r) { setTimeout(function () { r(false); }, SWIFTEE_CAP); })]);
  }
  /* The longest the curtain waits for the game's art before starting the run anyway. */
  var READY_CAP = 20000;
  /* The curtain's two moves, matching the transitions in styles/runner-stage.css
     with a little slack so a class is never changed mid-fade. */
  var CURTAIN_IN = 340, CURTAIN_OUT = 580;

  function params() {
    try { return new URLSearchParams(window.location.search); } catch (e) { return null; }
  }
  var q = params();
  var flag = q ? q.get('game') : null;
  var enabled = flag !== '0';
  var autostart = flag === '1';

  var host = null, frame = null, curtain = null, shown = false, starting = null, phase = 'IDLE';
  /* What the game has said (game/js/main.js, ?cover=0): 'ready' once its art is in. Heard as a
     message, because a page opened straight off the disk cannot reach into the frame. */
  var said = { ready: false, running: false };
  window.addEventListener('message', function (e) {
    var w = null, o = null;
    try { w = frame && frame.contentWindow; } catch (x) { w = null; }
    try { o = open && open.frame && open.frame.contentWindow; } catch (x) { o = null; }
    if (o && e.source === o && e.data && typeof e.data.iceAge === 'string') { openingSaid(e.data.iceAge, e.data); return; }
    if (!w || e.source !== w || !e.data || typeof e.data.iceAge !== 'string') return;
    /* at the ditch, after the lesson: Swiftee flies in, says her line and flies off, and the game
       is told so it can go on to the plank */
    if (e.data.iceAge === 'swiftee') {
      var src = w;
      swiftee(frame, e.data.where, DITCH_LINES, 'right').then(function () {
        try { src.postMessage({ iceAge: 'said', id: e.data.id }, '*'); } catch (x) {}
      });
    }
    if (e.data.iceAge === 'ready') said.ready = true;
    if (e.data.iceAge === 'running') said.running = true;
  });

  function gameSrc(first) {
    var out = first || ['cover=0', 'lesson=end'];
    if (q) PASS_THROUGH.forEach(function (k) {
      if (q.has(k)) out.push(k + '=' + encodeURIComponent(q.get(k)));
    });
    return GAME_URL + (out.length ? '?' + out.join('&') : '');
  }

  /* ------------------------------------------------------------ the opening */
  var open = null;   // { host, frame, curtain, phase, said, done, timers }
  var openPhase = 'IDLE';
  function openingSaid(word, data) {
    if (!open) return;
    open.said[word] = true;
    if (word === 'play' && open.phase === 'OPENING_COVER') { open.phase = openPhase = 'OPENING_TUTORIAL'; arm(OPENING_PLAY_CAP); }
    if (word === 'ready') {
      clearTimeout(open.loadCap);
      // review (?dev=1&devat=break): straight on to the broken path once the art is in
      if (q && q.get('dev') === '1' && q.get('devat') === 'break') devBreak();
    }
    if (word === 'lesson' && open.phase !== 'OPENING_SWIFTEE') {
      /* the game is frozen at the broken path: Swiftee flies in and tells the learner why they
         must learn first, and stays for the snow */
      open.phase = openPhase = 'OPENING_SWIFTEE';
      var mine = open;
      swiftee(open.frame, data && data.where, OPENING_LINES, 'stay').then(function () { if (open === mine) toLesson(); });
    }
  }
  function arm(ms) {
    clearTimeout(open.cap);
    open.cap = setTimeout(toLesson, ms);
  }
  function reducedMotion() {
    return !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  }
  /* A FLURRY, the lesson's own snow blown hard for a moment: the crystals of src/fx/snowflake.js
     (the lesson's weather is drawn with them), most small and a few big, falling and turning on a
     wind from the left, over the game and the lesson both. Nothing in it is solid, so the screen
     is never covered: what is under the snow is always one picture or the other. */
  function flurry() {
    var box = document.createElement('div');
    box.className = 'opening-snow';
    box.setAttribute('aria-hidden', 'true');
    document.body.appendChild(box);
    var W = window.innerWidth || 1280, H = window.innerHeight || 720;
    var n = Math.round(Math.max(44, Math.min(96, W * H / 14000))), end = 0;
    for (var i = 0; i < n; i++) {
      var size = Math.round(10 + Math.pow(Math.random(), 1.9) * 62);
      var el = document.createElement('div');
      el.className = 'opening-flake';
      if (window.Snowflake) el.innerHTML = window.Snowflake.svg(size, i % 3, { weight: Math.max(1.1, size * 0.05) });
      else { el.style.width = el.style.height = Math.round(size / 3) + 'px'; el.className += ' is-dot'; }
      box.appendChild(el);
      var x0 = Math.random() * (W + 240) - 200, drift = 80 + Math.random() * 200;
      var y0 = -size - Math.random() * H * 0.35, y1 = H + size;
      var spin = (Math.random() < 0.5 ? -1 : 1) * (80 + Math.random() * 200);
      var dur = Math.round(1500 + Math.random() * 1100 + (72 - size) * 12), delay = Math.round(Math.random() * 900);
      end = Math.max(end, dur + delay);
      try {
        el.animate([
          { transform: 'translate(' + x0 + 'px,' + y0 + 'px) rotate(0deg)', opacity: 0 },
          { opacity: 0.95, offset: 0.12 },
          { opacity: 0.9, offset: 0.78 },
          { transform: 'translate(' + (x0 + drift) + 'px,' + y1 + 'px) rotate(' + spin + 'deg)', opacity: 0 }
        ], { duration: dur, delay: delay, easing: 'linear', fill: 'both' });
      } catch (e) { el.style.display = 'none'; }
    }
    setTimeout(function () { if (box.parentNode) box.parentNode.removeChild(box); }, end + 120);
  }
  /* The game has handed over (or a safety net has fired). The snow comes, the lesson starts
     under the game (`done` settles: src/intro/opening.js opens the lesson's gate) and is
     painted again, and the game fades away under the snow to show it. */
  function toLesson() {
    if (!open || open.phase === 'OPENING_TO_LESSON' || open.phase === 'OPENING_DONE') return;
    open.phase = openPhase = 'OPENING_TO_LESSON';
    clearTimeout(open.cap); clearTimeout(open.loadCap);
    var mine = open, still = reducedMotion();
    if (!still) flurry();
    // the game's bed goes as the lesson's comes, and Swiftee flies off toward the lesson's rock
    try { mine.frame.contentWindow.postMessage({ iceAge: 'quiet' }, '*'); } catch (e) {}
    if (window.SwifteeCameo) window.SwifteeCameo.leave('left');
    setTimeout(function () {
      if (open !== mine) return;
      document.documentElement.removeAttribute('data-runner');   // the lesson paints again, under the frame
      mine.resolve(true);
      mine.host.style.transition = 'opacity ' + (still ? 300 : SNOW_FADE) + 'ms ease-in-out';
      requestAnimationFrame(function () { mine.host.style.opacity = '0'; });
      setTimeout(function () { if (open === mine) closeOpening(); }, (still ? 300 : SNOW_FADE) + 80);
    }, still ? 0 : SNOW_LEAD);
  }
  /* Show the game's cover as the page, now, and resolve true once the game has handed over to
     the lesson (false if there is no game). `onGesture` is called on every press inside the
     game, so the lesson can open its own audio on the learner's PLAY (same-origin frames). */
  function opening(opts) {
    if (!enabled || !document.body) return Promise.resolve(false);
    if (open) return open.done;
    opts = opts || {};
    open = { said: {}, phase: 'OPENING_COVER' };
    openPhase = 'OPENING_COVER';
    if (window.SwifteeCameo) window.SwifteeCameo.preload(sayable(OPENING_LINES).map(function (l) { return l.text; }));
    var h = document.createElement('div');
    h.id = 'runner-opening';
    h.className = 'runner-host is-on';
    var f = document.createElement('iframe');
    f.className = 'runner-frame';
    f.title = 'Frozen Rush';
    f.setAttribute('allow', 'autoplay; fullscreen');
    f.src = gameSrc(['lesson=intro']);
    var c = document.createElement('div');
    c.className = 'runner-curtain';
    c.setAttribute('aria-hidden', 'true');
    h.appendChild(f);
    h.appendChild(c);
    document.body.appendChild(h);
    document.documentElement.setAttribute('data-runner', 'on');
    open.host = h; open.frame = f; open.curtain = c;
    open.done = new Promise(function (resolve) { open.resolve = resolve; });
    f.addEventListener('load', function () {
      try { f.focus(); } catch (e) {}
      var w = null;
      try { w = f.contentWindow; w.document; } catch (e) { w = null; }   // off the disk the frame is another origin
      if (w && opts.onGesture) ['pointerdown', 'pointerup', 'keydown'].forEach(function (k) {
        try { w.addEventListener(k, function () { try { opts.onGesture(); } catch (e) {} }, true); } catch (e) {}
      });
    });
    open.loadCap = setTimeout(function () { if (open && !open.said.ready && !open.said.play) toLesson(); }, OPENING_LOAD_CAP);
    return open.done;
  }
  /* REVIEW ONLY (?dev=1, the screen menu in src/lesson/screen-navigator.js). devBreak() takes the
     game on screen straight to its broken path (game/js/main.js, 'dev-break'): before the lesson,
     to Swiftee's line there; after it, to Swiftee at the ditch. devEndOpening() ends the opening
     at once, with no Swiftee and no snow, so the lesson can be jumped to. */
  function devBreak() {
    var f = open ? open.frame : (shown ? frame : null), w = null;
    try { w = f && f.contentWindow; } catch (e) { w = null; }
    if (w) try { w.postMessage({ iceAge: 'dev-break' }, '*'); } catch (e) {}
    return !!w;
  }
  function devEndOpening() {
    if (!open) return Promise.resolve(false);
    var mine = open;
    if (window.SwifteeCameo) window.SwifteeCameo.close();
    open.phase = openPhase = 'OPENING_TO_LESSON';
    clearTimeout(open.cap); clearTimeout(open.loadCap);
    document.documentElement.removeAttribute('data-runner');
    mine.resolve(true);
    closeOpening();
    return Promise.resolve(true);
  }

  /* Take the opening's frame off the page (the lesson is the page by now). */
  function closeOpening() {
    if (!open) return;
    var h = open.host;
    open.phase = openPhase = 'OPENING_DONE';
    clearTimeout(open.cap); clearTimeout(open.loadCap);
    if (h && h.parentNode) h.parentNode.removeChild(h);
    if (!host || !shown) document.documentElement.removeAttribute('data-runner');
    open = null;
  }
  /* The game's engine, if the frame has booted it. Same origin, so this is a plain read. */
  function game() {
    try { return (frame && frame.contentWindow && frame.contentWindow.iceAgeGame) || null; }
    catch (e) { return null; }
  }

  /* Put the game on the page, invisible and untouchable, so it loads while the lesson
     finishes. Safe to call more than once: the second call finds the first frame. */
  function preload() {
    if (!enabled || host || !document.body) return host;
    if (window.SwifteeCameo) window.SwifteeCameo.preload(DITCH_LINES.map(function (l) { return l.text; }));
    host = document.createElement('div');
    host.id = 'runner-stage';
    host.className = 'is-loading';
    host.setAttribute('aria-hidden', 'true');

    frame = document.createElement('iframe');
    frame.className = 'runner-frame';
    frame.title = 'Help Momo cross the Frozen Pass';
    frame.setAttribute('allow', 'autoplay; fullscreen');
    frame.tabIndex = -1;                 // not reachable by Tab until it is on screen
    frame.src = gameSrc();

    curtain = document.createElement('div');
    curtain.className = 'runner-curtain';
    curtain.setAttribute('aria-hidden', 'true');

    host.appendChild(frame);
    host.appendChild(curtain);
    document.body.appendChild(host);
    return host;
  }

  /* Bring the game up. Resolves true once the curtain has lifted, false if there is no
     game to bring up; a second call while the first is under way returns the same promise. */
  function start() {
    if (!enabled) return Promise.resolve(false);
    if (starting) return starting;
    preload();
    if (!host) return Promise.resolve(false);
    phase = 'TRANSITION_TO_GAME';
    starting = new Promise(function (resolve) {
      shown = true;
      // 1. the lesson dims to the game's night blue
      host.classList.add('is-arriving');
      setTimeout(function () {
        // 2. under the curtain: the lesson stops painting and the game becomes the page
        document.documentElement.setAttribute('data-runner', 'on');
        host.classList.remove('is-loading');
        host.removeAttribute('aria-hidden');
        frame.tabIndex = 0;
        try { frame.focus(); } catch (e) { /* focus is a courtesy, not a requirement */ }
        phase = 'FROZEN_RUSH_INIT';
        // 3. once its art is in, the run starts, once, and the curtain lifts on it
        ready().then(function () {
          /* asked two ways, and again every half second until the game says its run has
             begun: it starts once however often it is asked (main.js holds it to one run),
             and a word lost on the way (a frame still settling) cannot leave it at its title */
          var tries = 0;
          (function ask() {
            if (said.running || !frame) return;
            var w = null;
            try { w = frame.contentWindow; } catch (e) { w = null; }
            try { if (w && w.iceAgeBegin) w.iceAgeBegin(); } catch (e) {}
            try { if (w) w.postMessage({ iceAge: 'begin' }, '*'); } catch (e) {}
            if (++tries < 60) setTimeout(ask, 500);
          })();
          phase = 'FROZEN_RUSH_RUNNING';
          requestAnimationFrame(function () {
            requestAnimationFrame(function () {
              host.classList.add('is-on');
              setTimeout(function () { host.classList.remove('is-arriving'); resolve(true); }, CURTAIN_OUT);
            });
          });
        });
      }, CURTAIN_IN);
    });
    return starting;
  }

  /* Resolves when the game says its art is in (iceAgeReady), or after READY_CAP regardless:
     a run asked for before then starts the moment the art arrives (see game/js/main.js). */
  function ready() {
    var t0 = Date.now();
    return new Promise(function (resolve) {
      (function poll() {
        var w = null;
        try { w = frame && frame.contentWindow; } catch (e) { w = null; }
        var ok = said.ready;
        try { ok = ok || !!(w && w.iceAgeReady); } catch (e) { /* off the disk: the message says it */ }
        if (ok || !frame || Date.now() - t0 > READY_CAP) { resolve(); return; }
        setTimeout(poll, 100);
      })();
    });
  }

  /* For the page: resolves true once the game says its art is in, false after `ms` if it has
     not. The lesson keeps its last scene up until then, rather than a blank curtain. */
  function whenReady(ms) {
    if (!enabled) return Promise.resolve(false);
    preload();
    var t0 = Date.now();
    return new Promise(function (resolve) {
      (function poll() {
        var ok = said.ready;
        try { ok = ok || !!(frame && frame.contentWindow && frame.contentWindow.iceAgeReady); } catch (e) {}
        if (ok) { resolve(true); return; }
        if (!frame || Date.now() - t0 > (ms || READY_CAP)) { resolve(false); return; }
        setTimeout(poll, 150);
      })();
    });
  }

  /* Take the game down and give the lesson back. Nothing in the game calls this — its
     own Play again restarts the game — it is here for the checks and for a host that
     wants the lesson back. */
  function close() {
    if (!host) return;
    document.documentElement.removeAttribute('data-runner');
    if (host.parentNode) host.parentNode.removeChild(host);
    host = frame = curtain = null;
    shown = false;
    starting = null;
    phase = 'IDLE';
    said = { ready: false, running: false };
  }

  window.RunnerStage = {
    enabled: enabled,
    autostart: autostart,
    preload: preload,
    opening: opening,
    closeOpening: closeOpening,
    devBreak: devBreak,
    devEndOpening: devEndOpening,
    whenReady: whenReady,
    start: start,
    close: close,
    /* For the tests: is the game on the page, is it on screen, and what state does it report. */
    state: function () {
      var g = game();
      var og = null;
      try { og = open && open.frame && open.frame.contentWindow && open.frame.contentWindow.iceAgeGame; } catch (e) { og = null; }
      return { enabled: enabled, loaded: !!host, shown: shown, phase: phase, game: g ? g.state() : null, ready: said.ready, running: said.running,
               opening: { phase: openPhase, on: !!open, said: open ? Object.keys(open.said) : [], game: og ? og.state() : null } };
    }
  };

  if (autostart) {
    var go = function () { preload(); start(); };
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', go, { once: true });
    else go();
  }
})();
