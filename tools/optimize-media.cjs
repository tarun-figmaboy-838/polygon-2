#!/usr/bin/env node
/* Converts runtime media to the formats the game ships:
     images  .png / .jpg  ->  .webp   (sharp; alpha kept)
             and an .avif twin of the .webp, where one is the same picture for clearly
             fewer bytes (see avifTwin below); a .webp given on its own gets just the twin
     audio   .mp3 / .wav  ->  .ogg    (Ogg Opus via ffmpeg) plus an .mp3
                                       fallback for browsers without Ogg
                                       (older Safari); an existing .mp3 is kept.

   Usage:
     node tools/optimize-media.cjs <file-or-folder> [...more]
       --quality=82     WebP quality for images without transparency
       --lossless       a lossless WebP (the same pixels as the source)
       --no-avif        make no AVIF twins
       --speech         encode audio as speech (mono, 40 kbps)
       --bitrate=96k    Opus bitrate for audio that is not speech (default 64k)
       --remove         delete each source after a successful conversion

   An AVIF twin is only used where the code asks for one (the game's asset table, the
   lesson's polygonAvif(), a stylesheet's image-set()): see README, Media formats.

   Needs the dev dependencies `sharp` and `ffmpeg-static` (or FFMPEG=path). */
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const args = process.argv.slice(2);
const flag = (name, dflt) => {
  const a = args.find(x => x === '--' + name || x.startsWith('--' + name + '='));
  if (!a) return dflt;
  return a.includes('=') ? a.split('=')[1] : true;
};
const inputs = args.filter(a => !a.startsWith('--'));
const QUALITY = Number(flag('quality', 82));
const LOSSLESS = !!flag('lossless', false);
const AVIF = !flag('no-avif', false);
const SPEECH = !!flag('speech', false);
const BITRATE = String(flag('bitrate', '64k'));
const REMOVE = !!flag('remove', false);

function ffmpeg() {
  if (process.env.FFMPEG) return process.env.FFMPEG;
  try { return require('ffmpeg-static'); } catch (e) { return 'ffmpeg'; }
}

function walk(p, out) {
  const st = fs.statSync(p);
  if (st.isDirectory()) fs.readdirSync(p).forEach(n => walk(path.join(p, n), out));
  else out.push(p);
  return out;
}

/* How far a decoded AVIF is from the WebP it would stand in for, over the pixels that show
   (alpha-weighted, so a transparent margin neither helps nor hurts): PSNR of the colour and of
   the alpha, SSIM of the luma over mid-grey in 8 x 8 blocks, and the worst 4 x 4 block's mean
   error with its 99.99th percentile -- the local measure is the one that notices a few faint
   stars going missing from a night sky, which the averages do not. */
function fidelity(a, b, w, h) {
  let se = 0, sa = 0, n = 0;
  for (let i = 0; i < a.length; i += 4) {
    if (a[i + 3] === 0 && b[i + 3] === 0) continue;
    n++;
    const aa = a[i + 3] / 255, ba = b[i + 3] / 255;
    for (let c = 0; c < 3; c++) { const d = a[i + c] * aa - b[i + c] * ba; se += d * d; }
    const da = a[i + 3] - b[i + 3]; sa += da * da;
  }
  const psnr = m => m === 0 ? 99 : 10 * Math.log10(255 * 255 / m);
  const grey = (d, i) => { const al = d[i + 3] / 255; return (0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]) * al + 128 * (1 - al); };
  const C1 = (0.01 * 255) ** 2, C2 = (0.03 * 255) ** 2;
  let ss = 0, sb = 0;
  for (let by = 0; by + 8 <= h; by += 8) for (let bx = 0; bx + 8 <= w; bx += 8) {
    let vis = false, ma = 0, mb = 0;
    const xa = [], xb = [];
    for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) {
      const i = ((by + y) * w + bx + x) * 4;
      if (a[i + 3] || b[i + 3]) vis = true;
      const u = grey(a, i), v = grey(b, i); xa.push(u); xb.push(v); ma += u; mb += v;
    }
    if (!vis) continue;
    ma /= 64; mb /= 64;
    let va = 0, vb = 0, cv = 0;
    for (let k = 0; k < 64; k++) { va += (xa[k] - ma) ** 2; vb += (xb[k] - mb) ** 2; cv += (xa[k] - ma) * (xb[k] - mb); }
    va /= 63; vb /= 63; cv /= 63;
    ss += ((2 * ma * mb + C1) * (2 * cv + C2)) / ((ma * ma + mb * mb + C1) * (va + vb + C2)); sb++;
  }
  const lum = (d, i) => (0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]) * d[i + 3] / 255;
  const blocks = [];
  for (let by = 0; by + 4 <= h; by += 4) for (let bx = 0; bx + 4 <= w; bx += 4) {
    let s = 0, vis = false;
    for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) {
      const i = ((by + y) * w + bx + x) * 4;
      if (a[i + 3] || b[i + 3]) vis = true;
      s += Math.abs(lum(a, i) - lum(b, i)) + Math.abs(a[i + 3] - b[i + 3]) * 0.5;
    }
    if (vis) blocks.push(s / 16);
  }
  blocks.sort((x, y) => x - y);
  return {
    rgb: psnr(se / (Math.max(1, n) * 3)), alpha: psnr(sa / Math.max(1, n)), ssim: sb ? ss / sb : 1,
    worst: blocks.length ? blocks[blocks.length - 1] : 0, p9999: blocks.length ? blocks[Math.floor(blocks.length * 0.9999)] : 0
  };
}
const BAR = { rgb: 42, alpha: 46, ssim: 0.985, worst: 7, p9999: 5, size: 0.8 };
const meets = m => m.rgb >= BAR.rgb && m.alpha >= BAR.alpha && m.ssim >= BAR.ssim && m.worst <= BAR.worst && m.p9999 <= BAR.p9999;

/* The lowest AVIF quality that clears the bar against the WebP as it decodes today, kept only
   if it is at least 20% smaller. Full-colour (4:4:4), because a cut-out's edge is where 4:2:0
   shows first. Returns the path written, or null with the reason. */
async function avifTwin(webp) {
  const sharp = require('sharp');
  const dest = webp.replace(/\.webp$/i, '.avif');
  const src = fs.readFileSync(webp);
  const ref = await sharp(src).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  for (let q = 45; q <= 90; q += 5) {
    const out = await sharp(src).avif({ quality: q, effort: 6, chromaSubsampling: '4:4:4' }).toBuffer();
    if (out.length > src.length * BAR.size) return { dest: null, why: 'not 20% smaller at the bar' };
    const dec = await sharp(out).ensureAlpha().raw().toBuffer();
    if (meets(fidelity(ref.data, dec, ref.info.width, ref.info.height))) { fs.writeFileSync(dest, out); return { dest, q }; }
  }
  return { dest: null, why: 'never clears the bar' };
}

async function image(file) {
  const sharp = require('sharp');
  const dest = file.replace(/\.(png|jpe?g)$/i, '.webp');
  const outs = [];
  if (dest !== file) {
    const meta = await sharp(file).metadata();
    const alpha = !!meta.hasAlpha;
    await sharp(file).webp(LOSSLESS ? { lossless: true, effort: 6 } : alpha
      ? { quality: 90, alphaQuality: 100, effort: 6, smartSubsample: true }
      : { quality: QUALITY, effort: 6, smartSubsample: true }).toFile(dest);
    outs.push(dest);
  }
  if (AVIF) {
    const t = await avifTwin(dest);
    if (t.dest) outs.push(t.dest);
    else console.log(`  ${path.basename(dest)}: no AVIF twin (${t.why})`);
  }
  return outs;
}

function audio(file) {
  const base = file.replace(/\.(mp3|wav)$/i, '');
  const ogg = base + '.ogg';
  const opus = SPEECH ? ['-ac', '1', '-b:a', '40k', '-application', 'voip'] : ['-b:a', BITRATE, '-application', 'audio'];
  // the audio stream only: an MP3's cover picture would otherwise come along as a video stream
  execFileSync(ffmpeg(), ['-y', '-v', 'error', '-i', file, '-map', '0:a:0', '-map_metadata', '-1', '-c:a', 'libopus', ...opus, ogg]);
  const outs = [ogg];
  if (/\.wav$/i.test(file)) {
    const mp3 = base + '.mp3';
    execFileSync(ffmpeg(), ['-y', '-v', 'error', '-i', file, '-c:a', 'libmp3lame', '-q:a', SPEECH ? '5' : '4', mp3]);
    outs.push(mp3);
  }
  return outs;
}

(async () => {
  if (!inputs.length) { console.error('usage: node tools/optimize-media.cjs <file-or-folder> [--speech] [--bitrate=64k] [--quality=82] [--lossless] [--no-avif] [--remove]'); process.exit(2); }
  const files = inputs.flatMap(p => walk(p, []));
  let before = 0, after = 0, count = 0;
  for (const f of files) {
    const isImg = /\.(png|jpe?g|webp)$/i.test(f), isAud = /\.(mp3|wav)$/i.test(f);
    if (!isImg && !isAud) continue;
    if (/\.webp$/i.test(f) && !AVIF) continue;
    const size = fs.statSync(f).size;
    const outs = isImg ? await image(f) : audio(f);
    if (!outs.length) continue;
    // what a current browser fetches: the AVIF where there is one, the Ogg
    const primary = fs.statSync(isImg ? outs[outs.length - 1] : outs[0]).size;
    before += size; after += primary; count++;
    console.log(`${path.relative(process.cwd(), f)}  ${Math.round(size / 1024)}KB -> ${outs.map(o => path.basename(o) + ' ' + Math.round(fs.statSync(o).size / 1024) + 'KB').join(', ')}`);
    if (REMOVE && !(isAud && /\.mp3$/i.test(f)) && !/\.webp$/i.test(f)) fs.unlinkSync(f);   // an .mp3 source stays as the fallback, a .webp as the WebP
  }
  console.log(`${count} files: ${Math.round(before / 1024)}KB -> ${Math.round(after / 1024)}KB`);
})().catch(e => { console.error(e); process.exit(1); });
