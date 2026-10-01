# Polygon Adventure

A playful polygon lesson for young learners. It opens with **Momo and Polo**, a nine-panel animated comic story, then **Help Momo**: Momo runs to a broken path, Swiftee flies in, tells him what is wrong and that the polygons come first. Then a short blizzard, and the lesson where Swiftee the bird teaches open and closed figures, straight and curved boundaries, sides, vertices and angles, and polygon names from triangle to octagon. It ends on one summary screen that recaps each idea in turn; then Swiftee tells the learner they are ready to help Momo, and the runner game begins, in which Momo crosses the broken ice by cutting down the right polygon, seven crossings, to reach his friend.

**Play it:** https://tarun-figmaboy-838.github.io/polygon-2/

It's a static site with no build step. Every script, font, image and sound ships with the page.

## Run it locally

Serve the folder over HTTP (opening `index.html` as a file will not work):

```bash
npx serve .
```

| URL option | What it does |
|---|---|
| `?story=0` | Skip the Momo and Polo story |
| `?intro=0` | Skip the story and the blizzard, and start the lesson |
| `?preview=1` | Authoring mode: skips both and goes straight to screen 1 |
| `?story=1` | Force the story in automated browsers, which skip it by default |
| `?game=1` | Straight to the Frozen Pass runner game: the story, the blizzard and the lesson are skipped |
| `?game=0` | Leave the game out (and with it the Help Momo scene): the completion screen keeps only Play again |
| `?bridge=1` | Straight to the Help Momo scene between the story and the lesson (the Broken Path); its Next goes into the lesson |
| `?bridge=0` | Leave that scene out: the lesson follows the story, and the completion screen offers Help Momo and Play again |
| `?dev=1` | Review mode: shows the screen navigator (Screens jump menu, Back and Next) at the top of the lesson, and the same Scenes menu over the story (with `?story=1` in automated browsers) |

## Folders

```text
index.html            the page: the lesson template and its script
src/
  story/              Momo + Polo story: controller, scene data, voice timings
  intro/              the blizzard cinematic
  lesson/             lesson data, layout, voice playback, Swiftee's sheet tables
  runtime/            the component runtime that boots the lesson
  bridge/             Help Momo (the Broken Path): the scene between the story and the lesson
  runner/             the hand-off to the Frozen Pass game after the lesson
styles/               all CSS (lesson, story, blizzard, buttons, fonts, the game's stage)
assets/
  story/              the nine story scenes (WebP)
  images/             lesson backgrounds and artwork (WebP)
  swiftee/            Swiftee's animation sheets (WebP)
  audio/lesson/       narration: Ogg Opus, plus MP3 for browsers without Ogg
  audio/sfx/          answer and drawing sounds (Ogg + MP3)
  audio/story/        story voices and music (Ogg + MP3)
  fonts/              Baloo 2, Nunito and Fredoka (with licences)
  vendor/             React and React DOM
game/                 THE FROZEN PASS: the runner game, a complete page of its own
                      (its markup, stylesheets, modules and about 20 MB of art and sound)
tools/                build scripts (media, story voices and music, Swiftee sheets, voice exports)
tests/                Playwright QA and the lesson checks
docs/                 folder guide and screen map, design notes, voice scripts
  game/               the runner's own contract (RUNNER.md), animation and voice notes
source-art/           Swiftee's character pack, used by tools/build-swiftee.cjs
```

[docs/STRUCTURE.md](docs/STRUCTURE.md) lists which file to edit for what and maps all 47 screens.

## Media formats

- **Images are WebP.**
- **Audio is Ogg Opus, with an MP3 copy** of every file. Browsers that play Ogg Opus get the smaller Ogg file; older Safari gets the MP3 automatically.

To add or replace media, drop in the PNG, JPG, MP3 or WAV and convert it:

```bash
npm install
npm run optimize:media -- assets/images/new-picture.png
npm run optimize:media -- assets/audio/lesson --speech   # narration: mono, speech-tuned
```

## Buttons

The round gold **Play** and the pill buttons come from the buttons kit of Swiftee & the Polygons (Part 1): the art is in `assets/ui/`, the styles in `styles/buttons-kit.css`, the Play button's glow, crystals and press in `src/fx/play-fx.js` (with `src/fx/snowflake.js`). The story's start card has the gold Play. **Next** is the blue pill, on the story into the game and on the lesson's recap screen, and with `?bridge=0` the completion screen offers a blue **Help Momo** and a gold **Play again**. The lesson's other buttons (Check and the answers) are still its ice buttons. The kit's own pages are `buttons-kit.html` and `momo-jump-kit.html`.

## The Momo + Polo story

It is told like a comic: each scene is a panel on a comic page. The narrator is **heard only**: their lines are voiced, with no box on screen. Momo and Polo speak in **one box**, a short part of the line at a time, using the dialogue kit from POLYGON Part 1: white bubbles that boing out of their tails, the bubble and its tail one drawn outline reaching to the speaker's head. Each word pops in as it is said, and a later part of a line takes the box with a smaller pop. The box shakes for a shout and trembles for a worry. Key words are coloured (Momo orange, Polo blue, the treasure gold, action red, encouragement green). Sounds, music, sparkles, hearts, ink emanata, speed lines and gentle shakes keep it lively; there are no written sound effects.

The round gold **Play** starts it, because browsers only allow sound after a tap. There is no Skip button: the story plays through. Esc, or `?story=0`, goes straight to the lesson. On an upright phone the balloon sits under the picture, its tail pointing up toward the speaker, and the text shrinks, if it must, to stay on one line.

| To change | Edit |
|---|---|
| Lines, coloured words, balloon position and tail, timing, effects | `src/story/story-data.js` |
| The box (the label, the bubbles, their lettering), comic page and panel | `styles/story-intro.css` |
| Behaviour (sequencing, audio, effects) | `src/story/story-intro.js` |

The voices are **placeholder takes** made with the macOS Indian English voices (Tara narrates; Momo and Polo are pitched-up takes), one take per line. For studio recordings, record one take per line (the list is in `tools/story/build-story-voice.py`), join them the same way and update `src/story/story-voice.js`, or rebuild the placeholders with `npm run build:story-voice`.

The music is an original score rendered by `npm run build:story-music`: one file with a section per mood (warm, playful, tension, hush, resolve) that the story crossfades between. To use a studio track instead, give it the same sections and times, or change the table in `story-data.js`.

## Help Momo (the Broken Path, between the story and the lesson)

The story ends on Polo's "Momo, keep going!" and fades to dark, and this scene comes up out of it, in the game's own world at dawn. Momo runs in along the ice path, sees the break ahead, skids to a stop short of the edge, looks down and holds there, breathing, the way the game's mammoth waits at a crack. Swiftee flies in on a curve, lands beside him, looks at the gap and then at Momo, and says three lines word by word: "Oh no! The path is broken." and "Help Momo cross the Frozen Pass!" (the game's own approved lines, from its recorded take), and then "But for that first you need to learn about polygons." When the last line has been read, **Next** appears. It fades back to the dark the blizzard starts from, and the blizzard carries on into the lesson.

Nothing takes a tap or a key during the scene except Next, and Next does not exist until the lines have been said. The scene is drawn from the game's art (`game/assets`) with the game's own numbers, so its ground is the ground the game opens on, and its crevasse and water are drawn as the game draws them (a port of the game's `GroundManager`). Swiftee is the lesson's sprite and speaks in her own Part 1 dialogue box. The sounds are the game's own: its recorded snow footsteps, its skid, the cartoon pips as Momo shivers at the edge, a lighter take of its whoosh as Swiftee swoops in, and its tap on Next. Without sound the words keep the same timing. With reduced motion every beat is shown as a held picture. The scene is `src/bridge/bridge-story.js` and `styles/bridge-story.css`, and its states are listed at the top of the script.

## The summary (the lesson's last screen)

One screen, after the Part 1 Summary Kit (its ice-vista background, its card, its speech bubble, its name plates, its album and its timing): the lesson's seven ideas, one card at a time, in the order they were taught. A card comes into the middle and its figure arrives; Swiftee rises from behind the card and says the idea in the lesson's own recorded words, and each key word shows the part of the figure it names as it is said (the lit sides on "segments", the corner on "point", the angle on "angle", the count on "5"); then the card shrinks into an album at the side with its name. The ideas: Closed, Polygon, Sides, Vertex, Angle, 5 sides (a corner is dragged and the sides are still five), 3 to 8 sides (the shape steps from a triangle to an octagon, each named). Then the albums gather in, Swiftee comes up in the middle and says "You know all about polygons now. You are ready to help Momo.", and **Next** appears. It brings up the game's cover: the Frozen Rush banner with its **Play** button, and Play starts the game. A tap on a collected card says its idea again. The Help Momo scene is not shown a second time. The engine is `src/lesson/summary.js` (its states are listed at the top), the look `styles/summary.css`.

## The Frozen Pass (the runner game)

`game/` is the Ice Age runner from the `running-mammoth` repository, brought in as it ships there: `game/index.html`, its two stylesheets, the modules in `game/js/` and its art and sound. One change was made to it: Baloo 2 comes from the lesson's own font file (`styles/fonts.css`) instead of Google Fonts, so the whole experience still ships every font with the page. That is also why the game has to be served from this folder rather than from `game/` on its own.

It plays in an `<iframe>`, not inside the lesson's document. The game's stylesheet carries global rules and generic class names, the two pages read different meanings into `?intro=0`, and each keeps its own audio and keyboard focus. `src/runner/runner-stage.js` puts the frame on the page invisibly while the completion screen and the Broken Path play, so the game has loaded by the time it is needed. The story's **Next** dims the screen to the game's night blue and lifts the curtain on the game's cover. **Play again** inside the game restarts the game. With `?bridge=0` the completion screen offers **Help Momo**, which does the same, and **Play again**, which restarts the lesson.

| To change | Edit |
|---|---|
| The seven crossings: which polygon, which distractors, the wording | `game/js/engine.js`: `CFG.levelOne.phases`. Read [docs/game/RUNNER.md](docs/game/RUNNER.md) first: it is the contract |
| The tutorial's seven lines | `game/js/tutorial.js` (their recording is `game/assets/audio/vo-lines`) |
| When the game loads, the curtain, which URL flags reach it | `src/runner/runner-stage.js`, `styles/runner-stage.css` |
| The Help Momo scene: its timing, lines, layout and states | `src/bridge/bridge-story.js`, `styles/bridge-story.css` |
| When it plays: after the story, before the blizzard | `src/intro/ice-intro.js`: `autostart`; `BridgeStory.afterStory` |
| The end of the lesson: the two lines, then the game's cover | `index.html`: `lessonComplete`, `queuePart2`, `startPart2` |
| The completion screen's buttons (only with `?bridge=0`) | `index.html`: `viewEnd`, `startRunner` |

Three files under `game/js/` are generated and should not be edited by hand: `game.bundle.js` (the modules concatenated for opening `game/index.html` straight off the disk; this project always serves the game over HTTP, so it is not used here, but rebuild it with `node tools/build-bundle.mjs` in the running-mammoth repository whenever a module changes so the two can never disagree), `option-shapes.js` and `asset-versions.js`. The game's own Playwright suite lives in that repository and runs against exactly these files.

## Testing

```bash
npm install                            # newer npm may ask you to approve the install
                                       # scripts: npm install-scripts approve ffmpeg-static
npx playwright install chromium        # and `webkit` to test Safari's engine
npm test                               # lesson smoke + story on 6 screens + user flows + the runner hand-off
                                       # + the story into the game + Swiftee loading (~14 min)
npm run test:runner                    # just the hand-off: ?game=1, the Help Momo button, ?game=0 (~2 min)
npm run test:bridge                    # Help Momo and the lesson's ending: order, locking, voice, Next, the cover, Play (~5 min)
npm run test:swiftee                   # Swiftee loading: sheet table, cold / slow / warm loads, state races (~2 min)
npm run test:summary                   # the summary: states in order, voice, word cues, layout, phones, Next (~4 min)
BASE=https://tarun-figmaboy-838.github.io/polygon-2/ npm run test:swiftee   # the same against a deployed site
npm run test:checks                    # 32 focused lesson checks incl. the full 47-screen playthrough (~20 min)
ENGINE=webkit npm test                 # the same in Safari's engine
```

Screenshots of every story panel on every screen size are saved to `tests/output/story/`.

## Deploy

- **GitHub Pages** serves the `main` branch as it is. Every push updates the live game within a minute or two.
- **Vercel** works too: framework preset **Other**, no build command. `.vercelignore` keeps tools, tests, docs and source art out of the deploy; `game/` ships with the page.

## Notes

- The screen navigator (the "Screens" jump menu and the Back and Next buttons at the top of the lesson) is hidden from learners. Open the page with `?dev=1` to use it. The story gets the same menu, "Scenes": jump to any of its nine scenes, even before Play, and it plays on from there into the lesson. The runner has a review control of its own, a "Skip to ending" pill in its bottom-left corner; `game/index.html` says how to remove it.
- Text files are stored with LF line endings (`.gitattributes`), so an editor that switches line endings can no longer make files look modified.
