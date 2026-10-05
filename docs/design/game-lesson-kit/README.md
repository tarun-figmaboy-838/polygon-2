# Game ↔ Lesson Kit: the screens before and after the learning section

How Polygon Adventure wraps its lesson in its game, so you can do the same in another game.

1. **Before the lesson**, the game opens the experience. It plays its own cover and tutorial up to a problem, then stops. A character flies in over the frozen game and says why the learner has to learn first. Snow blows across, and the game fades away onto the lesson.
2. **After the lesson**, the game comes back by itself. At the same kind of problem, the character flies in again, and then the game asks its first question.

Open `index.html` in this folder for the storyboard: every screen in order, with its line and timing. The screenshots are in `screens/`.

Everything here describes the files as they run in this project on 1 October 2026. The source of truth is the code; the file paths below are relative to the project root.

---

## 1. The sequence

### Before the lesson (the opening)

| # | Screen | What is said | Who | Moves on |
|---|---|---|---|---|
| 1 | The game's cover: banner and **Play** (Play is held until the art has loaded) | — | — | the learner presses Play |
| 2 | The game's opening avalanche; Momo starts to run | — | — | by itself |
| 3 | Momo lit, the world frozen | "This is Momo. He needs to find his friend." | narrator (game voice) | 1 s after the line ends |
| 4 | Momo lit | "Help Momo cross the Frozen Pass!" | narrator | 1 s after the line |
| 5 | The rock lit | "Watch out!" | narrator | 1 s after the line |
| 6 | The line in the middle of the stage | "Tap to jump over obstacles." | narrator | **waits for the jump** (if it never comes, Momo bumps the rock and runs on) |
| 7 | Momo stops at the edge; the hole lit | "Oh no! The path is broken." | narrator | 1 s after the line; then the game **holds its world still** |
| 8 | Swiftee flies in from the top right with the game's whoosh, and lands on the far edge of the hole, facing Momo | — | — | 1.4 s flight |
| 9 | Swiftee looks at the broken path | — | — | 0.4 s + 1.3 s |
| 10 | Swiftee, in her dialogue box | "Momo needs your help." | Swiftee | 1 s after the line |
| 11 | Swiftee | "But to help Momo, you need to learn about polygons." | Swiftee | 1 s after the line |
| 12 | Snow blows across; Swiftee flies off to the left; the game's music fades | — | — | 0.42 s |
| 13 | Under the snow, the game fades away onto the lesson. The lesson's Swiftee is already flying in to her rock | — | — | 1.3 s fade |
| 14 | Lesson screen 1 | "Look! A point." | Swiftee | the lesson runs |

There is no Play screen, no blank or white screen, and no curtain between 7 and 14.

### After the lesson (the return)

| # | Screen | What is said | Who | Moves on |
|---|---|---|---|---|
| 1 | The recap (screen 41). The game starts loading here, invisibly | (the recap) | Swiftee | the recap's Next |
| 2 | The quizzes, then the last screen, already in the game's world: the board goes, the game's daylight fades in (0.9 s, `assets/images/end-world.webp`, the game's renderer at its first ditch, `npm run build:end-world`), and Swiftee lands on the ice path | "Now you know everything about polygons. You are ready to help Momo." | Swiftee, lesson bubble | 1.3 s after the line, once the game's art is in |
| 3 | The screen dims to the game's night blue; the game appears and starts by itself, with no cover and no Play | — | — | 0.34 s + 0.58 s |
| 4 | The game's avalanche, then the run; the rock is jumped with **no tutorial** | — | — | by itself |
| 5 | Momo stops at the first ditch, and the game holds still | — | — | — |
| 6 | Swiftee flies in, lands, and looks | — | — | 1.4 s + 1.7 s |
| 7 | Swiftee | "Now let's help Momo." | Swiftee | 1 s after the line; then she flies off to the right (0.95 s) |
| 8 | The plank | "Use the right piece to fix the path." | narrator | by itself |
| 9 | The plank asks the question | "Cut the TRIANGLE." | narrator | the learner cuts a rope |
| 10 | The right cut | "Perfect fit! Keep going!" | narrator | the game plays on to its seven crossings |

---

## 2. How it is built

```text
 index.html (the lesson page)                         game/index.html (in an <iframe>)
 ─────────────────────────────                        ────────────────────────────────
 src/intro/opening.js      sequences the opening  ┐
 src/runner/runner-stage.js  owns both game frames, │   ?lesson=intro   cover + PLAY, tutorial 'intro' script,
                             the snow, the curtain  ├──     then holds still and says 'lesson'
 src/intro/swiftee-cameo.js  Swiftee over the game  │   ?cover=0&lesson=end   no cover, tutorial 'end' script:
 the lesson (index.html)     waits on Opening.gate  ┘       a host step at the ditch ('swiftee' / 'said')
```

The game always runs in an `<iframe>`, so its CSS, audio and URL flags never mix with the lesson's. Two separate loads are used:
- **The opening frame** (`?lesson=intro`) is the page itself at the start. It is taken off the page after the snow.
- **The return frame** (`?cover=0&lesson=end`) is loaded invisibly from the recap on, and is shown after the lesson's last line.

Swiftee is drawn by the lesson page **over** the frame, with the lesson's own sprite sheets, dialogue box and voice. Nothing of hers is added to the game; the game only stops and says where Momo and the hole are.

### The messages (`postMessage`, so they work off the disk too)

| From | Message | Meaning |
|---|---|---|
| game → page | `{ iceAge: 'ready' }` | the art is in (Play is live, or the hosted run can start) |
| game → page | `{ iceAge: 'play' }` | the learner pressed Play (opening) |
| game → page | `{ iceAge: 'running' }` | the hosted run has begun (return) |
| game → page | `{ iceAge: 'lesson', where }` | the opening's tutorial is done; the world is held still at the break |
| game → page | `{ iceAge: 'swiftee', id, where }` | the return's host step: the game is held at the ditch for Swiftee |
| page → game | `{ iceAge: 'begin' }` | start the hosted run (sent every 0.5 s until 'running'; it starts once) |
| page → game | `{ iceAge: 'said', id }` | Swiftee has spoken; go on to the plank |
| page → game | `{ iceAge: 'quiet' }` | fade the game's music (0.9 s) and suspend its audio: the lesson is taking over |
| page → game | `{ iceAge: 'dev-break' }` | review only (`?dev=1`): fast-forward to the break |

`where` is `{ head: {x, y}, lip: {x, y}, zoom, stage: {x, y, w, h} }`:
- `head` is the top of Momo's head, and `lip` is the far edge of the hole. Both are in the game's 1920 × 1080 stage, after its camera zoom.
- `stage` is where that stage sits in the frame, as fractions of the window.

Swiftee's size is `280 × zoom` stage px, and she lands `150 × zoom` stage px past `lip`.

### Audio

**The game's voice and music** are the game's own, inside the frame. The Play press unlocks them.

**Swiftee's voice and the lesson's voice** play through the lesson page's `AudioContext`:
- The opening forwards the learner's Play press from the frame to the lesson (`unlockAudio`), so that context is open without a tap of its own. Safari needs this, because it does not count a tap inside a frame as a tap on the page.
- Every line also has a **wall-clock backstop**: if the audio clock stops, the words still arrive and the line still ends on time.

**The lesson has its own music** (`src/lesson/lesson-music.js`, `assets/audio/music/lesson-music`). It fades in on screen 1 (2.2 s), dips under every voice, and fades out (1.2 s) as the game takes the screen.

---

## 3. Files to copy

### Page side (the lesson's page)

| File | What it does | Change for another game |
|---|---|---|
| `src/intro/opening.js` | The order: the game's opening, then the lesson. It hides the lesson from the first moment and releases `Opening.gate` | nothing |
| `src/runner/runner-stage.js` | Both frames, the cover-first opening (`opening`), the snow (`flurry`, `toLesson`), the return (`preload`, `start`), Swiftee's lines, and the review jumps | `GAME_URL`, `OPENING_LINES`, `DITCH_LINES`, the safety caps |
| `styles/runner-stage.css` | The frames, the curtain, the snowflakes, and Swiftee's box over the game | the night-blue `#0a2450` |
| `src/intro/swiftee-cameo.js` | Swiftee: the flight, the look, her box, her voice | `BIRD`, the perch offset, `FLY_IN`, `WATCH`, `HOLD`, the whoosh file |
| `src/fx/snowflake.js` | The snow crystals for the flurry | nothing |
| `src/lesson/swiftee-sheets.js`, `src/lesson/swiftee-flying.js`, `assets/swiftee/` | Swiftee's sprite sheets (flying, curious, talking, blinking) | your guide's sheets, same table shape |
| `styles/dialogue.css` | Her Part 1 dialogue box (`.comic-dialogue`, `.dialogue-box`, the tail) and the Fredoka face | nothing |
| `src/lesson/recorded-player.js`, `src/lesson/recordings.js` | Voice lookup by text (`PolygonRecordedVoice.find`) and the voice through the lesson's `AudioContext` | your catalogue rows |
| `src/lesson/lesson-music.js`, `assets/audio/music/` | The lesson's own music | your track |
| `src/lesson/screen-navigator.js` | `?dev=1`: one menu over the whole experience (Start 1–2, Screens 1–47, End 1–2) | your START / END entries |

**What the lesson has to provide** (in this project, `index.html`):
- `window.__poly` with `ac()` (its AudioContext, created on demand) and `unlockAudio()`.
- Its first screen runs only after `Opening.gate` resolves.
- `RunnerStage.preload()` is called when the recap starts.
- After the last line, call `startPart2()`, which calls `RunnerStage.start()` and stops the lesson's music.

**Script order in `<head>`:**
1. `snowflake.js`
2. `swiftee-sheets.js` and `swiftee-flying.js`
3. `recorded-player.js`, `recordings.js` and `lesson-music.js`
4. `opening.js`
5. `runner-stage.css` and `swiftee-cameo.js`
6. `runner-stage.js`

### Game side (inside the game)

The game here is the Frozen Rush runner (`game/`). These are the hooks it needs; port them into the other game's entry point and tutorial. The standalone game must behave exactly as before whenever no `?lesson` flag is present.

**`game/js/main.js`** (entry point):
```js
const lessonPart = params.get('lesson');                    // 'intro' | 'end' | null
if (lessonPart) ['tut-skip', 'btn-skip-end'].forEach(id => document.getElementById(id)?.remove());
const tellHost = (word, more) => window.parent !== window && window.parent.postMessage(Object.assign({ iceAge: word }, more || {}), '*');
const tutorialOptions = () => lessonPart === 'intro' ? { script: 'intro', holdAtEnd: true, onDone: t => tellHost('lesson', { where: t.where() }) }
                            : lessonPart === 'end'   ? { script: 'end', onHost: (id, where) => tellHost('swiftee', { id, where }) } : {};
window.addEventListener('message', e => {                   // only when lessonPart is set
  if (e.source !== window.parent || !e.data) return;
  if (e.data.iceAge === 'said' && tut) tut.didAction('host');
  if (e.data.iceAge === 'quiet') { game.fadeMusic(900); setTimeout(() => game.suspendAudio(), 1000); }
});
// the cover's PLAY: tellHost('play') first; onReady in the opening: tellHost('ready')
// ?cover=0 (hosted): no cover; wait for 'begin' / window.iceAgeBegin(), start once, then tellHost('running')
```

**`game/js/tutorial.js`** (the coach-mark layer):
- `new Tutorial(root, game, { script, holdAtEnd, onDone, onHost })`.
- `script: 'intro'` is the game's own first steps up to the break: meet, goal, rock, jump, gap. Each earlier step is `overtaken` once the break is reached, so a missed jump never stalls it.
- `script: 'end'` is three steps:
  - a **host step** at the break: `{ host: true, advance: 'host' }`. It stops the game, calls `onHost(id, where())` once, and lets go after 16 s if nobody answers;
  - the plank step, "Use the right piece to fix the path.";
  - the praise step, "Perfect fit! Keep going!".
- `holdAtEnd`: when the script finishes, keep the game paused instead of resuming it.
- `where()` returns Momo's head and the hole's far lip in stage space, after the zoom, plus the stage rect.
- `skipTo(id)` is review only: it jumps to a later step.

**`game/js/engine.js`**: one API addition, `fadeMusic(ms)`, which ramps the music bed to 0.

If the other game is a single bundle (`game.bundle.js` for `file://`), make every change in both the modules and the bundle.

---

## 4. Adapting it to another game, step by step

1. **Put the game in a frame.** It must be loadable twice:
   - `?lesson=intro`: its normal cover and Play;
   - `?cover=0&lesson=end`: no cover, and it waits for `begin`.
2. **Pick the break.** This is the moment the game cannot go on without the lesson (here, the first ditch). The opening's tutorial ends there, holding still. The return's host step stops there.
3. **Write the two scripts:**
   - the opening's steps up to the break;
   - the return's host step, then the game's first question, then its praise.
4. **Report positions.** The game's `where()` must give the character's head and the place the guide should land, in its stage space, after any camera zoom.
5. **Set the guide's lines** in `runner-stage.js` (`OPENING_LINES`, `DITCH_LINES`). Every line needs a take in the lesson catalogue (`recordings.js`: text, src, duration, word starts). A line marked `whenRecorded: true` is skipped until it has one.
6. **Match the colours.** The flurry needs no colour, but the curtain and the frame's background are the game's night blue.
7. **Test it** with the checks in section 7.

---

## 5. Timings (all in one place)

| Where | Value | File |
|---|---|---|
| The game's line hold | 1.0 s after each tutorial line (`READ_PAUSE`) | `game/js/tutorial.js` |
| Swiftee's flight in / out | 1.4 s / 0.95 s | `swiftee-cameo.js`: `FLY_IN`, `FLY_OUT` |
| Swiftee's look before speaking | `curious_start` (8 frames at 20 fps) + 1.3 s | `swiftee-cameo.js`: `WATCH` |
| After each Swiftee line | 1.0 s | `swiftee-cameo.js`: `HOLD` |
| Between her two lines | 0.26 s | `swiftee-cameo.js`: `BETWEEN` |
| A line with no take | 0.32 s a word | `swiftee-cameo.js`: `WORD` |
| A take that does not start | heard silently after 1.2 s | `swiftee-cameo.js`: `START_WAIT` |
| The snow before the fade | 0.42 s | `runner-stage.js`: `SNOW_LEAD` |
| The game fading onto the lesson | 1.3 s | `runner-stage.js`: `SNOW_FADE` |
| The game's music out | 0.9 s | `game/js/main.js` ('quiet') |
| The lesson's music in / out | 2.2 s / 1.2 s | `lesson-music.js`, `index.html` `startPart2` |
| The last line read before the game | 1.3 s | `index.html`: `END_READ` |
| The curtain to the game, and off it | 0.34 s, 0.58 s | `runner-stage.js`: `CURTAIN_IN`, `CURTAIN_OUT` |

**Safety nets, so nothing can stall:**

| Net | Value |
|---|---|
| No cover after | 45 s (`OPENING_LOAD_CAP`) |
| No hand-over after Play | 180 s (`OPENING_PLAY_CAP`) |
| A Swiftee visit | 20 s at most (`SWIFTEE_CAP`) |
| The game's host step | 16 s at most |
| The return's art | 20 s before starting anyway (`READY_CAP`) |
| Every voice | ends by its length plus 0.6 s, whatever the audio clock does |

---

## 6. Voice: lines nobody recorded whole

Every voice is recorded; there are no synthetic voices. Swiftee's three lines over the game are their own recording (`assets/audio/source/swiftee-lesson-5.mp3`, lines G1-G3 in the cue map). Until it arrived they were joined from her other recordings, which is the fallback for any line that was never recorded whole: it is **joined** from recorded words, in `docs/voice/cue-map.json` under `joins`, and built by `npm run build:recorded-voice`.

Each part names a recorded line and a run of its words. It can also give:
- `at`: exact cut times;
- `as`: the word it stands for on screen;
- `tempo`: a pitch-kept speed-up;
- `gap`: the silence before it.

The join still in use:

| Join | Line | Made from |
|---|---|---|
| tut-6b-piece | "Use the right piece to fix the path." | the game voice's own line, with "ice" cut out. It is joined onto the game's take after its own lines, so no existing window moves |

A recording of the whole line replaces its join. Record lines in one file and add them to the cue map.

---

## 7. Review and test

- **`?dev=1`:** the screen menu runs the whole experience: **Start** 1–2, **Screens** 1–47, **End** 1–2. Back and Next step through it, and the jump list goes anywhere. It sits above the game when the game is on screen.
  - The two Swiftee entries fast-forward the game to its break.
  - `?dev=1&devat=break` opens straight at Start 2.
- **`?intro=0`** skips the opening. **`?intro=1`** forces it in an automated browser, which skips it by default.
- **`tests/opening.test.cjs`** (`npm run test:opening`, 23 checks, Chromium and WebKit) is the specification. It checks:
  - the cover and Play, with no Skip buttons;
  - the tutorial's lines in order, and the stop at the break;
  - Swiftee's flight, landing, look and recorded lines;
  - the snow, the frame taken off, and the lesson heard with no tap, with its own music;
  - the return: the avalanche, nothing said until the ditch, Swiftee, then the plank and its question.
- **Also check by hand in Safari.** It is the strictest browser about audio.

### Checklist for a new game

- [ ] The game opened on its own is unchanged (no `?lesson`): the full tutorial, Skip, the cover.
- [ ] `?lesson=intro`: Play → tutorial → holds still at the break → `lesson` with `where`.
- [ ] `?cover=0&lesson=end`: starts on `begin`, once. Nothing is said before the break; the host step waits for `said`, then the question, then the praise.
- [ ] The guide lands on the right spot at every window size (the perch follows `where.lip` and `where.zoom`).
- [ ] Every guide line has a take (or `whenRecorded`), and its words appear as they are said.
- [ ] No blank screen anywhere; the snow hand-over is one continuous picture.
- [ ] Safari: the lesson's first line is heard with no tap after the game's Play.
