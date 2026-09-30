/* ============================================================================
   MOMO + POLO STORY — scene data.

   Everything that makes one scene different from another lives here, so the
   controller in story-intro.js has no per-scene code. Coordinates are pixels
   on the 1980 x 1080 artwork (assets/story/scene-N.webp), so a glow or the
   speech balloon is placed by reading the position off the picture.

   The words appear in ONE box, a short part of the line at a time (the
   dialogue kit's story box, see story-intro.js): the box shows a part, the part
   is spoken, then it leaves and the next comes up in its place. The narrator's
   box is a storybook label with no tail; Momo and Polo speak in white bubbles
   whose tail points at whoever is talking.

   Per scene:
     image, speaker, text   the final art and the exact script line
     lines                  the script cut into single lines, shown and spoken
                            one after another. Joined with spaces they are
                            exactly `text` (the tests check this).
       line.focus           words shown in colour: momo | polo | gold |
                            action | good | worry
       line.gap             pause before this line, ms (lines after the first)
     box                    x = where the box is centred (on the speaker's side);
                            y = where the narrator's label is centred. tail = the
                            point a bubble's tail reaches (the top of the speaker's
                            head); the bubble hangs a short tail's length above it,
                            so its y is not needed. No tail for the narrator.
     feel                   shout: the box shakes; worry: it trembles
     voice                  prefix of the takes in window.STORY_VOICE (scene-N/1, /2, …)
     enter                  crossfade into this scene, ms
     boxAt, voiceAt         when the box appears and the first line is spoken,
                            ms from scene start
     hold                   how long the finished scene stays up, ms
     boxOut                 how quickly the box clears before the next scene
     camera                 one slow move: from/to {s scale, x, y}, origin, ms
     cues                   timed effects: at (ms from scene start), or line +
                            word (index) + offset (s). fx = glint | glow | light
                            | shake | shimmer | hearts | sweat | speed | lines
                            (comic emanata: short ink strokes round a point);
                            sfx = a sound
     snow, particles        the scene's weather and any local ice debris
     vignette               how much the picture's edges darken
     mood                   the music section that plays under the scene

   Golden ball positions (centre, radius) by scene, for continuity:
     2 (1210,895) r78   3 (1268,893) r70   4 (1068,728) r132
     5 (1045,735) r135  6 (985,660) r100   7 (390,427) r34
   ========================================================================= */
window.STORY_DATA = {
  width: 1980,
  height: 1080,
  imageBase: 'assets/story/',
  /* One music file with a section per mood (tools/story/build-story-music.cjs
     writes it and prints this table). Sections crossfade; looping ones loop
     seamlessly, `resolve` plays once to the end of the story. `level` is the
     bed under the voices; each mood's `gain` and `cutoff` shape it further. */
  music: {
    src: 'assets/audio/story/story-music',
    level: 0.12,
    sections: {
      warm:    { start: 0,  end: 24,   loop: true,  gain: 1,    cutoff: 12000 },
      playful: { start: 24, end: 36,   loop: true,  gain: 1,    cutoff: 12000 },
      tension: { start: 36, end: 48,   loop: true,  gain: 1.1,  cutoff: 9000 },
      hush:    { start: 48, end: 60,   loop: true,  gain: 0.7,  cutoff: 4200 },
      resolve: { start: 60, end: 76.5, loop: false, gain: 1,    cutoff: 12000 }
    }
  },

  scenes: [
    {
      id: 1, image: 'scene-1.webp', speaker: 'narrator', voice: 'scene-1',
      text: 'Long ago, Momo the mammoth and Polo the polar bear were best friends.',
      lines: [
        { text: 'Long ago,' },
        { text: 'Momo the mammoth and Polo the polar bear', gap: 300, focus: { Momo: 'momo', Polo: 'polo' } },
        { text: 'were best friends.', gap: 260, focus: { best: 'good', 'friends.': 'good' } }
      ],
      box: { x: 990, y: 112 },
      enter: 900, boxAt: 700, voiceAt: 900, hold: 1150, boxOut: 260,
      camera: { from: { s: 1.012, x: 6, y: 0 }, to: { s: 1, x: 0, y: 0 }, origin: [990, 560], ms: 8000 },
      cues: [
        { at: 0, sfx: 'ambience' },
        { line: 3, word: 1, offset: 0.1, fx: 'hearts', x: 1070, y: 450, sfx: 'hearts' }
      ],
      snow: { density: 0.6, speed: 0.55, wind: 0.25 },
      vignette: 0.12, mood: 'warm'
    },
    {
      id: 2, image: 'scene-2.webp', speaker: 'narrator', voice: 'scene-2',
      text: 'One day, Polo spotted something shiny beneath the ice.',
      lines: [
        { text: 'One day,' },
        { text: 'Polo spotted something shiny', gap: 280, focus: { Polo: 'polo', something: 'gold', shiny: 'gold' } },
        { text: 'beneath the ice.', gap: 240 }
      ],
      box: { x: 990, y: 112 },
      enter: 550, boxAt: 700, voiceAt: 860, hold: 950, boxOut: 240,
      /* A slow push toward Polo and the ball draws the eye down to it. */
      camera: { from: { s: 1, x: 0, y: 0 }, to: { s: 1.03, x: 0, y: -6 }, origin: [1110, 780], ms: 7500 },
      cues: [
        { at: 260, sfx: 'chime' },
        { at: 380, fx: 'glow', x: 1210, y: 895, r: 78, pulses: 2, ms: 2100 },
        { at: 520, fx: 'glint', x: 1242, y: 868, size: 70 },
        { line: 2, word: 3, offset: 0.05, fx: 'glint', x: 1188, y: 880, size: 56, sfx: 'sparkle' },
        { line: 2, word: 1, offset: 0, fx: 'lines', x: 1010, y: 300, from: -95, to: -15, r: 60, len: 46, count: 4 }
      ],
      snow: { density: 0.45, speed: 0.5, wind: 0.2 },
      vignette: 0.12, mood: 'warm'
    },
    {
      id: 3, image: 'scene-3.webp', speaker: 'polo', voice: 'scene-3',
      text: 'Momo, look! Something is buried here!',
      lines: [
        { text: 'Momo, look!', focus: { 'Momo,': 'momo', 'look!': 'action' } },
        { text: 'Something is buried here!', gap: 320, focus: { buried: 'gold' } }
      ],
      box: { x: 1330, y: 150, tail: [1262, 382] },
      enter: 550, boxAt: 820, voiceAt: 900, hold: 850, boxOut: 220,
      camera: { from: { s: 1.015, x: -8, y: 0 }, to: { s: 1, x: 0, y: 0 }, origin: [990, 620], ms: 6000 },
      cues: [
        { at: 420, fx: 'glint', x: 1296, y: 866, size: 64, sfx: 'sparkle' },
        { line: 1, word: 1, offset: 0, fx: 'lines', x: 1300, y: 440, from: -40, to: 40, r: 70, len: 44, count: 3 },
        { at: 420, fx: 'glow', x: 1268, y: 893, r: 70, pulses: 1, ms: 1800 }
      ],
      snow: { density: 0.45, speed: 0.5, wind: 0.2 },
      vignette: 0.12, mood: 'warm'
    },
    {
      id: 4, image: 'scene-4.webp', speaker: 'momo', voice: 'scene-4',
      text: 'Let us pull it out!',
      lines: [
        { text: 'Let us pull it out!', focus: { pull: 'action' } }
      ],
      box: { x: 540, y: 150, tail: [770, 268] },
      enter: 550, boxAt: 720, voiceAt: 800, hold: 900, boxOut: 220,
      camera: { from: { s: 1, x: 0, y: 0 }, to: { s: 1.02, x: 0, y: -4 }, origin: [1070, 700], ms: 5000 },
      cues: [
        /* The pulling effort: a 2px anticipation, never an earthquake. */
        { at: 320, sfx: 'effort' },
        { at: 360, fx: 'shake', amp: 2, ms: 340 },
        { at: 360, fx: 'lines', x: 1068, y: 728, from: 200, to: 340, r: 175, len: 50, count: 5 },
        { at: 400, fx: 'glow', x: 1068, y: 728, r: 132, pulses: 1, ms: 2200 },
        { line: 1, word: 4, offset: 0.35, sfx: 'effort' },
        { line: 1, word: 4, offset: 0.4, fx: 'shake', amp: 2, ms: 320 }
      ],
      snow: { density: 0.5, speed: 0.55, wind: 0.25 },
      particles: { kind: 'ice', x: 1068, y: 790, spread: 190, count: 14 },
      vignette: 0.13, mood: 'playful'
    },
    {
      id: 5, image: 'scene-5.webp', speaker: 'polo', voice: 'scene-5',
      text: 'Almost there! One more pull!',
      lines: [
        { text: 'Almost there!', focus: { 'there!': 'good' } },
        { text: 'One more pull!', gap: 420, focus: { 'pull!': 'action' } }
      ],
      box: { x: 1460, y: 140, tail: [1302, 368] },
      enter: 550, boxAt: 720, voiceAt: 800, hold: 850, boxOut: 220,
      camera: { from: { s: 1.01, x: 0, y: 0 }, to: { s: 1.03, x: 0, y: -4 }, origin: [1045, 735], ms: 5200 },
      cues: [
        { at: 240, sfx: 'crack-small' },
        { at: 280, fx: 'shake', amp: 1, ms: 300 },
        { at: 300, fx: 'shimmer', x: 1045, y: 800, spread: 260, count: 7, ms: 3200 },
        { at: 300, fx: 'glow', x: 1045, y: 735, r: 135, pulses: 2, ms: 1800 },
        /* The effort beat between the two lines, then a firmer pull. */
        { line: 2, word: 0, offset: -0.3, sfx: 'crack-small' },
        { line: 2, word: 0, offset: -0.28, fx: 'shake', amp: 3, ms: 380 },
        { line: 2, word: 0, offset: -0.28, fx: 'lines', x: 1045, y: 735, from: 190, to: 350, r: 180, len: 56, count: 6 }
      ],
      snow: { density: 0.5, speed: 0.6, wind: 0.3 },
      particles: { kind: 'ice', x: 1045, y: 800, spread: 230, count: 18 },
      vignette: 0.15, mood: 'playful'
    },
    {
      id: 6, image: 'scene-6.webp', speaker: 'momo', voice: 'scene-6',
      text: 'Uh-oh...',
      /* Let the child SEE the cracks and the faces first, then a pause, then
         the small, cautious line. */
      lines: [
        { text: 'Uh-oh...', focus: { 'Uh-oh...': 'worry' } }
      ],
      box: { x: 420, y: 150, tail: [596, 264] },
      feel: 'worry',
      enter: 550, boxAt: 1330, voiceAt: 1430, hold: 1000, boxOut: 160,
      camera: { from: { s: 1, x: 0, y: 0 }, to: { s: 1.015, x: 0, y: 0 }, origin: [985, 700], ms: 6500 },
      cues: [
        { at: 180, sfx: 'crack-rumble' },
        { at: 260, fx: 'shake', amp: 1.5, ms: 700 },
        { at: 200, fx: 'glow', x: 985, y: 660, r: 100, pulses: 1, ms: 2000 },
        { at: 700, fx: 'lines', x: 1296, y: 250, from: -140, to: -40, r: 50, len: 42, count: 3 },
        { at: 860, fx: 'sweat', x: 918, y: 244, size: 54 },
        { at: 900, sfx: 'whistle-down' }
      ],
      snow: { density: 0.35, speed: 0.45, wind: 0.2 },
      vignette: 0.2, mood: 'tension'
    },
    {
      id: 7, image: 'scene-7.webp', speaker: 'polo', voice: 'scene-7',
      text: 'Run!',
      /* The fastest beat: a short crossfade, a quick box, the voice right away. */
      lines: [
        { text: 'Run!', focus: { 'Run!': 'action' } }
      ],
      box: { x: 1650, y: 318, tail: [1522, 486] },
      feel: 'shout',
      enter: 340, boxAt: 230, voiceAt: 330, hold: 600, boxOut: 160,
      camera: { from: { s: 1.01, x: 0, y: 0 }, to: { s: 1.02, x: -8, y: 0 }, origin: [1200, 600], ms: 1050, ease: 'cubic-bezier(.2,.7,.3,1)' },
      cues: [
        { at: 0, sfx: 'crack-big' },
        { at: 0, fx: 'speed', count: 26 },
        { at: 140, sfx: 'whoosh' }
      ],
      snow: { density: 0.55, speed: 1.25, wind: 1.1 },
      particles: { kind: 'debris', x: 640, y: 600, spread: 330, count: 22 },
      vignette: 0.22, mood: 'tension'
    },
    {
      id: 8, image: 'scene-8.webp', speaker: 'momo', voice: 'scene-8',
      text: 'Polo!',
      /* Fast to still: a slower fade, almost no motion, time to see the gap. */
      lines: [
        { text: 'Polo!', focus: { 'Polo!': 'polo' } }
      ],
      box: { x: 704, y: 180, tail: [556, 300] },
      feel: 'shout',
      enter: 820, boxAt: 1350, voiceAt: 1450, hold: 1050, boxOut: 240,
      camera: { from: { s: 1, x: 0, y: 0 }, to: { s: 1.008, x: 0, y: 0 }, origin: [990, 540], ms: 7000 },
      cues: [
        { at: 0, sfx: 'hush' },
        { line: 1, word: 0, offset: 0.05, fx: 'lines', x: 612, y: 470, from: -35, to: 35, r: 40, len: 50, count: 3 }
      ],
      snow: { density: 0.14, speed: 0.35, wind: 0.1 },
      vignette: 0.28, mood: 'hush'
    },
    {
      id: 9, image: 'scene-9.webp', speaker: 'polo', voice: 'scene-9',
      text: 'Momo, keep going! I will find another way!',
      lines: [
        { text: 'Momo, keep going!', focus: { 'Momo,': 'momo', keep: 'good', 'going!': 'good' } },
        { text: 'I will find another way!', gap: 420, focus: { another: 'good', 'way!': 'good' } }
      ],
      box: { x: 1480, y: 160, tail: [1566, 410] },
      enter: 650, boxAt: 900, voiceAt: 1000, hold: 1250, boxOut: 280,
      /* A small drift toward Polo and a soft lift in the light on his side. */
      camera: { from: { s: 1, x: 0, y: 0 }, to: { s: 1.02, x: -6, y: 0 }, origin: [1600, 560], ms: 7000 },
      cues: [
        { at: 150, sfx: 'warm-cue' },
        { at: 300, fx: 'light', x: 1600, y: 560, r: 460, ms: 1600, amount: 0.16 },
        { line: 2, word: 3, offset: 0, fx: 'shimmer', x: 1450, y: 520, spread: 110, count: 5, ms: 1400 }
      ],
      snow: { density: 0.3, speed: 0.4, wind: 0.15 },
      vignette: 0.16, mood: 'resolve'
    }
  ]
};
