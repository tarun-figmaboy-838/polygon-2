#!/usr/bin/env python3
"""Build the Hindi voice from the delivered files and docs/voice/hi/cue-map.json.

The Hindi voice-over was delivered as one WAV per line (assets/audio/source/hi/<n>.wav,
numbered as script.csv there). tools/voice/measure-hindi-voice.py measured where each spoken
line's speech is and when each of its shown words starts; this builds, from those files and
that map and nothing else (no speech recogniser, only ffmpeg):

  lesson   each of Swiftee's lines as assets/audio/lesson/hi/<name> (.ogg + .mp3), the name
           its English take has, cut with the lesson's quarter second of room either side and
           levelled as the lesson's takes are; and src/lesson/recordings-hi.js, the Hindi
           catalogue: per line its English (what the lesson looks it up by), its Hindi as
           shown, its file and length, `spoken` (when each shown Hindi word starts) and
           `words` (each English word with the moment its cue fires in the Hindi take: the
           lesson's cues are English words, "open", "sides", "vertex", and fire when the Hindi
           word that says the same thing is said)
  game     Frozen Rush's lines joined into one take, game/assets/audio/vo-lines-hi (.mp3 +
           .ogg), as its English take is one, with each line's window and Hindi word starts
           written into CFG.vo.langs.hi in game/js/engine.js and its bundle, and the take's
           content hashes into the game's asset versions

A line whose file is missing is not built: in Hindi it is shown at a reading pace, without
a voice, as a line with no recording is (never in the English voice under Hindi words).

Usage (from the project folder, after `npm install`):
    npm run build:hindi-voice
"""
import array
import hashlib
import json
import os
import re
import subprocess
import sys
import tempfile
import wave

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(os.path.dirname(HERE))
LANG = 'hi'
MAP = os.path.join(ROOT, 'docs', 'voice', LANG, 'cue-map.json')
_BUNDLED = os.path.join(ROOT, 'node_modules', 'ffmpeg-static', 'ffmpeg')
FFMPEG = os.environ.get('FFMPEG') or (_BUNDLED if os.path.exists(_BUNDLED) else 'ffmpeg')
RATE = 44100
PAD = {'lesson': (0.25, 0.25), 'game': (0.06, 0.12)}   # as tools/voice/cut-recordings.py cuts
TARGET = -21.5          # integrated LUFS, the lesson's takes (cut-recordings.py TARGET)
PEAK_CEIL = -1.5
GAME_GAP = 0.40         # silence between the game's lines in its take
GAME_TAKE = os.path.join(ROOT, 'game', 'assets', 'audio', 'vo-lines')   # the English take, whose level the Hindi one keeps

NUM = 'zero one two three four five six seven eight nine'.split()

# WHICH HINDI WORD SAYS WHAT AN ENGLISH CUE WORD SAYS. The lesson's cues are English words
# (index.html keyword() and guide.onWord(), the recap's cue(), the open / closed buttons, the
# pentagon's sides, vertex and angle drawn on "line", "sides", "meet", "vertex", "form",
# "angle"). Each is fired on the Hindi word that begins with one of these stems; a word with no
# counterpart is placed by its share of its sentence. CUE_AT, and a line's "cues" in the cue
# map, override.
CONCEPTS = [
    (('open',), ('खुल',)),
    (('closed', 'close'), ('बंद',)),
    # "straight line segments" is one word, रेखाखंड (s18Definition)
    (('straight',), ('सीध', 'रेखाखंड')),
    (('curved', 'curves', 'curve'), ('वक्र', 'मोड़', 'मुड़')),
    (('boundary', 'boundaries'), ('सीमा',)),
    (('gap', 'gaps'), ('खाली',)),
    (('polygon', 'polygons'), ('बहुभुज',)),
    (('side', 'sides'), ('भुजा', 'भुजाएँ', 'भुजाओं')),
    (('vertex', 'vertices'), ('शीर्ष',)),
    (('angle', 'angles'), ('कोण',)),
    (('point',), ('बिंदु',)),
    (('segments', 'segment'), ('रेखाखंड',)),
    (('line', 'lines'), ('रेखा',)),
    (('triangle', 'triangles'), ('त्रिभुज',)),
    (('quadrilateral', 'quadrilaterals'), ('चतुर्भुज',)),
    (('pentagon', 'pentagons'), ('पंचभुज',)),
    (('hexagon', 'hexagons'), ('षट्भुज',)),
    (('heptagon', 'heptagons'), ('सप्तभुज',)),
    (('octagon', 'octagons'), ('अष्टभुज',)),
    (('two',), ('दो', '2')), (('three',), ('3', 'तीन')), (('four',), ('4', 'चार')),
    (('five',), ('5', 'पाँच')), (('six',), ('6', 'छह')), (('seven',), ('7', 'सात')), (('eight',), ('8', 'आठ')),
    (('look',), ('देख', 'ढूँढ')),          # "Look!" देखिए; "Look for a figure" ढूँढें
    (('which',), ('कौन',)),
    (('both',), ('दोनों',)),
    (('number',), ('संख्या',)),
    (('name',), ('नाम',)),
    (('whoa', 'woah', 'wow'), ('वाह',)),
    (('meet',), ('मिल',)),
    (('figure', 'figures', 'shape', 'shapes'), ('आकृति',)),
]
STEM = {}
for words, stems in CONCEPTS:
    for w in words:
        STEM[w] = stems
# A line's own: {key: {English word: the stem of the Hindi word it fires on}}. Screen 11's angle
# draws its arc from "form" to "angle"; Hindi says the angle (कोण) before the verb (बनाती), so the
# arc starts on the clause that leads to it, "तो वे एक", and is drawn by the time कोण is said.
CUE_AT = {'s22Angle': {'form': 'तो'}}


def normalize(text):
    """The lesson's own English match (src/lesson/recorded-player.js)."""
    t = re.sub(r'[0-9]', lambda m: NUM[int(m.group())], text.lower())
    return re.sub(r'[^a-z]+', ' ', re.sub(r"[’']", '', t)).strip()


def bare(token):
    return re.sub(r'^[^\u0900-\u097F0-9A-Za-z]+|[^\u0900-\u097F0-9A-Za-z]+$', '', token).rstrip('।॥')


def sentences(tokens, english):
    """Where each sentence starts, by token index."""
    end = re.compile(r'[.!?]["”’]?$' if english else r'[.!?।]["”’]?$')
    out = [0]
    for i, t in enumerate(tokens[:-1]):
        if end.search(t):
            out.append(i + 1)
    return out


def cues(en, hi, key=None):
    """For each English token with letters in it, the index of the Hindi token its cue fires on."""
    et = [t for t in en.split() if normalize(t)]
    ht = hi.split(' ')
    es, hs = sentences(et, True), sentences(ht, False)
    same = len(es) == len(hs)

    def span(starts, i, n):
        k = max(j for j, s in enumerate(starts) if s <= i)
        return k, starts[k], (starts[k + 1] if k + 1 < len(starts) else n)

    out, used = [], {}
    for i, tok in enumerate(et):
        w = normalize(tok).split()[0]
        k, e0, e1 = span(es, i, len(et))
        h0, h1 = (hs[k], hs[k + 1] if k + 1 < len(hs) else len(ht)) if same else (0, len(ht))
        pick = None
        own = CUE_AT.get(key, {}).get(w)
        stems = (own,) if own else STEM.get(w)
        if stems:
            # the n-th time the word is said in this sentence goes with the n-th Hindi word for it
            nth = used.get((k, w), 0)
            found = [j for j in range(h0, h1) if any(bare(ht[j]).startswith(s) for s in stems)]
            if not found and same:
                found = [j for j in range(len(ht)) if any(bare(ht[j]).startswith(s) for s in stems)]
            if found:
                pick = found[min(nth, len(found) - 1)]
                used[(k, w)] = nth + 1
        if pick is None:
            # its share of its sentence; a sentence's first word with the Hindi sentence's first
            pick = h0 + int((i - e0) / max(1, e1 - e0) * (h1 - h0))
            pick = min(max(h0, pick), h1 - 1)
        out.append(pick)
    return out


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


def cut(samples, lo, hi, gain_db):
    """[lo, hi) seconds of the file, silence where that runs past either end, levelled and faded."""
    a, b = int(round(lo * RATE)), int(round(hi * RATE))
    g = 10 ** (gain_db / 20)
    clip = array.array('h', [0] * max(0, -a))
    clip.extend(max(-32768, min(32767, int(round(s * g)))) for s in samples[max(0, a):min(len(samples), b)])
    clip.extend([0] * max(0, b - max(a, len(samples))))
    fade = int(0.006 * RATE)
    for i in range(min(fade, len(clip) // 2)):
        k = i / fade
        clip[i] = int(clip[i] * k)
        clip[-1 - i] = int(clip[-1 - i] * k)
    return clip


def level(path, lo, hi, target):
    """The gain that brings the line's speech to `target` LUFS, its peak under PEAK_CEIL."""
    with tempfile.TemporaryDirectory() as tmp:
        wav = os.path.join(tmp, 'speech.wav')
        write_wav(wav, cut(decode(path), lo, hi, 0.0))
        i, peak = loudness(wav)
    return min(target - i, PEAK_CEIL - peak)


def encode(wav, base, mp3_rate='128k', ogg_rate='40k'):
    os.makedirs(os.path.dirname(base), exist_ok=True)
    # bitexact: no random Ogg stream serial, so the same cut always makes the same file
    run([FFMPEG, '-y', '-v', 'error', '-i', wav, '-c:a', 'libopus', '-b:a', ogg_rate, '-application', 'voip',
         '-fflags', '+bitexact', '-flags:a', '+bitexact', base + '.ogg'])
    run([FFMPEG, '-y', '-v', 'error', '-i', wav, '-c:a', 'libmp3lame', '-b:a', mp3_rate,
         '-fflags', '+bitexact', '-flags:a', '+bitexact', base + '.mp3'])


def source(cue, line):
    return os.path.join(ROOT, cue['source'], '%d.wav' % line['n'])


def lesson(cue, lines):
    rows = []
    with tempfile.TemporaryDirectory() as tmp:
        for line in lines:
            path = source(cue, line)
            s0, s1 = line['speech']
            pre, post = PAD['lesson']
            lo, hi = s0 - pre, s1 + post
            clip = cut(decode(path), lo, hi, level(path, s0, s1, TARGET))
            wav = os.path.join(tmp, 'line.wav')
            write_wav(wav, clip)
            rel = 'assets/audio/lesson/%s/%s' % (LANG, line['file'])
            encode(wav, os.path.join(ROOT, rel))
            starts = [round(max(0.0, t - lo), 3) for t in line['words']]
            ht = line['hi'].split(' ')
            et = [t for t in line['en'].split() if normalize(t)]
            pick = line.get('cues') or cues(line['en'], line['hi'], line['key'])
            if len(pick) != len(et):
                raise SystemExit('line %d: %d cues for %d English words' % (line['n'], len(pick), len(et)))
            rows.append({
                'text': line['en'],
                'shown': line['hi'],
                'src': rel + '.mp3',
                'duration': round(len(clip) / RATE, 3),
                'spoken': [{'word': w, 'start': t} for w, t in zip(ht, starts)],
                'words': [{'word': w, 'start': starts[j]} for w, j in zip(et, pick)],
                'source': 'Hindi take: assets/audio/source/hi/%d.wav (%s), %.2f-%.2f s' % (line['n'], line['key'], max(0, lo), hi)
            })
            print('lesson %3d %-24s %.2fs  %s' % (line['n'], line['key'], len(clip) / RATE,
                  ' '.join('%s=%s' % (w, ht[j]) for w, j in zip(et, pick) if normalize(w).split()[0] in STEM)))
    head = ('/* Generated by tools/voice/build-hindi-voice.py from the delivered Hindi takes\n'
            '   (assets/audio/source/hi/, docs/voice/hi/cue-map.json). Loaded by src/i18n/i18n.js for ?lan=hi\n'
            '   on a page that asks for its voice (index.html). A row is found by its English `text`, as the\n'
            '   English catalogue\'s (src/lesson/recordings.js) are; `shown` is the Hindi on screen, `spoken`\n'
            '   when each of its words starts, and `words` each English word with the moment its cue fires in\n'
            '   this take (seconds from the start of the file, not in order: Hindi puts its words in its own\n'
            '   order). See PolygonRecordedVoice in src/lesson/recorded-player.js. */\n')
    out = os.path.join(ROOT, 'src', 'lesson', 'recordings-%s.js' % LANG)
    with open(out, 'w', encoding='utf-8') as f:
        f.write(head + '(window.POLYGON_VOICES = window.POLYGON_VOICES || {}).%s = ' % LANG
                + json.dumps(rows, indent=1, ensure_ascii=False) + ';\n')
    print('lesson: %d lines, %s' % (len(rows), os.path.relpath(out, ROOT)))


def game(cue, lines):
    """One take, a window per line, at the English take's level."""
    english_i, _ = loudness(GAME_TAKE + '.mp3')
    joined, windows = array.array('h'), {}
    for line in lines:
        path = source(cue, line)
        s0, s1 = line['speech']
        pre, post = PAD['game']
        lo, hi = s0 - pre, s1 + post
        clip = cut(decode(path), lo, hi, level(path, s0, s1, english_i))
        if joined:
            joined.extend([0] * int(GAME_GAP * RATE))
        at = len(joined) / RATE
        joined.extend(clip)
        words = [round(max(0.0, t - lo), 2) for t in line['words']]
        windows[line['id']] = (round(at, 2), round(len(clip) / RATE, 2), words, line['hi'], line['en'])
    base = GAME_TAKE + '-' + LANG
    with tempfile.TemporaryDirectory() as tmp:
        wav = os.path.join(tmp, 'take.wav')
        write_wav(wav, joined)
        encode(wav, base, mp3_rate='160k', ogg_rate='48k')
    total = len(joined) / RATE

    def fmt(key, w):
        lo, length, words, hi, en = w
        pad = ' ' * max(1, 20 - len(key) - 4)
        return "          '%s':%s[%.2f, %.2f, [%s]],   // \"%s\" (%s)" % (key, pad, lo, length, ', '.join('%.2f' % t for t in words), hi, en)
    block = '\n'.join(fmt(l['id'], windows[l['id']]) for l in lines)
    rels = ['assets/audio/vo-lines-%s.mp3' % LANG, 'assets/audio/vo-lines-%s.ogg' % LANG]
    hashes = {rel: hashlib.md5(open(os.path.join(ROOT, 'game', rel), 'rb').read()).hexdigest()[:8] for rel in rels}
    for js in ('game/js/engine.js', 'game/js/game.bundle.js', 'game/js/asset-versions.js'):
        path = os.path.join(ROOT, js)
        s = open(path, encoding='utf-8').read()
        if 'engine' in js or 'bundle' in js:
            s, n = re.subn(r"(      %s: \{ src: '[^']*', take: [\d.]+, lines: \{\n)(?:          '[^\n]*\n)*" % LANG,
                           lambda m: "      %s: { src: 'assets/audio/vo-lines-%s.mp3', take: %.2f, lines: {\n" % (LANG, LANG, total) + block + '\n',
                           s, count=1)
            if n != 1:
                raise SystemExit('could not find CFG.vo.langs.%s in %s' % (LANG, js))
        if '"assets/audio/vo-lines.mp3": "' in s:          # the asset versions' table (not engine.js)
            for rel, h in sorted(hashes.items(), reverse=True):
                entry = '"%s": "%s"' % (rel, h)
                if ('"%s":' % rel) in s:
                    s = re.sub(r'"%s": "[0-9a-f]{8}"' % re.escape(rel), entry, s)
                    continue
                # a new file: in its place in the sorted table, before the English take's
                # ("vo-lines-hi.mp3" < "vo-lines-hi.ogg" < "vo-lines.mp3")
                after = re.compile(r'\n(\s*)("assets/audio/vo-lines[-.][^"]*": "[0-9a-f]{8}",)')
                m = next((m for m in after.finditer(s) if m.group(2).split('"')[1] > rel), None)
                if not m:
                    raise SystemExit('could not place %s in the asset versions of %s' % (rel, js))
                s = s[:m.start()] + '\n' + m.group(1) + entry + ',' + s[m.start():]
        open(path, 'w', encoding='utf-8').write(s)
    print('game: %d windows in a %.1fs take at %.1f LUFS; %s' % (len(windows), total, english_i,
          ', '.join('%s %s' % (k[-3:], v) for k, v in hashes.items())))


def main():
    cue = json.load(open(MAP, encoding='utf-8'))
    ready = [l for l in cue['lines'] if not l.get('missing')]
    missing = [l for l in cue['lines'] if l.get('missing')]
    lesson(cue, [l for l in ready if l['use'] == 'lesson'])
    game_lines = [l for l in ready if l['use'] == 'game']
    if len(game_lines) != len([l for l in cue['lines'] if l['use'] == 'game']):
        raise SystemExit('the game\'s take needs every one of its lines: %s missing' %
                         ', '.join('%d.wav' % l['n'] for l in missing if l['use'] == 'game'))
    game(cue, game_lines)
    for l in missing:
        print('not built, no file: %d.wav (%s) "%s"' % (l['n'], l['key'], l['hi']))


if __name__ == '__main__':
    main()
