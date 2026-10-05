# Polygon Adventure

A playful polygon lesson for young learners. It opens on **Frozen Rush** itself: the game's own banner and Play, its avalanche, and its tutorial as far as the broken path ("This is Momo. He needs to find his friend." ... "Oh no! The path is broken."). There the game stops, **Swiftee flies in**, lands on the path across the ditch, looks at it, and tells the learner, in her own voice, "Momo needs your help. But to help Momo, you need to learn about polygons." A flurry of snow blows across and the game fades away onto the lesson, which starts by itself. Then the lesson, where Swiftee the bird teaches open and closed figures, straight and curved boundaries, sides, vertices and angles, and polygon names from triangle to octagon. Before the quizzes, one recap screen goes over each idea in turn; after them, Swiftee tells the learner they are ready to help Momo, and the runner game begins by itself, avalanche and all, with no tutorial: at the ditch Swiftee flies in again ("Now let's help Momo."), and Momo crosses the broken ice by cutting down the right polygon, seven crossings, to reach his friend.

The **Momo and Popo** comic story and the **Help Momo** scene that used to open it are kept **on draft**: `?story=1` brings them back in place of the game's opening.

**Play it:** https://tarun-figmaboy-838.github.io/polygon-2/

It's a static site with no build step. Every script, font, image and sound ships with the page.

## Run it locally

Serve the folder over HTTP, or open `index.html` straight from the disk. Off the disk everything runs, the languages included: a browser refuses a `file://` page's `fetch()`, so the words come as a script there (`src/i18n/locales.js`, written from `locales.json` by `npm run build:locales`), and the Indian-script fonts fall back to the system's, since browsers block local font files the same way. Over HTTP:

```bash
npx serve .
```

| URL option | What it does |
|---|---|
| `?intro=0` | Skip the game's opening (its cover and tutorial) and start the lesson |
| `?intro=1` | Force the game's opening in automated browsers, which skip it by default |
| `?preview=1` | Authoring mode: goes straight to screen 1 |
| `?story=1` | The drafted opening instead: the Momo and Popo story, then the Help Momo scene (and that scene again at the end) |
| `?game=1` | Straight to the Frozen Pass runner game after the lesson: the opening and the lesson are skipped |
| `?game=0` | Leave the game out: no opening, and the last screen ends on Play again |
| `?bridge=1` | Straight to the drafted Help Momo scene (the Broken Path); its Next goes into the lesson |
| `?bridge=on` | The drafted Help Momo scene at the lesson's end only |
| `?bridge=0` | With `?story=1`, leave that scene out: the lesson follows the story |
| `?dev=1` | Review mode: the screen navigator (the jump menu, Back and Next), over everything, start to end: **Start** 1 the game's cover and tutorial, 2 Swiftee at the broken path (the game is fast-forwarded to it); **Screens** 1-47 the lesson; **End** 1 the game after the lesson, 2 Swiftee at the ditch. The story's Scenes menu with `?story=1` |
| `?dev=1&devat=break` | Review: open the game's opening straight at the broken path (Start 2) |
| `?lan=hi` | The whole experience in another language: `hi` Hindi, `mr` Marathi, `te` Telugu, `gu` Gujarati, `od` Odia (`en` English is the default). Capitals, `?lang=`, the language's name (`?lan=hindi`) and a second `?` for an `&` all work too. See [Languages](#languages) |

## Folders

```text
index.html            the page: the lesson template and its script
src/
  story/              Momo + Popo story: controller, scene data, voice timings
  intro/              the opening's order (the game's cover and tutorial, or the drafted story),
                      and Swiftee flying in over the game (swiftee-cameo.js)
  lesson/             lesson data, layout, voice playback, Swiftee's sheet tables
  runtime/            the component runtime that boots the lesson
  bridge/             Help Momo (the Broken Path): the scene between the story and the lesson
  runner/             the hand-off to the Frozen Pass game after the lesson
styles/               all CSS (lesson, story, Help Momo, recap, buttons, fonts, the game's stage)
assets/
  story/              the nine story scenes (WebP)
  images/             lesson backgrounds and artwork (WebP, and an AVIF twin where one is smaller)
  swiftee/            Swiftee's animation sheets (WebP)
  audio/lesson/       narration: Ogg Opus, plus MP3 for browsers without Ogg
  audio/sfx/          answer and drawing sounds (Ogg + MP3)
  audio/story/        story voices and music (Ogg + MP3)
  audio/bridge/       Swiftee's two Broken Path lines (Ogg + MP3)
  audio/source/       the voice recordings as delivered; everything above is cut from them
                      (hi/: the Hindi voice, one WAV per line, numbered as hi/script.csv)
  audio/lesson/hi/    the Hindi takes of the lesson's lines (npm run build:hindi-voice)
  fonts/              Baloo 2, Nunito and Fredoka (with licences)
  vendor/             React and React DOM
game/                 THE FROZEN PASS: the runner game, a complete page of its own
                      (its markup, stylesheets, modules and about 20 MB of art and sound)
tools/                build scripts (media, story voices and music, Swiftee sheets, voice exports)
tests/                Playwright QA and the lesson checks
docs/                 folder guide and screen map, design notes, voice scripts
  game/               the runner's own contract (RUNNER.md), animation and voice notes
source-art/           Swiftee's character pack, used by tools/build-swiftee.cjs (@1x sheets; the unused @2x ones were removed)
```

[docs/STRUCTURE.md](docs/STRUCTURE.md) lists which file to edit for what and maps all 47 screens.

## Media formats

- **Images are WebP, with an AVIF twin where one is the same picture for clearly fewer bytes.** A browser that decodes AVIF gets the AVIF; every other browser gets the WebP, and no browser fetches a picture in both formats. A twin is only made when it is at least 20% smaller and still matches the WebP pixel for pixel to a strict bar, both on average and in its worst spot (`tools/optimize-media.cjs`: `fidelity`), so it is the same picture. That is 24 of them: the lesson's board, background, end world, recap card and pill buttons, and the game's path, rocks, platform ends, four obstacles, the morning sky, the Play button, the plank and the tutorial's hand. Swiftee's sheets, Momo's sheets, the ice blocks, the story, the other skies and the game's cover stay WebP only: as AVIF they are larger, or not enough smaller to be the same picture.
  - **How a picture picks.** A stylesheet names both with `image-set()`, after a plain WebP `url()` for browsers without it (under `@supports` where it sets a custom property, as the pill buttons do). A picture the code draws asks first: the game through `assetUrl()` (its table, `game/js/asset-versions.js`, says which pictures have a twin), the lesson through `polygonAvif()`, set up at the top of `index.html`. Both decode a one-pixel AVIF with alpha and keep the first answer they give for the page (the game waits for it before its first picture; the lesson answers no if it is not in yet, which only a very slow browser would see). In the game and the Help Momo scene, an AVIF that will not load is asked for again as its WebP. The instruction board's preload is made in the same format its rule picks.
- **Audio is Ogg Opus, with an MP3 copy** of every file. Browsers that play Ogg Opus get the smaller Ogg file; older Safari gets the MP3 automatically. The game's sounds are Opus too (96 kbps stereo; 64 kbps for the UI tap and the footsteps), so the lesson and the game ask the browser the same question.
- **There is no video**, and no GIF: Swiftee's and Momo's animations are sprite sheets drawn frame by frame by the code, in step with her voice and the game, which an animated image could not be.
- **Icons are SVG** where they are drawn as icons (the game's control glyphs). The painted art (buttons, planks, the tutorial's glossy hand) stays raster, since tracing it to vectors would change how it looks.

To add or replace media, drop in the PNG, JPG, MP3 or WAV and convert it. A picture gets its WebP and, if it clears the bar, its AVIF; a WebP given on its own gets just the AVIF. A new AVIF is used once the code asks for it (above): in `game/` run `node tools/build-game-bundle.cjs` so the game's table lists it.

```bash
npm install
npm run optimize:media -- assets/images/new-picture.png
npm run optimize:media -- assets/images/new-picture.png --lossless   # a WebP with the source's exact pixels
npm run optimize:media -- assets/audio/lesson --speech   # narration: mono, speech-tuned
npm run optimize:media -- game/assets/audio/new-sound.mp3 --bitrate=96k
```

## Buttons

The round gold **Play** and the pill buttons come from the buttons kit of Swiftee & the Polygons (Part 1): the art is in `assets/ui/`, the styles in `styles/buttons-kit.css`, the Play button's glow, crystals and press in `src/fx/play-fx.js` (with `src/fx/snowflake.js`). The story's start card has the gold Play. **Next** is the blue pill, on the story into the game and on the lesson's recap screen, and with `?bridge=0` the completion screen offers a blue **Help Momo** and a gold **Play again**. The lesson's other buttons (Check and the answers) are still its ice buttons. The kit's own pages are `buttons-kit.html` and `momo-jump-kit.html`.

## The Momo + Popo story (on draft)

On draft: the experience opens on the game now (see [The Frozen Pass](#the-frozen-pass-the-runner-game)). `?story=1` plays this story, and the Help Momo scene after it, in place of that opening.

It is told like a comic: each scene is a panel on a comic page. The narrator is **heard only**: their lines are voiced, with no box on screen. Momo and Popo speak in **one box**, a short part of the line at a time, using the dialogue kit from POLYGON Part 1: white bubbles that boing out of their tails, the bubble and its tail one drawn outline reaching to the speaker's head. Each word pops in as it is said, and a later part of a line takes the box with a smaller pop. The box shakes for a shout and trembles for a worry. Key words are coloured (Momo orange, Popo blue, the treasure gold, action red, encouragement green). Sounds, music, sparkles, hearts, ink emanata, speed lines and gentle shakes keep it lively; there are no written sound effects.

The round gold **Play** starts it, because browsers only allow sound after a tap. There is no Skip button: the story plays through. Esc, or `?story=0`, goes straight to the lesson. On an upright phone the balloon sits under the picture, its tail pointing up toward the speaker, and the text shrinks, if it must, to stay on one line.

| To change | Edit |
|---|---|
| Lines, coloured words, balloon position and tail, timing, effects | `src/story/story-data.js` |
| The box (the label, the bubbles, their lettering), comic page and panel | `styles/story-intro.css` |
| Behaviour (sequencing, audio, effects) | `src/story/story-intro.js` |

The voices are **recorded**: the narrator, Momo and Popo each delivered one file with all their lines in it, and each line is cut from it and joined into `assets/audio/story/story-voice` with its word times (see [The voices](#the-voices)). The recordings call the polar bear **Popo**, so the words on screen do too (his speaker id in the code is still `polo`). The old placeholder voices can still be made with `npm run build:story-voice -- --placeholders`, which replaces the recordings.

The music is an original score rendered by `npm run build:story-music`: one file with a section per mood (warm, playful, tension, hush, resolve) that the story crossfades between. To use a studio track instead, give it the same sections and times, or change the table in `story-data.js`.

## Help Momo (the Broken Path, on draft with the story)

On draft with the story (`?story=1`, or `?bridge=1` for the scene alone, `?bridge=on` for its ending alone). Without it, Swiftee's last line is said in the lesson's own bubble, and her lines at the broken path are said over the game itself.

The story ends on Popo's "Momo, keep going!" and fades to dark, and this scene comes up out of it, in the game's own world at dawn, on the game's own opening: its avalanche (a port of `game/js/avalanche.js`, with its sounds), a wall of snow coming down the pass while Momo runs in along the ice path ahead of it and the path cracks open behind his heels. When the snow has settled he runs on, sees the break ahead, skids to a stop short of the edge, looks down and holds there, breathing, the way the game's mammoth waits at a crack. Swiftee flies in on a curve, lands beside him, looks at the gap and then at Momo, and says three lines word by word, in her own recorded voice: "Oh no! The path is broken." and "Help Momo cross the Frozen Pass!" (the game's own approved lines, which its tutorial says again in the game's voice), and then "But for that first you need to learn about polygons." When the last line has been read, **Next** appears. It fades back to the story's dark, and the lesson comes up out of it. The scene comes back once more at the end of the lesson: Momo at the edge and Swiftee beside him, for her line "Now you know everything about polygons. You are ready to help Momo.", and then the game starts by itself.

Nothing takes a tap or a key during the scene except Next, and Next does not exist until the lines have been said. The scene is drawn from the game's art (`game/assets`) with the game's own numbers, so its ground is the ground the game opens on, and its crevasse and water are drawn as the game draws them (a port of the game's `GroundManager`). Swiftee is the lesson's sprite and speaks in her own Part 1 dialogue box. The sounds are the game's own: the avalanche's (the game's sound kit, `game/js/sfx.js`, and its recorded rumble), its recorded snow footsteps, its skid, the cartoon pips as Momo shivers at the edge, a lighter take of its whoosh as Swiftee swoops in, and its tap on Next. Without sound the words keep the same timing. With reduced motion every beat is shown as a held picture. The scene is `src/bridge/bridge-story.js` and `styles/bridge-story.css`, and its states are listed at the top of the script.

## The recap (screen 41, before the quizzes) and the end

**The recap** is the one look back, just before the quizzes, presented the way the Part 1 Summary Kit presents (its card, its speech bubble, its name plates, its album and its timing) over the lesson's own background. Nothing on it takes a tap: Swiftee goes over the lesson, one thing at a time. She comes up and says "Let's recall what we learnt today."; then each idea has its card: it comes into the middle, its figure arrives, Swiftee rises from behind it and says the idea in the lesson's own recorded words, and each key word shows the part it names as it is said (the polygon on "polygon", the sides on "segments", one corner on "point", the angle on "angle"); then the card shrinks into the album at the side with its name. After the polygon, its sides, a vertex and an angle, she says "Polygons have different names based on their number of sides.", and the six names follow the same way, triangle to octagon, each card counting its sides as its number is said and collected into a second album. Then everything gathers, a moment to look at it, and **Next** appears; it goes on into the quizzes. The engine is `src/lesson/recap.js` (its states are listed at the top), the look `styles/recap.css`, and what it says `recapConcepts()` in `index.html`. Its lines play through the lesson's own audio context, which the learner's first tap has already opened, and are fetched when the recap begins; if a line cannot start within 1.2 seconds, its words still appear on the voice's timing, so the recap never waits for a tap.

**The music.** The lesson has its own music, heard only in the lesson: a loop from the original score composed for this project (`assets/audio/music/lesson-music`, cut from the story score's warm and playful sections by `npm run build:lesson-music`), a curious music box over a soft pad. Frozen Rush keeps its own music, untouched. The lesson's plays at the game bed's loudness and with its manners: it fades in when screen 1 starts, dips under every line Swiftee says (in the lesson, the recap and the Help Momo scene) and fades out as the game takes the screen, where the game's own music begins. It streams and is never waited on; a browser that will not start it yet is asked again on the next tap. The player is `src/lesson/lesson-music.js`.

**The end**, after the last quiz, is not another summary, and it is already in the game's world: the board goes, Frozen Rush's daylight fades in over the lesson's night (`assets/images/end-world.webp`, the game's own renderer at its first ditch, made by `npm run build:end-world`), and Swiftee lands on the game's ice path with the ditch ahead of her. There she says "Now you know everything about polygons. You are ready to help Momo.", word by word, with a small happy beat and nothing to press. Once it has been said and read, the screen goes to the game's night blue and Frozen Rush starts by itself: there is no cover and no Play, and no tutorial. Its avalanche comes down and Momo runs; at the ditch the game stops, Swiftee flies in, lands across it and says "Now let's help Momo.", and flies off; then the plank says "Use the right piece to fix the path." and asks its question, "Cut the TRIANGLE.", and after the right cut the game says "Perfect fit! Keep going!" The game starts once, and its own voice begins only after hers. With `?game=0` the end offers Play again instead. (With `?story=1` the end is said in the drafted Help Momo scene.)

## The Frozen Pass (the runner game)

`game/` is the Ice Age runner from the `running-mammoth` repository, brought in as it ships there: `game/index.html`, its two stylesheets, the modules in `game/js/` and its art and sound. One change was made to it: Baloo 2 comes from the lesson's own font file (`styles/fonts.css`) instead of Google Fonts, so the whole experience still ships every font with the page. That is also why the game has to be served from this folder rather than from `game/` on its own.

**The opening and the return.** The game is carried twice, by `src/runner/runner-stage.js`. First as the page itself, with `?lesson=intro`: its cover and Play, its avalanche, and its tutorial's first five lines (the 'intro' script in `game/js/tutorial.js`); at the broken path it holds its world still and tells the page where Momo and the hole are, and Swiftee flies in over it (`src/intro/swiftee-cameo.js`: the lesson's own sheets and dialogue box, the game's whoosh, her recorded voice where the line has a take). Then the hand-over in the snow: a flurry of the lesson's snowflakes blows across, the lesson starts underneath, and the game fades away under the snow onto it; the frame is then taken off the page. After the lesson the game is loaded again, with `?lesson=end`, and at the ditch it stops for Swiftee in the same way (a host step) before the plank. In both, the game's Skip and Skip to ending are taken out. Opened on its own, the game is unchanged.

It plays in an `<iframe>`, not inside the lesson's document. The game's stylesheet carries global rules and generic class names, the two pages read different meanings into `?intro=0`, and each keeps its own audio and keyboard focus. While it waits hidden, the game makes no sound: its sound is turned on when its run begins. `src/runner/runner-stage.js` puts the frame on the page invisibly while the last screen plays, so the game has loaded by the time it is needed. After the last screen's line the screen dims to the game's night blue and the curtain lifts on the game's run, which starts by itself: the game is loaded with `?cover=0`, so it has no cover and no Play and waits for the page to start it (`window.iceAgeBegin` in `game/js/main.js`), once. **Play again** inside the game restarts the game. With `?game=0` there is no game, and the last screen ends on **Play again**, which restarts the lesson.

| To change | Edit |
|---|---|
| The seven crossings: which polygon, which distractors, the wording | `game/js/engine.js`: `CFG.levelOne.phases`. Read [docs/game/RUNNER.md](docs/game/RUNNER.md) first: it is the contract |
| The tutorial's seven lines | `game/js/tutorial.js` (their recording is `game/assets/audio/vo-lines`, windows in `CFG.vo.lines`; see [The voices](#the-voices)) |
| When the game loads, the curtain, which URL flags reach it | `src/runner/runner-stage.js`, `styles/runner-stage.css` |
| The Help Momo scene: its timing, lines, layout and states | `src/bridge/bridge-story.js`, `styles/bridge-story.css` |
| The opening: the game's cover and tutorial, Swiftee at the broken path, the snow into the lesson | `src/intro/opening.js`, `src/runner/runner-stage.js` (`opening`, `toLesson`, `flurry`); `src/intro/swiftee-cameo.js`; `game/js/tutorial.js` (the intro and end scripts) |
| Swiftee over the game: her flight, her look at the ditch, her box, what she says | `src/intro/swiftee-cameo.js`; her lines are `OPENING_LINES` and `DITCH_LINES` in `src/runner/runner-stage.js` |
| All of the above as a kit for another game: the sequence, the screens, the messages, the files | [docs/design/game-lesson-kit/](docs/design/game-lesson-kit/) (`README.md`, and `index.html`, the storyboard) |
| When the drafted Help Momo scene plays (`?story=1`) | `src/intro/opening.js`: `storyFirst`; `BridgeStory.afterStory`, `BridgeStory.ending` |
| The recap before the quizzes: what it says, its look | `index.html`: `recapConcepts`, `startRecap`; `src/lesson/recap.js`, `styles/recap.css` |
| The end of the lesson: the last line, then the game by itself | `index.html`: `finishLesson`, `startPart2`; `src/runner/runner-stage.js` |

Three files under `game/js/` are generated and should not be edited by hand: `game.bundle.js` (the modules concatenated for opening `game/index.html` straight off the disk; this project always serves the game over HTTP, so it is not used here, but rebuild it whenever a module changes so the two can never disagree: `npm run build:game-bundle` here makes it, and `asset-versions.js` with it, exactly as `tools/build-bundle.mjs` in the running-mammoth repository does), `option-shapes.js` and `asset-versions.js`. The game's own Playwright suite lives in that repository and runs against exactly these files.

## Languages

Add `?lan=` to the address to play in another language, for example
https://tarun-figmaboy-838.github.io/polygon-2/?lan=hi

| `?lan=` | Language |
|---|---|
| `en` (or nothing) | English |
| `hi` | Hindi |
| `mr` | Marathi |
| `te` | Telugu |
| `gu` | Gujarati |
| `od` | Odia |

Everything the learner reads is in that language: Swiftee's lines in the lesson, the buttons, labels and name pills, the feedback, the recap, her lines over the game, the game's tutorial, its plank and its controls, the page title and the screen-reader messages. The key words are coloured as in English, orange for open, gap and curved and purple for the rest. The words come from [src/i18n/locales.json](src/i18n/locales.json), one block per language. [docs/i18n/translations-review.html](docs/i18n/translations-review.html) shows them side by side.

- **In Hindi the voice is Hindi.** Swiftee's lesson lines, the recap, her lines over the game and her last line, and the game's tutorial and plank are all said in the Hindi recordings, and each word appears as it is said. Every cue the voice drives fires on the Hindi word that says it: the Open and Closed buttons on खुली and बंद, the boundaries pulsing on सीधी and वक्र, the pentagon's sides, vertex and angle drawn on भुजाएँ, शीर्ष and कोण, the recap's counts on the number. See [The Hindi voice](#the-hindi-voice).
- **The other languages speak with the English recording.** There are no recordings in Marathi, Telugu, Gujarati or Odia and no synthetic voice, so Swiftee and the game voice speak English while the words appear in the chosen language, in step with the voice. Every cue the voice drives works as in English.
- **Each language has its own font.** Nunito, Baloo 2 and Fredoka have no Indian scripts, so the matching Baloo is used under the same names: Baloo 2 for Hindi and Marathi, Baloo Tammudu 2 for Telugu, Baloo Bhai 2 for Gujarati and Baloo Bhaina 2 for Odia (`assets/fonts/`, about 100 kB). Only the chosen language's file is fetched, and English loads nothing new.
- **The code keeps its English.** Every line is still written, compared, timed and looked up in English. Only what is shown is put into the language, by `src/i18n/i18n.js`, which finds each line in the JSON by its English. A line missing from the JSON is shown in English.
- **To change a translation,** edit its line in `locales.json`. Key words are wrapped in `<strong>…</strong>`, and `{placeholders}` are filled in by the game. Then run `npm run test:i18n`, which checks the file and every screen, and `npm run build:i18n-review` to refresh the review page.
- The review controls (`?dev=1`) and the drafted story (`?story=1`) stay in English.

## The voices

Every voice the learner hears is recorded. They were delivered as nine files, most of them several lines to a file, and are kept as delivered in `assets/audio/source/`:

| File | Voice | Holds |
|---|---|---|
| `story-narrator.mp3` | Narrator | the story's six narrated parts |
| `story-popo.mp3` | Popo | his seven story lines |
| `story-momo.mp3` | Momo | his three story lines |
| `swiftee-lesson-1.mp3` | Swiftee | the lesson, from "Look! A point." to "Which figure breaks the rule for a polygon?" |
| `swiftee-lesson-2.mp3` | Swiftee | the last two quizzes, then the Broken Path's two lines (and the game's tutorial again, which is not used) |
| `swiftee-lesson-3.mp3` | Swiftee | "You know all about polygons now. You are ready to help Momo." (the old last line; the end now says it differently, so it is not played) |
| `swiftee-lesson-4.mp3` | Swiftee | the Broken Path's last line, the recap's two own lines, and the end's line back to Momo |
| `swiftee-lesson-5.mp3` | Swiftee | her three lines over the game: "Momo needs your help." and "But to help Momo, you need to learn about polygons." at the broken path, and "Now let's help Momo." at the ditch |
| `frozen-rush-voice.mp3` | Game voice | Frozen Rush: the seven tutorial lines and the seven signs |

`docs/voice/cue-map.json` is the line-level map: for every line, which file, where it starts and ends, and when each word is said. It was measured from the recordings (a speech recogniser placed the words, then the waveform's own pauses decided where each line begins and ends). `npm run build:recorded-voice` (`tools/voice/cut-recordings.py`) builds everything the experience plays from the recordings and that map: the story's joined file and table, one file per lesson line under the name its row in `src/lesson/recordings.js` already uses (and that row's length and word times), Swiftee's two Broken Path takes in `assets/audio/bridge/`, and the game's take with its windows in `CFG.vo.lines`. So every line is played on its own, at its own moment, and its words appear as they are said. There are no stand-in voices and no lines without one. One line nobody recorded whole is joined from recorded words (the cue map's `joins`, built by the same tool, each piece cut in the silences around it and levelled as its own recording is): the game voice's "Use the right piece to fix the path." after the lesson, its own line with "ice" cut out ("fill the gap" was never recorded). A recording of it whole replaces the join. The lesson's lines play through the lesson's AudioContext once the game's PLAY has opened it (`src/lesson/recorded-player.js`), so Safari, which does not count a tap inside the game's frame for the page, still plays them; without a running context they play as media elements, as before. [docs/voice/VO-LIST.md](docs/voice/VO-LIST.md) lists every line and what it is recorded with. A new take for one line goes in on its own: add it to the cue map and run `npm run build:recorded-voice -- --only <id>`.

### The Hindi voice

With `?lan=hi` every line is said in Hindi. The Hindi voice-over was delivered as one WAV per line, numbered as its script, and is kept in `assets/audio/source/hi/` as lossless FLAC, bit for bit the delivered sound at half the size (`1.flac` ... `181.flac`; [script.csv](assets/audio/source/hi/script.csv) says which number is which line, and whether it came). The numbers follow the keys of `src/i18n/locales.json` in order, leaving out the twelve nobody hears (from `uiOptionLetters` to `a11yLabelPlaced`). Of those 181, the 98 the experience says are used; the rest are labels and screen-reader messages.

| To change | Do |
|---|---|
| A Hindi take (a new one for a line, or a missing one) | drop it in `assets/audio/source/hi/` as `<number>.flac` (or `.wav`), then measure it and build: `python tools/voice/measure-hindi-voice.py --model <whisper folder> --only <number>` and `npm run build:hindi-voice` |
| Which Hindi word an English cue fires on | `CONCEPTS` (by word) or `CUE_AT` (one line's) in `tools/voice/build-hindi-voice.py`, or a line's `cues` in the cue map; then `npm run build:hindi-voice` |

- **The map.** `docs/voice/hi/cue-map.json` holds, for every line said, its file, its key, its English and Hindi, where its speech starts and ends, its runs of speech between pauses, and when each shown word starts, with a check: a blind transcription of the file and how close it is to the script. It is measured by `tools/voice/measure-hindi-voice.py`: a multilingual Whisper aligns the line's own Hindi words to the recording, then the recording's pauses are fitted to the word boundaries (a pause comes between words, mostly where the line is punctuated; a short silence can be a stop inside a word, as in सप्तभुज). That tool needs `faster-whisper` and a multilingual model; its header says how to get them.
- **The build.** `npm run build:hindi-voice` (`tools/voice/build-hindi-voice.py`, ffmpeg only) makes, from the delivered files and the map: each lesson line as `assets/audio/lesson/hi/<name>`, under its English take's name, cut and levelled as the English takes are; `src/lesson/recordings-hi.js`, the Hindi catalogue (each row found by its English, with its Hindi words' times and each English cue word's moment in the Hindi take); and Frozen Rush's Hindi take, `game/assets/audio/vo-lines-hi`, with its windows in `CFG.vo.langs.hi` (`game/js/engine.js` and its bundle) and its hashes in the game's asset versions.
- **At run time.** `src/i18n/i18n.js` loads the catalogue with the Hindi words, for the page that asks for it (`data-voice` on its tag in `index.html`), so nothing is said before it is in. `PolygonRecordedVoice.find()` then returns the Hindi take of a line, and the lesson, the recap and Swiftee over the game play it, showing each word on its own time. The game waits for its page's words and plays its Hindi take with them (`AudioManager.voTake`); its tutorial times each Hindi sentence by that take's words (`Tutorial.ownVoice`). If the Hindi words do not load, the page and its voice both stay English.
- **A line with no Hindi take** is shown in Hindi at a reading pace, without a voice, never in the English voice under Hindi words. Every line has one now: the last to come, `127.flac` ("ठीक 5 भुजाओं वाली हर आकृति ढूँढें।", a hint on the pentagon quiz), was delivered after the rest.
- The drafted story and its Help Momo scene (`?story=1`) stay English, voice and words.

## Testing

```bash
npm install                            # newer npm may ask you to approve the install
                                       # scripts: npm install-scripts approve ffmpeg-static
npx playwright install chromium        # and `webkit` to test Safari's engine
npm test                               # lesson smoke + story on 6 screens + user flows + the runner hand-off
                                       # + the story into the game + Swiftee loading (~14 min)
npm run test:opening                   # the game's cover and tutorial, Swiftee at the broken path, the snow into the lesson,
                                       # and the return: the avalanche, Swiftee at the ditch, the plank (~3 min)
npm run test:runner                    # just the hand-off: ?game=1, the Help Momo button, ?game=0 (~2 min)
npm run test:i18n                      # the languages (?lan=): the JSON, every line in five languages, every screen in Hindi,
                                       # the game's tutorial and plank in Hindi, ?lan=xx left in English (~10 min)
npm run test:hindi-voice               # the Hindi voice with real audio: every screen in its Hindi take, its words keeping to it,
                                       # the recap, the opening, the end and the return; Marathi and English keep the English (~8 min)
npm run test:bridge                    # Help Momo and the lesson's ending: order, locking, voice, Next, the game starting by itself (~5 min)
npm run test:swiftee                   # Swiftee loading: sheet table, cold / slow / warm loads, state races (~2 min)
npm run test:recap                     # the recap: states in order, voice, word cues, layout, phones, Next into the quizzes (~5 min)
BASE=https://tarun-figmaboy-838.github.io/polygon-2/ npm run test:swiftee   # the same against a deployed site
npm run test:checks                    # 33 focused lesson checks incl. the full 47-screen playthrough (~20 min)
npm run test:media                     # the formats: AVIF and WebP, Opus and MP3, one format per picture, and the game's
                                       # generated files; then the same pages with no AVIF and with no Ogg (~2 min)
ENGINE=webkit npm test                 # the same in Safari's engine
```

Screenshots of every story panel on every screen size are saved to `tests/output/story/`.

## Deploy

- **GitHub Pages** serves the `main` branch as it is. Every push updates the live game within a minute or two.
- **Vercel** works too: framework preset **Other**, no build command. `.vercelignore` keeps tools, tests, docs and source art out of the deploy; `game/` ships with the page.

## Notes

- The screen navigator (the "Screens" jump menu and the Back and Next buttons at the top of the lesson) is hidden from learners. Open the page with `?dev=1` to use it. The story gets the same menu, "Scenes": jump to any of its nine scenes, even before Play, and it plays on from there into the lesson. The runner has a review control of its own, a "Skip to ending" pill in its bottom-left corner; `game/index.html` says how to remove it.
- Text files are stored with LF line endings (`.gitattributes`), so an editor that switches line endings can no longer make files look modified.
