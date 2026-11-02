/* The flight cycle, registered beside the generated atlas rather than inside
   it: swiftee-sheets.js is written by tools/build-swiftee.cjs and says so at the
   top, so anything added by hand belongs here or it is lost the next time the
   atlas is rebuilt.

   Eight frames on the same 256px square grid as every other clip, cut from the
   supplied sheet left to right, top row first. Wings beat through the row, so
   the cycle loops seamlessly from frame 8 back to frame 1 -- no ping-pong,
   which would beat the wings backwards on the return leg.

   exitsCell is false: the bird stays inside its cell and the scene moves the
   cell, which is what lets her fly a path without the sprite drifting out of
   frame.

   Also here: which scale a cell is drawn from. The pack cuts her sheets at 1x
   (256px cells) and 2x (512px), and the build ships the 2x ones under
   window.SWIFTEE.hd. A cell is drawn from its 2x sheet where the 1x one would
   be stretched past 1.5 times on the screen -- a hi-DPI laptop or tablet, a 2K
   or 4K display -- for about a third more bytes; a phone keeps the 1x set. */
(function () {
  'use strict';
  var SW = window.SWIFTEE;
  if (!SW || !SW.clips) return;
  SW.clips.flying = {
    image: 'assets/swiftee/swiftee_flying@1x.webp',
    frames: 8,
    cols: 4,
    rows: 2,
    pingpong: false,
    exitsCell: false
  };
  /* `px`: the cell's size on the screen in device pixels (its CSS size times devicePixelRatio). */
  SW.hdWanted = function (px) { return !!(SW.hd && SW.hd.images && px >= SW.cell * 1.5); };
  /* The page's one answer, for everything that draws her (the lesson's guide, the recap, her visits
     over the game): her cell as the guide draws it, GUIDE_CELL stage px (SWIFTEE_CELL in index.html),
     at the lesson stage's scale on this screen. One answer, so no screen fetches her at both scales. */
  var GUIDE_CELL = 340;
  SW.hdForPage = function () {
    var R = window.PolygonResponsive;
    var scale = R ? R.frame(window.innerWidth, window.innerHeight).scale : 1;
    return SW.hdWanted(GUIDE_CELL * scale * (window.devicePixelRatio || 1));
  };
  /* A clip's sheet at the chosen scale: its image and the size of a cell in it. The 1x sheet
     where the clip has no 2x one (the flight above), or where hd is not wanted. */
  SW.sheet = function (name, hd) {
    var c = SW.clips[name];
    if (!c) return null;
    var im = hd && SW.hd && SW.hd.images ? SW.hd.images[name] : null;
    return im ? { image: im, cell: SW.hd.cell } : { image: c.image, cell: SW.cell };
  };
})();
