import sharp from 'sharp';
import { mkdir, writeFile } from 'node:fs/promises';

// Authored imagegen poses, packaged in the engine's existing 15 x 6 layout.
const source = 'docs/character-concepts/bulbasaur/thorn-grove-v1';
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
const blank = (width, height) =>
  sharp({
    create: { width, height, channels: 4, background: '#00000000' },
  });
await mkdir(output, { recursive: true });
const frames = [];
const report = [];

const sources = [
  {
    file: 'combat',
    columns: 6,
    rows: 5,
    actions: [
      [4, [24, 25, 26, 27, 28, 0]],
      [5, [0, 1, 1, 15, 16, 5]],
      [6, [6, 7, 8, 9, 10, 11]],
      [7, [12, 13, 14, 15, 16, 17]],
      [8, [18, 19, 20, 21, 22, 23]],
      [9, [24, 25, 26, 27, 28, 29]],
      [10, [24, 25, 26, 27, 28, 29]],
    ],
  },
  { file: 'run', columns: 3, rows: 2, actions: [[1, [0, 1, 2, 3, 4, 5]]] },
  {
    file: 'jump',
    columns: 3,
    rows: 2,
    actions: [
      [2, [0, 1, 2, 3, 4, 5]],
      [3, [4, 5, 2, 1, 0, 0]],
    ],
  },
  {
    file: 'reactions',
    columns: 3,
    rows: 4,
    actions: [
      [11, [0, 1, 2, 3, 4, 5]],
      [12, [0, 1, 2, 3, 4, 5]],
      [13, [6, 7, 8, 9, 10, 11]],
    ],
  },
  {
    file: 'idle-victory',
    columns: 3,
    rows: 4,
    actions: [
      [0, [0, 1, 2, 3, 4, 5]],
      [14, [6, 7, 8, 9, 10, 11]],
    ],
  },
];
for (const { file, columns, rows, actions: selections } of sources) {
  const path = `${source}/${file}.png`;
  const metadata = await sharp(path).metadata();
  if (!metadata.hasAlpha) throw new Error(`${path} must have generated alpha transparency`);
  const pixels = await sharp(path).ensureAlpha().raw().toBuffer();
  const rowSeams = [0];
  for (let n = 1; n < rows; n++) {
    const expected = (n * metadata.height) / rows;
    let best = Math.round(expected),
      bestScore = Infinity;
    for (
      let y = Math.round(expected - metadata.height / 50);
      y < expected + metadata.height / 50;
      y++
    ) {
      let score = Math.abs(y - expected) * 0.002;
      for (let x = 0; x < metadata.width; x++)
        if (pixels[(y * metadata.width + x) * 4 + 3] >= 40) score++;
      if (score < bestScore) {
        bestScore = score;
        best = y;
      }
    }
    rowSeams.push(best);
  }
  rowSeams.push(metadata.height);
  const cells = [];
  for (let row = 0; row < rows; row++) {
    const rowTop = rowSeams[row];
    const rowHeight = rowSeams[row + 1] - rowTop;
    const strip = await sharp(path)
      .extract({ left: 0, top: rowTop, width: metadata.width, height: rowHeight })
      .ensureAlpha()
      .raw()
      .toBuffer();
    // Generated columns have small spacing errors. Find transparent seams
    // between poses instead of cutting through a face, claw or tail.
    const seams = [0];
    for (let n = 1; n < columns; n++) {
      const expected = (n * metadata.width) / columns;
      let best = Math.round(expected),
        bestScore = Infinity;
      for (
        let x = Math.round(expected - metadata.width / 24);
        x < expected + metadata.width / 24;
        x++
      ) {
        let score = Math.abs(x - expected) * 0.002;
        for (let y = 0; y < rowHeight; y++)
          if (strip[(y * metadata.width + x) * 4 + 3] >= 40) score++;
        if (score < bestScore) {
          bestScore = score;
          best = x;
        }
      }
      seams.push(best);
    }
    seams.push(metadata.width);
    for (let col = 0; col < columns; col++) {
      // Round boundaries independently: generated canvas sizes can vary.
      const left = seams[col];
      const top = rowTop;
      const width = seams[col + 1] - left;
      const height = rowHeight;
      const cell = await sharp(path).extract({ left, top, width, height }).png().toBuffer();
      const { data, info } = await sharp(cell)
        .ensureAlpha()
        .raw()
        .toBuffer({ resolveWithObject: true });
      let x0 = width,
        y0 = height,
        x1 = 0,
        y1 = 0,
        visible = 0;
      const belly = [];
      let bodyLeft = width,
        bodyRight = 0;
      for (let y = 0; y < height; y++)
        for (let x = 0; x < width; x++) {
          if (data[(y * width + x) * info.channels + 3] < 40) continue;
          x0 = Math.min(x0, x);
          x1 = Math.max(x1, x);
          y0 = Math.min(y0, y);
          y1 = Math.max(y1, y);
          visible++;
          const i = (y * width + x) * info.channels;
          if (
            data[i] < 170 &&
            data[i + 1] > 110 &&
            data[i + 2] > 100 &&
            data[i + 1] > data[i] * 1.15 &&
            data[i + 2] > data[i] * 1.05
          ) {
            if (data[i + 3] > 120) {
              bodyLeft = Math.min(bodyLeft, x);
              bodyRight = Math.max(bodyRight, x);
            }
            if (y > height * 0.4 && y < height * 0.82) belly.push(x);
          }
        }
      if (visible < 1000) throw new Error(`Empty source frame ${file} ${row}/${col}`);
      belly.sort((a, b) => a - b);
      const anchor = belly.length > 30 ? belly[Math.floor(belly.length / 2)] : (x0 + x1) / 2;
      cells.push({
        cell,
        width,
        height,
        x0,
        x1,
        y0,
        y1,
        row,
        col,
        anchor,
        bodyWidth: bodyRight - bodyLeft + 1,
      });
    }
  }
  // A constant scale per set preserves volume and authored squash/stretch.
  const selected = selections.flatMap(([row, indices]) =>
    indices.map((index, col) => ({ ...cells[index], row, col, sourceFrame: index })),
  );
  // Match torso size across different source resolutions, independent of vines.
  const scale = Math.min(
    110 / cells[0].bodyWidth,
    ...selected.map((c) => 146 / (c.x1 - c.x0 + 1)),
    ...selected.map((c) => 140 / (c.y1 - c.y0 + 1)),
  );
  for (const c of selected) {
    // Register the belly, so extending a claw/tail does not shift the torso.
    const cropLeft = Math.max(0, c.x0 - 2);
    const cropRight = Math.min(c.width, c.x1 + 3);
    const width = Math.round((cropRight - cropLeft) * scale);
    const cropTop = Math.max(0, c.y0 - 2);
    const cropBottom = Math.min(c.height, c.y1 + 3);
    const height = Math.round((cropBottom - cropTop) * scale);
    const scaled = await sharp(c.cell)
      .extract({
        left: cropLeft,
        top: cropTop,
        width: cropRight - cropLeft,
        height: cropBottom - cropTop,
      })
      .resize(width, height)
      .png()
      .toBuffer();
    const left = Math.max(3, Math.min(157 - width, 80 - Math.round((c.anchor - cropLeft) * scale)));
    // Arena physics supplies airborne altitude; avoid baking in a second jump.
    const top = 149 - Math.round((c.y1 - cropTop) * scale);
    const frame = await blank(160, 160)
      .composite([{ input: scaled, left, top }])
      .png()
      .toBuffer();
    const row = c.row;
    frames.push({ input: frame, left: c.col * 160, top: row * 160 });
    report.push({
      action: actions[row],
      frame: c.col,
      source: file,
      sourceFrame: c.sourceFrame,
      scale,
      left,
      top,
    });
  }
}
await blank(960, 2400).composite(frames).png().toFile(`${output}/bulbasaur-sheet.png`);
await sharp(frames.find((frame) => frame.top === 0 && frame.left === 0).input).toFile(
  `${output}/bulbasaur.png`,
);
await writeFile(`${source}/registration.json`, JSON.stringify(report, null, 2) + '\n');
console.log(
  'Packaged Bulbasaur thorn-grove creature: 90 animation cells, 15 actions, alpha portrait.',
);
