import sharp from 'sharp';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

// Approved concept art remains the editable source for the raster game assets.
const source = resolve('docs/concepts/eevee-v2/eevee-character-concept.png');
const output = resolve('apps/frontend/public/assets');
await mkdir(output, { recursive: true });
const cells = [];
for (const [left, top] of [
  [0, 0],
  [768, 0],
  [0, 512],
  [768, 512],
]) {
  const quadrant = await sharp(source)
    .extract({ left, top, width: 768, height: 512 })
    .png()
    .toBuffer();
  const cropped = await sharp(quadrant)
    .trim({ background: '#00000000', threshold: 24 })
    .png()
    .toBuffer();
  cells.push(cropped);
}

const sequences = [
  [0, 0, 0, 0, 0, 0], // idle
  [1, 3, 1, 3, 1, 3], // run
  [1, 3, 3, 3, 3, 3], // jump
  [3, 3, 3, 3, 3, 1], // fall
  [3, 1, 1, 0, 0, 0], // land
  [1, 2, 2, 2, 0, 0], // attack
  [1, 0, 0, 0, 1, 0], // cast
  [1, 3, 3, 3, 3, 1], // dash
  [1, 3, 3, 3, 3, 1], // backstep
  [1, 1, 1, 1, 1, 1], // crouch
  [1, 1, 1, 1, 1, 1], // guard
  [0, 1, 1, 0, 0, 0], // hit
  [3, 3, 1, 1, 0, 0], // knockback
  [1, 1, 1, 1, 1, 1], // faint
  [0, 3, 0, 3, 0, 3], // victory
];
const spriteSheet = sharp({
  create: { width: 960, height: 2400, channels: 4, background: '#00000000' },
});
const overlays = [];
for (let row = 0; row < sequences.length; row++) {
  for (let frame = 0; frame < 6; frame++) {
    const pose = sequences[row][frame];
    const motion =
      row === 1
        ? [-7, -2, 6, 8, 2, -5][frame]
        : row === 5
          ? [-9, -2, 6, 12, 5, 0][frame]
          : row === 7 || row === 8
            ? [-10, -3, 5, 10, 12, 0][frame]
            : 0;
    const bounce =
      row === 1
        ? [0, -5, -2, 0, -5, -2][frame]
        : row === 0
          ? [0, -1, -2, -2, -1, 0][frame]
          : row === 14
            ? [0, -8, 0, -8, 0, -8][frame]
            : 0;
    const art = await sharp(cells[pose])
      .resize(148, 140, { fit: 'inside', kernel: 'nearest' })
      .png()
      .toBuffer();
    const meta = await sharp(art).metadata();
    overlays.push({
      input: art,
      left: Math.max(0, frame * 160 + Math.round((160 - meta.width) / 2) + motion),
      top: row * 160 + Math.max(0, 160 - meta.height - 5 + bounce),
    });
  }
}
await spriteSheet.composite(overlays).png().toFile(resolve(output, 'eevee-sheet.png'));
const portrait = await sharp(cells[0])
  .resize(320, 320, { fit: 'contain', kernel: 'nearest', background: '#00000000' })
  .png()
  .toBuffer();
await writeFile(resolve(output, 'eevee.png'), portrait);
