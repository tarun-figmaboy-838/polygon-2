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
| The opening's order and the lesson's way in (the game's cover and tutorial, then the snow; or the drafted story) | `src/intro/opening.js`; `src/runner/runner-stage.js`: `opening`, `toLesson`, `flurry`; the lesson's gate is `boot()` in `index.html` |
| Swiftee flying in over the game: her flight, her look, her box and voice, her lines | `src/intro/swiftee-cameo.js`; `OPENING_LINES`, `DITCH_LINES` in `src/runner/runner-stage.js`; the game's side is the intro and end scripts in `game/js/tutorial.js` |
| The Help Momo scene's avalanche: its beats, the wall, the trail, its sounds | `src/bridge/bridge-story.js`: `AV`, `avUpdate`, `drawAvalanche` (a port of `game/js/avalanche.js`) |
| Story lines, coloured words, balloon position and tail, effects, timing | `src/story/story-data.js` |
| Story look (the narration label and speech bubbles, comic page and panel) | `styles/story-intro.css` |
| Story behaviour (sequencing, audio, effects) | `src/story/story-intro.js` |
| Swiftee's animation sheets | `tools/build-swiftee.cjs` (writes `assets/swiftee/` and `src/lesson/swiftee-sheets.js`) |
| The Help Momo scene between the story and the lesson (the Broken Path): timing, lines, layout, states | `src/bridge/bridge-story.js`, `styles/bridge-story.css` |
| When the drafted story and scene play (`?story=1`) | `src/intro/opening.js` `storyFirst`, `BridgeStory.afterStory`, `BridgeStory.ending` |
| The lesson's music (Frozen Rush's bed): its level, the dip under a voice, the fade into the game | `src/lesson/lesson-music.js`; started in `boot()`, ducked by `musicDucks()`, stopped in `startPart2` (`index.html`) |
| The recap, screen 41 before the quizzes (presented the Part 1 Summary Kit's way): what it says, its look, its states and timing | `index.html`: `recapConcepts`, `startRecap`; `src/lesson/recap.js` (states at the top), `styles/recap.css`, `assets/ui/panel.webp` |
| The end: the last line, then the game by itself | `index.html`: `finishLesson`, `startPart2`; `src/runner/runner-stage.js`; `game/js/main.js` (`?cover=0`, `window.iceAgeBegin`) |
| The hand-off to the runner game: when it loads, the curtain, its URL flags | `src/runner/runner-stage.js`, `styles/runner-stage.css` |
| The gold Play and the pill buttons (Next, Help Momo, Play again) | `styles/buttons-kit.css`, `src/fx/play-fx.js`, `assets/ui/`; in the lesson `pillBtn` in `index.html` |
| Momo's jump in the runner game (the 24-cell sheet) | `game/js/engine.js`: `sheets.jump`, `frames.jump`, the JUMP_START / JUMP_AIR / LAND cases in `PlayerController.draw` |
| The runner game itself: its seven crossings, tutorial, art and sound | `game/js/engine.js`: `CFG.levelOne.phases`; `game/js/tutorial.js`; see [game/RUNNER.md](game/RUNNER.md) |

Narration text is matched to recordings by wording. When you change a spoken sentence, check its entry in `src/lesson/recordings.js` too.

## Start-up order

1. **The game's opening.** `src/intro/opening.js` hides the lesson from the first moment and calls `RunnerStage.opening()` (`src/runner/runner-stage.js`): the game (`game/index.html?lesson=intro`) is the page, with its own cover and **Play**, its avalanche and its tutorial up to the broken path (the 'intro' script in `game/js/tutorial.js`). A press inside the game also opens the lesson's AudioContext. At the break the game holds still and says `lesson`, with where Momo and the hole are; Swiftee flies in over it (`src/intro/swiftee-cameo.js`), looks at the ditch, and says her two lines.
2. **The snow.** `toLesson` blows a flurry of snowflakes across, settles the opening's promise (so `opening.js` releases `Opening.gate` and `boot()` in `index.html` runs screen 1 underneath), fades the game away under the snow and takes its frame off the page. `?intro=0` skips the opening; automated browsers skip it unless `?intro=1`.
3. **On draft: the story and Help Momo.** With `?story=1` the old opening plays instead: `src/story/story-intro.js` (its start card and **Play**), then `BridgeStory.afterStory()` (`src/bridge/bridge-story.js`) out of the story's dark, then a veil of that dark lifts off the lesson. `?bridge=1` opens on the scene alone.
4. **The ending.** Screen 41 is the recap (`startRecap`, `src/lesson/recap.js`): the lesson's ideas one card at a time in the Summary Kit's way, then Next into the quizzes. The last screen, 47, is the line back to Momo (`finishLesson`): it asks `src/runner/runner-stage.js` to preload the game (`game/index.html`) in an invisible frame, Swiftee says, in the lesson's own bubble (`sayLastLine`; in the drafted Help Momo scene with `?story=1`, `BridgeStory.ending`), "Now you know everything about polygons. You are ready to help Momo.", and once it has been read it calls `startPart2` by itself. With `?game=0` it ends on Play again.
5. **The Frozen Pass.** `RunnerStage.start()` hides the lesson under the night blue, waits for the game's art (`game/index.html?cover=0&lesson=end`), starts its run (`window.iceAgeBegin`, once) and lifts the curtain on it: there is no cover and no Play, and no tutorial. At the ditch the game stops for Swiftee (`swiftee`, a host step in the 'end' script), who flies in, says "Now let's help Momo." and flies off; the page answers `said`, and the plank goes on. `?game=1` starts here directly; `?game=0` leaves the game and the Help Momo scene out.

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
| 41 | The recap: "Let's recall what we learnt today.", then the polygon, its sides, a vertex and an angle, then "Polygons have different names based on their number of sides." and the six names, one card at a time; Next into the quizzes | `S23` (`recap`) | `startRecap`, `recapConcepts`, `viewRecap`; `src/lesson/recap.js`, `styles/recap.css` |
| 42 | Select polygons | `C1` | `viewMulti` |
| 43 | Sort polygon / not polygon | `C2` | `viewSort` |
| 44 | Find the non-polygon | `C3` | `viewTapOne` |
| 45 | Select pentagons | `C4` | `viewMulti` |
| 46 | Sort hexagons / heptagons | `C5` | `viewSort` |
| 47 | The end: "Now you know everything about polygons. You are ready to help Momo.", locked, then the runner game starts by itself, no Next and no Play (Play again with `?game=0`) | `END` | `finishLesson`, `startPart2`, `viewEnd` |

## Other documents

- [design/](design/): the lesson scene notes, the button design, and the original bubble reference supplied for the story (`story-dialogue-box.png`).
- [design/story-music/](design/story-music/): the story's background music as a kit for another story: the two music files, a drop-in player (`story-music.js`: five moods, crossfades, loops, the dip under a voice) and a demo page.
- [design/story-frame/](design/story-frame/): the story’s paper page and ink-framed panel as two drop-in files (`story-frame.css`, `story-frame.js`) for another story, with a demo page.
- [voice/](voice/): **[VO-LIST.md](voice/VO-LIST.md) is the current voice-over list** (every line of the story, the lesson, the Broken Path and the game, by character, with delivery notes, file names and what still needs recording; the same rows in `vo-list-all.csv`). The older narration exports, the recordings manifest and transcript, and the notes on word timing are kept beside it.
- [game/](game/): the runner game's own contract, animation and voice notes, as they came with it.
- [sfx.md](sfx.md): where the lesson's sound effects come from.
- [../tests/checks/README.md](../tests/checks/README.md): what each lesson check covers.
