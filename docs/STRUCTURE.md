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
| Screen jump menu and Back / Next (review only, shown with `?dev=1`) | `src/lesson/screen-navigator.js`; the story's Scenes menu is `mountNavigator` / `jumpTo` in `src/story/story-intro.js` |
| Background, dialogue bubble, and bird landing | `index.html`: `BOARD`, `GUIDE_BOX`, `enterScreen`, `storyVoiceStart` (see [design/STORY_SCENE.md](design/STORY_SCENE.md)) |
| Where Swiftee's bubble sits and how big it grows | `index.html`: `DIALOGUE`, `dialogueLayout`, `dialogueEdge`, `fittedDialogue` (see "The dialogue's room" in [design/STORY_SCENE.md](design/STORY_SCENE.md)) |
| Blizzard timing, wind direction, storm strength | `styles/ice-intro.css`: the variables on `#ice-intro` |
| Blizzard snow, gust audio, lesson handoff | `src/intro/ice-intro.js`: `FIELDS`, `DUST`, `GAIN_CURVE`; the lesson's gate is `boot()` in `index.html` |
| Story lines, coloured words, balloon position and tail, effects, timing | `src/story/story-data.js` |
| Story look (the narration label and speech bubbles, comic page and panel) | `styles/story-intro.css` |
| Story behaviour (sequencing, audio, effects) | `src/story/story-intro.js` |
| Swiftee's animation sheets | `tools/build-swiftee.cjs` (writes `assets/swiftee/` and `src/lesson/swiftee-sheets.js`) |
| The Help Momo scene between the story and the lesson (the Broken Path): timing, lines, layout, states | `src/bridge/bridge-story.js`, `styles/bridge-story.css` |
| When it plays: after the story, before the blizzard | `src/intro/ice-intro.js` `autostart`, `BridgeStory.afterStory` |
| The lesson's ending: its two lines, then the game's cover | `index.html`: `lessonComplete`, `queuePart2`, `startPart2` |
| The summary, the lesson's last screen (after the Part 1 Summary Kit): its ideas, its look, its states and timing | `index.html`: `summaryConcepts`, `startSummary`; `src/lesson/summary.js` (states at the top), `styles/summary.css`, `assets/ui/panel.webp`, `assets/images/summary-ice-vista.webp` |
| The hand-off to the runner game: when it loads, the curtain, its URL flags | `src/runner/runner-stage.js`, `styles/runner-stage.css` |
| The gold Play and the pill buttons (Next, Help Momo, Play again) | `styles/buttons-kit.css`, `src/fx/play-fx.js`, `assets/ui/`; in the lesson `pillBtn` / `pillWidth` in `index.html` |
| Momo's jump in the runner game (the 24-cell sheet) | `game/js/engine.js`: `sheets.jump`, `frames.jump`, the JUMP_START / JUMP_AIR / LAND cases in `PlayerController.draw` |
| The runner game itself: its seven crossings, tutorial, art and sound | `game/js/engine.js`: `CFG.levelOne.phases`; `game/js/tutorial.js`; see [game/RUNNER.md](game/RUNNER.md) |

Narration text is matched to recordings by wording. When you change a spoken sentence, check its entry in `src/lesson/recordings.js` too.

## Start-up order

1. **The story.** `src/story/story-intro.js` shows its start card, plays on **Play**, and releases `StoryIntro.gate` when it ends or is skipped. Once it is playing, `src/bridge/bridge-story.js` preloads the Help Momo scene's art and voice.
2. **Help Momo.** `src/intro/ice-intro.js` waits on that gate and calls `BridgeStory.afterStory()`: if the story played, the scene comes up out of the story's dark, speaks its three lines through the lesson's AudioContext (unlocked by the story's Play), and settles its promise when **Next** has been pressed and it has faded back to the dark. `?bridge=1` starts here directly; `?bridge=0` leaves it out.
3. **The blizzard.** `ice-intro.js` then plays for 5.8 s and releases `IceIntro.gate`.
4. **The lesson.** `boot()` in `index.html` waits on `IceIntro.gate`, then runs screen 1.
5. **The ending.** The last screen, 47, is the summary (`startSummary`, `src/lesson/summary.js`): it asks `src/runner/runner-stage.js` to preload the game (`game/index.html`) in an invisible frame, plays the lesson's seven ideas one card at a time in the Summary Kit's way, then Swiftee's "You know all about polygons now. You are ready to help Momo.", and shows Next; Next calls `startPart2`. With `?game=0` it ends on Play again.
6. **The Frozen Pass.** `RunnerStage.start()` (from the summary's Next) hides the lesson and lifts a curtain on the game's cover, where **Play** starts the game. `?game=1` starts here directly; `?game=0` leaves the game and the Help Momo scene out.

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
| 42 | Select polygons | `C1` | `viewMulti` |
| 43 | Sort polygon / not polygon | `C2` | `viewSort` |
| 44 | Find the non-polygon | `C3` | `viewTapOne` |
| 45 | Select pentagons | `C4` | `viewMulti` |
| 46 | Sort hexagons / heptagons | `C5` | `viewSort` |
| 47 | The summary: one screen, the lesson's seven ideas one card at a time (closed, polygon, sides, vertex, angle, still 5 sides, 3 to 8 sides), then "You know all about polygons now. You are ready to help Momo." and Next to the runner game's cover (Play again with `?game=0`) | `END` | `startSummary`, `summaryConcepts`, `startPart2`; `src/lesson/summary.js`, `styles/summary.css` |

## Other documents

- [design/](design/): the lesson scene notes, the button design, and the original bubble reference supplied for the story (`story-dialogue-box.png`).
- [design/story-music/](design/story-music/): the story's background music as a kit for another story: the two music files, a drop-in player (`story-music.js`: five moods, crossfades, loops, the dip under a voice) and a demo page.
- [design/story-frame/](design/story-frame/): the story’s paper page and ink-framed panel as two drop-in files (`story-frame.css`, `story-frame.js`) for another story, with a demo page.
- [voice/](voice/): **[VO-LIST.md](voice/VO-LIST.md) is the current voice-over list** (every line of the story, the lesson, the Broken Path and the game, by character, with delivery notes, file names and what still needs recording; the same rows in `vo-list-all.csv`). The older narration exports, the recordings manifest and transcript, and the notes on word timing are kept beside it.
- [game/](game/): the runner game's own contract, animation and voice notes, as they came with it.
- [sfx.md](sfx.md): where the lesson's sound effects come from.
- [../tests/checks/README.md](../tests/checks/README.md): what each lesson check covers.
