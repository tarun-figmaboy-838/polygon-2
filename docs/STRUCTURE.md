# Find files and screen code

**The lesson lives in [index.html](../index.html)**: its template and one script with every screen. There are no separate screen files. Use your editor's Find command to jump to the names below.

The displayed screen number is the position in `steps()`, starting at 1. Internal IDs such as `S13` are lesson groups, not screen numbers: screens 24 and 25 both use `S13`.

## Which file should I edit?

| Change | File and search term |
|---|---|
| Screen heading, question, correct answer, or screen order | `index.html`: `steps()` |
| Shape size, position, labels, or screen-specific colours | `index.html`: see the screen map below |
| Compact opening cards and external answers | `index.html`: `ocBox`, `fitActivityPanel`, `exploreOutline` |
| Shared shape cards and outlines | `index.html`: `buildCard(o)` |
| Polygon label pill | `index.html`: `labelPill(text, top)` |
| Side / Vertex / Angle label colours | `index.html`: `labelTheme(name)` and the palette inside `viewParts` |
| Number input and Check behaviour | `index.html`: `counter(i, caption)`, `bump(i, d)`, `checkCount()` |
| Counting animation | `index.html`: `countSides(n, which)` |
| Shape coordinates | `src/lesson/polygon-data.js`: `FIG` |
| Narration playback and word timing | `src/lesson/recorded-player.js` |
| Narration catalogue and word timestamps | `src/lesson/recordings.js` |
| Screen jump menu | `src/lesson/screen-navigator.js` |
| Background, dialogue bubble, and bird landing | `index.html`: `BOARD`, `GUIDE_BOX`, `enterScreen`, `storyVoiceStart` (see [design/STORY_SCENE.md](design/STORY_SCENE.md)) |
| Blizzard timing, wind direction, storm strength | `styles/ice-intro.css`: the variables on `#ice-intro` |
| Blizzard snow, gust audio, lesson handoff | `src/intro/ice-intro.js`: `FIELDS`, `DUST`, `GAIN_CURVE`; the lesson's gate is `boot()` in `index.html` |
| Story lines, coloured words, balloon position and tail, effects, timing | `src/story/story-data.js` |
| Story look (balloon lettering, comic page and panel) | `styles/story-intro.css` |
| Story behaviour (sequencing, audio, effects) | `src/story/story-intro.js` |
| Swiftee's animation sheets | `tools/build-swiftee.cjs` (writes `assets/swiftee/` and `src/lesson/swiftee-sheets.js`) |
| The completion screen's Help Momo / Play again buttons | `index.html`: `viewEnd`, `startRunner` |
| The hand-off to the runner game: when it loads, the curtain, its URL flags | `src/runner/runner-stage.js`, `styles/runner-stage.css` |
| The runner game itself: its seven crossings, tutorial, art and sound | `game/js/engine.js`: `CFG.levelOne.phases`; `game/js/tutorial.js`; see [game/RUNNER.md](game/RUNNER.md) |

Narration text is matched to recordings by wording. When you change a spoken sentence, check its entry in `src/lesson/recordings.js` too.

## Start-up order

1. **The story.** `src/story/story-intro.js` shows its start card, plays on **Play**, and releases `StoryIntro.gate` when it ends or is skipped.
2. **The blizzard.** `src/intro/ice-intro.js` starts from that gate, plays for 5.8 s, and releases `IceIntro.gate`.
3. **The lesson.** `boot()` in `index.html` waits on `IceIntro.gate`, then runs screen 1.
4. **The Frozen Pass.** As screen 48 opens, `runStep` asks `src/runner/runner-stage.js` to preload the game (`game/index.html`) in an invisible frame; the screen's **Help Momo** button calls `RunnerStage.start()`, which hides the lesson and lifts a curtain on the game's cover. `?game=1` starts here directly; `?game=0` leaves this stage out.

Each overlay removes itself completely (DOM, timers, audio) when it finishes. The runner's frame stays up: its own **Play again** restarts the game.

## Screen map

All functions in this table are in `index.html`.

| Screen | Content | Internal ID / phase | Layout function |
|---|---|---|---|
| 1–5 | Point, drawing, boundary, open/closed question | `S1` | `viewS1` |
| 6–9 | Open/closed questions | `S2`–`S5` | `viewOC` |
| 10–15 | Open/closed and straight/curved comparison | `S6` | `viewCompare`, `cmpCards` |
| 16 | Find the polygon | `S7` | `viewTapOne`, `cmpCards` |
| 17 | POLYGON reveal | `S8` | `viewReveal` |
| 18 | Polygon definition and outline | `S9` | `viewBuild` |
| 19 | Select polygons | `S10` | `viewMulti` |
| 20 | Introduce Side | `S11`, `sides` | `viewParts` |
| 21 | Introduce Vertex | `S11`, `vertex` | `viewParts` |
| 22 | Introduce Angle | `S11`, `angle` | `viewParts` |
| 23 | Label polygon parts | `S12` | `viewLabels`, `labelTheme` |
| 24 | Enter the number of sides | `S13`, question | `viewCount`, `counter` |
| 25 | Animate counting five sides | `S13`, `five` | `viewCount`, `countSides` |
| 26–28 | Change shape / drag a vertex | `S14` | `viewDeform` |
| 29–30 | Before and after | `S15` | `viewBA` |
| 31–33 | Count again / still five / naming | `S16` | `viewBA` |
| 34–35 | Triangle / Quadrilateral | `S17` | `viewName` |
| 36 | Select quadrilaterals | `S18` | `viewMulti` |
| 37–40 | Pentagon / Hexagon / Heptagon / Octagon | `S19`–`S22` | `viewName` |
| 41 | Recall polygon names | `S23` | `viewRecall` |
| 42 | Summary: what a polygon is | `SUMMARY` | `viewSummary` |
| 43 | Select polygons | `C1` | `viewMulti` |
| 44 | Sort polygon / not polygon | `C2` | `viewSort` |
| 45 | Find the non-polygon | `C3` | `viewTapOne` |
| 46 | Select pentagons | `C4` | `viewMulti` |
| 47 | Sort hexagons / heptagons | `C5` | `viewSort` |
| 48 | Completion: Help Momo (the runner game) or Play again | `END` | `viewEnd`, `startRunner` |

## Other documents

- [design/](design/): the lesson scene notes, the button design, and the original bubble reference supplied for the story (`story-dialogue-box.png`).
- [voice/](voice/): the narration script and line exports for voice recording, the recordings manifest and transcript, and notes on word timing.
- [game/](game/): the runner game's own contract, animation and voice notes, as they came with it.
- [sfx.md](sfx.md): where the lesson's sound effects come from.
- [../tests/checks/README.md](../tests/checks/README.md): what each lesson check covers.
