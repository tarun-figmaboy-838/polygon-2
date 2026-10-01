/* ============================================================================
   THE OPENING — the story, then the Help Momo scene, then the lesson.

   The Momo + Popo story (src/story/story-intro.js) plays first; when it hands over,
   the Help Momo scene (src/bridge/bridge-story.js) plays, Momo running ahead of the
   avalanche to the broken path; and once its Next has been pressed, the lesson. The
   lesson waits on Opening.gate before it runs screen 1 (index.html), so nothing in it
   starts underneath the story or the scene.

   The story ends on its dark, and the scene's Next fades back to the same dark. The
   lesson comes up out of it: as the last of them goes, a veil of that dark is put
   over the page, the gate opens, and the veil fades. Where neither played (?intro=0,
   ?preview=1, ?game=1, an automated browser), the gate opens at once.
   ========================================================================= */
(function () {
  'use strict';

  var DARK = '#0b1c33';    // the story's --story-dark, and the scene's dusk
  var FADE = 700;          // the dark clearing off the lesson, ms

  var open = null;
  var gate = new Promise(function (resolve) { open = resolve; });

  function reducedMotion() {
    return !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  }

  /* above the lesson and its screen navigator (10000) and the story (10060), which is still
     going for a frame or two; under the runner's stage (10070) */
  function veil() {
    var v = document.createElement('div');
    v.id = 'opening-veil';
    v.setAttribute('aria-hidden', 'true');
    v.style.cssText = 'position:fixed;inset:0;z-index:10062;pointer-events:none;background:' + DARK +
      ';opacity:1;transition:opacity ' + FADE + 'ms ease-out';
    document.body.appendChild(v);
    var gone = function () { if (v.parentNode) v.parentNode.removeChild(v); };
    if (reducedMotion()) { setTimeout(gone, 60); return; }
    requestAnimationFrame(function () { requestAnimationFrame(function () { v.style.opacity = '0'; }); });
    setTimeout(gone, FADE + 160);
  }

  function lesson(fromDark) {
    if (fromDark && document.body) veil();
    open();
  }

  function autostart() {
    var story = window.StoryIntro && window.StoryIntro.gate;
    var played = false;
    var helpMomo = function () {
      played = played || !!document.getElementById('story-intro');
      var B = window.BridgeStory;
      return B && B.afterStory ? B.afterStory() : false;
    };
    var after = function (sceneShown) { lesson(played || sceneShown === true); };
    if (story && story.then) story.then(helpMomo, helpMomo).then(after, after);
    else Promise.resolve(helpMomo()).then(after, after);
  }

  window.Opening = { gate: gate };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', autostart, { once: true });
  else autostart();
})();
