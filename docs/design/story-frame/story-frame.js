/* STORY FRAME — fits the panel to the screen (the Momo + Polo story's fit()).

   var frame = StoryFrame.fit(document.querySelector('.sf-page'), {
     width: 1980, height: 1080,   // the picture's design size
     gutter: 0.95,                // the share of the screen the panel may fill
     onFit: function (f) {}       // f.scale, f.portrait, after every fit
   });
   frame.refit();                 // after you change the layout yourself
   frame.destroy();               // stop listening to resizes

   The panel scales to fit the screen with a gutter. Its ink line is set so it
   is 3 to 7 screen pixels whatever the scale. On an upright phone, where text
   in the picture would be under 15px, the page gets the class is-portrait: the
   panel moves to the upper part of the screen and .sf-caption sits under it. */
(function () {
  function fit(page, opts) {
    opts = opts || {};
    var W = opts.width || 1980, H = opts.height || 1080, gutter = opts.gutter || 0.95;
    page.style.setProperty('--sf-w', W + 'px');
    page.style.setProperty('--sf-h', H + 'px');

    function run() {
      var vw = page.clientWidth || window.innerWidth;
      var vh = page.clientHeight || window.innerHeight;
      if (!vw || !vh) return;
      var contain = Math.min(vw / W, vh / H);
      var portrait = vh > vw * 1.1 && contain * 50 < 15;   // 50px lettering would show under 15px
      var scale = contain * (portrait ? 0.96 : gutter);
      page.style.setProperty('--sf-scale', scale.toFixed(5));
      page.style.setProperty('--sf-ink-w', (Math.max(3, Math.min(7, vw / 260)) / scale).toFixed(2) + 'px');
      page.classList.toggle('is-portrait', portrait);
      if (portrait) {
        var panelH = H * scale;
        var centre = Math.max(80 + panelH / 2, vh * 0.3);
        page.style.setProperty('--sf-centre', centre.toFixed(1) + 'px');
        page.style.setProperty('--sf-caption-top', (centre + panelH / 2 + 20).toFixed(1) + 'px');
      } else {
        page.style.removeProperty('--sf-centre');
        page.style.removeProperty('--sf-caption-top');
      }
      if (opts.onFit) opts.onFit({ scale: scale, portrait: portrait });
    }

    run();
    window.addEventListener('resize', run);
    window.addEventListener('orientationchange', run);
    return {
      refit: run,
      destroy: function () {
        window.removeEventListener('resize', run);
        window.removeEventListener('orientationchange', run);
      }
    };
  }
  window.StoryFrame = { fit: fit };
})();
