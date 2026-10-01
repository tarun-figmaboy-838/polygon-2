/* ============================================================================
   THE LESSON'S MUSIC — the Frozen Rush game's own bed, under the learning section.

   The same track the game plays (game/assets/audio/bgm-ice-hunt), at the game's own
   level and with the game's own manners (CFG.music in game/js/engine.js): it fades in,
   it ducks under a voice so Swiftee is always clear, and it fades out as the game takes
   the screen, where the game's own copy of it carries on. So the lesson and the game
   sound like one thing.

   IT NEVER HOLDS ANYTHING UP. The track streams (a media element, not a decoded buffer);
   a browser that will not start it yet gets asked again on the next tap; a track that
   fails to load is simply not there. Nothing waits on it.

     LessonMusic.start({ audio, speaking, muted })   audio() -> the lesson's AudioContext,
                                                     speaking() -> duck now, muted() -> silent
     LessonMusic.stop(ms)                            fade out and stop
   ========================================================================= */
(function () {
  'use strict';

  var SRC = 'game/assets/audio/bgm-ice-hunt';
  var LEVEL = 0.17 * 0.7;     // CFG.music.gain under the game's 0.7 master
  var DUCK = 0.35;            // CFG.music.duck: the bed while a voice speaks
  var FADE_IN = 2.2;          // CFG.music.fadeMs, seconds
  var DUCK_IN = 0.25, DUCK_OUT = 0.6;

  var M = null;               // { el, ctx, gain, direct, on, opts, timer, level }

  function source() {
    var ogg = false;
    try { ogg = document.createElement('audio').canPlayType('audio/ogg; codecs="vorbis"') !== '' || document.createElement('audio').canPlayType('audio/ogg; codecs="opus"') === 'probably'; } catch (e) {}
    return SRC + (ogg ? '.ogg' : '.mp3');
  }
  function want() {
    if (!M || !M.on) return 0;
    var o = M.opts;
    try { if (o.muted && o.muted()) return 0; } catch (e) {}
    var duck = false;
    try { duck = !!(o.speaking && o.speaking()); } catch (e) {}
    return LEVEL * (duck ? DUCK : 1);
  }
  /* the level, eased toward where it should be: a gain node's own ramp where there is one,
     or the element's volume stepped (opened straight off the disk, where routing a media
     element through the context would silence it) */
  function ease(to, seconds) {
    if (!M) return;
    if (M.gain) {
      try { var t = M.ctx.currentTime; M.gain.gain.cancelScheduledValues(t); M.gain.gain.setTargetAtTime(to, t, Math.max(0.01, seconds / 3)); } catch (e) {}
    } else if (M.el) {
      var from = M.el.volume, steps = Math.max(1, Math.round(seconds * 20)), k = 0;
      clearInterval(M.step);
      M.step = setInterval(function () {
        if (!M || !M.el) return;
        k += 1;
        try { M.el.volume = Math.max(0, Math.min(1, from + (to - from) * (k / steps))); } catch (e) {}
        if (k >= steps) clearInterval(M.step);
      }, 50);
    }
    M.level = to;
  }
  function play() {
    if (!M || !M.on || !M.el || document.hidden) return;
    if (M.ctx && M.ctx.state === 'suspended') { try { M.ctx.resume(); } catch (e) {} }
    if (!M.el.paused) return;
    try { var p = M.el.play(); if (p && p.catch) p.catch(function () { /* asked again on the next tap */ }); } catch (e) {}
  }
  function tick() {
    if (!M || !M.on) return;
    var to = want();
    if (Math.abs(to - M.level) > 0.002) ease(to, to < M.level ? DUCK_IN : DUCK_OUT);
  }
  function onGesture() { play(); }
  function onVisibility() {
    if (!M || !M.el) return;
    if (document.hidden) { try { M.el.pause(); } catch (e) {} }
    else play();
  }

  function start(opts) {
    if (M && M.on) return;
    if (M) stopNow();
    opts = opts || {};
    var el;
    try { el = new Audio(); } catch (e) { return; }
    el.loop = true;
    el.preload = 'auto';
    var direct = location.protocol === 'file:';
    var ctx = null, gain = null;
    if (!direct) {
      try { ctx = opts.audio ? opts.audio() : null; } catch (e) { ctx = null; }
      if (ctx) {
        try {
          el.crossOrigin = 'anonymous';
          var node = ctx.createMediaElementSource(el);
          gain = ctx.createGain(); gain.gain.value = 0;
          node.connect(gain); gain.connect(ctx.destination);
        } catch (e) { gain = null; }
      }
    }
    if (!gain) el.volume = 0;
    el.src = source();
    el.addEventListener('error', function () { /* no music: nothing else changes */ });
    M = { el: el, ctx: ctx, gain: gain, direct: direct, on: true, opts: opts, level: 0, step: 0 };
    window.addEventListener('pointerup', onGesture, true);
    window.addEventListener('keydown', onGesture, true);
    document.addEventListener('visibilitychange', onVisibility);
    play();
    ease(want(), FADE_IN);
    M.timer = setInterval(tick, 200);
  }

  function stopNow() {
    if (!M) return;
    clearInterval(M.timer); clearInterval(M.step);
    try { M.el.pause(); M.el.removeAttribute('src'); M.el.load(); } catch (e) {}
    window.removeEventListener('pointerup', onGesture, true);
    window.removeEventListener('keydown', onGesture, true);
    document.removeEventListener('visibilitychange', onVisibility);
    M = null;
  }
  function stop(ms) {
    if (!M || !M.on) return;
    M.on = false;
    clearInterval(M.timer);
    var seconds = (ms == null ? 1200 : ms) / 1000;
    if (seconds <= 0) { stopNow(); return; }
    ease(0, seconds);
    var mine = M;
    setTimeout(function () { if (M === mine) stopNow(); }, seconds * 1000 + 120);
  }

  window.LessonMusic = {
    start: start,
    stop: stop,
    /* for the tests: is it on, and where it is going */
    state: function () {
      return M ? { on: M.on, playing: !!(M.el && !M.el.paused), level: +M.level.toFixed(3), routed: !!M.gain, src: M.el && M.el.src } : { on: false };
    }
  };
})();
