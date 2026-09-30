/* THE OPENING AVALANCHE.
 *
 * Momo is already running when the game starts and nothing ever said why. This does: a
 * wall of snow comes down the pass, he bolts ahead of it, and when it has spent itself
 * the tutorial begins on a character who is plainly escaping something.
 *
 * Entirely procedural — no new art, no new audio — so it costs a few hundred gradient
 * fills a frame and nothing to download.
 *
 * ------------------------------------------------------------------------------------
 * WHY IT IS BUILT THIS WAY. Each of these was a version that did not work.
 *
 * IT IS NOT A SHAPE. The first version drew a filled body with a wavy top edge and read
 * exactly as a cut-out sliding across the screen. Anything with a continuous silhouette
 * does: real snow has no outline, it has a DENSITY, and the eye knows the difference
 * immediately. So there is no polygon here at all — it is a field of soft radial puffs
 * falling from above the frame, each with its own size, speed and wobble, accumulating
 * into a mass wherever they crowd and fraying to nothing at the edges.
 *
 * IT ARRIVES. Spread evenly across the sky this was snowFALL: a curtain of weather with
 * no mass in it and nothing to run from. An avalanche has a LEADING EDGE, the bulk piles
 * up just behind it, and what it has already passed thins to haze. So the cloud is gated
 * on a front that sweeps across the pass. That one number is the whole difference
 * between weather and a wall, and it is the most important line in the file.
 *
 * IT CATCHES HIS HEELS AND NO MORE. A wave that closes over Momo hides the one thing the
 * shot is about and reads as him being buried rather than escaping. It closes to just
 * past his tail and stops there: he stays sharp, ahead of it, with clear ice in front of
 * him to run onto.
 *
 * NORMAL BLENDING, NOT ADDITIVE. Additive white over a bright sky can only get brighter,
 * so the cloud had no form — it washed the sky out and read as a lens flare. Snow has
 * SHADOW in it, so every puff is drawn twice: a cool grey-blue body and a white highlight
 * offset up-left of it. That is the cheapest way to give a soft mass a light direction,
 * and the only reason it reads as volume rather than haze.
 *
 * IT POURS FROM THE TOP rather than sliding in from the side — the direction snow comes
 * from, and the direction the mountains behind already lead the eye.
 *
 * DETERMINISTIC. Every puff's position is a function of its index and the state clock,
 * with no stored state and no particle pool. It costs one loop a frame, cannot leak, and
 * looks identical at any frame rate. Math.random() here would make the cloud BOIL rather
 * than fall, because every frame would re-roll every position.
 *
 * ------------------------------------------------------------------------------------
 * WIRING IT IN. Four edits to engine.js — see the note at the bottom of this file.
 */

/* THE THREE BEATS, in milliseconds. Under four seconds in total: long enough to read as
   an event, short enough that a child replaying the game is not made to sit through a
   film.
     roar   the low build before anything is visible: the ground shakes, snow lifts
     sweep  the wall crossing the screen, with Momo running ahead of it
     settle the dust falling out, the rumble dying, Momo easing back to his stride    */
export const AV = { roar: 900, sweep: 1900, settle: 1000 };
export const AV_TOTAL = AV.roar + AV.sweep + AV.settle;

/* MORE PUFFS, EACH FAINTER. At 132 the middle of the cloud saturated to flat white while
   the thin edges resolved into separate circles — the two ends of the same mistake. 210
   much fainter ones overlap enough to stay continuous where they crowd and stay soft
   where they do not. Drop to ~90 if a low-end phone drops frames here. */
const AV_N = 210;
const AV_STREAKS = 70;

/* AND THE COUNT LOOKS AFTER ITSELF, because the note above is a knob nobody will ever be
   in a position to turn: whoever has the low-end phone that drops frames here is not the
   person editing this file.
 *
 * Each puff is two radial gradients built and filled every frame, so 210 of them is 420
 * gradient fills — measured at 94ms a frame against 26ms for ordinary play on a machine
 * with no GPU. That is the opening costing three and a half times what the game costs,
 * during the one sequence that is supposed to feel fast.
 *
 * So the draw times itself and thins the cloud until it fits a budget, down to a floor
 * that still reads as a mass rather than as separate circles. It recovers upward just as
 * readily, so a machine that can afford the full cloud gets it. Puff positions are a
 * function of the INDEX, so dropping the tail drops a scattered subset of the field and
 * the cloud stays even — it thins, it does not shrink or shift.
 *
 * Nothing here changes what a puff looks like. It only changes how many there are, which
 * is the one dial the author left. */
const AV_MIN = 84;
const AV_BUDGET_MS = 7;          // what the opening may spend of a frame before it thins
let avQuality = 1;

const avClamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const avLerp = (a, b, t) => a + (b - a) * t;
const avEaseOut = t => 1 - Math.pow(1 - t, 3);
const avEaseInOut = t => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
/* A fixed identity per puff, derived from its index alone. */
const avHash = n => Math.abs((Math.sin(n) * 43758.5453) % 1);

/**
 * @param env everything this needs out of createGame's closure. All required:
 *   CFG, G, ground, particles, audio, mammoth
 *   quake(px, ms, delay)      the long ground rumble
 *   shake(px, ms)             the short punch
 *   makeCrack()               the crack polyline factory
 *   rand(a, b)
 *   setState(name)
 *   reduced()                 a FUNCTION, not a boolean, so it stays live if the user
 *                             changes the OS setting mid-session
 */
export function createAvalanche(env) {
  const { CFG, G, ground, particles, audio, mammoth,
          quake, shake, makeCrack, rand, setState, reduced } = env;

  /* ---------------------------------------------------------------- enter ---- */
  /* Goes in setState's switch, as `case 'AVALANCHE':`. */
  function enter() {
    G.moving = true; G.jumpEnabled = false; G.speedFactor = 1;
    G.avT = 0;
    G.avRoared = false; G.avPuff = 0; G.avCracked = false; G.avSquealed = false;
    G.avGap = -9999;                  // the first crevasse opens on the next tick
    G.avLead = 0;
    mammoth.setState('RUN');

    /* THE SOUND OF IT, and it is three things rather than one. `anticipate` is the rising
       tick before anything is visible — the cue that something is coming, which is what
       makes the first second tense instead of empty. The rumble is the body of it, and
       the music ducks hard underneath so the roar owns the beat. The comic beats come
       later, on the frames they belong to. */
    audio.kit('anticipate', { volume: 0.8, vary: 0 });
    audio.rumble();
    audio.setDuck(0.4);
    quake(reduced() ? 5 : 13, AV.roar + AV.sweep, AV.roar);
  }

  /* ----------------------------------------------------------------- exit ---- */
  /* Goes in `case 'RUN_SEGMENT_1':`, before whatever is already there. */
  function exit() {
    G.avT = 0;                        // the wall is gone; nothing left to draw
    G.avLead = 0;
    if (mammoth) mammoth.dx = 0;      // and he settles back to his mark
    /* AND THE TRAIL GOES WITH IT. The collapsing ice behind him is scenery for the
       opening and nothing else: left in ground.gaps it would still be there when the
       first crossing is laid out. The pruner only drops gaps behind the character —
       these are, but they would linger in the list for the whole run. */
    ground.gaps = ground.gaps.filter(g => !g.avalanche);
    audio.setDuck(1);
  }

  /* --------------------------------------------------------------- update ---- */
  /* Goes in update()'s switch, as `case 'AVALANCHE': { ... break; }`.
     Three beats on one clock. G.avT runs 0..1 across the whole thing. */
  function update() {
    const { roar, sweep } = AV;
    G.avT = avClamp(G.st / AV_TOTAL, 0, 1);

    /* HE RUNS FORWARD, OUT OF THE CORNER. He stands at CFG.mammothX for the whole game,
       which is right for a runner — the world scrolls past a fixed character — and wrong
       for this one shot: it pins him against the left edge with the thing chasing him
       squeezed into the quarter of the frame behind him, so there is no room for the
       avalanche to BE anything. He is carried forward to about a third of the way in
       while it lasts and eased back as it clears.

       A DRAW OFFSET AND NOTHING ELSE, the same rule the jump's forward lead follows. The
       collider, the crevasse layout and every distance in the game are still measured
       from CFG.mammothX; only the picture moves. */
    const inK = avEaseOut(avClamp(G.st / (roar + sweep * 0.5), 0, 1));
    const outK = avEaseInOut(avClamp((G.st - (roar + sweep)) / AV.settle, 0, 1));
    G.avLead = 300 * inK * (1 - outK);
    if (mammoth) mammoth.dx = G.avLead;

    /* SNOW REACHING THE GROUND. The cloud itself is a falling field (see draw); this is
       what it throws up where it lands, so the wave has a foot on the ice rather than
       floating over it. Throttled to one burst every 55ms so a fast machine does not turn
       it into a firehose. */
    const q = avClamp((G.st - roar) / sweep, 0, 1);
    if (!reduced() && q > 0 && q < 1 && G.st - (G.avPuff || 0) > 55) {
      G.avPuff = G.st;
      const fx = rand(-60, 520) + q * 300;
      particles.poof(fx, CFG.surfaceY - rand(0, 90), 2, 1.7);
      particles.chips(fx, CFG.surfaceY - rand(10, 60), 1, -rand(140, 320));
    }

    /* THE PATH COMES APART BEHIND HIM, the whole way. One crevasse scrolls off the left
       inside a second at running speed, so it has to be a TRAIL: a new one opens just
       behind his heels every so often, cracks, yawns and slides away with the rest of the
       world. What the shot says is that the ground he was on a moment ago is not there
       any more — he is running from the snow AND from the floor. */
    if (G.st < roar + sweep && G.st - (G.avGap || 0) > 620) {
      G.avGap = G.st;
      const back = G.worldX + CFG.mammothX - 300;
      const w = 190 + rand(0, 120);
      ground.addGap({
        /* CFG.levelOne rather than a passed-in L1: engine.js only ever binds L1 as a
           local inside the functions that need it, so there is nothing at createGame
           scope to hand over. */
        x0: back, x1: back + w, throat: Math.round(w / ((CFG.levelOne && CFG.levelOne.mouth) || 1.6)),
        open: 0, repaired: false, crack: 0, crackPts: makeCrack(),
        bridge: 0, splashes: null, slots: [], pieces: [], avalanche: true, born: G.st
      });
      audio.crack();
    }
    for (const g of ground.gaps) {
      if (!g.avalanche) continue;
      const age = G.st - (g.born || 0);
      g.crack = avClamp(age / 260, 0, 1);
      g.open = avClamp((age - 180) / 320, 0, 1);
    }

    /* THE COMEDY BEATS, each on the frame it belongs to rather than all at the start. The
       crack is the ground going; the squeak is Momo noticing; the whoosh is the wave
       itself passing. Spread out, they read as one event happening TO someone instead of
       a stack of sounds at the door. */
    if (G.st > roar * 0.55 && !G.avSquealed) {
      G.avSquealed = true;
      // he has just worked out what that noise was
      audio.kit('squeak', { volume: 0.85, vary: 0.15 });
      mammoth.jolt(reduced() ? 0.3 : 0.65);
    }
    if (G.st > roar && !G.avRoared) {
      G.avRoared = true;
      audio.crack();
      audio.kit('swoosh', { volume: 0.9, vary: 0.1 });
      shake(reduced() ? 2 : 6, 400);
    }
    if (G.st > roar + sweep * 0.45 && !G.avCracked) {
      G.avCracked = true;
      audio.crack();
      audio.kit('boing', { volume: 0.5, vary: 0.2 });   // the cartoon punctuation
    }

    if (G.st > AV_TOTAL) setState('RUN_SEGMENT_1');
  }

  /* ----------------------------------------------------------------- draw ---- */
  /* Call from render(), AFTER mammoth.draw and BEFORE atmos.drawFront — the wall has to
     be able to close around his heels, but the game's own snowfall belongs on top. */
  function draw(ctx) {
    if (G.state !== 'AVALANCHE') return;
    const { roar, sweep, settle } = AV;
    const t = G.st;

    /* The envelope: it builds as it comes over the ridge, holds through the sweep, and
       thins out as it spends itself. Nothing is ever switched on or off. */
    const rise = avEaseOut(avClamp(t / (roar * 1.25), 0, 1));
    const fade = avEaseInOut(avClamp((AV_TOTAL - t) / settle, 0, 1));
    const amp = Math.min(rise, fade);
    if (amp <= 0.01) return;

    const sec = t / 1000;

    /* WHERE THE LEADING EDGE HAS GOT TO. Nearly linear, and both easings were tried:
       eased IN it barely moved for the first second and the wall was still off the left of
       the frame when the beat was a third gone; eased OUT it was past Momo before he had
       taken a stride and stopped being a threat. A wave of snow travels at the speed it
       travels — the slight front-load is only so it does not start with a visible jerk.
       Timed to reach him at about 1.7s: plainly ahead of it, and plainly not by much. */
    const q = avClamp((t - roar) / (sweep + settle), 0, 1);

    /* IT CHASES WHERE HE IS DRAWN, not where his collider sits. He is carried forward to
       about a third of the frame while this lasts, which is the whole point — it opens up
       the space behind him for the wave to actually be something. Measured against his
       mark instead, the wall would stay pinned to the left edge with the room he just made
       sitting empty between them. */
    const him = CFG.mammothX + (G.avLead || 0);
    /* CLEAR OF HIS BODY, not of his MARK. mammothX is where the collider sits and the
       drawn character reaches about 220px behind it, so a front clamped 120 short of the
       mark is still a hundred pixels inside his hindquarters — which is exactly the "it
       covers Momo" this kept being reported as. 340 leaves daylight behind his tail. */
    const front = Math.min(avLerp(-620, him + 420, Math.pow(q, 0.8)), him - 340);

    /* How many of the field to draw this frame — see AV_MIN. Under reduced motion the cloud
       is held at the floor outright rather than measured up to it. */
    const t0 = (typeof performance !== 'undefined' && performance.now) ? performance.now() : 0;
    const puffs = reduced() ? AV_MIN : Math.max(AV_MIN, Math.round(AV_N * avQuality));

    ctx.save();
    for (let i = 0; i < puffs; i++) {
      const a1 = avHash(i * 12.9898);
      const a2 = avHash(i * 21.94 + 4.1);
      const a3 = avHash(i * 29.67 + 9.7);

      /* WHERE IT FALLS FROM, and how far down it has got. Each starts above the frame at
         its own moment and travels down-and-right, so the mass leans the way it is moving
         instead of dropping straight like weather. */
      const speed = 0.55 + a2 * 0.75;
      const phase = (sec * speed * 0.62 + a3) % 1;      // 0 at the ridge, 1 at the foot

      /* THE FRONT LEANS FORWARD AT THE TOP, which is both what an avalanche does and the
         only way this shot works. Momo runs at x 430 of a 1920 stage, so the ground behind
         him is a quarter of the frame: a vertical wall kept off him is a wall almost
         entirely off-screen, which is why it kept thinning to nothing. A real slide
         billows out ahead of its own foot — the cloud overruns the snow beneath it — so
         the leading edge runs far right up in the sky and tucks back behind his heels at
         ground level. He stays clear, the frame stays full. */
      const y = -220 + phase * (CFG.H + 300) + Math.cos(sec * 1.9 + i * 0.7) * 18;
      const yFrac = avClamp(y / CFG.H, 0, 1);
      const lean = (1 - yFrac) * 620;
      const back = a1;                                  // 0 = at the edge, 1 = far behind
      const x = front + lean - back * 920 + Math.sin(sec * 1.6 + i) * 26;   // turbulence

      // it fattens as it falls and thins again at the foot, so the mass has a shape
      const grow = Math.sin(avClamp(phase, 0, 1) * Math.PI);
      const r = (58 + a2 * 74) * (0.45 + grow * 0.85);

      /* DENSEST JUST BEHIND THE EDGE and thinning away back — a mountainside of snow
         rather than a breaking wave. The very front is slightly softer so the leading edge
         frays instead of ending on a line. A puff the front has not reached is not drawn
         at all; one just behind it is at full weight; further back it fades. */
      const body = avClamp(back / 0.08, 0, 1) * avClamp(1 - (back - 0.55) / 0.55, 0, 1);
      if (body <= 0.01) continue;
      const dens = amp * body * (0.52 + grow * 0.72) * (0.6 + a1 * 0.5);
      if (dens <= 0.01) continue;

      // the body: a cool grey-blue, so the mass has weight and does not blow out
      const sh = ctx.createRadialGradient(x, y, 0, x, y, r);
      sh.addColorStop(0, `rgba(196,219,238,${(0.78 * dens).toFixed(3)})`);
      sh.addColorStop(0.55, `rgba(206,228,244,${(0.46 * dens).toFixed(3)})`);
      sh.addColorStop(1, 'rgba(206,228,244,0)');
      ctx.fillStyle = sh;
      ctx.beginPath(); ctx.arc(x, y, r, 0, 6.2832); ctx.fill();

      // the lit crown, up and to the left, where the sun is
      const lx = x - r * 0.26, ly = y - r * 0.3, lr = r * 0.78;
      const li = ctx.createRadialGradient(lx, ly, 0, lx, ly, lr);
      li.addColorStop(0, `rgba(255,255,255,${(0.92 * dens).toFixed(3)})`);
      li.addColorStop(0.6, `rgba(250,253,255,${(0.38 * dens).toFixed(3)})`);
      li.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = li;
      ctx.beginPath(); ctx.arc(lx, ly, lr, 0, 6.2832); ctx.fill();
    }

    /* STREAKS OF SNOW BEING CARRIED DOWN, over the billows. The cloud alone reads as
       weather sitting still; these say which way it is going. Short, faint and steep,
       following the same down-and-right lean the puffs do, and hung off the same front so
       the snow is always inside the wall. */
    ctx.lineCap = 'round';
    // thinned with the cloud, so the two stay in proportion as the budget bites
    const streaks = Math.round(AV_STREAKS * (puffs / AV_N));
    for (let i = 0; i < streaks; i++) {
      const a1 = avHash(i * 7.13);
      const a2 = avHash(i * 3.71 + 2.2);
      const ph = (sec * (1.5 + a2 * 1.4) + a1) % 1;
      const sy = -140 + ph * (CFG.H + 220);
      const sx = front + (1 - avClamp(sy / CFG.H, 0, 1)) * 620 - a1 * 900;
      const len = 34 + a2 * 62;
      const al = amp * 0.62 * Math.sin(avClamp(ph, 0, 1) * Math.PI) * avClamp(1 - a1 / 0.85, 0, 1);
      if (al <= 0.02) continue;
      ctx.strokeStyle = `rgba(255,255,255,${al.toFixed(3)})`;
      ctx.lineWidth = 2 + a2 * 3;
      ctx.beginPath();
      ctx.moveTo(sx, sy);
      ctx.lineTo(sx + len * 0.55, sy + len);            // the lean, matching the billows
      ctx.stroke();
    }
    ctx.restore();

    /* WHAT THAT COST, AND WHETHER TO KEEP PAYING IT. Measured around the two loops above
       and nothing else, so the number is the cloud's own price and not the frame's. It
       falls fast and recovers slowly: a machine that cannot afford the full field should
       reach a size it can hold within a few frames of the wall appearing, and one that
       merely hiccuped should not spend the whole opening climbing back. */
    if (t0) {
      const cost = performance.now() - t0;
      if (cost > AV_BUDGET_MS) avQuality = Math.max(AV_MIN / AV_N, avQuality * 0.8);
      else if (cost < AV_BUDGET_MS * 0.5) avQuality = Math.min(1, avQuality * 1.04);
    }

    /* A HAZE OVER THE GROUND IT HAS ALREADY TAKEN. Not a hard front — a gradient that
       thins to nothing, so the ice behind the wave dims out rather than being cut off at a
       line. It sits BEHIND the front, not over the whole stage: washing everything evenly
       was the other half of why this read as weather. The ground Momo is running onto
       should be clear, and only what the wave has already taken is hidden. */
    ctx.save();
    ctx.globalAlpha = amp * 0.8 * avClamp((t - roar * 0.4) / roar, 0, 1);
    const hx = avClamp(front, -400, CFG.W + 400);
    const veil = ctx.createLinearGradient(hx - 1500, 0, hx + 60, 0);
    veil.addColorStop(0, 'rgba(238,248,255,0.88)');
    veil.addColorStop(0.62, 'rgba(238,248,255,0.42)');
    veil.addColorStop(1, 'rgba(238,248,255,0)');
    ctx.fillStyle = veil;
    ctx.fillRect(0, 0, CFG.W, CFG.H);
    ctx.restore();
  }

  return { enter, update, draw, exit };
}

/* ------------------------------------------------------------------------------------
 * WIRING IT IN — four edits to game/js/engine.js, inside createGame().
 *
 * 1. IMPORT AND BUILD IT, next to the other managers:
 *
 *      import { createAvalanche } from './avalanche.js';
 *      ...
 *      const avalanche = createAvalanche({
 *        CFG, G, ground, particles, audio, mammoth,
 *        quake, shake, makeCrack, rand, setState,
 *        reduced: () => reduced
 *      });
 *
 * 2. setState's switch — a new case, and one line in the existing RUN_SEGMENT_1 case:
 *
 *      case 'AVALANCHE': avalanche.enter(); break;
 *      case 'RUN_SEGMENT_1':
 *        avalanche.exit();          // <-- add this as the FIRST line of the case
 *        ...everything already there...
 *
 * 3. update()'s switch — a new case above RUN_SEGMENT_1:
 *
 *      case 'AVALANCHE': avalanche.update(); break;
 *
 * 4. render(), between `if (duo > 0) drawDuo(ctx, duo);` and `drawDazeStars(ctx);`
 *    (currently around line 9060) — after the character, before the front snow:
 *
 *      avalanche.draw(ctx);
 *
 * THEN THE ONE LINE THAT ACTUALLY OPENS ON IT. resetAll() ends with
 *
 *      setState('RUN_SEGMENT_1');
 *
 * and that becomes
 *
 *      setState('AVALANCHE');
 *
 * Lastly, RUN_STATES needs 'AVALANCHE' in it so the run systems tick during the opening
 * — but NOT jump input, which enter() disables with G.jumpEnabled = false. And
 * tools/build-bundle.mjs has to learn the new module, or the file:// build will still be
 * running the old nine.
 *
 * TUNING. Every number that matters is in AV at the top. The three beats are the ones to
 * reach for first: lengthening `sweep` gives the chase longer, lengthening `settle` lets
 * the dust hang. If it ever reads as covering Momo rather than chasing him, the number to
 * raise is the 340 in `front` — that is his clearance, and it is measured from his mark,
 * not from his drawn body.
 */
