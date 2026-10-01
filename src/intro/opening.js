/* ============================================================================
   THE OPENING — the game's own cover and tutorial, then the lesson.

   The experience opens on Frozen Rush itself (src/runner/runner-stage.js, opening()): its
   banner and PLAY, its opening avalanche, and its tutorial as far as the broken path —
   "This is Momo. He needs to find his friend." ... "Oh no! The path is broken." — where it
   says "Momo needs your help. But to help Momo, you need to learn about polygons." The game
   then holds its world still and hands over IN THE SNOW: a flurry blows across, the lesson
   starts underneath, and the game fades away under the snow onto it (runner-stage.js,
   toLesson). Nothing blank and nothing to press between them. The lesson waits on
   Opening.gate before it runs screen 1 (index.html), so nothing in it starts underneath the
   game before then; and from the first moment the page loads it is kept hidden, so it never
   shows before the game's cover does.

   ON DRAFT: the Momo + Popo story (src/story/story-intro.js) and the Help Momo scene
   (src/bridge/bridge-story.js) used to open the experience. Both are kept, and ?story=1
   brings them back in their old order (the story, then the scene, then the lesson, out of
   the story's dark) in place of the game's opening; ?bridge=1 opens on the scene alone.

   Where nothing opens (?intro=0, ?preview=1, ?game=0, ?game=1, an automated browser), the
   gate opens at once. ?intro=1 asks for the game's opening in an automated browser.
   ========================================================================= */
(function () {
  'use strict';

  var DARK = '#0b1c33';    // the story's --story-dark, and the scene's dusk
  var FADE = 700;          // the colour clearing off the lesson, ms

  var open = null;
  var gate = new Promise(function (resolve) { open = resolve; });

  function params() {
    try { return new URLSearchParams(window.location.search); } catch (e) { return null; }
  }
  function reducedMotion() {
    return !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  }

  /* the drafted story's way in: its dark, clearing off the lesson. Above the lesson and its
     screen navigator (10000) and the story (10060), which is still going for a frame or two */
  function veil(colour) {
    var v = document.createElement('div');
    v.id = 'opening-veil';
    v.setAttribute('aria-hidden', 'true');
    v.style.cssText = 'position:fixed;inset:0;z-index:10062;pointer-events:none;background:' + colour +
      ';opacity:1;transition:opacity ' + FADE + 'ms ease-out';
    document.body.appendChild(v);
    var gone = function () { if (v.parentNode) v.parentNode.removeChild(v); };
    if (reducedMotion()) { setTimeout(gone, 60); return; }
    requestAnimationFrame(function () { requestAnimationFrame(function () { v.style.opacity = '0'; }); });
    setTimeout(gone, FADE + 160);
  }

  function lesson(colour) {
    if (colour && document.body) veil(colour);
    open();
  }

  /* the drafted opening: the story, then the Help Momo scene, then the lesson */
  function storyFirst() {
    var story = window.StoryIntro && window.StoryIntro.gate;
    var played = false;
    var helpMomo = function () {
      played = played || !!document.getElementById('story-intro');
      var B = window.BridgeStory;
      return B && B.afterStory ? B.afterStory() : false;
    };
    var after = function (sceneShown) { lesson(played || sceneShown === true ? DARK : null); };
    if (story && story.then) story.then(helpMomo, helpMomo).then(after, after);
    else Promise.resolve(helpMomo()).then(after, after);
  }

  /* the game's cover and tutorial, then the lesson */
  function gameFirst(RS) {
    var unlock = function () {
      // the learner's PLAY opens the lesson's audio too, so screen 1 is heard (same-origin frames)
      try { if (window.__poly && window.__poly.unlockAudio) window.__poly.unlockAudio(); } catch (e) {}
    };
    // the runner stage fades the game away onto the lesson itself, under its snow
    var after = function () { lesson(null); };
    RS.opening({ onGesture: unlock }).then(after, after);
  }

  /* Whether the game opens the page, from the address alone (the runner stage reads the same
     ?game flag: 0 is no game, 1 is straight to the game after the lesson). */
  function wanted(q) {
    var g = q ? q.get('game') : null;
    if (g === '0' || g === '1') return false;
    if (q && (q.get('story') === '1' || q.get('bridge') === '1')) return false;
    if (q && (q.get('intro') === '0' || q.get('preview') === '1')) return false;
    if (q && q.get('intro') === '1') return true;
    return !navigator.webdriver;
  }
  var early = wanted(params());
  /* hidden from the start, under the page's own dark blue, until the game's cover is up */
  if (early) document.documentElement.setAttribute('data-runner', 'on');

  function autostart() {
    var q = params();
    if (q && (q.get('story') === '1' || q.get('bridge') === '1')) { storyFirst(); return; }
    var RS = window.RunnerStage;
    if (early && RS && RS.enabled && RS.opening) { gameFirst(RS); return; }
    if (early) document.documentElement.removeAttribute('data-runner');
    lesson(null);
  }

  window.Opening = { gate: gate };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', autostart, { once: true });
  else autostart();
})();
