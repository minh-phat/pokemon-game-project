import sharp from 'sharp';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const source = resolve('docs/concepts/eevee-v3');
const output = resolve('apps/frontend/public/assets');
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
const blank = (width, height) =>
  sharp({ create: { width, height, channels: 4, background: '#00000000' } });
await mkdir(output, { recursive: true });
const frames = [],
  report = [];
let portrait;
const sequence = (start) => Array.from({ length: 6 }, (_, i) => start + i);
// Combat atlas generation was rejected. Reuse suitable authored poses explicitly.
const sources = [
  {
    file: 'movement',
    selections: [
      [0, sequence(0)],
      [1, sequence(6)],
      [2, [12, 13, 14, 15, 16, 18]],
      [3, sequence(18)],
      [4, sequence(24)],
      [7, sequence(6)],
      [8, [12, 16, 15, 14, 13, 17]],
    ],
  },
  {
    file: 'reactions',
    selections: [
      [5, [24, 25, 26, 1, 0, 29]],
      [6, sequence(6)],
      [9, sequence(0)],
      [10, sequence(0)],
      [11, sequence(6)],
      [12, sequence(12)],
      [13, sequence(18)],
      [14, sequence(24)],
    ],
  },
];
for (const { file, selections } of sources) {
  const path = `${source}/${file}.png`;
  const metadata = await sharp(path).metadata();
  if (!metadata.hasAlpha) throw new Error(`${file}: expected generated transparency`);
  const { data, info } = await sharp(path)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  // Segment silhouettes instead of trusting generated grid spacing. Keep original alpha in output.
  const visited = new Uint8Array(info.width * info.height);
  const ownership = new Int32Array(visited.length);
  let component = 0;
  const queue = new Int32Array(visited.length);
  const poses = [];
  for (let start = 0; start < visited.length; start++) {
    if (visited[start] || data[start * 4 + 3] < 40) continue;
    let head = 0,
      tail = 1;
    queue[0] = start;
    component++;
    visited[start] = 1;
    let x0 = info.width,
      y0 = info.height,
      x1 = 0,
      y1 = 0;
    while (head < tail) {
      const p = queue[head++];
      ownership[p] = component;
      const x = p % info.width,
        y = Math.floor(p / info.width);
      x0 = Math.min(x0, x);
      x1 = Math.max(x1, x);
      y0 = Math.min(y0, y);
      y1 = Math.max(y1, y);
      const neighbors = [];
      if (x > 0) neighbors.push(p - 1);
      if (x + 1 < info.width) neighbors.push(p + 1);
      if (y > 0) neighbors.push(p - info.width);
      if (y + 1 < info.height) neighbors.push(p + info.width);
      for (const next of neighbors) {
        if (visited[next] || data[next * 4 + 3] < 40) continue;
        visited[next] = 1;
        queue[tail++] = next;
      }
    }
    if (tail > 1000) poses.push({ x0, y0, x1, y1, pixels: tail, component });
  }
  if (poses.length !== 30)
    throw new Error(`${file}: expected 30 separated poses, found ${poses.length}`);
  poses.sort((a, b) => a.y0 + a.y1 - (b.y0 + b.y1));
  const ordered = [];
  for (let row = 0; row < 5; row++)
    ordered.push(...poses.slice(row * 6, row * 6 + 6).sort((a, b) => a.x0 - b.x0));
  // Fixed scale within each set retains authored squash/stretch instead of enlarging crouches.
  const scale = Math.min(
    ...poses.map((p) => 146 / (p.x1 - p.x0 + 3)),
    ...poses.map((p) => 140 / (p.y1 - p.y0 + 3)),
  );
  const selected = selections.flatMap(([row, indices]) =>
    indices.map((index, col) => ({ row, col, index, p: ordered[index] })),
  );
  for (const { row, col, index, p } of selected) {
    const left = Math.max(0, p.x0 - 1),
      top = Math.max(0, p.y0 - 1);
    const width = Math.min(info.width, p.x1 + 2) - left;
    const height = Math.min(info.height, p.y1 + 2) - top;
    // Bounding boxes can overlap a neighboring tail/head even when silhouettes
    // are separate. Extract only this component plus its antialiased edge.
    const isolated = Buffer.alloc(width * height * 4);
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const sx = left + x,
          sy = top + y;
        let belongs = false;
        for (let dy = -1; dy <= 1 && !belongs; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            const nx = sx + dx,
              ny = sy + dy;
            if (
              nx >= 0 &&
              nx < info.width &&
              ny >= 0 &&
              ny < info.height &&
              ownership[ny * info.width + nx] === p.component
            ) {
              belongs = true;
              break;
            }
          }
        }
        if (belongs) {
          const offset = (sy * info.width + sx) * 4;
          data.copy(isolated, (y * width + x) * 4, offset, offset + 4);
        }
      }
    }
    const art = await sharp(isolated, { raw: { width, height, channels: 4 } })
      .resize(Math.round(width * scale), Math.round(height * scale))
      .png()
      .toBuffer();
    const size = await sharp(art).metadata();
    // Physics supplies airborne altitude; feet use the same baseline for all states.
    const frame = await blank(160, 160)
      .composite([
        {
          input: art,
          left: Math.round((160 - size.width) / 2),
          top: 150 - size.height,
        },
      ])
      .png()
      .toBuffer();
    frames.push({ input: frame, left: col * 160, top: row * 160 });
    report.push({
      action: actions[row],
      frame: col,
      source: file,
      sourceFrame: index,
      sourceBounds: p,
      scale,
    });
    if (row === 0 && col === 0) portrait = frame;
  }
}
await blank(960, 2400).composite(frames).png().toFile(`${output}/eevee-sheet.png`);
await sharp(portrait).resize(320, 320).png().toFile(`${output}/eevee.png`);
await writeFile(`${source}/registration.json`, JSON.stringify(report, null, 2) + '\n');
console.log('Packaged Eevee nature spirit: 60 source poses, 90 animation cells, 15 actions.');
