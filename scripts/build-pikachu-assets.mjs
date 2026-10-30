import sharp from 'sharp';
import { writeFile } from 'node:fs/promises';

// Imagegen-authored star-tail creature; package into the engine's 15 × 6 layout.
const source = 'docs/character-concepts/pikachu/star-tail-v1';
const output = 'apps/frontend/public/assets';
const actions = [
  'idle',
  'run',
  'jump',
  'fall',
  'land',
  'attack',
  'cast',
  'dash',
  'backstep',
  'crouch',
  'guard',
  'hit',
  'knockback',
  'faint',
  'victory',
];
const frames = [],
  registration = [];
const blank = (width, height) =>
  sharp({ create: { width, height, channels: 4, background: '#00000000' } });
for (const [file, boundaries, selections] of [
  [
    'actions',
    [0, 130, 250, 389, 539, 672, 800, 936, 1040, 1157, 1253, 1381, 1505, 1631, 1757, 1870, 1983],
    [
      [10, 10],
      [11, 11],
      [12, 12],
      [13, 13],
      [14, 14],
    ],
  ],
  [
    'hops',
    2,
    [
      [7, 0],
      [8, 1],
    ],
  ],
  [
    'movement',
    8,
    [
      [0, 0],
      [1, 1],
      [2, 2],
      [3, 3],
      [4, 4],
      [5, 5],
      [6, 6],
      [9, 7],
    ],
  ],
]) {
  const path = `${source}/${file}.png`;
  const { data, info } = await sharp(path)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const alpha = (x, y) => data[(y * info.width + x) * 4 + 3];
  const seam = (expected, radius, score) => {
    let best = Math.round(expected),
      cost = Infinity;
    for (
      let p = Math.max(1, Math.round(expected - radius));
      p <= Math.round(expected + radius);
      p++
    ) {
      const value = score(p) + Math.abs(p - expected) * 0.01;
      if (value < cost) {
        cost = value;
        best = p;
      }
    }
    return best;
  };
  const expected = Array.isArray(boundaries)
    ? boundaries
    : Array.from({ length: boundaries + 1 }, (_, i) => (i * info.height) / boundaries);
  const rows = expected.map((y, i) =>
    i === 0
      ? 0
      : i === expected.length - 1
        ? info.height
        : seam(y, Array.isArray(boundaries) ? 18 : (info.height / boundaries) * 0.18, (y) => {
            let sum = 0;
            for (let x = 0; x < info.width; x++) if (alpha(x, y) > 40) sum++;
            return sum;
          }),
  );
  const cells = [];
  for (const [action, row] of selections) {
    const top = rows[row],
      bottom = rows[row + 1];
    const columns = [0];
    for (let col = 1; col < 6; col++)
      columns.push(
        seam((col * info.width) / 6, (info.width / 6) * 0.18, (x) => {
          let sum = 0;
          for (let y = top; y < bottom; y++) if (alpha(x, y) > 40) sum++;
          return sum;
        }),
      );
    columns.push(info.width);
    for (let col = 0; col < 6; col++) {
      let x0 = info.width,
        y0 = info.height,
        x1 = -1,
        y1 = -1;
      for (let y = top; y < bottom; y++)
        for (let x = columns[col]; x < columns[col + 1]; x++)
          if (alpha(x, y) > 32) {
            x0 = Math.min(x0, x);
            x1 = Math.max(x1, x);
            y0 = Math.min(y0, y);
            y1 = Math.max(y1, y);
          }
      if (x1 < x0) throw new Error(`Empty ${file} ${row}/${col}`);
      const left = Math.max(columns[col], x0 - 1),
        cropTop = Math.max(top, y0 - 1);
      cells.push({
        action,
        col,
        left,
        top: cropTop,
        width: Math.min(columns[col + 1], x1 + 2) - left,
        height: Math.min(bottom, y1 + 2) - cropTop,
      });
    }
  }
  // One scale per source preserves authored squash/stretch and avoids ear/tail clipping.
  const scale = Math.min(...cells.map((c) => Math.min(148 / c.width, 140 / c.height)));
  for (const c of cells) {
    const width = Math.max(1, Math.round(c.width * scale)),
      height = Math.max(1, Math.round(c.height * scale));
    const pose = await sharp(path)
      .extract({ left: c.left, top: c.top, width: c.width, height: c.height })
      .resize(width, height)
      .png()
      .toBuffer();
    const frame = await blank(160, 160)
      .composite([{ input: pose, left: Math.round((160 - width) / 2), top: 150 - height }])
      .png()
      .toBuffer();
    frames.push({ input: frame, left: c.col * 160, top: c.action * 160 });
    registration.push({ action: actions[c.action], frame: c.col, source: file, crop: c, scale });
  }
}
await blank(960, 2400).composite(frames).png().toFile(`${output}/pikachu-sheet.png`);
await sharp(`${output}/pikachu-sheet.png`)
  .extract({ left: 0, top: 0, width: 160, height: 160 })
  .toFile(`${output}/pikachu.png`);
await writeFile(`${source}/registration.json`, JSON.stringify(registration, null, 2) + '\n');
console.log('Packaged star-tail summon: 15 actions × 6 frames and portrait.');
