# Current story scene

The production lesson uses the supplied `assets/images/lesson-background.webp` background.

`styles/weather.css` adds 16 slow snow particles and six softly twinkling stars at
layer 5, behind the guide and learning surfaces. They cannot capture input. Small
screens use fewer particles; reduced motion hides snow and keeps stars static.

## Scene layout

- Left: Swiftee stays perched on the rock, with dialogue above her head. The bubble
  may use the whole clear strip beside the activity (see "The dialogue's room" below).
  Her horizontal center moves from stage x=192 to x=250 (30% farther right).
- Right: a quiet, pale activity surface preserves the existing 1570 × 701 logical
  learning area. Shape geometry and drag/drop coordinates use the same coordinate system.
- Dialogue has no name tag. It sizes itself to each complete passage, with a fixed
  tail aligned above the bird's head, 46px dark teal Nunito text, a 4px teal border, warm cream surface, and comfortable padding.
  The supplied `swiftee-bubble.html` provides the rounded rectangle, catch-light, soft glow, and curved SVG tail. The lesson keeps its own audio-driven word reveal and local font assets.
  The tail is filled across its join and stroked only on its free edges. `dialogueLayout()` controls the fixed gap, so longer text grows upward without moving the pointer toward the bird. In the centred boundary scene the same tail rotates toward Swiftee at the lower right.
  Empty game dialogue is hidden; `design/dialogue-bubble.html` previews the reusable empty shell.

## The dialogue's room

One rule places the bubble on every screen (`dialogueLayout()`, `fittedDialogue()`, the
`DIALOGUE` numbers in `index.html`), all in stage pixels, so it is the same at every window size:

- **Where it hangs.** Above Swiftee's crest with its tail pointing down at her, 20px clear of the
  44px tail; on the top-row screens (6, 7 and the two sorts) beside her, pointing across.
  Across, it is centred under her head wherever the strip allows.
- **How wide it may grow.** The clear strip it sits in: from the stage's 40px margin, or the
  board's rim, to where the screen's work begins, less a 32px clearance, and never wider than
  1040px. Where the work begins is the one number a screen supplies (`dialogueEdge()`), read
  from the same layout the screen draws from: the opening card, the figure or grid, screen 11's
  pentagon, screen 12's sockets, the end screen's grid, the two pentagons of the comparison.
- **Its size.** Measured once per chunk of the line, from the whole chunk, before its first
  word is spoken: the fewest lines the strip allows, then the narrowest width that still holds
  that many, so the lines are even and no word is left alone at the end. The text stays at 46px.
  The measuring copy is off screen, hidden and `aria-hidden`, and is removed at once.
- **While she speaks.** Words appear in the places they will keep. Nothing is measured again
  until the text, the fonts or the layout change, so the bubble does not resize, rewrap or move.
- The 47 steps, questions, correct answers, and recording text remain in `steps()`.
- Learning cards use `styles/cards.css`: a pale opaque center, soft inset rim,
  and low-contrast mountain silhouettes confined to the bottom corners.
  A teal outer stroke finishes the frame.
  The scenery scales with the card and never intercepts gameplay input.

## Introduction and progression

1. Background appears with the bird initially hidden.
2. At 80ms, the flapping sprite and 1400ms flight begin.
3. At 1480ms, she settles on the rock with a small snow puff.
4. At 1740ms, dialogue becomes eligible to appear; the bubble waits until text is ready.
5. Narration starts at 2200ms. Actual audio playback reveals the activity, with
   shape cards fading in 80ms apart. Autoplay failure leaves the activity hidden
   until a tap on the game retries narration; no voiceover button is shown.
6. Answer controls appear when narration finishes. Feedback keeps the existing
   controls visible while the normal interaction lock prevents repeated answers.

The bird stays on the rock for subsequent steps. New activity groups briefly reveal
their content in sequence; phases within an activity retain visual continuity.
The point-to-outline drawing intentionally precedes its explanatory narration.
Counting starts from the audio-start callback, and screen 25's readout shares the
side-marker count. Replay retains the current activity. Play again restarts the flight.

With reduced motion, Swiftee is already perched, the surface has no entrance fade,
and the existing teaching animations use their reduced-motion alternatives.

## Files to edit

The shared activity board uses `assets/images/instruction-board.webp` (the supplied filename)
through `styles/cards.css`. It renders as a continuous image with transparent-margin
compensation, replacing the former cream fill, teal border, and mountain silhouettes.
The existing board bounds and lesson-content positions are retained.

Screen 14 keeps all four comparison figures in one row, with Open/Closed badges
above and paired Straight / Curved buttons below each card, matching the supplied
layout. Correct answers stay checked; incorrect answers receive
boundary feedback and can be retried. `viewCompare` styles the choices, and `ddPick`
retains the narration gate and advances once all four answers are correct.

Screen 14 crossfades to `assets/backgound  02.png` over 1.2 seconds. The image is
preloaded and decoded before its persistent background layer becomes visible;
the original scenery remains beneath it to avoid a blank flash. The layer sits
below ambient snow and all activity content, and fades out when leaving Screen 14.
Reduced-motion settings use an immediate change. Board, dialogue, and controls
retain their positions throughout the background transition.

All text buttons use `.ice-button` in `styles/buttons.css`: an icy blue rim,
rounded amber-coral face, golden highlight, quiet gloss, and centered white Nunito lettering.
Outlined lettering stays distinct on the bright face. A raised blue base and a
short downward press make the controls feel tactile; green success and muted blue-gray
disabled faces retain the same shape. The screen navigator loads this stylesheet
inside its shadow root. Figure cards retain their light drawing surfaces.
`prepareControlBindings` applies the shared class to actions, choices, label chips,
and counters; `playwright-review.cjs` checks white text and label bounds on all screens.

- `index.html`: `BOARD`, `SAFE` and `GUIDE_BOX` position the scene.
- `enterScreen` controls the introduction; `storyVoiceStart` connects playback to content.
- `buildCard` adds short entrance fades without changing shape paths.
- `src/lesson/recorded-player.js` calls `storyVoiceStart` on actual playback.
- `tests/checks/check-dialogue-frame.cjs`, `check-dialogue-tail.cjs`, `check-dialogue-fit.cjs`, `check-scene-aspect.cjs`
  and the full playthrough (`playwright-game.cjs`) cover the scene across all 48 screens.

Runtime scripts and fonts ship in `assets/vendor/` and `assets/fonts/`. The opening
blizzard uses `src/intro/ice-intro.js` and `styles/ice-intro.css`; the bird entrance starts
after its gate resolves.
