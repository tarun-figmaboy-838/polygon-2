/* ============================================================================
   THE FROZEN PASS — the runner game, played after the lesson.

   Momo has been through the story, the blizzard and the polygon lesson; this
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

   WHEN. The lesson calls preload() as its completion screen opens, so the game
   lays out, decodes its art and reaches its cover while the last line is read;
   the "Help Momo" button on that screen calls start(), which dims the lesson
   to the game's night blue, hides it, and lifts the curtain on the cover.

     ?game=0   no game: the completion screen keeps only "Play again"
     ?game=1   straight to the game — the story, the blizzard and the lesson
               are skipped — for review and for the tests

   The game's own playtest flags travel with it: ?sound=0, ?reduced=1, ?fast=N,
   ?speed=N, ?tutorial=0|1, ?rs=N, ?hd=0|1. Its ?intro and ?skip deliberately do
   NOT pass through: ?intro=0 means "skip the story and the blizzard" on this
   page and "no opening avalanche" on that one.
   ========================================================================= */
(function () {
  'use strict';

  var GAME_URL = 'game/index.html';
  var PASS_THROUGH = ['sound', 'reduced', 'fast', 'speed', 'tutorial', 'rs', 'hd'];
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

  var host = null, frame = null, curtain = null, shown = false, starting = null;

  function gameSrc() {
    var out = [];
    if (q) PASS_THROUGH.forEach(function (k) {
      if (q.has(k)) out.push(k + '=' + encodeURIComponent(q.get(k)));
    });
    return GAME_URL + (out.length ? '?' + out.join('&') : '');
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
        requestAnimationFrame(function () {
          requestAnimationFrame(function () {
            // 3. the curtain lifts on the cover
            host.classList.add('is-on');
            setTimeout(function () { host.classList.remove('is-arriving'); resolve(true); }, CURTAIN_OUT);
          });
        });
      }, CURTAIN_IN);
    });
    return starting;
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
  }

  window.RunnerStage = {
    enabled: enabled,
    autostart: autostart,
    preload: preload,
    start: start,
    close: close,
    /* For the tests: is the game on the page, is it on screen, and what state does it report. */
    state: function () {
      var g = game();
      return { enabled: enabled, loaded: !!host, shown: shown, game: g ? g.state() : null };
    }
  };

  if (autostart) {
    var go = function () { preload(); start(); };
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', go, { once: true });
    else go();
  }
})();
