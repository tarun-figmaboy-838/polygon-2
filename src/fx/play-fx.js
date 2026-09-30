/* THE PLAY BUTTON'S MOTION — from the buttons kit of Swiftee & the Polygons (Part 1),
   buttons-kit.html, which takes it from src/fx/titlefx.js there: sparkle(), pressDown(),
   pressUp(), press() and burstFlake(). Copied as the kit ships it, with one addition:
   mount() returns a stop() that cancels every animation it started, so a page that
   takes its Play button away can stop the loops too.

     PlayFx.mount(wrap, onPlay)   wrap holds .kit-play (with its img and .kit-play-halo)
                                  and .kit-play-sparks; onPlay runs on click

   THE GLOW BREATHES, NOT THE BUTTON: a moving target is a target a child has to chase.
   The crystals are src/fx/snowflake.js (window.Snowflake); without it the rim is plain. */
(function () {
  'use strict';
  var RIM_CRYSTALS = 5, GLINTS = 10;
  var reduced = function () { return !!(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches); };
  function rnd(a, b) { return a + Math.random() * (b - a); }

  function make(anims) {
    function run(el, frames, opts) {
      if (!el || !el.animate) return null;
      try { var a = el.animate(frames, opts); anims.push(a); return a; } catch (e) { return null; }
    }

    function sparkle(host, halo, btn) {
      var doc = host.ownerDocument, i;
      run(halo, [
        { transform: 'scale(.94)', opacity: 0.65 },
        { transform: 'scale(1.08)', opacity: 1, offset: 0.5 },
        { transform: 'scale(.94)', opacity: 0.65 }
      ], { duration: 2400, iterations: Infinity, easing: 'ease-in-out' });
      if (btn) run(btn, [
        { filter: 'drop-shadow(0 10px 18px rgba(12,64,102,.45)) drop-shadow(0 0 0 rgba(255,229,150,0))' },
        { filter: 'drop-shadow(0 10px 18px rgba(12,64,102,.45)) drop-shadow(0 0 14px rgba(255,229,150,.85))', offset: 0.5 },
        { filter: 'drop-shadow(0 10px 18px rgba(12,64,102,.45)) drop-shadow(0 0 0 rgba(255,229,150,0))' }
      ], { duration: 2400, iterations: Infinity, easing: 'ease-in-out' });

      // crystals turning on the rim: a ring carries each round, the crystal fades on its own clock
      for (i = 0; i < RIM_CRYSTALS; i++) {
        var a0 = (i / RIM_CRYSTALS) * 360 + rnd(-16, 16), size = rnd(18, 32);
        var ring = doc.createElement('div');
        ring.style.cssText = 'position:absolute;inset:0;will-change:transform;';
        var el = doc.createElement('div');
        el.style.cssText = 'position:absolute;left:50%;top:-7%;width:' + size.toFixed(0) + 'px;height:' + size.toFixed(0) + 'px;' +
          'margin-left:' + (-size / 2).toFixed(0) + 'px;opacity:0;will-change:transform,opacity;';
        if (window.Snowflake) el.innerHTML = window.Snowflake.svg(size, i % 3, { weight: Math.max(1.1, size * 0.05), glow: 'rgba(255,238,186,.9)' });
        ring.appendChild(el); host.appendChild(ring);
        run(ring, [{ transform: 'rotate(' + a0.toFixed(0) + 'deg)' }, { transform: 'rotate(' + (a0 + 360).toFixed(0) + 'deg)' }],
            { duration: rnd(9000, 15000), iterations: Infinity, easing: 'linear' });
        run(el, [
          { transform: 'scale(.25) rotate(0deg)', opacity: 0 },
          { transform: 'scale(1) rotate(70deg)', opacity: 0.95, offset: 0.3 },
          { transform: 'scale(.95) rotate(180deg)', opacity: 0.85, offset: 0.68 },
          { transform: 'scale(.25) rotate(260deg)', opacity: 0 }
        ], { duration: rnd(3000, 4600), delay: -Math.random() * 4200, iterations: Infinity, easing: 'ease-in-out' });
      }
      // four-point glints, firing in their own time
      for (i = 0; i < GLINTS; i++) {
        var s = rnd(10, 26), ang = Math.random() * Math.PI * 2, rad = rnd(38, 62);
        var g = doc.createElement('div');
        g.style.cssText = 'position:absolute;left:' + (50 + Math.cos(ang) * rad).toFixed(1) + '%;top:' + (50 + Math.sin(ang) * rad).toFixed(1) + '%;' +
          'width:' + s.toFixed(0) + 'px;height:' + s.toFixed(0) + 'px;margin:' + (-s / 2).toFixed(0) + 'px 0 0 ' + (-s / 2).toFixed(0) + 'px;' +
          'opacity:0;will-change:transform,opacity;background:' +
          'radial-gradient(closest-side,rgba(255,255,255,.95),rgba(255,255,255,0) 70%),' +
          'linear-gradient(0deg,transparent 46%,#fff 50%,transparent 54%),' +
          'linear-gradient(90deg,transparent 46%,#fff 50%,transparent 54%);';
        host.appendChild(g);
        run(g, [
          { transform: 'scale(.2) rotate(0deg)', opacity: 0 },
          { transform: 'scale(.2) rotate(0deg)', opacity: 0, offset: 0.62 },
          { transform: 'scale(1.25) rotate(50deg)', opacity: 1, offset: 0.78 },
          { transform: 'scale(.2) rotate(100deg)', opacity: 0 }
        ], { duration: rnd(2600, 4400), delay: -Math.random() * 4000, iterations: Infinity, easing: 'ease-in-out' });
      }
    }

    // THE PRESS IS FELT WHILE THE FINGER IS DOWN: squash on down, a bounce back on up
    function pressDown(img, halo) {
      if (reduced()) return;
      run(img, [{ transform: 'scale(1) translateY(0)' }, { transform: 'scale(.9) translateY(5px)' }],
          { duration: 90, easing: 'cubic-bezier(.3,0,.7,1)', fill: 'forwards' });
      run(halo, [{ transform: 'scale(1)', opacity: 1 }, { transform: 'scale(.92)', opacity: 0.6 }], { duration: 90, fill: 'forwards' });
    }
    function pressUp(img, halo) {
      if (reduced()) return;
      run(halo, [{ transform: 'scale(.92)', opacity: 0.6 }, { transform: 'scale(1)', opacity: 1 }], { duration: 160, fill: 'forwards' });
      run(img, [{ transform: 'scale(.9) translateY(5px)' }, { transform: 'scale(1.08) translateY(-3px)' }, { transform: 'scale(1) translateY(0)' }],
          { duration: 420, easing: 'cubic-bezier(.2,1.4,.35,1)', fill: 'forwards' });
    }
    // and on click, a ring of crystals knocked off it, and the glow flares
    function press(host, halo) {
      if (reduced()) return;
      var doc = host.ownerDocument, n = 11;
      for (var i = 0; i < n; i++) burstFlake(doc, host, (i / n) * 360 + rnd(-14, 14), i % 3);
      run(halo, [{ transform: 'scale(1)', opacity: 1 }, { transform: 'scale(1.55)', opacity: 0 }], { duration: 540, easing: 'cubic-bezier(.2,.8,.3,1)' });
    }
    function burstFlake(doc, host, deg, seed) {
      var size = rnd(14, 27), el = doc.createElement('div');
      el.style.cssText = 'position:absolute;left:50%;top:50%;width:' + size.toFixed(0) + 'px;height:' + size.toFixed(0) + 'px;' +
        'margin:' + (-size / 2).toFixed(0) + 'px 0 0 ' + (-size / 2).toFixed(0) + 'px;will-change:transform,opacity;';
      if (window.Snowflake) el.innerHTML = window.Snowflake.svg(size, seed, { weight: Math.max(1, size * 0.06), glow: 'rgba(255,240,196,.95)' });
      host.appendChild(el);
      var a = deg * Math.PI / 180, r = rnd(72, 132);
      var an = run(el, [
        { transform: 'translate(0,0) scale(.25) rotate(0deg)', opacity: 1 },
        { transform: 'translate(' + (Math.cos(a) * r).toFixed(0) + 'px,' + (Math.sin(a) * r).toFixed(0) + 'px) scale(1.1) rotate(' + (deg > 180 ? -200 : 200) + 'deg)', opacity: 0 }
      ], { duration: rnd(520, 780), easing: 'cubic-bezier(.15,.8,.3,1)', fill: 'forwards' });
      var drop = function () { if (el.parentNode) el.parentNode.removeChild(el); };
      if (an && an.finished) an.finished.then(drop, drop); else setTimeout(drop, 800);
    }
    return { sparkle: sparkle, pressDown: pressDown, pressUp: pressUp, press: press };
  }

  /** Wire one Play button: `wrap` holds the button, its halo and the sparks layer. */
  function mount(wrap, onPlay) {
    var anims = [], fx = make(anims);
    var btn = wrap.querySelector('.kit-play'), img = btn.querySelector('img');
    var halo = wrap.querySelector('.kit-play-halo'), sparks = wrap.querySelector('.kit-play-sparks');
    if (!reduced()) fx.sparkle(sparks, halo, btn);
    btn.addEventListener('pointerdown', function () { fx.pressDown(img, halo); });
    ['pointerup', 'pointercancel', 'pointerleave'].forEach(function (t) { btn.addEventListener(t, function () { fx.pressUp(img, halo); }); });
    btn.addEventListener('click', function () { fx.press(sparks, halo); if (onPlay) onPlay(); });
    return function stop() { anims.forEach(function (a) { try { a.cancel(); } catch (e) {} }); anims.length = 0; };
  }
  window.PlayFx = { mount: mount };
})();
