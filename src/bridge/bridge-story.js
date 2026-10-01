/* ============================================================================
   HELP MOMO — the Broken Path, between the story and the lesson.

   The Momo + Popo story ends with Popo's "Momo, keep going!" and fades to its dark
   (src/story/story-intro.js). This scene comes up out of that dark, set in the Part 2
   game's own world and drawn from its own art (game/assets), placed the way
   game/js/engine.js places it:

     It opens as the game opens, on its avalanche (game/js/avalanche.js, ported below):
     a wall of snow comes down the pass, Momo bolts in along the ice path ahead of
     it, the path cracks and yawns behind his heels, and the snow spends itself.
     He runs on, the break comes into view ahead, and he skids to a stop short of
     the edge. He looks down at the drop, trembles a little and settles. Swiftee
     flies in on a curve, slows, and lands between him and the edge. She looks at
     the gap, looks back at Momo, and then speaks in her own Part 1 dialogue box,
     word by word with her voice: the two lines Part 2's tutorial also says at this
     moment, "Oh no! The path is broken." and "Help Momo cross the Frozen Pass!", and
     then the line that turns it into the lesson, "But for that first you need to
     learn about polygons." It stays up to be read, and then Next appears.

   Next fades the scene back to the story's dark, and the lesson comes up out of it
   (src/intro/opening.js waits for this scene, and the lesson waits for the opening).
   So the learner meets Momo's problem, then learns the polygons that solve it.

   AND IT COMES BACK AT THE END (ending, runEnding): after the lesson's last quiz the
   scene returns at the break, Momo at the edge and Swiftee beside him, for her line
   "Now you know everything about polygons. You are ready to help Momo.", and the game
   then starts by itself over it.

   THE SOUND is the game's own: the avalanche's (the kit's build, squeak, swoosh and
   boing, game/js/sfx.js, its recorded rumble and its synthesised cracks), its recorded
   snow footsteps on each footfall, its skid, its cartoon pips as Momo shivers at the
   edge, its whoosh (lighter, for a small bird) as Swiftee swoops in, and its interface
   tap on Next.

   THE STATES, in order, as state().phase reports them:
     STORY_COMPLETE   the story has handed over and start() was called
     STORY_ENTER      the scene comes up out of the story's dark
     MOMO_RUNNING     Momo runs in; the path scrolls; the break comes into view
     MOMO_AT_DITCH    he has stopped short of the edge and looks down
     SWIFTEE_ENTER    Swiftee flies in and lands
     SWIFTEE_OBSERVE  she looks at the gap, then at Momo
     DIALOGUE         her three lines, word by word with the voice
     STORY_READY      the last line is said; it stays up to be read
     NEXT_ENABLED     Next is on screen and takes a tap
     LESSON_START     Next was pressed; the scene fades back to the dark, and the lesson follows

   NOTHING ELSE TAKES A TAP OR A KEY. From start() until the hand-off, the page
   under the scene is inert, the scene swallows every pointer and key that is
   not meant for Next, and Next does not exist on screen until NEXT_ENABLED. A
   tap cannot skip Swiftee's entrance, start a line twice or press Next early.

   THE VOICE is Swiftee's, all three lines: her recorded takes of the first two
   (assets/audio/bridge/, cut from her delivered recording by tools/voice/cut-recordings.py)
   and the lesson recording of the third, each with its own word times, all three found in
   the lesson's catalogue (src/lesson/recordings.js) by their words. The game's tutorial
   says the first two again in the game's own voice; this scene does not play that take. They play through the lesson's own AudioContext, which the tap on
   the story's Play has already unlocked, so the scene speaks without asking for another
   tap. Where there is no sound (no context, blocked autoplay, a failed download), the
   words still arrive on the same clock, silently, and the scene carries on. A story
   that cannot talk is never a story that stops.

   WHEN IT PLAYS: after the story, whenever the story played (a learner who skipped it
   with Escape still meets Momo's problem). Where the story is left out (?story=0,
   ?intro=0, ?preview=1, automated browsers) so is this scene, and the lesson opens as
   it did.
   URL flags:
     ?bridge=0   leave this scene out: the lesson follows the story at once, and its
                 completion screen offers Help Momo (Part 2) and Play again
     ?bridge=1   open straight on this scene (the story is skipped);
                 its Next goes straight into the lesson. For review and for the tests
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
  /* AND THEN HE WAITS AS THE GAME'S MAMMOTH WAITS AT A CRACK (PlayerController, LOOK_DOWN):
     one still pose, the tremble's own last frame, the settle it ends on, kept alive by the
     game's procedural breath, a slow rise and fall with a matching narrowing about his feet.
     The idle sheet is not played here: the game keeps it off the ditch because twelve poses
     looping beside the edge read as fidgeting, and it did here too. */
  var HOLD = { frame: 11, rate: 1.75, lift: 3, grow: 0.006, narrow: 0.008, easeIn: 400 };

  /* THE COMPOSITION, in stage px: Momo stops at MOMO_X; the near lip of the break is at
     LIP and the break is GAP wide; Swiftee lands at PERCH, between his trunk (~740) and
     the edge. FACE_R is the right side of his face: her bubble stays to the right of it,
     so it never covers him. SUBJECT_W is how much of the stage must fit across the
     screen, which is what lets an upright phone show the whole scene. */
  var MOMO_X = 520, LIP = 1040, GAP = 440, FACE_R = 800, SUBJECT_W = 1380;
  var PERCH = 880, BIRD = 280;            // her landing spot and the size her 256px cell is drawn at
  var FLY_FEET = 0.76;                    // where her feet sit in a flight frame (standing: SWIFTEE.baseline)
  var HEAD = 0.1;                         // the top of her head in her cell

  /* Her three lines. All three are Swiftee's own recordings, in the lesson's catalogue
     (src/lesson/recordings.js): the first two are her takes of the Broken Path lines
     (assets/audio/bridge/), the third is a lesson recording. So each line's take, its
     length and its word times are that recording's (see lessonTake); `dur` is only the
     length the words keep without one. The ids are the game's, whose tutorial says the
     same two lines in its own voice. */
  var LINES = [
    { id: 'tut-5-broken', text: 'Oh no! The path is broken.', lesson: true,
      at: 0, dur: 2.4, words: [], focus: { 'broken.': 1 } },
    { id: 'tut-2-goal', text: 'Help Momo cross the Frozen Pass!', lesson: true,
      at: 0, dur: 2.5, words: [], focus: { 'Frozen': 1, 'Pass!': 1 } },
    { id: 'learn-first', text: 'But for that first you need to learn about polygons.', lesson: true,
      at: 0, dur: 3.6, words: [], focus: { 'polygons.': 1 } }
  ];
  /* A line takes its recording from the lesson's catalogue, looked up by its words
     exactly as the lesson looks them up. Without the catalogue the words keep an even pace
     over the line's own length, silently. */
  function lessonTake(line) {
    if (!line.lesson || line.take !== undefined) return line.take || null;
    var rec = null;
    try { rec = window.PolygonRecordedVoice && window.PolygonRecordedVoice.find(line.text); } catch (e) {}
    line.take = rec || null;
    var n = line.text.split(' ').length;
    if (rec && rec.words && rec.words.length === n) {
      line.dur = rec.duration;
      line.words = rec.words.map(function (w) { return w.start; });
    } else {
      if (rec && rec.duration) line.dur = rec.duration;
      line.words = line.text.split(' ').map(function (w, i) { return line.dur * 0.9 * i / n; });
    }
    return line.take;
  }
  LINES.forEach(lessonTake);
  /* THE ENDING: after the lesson's last quiz the scene comes back, at the break, for one line:
     Swiftee's back to Momo, the lesson's own recording (the lesson hands its text in). */
  var ENDING = [{ id: 'ready-momo', text: 'Now you know everything about polygons. You are ready to help Momo.', lesson: true,
    at: 0, dur: 5, words: [], focus: { 'polygons.': 1, 'Momo.': 1 } }];
  ENDING.forEach(lessonTake);
  /* THE GAME'S OWN SOUNDS (CFG.sfx in game/js/engine.js), at its gains under its 0.7 master:
     the recorded snow footsteps, cut at each footfall found in the waveform and taken in
     turn; the owner's cartoon pips for the tremble at the edge; the whoosh, pitched up
     and quiet for a small bird swooping in; and the interface tap the cover's Play uses. */
  var MASTER = 0.7;
  var SFX = {
    step:    { src: 'assets/audio/freesound_community-foot_steps_snow_heavy-38297.mp3', mode: 'onset', dur: 0.40, gain: 0.42, rate: 0.10 },
    tremble: { src: 'assets/audio/dragon-studio-cartoon-blinking-372481.mp3', mode: 'window', at: 0.04, dur: 0.50, gain: 0.55, rate: 0.03 },
    whoosh:  { src: 'assets/audio/dragon-studio-heavy-whoosh-06-414584.mp3', mode: 'onset', dur: 0.55, gain: 0.16, rate: 0.04, pitch: 1.5 },
    ui:      { src: 'assets/audio/floraphonic-punchy-taps-ui-5-183901.mp3', mode: 'onset', dur: 0.22, gain: 0.45, rate: 0.08 },
    rumble:  { src: 'assets/audio/themediaguy-earthquake-rumble-amp-cracking-379298.mp3', mode: 'window', at: 0, dur: 2.60, gain: 0.55, rate: 0.02 }
  };

  /* THE TIMELINE, in ms of scene time. The run is short on purpose: in, a stretch of
     running while the break comes into view, the stop. */
  var T = {
    dusk: 440,         // the story's dark holds a moment before the scene comes up
    loadCap: 8000,     // longest the scene waits for its art in the dark
    enter: 1730,       // Momo runs in while the path picks up speed (and the avalanche roars)
    cruise: 2970,      // running: the avalanche sweeps behind him and settles (AV_TOTAL from
                       // the start of the run), then 900 more with the break in view
    beforeBird: 450,   // he has settled; a breath before Swiftee
    fly: 1900,         // her flight in, slowing to the end
    settle: 500,       // wings folding after the touchdown
    lookGap: 700,      // she looks at the break
    lookMomo: 450,     // she looks back at Momo
    partOut: 160,      // a line fading out before the next takes the box
    lineGap: 420,      // the pause between one line and the next
    read: 1100,        // the last line stays up alone, to be read, before Next
    endingIn: 700,     // the ending: the scene is up at the break, a breath before her line
    leave: 420,        // Next: the scene fades back to the dark the lesson comes up out of
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

  /* ============ THE OPENING AVALANCHE, AS THE GAME PLAYS IT ============
     Ported from game/js/avalanche.js, with the game's own numbers and its own sounds (the kit,
     game/js/sfx.js, and the recorded rumble): the scene opens as the Frozen Rush game opens.
     A wall of snow comes down the pass, Momo bolts ahead of it, the path comes apart behind
     his heels, and when it has spent itself he runs on to the break. Read the game's comments
     there for why each piece is what it is (no outline, a leading edge, it stops at his tail,
     normal blending with a lit crown, deterministic puffs); keep the two in step.
     It plays over the first AV_TOTAL ms of the run: roar (the ground shakes, snow lifts, he
     startles), sweep (the wall crosses behind him, he is carried forward, the trail opens),
     settle (the dust falls out and he eases back to his mark). Reduced motion has no run, so
     no avalanche: he is already at the edge. */
  var AV = { roar: 900, sweep: 1900, settle: 1000 };
  var AV_TOTAL = AV.roar + AV.sweep + AV.settle;
  var AV_N = 210, AV_STREAKS = 70, AV_MIN = 84, AV_BUDGET_MS = 7;
  var avQuality = 1;
  function avEaseOut(t) { return 1 - Math.pow(1 - t, 3); }
  function avEaseInOut(t) { return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; }
  function avHash(n) { return Math.abs((Math.sin(n) * 43758.5453) % 1); }
  function rnd(a, b) { return a + Math.random() * (b - a); }
  /* how far ahead of his mark he is carried while it lasts (a draw offset, as in the game) */
  function avLead(t) {
    if (t <= 0 || t >= AV_TOTAL) return 0;
    var inK = avEaseOut(clamp(t / (AV.roar + AV.sweep * 0.5), 0, 1));
    var outK = avEaseInOut(clamp((t - (AV.roar + AV.sweep)) / AV.settle, 0, 1));
    return 300 * inK * (1 - outK);
  }
  /* The game's SFX kit (game/js/sfx.js, loaded by the page) for the comic beats. */
  function kit(name, opts) {
    var K = window.SFX;
    if (!K || typeof K.play !== 'function' || !running()) return;
    try { K.play(name, opts || {}); heard(name); } catch (e) {}
  }
  /* the rumble, from the game's recording, or the game's own synth without it */
  function avRumble() {
    if (cue('rumble')) return;
    if (!running()) return;
    noise(1.5, 190, 'lowpass', 0.1, 0.5, 0, 70);
    warble(52, 1.6, 0.17, 'sine', 32, 2, 3);
    heard('rumble');
  }
  /* the ground going: the game's crack (AudioManager.crack) */
  function avCrack() {
    if (!running()) return;
    noise(0.09, 5200, 'highpass', 0.16, 1.0);
    noise(0.34, 2100, 'bandpass', 0.11, 3.2, 0.03);
    warble(760, 0.11, 0.04, 'triangle', 240, 4, 20);
    heard('crack');
  }
  /* screen shake, the game's two kinds: the long rumble (quake) and the short punch (shake) */
  function avShake(px, ms, delay) { S.av.shakes.push({ px: px, ms: ms, at: S.clock + (delay || 0) }); }
  function avShakeOffset() {
    var ox = 0, oy = 0, now = S.clock;
    S.av.shakes = S.av.shakes.filter(function (q) { return now < q.at + q.ms; });
    S.av.shakes.forEach(function (q, i) {
      if (now < q.at) return;
      var e = 1 - (now - q.at) / q.ms;
      ox += Math.sin(now * 0.091 + i * 1.7) * q.px * e;
      oy += Math.cos(now * 0.113 + i) * q.px * e * 0.6;
    });
    return { x: ox, y: oy };
  }
  /* the game's particles for the wave's foot: a cartoon poof of snow, and ice chips */
  function avPoof(x, y, n, size) {
    for (var i = 0; i < n; i++) {
      var a = -Math.PI / 2 + (i / Math.max(1, n - 1) - 0.5) * 2.4 + rnd(-0.25, 0.25), v = rnd(70, 160) * size;
      S.av.parts.push({ kind: 'puff', x: x + rnd(-16, 16) * size, y: y + rnd(-6, 2), vx: Math.cos(a) * v * 1.5, vy: Math.sin(a) * v * 0.5 - 24,
        r: rnd(10, 19) * size, dur: rnd(0.5, 0.9), t: 0, swell: rnd(1.5, 2.2) });
    }
  }
  function avChips(x, y, n, vy0) {
    for (var i = 0; i < n; i++) S.av.parts.push({ kind: 'ice', x: x + rnd(-70, 70), y: y + rnd(-10, 20), vx: rnd(-70, 70), vy: rnd(vy0, vy0 + 90),
      r: rnd(4, 10), dur: rnd(0.7, 1.2), t: 0, rot: rnd(0, 6.28), vr: rnd(-4, 4) });
  }
  function avParts(dt) {
    var k = dt / 1000;
    S.av.parts = S.av.parts.filter(function (p) {
      p.t += k;
      if (p.t >= p.dur) return false;
      if (p.kind === 'puff') { p.vx *= (1 - 2.6 * k); p.vy = p.vy * (1 - 2.6 * k) - 34 * k; }
      else { p.vy += 900 * k; p.rot += p.vr * k; }
      p.x += p.vx * k; p.y += p.vy * k;
      return true;
    });
  }
  function drawAvParts(ctx) {
    S.av.parts.forEach(function (p) {
      var life = 1 - p.t / p.dur;
      if (p.kind === 'ice') {
        ctx.globalAlpha = clamp(life * 1.2, 0, 1);
        ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot);
        ctx.fillStyle = '#A9E7FA'; ctx.beginPath();
        ctx.moveTo(0, -p.r); ctx.lineTo(p.r * 0.8, 0); ctx.lineTo(0, p.r); ctx.lineTo(-p.r * 0.8, 0); ctx.closePath(); ctx.fill();
        ctx.restore();
        return;
      }
      var R = p.r * (1 + (1 - life) * (p.swell || 1.6));
      var lobes = [[0, 0, 1], [-0.74, 0.2, 0.74], [0.76, 0.16, 0.7], [0.06, -0.52, 0.66]];
      ctx.globalAlpha = clamp(life * 1.15, 0, 1) * 0.94;
      ctx.save(); ctx.translate(p.x, p.y);
      ctx.fillStyle = 'rgba(112,168,218,0.7)'; ctx.beginPath();
      lobes.forEach(function (l) { ctx.moveTo(l[0] * R + l[2] * R + 2.4, l[1] * R); ctx.arc(l[0] * R, l[1] * R, l[2] * R + 2.4, 0, 6.2832); });
      ctx.fill();
      ctx.fillStyle = '#FFFFFF'; ctx.beginPath();
      lobes.forEach(function (l) { ctx.moveTo(l[0] * R + l[2] * R, l[1] * R); ctx.arc(l[0] * R, l[1] * R, l[2] * R, 0, 6.2832); });
      ctx.fill();
      ctx.restore();
    });
    ctx.globalAlpha = 1;
  }
  /* the crevasse's crack before it opens: the game's crack polyline */
  function avCrackPts() {
    var p = [], x = 0, y = 0;
    for (var i = 0; i < 6; i++) { x += (i % 2 ? 11 : -11) + rnd(-6, 6); y += 22; p.push({ x: x, y: y }); }
    return p;
  }
  /* THE AVALANCHE'S CLOCK, each frame of the run (avalanche.update) */
  function avUpdate(dt, t, him) {
    var A = S.av;
    avParts(dt);
    if (t >= AV_TOTAL) { A.trail = A.trail.filter(function (g) { return g.wx + g.w - S.worldX > S.cam.l - 400; }); return; }
    if (!A.started) {
      A.started = true;
      S.history.push({ event: 'avalanche', at: Math.round(S.clock) });
      kit('anticipate', { volume: 0.8, vary: 0 });
      avRumble();
      avShake(13, AV.roar + AV.sweep, AV.roar);
    }
    var q = clamp((t - AV.roar) / AV.sweep, 0, 1);
    if (q > 0 && q < 1 && t - A.puff > 55) {
      A.puff = t;
      var fx = him + rnd(-790, -210) + q * 300;
      avPoof(fx, SURFACE - rnd(0, 90), 2, 1.7);
      avChips(fx, SURFACE - rnd(10, 60), 1, -rnd(140, 320));
    }
    /* the path comes apart behind him, the whole way: a crevasse just behind his heels every
       so often, which cracks, yawns and slides away with the rest of the world */
    if (t < AV.roar + AV.sweep && t - A.gap > 620) {
      A.gap = t;
      A.trail.push({ wx: S.worldX + (him - avLead(t)) - 300, w: 190 + rnd(0, 120), born: t, pts: avCrackPts() });
      avCrack();
    }
    if (t > AV.roar * 0.55 && !A.squealed) { A.squealed = true; kit('squeak', { volume: 0.85, vary: 0.15 }); S.knock = Math.max(S.knock || 0, 0.65 * 34); }
    if (t > AV.roar && !A.roared) { A.roared = true; avCrack(); kit('swoosh', { volume: 0.9, vary: 0.1 }); avShake(6, 400); }
    if (t > AV.roar + AV.sweep * 0.45 && !A.cracked) { A.cracked = true; avCrack(); kit('boing', { volume: 0.5, vary: 0.2 }); }
    A.trail = A.trail.filter(function (g) { return g.wx + g.w - S.worldX > S.cam.l - 400; });
  }
  /* how far each trail crevasse has got: the crack, then the opening */
  function avGapState(g, t) {
    var age = t - g.born;
    return { crack: clamp(age / 260, 0, 1), open: clamp((age - 180) / 320, 0, 1) };
  }
  /* THE WALL ITSELF (avalanche.draw): a falling field of soft puffs gated on a front that
     chases where he is drawn, streaks of snow carried down, and a haze over what it has taken */
  function drawAvalanche(ctx, t, him) {
    var roar = AV.roar, sweep = AV.sweep, settle = AV.settle, c = S.cam;
    if (t <= 0 || t >= AV_TOTAL) return;
    var rise = avEaseOut(clamp(t / (roar * 1.25), 0, 1));
    var fade = avEaseInOut(clamp((AV_TOTAL - t) / settle, 0, 1));
    var amp = Math.min(rise, fade);
    if (amp <= 0.01) return;
    var sec = t / 1000;
    var q = clamp((t - roar) / (sweep + settle), 0, 1);
    var front = Math.min(lerp(-620, him + 420, Math.pow(q, 0.8)), him - 340);
    var t0 = (window.performance && performance.now) ? performance.now() : 0;
    var puffs = Math.max(AV_MIN, Math.round(AV_N * avQuality));
    var top = Math.min(0, c.t);
    ctx.save();
    for (var i = 0; i < puffs; i++) {
      var a1 = avHash(i * 12.9898), a2 = avHash(i * 21.94 + 4.1), a3 = avHash(i * 29.67 + 9.7);
      var speed = 0.55 + a2 * 0.75;
      var ph = (sec * speed * 0.62 + a3) % 1;
      var y = top - 220 + ph * (H - top + 300) + Math.cos(sec * 1.9 + i * 0.7) * 18;
      var yFrac = clamp(y / H, 0, 1);
      var lean = (1 - yFrac) * 620;
      var back = a1;
      var x = front + lean - back * 920 + Math.sin(sec * 1.6 + i) * 26;
      var grow = Math.sin(clamp(ph, 0, 1) * Math.PI);
      var r = (58 + a2 * 74) * (0.45 + grow * 0.85);
      var body = clamp(back / 0.08, 0, 1) * clamp(1 - (back - 0.55) / 0.55, 0, 1);
      if (body <= 0.01) continue;
      var dens = amp * body * (0.52 + grow * 0.72) * (0.6 + a1 * 0.5);
      if (dens <= 0.01) continue;
      var sh = ctx.createRadialGradient(x, y, 0, x, y, r);
      sh.addColorStop(0, 'rgba(196,219,238,' + (0.78 * dens).toFixed(3) + ')');
      sh.addColorStop(0.55, 'rgba(206,228,244,' + (0.46 * dens).toFixed(3) + ')');
      sh.addColorStop(1, 'rgba(206,228,244,0)');
      ctx.fillStyle = sh;
      ctx.beginPath(); ctx.arc(x, y, r, 0, 6.2832); ctx.fill();
      var lx = x - r * 0.26, ly = y - r * 0.3, lr = r * 0.78;
      var li = ctx.createRadialGradient(lx, ly, 0, lx, ly, lr);
      li.addColorStop(0, 'rgba(255,255,255,' + (0.92 * dens).toFixed(3) + ')');
      li.addColorStop(0.6, 'rgba(250,253,255,' + (0.38 * dens).toFixed(3) + ')');
      li.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = li;
      ctx.beginPath(); ctx.arc(lx, ly, lr, 0, 6.2832); ctx.fill();
    }
    ctx.lineCap = 'round';
    var streaks = Math.round(AV_STREAKS * (puffs / AV_N));
    for (var j = 0; j < streaks; j++) {
      var b1 = avHash(j * 7.13), b2 = avHash(j * 3.71 + 2.2);
      var sp = (sec * (1.5 + b2 * 1.4) + b1) % 1;
      var sy = top - 140 + sp * (H - top + 220);
      var sx = front + (1 - clamp(sy / H, 0, 1)) * 620 - b1 * 900;
      var len = 34 + b2 * 62;
      var al = amp * 0.62 * Math.sin(clamp(sp, 0, 1) * Math.PI) * clamp(1 - b1 / 0.85, 0, 1);
      if (al <= 0.02) continue;
      ctx.strokeStyle = 'rgba(255,255,255,' + al.toFixed(3) + ')';
      ctx.lineWidth = 2 + b2 * 3;
      ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(sx + len * 0.55, sy + len); ctx.stroke();
    }
    ctx.restore();
    if (t0) {
      var cost = performance.now() - t0;
      if (cost > AV_BUDGET_MS) avQuality = Math.max(AV_MIN / AV_N, avQuality * 0.8);
      else if (cost < AV_BUDGET_MS * 0.5) avQuality = Math.min(1, avQuality * 1.04);
    }
    /* the haze over the ground it has already taken, behind the front only */
    ctx.save();
    ctx.globalAlpha = amp * 0.8 * clamp((t - roar * 0.4) / roar, 0, 1);
    var hx = clamp(front, c.l - 400, c.l + c.w + 400);
    var veil = ctx.createLinearGradient(hx - 1500, 0, hx + 60, 0);
    veil.addColorStop(0, 'rgba(238,248,255,0.88)');
    veil.addColorStop(0.62, 'rgba(238,248,255,0.42)');
    veil.addColorStop(1, 'rgba(238,248,255,0)');
    ctx.fillStyle = veil;
    ctx.fillRect(c.l - 20, c.t - 20, c.w + 40, c.h + 40);
    ctx.restore();
  }

  var SW = window.SWIFTEE || null;
  var BIRD_CLIPS = ['flying', 'flapping', 'blinking', 'curious', 'talk_start', 'talking', 'talk_stop', 'happy_start', 'happy'];
  var REQUIRED = ['sky', 'path', 'capL', 'capR', 'run', 'skid', 'tremble', 'bird:flying', 'bird:blinking', 'bird:talking'];

  var S = null;          // the run on screen, or null
  var last = null;       // what the last run left behind, for state()
  var loading = null;    // the preload, shared by every caller
  var art = {};          // loaded images, by name
  var bytes = {};        // fetched audio, by name
  var ctxHint = null;    // the lesson's AudioContext, when it was handed over early
  var ctxSource = null;  // or where to get it (useAudio): the lesson's, unlocked by the story's Play
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

  /* Load everything the scene draws and says. Called once the story is playing (see
     watchStory), so it is all in by the time the story ends. The Part 2 game's own frame
     is not asked for here: the lesson loads it on its completion screen. */
  function preload(opts) {
    if (!enabled) return Promise.resolve(false);
    if (opts && opts.audioContext) ctxHint = opts.audioContext;
    if (loading) return loading;
    var hd = pickHd();
    loading = versions().then(function (V) {
      var jobs = [];
      var add = function (key, url) { jobs.push(loadImg(url).then(function (im) { art[key] = im; })); };
      add('sky', gameUrl(V, 'assets/sky/01-dawn.webp'));   // the game opens at dawn
      add('path', gameUrl(V, 'assets/env/path.webp'));
      add('capL', gameUrl(V, 'assets/env/cap-l.webp'));
      add('capR', gameUrl(V, 'assets/env/cap-r.webp'));
      add('rock', gameUrl(V, 'assets/env/rock-band.webp'));
      ['run', 'skid', 'tremble'].forEach(function (k) {
        add(k, gameUrl(V, 'assets/char/' + (hd ? 'hd/' : '') + 'mammoth-' + k + '.webp'));
      });
      if (SW && SW.clips) BIRD_CLIPS.forEach(function (c) { if (SW.clips[c]) add('bird:' + c, SW.clips[c].image); });
      if (document.fonts && document.fonts.load) jobs.push(document.fonts.load('600 46px Fredoka').catch(noop));
      LINES.concat(ENDING).forEach(function (l) {
        var take = lessonTake(l);
        if (take) bytes[l.id] = fetchBytes(window.polygonAudioSrc ? window.polygonAudioSrc(take.src) : take.src);
      });
      Object.keys(SFX).forEach(function (k) { bytes[k] = fetchBytes(gameAudioUrl(V, SFX[k].src)); });
      return Promise.all(jobs).then(function () {
        art.hd = hd;
        if (art.path) { art.tileA = pathTile(art.path, false); art.tileB = pathTile(art.path, true); }
        if (art.capL) art.capLf = fadedCap(art.capL, 'l');
        if (art.capR) art.capRf = fadedCap(art.capR, 'r');
        return REQUIRED.every(function (k) { return !!art[k]; });
      });
    });
    return loading;
  }

  /* ----------------------------------------------------------------- sound */
  function openAudio(given) {
    var ctx = given || ctxHint, own = false;
    if ((!ctx || ctx.state === 'closed') && ctxSource) { try { ctx = ctxSource(); } catch (e) { ctx = null; } }
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
    var takes = LINES.concat(ENDING).filter(function (l) { return l.take; }).map(function (l) { return l.id; });
    versions().then(function () { takes.concat(Object.keys(SFX)).forEach(function (name) {
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
    root.setAttribute('aria-label', 'Help Momo: he reaches the broken path');

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

    /* the Part 1 buttons kit's gold pill (styles/buttons-kit.css): the kit's blue one is the
       colour of the ice and the water behind it here, and all but disappeared into them */
    var next = el('button', 'kit-btn kit-btn--primary bridge-next', root);
    next.type = 'button';
    next.hidden = true;
    next.disabled = true;
    next.innerHTML = '<span>Next</span><span class="chev" aria-hidden="true">&#9654;</span>';

    /* the story's dark, which the scene comes up out of and goes back into for the lesson */
    var dusk = el('div', 'bridge-dusk', root);
    dusk.setAttribute('aria-hidden', 'true');

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

  /* The sky, which never moves, drawn once per size into a canvas the size of the
     screen: the game's rect, scaled about the middle of the walking line only as far as
     it takes to reach every edge of the view above the water. The sea below it is drawn
     each frame, on the game's wave (drawDeepWater). */
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
    var k = c.dpr * c.s, sh = avShakeOffset();
    ctx.setTransform(k, 0, 0, k, (sh.x - c.l) * k, (sh.y - c.t) * k);
    var wx = S.worldX, x0 = HOLE_WX - wx, x1 = x0 + GAP, t = S.clock / 1000;
    var holeSeen = x0 < c.l + c.w + CAP.w * CAP_S && x1 > c.l - CAP.w * CAP_S;
    var crack = holeSeen ? ditchPath(x0, x1) : null;
    /* the avalanche's trail: each crevasse as wide as it has opened, at 24 px steps */
    var runT = S.momo && S.momo.mode === 'run' ? S.clock - S.momo.t0 : Infinity;
    var trail = S.av.trail.map(function (g) {
      var st = avGapState(g, runT), cx = g.wx + g.w / 2 - wx, w = Math.round(g.w * st.open / 24) * 24;
      return { cx: cx, crack: st.crack, open: st.open, pts: g.pts, x0: cx - w / 2, x1: cx + w / 2, path: w >= 24 ? ditchPath(cx - w / 2, cx + w / 2) : null };
    });
    var cuts = trail.filter(function (g) { return g.path; }).map(function (g) { return g.path; });
    if (crack) cuts.push(crack);
    // the game's own order (game/js/engine.js, the frame's ground pass)
    trail.forEach(function (g) { if (g.path) { drawDitch(ctx, g.x0, g.x1, g.path, t); drawWaterFront(ctx, g.x0, g.x1, g.path, t); } });
    if (crack) { drawDitch(ctx, x0, x1, crack, t); drawWaterFront(ctx, x0, x1, crack, t); }
    drawPath(ctx, wx, cuts, t);
    drawRiverLife(ctx, t);
    trail.forEach(function (g) {
      if (g.path && g.open > 0.25) drawLips(ctx, g.x0, g.x1);
      if (g.crack > 0 && g.open < 0.9) {
        ctx.save();
        ctx.strokeStyle = 'rgba(20,70,120,0.85)'; ctx.lineWidth = 4; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(g.cx, SURFACE - 4);
        for (var i = 0; i < g.pts.length; i++) { if ((i + 1) / g.pts.length > g.crack) break; ctx.lineTo(g.cx + g.pts[i].x, SURFACE - 4 + g.pts[i].y); }
        ctx.stroke(); ctx.restore();
      }
    });
    if (crack) drawLips(ctx, x0, x1);
    drawMomo(ctx);
    if (runT < AV_TOTAL + 1200) { drawAvParts(ctx); drawAvalanche(ctx, runT, S.pose ? S.pose.x : MOMO_X); }
    drawBird(ctx);
  }

  /* The path, A A' A A', and the sea under it, cut by the crevasse's outline where the
     break is: the game's GroundManager.draw, with the same even-odd clip, so the lips
     are the only edge the path has and the sea never paints into the crevasse (the
     crevasse draws its own stretch of the same water). */
  function drawPath(ctx, wx, cuts, t) {
    var c = S.cam, from = c.l - 20, to = c.l + c.w + 20;
    ctx.save();
    if (cuts && cuts.length) {
      var p = new Path2D();
      p.rect(from - 200, TILE_Y - 40, to - from + 400, Math.max(TILE_H + 80, c.t + c.h + 80 - TILE_Y));
      cuts.forEach(function (cut) { p.addPath(cut); });
      ctx.clip(p, 'evenodd');
    }
    drawDeepWater(ctx, t);
    if (!art.tileA) { ctx.restore(); return; }
    for (var k = Math.floor((from + wx) / TILE_W); k * TILE_W - wx < to; k++) {
      ctx.drawImage((k & 1) ? art.tileB : art.tileA, Math.round(k * TILE_W - wx), TILE_Y, TILE_W, TILE_H);
    }
    ctx.restore();
  }
  /* ============ THE CREVASSE AND THE WATER, AS THE GAME DRAWS THEM ============
     Ported from game/js/engine.js (GroundManager: _profile, _ditchPath, _backArt,
     _wallArt, waterY, drawDitch, drawWaterFront, drawDeepWater, drawRiverLife), with
     the game's own numbers, for a plain break: no plug, no notch, the neck as wide as
     the hole. The one change is the extent: the game fills its 1920 x 1080 stage, and
     this scene can show more than that on a wide or an upright screen, so the fills
     run to the edges of the camera instead. Read the game's comments there for why
     each layer is what it is; keep the two in step. */
  var THROAT = 36;                    // CFG.levelOne.throatDepth
  function ditchProfile() {
    if (S.prof) return S.prof;
    var seed = Math.abs(Math.round(HOLE_WX)) % 9973 + 17;
    var rnd = function () { seed = (seed * 9301 + 49297) % 233280; return seed / 233280; };
    var N = 22, top = [];
    for (var i = 0; i <= N; i++) {
      var u = i / N, edge = Math.min(u, 1 - u);
      top.push({ u: u, dy: edge < 0.05 ? -3 - rnd() * 4 : -9 + rnd() * 7 });
    }
    var wall = function () {
      var out = [];
      for (var j = 0; j <= 12; j++) {
        var v = j / 12;
        out.push({ v: v, f: v < 0.02 || v > 0.98 ? 0 : Math.sin(v * Math.PI) * (0.05 + rnd() * 0.06) + (rnd() - 0.5) * 0.07 });
      }
      return out;
    };
    S.prof = { top: top, L: wall(), R: wall() };
    return S.prof;
  }
  /* No more than a dozen cached walls (a resize makes new ones): the oldest go first. */
  function keepWall(key, art) {
    S.walls[key] = art;
    var keys = Object.keys(S.walls);
    for (var i = 0; i < keys.length - 40; i++) delete S.walls[keys[i]];   // the avalanche's opening gaps come in many widths
    return art;
  }
  function ditchBottom() { var c = S.cam; return Math.max(H + 80, c.t + c.h + 80); }
  function ditchPath(x0, x1) {
    var pr = ditchProfile(), w = x1 - x0, y0 = SURFACE, yB = ditchBottom(), span = yB - y0;
    var tv = span > 0 ? (THROAT + 60) / span : 0, p = new Path2D(), i;
    p.moveTo(x0, y0 + pr.top[0].dy);
    for (i = 0; i < pr.top.length - 1; i++) {
      var a = pr.top[i], b = pr.top[i + 1], ax = x0 + w * a.u, bx = x0 + w * b.u;
      p.quadraticCurveTo(ax, y0 + a.dy, (ax + bx) / 2, y0 + (a.dy + b.dy) / 2);
    }
    var last = pr.top[pr.top.length - 1];
    p.lineTo(x0 + w * last.u, y0 + last.dy);
    p.lineTo(x1, y0);
    p.lineTo(x1, y0 + THROAT);
    pr.R.forEach(function (q) { if (q.v > tv) p.lineTo(x1 - w * q.f, y0 + span * q.v); });
    p.lineTo(x1, yB);
    p.lineTo(x0, yB);
    for (i = pr.L.length - 1; i >= 0; i--) { var q = pr.L[i]; if (q.v > tv) p.lineTo(x0 + w * q.f, y0 + span * q.v); }
    p.lineTo(x0, y0 + THROAT);
    p.lineTo(x0, y0);
    p.closePath();
    return p;
  }
  function waterY(x, t) {
    return WATER + Math.sin(x * 0.028 + t * 1.7) * 2.4 + Math.sin(x * 0.0105 - t * 1.05) * 1.7;
  }
  /* the far wall, cached: the rock band tiled across the interior at 0.72 of the lips'
     scale, alternate rows mirrored, pushed back into the blue and darker with depth */
  function backArt(ww) {
    var band = art.rock;
    if (!band || ww < 8) return null;
    var Hh = Math.round(ditchBottom() - 20 - SURFACE);
    ww = Math.max(8, Math.round(ww / 48) * 48);
    S.walls = S.walls || {};
    var key = 'back:' + ww + ':' + Hh;
    if (S.walls[key]) return S.walls[key];
    var cv = document.createElement('canvas');
    cv.width = ww + 16; cv.height = Hh;
    var g = cv.getContext('2d');
    g.imageSmoothingEnabled = true; g.imageSmoothingQuality = 'high';
    var seed = 4241, rnd = function () { seed = (seed * 9301 + 49297) % 233280; return seed / 233280; };
    var k = 0.72 * CAP_S, bw = band.naturalWidth || band.width, bh = band.naturalHeight || band.height;
    var rowH = Math.max(20, Math.round(bh * k)), rowW = Math.round(bw * k);
    for (var y = -Math.round(rnd() * rowH), row = 0; y < Hh; y += rowH - 4, row++) {
      for (var x = -Math.round(rnd() * rowW); x < cv.width; x += rowW - 4) {
        g.save();
        if (row & 1) { g.translate(cv.width, 0); g.scale(-1, 1); g.drawImage(band, cv.width - x - rowW, y, rowW, rowH); }
        else g.drawImage(band, x, y, rowW, rowH);
        g.restore();
      }
    }
    g.globalCompositeOperation = 'source-atop';
    g.fillStyle = 'rgba(12,44,80,0.78)'; g.fillRect(0, 0, cv.width, Hh);
    var dk = g.createLinearGradient(0, 0, 0, Hh);
    dk.addColorStop(0, 'rgba(4,18,40,0.3)'); dk.addColorStop(0.55, 'rgba(4,18,40,0.6)'); dk.addColorStop(1, 'rgba(4,18,40,0.9)');
    g.fillStyle = dk; g.fillRect(0, 0, cv.width, Hh);
    g.globalCompositeOperation = 'source-over';
    return keepWall(key, { canvas: cv, w: cv.width, h: Hh });
  }
  /* one side wall, cached: the rock band down the side at the lips' scale, its inner edge
     wandering between 70% and 100% of the width on curves, darker with depth */
  function wallArt(side, ww) {
    var band = art.rock;
    if (!band) return null;
    var Hh = Math.round(ditchBottom() + 20 - SURFACE);
    ww = Math.max(8, Math.round(ww / 24) * 24);
    S.walls = S.walls || {};
    var key = side + ':' + ww + ':' + Hh;
    if (S.walls[key]) return S.walls[key];
    var cv = document.createElement('canvas');
    cv.width = ww + 12; cv.height = Hh;
    var g = cv.getContext('2d');
    g.imageSmoothingEnabled = true; g.imageSmoothingQuality = 'high';
    var seed = side === 'l' ? 1301 : 7727, rnd = function () { seed = (seed * 9301 + 49297) % 233280; return seed / 233280; };
    var k = CAP_S, bw = band.naturalWidth || band.width, bh = band.naturalHeight || band.height;
    var rowH = Math.max(24, Math.round(bh * k)), rowW = Math.round(bw * k);
    for (var y = -Math.round(rnd() * rowH * 0.5), row = 0; y < Hh; y += rowH - 6, row++) {
      var sx = Math.round(rnd() * Math.max(0, rowW - cv.width - 8));
      g.save();
      if (row & 1) { g.translate(cv.width, 0); g.scale(-1, 1); }
      g.drawImage(band, -sx, y, rowW, rowH);
      g.restore();
    }
    g.globalCompositeOperation = 'destination-in';
    g.beginPath();
    g.moveTo(0, -60);
    var px = ww * (0.7 + 0.3 * rnd()), py = -60;
    g.lineTo(px, py);
    for (var yy = 0; yy <= Hh + 60; yy += 56) {
      var nx = ww * (0.7 + 0.3 * rnd());
      g.quadraticCurveTo(px, (py + yy) / 2, (px + nx) / 2, yy);
      px = nx; py = yy;
    }
    g.lineTo(px, Hh + 60);
    g.lineTo(0, Hh + 60);
    g.closePath();
    g.fill();
    g.globalCompositeOperation = 'source-atop';
    var dk = g.createLinearGradient(0, 0, 0, Hh);
    dk.addColorStop(0, 'rgba(6,26,52,0.10)'); dk.addColorStop(0.4, 'rgba(6,26,52,0.32)'); dk.addColorStop(1, 'rgba(6,26,52,0.82)');
    g.fillStyle = dk; g.fillRect(0, 0, cv.width, Hh);
    g.globalCompositeOperation = 'source-over';
    return keepWall(key, { canvas: cv, w: cv.width, h: Hh });
  }
  /* THE INSIDE OF THE CREVASSE: the body of the crack, the far wall under the lip's
     shadow, the side walls, the mist, the wall light, and the melt pool. */
  function drawDitch(ctx, x0, x1, crack, t) {
    var w = x1 - x0, bottom = ditchBottom();
    ctx.save();
    ctx.clip(crack);
    var g1 = ctx.createLinearGradient(0, SURFACE - 20, 0, WATER);
    g1.addColorStop(0, '#0E3358'); g1.addColorStop(0.40, '#123F69'); g1.addColorStop(0.82, '#1C5F8E'); g1.addColorStop(1, '#2A7BA8');
    ctx.fillStyle = g1; ctx.fillRect(x0 - 6, SURFACE - 40, w + 12, WATER - SURFACE + 60);
    var back = backArt(Math.round(w / 24) * 24);
    if (back) {
      ctx.drawImage(back.canvas, 0, 0, back.w, back.h, Math.round(x0 - 8), SURFACE - 24, Math.round(w + 16), back.h);
      var sh = ctx.createLinearGradient(0, SURFACE - 24, 0, SURFACE + 70);
      sh.addColorStop(0, 'rgba(3,16,38,0.72)'); sh.addColorStop(1, 'rgba(3,16,38,0)');
      ctx.fillStyle = sh; ctx.fillRect(x0 - 8, SURFACE - 24, w + 16, 94);
    }
    var wallW = Math.round(Math.min(150, Math.max(56, w * 0.38)));
    var wl = wallArt('l', wallW), wr = wallArt('r', wallW);
    if (wl && wr) {
      var top = SURFACE - 14;
      ctx.drawImage(wl.canvas, Math.round(x0 - 10), top);
      ctx.save();
      ctx.translate(Math.round(x1 + 10), 0);
      ctx.scale(-1, 1);
      ctx.drawImage(wr.canvas, 0, top);
      ctx.restore();
    }
    var mist = ctx.createLinearGradient(0, WATER - 150, 0, WATER + 10);
    mist.addColorStop(0, 'rgba(176,222,246,0)'); mist.addColorStop(0.7, 'rgba(176,222,246,0.28)'); mist.addColorStop(1, 'rgba(196,232,250,0.5)');
    ctx.fillStyle = mist; ctx.fillRect(x0 - 8, WATER - 150, w + 16, 160);
    var lightW = Math.max(120, w * 0.42);
    [0, 1].forEach(function (side) {
      var ex = side ? x1 : x0, dir = side ? -1 : 1;
      var wg = ctx.createLinearGradient(ex, 0, ex + dir * lightW, 0);
      wg.addColorStop(0, 'rgba(176,230,251,0.60)'); wg.addColorStop(0.45, 'rgba(150,216,246,0.22)'); wg.addColorStop(1, 'rgba(126,200,238,0)');
      ctx.fillStyle = wg;
      ctx.fillRect(side ? x1 - lightW : x0, SURFACE - 20, lightW, WATER - SURFACE + 40);
    });
    // the melt pool: the same body, reflection and streaks as the sea, on the same wave
    var body = ctx.createLinearGradient(0, WATER, 0, H + 40);
    body.addColorStop(0, '#2E9FC9'); body.addColorStop(0.30, '#1B7BA8'); body.addColorStop(1, '#0C4A70');
    ctx.save();
    var surf = new Path2D();
    surf.moveTo(x0 - 6, waterY(x0 - 6, t));
    for (var px = x0 - 6; px <= x1 + 6; px += 10) surf.lineTo(px, waterY(px, t));
    surf.lineTo(x1 + 6, bottom);
    surf.lineTo(x0 - 6, bottom);
    surf.closePath();
    ctx.clip(surf);
    ctx.fillStyle = body;
    ctx.fillRect(x0 - 8, WATER - 10, w + 16, bottom - WATER + 20);
    var refl = ctx.createLinearGradient(0, WATER, 0, WATER + 46);
    refl.addColorStop(0, 'rgba(196,236,252,0.46)'); refl.addColorStop(1, 'rgba(174,224,248,0)');
    ctx.fillStyle = refl; ctx.fillRect(x0 - 8, WATER, w + 16, 46);
    ctx.fillStyle = 'rgba(226,248,255,0.20)';
    for (var i = 0; i < 4; i++) {
      var sx = x0 + ((i * 0.3129 + t * 0.05) % 1) * w, sy = WATER + 14 + i * 13;
      ctx.beginPath(); ctx.ellipse(sx, sy, 34 - i * 5, 2.2, 0, 0, 6.2832); ctx.fill();
    }
    ctx.restore();
    ctx.restore();
  }
  /* the pool's surface: the bright meniscus along the wave, and ice flecks bobbing on it */
  function drawWaterFront(ctx, x0, x1, crack, t) {
    var w = x1 - x0;
    ctx.save();
    ctx.clip(crack);
    ctx.save();
    ctx.strokeStyle = 'rgba(240,253,255,0.98)';
    ctx.lineWidth = 4.5; ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(x0 - 6, waterY(x0 - 6, t));
    for (var px = x0 - 6; px <= x1 + 6; px += 10) ctx.lineTo(px, waterY(px, t));
    ctx.stroke();
    ctx.restore();
    ctx.fillStyle = 'rgba(240,252,255,0.85)';
    for (var i = 0; i < 5; i++) {
      var fx = x0 + ((i * 0.417 + t * 0.028) % 1) * w, fy = waterY(fx, t) - 2;
      ctx.beginPath(); ctx.ellipse(fx, fy, 9 - i, 3.2, Math.sin(t + i) * 0.15, 0, 6.2832); ctx.fill();
    }
    ctx.restore();
  }
  /* THE SEA under the shelf: the same lake the crevasse holds, on the same wave */
  function drawDeepWater(ctx, t) {
    var c = S.cam, l = c.l - 10, r = c.l + c.w + 10, bottom = ditchBottom();
    ctx.save();
    var surf = new Path2D();
    surf.moveTo(l, waterY(l, t));
    for (var px = l; px <= r; px += 10) surf.lineTo(px, waterY(px, t));
    surf.lineTo(r, bottom);
    surf.lineTo(l, bottom);
    surf.closePath();
    ctx.clip(surf);
    var body = ctx.createLinearGradient(0, WATER, 0, H + 40);
    body.addColorStop(0, '#2E9FC9'); body.addColorStop(0.30, '#1B7BA8'); body.addColorStop(1, '#0C4A70');
    ctx.fillStyle = body;
    ctx.fillRect(l, WATER - 10, r - l, bottom - WATER + 20);
    var refl = ctx.createLinearGradient(0, WATER, 0, WATER + 46);
    refl.addColorStop(0, 'rgba(196,236,252,0.46)'); refl.addColorStop(1, 'rgba(174,224,248,0)');
    ctx.fillStyle = refl;
    ctx.fillRect(l, WATER, r - l, 46);
    ctx.fillStyle = 'rgba(226,248,255,0.20)';
    for (var i = 0; i < 9; i++) {
      var sx = l + ((i * 0.3129 + t * 0.05) % 1) * (r - l), sy = WATER + 14 + (i % 4) * 13;
      ctx.beginPath(); ctx.ellipse(sx, sy, 34 - (i % 4) * 5, 2.2, 0, 0, 6.2832); ctx.fill();
    }
    ctx.restore();
  }
  /* the river lives: a fish now and then under the surface, and bubbles rising */
  function drawRiverLife(ctx, t) {
    var c = S.cam, l = c.l, wdt = c.w, band = H - WATER;
    if (WATER > H) return;
    ctx.save();
    var period = 9.5, u = (t % period) / period;
    if (u < 0.42) {
      var dir = Math.floor(t / period) % 2 ? -1 : 1;
      var fx = dir > 0 ? l - 60 + (u / 0.42) * (wdt + 120) : l + wdt + 60 - (u / 0.42) * (wdt + 120);
      var fy = WATER + band * 0.58 + Math.sin(t * 6) * 3;
      ctx.save(); ctx.translate(fx, fy); ctx.scale(dir, 1);
      ctx.fillStyle = 'rgba(8,52,84,0.55)';
      ctx.beginPath(); ctx.ellipse(0, 0, 22, 8, 0, 0, 6.2832); ctx.fill();
      var flick = Math.sin(t * 14) * 4;
      ctx.beginPath(); ctx.moveTo(-18, 0); ctx.lineTo(-32, -8 + flick); ctx.lineTo(-32, 8 + flick); ctx.closePath(); ctx.fill();
      ctx.fillStyle = 'rgba(200,240,255,0.7)'; ctx.beginPath(); ctx.arc(10, -2, 1.8, 0, 6.2832); ctx.fill();
      ctx.restore();
    }
    ctx.fillStyle = 'rgba(226,248,255,0.55)';
    for (var i = 0; i < 5; i++) {
      var ph = (t * 0.35 + i * 0.23) % 1;
      var bx = l + ((i * 0.41 + 0.07) % 1) * wdt + Math.sin(t * 2 + i) * 6, by = H - ph * band;
      ctx.beginPath(); ctx.arc(bx, by, 1.6 + (1 - ph) * 2.2, 0, 6.2832); ctx.fill();
    }
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
      var wx = worldAt(t), lead = avLead(t) - (S.knock || 0);
      if (t < RUN_END) {
        var dist = wx + (x - m.from);
        return { sheet: 'run', f: Math.floor(dist / RUN.stride * RUN.frames) % RUN.frames, x: x + lead, wx: wx, mark: x };
      }
      var u = clamp((t - RUN_END) / SKID.slide, 0, 1);
      return { sheet: 'skid', f: Math.min(SKID.frames - 1, Math.floor(u * SKID.frames)), x: x + lead, wx: wx, mark: x };
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
    if (m.mode === 'hold') {
      var br = S.reduced ? 0 : Math.sin(t / 1000 * HOLD.rate) * clamp(t / HOLD.easeIn, 0, 1);
      return { sheet: 'tremble', f: HOLD.frame, x: MOMO_X, breath: br };
    }
    return { sheet: m.sheet || 'tremble', f: m.f || 0, x: MOMO_X };
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
    /* the game's breath on a held pose, about the foot line: up as it rises, narrower as
       it grows, the way a chest does */
    var br = p.breath || 0;
    ctx.save();
    if (br) {
      var sq = 1 + br * HOLD.grow, sqX = (1 - br * HOLD.narrow) / Math.sqrt(sq);
      ctx.translate(p.x, SURFACE - br * HOLD.lift);
      ctx.scale(sqX, sq);
      ctx.translate(-p.x, -SURFACE);
    }
    drawCell(ctx, p.sheet, p.f, p.x, 1);
    if (p.bu > 0) drawCell(ctx, p.sheet, p.bf, p.x, p.bu);
    ctx.restore();
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
    if (S.knock > 0) S.knock = Math.max(0, S.knock - dt / 1000 * 34 * 3.1);
    var pose = momoPose(), m = S.momo;
    if (m.mode === 'run') {
      S.worldX = pose.wx;
      avUpdate(dt, S.clock - m.t0, pose.x);
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
    return Promise.all([waitMs(T.dusk), withTimeout(loading || preload(), T.loadCap)])
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

  /* THE ENDING'S RUN. The scene comes up out of the dark already at the break: Momo holding
     at the edge, breathing, Swiftee standing beside him, turned to him. She says her line, word
     by word with her voice, gives a small happy beat, and the line stays up to be read; then
     `said` settles and the lesson brings the game up over the scene (it closes the scene once
     the game is on screen). No Next: nothing here takes a tap. Its phases:
       LESSON_COMPLETE  the lesson's last quiz is done and asked for the scene
       ENDING_ENTER     the scene comes up out of the dark, at the break
       ENDING_LINE      her line
       ENDING_READ      it stays up to be read
       TRANSITION_TO_GAME  `said` has settled: the game takes the screen from here */
  function runEnding(gen) {
    phase('ENDING_ENTER');
    return Promise.all([waitMs(T.dusk), withTimeout(loading || preload(), T.loadCap)])
      .then(guard(gen, function (r) {
        if (!r[1]) {
          // no art: the scene goes, and the lesson says the line itself (finishLesson)
          S.history.push({ event: 'fallback', reason: 'art', at: Math.round(S.clock) });
          var said = S.resolveSaid; S.resolveSaid = null;
          destroy();
          if (said) said(false);
          return new Promise(noop);
        }
        openAtBreak();
        return waitMs(T.endingIn);
      }))
      .then(guard(gen, function () { phase('ENDING_LINE'); birdSet(birdPose('talking'), 120); return say(ENDING[0], false); }))
      .then(guard(gen, function () {
        var stop = art['bird:talk_stop'] ? [birdSeg('talk_stop', SW.clips.talk_stop.frames)] : [];
        var happy = birdPose('happy');
        birdSet(stop.concat(happy.length ? happy : birdPose('blinking')), 120);
        phase('ENDING_READ');
        return waitMs(T.read);
      }))
      .then(guard(gen, function () { phase('TRANSITION_TO_GAME'); if (S.resolveSaid) S.resolveSaid(true); }));
  }
  function openAtBreak() {
    S.open = true;
    document.documentElement.setAttribute('data-bridge', 'on');
    S.root.classList.add('is-open');
    S.worldX = worldAt(STOP_AT);
    S.momo = { mode: 'hold', t0: S.clock, from: MOMO_X };
    S.pose = null;
    var b = S.bird;
    b.on = true; b.standing = true; b.flip = true; b.alpha = 1; b.rot = 0;
    b.cx = PERCH; b.cy = standCy();
    birdSet(birdPose('blinking'));
  }

  /* The scene starts under the dark, the lesson underneath stops painting, and the dark
     clears on Momo already running. */
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
    }).then(function () { S.momo = { mode: 'hold', t0: S.clock, from: MOMO_X }; });   // the same frame: no hand-over
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
      .then(function () { return waitMs(T.lineGap); })
      .then(function () { return say(LINES[2], true); })
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
      var at = line.take ? clip(line.id, 0, line.dur, 1, 0.02) : null;
      var c0 = S.clock, ctx = S.audio && S.audio.ctx;
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
  /* The lesson takes the screen: the scene fades back to the story's dark and goes, and the
     lesson comes up out of the same dark (src/intro/opening.js waits on the promise this
     settles). */
  function handOff(reason) {
    if (!S || S.handedOff) return;
    S.handedOff = true;
    S.history.push({ event: 'handoff', reason: reason, at: Math.round(S.clock) });
    phase('LESSON_START');
    S.root.classList.add('is-leaving');
    waitMs(S.reduced ? 200 : T.leave).then(destroy, destroy);
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
      mode: opts.ending ? 'ending' : 'story',
      reduced: reducedMotion(), phase: opts.ending ? 'LESSON_COMPLETE' : 'STORY_COMPLETE', history: [], waiters: [], listeners: [],
      worldX: 0, momo: null, pose: null, hand: null, bird: { on: false, alpha: 1, rot: 0 }, knock: 0,
      av: { started: false, puff: 0, gap: -9999, trail: [], parts: [], shakes: [], squealed: false, roared: false, cracked: false },
      speak: null, sayBox: null, audio: null, sounds: []
    };
    S.history.push({ event: 'phase', phase: S.phase, at: 0 });
    S.done = new Promise(function (resolve) { S.resolveDone = resolve; });
    S.said = new Promise(function (resolve) { S.resolveSaid = resolve; });
    if (opts.ending && opts.ending.text) ENDING[0].text = opts.ending.text;
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
    if (S.mode === 'ending') runEnding(gen); else run(gen);
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
    last = { gen: S.gen, mode: S.mode, phase: S.phase, history: S.history, sounds: S.sounds, handedOff: S.handedOff, listeners: 0 };
    var resolve = S.resolveDone, said = S.resolveSaid;
    S = null;
    if (said) said(false);
    if (resolve) resolve(true);
  }

  function phaseNow() {
    return S ? S.phase : last ? last.phase : (enabled ? 'IDLE' : 'OFF');
  }

  /* THE STORY'S HAND-OVER. The opening (src/intro/opening.js) calls this when the story
     hands over, and starts when it settles: the scene plays if the story did (skipped with
     Escape counts, left out by the address or in an automated browser does not), and the
     promise settles once Next has been pressed and the scene has gone. With ?bridge=1 it is
     the scene that opened the page. */
  function afterStory() {
    if (!enabled) return Promise.resolve(false);
    if (autostart) return S ? S.done : last ? Promise.resolve(true) : start({});
    var st = null;
    try { st = window.StoryIntro && window.StoryIntro.state ? window.StoryIntro.state() : null; } catch (e) {}
    if (!st || !(st.active || st.lastRun)) return Promise.resolve(false);
    preload();
    return start({});
  }
  /* Load the scene while the story plays, once it has started (its own art and voice are in
     by then), so it is ready when the story ends. */
  function watchStory() {
    var tries = 0;
    (function poll() {
      var st = null;
      try { st = window.StoryIntro && window.StoryIntro.state ? window.StoryIntro.state() : null; } catch (e) {}
      if (!st || !st.active) return;                       // no story: no scene to get ready
      if (st.playing) { preload(); return; }
      if (++tries < 2400) setTimeout(poll, 500);
    })();
  }

  /* THE LESSON'S ENDING: the scene once more, for Swiftee's last line (runEnding). Resolves
     once the line has been said and read; the scene stays up until close(), so the game's
     curtain comes up over it rather than over the lesson. */
  function ending(opts) {
    if (!enabled || !document.body) return Promise.resolve(false);
    if (S) destroy();
    start({ ending: opts || {} });
    return S ? S.said : Promise.resolve(false);
  }
  function close() { if (S && S.mode === 'ending') destroy(); }

  window.BridgeStory = {
    enabled: enabled,
    autostart: autostart,
    preload: preload,
    start: start,
    afterStory: afterStory,
    ending: ending,
    close: close,
    /* The lesson says where its AudioContext is, so the scene speaks through it. */
    useAudio: function (source) { ctxSource = typeof source === 'function' ? source : null; },
    /* For the tests: where the story is, what has happened, and what is on screen. */
    state: function () {
      var src = S || last || {};
      var out = {
        enabled: enabled, autostart: autostart, active: !!S, phase: phaseNow(), mode: src.mode || null,
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
        out.voiceDecoded = !!(S.audio && LINES.every(function (l) { return !l.take || S.audio.buf[l.id]; }));
        out.decoded = S.audio ? Object.keys(S.audio.buf) : [];
        out.momo = S.pose ? { mode: S.momo.mode, sheet: S.pose.sheet, frame: S.pose.f, x: Math.round(S.pose.x), mark: Math.round(S.pose.mark != null ? S.pose.mark : S.pose.x) } : null;
        out.avalanche = { started: S.av.started, trail: S.av.trail.length, parts: S.av.parts.length };
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
    /* The numbers this scene takes from the game, for the check that they still agree,
       and the lesson line that follows them. */
    lines: LINES.filter(function (l) { return !l.lesson; }).map(function (l) { return { id: l.id, text: l.text, at: l.at, dur: l.dur, words: l.words.slice() }; }),
    lessonLines: LINES.filter(function (l) { return l.lesson; }).map(function (l) { return { id: l.id, text: l.text, dur: l.dur, words: l.words.slice(), src: l.take ? l.take.src : null }; })
  };

  if (autostart) {
    var go = function () { preload(); start({}); };
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', go, { once: true });
    else go();
  } else if (enabled) {
    /* after the story's own start-up (story-intro.js is earlier on the page) */
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', watchStory, { once: true });
    else watchStory();
  }
})();
