#!/usr/bin/env python3
"""Render Swiftee's lines that have no studio take yet, with the macOS voices.

These are PLACEHOLDER takes, so the lines play with sound and with word-by-word
text until the studio recordings exist (docs/voice/VO-LIST.md lists them).
They are made the way the story's placeholders are (tools/story/build-story-voice.py,
whose steps this reuses): Tara, the Indian English voice, slowed to Swiftee's steady
classroom pace and lifted a little for a small bright bird; trimmed, levelled to the
lesson's loudness, and word starts measured from the finished audio.

Each line becomes one lesson recording, as the lesson's studio takes are:
assets/audio/lesson/<file>.ogg + .mp3, and a row with its duration and word starts
in src/lesson/recordings.js (added, or replaced when the text is already there).
To use a studio take instead, put its .ogg and .mp3 under the same name and give
its row the take's own word starts (tools/voice/extract-word-timings.cjs).

Usage (macOS only, from the project folder, after `npm install`):
    npm run build:swiftee-lines              every line below
    npm run build:swiftee-lines -- 91 92     only the files whose names start with these
"""
import importlib.util
import json
import os
import re
import subprocess
import sys
import tempfile

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(os.path.dirname(HERE))
spec = importlib.util.spec_from_file_location('storyvoice', os.path.join(ROOT, 'tools', 'story', 'build-story-voice.py'))
SV = importlib.util.module_from_spec(spec)
spec.loader.exec_module(SV)

OUT_DIR = os.path.join(ROOT, 'assets', 'audio', 'lesson')
RECORDINGS = os.path.join(ROOT, 'src', 'lesson', 'recordings.js')
SWIFTEE = {'voice': 'Tara', 'cents': 150, 'rate': 0.74}   # about 140 words a minute, a touch brighter

LINES = [
    # the Help Momo scene, after the story: why the lesson comes first
    {'file': '89_But_for_that_first_you_need_to_learn_about_polygons',
     'text': 'But for that first you need to learn about polygons.'},
    # the recap before the quizzes (screen 41): its opening line, and the turn to the names
    {'file': '91_Lets_recall_what_we_learnt_today',
     'text': "Let's recall what we learnt today."},
    {'file': '92_Polygons_have_different_names_based_on_their_number_of_sides',
     'text': 'Polygons have different names based on their number of sides.'},
    # the last screen, after the quizzes: the line back to Momo, then the game starts
    {'file': '93_Now_you_know_everything_about_polygons_You_are_ready_to_help_Momo',
     'text': 'Now you know everything about polygons. You are ready to help Momo.'},
    # (L79, "You know all about polygons now. You are ready to help Momo.", is recorded now:
    #  assets/audio/source/swiftee-lesson-3.mp3, built by tools/voice/cut-recordings.py.
    #  It is not rendered here, so this cannot overwrite it.)
]


def main():
    if sys.platform != 'darwin':
        raise SystemExit('This builder uses the macOS `say` voices.')
    SV.VOICES['swiftee'] = SWIFTEE
    rows = []
    with tempfile.TemporaryDirectory() as tmp:
        timepitch = SV.compile_timepitch(tmp)
        wanted = [a for a in sys.argv[1:] if not a.startswith('-')]
        for line in LINES:
            if wanted and not any(line['file'].startswith(w) for w in wanted):
                continue
            clip, sr, entry, _ = SV.build({'speaker': 'swiftee', 'text': line['text']}, timepitch, tmp)
            wav = os.path.join(tmp, 'take.wav')
            SV.write_wav(wav, clip, sr)
            base = os.path.join(OUT_DIR, line['file'])
            subprocess.run([SV.FFMPEG, '-y', '-v', 'error', '-i', wav, '-c:a', 'libopus', '-b:a', '40k',
                            '-application', 'voip', base + '.ogg'], check=True)
            subprocess.run([SV.FFMPEG, '-y', '-v', 'error', '-i', wav, '-c:a', 'libmp3lame', '-q:a', '5',
                            base + '.mp3'], check=True)
            rows.append({'text': line['text'], 'src': 'assets/audio/lesson/' + line['file'] + '.mp3',
                         'duration': entry['duration'],
                         'words': [{'word': w['text'], 'start': w['start']} for w in entry['words']],
                         'source': entry['source'] + '; word starts measured from the rendered audio'})
            print('%5.2fs  %s' % (entry['duration'], '  '.join('%s@%.2f' % (w['text'], w['start']) for w in entry['words'])))

    # Add each row to the lesson's catalogue, or replace the row with the same text.
    src = open(RECORDINGS, encoding='utf-8').read()
    m = re.search(r'window\.POLYGON_RECORDINGS\s*=\s*(\[.*\]);?\s*$', src, re.S)
    if not m:
        raise SystemExit('could not read ' + RECORDINGS)
    table = json.loads(m.group(1))
    for row in rows:
        table = [r for r in table if r['text'] != row['text']] + [row]
    with open(RECORDINGS, 'w', encoding='utf-8') as f:
        f.write(src[:m.start(1)] + json.dumps(table, indent=2, ensure_ascii=False) + ';\n')


if __name__ == '__main__':
    main()
