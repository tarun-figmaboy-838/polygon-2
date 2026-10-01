#!/usr/bin/env node
/* The learning section's own music: a loop cut from the original score that was composed
   for this project (assets/audio/story/story-music, tools/story/build-story-music.cjs).

   Its first two sections, `warm` (8 bars: a curious music box over a soft pad) and `playful`
   (4 bars: the same chords, plucked and livelier), 0-36 s, written to loop and sharing their
   chords, so they run on into each other and back round. The Frozen Rush game keeps its own
   music; this one is heard only in the lesson (src/lesson/lesson-music.js).

   The cut is brought to the game bed's loudness (-18.2 LUFS integrated), so the lesson's
   music sits where it did, and given a few milliseconds of fade at each end so the loop
   point cannot click.

   Usage:  node tools/build-lesson-music.cjs        (npm run build:lesson-music)
   Output: assets/audio/music/lesson-music.ogg (+ .mp3 for browsers without Ogg Opus) */
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const SRC = path.join(ROOT, 'assets', 'audio', 'story', 'story-music.ogg');
const OUT = path.join(ROOT, 'assets', 'audio', 'music', 'lesson-music');
const FROM = 0, TO = 36;           // warm + playful, in seconds of the score
const TARGET = -18.2;              // LUFS, the game bed's own loudness

function ffmpeg() {
  if (process.env.FFMPEG) return process.env.FFMPEG;
  try { return require('ffmpeg-static'); } catch (e) {}
  return 'ffmpeg';
}
const FF = ffmpeg();

function loudness() {
  const out = require('child_process').spawnSync(FF, ['-hide_banner', '-ss', String(FROM), '-t', String(TO - FROM), '-i', SRC,
    '-af', 'ebur128', '-f', 'null', '-'], { encoding: 'utf8' }).stderr;
  const m = out.slice(out.lastIndexOf('Summary:')).match(/I:\s+(-?[\d.]+) LUFS/);
  if (!m) throw new Error('could not measure ' + SRC);
  return parseFloat(m[1]);
}

const gain = TARGET - loudness();
const filter = 'volume=' + gain.toFixed(2) + 'dB,afade=t=in:st=0:d=0.015,afade=t=out:st=' + (TO - FROM - 0.025).toFixed(3) + ':d=0.025';
fs.mkdirSync(path.dirname(OUT), { recursive: true });
const common = ['-y', '-v', 'error', '-ss', String(FROM), '-t', String(TO - FROM), '-i', SRC, '-af', filter, '-fflags', '+bitexact', '-flags:a', '+bitexact'];
execFileSync(FF, common.concat(['-c:a', 'libopus', '-b:a', '96k', OUT + '.ogg']));
execFileSync(FF, common.concat(['-c:a', 'libmp3lame', '-b:a', '160k', OUT + '.mp3']));
console.log('lesson music: ' + (TO - FROM) + ' s from the score, ' + gain.toFixed(1) + ' dB -> ' + path.relative(ROOT, OUT) + '.ogg / .mp3');
