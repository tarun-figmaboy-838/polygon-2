#!/usr/bin/env python3
"""Cut the delivered voice recordings into the lines the experience plays.

The voices were delivered as long recordings, several lines to a file
(assets/audio/source/). docs/voice/cue-map.json says where every line is in its
file and when each of its words starts; this reads that map and builds, from the
recordings and nothing else:

  story    the 16 story parts, joined into assets/audio/story/story-voice (.ogg + .mp3)
           with their table in src/story/story-voice.js, as the story player expects
  lesson   each of Swiftee's lesson lines as assets/audio/lesson/<name> (.ogg + .mp3),
           the name its catalogue row in src/lesson/recordings.js already uses, and
           that row's duration and word starts
  bridge   Swiftee's two Broken Path lines (the Help Momo scene) as
           assets/audio/bridge/<name> (.ogg + .mp3), with a row in that catalogue too,
           so the scene finds them by their words as it finds its third line
  game     Frozen Rush's take: the delivered file itself as game/assets/audio/vo-lines
           (.mp3 as delivered, .ogg made from it), with the window and word starts of
           each line written into CFG.vo.lines in game/js/engine.js and its bundle, and
           the take's content hash into the game's asset versions

Lines marked unused or skip in the map are not cut (the map still lists them, so it
accounts for every second of every recording).

Each line is cut a little wider than its speech (PAD), never past halfway into the
pause either side, faded at the cut, and levelled with one gain per recording, so a
voice keeps its own dynamics from line to line. Word starts are measured from the
cut, so the words on screen land on the words being said.

Usage (from the project folder, after `npm install`):
    npm run build:recorded-voice                 everything
    npm run build:recorded-voice -- --only L79   just these lesson or bridge lines (ids from the
                                                 cue map, comma-separated); the story's parts and
                                                 the game's windows are always built together
"""
import array
import hashlib
import json
import os
import re
import shutil
import subprocess
import sys
import tempfile
import wave

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(os.path.dirname(HERE))
CUES = os.path.join(ROOT, 'docs', 'voice', 'cue-map.json')
_BUNDLED = os.path.join(ROOT, 'node_modules', 'ffmpeg-static', 'ffmpeg')
FFMPEG = os.environ.get('FFMPEG') or (_BUNDLED if os.path.exists(_BUNDLED) else 'ffmpeg')
RATE = 44100

# Silence kept before and after a line's speech, seconds. The lesson's lines play one
# file at a time, so they keep the breath of room a studio take has; the story's parts
# are joined with their own pauses and the game's windows sit inside one take, so theirs
# only clear the attack and the tail.
PAD = {'lesson': (0.25, 0.25), 'bridge': (0.25, 0.25), 'story': (0.06, 0.12), 'game': (0.06, 0.12)}
# Loudness each recording is brought to (integrated LUFS), the level the parts already
# sit at: the lesson's studio takes, the story's mix under its music. Peaks stay below
# PEAK_CEIL. The game's take is used as delivered.
TARGET = {'lesson': -21.5, 'bridge': -21.5, 'story': -20.5}
PEAK_CEIL = -1.5
STORY_GAP = 0.35   # silence between parts in the joined story file
SPEAKER = {'story-narrator': 'narrator', 'story-popo': 'polo', 'story-momo': 'momo'}   # the story's speaker ids
BRIDGE_FILES = {'B1': 'bridge-1-path-is-broken', 'B2': 'bridge-2-help-momo-cross'}
NEW_LESSON_FILES = {'L21': '88_Is_the_boundary_straight_or_curved'}

NUM = 'zero one two three four five six seven eight nine'.split()


def normalize(text):
    """The lesson's own text match (src/lesson/recorded-player.js)."""
    t = re.sub(r'[0-9]', lambda m: NUM[int(m.group())], text.lower())
    return re.sub(r'[^a-z]+', ' ', re.sub(r"[’']", '', t)).strip()


def run(args):
    return subprocess.run(args, check=True, capture_output=True, text=True)


def loudness(path):
    out = subprocess.run([FFMPEG, '-hide_banner', '-i', path, '-af', 'ebur128=peak=true', '-f', 'null', '-'],
                         capture_output=True, text=True).stderr
    summary = out[out.rfind('Summary:'):]
    i = float(re.search(r'I:\s+(-?[\d.]+) LUFS', summary).group(1))
    peak = float(re.search(r'Peak:\s+(-?[\d.]+) dBFS', summary).group(1))
    return i, peak


def decode(path):
    raw = subprocess.run([FFMPEG, '-v', 'error', '-i', path, '-ac', '1', '-ar', str(RATE), '-f', 's16le', '-'],
                         capture_output=True, check=True).stdout
    a = array.array('h')
    a.frombytes(raw)
    if sys.byteorder != 'little':
        a.byteswap()
    return a


def write_wav(path, samples):
    out = array.array('h', samples)
    if sys.byteorder != 'little':
        out.byteswap()
    with wave.open(path, 'wb') as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(RATE)
        w.writeframes(out.tobytes())


def encode(wav, base):
    os.makedirs(os.path.dirname(base), exist_ok=True)
    # bitexact: no random Ogg stream serial, so the same cut always makes the same file
    run([FFMPEG, '-y', '-v', 'error', '-i', wav, '-c:a', 'libopus', '-b:a', '40k', '-application', 'voip',
         '-fflags', '+bitexact', '-flags:a', '+bitexact', base + '.ogg'])
    run([FFMPEG, '-y', '-v', 'error', '-i', wav, '-c:a', 'libmp3lame', '-b:a', '128k',
         '-fflags', '+bitexact', '-flags:a', '+bitexact', base + '.mp3'])


def window(line, prev, nxt, total):
    """[from, to] of the cut: the speech plus its pad, never past halfway into a pause."""
    pre, post = PAD.get(line['use'], PAD['lesson'])
    if prev:
        pre = min(pre, (line['start'] - prev['end']) / 2)
    post = min(post, ((nxt['start'] if nxt else total) - line['end']) / 2)
    return max(0.0, line['start'] - pre), min(total, line['end'] + post)


def cut(samples, lo, hi, gain_db):
    a, b = int(round(lo * RATE)), int(round(hi * RATE))
    g = 10 ** (gain_db / 20)
    clip = array.array('h', (max(-32768, min(32767, int(round(s * g)))) for s in samples[a:b]))
    fade = int(0.006 * RATE)
    for i in range(min(fade, len(clip) // 2)):
        k = i / fade
        clip[i] = int(clip[i] * k)
        clip[-1 - i] = int(clip[-1 - i] * k)
    return clip


def starts(line, lo):
    """(token, start in the cut) for every token with letters in it."""
    out = []
    for tok, t in zip(line['text'].split(), line['words']):
        if normalize(tok):
            out.append((tok, round(max(0.0, t - lo), 3)))
    return out


def read_catalogue(path):
    src = open(path, encoding='utf-8').read()
    m = re.search(r'window\.POLYGON_RECORDINGS\s*=\s*(\[.*\]);?\s*$', src, re.S)
    if not m:
        raise SystemExit('could not read ' + path)
    return src[:m.start(1)], json.loads(m.group(1))


def main():
    cue = json.load(open(CUES, encoding='utf-8'))
    lines = cue['lines']
    only = None
    if '--only' in sys.argv[1:]:
        only = set(sys.argv[sys.argv.index('--only') + 1].split(','))
        known = {l['id']: l['use'] for l in lines}
        for i in only:
            if i not in known:
                raise SystemExit('no line %s in the cue map' % i)
            if known[i] in ('story', 'game', 'skip'):
                raise SystemExit('%s is a %s line: the story and the game are built whole; run without --only' % (i, known[i]))
    by_file = {}
    for l in lines:
        if only is None or l['file'] in {m['file'] for m in lines if m['id'] in only}:
            by_file.setdefault(l['file'], []).append(l)

    head, catalogue = read_catalogue(os.path.join(ROOT, 'src', 'lesson', 'recordings.js'))
    story_parts, game_windows, made = {}, {}, []
    joined = array.array('h')

    with tempfile.TemporaryDirectory() as tmp:
        for name, group in by_file.items():
            src = os.path.join(ROOT, cue['sources'][name]['src'])
            uses = {l['use'] for l in group} - {'unused', 'skip'}
            samples = decode(src)
            total = len(samples) / RATE
            i_lufs, peak = loudness(src)
            use = next(iter(uses)) if uses else None
            gain = 0.0
            if use in TARGET:
                gain = min(TARGET[use] - i_lufs, PEAK_CEIL - peak)
            print('%-18s %6.1fs  %5.1f LUFS, peak %5.1f dB  -> gain %+.1f dB' % (name, total, i_lufs, peak, gain))
            spoken = [l for l in group]          # every line, for the pauses either side
            for k, line in enumerate(spoken):
                if line['use'] == 'skip' or (only is not None and line['id'] not in only):
                    continue
                prev = spoken[k - 1] if k else None
                nxt = spoken[k + 1] if k + 1 < len(spoken) else None
                lo, hi = window(line, prev, nxt, total)
                words = starts(line, lo)
                note = '%s, %.2f-%.2f s' % (os.path.basename(cue['sources'][name]['src']), lo, hi)

                if line['use'] == 'game':
                    game_windows[line['id']] = (round(lo, 2), round(hi - lo, 2), [round(t, 2) for _, t in words], line['text'])
                    continue

                clip = cut(samples, lo, hi, gain)
                duration = round(len(clip) / RATE, 3)

                if line['use'] == 'story':
                    joined.extend([0] * int(STORY_GAP * RATE))
                    story_parts[line['part']] = {
                        'speaker': SPEAKER[name], 'text': line['text'], 'duration': duration,
                        'words': [{'text': w, 'start': t} for w, t in words],
                        'source': 'recorded take: ' + note, 'offset': round(len(joined) / RATE, 4)}
                    joined.extend(clip)
                    continue

                # lesson and bridge lines: one file each, and a catalogue row
                rows = [r for r in catalogue if normalize(r['text']) == normalize(line['text'])]
                if line['use'] == 'bridge':
                    target = 'assets/audio/bridge/' + BRIDGE_FILES[line['id']] + '.mp3'
                elif rows:
                    target = rows[0]['src']
                elif line['id'] in NEW_LESSON_FILES:
                    target = 'assets/audio/lesson/' + NEW_LESSON_FILES[line['id']] + '.mp3'
                else:
                    raise SystemExit('no catalogue row for %s: %s' % (line['id'], line['text']))
                row = rows[0] if rows else {'text': line['text'], 'src': target}
                if not rows:
                    catalogue.append(row)
                for key in ('timingNote',):
                    row.pop(key, None)
                row.update({'src': target, 'duration': duration,
                            'words': [{'word': w, 'start': t} for w, t in words],
                            'source': "Swiftee's recorded take: " + note + '; word starts measured from the recording'})
                wav = os.path.join(tmp, 'line.wav')
                write_wav(wav, clip)
                encode(wav, os.path.join(ROOT, target[:-4]))
                made.append(target[:-4])

        # the story: one file, parts in story order
        if story_parts:
            joined.extend([0] * int(STORY_GAP * RATE))
            wav = os.path.join(tmp, 'story.wav')
            write_wav(wav, joined)
            encode(wav, os.path.join(ROOT, 'assets', 'audio', 'story', 'story-voice'))
            order = sorted(story_parts, key=lambda k: [int(n) for n in re.findall(r'\d+', k)])
            table = {'src': 'assets/audio/story/story-voice', 'parts': {k: story_parts[k] for k in order}}
            with open(os.path.join(ROOT, 'src', 'story', 'story-voice.js'), 'w', encoding='utf-8') as f:
                f.write('/* Generated by tools/voice/cut-recordings.py from the delivered recordings\n'
                        '   (assets/audio/source/story-*.mp3, docs/voice/cue-map.json). One file holds every\n'
                        '   part; `offset` is where a part starts in it, `duration` how long it is, and word\n'
                        '   starts are seconds from the start of the part. The player picks .ogg or .mp3. */\n')
                f.write('window.STORY_VOICE = ' + json.dumps(table, indent=2, ensure_ascii=False) + ';\n')
            print('story: %d parts, %.1fs joined' % (len(story_parts), len(joined) / RATE))

    with open(os.path.join(ROOT, 'src', 'lesson', 'recordings.js'), 'w', encoding='utf-8') as f:
        f.write(head + json.dumps(catalogue, indent=2, ensure_ascii=False) + ';\n')
    print('lesson + bridge: %d files' % len(made))

    if game_windows:
        game_take(cue, game_windows)


def game_take(cue, windows):
    """Frozen Rush plays one take with a window per line (CFG.vo.lines)."""
    name = next(l['file'] for l in cue['lines'] if l['use'] == 'game')
    src = os.path.join(ROOT, cue['sources'][name]['src'])
    base = os.path.join(ROOT, 'game', 'assets', 'audio', 'vo-lines')
    shutil.copyfile(src, base + '.mp3')
    run([FFMPEG, '-y', '-v', 'error', '-i', src, '-c:a', 'libopus', '-b:a', '48k', '-application', 'voip', base + '.ogg'])

    def fmt(key, w):
        lo, length, words, text = w
        pad = ' ' * max(1, 20 - len(key) - 4)
        return "      '%s':%s[%.2f, %.2f, [%s]],   // \"%s\"" % (key, pad, lo, length, ', '.join('%.2f' % t for t in words), text)
    order = [l['id'] for l in cue['lines'] if l['use'] == 'game']
    block = '\n'.join(fmt(k, windows[k]) for k in order)
    total = len(decode(src)) / RATE
    hashes = {rel: hashlib.md5(open(os.path.join(ROOT, 'game', rel), 'rb').read()).hexdigest()[:8]
              for rel in ('assets/audio/vo-lines.mp3', 'assets/audio/vo-lines.ogg')}
    for js in ('game/js/engine.js', 'game/js/game.bundle.js', 'game/js/asset-versions.js'):
        path = os.path.join(ROOT, js)
        s = open(path, encoding='utf-8').read()
        if 'engine' in js or 'bundle' in js:
            s, n = re.subn(r"(    lines: \{\n)(?:      '[^\n]*\n)+", lambda m: m.group(1) + block + '\n', s, count=1)
            if n != 1:
                raise SystemExit('could not find CFG.vo.lines in ' + js)
            s = re.sub(r'THE VOICE-OVER\. The owner recorded every line the learner is shown as ONE take \([\d.]+ s\)',
                       'THE VOICE-OVER. The owner recorded every line the learner is shown as ONE take (%.0f s)' % total, s)
        for rel, h in hashes.items():
            s = re.sub(r'("%s": ")[0-9a-f]{8}(")' % re.escape(rel), r'\g<1>%s\g<2>' % h, s)
        open(path, 'w', encoding='utf-8').write(s)
    print('game: %d windows in a %.1fs take; vo-lines %s' % (len(windows), total, ', '.join('%s %s' % (k[-3:], v) for k, v in hashes.items())))


if __name__ == '__main__':
    main()
