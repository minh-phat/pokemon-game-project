import sharp from 'sharp';
import { mkdir } from 'node:fs/promises';
const source = 'docs/character-concepts/water-slime/';
const output = 'apps/frontend/public/assets/';
await mkdir(output, { recursive: true });
// Package generated artwork only: preserve the original alpha and each authored pose.
async function cells(file) {
  const image = sharp(source + file);
  const { width, height, hasAlpha } = await image.metadata();
  if (!hasAlpha) throw new Error('Water Slime artwork must have transparency');
  const { data, info } = await image
    .clone()
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const bounds = file.startsWith('skills')
    ? [0, 260, 480, 700, 918, height]
    : [0, 260, 505, 725, 930, height];
  return Promise.all(
    Array.from({ length: 30 }, async (_, i) => {
      const col = i % 6,
        row = Math.floor(i / 6);
      const left = Math.round((col * width) / 6),
        right = Math.round(((col + 1) * width) / 6);
      const top = bounds[row],
        bottom = bounds[row + 1];
      let x0 = right,
        y0 = bottom,
        x1 = left,
        y1 = top;
      for (let y = top; y < bottom; y++)
        for (let x = left; x < right; x++) {
          if (data[(y * info.width + x) * 4 + 3] > 160) {
            x0 = Math.min(x0, x);
            x1 = Math.max(x1, x);
            y0 = Math.min(y0, y);
            y1 = Math.max(y1, y);
          }
        }
      x0 = Math.max(left, x0 - 2);
      x1 = Math.min(right - 1, x1 + 2);
      y0 = Math.max(top, y0 - 2);
      y1 = Math.min(bottom - 1, y1 + 2);
      const w = Math.round((x1 - x0 + 1) * 0.56),
        h = Math.round((y1 - y0 + 1) * 0.56);
      const input = await image
        .clone()
        .extract({ left: x0, top: y0, width: x1 - x0 + 1, height: y1 - y0 + 1 })
        .resize(w, h, { kernel: 'nearest' })
        .png()
        .toBuffer();
      return sharp({ create: { width: 160, height: 160, channels: 4, background: '#00000000' } })
        .composite([{ input, left: Math.round((160 - w) / 2), top: 152 - h }])
        .png()
        .toBuffer();
    }),
  );
}
const skill = await cells('skills-source.png');
const motion = await cells('motion-source.png');
const row = (frames, index) => frames.slice(index * 6, index * 6 + 6);
// idle, run, jump, fall, land, attack, cast, dash, backstep, crouch,
// guard, hit, knockback, faint, victory: shared engine animation order.
const rows = [
  row(skill, 0),
  row(motion, 0),
  [6, 7, 8, 8, 8, 8].map((i) => motion[i]),
  [8, 8, 9, 9, 10, 10].map((i) => motion[i]),
  [9, 10, 11, 11, 11, 11].map((i) => motion[i]),
  row(skill, 1),
  row(skill, 2),
  row(skill, 4),
  row(motion, 0).toReversed(),
  row(skill, 3),
  row(skill, 3),
  row(motion, 2),
  row(motion, 2),
  [18, 19, 20, 21, 22, 22].map((i) => motion[i]),
  row(motion, 4),
];
await sharp({ create: { width: 960, height: 2400, channels: 4, background: '#00000000' } })
  .composite(
    rows.flatMap((frames, r) => frames.map((input, c) => ({ input, left: c * 160, top: r * 160 }))),
  )
  .png()
  .toFile(output + 'water-slime-sheet.png');
await sharp(skill[0])
  .png()
  .toFile(output + 'water-slime.png');
await sharp(source + 'wrap-source.png')
  .resize(160, 160, { fit: 'contain', kernel: 'nearest', background: '#00000000' })
  .png()
  .toFile(output + 'water-slime-wrap.png');
console.log('Packaged Water Slime: 90 animation frames, portrait and liquid wrap artwork.');
