#!/usr/bin/env python3
"""Measure the Hindi voice: where each line's speech is and when each of its words starts.

The Hindi voice-over was delivered as one WAV per line, numbered as its script
(assets/audio/source/hi/script.csv): the keys of src/i18n/locales.json in order, with the
twelve keys nobody hears left out. This finds every line the experience SPEAKS (the lesson's
recorded lines, src/lesson/recordings.js, and Frozen Rush's tutorial and plank, CFG.vo.lines),
takes its delivered file, and writes docs/voice/hi/cue-map.json: per line, where its speech
starts and ends in the file and where each of its shown words starts (seconds in the
delivered file). tools/voice/build-hindi-voice.py then builds everything the page plays from
that map and the files, with no speech recogniser.

How the words are placed: the line's own Hindi words (the words on screen, numerals said as
words) are force-aligned to the recording with Whisper's cross-attention, then each start is
checked against the waveform: the first word starts where the voice does, and a word placed in
a pause starts where the voice resumes. The same Whisper also transcribes each file blind, so
the map carries a check (`heard`, and `match`, how close that is to the script) to catch a
file that says something else.

Lines whose file is missing are listed in the map with "missing": true and are not built;
drop the file into assets/audio/source/hi/ and run this again.

Needs faster-whisper and a multilingual Whisper model (not the .en ones), e.g. in a scratch venv:
    python3 -m venv /tmp/fw && /tmp/fw/bin/pip install faster-whisper
    mkdir -p /tmp/whisper-small && cd /tmp/whisper-small && for f in config.json tokenizer.json \\
      vocabulary.txt model.bin; do curl -fL -C - -o $f \\
      https://huggingface.co/Systran/faster-whisper-small/resolve/main/$f; done
    /tmp/fw/bin/python tools/voice/measure-hindi-voice.py --model /tmp/whisper-small

    --only 50,127      just these line numbers (the rest of the map is kept)
    --keep-cues        keep hand-set "cues" on re-measured lines (the default; --reset-cues drops them)
"""
import argparse
import array
import difflib
import json
import math
import os
import re
import subprocess
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(os.path.dirname(HERE))
LANG = 'hi'
SOURCE = os.path.join(ROOT, 'assets', 'audio', 'source', LANG)
MAP = os.path.join(ROOT, 'docs', 'voice', LANG, 'cue-map.json')
LOCALES = os.path.join(ROOT, 'src', 'i18n', 'locales.json')
RECORDINGS = os.path.join(ROOT, 'src', 'lesson', 'recordings.js')
_BUNDLED = os.path.join(ROOT, 'node_modules', 'ffmpeg-static', 'ffmpeg')
FFMPEG = os.environ.get('FFMPEG') or (_BUNDLED if os.path.exists(_BUNDLED) else 'ffmpeg')

# The keys nobody hears, left out of the script's numbering (the delivered script skips them).
UNSPOKEN = ['uiOptionLetters', 'nameMomo', 'gameName', 'uiCountSide', 'uiCountSides', 'a11yOption',
            'a11yClosedBoundary', 'a11yOpenBoundary', 'a11yLeftTarget', 'a11yLowerRightTarget',
            'a11yUpperRightTarget', 'a11yLabelPlaced']
# Frozen Rush's lines (game/js/engine.js CFG.vo.lines), by the key their words are under.
GAME = [('tut-1-meet', 'gameMeet'), ('tut-2-goal', 'gameGoal'), ('tut-3-watch', 'gameWatchOut'),
        ('tut-4-jump', 'gameTapJump'), ('tut-5-broken', 'gamePathBroken'), ('tut-6-use', 'gameUseIcePiece'),
        ('tut-7-fit', 'gamePerfectFit'), ('sign-triangle', 'signTriangle'),
        ('sign-quadrilateral', 'signQuadrilateral'), ('sign-pentagon', 'signPentagon'),
        ('sign-hexagon', 'signHexagon'), ('sign-heptagon', 'signHeptagon'),
        ('sign-pentagons', 'signPentagons'), ('sign-hexagons', 'signHexagons'),
        ('tut-6b-piece', 'gameUsePiece')]
# Numerals on screen are said as words.
SAID = {'0': 'शून्य', '1': 'एक', '2': 'दो', '3': 'तीन', '4': 'चार', '5': 'पाँच', '6': 'छह', '7': 'सात',
        '8': 'आठ', '9': 'नौ'}
NUM = 'zero one two three four five six seven eight nine'.split()
LETTER = re.compile(r'[ऀ-ॿ0-9A-Za-z]')


def normalize(text):
    """The lesson's own English match (src/lesson/recorded-player.js)."""
    t = re.sub(r'[0-9]', lambda m: NUM[int(m.group())], text.lower())
    return re.sub(r'[^a-z]+', ' ', re.sub(r"[’']", '', t)).strip()


def shown(marked):
    """A line as the page shows it (src/i18n/i18n.js: shown())."""
    return re.sub(r'\s+', ' ', re.sub(r'</?strong>', '', marked)).strip()


def script():
    """{key: number} as the delivered files are numbered."""
    L = json.load(open(LOCALES, encoding='utf-8'))
    keys = [k for k in L['en'] if k not in UNSPOKEN]
    return L, {k: i + 1 for i, k in enumerate(keys)}


def spoken_lines(L, number):
    """Every line the experience speaks, with the file it is built into."""
    src = open(RECORDINGS, encoding='utf-8').read()
    recs = json.loads(src[src.index('['):src.rindex(']') + 1])
    by_norm = {}
    for k, v in L['en'].items():
        by_norm.setdefault(normalize(v), k)
    lines = []
    for r in recs:
        # the Help Momo scene's own takes belong to the drafted story, which stays English
        if '/bridge/' in r['src']:
            continue
        key = by_norm.get(normalize(r['text']))
        if not key:
            continue          # an old take no screen says any more
        lines.append({'n': number[key], 'key': key, 'use': 'lesson',
                      'file': os.path.splitext(os.path.basename(r['src']))[0], 'en': r['text']})
    for vo, key in GAME:
        lines.append({'n': number[key], 'key': key, 'use': 'game', 'id': vo, 'en': L['en'][key]})
    for l in lines:
        l['hi'] = shown(L[LANG][l['key']])
    return lines


# ---------------------------------------------------------------- the waveform

def decode(path, rate):
    raw = subprocess.run([FFMPEG, '-v', 'error', '-i', path, '-ac', '1', '-ar', str(rate), '-f', 's16le', '-'],
                         capture_output=True, check=True).stdout
    a = array.array('h')
    a.frombytes(raw)
    if sys.byteorder != 'little':
        a.byteswap()
    return a


def speech(samples, rate, ms=10, below=40, min_gap=0.12):
    """The runs of speech: frames within `below` dB of the loudest, gaps under min_gap joined."""
    n = int(rate * ms / 1000)
    env = []
    for i in range(0, len(samples) - n + 1, n):
        s = samples[i:i + n]
        env.append(20 * math.log10(max(1e-9, math.sqrt(sum(x * x for x in s) / n) / 32768)))
    thr = max(env) - below
    runs, cur = [], None
    for i, e in enumerate(env):
        if e > thr and cur is None:
            cur = i
        if e <= thr and cur is not None:
            runs.append([cur, i]); cur = None
    if cur is not None:
        runs.append([cur, len(env)])
    # a click or a breath is not speech: every word comes within 30 dB of the line's loudest
    runs = [r for r in runs if max(env[r[0]:r[1]]) > max(env) - 30]
    out = []
    for r in runs:
        if out and (r[0] - out[-1][1]) * ms / 1000 < min_gap:
            out[-1][1] = r[1]
        else:
            out.append(r)
    return [(a * ms / 1000, b * ms / 1000) for a, b in out if (b - a) * ms / 1000 >= 0.04]


UNPAUSED = 0.35   # what leaving a punctuated break inside a stretch of speech costs, in seconds of misplacement
LONG_GAP = 0.20   # a silence this long is a pause between words; a shorter one may be a stop inside a word (सप्‍तभुज)
INF = float('inf')


def syllables(word):
    """A word's syllables, near enough: its Devanagari consonants and independent vowels."""
    return max(1, len(re.findall(r'[ऄ-हक़-ॡ]', word)))


def settle(starts, runs, stops, words):
    """Word starts fitted to the speech. A pause in the voice comes between words, and the voice
    pauses where the line is punctuated (stops[i]: a break follows word i); a short silence may
    also be a stop consonant inside a word. So the line is cut into stretches of speech first,
    each starting on a word (dynamic programming over the line), at the least cost of: the
    aligner's start for that word away from the pause before it (none if inside it), a short
    silence left inside a stretch, a punctuated break with no pause. (A stretch's length against
    its syllables was tried as a cost too, and misplaced words: Hindi's syllables are not even.)
    Inside a stretch the aligner's starts are kept where they fall in it, else the word's share of
    the stretch by its syllables."""
    n, syl = len(starts), [syllables(w) for w in words]
    runs = list(runs)
    while True:
        m = len(runs)
        inner = lambda j0, j1: sum(1 for i in range(j0 + 1, j1) if stops[i - 1])

        def skip(k):           # the silence before run k, left inside a stretch
            g = runs[k][0] - runs[k - 1][1]
            return INF if g >= LONG_GAP else (0.05 if g < 0.16 else 0.3)

        def near(t, k):        # the aligner's start against the pause before run k
            lo, hi = runs[k - 1][1] - 0.05, runs[k][0] + 0.05
            return 0.0 if lo <= t <= hi else min(abs(t - lo), abs(t - hi))

        best = {(0, 0): (0.0, None)}
        for k in range(m):
            for j in range(n):
                if (k, j) not in best:
                    continue
                c0, held = best[(k, j)][0], 0.0
                for k2 in range(k + 1, m + 1):
                    if k2 - 1 > k:
                        held += skip(k2 - 1)
                    if held == INF:
                        break
                    for j2 in range(j + 1, n + 1):
                        if (k2 == m) != (j2 == n):
                            continue
                        c = c0 + held + UNPAUSED * inner(j, j2)
                        if k2 < m:
                            c += near(starts[j2], k2)
                        if (k2, j2) not in best or c < best[(k2, j2)][0]:
                            best[(k2, j2)] = (c, (k, j))
        if (m, n) in best:
            break
        # more long pauses than words to start them: the shortest goes
        g = min(range(1, m), key=lambda k: runs[k][0] - runs[k - 1][1])
        runs[g - 1] = (runs[g - 1][0], runs[g][1])
        del runs[g]
    groups, at = [], (m, n)
    while best[at][1] is not None:
        prev = best[at][1]
        groups.append((prev, at))
        at = prev
    groups.reverse()
    out = [0.0] * n
    for (k, j), (k2, j2) in groups:
        a, b = runs[k][0], runs[k2 - 1][1]
        total, acc = sum(syl[j:j2]), 0
        for i in range(j, j2):
            share = a + (b - a) * acc / total
            acc += syl[i]
            out[i] = a if i == j else (starts[i] if a + 0.05 < starts[i] < b - 0.08 else share)
    for i in range(1, n):
        out[i] = max(out[i], out[i - 1] + 0.05)
    return [round(t, 3) for t in out], runs


# ---------------------------------------------------------------- Whisper

class Aligner:
    def __init__(self, model_path):
        from faster_whisper import WhisperModel
        from faster_whisper.tokenizer import Tokenizer
        self.model = WhisperModel(model_path, device='cpu', compute_type='int8')
        if not self.model.model.is_multilingual:
            raise SystemExit('the model is English-only: use a multilingual one (small, medium, large)')
        self.tok = Tokenizer(self.model.hf_tokenizer, True, task='transcribe', language=LANG)

    def words(self, path, words):
        """Start of each of `words` (alignment words, no punctuation) in the file, and the mean
        token probability of the alignment."""
        from faster_whisper.audio import decode_audio, pad_or_trim
        audio = decode_audio(path, sampling_rate=16000)
        feats = self.model.feature_extractor(audio)
        frames = min(feats.shape[-1], self.model.feature_extractor.nb_max_frames)
        enc = self.model.encode(pad_or_trim(feats))
        tokens = self.tok.encode(' ' + ' '.join(words))
        found = self.model.find_alignment(self.tok, [tokens], enc, frames)[0]
        found = [w for w in found if LETTER.search(w['word'])]
        if len(found) != len(words):
            # the tokenizer split a word differently: place them by letters instead
            letters, at = [], 0
            for w in words:
                letters.append(at); at += len(w)
            starts, k, pos = [], 0, 0
            for w in found:
                while k < len(letters) and letters[k] <= pos:
                    starts.append(w['start']); k += 1
                pos += len(w['word'].strip())
            while len(starts) < len(words):
                starts.append(found[-1]['start'] if found else 0.0)
        else:
            starts = [w['start'] for w in found]
        prob = sum(w['probability'] for w in found) / max(1, len(found))
        return [float(s) for s in starts], round(float(prob), 3)

    def heard(self, path):
        segs, _ = self.model.transcribe(path, language=LANG, beam_size=5, condition_on_previous_text=False)
        return ' '.join(s.text.strip() for s in segs)


def said(token):
    """The words a shown word is said as: numerals as words, no punctuation."""
    t = re.sub(r'\d', lambda m: ' ' + SAID[m.group()] + ' ', token)
    t = re.sub(r'[।॥]', ' ', t)                 # the danda
    return re.sub(r'[^ऀ-ॿA-Za-z]+', ' ', t).split()


def letters(s):
    return ' '.join(re.sub(r'[।॥]', ' ', re.sub(r'[^ऀ-ॿ0-9A-Za-z ]+', ' ', s)).split())


def measure(aligner, line):
    path = os.path.join(SOURCE, '%d.wav' % line['n'])
    if not os.path.exists(path):
        return dict(line, missing=True)
    tokens = line['hi'].split(' ')
    # what is said for each shown word: its letters, numerals as words, a hyphen a word break
    # (अलग-अलग is said as two); a dash says nothing
    owner, words, stops = [], [], []
    for i, t in enumerate(tokens):
        pieces = said(t)
        for k, w in enumerate(pieces):
            owner.append(i); words.append(w)
            # a break follows: the word ends in punctuation, or a dash comes next
            stops.append(k == len(pieces) - 1 and bool(re.search(r'[,;:।.!?…—]$', t) or
                                                     (i + 1 < len(tokens) and not said(tokens[i + 1]))))
    samples = decode(path, 16000)
    runs = speech(samples, 16000)
    starts, prob = aligner.words(path, words)
    starts, runs = settle(starts, runs, stops, words)
    at = [None] * len(tokens)
    for i, t in zip(owner, starts):
        if at[i] is None:
            at[i] = t
    # a word with nothing to say (a dash) appears with the word after it
    for i in range(len(at) - 1, -1, -1):
        if at[i] is None:
            at[i] = at[i + 1] if i + 1 < len(at) else starts[-1]
    heard = aligner.heard(path)
    match = difflib.SequenceMatcher(None, letters(line['hi']), letters(heard)).ratio()
    return dict(line, speech=[round(runs[0][0], 3), round(runs[-1][1], 3)], words=at,
                runs=[[round(a, 3), round(b, 3)] for a, b in runs],
                check={'heard': heard, 'match': round(match, 3), 'align': prob})


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--model', required=True, help='a multilingual faster-whisper model folder')
    ap.add_argument('--only', help='comma-separated line numbers')
    ap.add_argument('--reset-cues', action='store_true')
    a = ap.parse_args()
    L, number = script()
    lines = spoken_lines(L, number)
    only = set(int(x) for x in a.only.split(',')) if a.only else None
    old = {}
    if os.path.exists(MAP):
        for l in json.load(open(MAP, encoding='utf-8'))['lines']:
            old[(l['use'], l['n'], l.get('file') or l.get('id'))] = l
    aligner = Aligner(a.model)
    out = []
    for line in lines:
        k = (line['use'], line['n'], line.get('file') or line.get('id'))
        prev = old.get(k)
        if only is not None and line['n'] not in only and prev:
            out.append(prev)
            continue
        m = measure(aligner, line)
        if prev and 'cues' in prev and not a.reset_cues and prev.get('en') == m['en'] and prev.get('hi') == m['hi']:
            m['cues'] = prev['cues']
        out.append(m)
        if m.get('missing'):
            print('%3d %-24s MISSING %d.wav' % (m['n'], m['key'], m['n']))
        else:
            print('%3d %-24s match %.2f align %.2f  %s' % (m['n'], m['key'], m['check']['match'], m['check']['align'],
                  ' '.join('%s@%.2f' % (w, t) for w, t in zip(m['hi'].split(' '), m['words']))))
    os.makedirs(os.path.dirname(MAP), exist_ok=True)
    doc = {
        'about': 'The Hindi voice, measured by tools/voice/measure-hindi-voice.py from the delivered files '
                 '(assets/audio/source/hi/<n>.wav, numbered as script.csv there). For each line the experience '
                 'speaks: its number, its key in src/i18n/locales.json, where it is used (lesson: a line of '
                 'src/lesson/recordings.js, built as assets/audio/lesson/hi/<file>; game: a window of Frozen '
                 "Rush's take, CFG.vo.lines <id>), its English and its Hindi as shown, where its speech starts "
                 'and ends in the delivered file (seconds), its runs of speech between pauses (`runs`), and '
                 'where each shown word starts (seconds in the delivered file). `check` is a blind transcription and how close it is to the script '
                 '(`match`, 0-1) with the alignment\'s confidence (`align`). A line may carry `cues`: for each '
                 'English word, the index of the Hindi word on which its cue fires; without it the build works '
                 'them out (tools/voice/build-hindi-voice.py: CONCEPTS). Build with npm run build:hindi-voice.',
        'language': LANG,
        'source': 'assets/audio/source/hi',
        'lines': sorted(out, key=lambda l: (l['use'] != 'lesson', l['n'])),
    }
    with open(MAP, 'w', encoding='utf-8') as f:
        json.dump(doc, f, ensure_ascii=False, indent=1)
        f.write('\n')
    print('%s: %d lines, %d missing' % (os.path.relpath(MAP, ROOT), len(out), sum(1 for l in out if l.get('missing'))))


if __name__ == '__main__':
    main()
