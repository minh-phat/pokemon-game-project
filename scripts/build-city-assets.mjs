import sharp from 'sharp';
import { writeFile } from 'node:fs/promises';

const root = new URL('../apps/frontend/public/assets/binh-minh/', import.meta.url);
// Measured visual cell boundaries of the generated source; preserve its alpha.
const xs = [0, 430, 852, 1254],
  ys = [0, 438, 826, 1254];
const layers = [];
for (let i = 0; i < 9; i++) {
  const col = i % 3,
    row = Math.floor(i / 3);
  const source = await sharp(new URL('buildings-source-v2.png', root).pathname)
    .extract({
      left: xs[col],
      top: ys[row],
      width: xs[col + 1] - xs[col],
      height: ys[row + 1] - ys[row],
    })
    .png()
    .toBuffer();
  const { data, info } = await sharp(source)
    .trim({ threshold: 15 })
    .resize({ width: 200 })
    .png()
    .toBuffer({ resolveWithObject: true });
  if (info.height > 246) throw new Error(`Sprite ${i} exceeds atlas height`);
  layers.push({
    input: data,
    left: col * 256 + Math.floor((256 - info.width) / 2),
    top: row * 256 + 246 - info.height,
  });
}
await sharp({ create: { width: 768, height: 768, channels: 4, background: '#00000000' } })
  .composite(layers)
  .png()
  .toFile(new URL('buildings-v2.png', root).pathname);
await writeFile(
  new URL('manifest-v2.json', root),
  JSON.stringify(
    {
      columns: 3,
      cell: 256,
      anchor: [128, 196],
      sprites: [
        'hospital',
        'academy',
        'creature-hospital',
        'arena',
        'market',
        'museum',
        'towers',
        'park',
        'portal',
      ],
    },
    null,
    2,
  ) + '\n',
);
