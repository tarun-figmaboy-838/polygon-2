#!/usr/bin/env python3
"""Render the Momo + Popo story lines with the macOS speech voices.

These are PLACEHOLDER takes, made so the story plays with sound and with
word-synchronised text until studio recordings exist.

THE STORY NOW PLAYS RECORDED VOICES, built from the delivered recordings by
tools/voice/cut-recordings.py (`npm run build:recorded-voice`). Running this
would replace them with the macOS voices, so it asks to be told so:
    python3 tools/story/build-story-voice.py --placeholders

The story shows one short line at a time ("Momo, look!" ... "Something is
buried here!"), so each line is its own take. All takes are joined into ONE file, assets/audio/story/story-voice
(.ogg + .mp3), with short silences between them; src/story/story-voice.js
lists where each take starts, how long it is, and when each word is spoken.
To use studio recordings, rebuild that file and table the same way.

Why each step exists:
  - The Indian English voices (Tara, Aman) speak at about 190 words a minute
    and ignore rate and pitch commands. story-timepitch.swift runs each take
    through Apple's time/pitch unit, which slows it to a child-friendly pace
    and, for the two characters, raises the pitch without rushing them.
  - `say` reports no word timings, so word starts are measured from the
    finished audio: pauses the voice really made are found in the loudness
    envelope, and the words are fitted between them by syllable weight.
    Punctuation boundaries are matched first, because that is where a speaker
    actually pauses.
  - Every take is trimmed and levelled to the same loudness so the three
    voices sit together and the music ducking treats them all alike.

Usage (macOS only, from the project folder, after `npm install`):
    npm run build:story-voice
"""
import array
import glob
import json
import math
import os
import re
import subprocess
import sys
import tempfile
import wave

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(os.path.dirname(HERE))
OUT_DIR = os.path.join(ROOT, 'assets', 'audio', 'story')
TIMINGS_JS = os.path.join(ROOT, 'src', 'story', 'story-voice.js')
# ffmpeg with libopus + libmp3lame: $FFMPEG, else the ffmpeg-static dev dependency, else PATH.
_BUNDLED = os.path.join(ROOT, 'node_modules', 'ffmpeg-static', 'ffmpeg')
FFMPEG = os.environ.get('FFMPEG') or (_BUNDLED if os.path.exists(_BUNDLED) else 'ffmpeg')
TIMEPITCH_SRC = os.path.join(HERE, 'story-timepitch.swift')

# Voice per speaker: pitch in cents, rate < 1 slows the speech down.
VOICES = {
    'narrator': {'voice': 'Tara', 'cents': 0,   'rate': 0.84},  # warm, calm Indian English narrator
    'momo':     {'voice': 'Aman', 'cents': 550, 'rate': 0.80},  # warm, lower child voice
    'polo':     {'voice': 'Tara', 'cents': 750, 'rate': 0.90},  # bright, energetic child voice
}

# The exact story script, cut into single lines. The story shows one line at
# a time in one box, and each line is spoken as its own take; joined with
# spaces, a scene's lines are exactly its script line.
# `rate` overrides the speaker's pace for one line.
PARTS = [
    {'id': 'scene-1/1', 'speaker': 'narrator', 'text': 'Long ago,'},
    {'id': 'scene-1/2', 'speaker': 'narrator', 'text': 'Momo the mammoth and Popo the polar bear'},
    {'id': 'scene-1/3', 'speaker': 'narrator', 'text': 'were best friends.'},
    {'id': 'scene-2/1', 'speaker': 'narrator', 'text': 'One day,'},
    {'id': 'scene-2/2', 'speaker': 'narrator', 'text': 'Popo spotted something shiny'},
    {'id': 'scene-2/3', 'speaker': 'narrator', 'text': 'beneath the ice.'},
    {'id': 'scene-3/1', 'speaker': 'polo', 'text': 'Momo, look!'},
    {'id': 'scene-3/2', 'speaker': 'polo', 'text': 'Something is buried here!'},
    {'id': 'scene-4/1', 'speaker': 'momo', 'text': 'Let us pull it out!'},
    {'id': 'scene-5/1', 'speaker': 'polo', 'text': 'Almost there!'},
    {'id': 'scene-5/2', 'speaker': 'polo', 'text': 'One more pull!'},
    {'id': 'scene-6/1', 'speaker': 'momo', 'text': 'Uh-oh...', 'rate': 0.62},   # small and cautious
    {'id': 'scene-7/1', 'speaker': 'polo', 'text': 'Run!', 'rate': 1.0},        # the urgent beat
    {'id': 'scene-8/1', 'speaker': 'momo', 'text': 'Popo!', 'rate': 0.68},      # calling across the crack
    {'id': 'scene-9/1', 'speaker': 'polo', 'text': 'Momo, keep going!', 'rate': 0.86},
    {'id': 'scene-9/2', 'speaker': 'polo', 'text': 'I will find another way!', 'rate': 0.86},
]
GAP = 0.35   # silence between takes in the joined file, seconds

OUT_RATE = 24000
WIN = 0.010            # envelope window, seconds
TARGET_RMS_DB = -19.0  # loudness of the speech, dBFS
PEAK_CEIL_DB = -1.5


def db(x):
    return 20 * math.log10(max(x, 1e-9))


def read_wav(path):
    with wave.open(path, 'rb') as f:
        sr, n, width, ch = f.getframerate(), f.getnframes(), f.getsampwidth(), f.getnchannels()
        raw = f.readframes(n)
    if width != 2 or ch != 1:
        raise SystemExit('expected 16-bit mono, got %d-byte %d-channel' % (width, ch))
    samples = array.array('h')
    samples.frombytes(raw)
    if sys.byteorder != 'little':
        samples.byteswap()   # WAV is little-endian
    return samples, sr


def write_wav(path, samples, sr):
    out = array.array('h', samples)
    if sys.byteorder != 'little':
        out.byteswap()
    with wave.open(path, 'wb') as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(sr)
        w.writeframes(out.tobytes())


def envelope(samples, sr):
    step = int(sr * WIN)
    out = []
    for i in range(0, len(samples), step):
        chunk = samples[i:i + step]
        if not chunk:
            break
        out.append(math.sqrt(sum(s * s for s in chunk) / len(chunk)))
    return out


def syllables(word):
    w = re.sub(r'[^a-z]', '', word.lower())
    n = len(re.findall(r'[aeiouy]+', w))
    if w.endswith('e') and n > 1 and not w.endswith(('le', 'ee')):
        n -= 1
    return max(1, n)


def weight(word):
    return syllables(word) + 0.06 * len(re.sub(r'[^A-Za-z]', '', word))


def pause_after(word):
    if word.endswith('...'):
        return 1.3
    if word.endswith(('!', '.', '?')):
        return 0.9
    if word.endswith((',', ';', ':')):
        return 0.55
    return 0.0


def speech_bounds(env):
    peak = max(env) or 1.0
    audible = [e > peak * 0.012 for e in env]       # includes soft word tails
    first = next(i for i, v in enumerate(audible) if v)
    last = len(audible) - 1 - next(i for i, v in enumerate(reversed(audible)) if v)
    return first, last


def word_starts(env, words):
    """Fit word starts to the pauses the voice really made."""
    peak = max(env) or 1.0
    loud = [e > peak * 0.045 for e in env]          # clearly speech
    first, last = speech_bounds(env)
    t0, t1 = first * WIN, (last + 1) * WIN

    gaps, run = [], None
    for i in range(first, last + 1):
        if not loud[i]:
            run = i if run is None else run
        elif run is not None:
            if (i - run) * WIN >= 0.06:
                gaps.append((run * WIN, i * WIN))
            run = None

    n = len(words)
    wts = [weight(w) for w in words]
    pauses = [pause_after(w) for w in words]
    total = sum(wts) + sum(pauses[:-1])
    predicted, acc = [], 0.0
    for i in range(n):
        predicted.append(t0 + (t1 - t0) * acc / total)
        acc += wts[i] + pauses[i]

    anchors, used = {0: t0}, set()
    order = sorted(range(1, n), key=lambda i: (pauses[i - 1] == 0, i))
    for i in order:
        tol = 0.5 if pauses[i - 1] else 0.18
        best = None
        for gi, (gs, ge) in enumerate(gaps):
            if gi in used:
                continue
            d = abs(ge - predicted[i])
            if d <= tol and (best is None or d < best[0]):
                best = (d, gi, ge)
        if best is None:
            continue
        lo = max([t for k, t in anchors.items() if k < i], default=t0)
        hi = min([t for k, t in anchors.items() if k > i], default=t1)
        if lo < best[2] < hi:
            anchors[i] = best[2]
            used.add(best[1])

    starts = [0.0] * n
    keys = sorted(anchors) + [n]
    ends = dict(anchors)
    ends[n] = t1
    for a, b in zip(keys, keys[1:]):
        seg = [wts[k] + (pauses[k] if k < b - 1 else 0) for k in range(a, b)]
        tot = sum(seg) or 1
        acc = 0.0
        for k in range(a, b):
            starts[k] = ends[a] + (ends[b] - ends[a]) * acc / tot
            acc += seg[k - a]
    return starts, gaps


def compile_timepitch(tmp):
    exe = os.path.join(tmp, 'story-timepitch')
    attempts = [[]] + [['-sdk', sdk] for sdk in sorted(
        glob.glob('/Library/Developer/CommandLineTools/SDKs/MacOSX*.sdk'), reverse=True)]
    for extra in attempts:
        r = subprocess.run(['swiftc', '-O'] + extra + ['-o', exe, TIMEPITCH_SRC],
                           capture_output=True, text=True)
        if r.returncode == 0:
            return exe
    raise SystemExit('could not compile story-timepitch.swift:\n' + r.stderr[-800:])


def build(line, timepitch, tmp):
    """Render one take: speak, pitch/pace, trim, level, measure word starts."""
    cfg = VOICES[line['speaker']]
    rate = line.get('rate', cfg['rate'])
    words = line['text'].split(' ')
    raw = os.path.join(tmp, 'raw.wav')
    stretched = os.path.join(tmp, 'stretched.wav')
    pcm = os.path.join(tmp, 'pcm.wav')
    subprocess.run(['say', '-v', cfg['voice'], '--file-format=WAVE', '--data-format=LEI16',
                    '-o', raw, line['text']], check=True)
    subprocess.run([timepitch, raw, stretched, str(cfg['cents']), str(rate)], check=True)
    subprocess.run(['afconvert', '-f', 'WAVE', '-d', 'LEI16@%d' % OUT_RATE, stretched, pcm], check=True)
    samples, sr = read_wav(pcm)

    # Trim to the speech with a short margin, and fade the cut edges.
    first, last = speech_bounds(envelope(samples, sr))
    a = max(0, int((first * WIN - 0.04) * sr))
    b = min(len(samples), int(((last + 1) * WIN + 0.08) * sr))
    clip = samples[a:b]
    fade = int(0.006 * sr)
    for i in range(min(fade, len(clip) // 2)):
        k = i / fade
        clip[i] = int(clip[i] * k)
        clip[-1 - i] = int(clip[-1 - i] * k)

    # Level: speech RMS to the target, never above the peak ceiling.
    env = envelope(clip, sr)
    pk = max(env)
    speech = [e for e in env if e > pk * 0.045] or env
    rms = math.sqrt(sum(e * e for e in speech) / len(speech))
    peak = max(abs(s) for s in clip) or 1
    gain = min(10 ** ((TARGET_RMS_DB - db(rms / 32768)) / 20),
               10 ** ((PEAK_CEIL_DB - db(peak / 32768)) / 20))
    clip = array.array('h', (max(-32768, min(32767, int(round(s * gain)))) for s in clip))

    starts, gaps = word_starts(envelope(clip, sr), words)
    return clip, sr, {
        'speaker': line['speaker'],
        'text': line['text'],
        'duration': round(len(clip) / sr, 3),
        'words': [{'text': w, 'start': round(s, 3)} for w, s in zip(words, starts)],
        'source': 'macOS say -v %s, pitch %+d cents, pace x%.2f (placeholder take)' % (
            cfg['voice'], cfg['cents'], rate),
    }, gaps


def main():
    if '--placeholders' not in sys.argv[1:]:
        raise SystemExit('The story plays the recorded voices (npm run build:recorded-voice). '
                         'To replace them with the macOS placeholder voices, run this with --placeholders.')
    if sys.platform != 'darwin':
        raise SystemExit('This builder uses the macOS `say` voices.')
    os.makedirs(OUT_DIR, exist_ok=True)
    joined, parts, rate = array.array('h'), {}, None
    with tempfile.TemporaryDirectory() as tmp:
        timepitch = compile_timepitch(tmp)
        for line in PARTS:
            clip, sr, entry, gaps = build(line, timepitch, tmp)
            rate = rate or sr
            joined.extend([0] * int(GAP * sr))
            entry['offset'] = round(len(joined) / sr, 4)
            joined.extend(clip)
            parts[line['id']] = entry
            print('%-10s %-9s %5.2fs @%6.2fs  %s' % (line['id'], line['speaker'], entry['duration'], entry['offset'],
                  '  '.join('%s@%.2f' % (w['text'], w['start']) for w in entry['words'])))
        joined.extend([0] * int(GAP * rate))
        wav = os.path.join(tmp, 'story-voice.wav')
        write_wav(wav, joined, rate)
        base = os.path.join(OUT_DIR, 'story-voice')
        subprocess.run([FFMPEG, '-y', '-v', 'error', '-i', wav, '-c:a', 'libopus', '-b:a', '40k',
                        '-application', 'voip', base + '.ogg'], check=True)
        subprocess.run([FFMPEG, '-y', '-v', 'error', '-i', wav, '-c:a', 'libmp3lame', '-q:a', '5',
                        base + '.mp3'], check=True)
    table = {'src': 'assets/audio/story/story-voice', 'parts': parts}
    with open(TIMINGS_JS, 'w', encoding='utf-8') as f:
        f.write('/* Generated by tools/story/build-story-voice.py. One file holds every take;\n'
                '   `offset` is where a take starts in it, `duration` how long it is, and word\n'
                '   starts are seconds from the start of the take. The player picks .ogg or .mp3. */\n')
        f.write('window.STORY_VOICE = ' + json.dumps(table, indent=2, ensure_ascii=False) + ';\n')
    print('wrote', os.path.relpath(base, ROOT) + '.ogg/.mp3 (%.1fs) and %s' % (len(joined) / rate, os.path.relpath(TIMINGS_JS, ROOT)))


if __name__ == '__main__':
    main()
