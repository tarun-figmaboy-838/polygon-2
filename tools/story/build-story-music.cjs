#!/usr/bin/env node
/* Composes and renders the Momo + Polo story music.

   One file, five sections, each written for a stretch of the story:
     warm     scenes 1-3   8 bars   curious music box over a soft pad
     playful  scenes 4-5   4 bars   same chords, plucked eighths, livelier
     tension  scenes 6-7   4 bars   minor turn, low pulse, thin shimmer
     hush     scene 8      4 bars   one quiet chord, a falling music box line
     resolve  scene 9      4 bars   F - G - C, the melody comes home (plays once)

   The story crossfades between sections (story-intro.js), so the music never
   restarts. Looping sections are rendered twice and the second pass kept, so
   each one already carries its own reverb tail into its start: the loop point
   is seamless.

   Rendering runs in a headless Chromium OfflineAudioContext (Playwright is a
   dev dependency); encoding needs ffmpeg with libopus and libmp3lame (set
   FFMPEG, or install the ffmpeg-static package).

   Usage:  node tools/story/build-story-music.cjs
   Output: assets/audio/story/story-music.ogg (+ .mp3 for browsers without Ogg)
           and the section table printed for src/story/story-data.js. */
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..', '..');
const OUT_DIR = path.join(ROOT, 'assets', 'audio', 'story');

function ffmpegPath() {
  if (process.env.FFMPEG) return process.env.FFMPEG;
  try { return require('ffmpeg-static'); } catch (e) {}
  return 'ffmpeg';
}

/* Everything below this function runs inside the browser. */
async function compose() {
  const SR = 48000;
  const BPM = 80, BEAT = 60 / BPM, BAR = 4 * BEAT;
  const NOTE = { C: -9, D: -7, E: -5, F: -4, G: -2, A: 0, B: 2 };
  const hz = (n) => {
    const m = /^([A-G])(#|b)?(\d)$/.exec(n);
    return 440 * Math.pow(2, (NOTE[m[1]] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0) + (Number(m[3]) - 4) * 12) / 12);
  };
  // Seeded noise, so every build of the music is identical.
  let seed = 20260928;
  const rnd = () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };

  function rig(ctx) {
    const out = ctx.createGain();
    out.connect(ctx.destination);
    const verb = ctx.createConvolver();
    const len = Math.floor(3.4 * SR);
    const ir = ctx.createBuffer(2, len, SR);
    for (let c = 0; c < 2; c++) {
      const d = ir.getChannelData(c);
      for (let i = 0; i < len; i++) {
        const t = i / len;
        d[i] = (rnd() * 2 - 1) * Math.pow(1 - t, 2.8) * Math.min(1, i / (SR * 0.012));
      }
    }
    verb.buffer = ir;
    const wet = ctx.createGain(); wet.gain.value = 0.55;
    verb.connect(wet); wet.connect(out);
    const chan = (pan, send) => {
      const g = ctx.createGain();
      const p = ctx.createStereoPanner(); p.pan.value = pan;
      g.connect(p); p.connect(out);
      const s = ctx.createGain(); s.gain.value = send;
      p.connect(s); s.connect(verb);
      return g;
    };
    return { ctx, chan };
  }

  function pad(r, notes, t, dur, o) {
    const { ctx } = r;
    const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = o.cutoff; f.Q.value = 0.2;
    f.connect(r.chan(0, 0.6));
    const attack = o.attack || 1.1, release = o.release || 1.8;
    notes.forEach((n, i) => {
      const g = ctx.createGain();
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(o.level, t + attack);
      g.gain.setValueAtTime(o.level, t + Math.max(attack, dur - 0.05));
      g.gain.linearRampToValueAtTime(0, t + dur + release);
      g.connect(f);
      [-8, 8].forEach((det, k) => {
        const osc = ctx.createOscillator();
        osc.type = 'sawtooth';
        osc.frequency.value = hz(n);
        osc.detune.value = det + (i % 2 ? 3 : -3);
        const p = ctx.createStereoPanner(); p.pan.value = k ? 0.4 : -0.4;
        osc.connect(p); p.connect(g);
        osc.start(t); osc.stop(t + dur + release + 0.1);
      });
    });
  }

  function bell(r, n, t, level, decay, pan) {
    const { ctx } = r;
    const bus = r.chan(pan || 0, 0.55);
    [[1, 1, 1], [2, 0.26, 0.5], [3, 0.09, 0.3], [4.2, 0.05, 0.12]].forEach(([mul, amp, dk]) => {
      const osc = ctx.createOscillator();
      osc.type = 'sine'; osc.frequency.value = hz(n) * mul;
      const g = ctx.createGain();
      const end = t + decay * dk;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(level * amp, t + 0.006);
      g.gain.exponentialRampToValueAtTime(0.0001, end);
      osc.connect(g); g.connect(bus);
      osc.start(t); osc.stop(end + 0.05);
    });
  }

  function bass(r, n, t, dur, level) {
    const { ctx } = r;
    const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 380;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(level, t + 0.06);
    g.gain.setValueAtTime(level, t + Math.max(0.06, dur - 0.1));
    g.gain.linearRampToValueAtTime(0, t + dur + 0.35);
    f.connect(g); g.connect(r.chan(0, 0.08));
    [['sine', 1, 1], ['triangle', 2, 0.22]].forEach(([type, mul, amp]) => {
      const osc = ctx.createOscillator(); osc.type = type; osc.frequency.value = hz(n) * mul;
      const a = ctx.createGain(); a.gain.value = amp;
      osc.connect(a); a.connect(f);
      osc.start(t); osc.stop(t + dur + 0.4);
    });
  }

  function pluck(r, n, t, level, pan) {
    const { ctx } = r;
    const osc = ctx.createOscillator(); osc.type = 'triangle'; osc.frequency.value = hz(n);
    const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 2600;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(level, t + 0.005);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.5);
    osc.connect(f); f.connect(g); g.connect(r.chan(pan, 0.35));
    osc.start(t); osc.stop(t + 0.55);
  }

  function pulse(r, n, t, level) {
    const { ctx } = r;
    const osc = ctx.createOscillator(); osc.type = 'sine';
    osc.frequency.setValueAtTime(hz(n) * 1.5, t);
    osc.frequency.exponentialRampToValueAtTime(hz(n), t + 0.06);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(level, t + 0.005);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.38);
    osc.connect(g); g.connect(r.chan(0, 0.12));
    osc.start(t); osc.stop(t + 0.42);
  }

  function shimmer(r, n, t, dur, level) {
    const { ctx } = r;
    const osc = ctx.createOscillator(); osc.type = 'sine'; osc.frequency.value = hz(n);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(level, t + 1.2);
    g.gain.setValueAtTime(level, t + dur - 0.3);
    g.gain.linearRampToValueAtTime(0, t + dur + 0.6);
    const lfo = ctx.createOscillator(); lfo.frequency.value = 5.5;
    const depth = ctx.createGain(); depth.gain.value = level * 0.7;
    lfo.connect(depth); depth.connect(g.gain);
    osc.connect(g); g.connect(r.chan(0.25, 0.7));
    osc.start(t); lfo.start(t); osc.stop(t + dur + 0.7); lfo.stop(t + dur + 0.7);
  }

  const MAJ = { C: ['C3', 'G3', 'E4', 'B4'], Am: ['A2', 'E3', 'C4', 'G4'], F: ['F2', 'C4', 'E4', 'A4'], G: ['G2', 'D4', 'E4', 'B4'] };
  const ROOTS = { C: 'C2', Am: 'A1', F: 'F2', G: 'G2' };
  const PROG = ['C', 'Am', 'F', 'G'];

  const SECTIONS = [
    {
      name: 'warm', bars: 8, loop: true,
      play(r, t0) {
        for (let b = 0; b < 8; b++) {
          const c = PROG[b % 4], t = t0 + b * BAR;
          pad(r, MAJ[c], t, BAR, { cutoff: 1500, level: 0.016 });
          bass(r, ROOTS[c], t, BAR - 0.2, 0.05);
        }
        // A gentle, curious music-box line in C major pentatonic.
        const line = [
          [0, 0, 'E5'], [0, 1, 'G5'], [0, 2, 'A5'],
          [1, 0, 'G5'], [1, 1, 'E5'], [1, 2, 'C5'],
          [2, 0, 'A5'], [2, 1.5, 'G5'], [2, 2, 'E5'], [2, 3, 'C5'],
          [3, 0, 'D5'], [3, 2, 'E5'], [3, 2.5, 'D5'],
          [4, 0, 'E5'], [4, 1, 'G5'], [4, 2, 'C6'],
          [5, 0, 'A5'], [5, 1, 'G5'], [5, 2, 'E5'],
          [6, 0, 'A5'], [6, 1, 'C6'], [6, 2, 'A5'], [6, 3, 'G5'],
          [7, 0, 'E5'], [7, 1, 'D5'], [7, 2, 'D5']
        ];
        line.forEach(([bar, beat, n], i) => bell(r, n, t0 + bar * BAR + beat * BEAT, 0.07, 1.9, i % 2 ? 0.18 : -0.12));
        [[1, 3.5, 'E7'], [5, 3.5, 'G7']].forEach(([bar, beat, n]) => bell(r, n, t0 + bar * BAR + beat * BEAT, 0.018, 0.9, 0.3));
      }
    },
    {
      name: 'playful', bars: 4, loop: true,
      play(r, t0) {
        const arps = {
          C: ['C4', 'E4', 'G4', 'B4', 'C5', 'B4', 'G4', 'E4'], Am: ['A3', 'C4', 'E4', 'G4', 'A4', 'G4', 'E4', 'C4'],
          F: ['F3', 'A3', 'C4', 'E4', 'F4', 'E4', 'C4', 'A3'], G: ['G3', 'B3', 'D4', 'E4', 'G4', 'E4', 'D4', 'B3']
        };
        const accents = ['G5', 'E5', 'A5', 'B5'];
        for (let b = 0; b < 4; b++) {
          const c = PROG[b], t = t0 + b * BAR;
          pad(r, MAJ[c], t, BAR, { cutoff: 2100, level: 0.012 });
          bass(r, ROOTS[c], t, BEAT * 1.6, 0.06);
          bass(r, ROOTS[c], t + 2 * BEAT, BEAT * 1.6, 0.05);
          arps[c].forEach((n, i) => pluck(r, n, t + i * BEAT / 2, 0.05, i % 2 ? 0.3 : -0.3));
          bell(r, accents[b], t, 0.06, 1.4, 0.1);
        }
        bell(r, 'D6', t0 + 3 * BAR + 2 * BEAT, 0.045, 1.2, -0.2);
        bell(r, 'B5', t0 + 3 * BAR + 3 * BEAT, 0.045, 1.2, 0.2);
      }
    },
    {
      name: 'tension', bars: 4, loop: true,
      play(r, t0) {
        const chords = [['A2', 'E3', 'C4', 'E4'], ['F2', 'C3', 'A3', 'C4'], ['D2', 'A2', 'F3', 'A3'], ['E2', 'B2', 'G#3', 'B3']];
        const roots = ['A1', 'F1', 'D2', 'E1'];
        for (let b = 0; b < 4; b++) {
          const t = t0 + b * BAR;
          pad(r, chords[b], t, BAR, { cutoff: 820, level: 0.017, attack: 0.5 });
          for (let k = 0; k < 4; k++) pulse(r, roots[b], t + k * BEAT, k === 0 ? 0.16 : 0.1);
        }
        shimmer(r, 'E5', t0, 4 * BAR, 0.012);
      }
    },
    {
      name: 'hush', bars: 4, loop: true,
      play(r, t0) {
        pad(r, ['A2', 'E3', 'B3', 'C4'], t0, 2 * BAR, { cutoff: 700, level: 0.013, attack: 1.6, release: 2.4 });
        pad(r, ['A2', 'E3', 'B3', 'C4'], t0 + 2 * BAR, 2 * BAR, { cutoff: 700, level: 0.013, attack: 1.6, release: 2.4 });
        bass(r, 'A1', t0, 4 * BAR - 0.3, 0.035);
        ['E5', 'D5', 'C5', 'B4'].forEach((n, b) => bell(r, n, t0 + b * BAR, 0.05, 2.6, b % 2 ? 0.15 : -0.15));
      }
    },
    {
      name: 'resolve', bars: 4, loop: false, tail: 4.5,
      play(r, t0) {
        pad(r, ['F2', 'C4', 'G4', 'A4'], t0, BAR, { cutoff: 1700, level: 0.015 });
        pad(r, ['G2', 'D4', 'G4', 'B4'], t0 + BAR, BAR, { cutoff: 1700, level: 0.015 });
        pad(r, ['C3', 'G3', 'E4', 'C5'], t0 + 2 * BAR, 2 * BAR, { cutoff: 1800, level: 0.016, release: 3.5 });
        bass(r, 'F2', t0, BAR - 0.2, 0.05);
        bass(r, 'G2', t0 + BAR, BAR - 0.2, 0.05);
        bass(r, 'C2', t0 + 2 * BAR, 2 * BAR, 0.05);
        [[0, 0, 'C6'], [0, 1.5, 'A5'], [0, 2, 'G5'], [1, 0, 'G5'], [1, 1, 'A5'], [1, 2, 'B5'], [2, 0, 'C6']]
          .forEach(([bar, beat, n], i) => bell(r, n, t0 + bar * BAR + beat * BEAT, 0.07, bar === 2 ? 4.5 : 1.9, i % 2 ? 0.15 : -0.1));
        bell(r, 'E6', t0 + 2 * BAR + 0.03, 0.03, 4, 0.25);
        bell(r, 'G6', t0 + 3 * BAR + 2 * BEAT, 0.02, 2.5, -0.25);
      }
    }
  ];

  const rendered = [];
  for (const s of SECTIONS) {
    const L = s.bars * BAR;
    const total = s.loop ? 2 * L : L + s.tail;
    const ctx = new OfflineAudioContext(2, Math.ceil(total * SR), SR);
    const r = rig(ctx);
    s.play(r, 0);
    if (s.loop) s.play(r, L);          // the second pass carries the first one's tail
    const buf = await ctx.startRendering();
    const from = s.loop ? Math.round(L * SR) : 0;
    const count = s.loop ? Math.round(L * SR) : buf.length;
    rendered.push({ name: s.name, loop: s.loop, seconds: count / SR,
      ch: [0, 1].map(c => Array.from(buf.getChannelData(c).subarray(from, from + count))) });
  }
  return { SR, sections: rendered };
}

(async () => {
  const { chromium } = require(path.join(ROOT, 'node_modules', 'playwright'));
  const browser = await chromium.launch();
  const page = await browser.newPage();
  const result = await page.evaluate(`(${compose.toString()})()`);
  await browser.close();

  // Join the sections, level the whole piece to a -2 dBFS peak, write 16-bit WAV.
  const SR = result.SR;
  let peak = 0;
  result.sections.forEach(s => s.ch.forEach(c => c.forEach(v => { peak = Math.max(peak, Math.abs(v)); })));
  const gain = Math.pow(10, -2 / 20) / peak;
  const frames = result.sections.reduce((a, s) => a + s.ch[0].length, 0);
  const wav = Buffer.alloc(44 + frames * 4);
  wav.write('RIFF', 0); wav.writeUInt32LE(36 + frames * 4, 4); wav.write('WAVE', 8);
  wav.write('fmt ', 12); wav.writeUInt32LE(16, 16); wav.writeUInt16LE(1, 20); wav.writeUInt16LE(2, 22);
  wav.writeUInt32LE(SR, 24); wav.writeUInt32LE(SR * 4, 28); wav.writeUInt16LE(4, 32); wav.writeUInt16LE(16, 34);
  wav.write('data', 36); wav.writeUInt32LE(frames * 4, 40);
  let o = 44, at = 0;
  const table = {};
  for (const s of result.sections) {
    let sum = 0;
    for (let i = 0; i < s.ch[0].length; i++) {
      for (let c = 0; c < 2; c++) {
        const v = Math.max(-1, Math.min(1, s.ch[c][i] * gain));
        sum += v * v;
        wav.writeInt16LE(Math.round(v * 32767), o); o += 2;
      }
    }
    const rmsDb = 10 * Math.log10(sum / (s.ch[0].length * 2));
    table[s.name] = { start: +at.toFixed(4), end: +(at + s.seconds).toFixed(4), loop: s.loop };
    console.log(`${s.name.padEnd(8)} ${at.toFixed(2)}s - ${(at + s.seconds).toFixed(2)}s  ${s.loop ? 'loop' : 'once'}  RMS ${rmsDb.toFixed(1)} dBFS`);
    at += s.seconds;
  }

  fs.mkdirSync(OUT_DIR, { recursive: true });
  const tmp = path.join(os.tmpdir(), 'story-music-' + process.pid + '.wav');
  fs.writeFileSync(tmp, wav);
  const ff = ffmpegPath();
  execFileSync(ff, ['-y', '-v', 'error', '-i', tmp, '-c:a', 'libopus', '-b:a', '72k', '-vbr', 'on', '-application', 'audio', path.join(OUT_DIR, 'story-music.ogg')]);
  execFileSync(ff, ['-y', '-v', 'error', '-i', tmp, '-c:a', 'libmp3lame', '-q:a', '4', path.join(OUT_DIR, 'story-music.mp3')]);
  fs.unlinkSync(tmp);
  console.log('sections:', JSON.stringify(table));
  ['ogg', 'mp3'].forEach(ext => {
    const f = path.join(OUT_DIR, 'story-music.' + ext);
    console.log(path.relative(ROOT, f), Math.round(fs.statSync(f).size / 1024) + ' KB');
  });
})().catch(e => { console.error(e); process.exit(1); });
