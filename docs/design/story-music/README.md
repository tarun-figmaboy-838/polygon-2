# Story music

The background music of the Momo + Polo story, as a kit to use in another game's story.

| File | What it is |
|---|---|
| `story-music.ogg` | The music, Ogg Opus (705 KB) |
| `story-music.mp3` | The same, MP3, for browsers without Ogg (1.2 MB) |
| `story-music.js` | The player: moods, crossfades, loops, the dip under a voice |
| `index.html` | A demo: press Play, then try each mood and the dip |

Copy the two music files and `story-music.js` into your game, side by side or wherever you like.

## The five moods

It is one file with a section per mood. Four of the sections loop seamlessly (the loop point already carries its own reverb tail), and `resolve` plays once, to the end.

| Mood | Seconds | Loops | In the Momo + Polo story | Sounds like |
|---|---|---|---|---|
| `warm` | 0 - 24 | yes | scenes 1-3, the friends and the find | a curious music box over a soft pad |
| `playful` | 24 - 36 | yes | scenes 4-5, pulling the treasure out | the same chords, plucked, livelier |
| `tension` | 36 - 48 | yes | scenes 6-7, the ice cracks, "Run!" | a minor turn, a low pulse, a thin shimmer |
| `hush` | 48 - 60 | yes | scene 8, apart across the gap | one quiet chord, a falling music box line |
| `resolve` | 60 - 76.5 | no | scene 9, "I will find another way!" | F - G - C, the melody comes home |

## Use it

```html
<script src="story-music.js"></script>
<script>
  var music = StoryMusic.create({ src: 'story-music' });   // no extension: .ogg, else .mp3

  playButton.addEventListener('click', function () {
    music.unlock();          // inside a tap: browsers only allow sound after one
    music.mood('warm');      // starts as soon as the file has loaded
  });

  // as your story moves on
  music.mood('tension');     // crossfades (1.4 s; 0.7 s into tension)
  music.duck(true);          // a voice line starts: the music dips to 55%
  music.duck(false);         // the line ends: back up
  music.fadeOut(1.2);        // the end of the story
  music.stop();              // stop and free the audio
</script>
```

Options for `StoryMusic.create`: `src` (the path without its extension), `level` (how loud the bed is, 0 to 1, default 0.12, which sits well under voices), `duck` (the level while a voice speaks, as a share, default 0.55), `sections` (your own table, if you render different music), and `context` (an AudioContext your page already has, so the music shares it).

Every call is safe at any time. A `mood()` before the file has loaded is kept and plays when it arrives. With no Web Audio or no file, every call does nothing and the story carries on silently. `music.ready` resolves `true` once the music is in, and `music.state()` says what is playing.

## Where it comes from

It is an original score, composed and rendered for this project by `tools/story/build-story-music.cjs` (there are no samples or licensed recordings in it). To change it, edit the score there and run `npm run build:story-music`: it writes new music files and prints the section table to put in `StoryMusic.SECTIONS` (or pass it as `sections`). In the Momo + Polo story itself the same player lives in `src/story/story-intro.js` (`createAudio`, `A.mood`, `A.duck`), with its table in `src/story/story-data.js`.
