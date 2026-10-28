import sharp from 'sharp';
import { mkdir } from 'node:fs/promises';

const source = 'docs/character-concepts/lam-quy/';
const output = 'apps/frontend/public/assets/';
await mkdir(output, { recursive: true });
const blank = (width = 160, height = 160) =>
  sharp({ create: { width, height, channels: 4, background: '#00000000' } });

async function board(file, xs, ys, rowBounds = {}) {
  const image = sharp(source + file);
  const metadata = await image.metadata();
  if (!metadata.hasAlpha) throw new Error(`${file} must preserve source transparency`);
  return Promise.all(
    Array.from({ length: (xs.length - 1) * (ys.length - 1) }, async (_, i) => {
      const col = i % (xs.length - 1);
      const row = Math.floor(i / (xs.length - 1));
      const columns = rowBounds[row] ?? xs;
      // Raised hands cross the nominal row boundary in these two jump poses.
      const top = file === 'movement-source.png' && (i === 14 || i === 15) ? 400 : ys[row] + 2;
      const cropped = await image
        .clone()
        .extract({
          left: columns[col] + 6,
          top,
          width: columns[col + 1] - columns[col] - 12,
          height: ys[row + 1] - top - 2,
        })
        .png()
        .toBuffer();
      const crop = sharp(cropped);
      const { data, info } = await crop.clone().raw().toBuffer({ resolveWithObject: true });
      let x0 = info.width,
        y0 = info.height,
        x1 = -1,
        y1 = -1;
      for (let y = 0; y < info.height; y++)
        for (let x = 0; x < info.width; x++)
          if (data[(y * info.width + x) * 4 + 3] > 180) {
            x0 = Math.min(x0, x);
            y0 = Math.min(y0, y);
            x1 = Math.max(x1, x);
            y1 = Math.max(y1, y);
          }
      if (file === 'movement-source.png') {
        // Crop the connected character, excluding toes from the row above.
        const seen = new Uint8Array(info.width * info.height);
        let largest = 0;
        for (let start = 0; start < seen.length; start++) {
          if (seen[start] || data[start * 4 + 3] <= 180) continue;
          const queue = [start];
          seen[start] = 1;
          let left = info.width,
            right = 0,
            upper = info.height,
            lower = 0;
          for (let p = 0; p < queue.length; p++) {
            const index = queue[p],
              x = index % info.width,
              y = Math.floor(index / info.width);
            left = Math.min(left, x);
            right = Math.max(right, x);
            upper = Math.min(upper, y);
            lower = Math.max(lower, y);
            for (const next of [
              x > 0 ? index - 1 : -1,
              x + 1 < info.width ? index + 1 : -1,
              index - info.width,
              index + info.width,
            ]) {
              if (next < 0 || next >= seen.length || seen[next] || data[next * 4 + 3] <= 180)
                continue;
              seen[next] = 1;
              queue.push(next);
            }
          }
          if (queue.length > largest) {
            largest = queue.length;
            x0 = left;
            x1 = right;
            y0 = upper;
            y1 = lower;
          }
        }
      }
      if (x1 < x0) throw new Error(`Empty pose ${file}:${i}`);
      const width = x1 - x0 + 1,
        height = y1 - y0 + 1;
      // One scale per board preserves the relative size of standing and tucked poses.
      const scale = Math.min(0.6, 144 / width, 142 / height);
      return crop
        .extract({ left: x0, top: y0, width, height })
        .resize(Math.round(width * scale), Math.round(height * scale))
        .png()
        .toBuffer();
    }),
  );
}

const combat = await board(
  'combat-source.png',
  [192, 450, 699, 983, 1287, 1536],
  [0, 205, 407, 585, 789, 1024],
);
const motion = await board(
  'movement-source.png',
  [0, 256, 512, 768, 1024, 1280, 1536],
  [0, 219, 418, 630, 840, 1024],
  { 2: [0, 275, 535, 785, 1035, 1280, 1536] },
);
const six = (indices) => indices.map((i) => combat[i]);
const row = (r) => motion.slice(r * 6, r * 6 + 6);
// Engine order: idle/run/jump/fall/land/attack/cast/dash/backstep/crouch/
// guard/hit/knockback/faint/victory. Five-pose actions hold the recovery frame.
const rows = [
  row(0),
  row(1),
  row(2),
  [motion[15], motion[15], motion[16], motion[16], motion[17], motion[17]],
  [motion[17], combat[22], combat[21], combat[20], motion[0], motion[0]],
  six([0, 1, 2, 3, 4, 4]),
  six([5, 6, 7, 8, 9, 9]),
  six([10, 11, 12, 13, 14, 14]),
  six([15, 16, 17, 18, 19, 19]),
  six([21, 22, 23, 22, 21, 21]),
  row(3),
  six([15, 16, 18, 16, 15, 15]),
  six([15, 16, 17, 18, 19, 19]),
  row(4),
  [motion[13], motion[14], motion[15], motion[14], motion[13], motion[12]],
];
const overlays = [];
for (const [r, frames] of rows.entries()) {
  for (const [c, art] of frames.entries()) {
    const { width, height } = await sharp(art).metadata();
    const bob = r === 14 ? Math.round(3 * Math.sin((c / 6) * Math.PI * 2)) : 0;
    overlays.push({
      input: art,
      left: c * 160 + Math.round((160 - width) / 2),
      top: r * 160 + 151 - height - bob,
    });
  }
}
await blank(960, 2400)
  .composite(overlays)
  .png()
  .toFile(output + 'lam-quy-sheet.png');
const portrait = combat[0];
const { width, height } = await sharp(portrait).metadata();
await blank()
  .composite([{ input: portrait, left: Math.round((160 - width) / 2), top: 151 - height }])
  .png()
  .toFile(output + 'lam-quy.png');
console.log('Packaged Lam Quy: 15 animation states × 6 frames and portrait.');
