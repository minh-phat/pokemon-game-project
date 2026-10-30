import sharp from 'sharp';
import { mkdir } from 'node:fs/promises';

// Generated from the user's electric, blue-cheeked, fluffy-tail reference.
// Keep the source and these crop boundaries so `npm run assets` is reproducible.
const source = 'docs/character-concepts/pikachu/electric-fluff/source.png';
const output = 'apps/frontend/public/assets/';
const rows = [0, 130, 250, 380, 523, 663, 794, 939, 1051, 1185, 1315, 1447, 1586, 1712, 1829, 1983];
const { data, info } = await sharp(source)
  .ensureAlpha()
  .raw()
  .toBuffer({ resolveWithObject: true });
if (info.width !== 793 || info.height !== 1983) throw new Error('Unexpected Pikachu source size');
const alpha = (x, y) => data[(y * info.width + x) * 4 + 3];
const blank = (width, height) =>
  sharp({ create: { width, height, channels: 4, background: '#00000000' } });
const overlays = [];
let portrait;

// Row order: idle, run, jump, fall, land, attack, cast, dash, backstep,
// crouch, guard, hit, knockback, faint, victory. Six frames in each row.
for (let row = 0; row < 15; row++) {
  const top = rows[row];
  const bottom = rows[row + 1];
  const columns = [0];
  // Find the transparent gutters near each expected column boundary.
  for (let col = 1; col < 6; col++) {
    const expected = Math.round((col * info.width) / 6);
    let best = expected;
    let bestScore = Infinity;
    for (let x = expected - 16; x <= expected + 16; x++) {
      let occupied = 0;
      for (let y = top; y < bottom; y++) if (alpha(x, y) > 100) occupied++;
      const score = occupied * 100 + Math.abs(x - expected);
      if (score < bestScore) {
        bestScore = score;
        best = x;
      }
    }
    columns.push(best);
  }
  columns.push(info.width);
  for (let col = 0; col < 6; col++) {
    let x0 = columns[col + 1],
      x1 = -1,
      y0 = bottom,
      y1 = -1;
    for (let y = top; y < bottom; y++) {
      for (let x = columns[col]; x < columns[col + 1]; x++) {
        if (alpha(x, y) > 8) {
          x0 = Math.min(x0, x);
          x1 = Math.max(x1, x);
          y0 = Math.min(y0, y);
          y1 = Math.max(y1, y);
        }
      }
    }
    if (x1 < x0) throw new Error(`Empty Pikachu frame ${row}:${col}`);
    // A common scale retains pose proportions (especially crouch and faint).
    const width = Math.round((x1 - x0 + 1) * 0.95);
    const height = Math.round((y1 - y0 + 1) * 0.95);
    if (width > 152 || height > 148) throw new Error(`Oversized Pikachu frame ${row}:${col}`);
    const crop = await sharp(source)
      .extract({ left: x0, top: y0, width: x1 - x0 + 1, height: y1 - y0 + 1 })
      .png()
      .toBuffer();
    const input = await sharp(crop)
      .flop() // Engine uses unflipped sprites for facing right.
      .resize(width, height)
      .png()
      .toBuffer();
    const lift =
      row === 2
        ? [0, 4, 10, 12, 8, 4][col]
        : row === 3
          ? [12, 10, 8, 6, 3, 0][col]
          : row === 14
            ? [0, 4, 8, 4, 8, 0][col]
            : 0;
    const left = Math.round((160 - width) / 2);
    const frameTop = Math.max(2, 150 - height - lift);
    overlays.push({ input, left: col * 160 + left, top: row * 160 + frameTop });
    if (row === 0 && col === 0) portrait = { input, left, top: frameTop };
  }
}
await mkdir(output, { recursive: true });
await blank(960, 2400)
  .composite(overlays)
  .png()
  .toFile(output + 'pikachu-sheet.png');
await blank(160, 160)
  .composite([portrait])
  .png()
  .toFile(output + 'pikachu.png');
console.log('Packaged electric fluffy Pikachu: 15 states × 6 frames and portrait.');
