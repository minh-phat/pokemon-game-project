import sharp from 'sharp';
import { writeFile } from 'node:fs/promises';

const directory = new URL('../apps/frontend/public/assets/world-v2/', import.meta.url);
// The generated sprites form four visual rows, not four mathematically equal rows.
// Keep their original alpha and normalize each object to a common ground anchor.
const xs = [0, 330, 646, 958, 1254],
  ys = [0, 361, 699, 971, 1254];
const sizes = [
  [84, 100],
  [65, 102],
  [66, 106],
  [73, 106],
  [84, 100],
  [78, 92],
  [35, 32],
  [78, 100],
  [38, 30],
  [38, 34],
  [38, 38],
  [44, 25],
  [19, 15],
  [22, 18],
  [22, 22],
  [24, 19],
];
const layers = [];
for (let i = 0; i < 16; i++) {
  const col = i % 4,
    row = Math.floor(i / 4);
  const cell = await sharp(new URL('props-source.png', directory).pathname)
    .extract({
      left: xs[col],
      top: ys[row],
      width: xs[col + 1] - xs[col],
      height: ys[row + 1] - ys[row],
    })
    .png()
    .toBuffer();
  const input = await sharp(cell)
    .trim({ threshold: 12 })
    .resize(sizes[i][0], sizes[i][1], { fit: 'inside', kernel: 'nearest' })
    .png()
    .toBuffer({ resolveWithObject: true });
  layers.push({
    input: input.data,
    left: col * 96 + Math.floor((96 - input.info.width) / 2),
    top: row * 112 + 104 - input.info.height,
  });
}
await sharp({ create: { width: 384, height: 448, channels: 4, background: '#00000000' } })
  .composite(layers)
  .png({ compressionLevel: 9 })
  .toFile(new URL('props.png', directory).pathname);
await sharp(new URL('terrain-source.png', directory).pathname)
  .resize(512, 512, { kernel: 'lanczos3' })
  .png({ compressionLevel: 9 })
  .toFile(new URL('terrain.png', directory).pathname);
await writeFile(
  new URL('manifest.json', directory),
  JSON.stringify(
    {
      version: 2,
      source: 'Built-in image_gen',
      props: {
        file: 'props.png',
        columns: 4,
        rows: 4,
        cell: [96, 112],
        anchor: [48, 104],
        names: [
          'oak',
          'birch',
          'pine',
          'snow-pine',
          'willow',
          'blossom',
          'berry-bush',
          'palm',
          'moss-rock',
          'basalt',
          'ice-rock',
          'fallen-log',
          'grass',
          'flowers',
          'reeds',
          'fern',
        ],
      },
      terrain: { file: 'terrain.png', columns: 4, rows: 4, cell: [128, 128] },
    },
    null,
    2,
  ) + '\n',
);
console.log('Built world-v2 pixel atlases, preserving source alpha.');
const cliffsDirectory = new URL('../apps/frontend/public/assets/world-v3/', import.meta.url);
await sharp(new URL('cliffs-source.png', cliffsDirectory).pathname)
  .resize(512, 512, { kernel: 'nearest' })
  .png({ compressionLevel: 9 })
  .toFile(new URL('cliffs.png', cliffsDirectory).pathname);
await writeFile(
  new URL('manifest.json', cliffsDirectory),
  JSON.stringify(
    {
      version: 3,
      source: 'Built-in image_gen',
      file: 'cliffs.png',
      columns: 2,
      rows: 2,
      cell: [256, 256],
      materials: ['sandstone-moss', 'alpine-granite', 'frozen-cliff', 'basalt'],
    },
    null,
    2,
  ) + '\n',
);
console.log('Built world-v3 cliff wall atlas.');
