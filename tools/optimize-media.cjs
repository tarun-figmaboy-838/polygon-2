#!/usr/bin/env node
/* Converts runtime media to the formats the game ships:
     images  .png / .jpg  ->  .webp   (sharp; alpha kept)
     audio   .mp3 / .wav  ->  .ogg    (Ogg Opus via ffmpeg) plus an .mp3
                                       fallback for browsers without Ogg
                                       (older Safari); an existing .mp3 is kept.

   Usage:
     node tools/optimize-media.cjs <file-or-folder> [...more]
       --quality=82     WebP quality for images without transparency
       --speech         encode audio as speech (mono, 40 kbps)
       --remove         delete each source after a successful conversion

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
const SPEECH = !!flag('speech', false);
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

async function image(file) {
  const sharp = require('sharp');
  const dest = file.replace(/\.(png|jpe?g)$/i, '.webp');
  const meta = await sharp(file).metadata();
  const alpha = !!meta.hasAlpha;
  await sharp(file).webp(alpha
    ? { quality: 90, alphaQuality: 100, effort: 6, smartSubsample: true }
    : { quality: QUALITY, effort: 6, smartSubsample: true }).toFile(dest);
  return dest;
}

function audio(file) {
  const base = file.replace(/\.(mp3|wav)$/i, '');
  const ogg = base + '.ogg';
  const opus = SPEECH ? ['-ac', '1', '-b:a', '40k', '-application', 'voip'] : ['-b:a', '64k', '-application', 'audio'];
  execFileSync(ffmpeg(), ['-y', '-v', 'error', '-i', file, '-c:a', 'libopus', ...opus, ogg]);
  const outs = [ogg];
  if (/\.wav$/i.test(file)) {
    const mp3 = base + '.mp3';
    execFileSync(ffmpeg(), ['-y', '-v', 'error', '-i', file, '-c:a', 'libmp3lame', '-q:a', SPEECH ? '5' : '4', mp3]);
    outs.push(mp3);
  }
  return outs;
}

(async () => {
  if (!inputs.length) { console.error('usage: node tools/optimize-media.cjs <file-or-folder> [--speech] [--quality=82] [--remove]'); process.exit(2); }
  const files = inputs.flatMap(p => walk(p, []));
  let before = 0, after = 0, count = 0;
  for (const f of files) {
    const isImg = /\.(png|jpe?g)$/i.test(f), isAud = /\.(mp3|wav)$/i.test(f);
    if (!isImg && !isAud) continue;
    const size = fs.statSync(f).size;
    const outs = isImg ? [await image(f)] : audio(f);
    const primary = fs.statSync(outs[0]).size;
    before += size; after += primary; count++;
    console.log(`${path.relative(process.cwd(), f)}  ${Math.round(size / 1024)}KB -> ${outs.map(o => path.basename(o) + ' ' + Math.round(fs.statSync(o).size / 1024) + 'KB').join(', ')}`);
    if (REMOVE && !(isAud && /\.mp3$/i.test(f))) fs.unlinkSync(f);   // an .mp3 source stays as the fallback
  }
  console.log(`${count} files: ${Math.round(before / 1024)}KB -> ${Math.round(after / 1024)}KB`);
})().catch(e => { console.error(e); process.exit(1); });
