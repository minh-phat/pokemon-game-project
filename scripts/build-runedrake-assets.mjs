import sharp from 'sharp';
import { mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';

// Approved pose boards are the source art. The cutout board only removes its backdrop.
const sources = [
  resolve('docs/character-concepts/rune-dragon-movement-concept.png'),
  resolve('docs/character-concepts/rune-dragon-reactions-cutout.png'),
];
const output = resolve('apps/frontend/public/assets');
await mkdir(output, { recursive: true });

const boards = await Promise.all(
  sources.map(async (path) => {
    const { data, info } = await sharp(path)
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });
    if (info.width !== 1536 || info.height !== 1024 || info.channels !== 4)
      throw new Error(`Unexpected Runedrake source dimensions: ${path}`);
    return data;
  }),
);

// Cuts follow the transparent gaps between poses, which are not quite a uniform grid.
const poses = {
  idle: [0, 0, 384, 0, 512],
  run: [0, 384, 817, 0, 512],
  jump: [0, 817, 1181, 0, 512],
  fall: [0, 1181, 1536, 0, 512],
  land: [0, 0, 384, 512, 1024],
  dash: [0, 384, 852, 512, 1024],
  backstep: [0, 852, 1175, 512, 1024],
  crouch: [1, 0, 542, 0, 512],
  guard: [1, 542, 1002, 0, 512],
  hit: [1, 1002, 1536, 0, 512],
  knockback: [1, 0, 540, 512, 1024],
  faint: [1, 540, 1077, 512, 1024],
  victory: [1, 1077, 1536, 512, 1024],
};

async function cutout([board, left, right, top, bottom]) {
  const raw = boards[board];
  let minX = right,
    minY = bottom,
    maxX = left - 1,
    maxY = top - 1;
  for (let y = top; y < bottom; y++) {
    for (let x = left; x < right; x++) {
      const offset = (y * 1536 + x) * 4;
      if (raw[offset + 3] < 128) continue;
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
    }
  }
  if (maxX < minX) throw new Error('Empty Runedrake pose');
  const width = maxX - minX + 1;
  const height = maxY - minY + 1;
  const pixels = Buffer.alloc(width * height * 4);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const source = ((minY + y) * 1536 + minX + x) * 4;
      const target = (y * width + x) * 4;
      if (raw[source + 3] < 128) continue;
      pixels[target] = raw[source];
      pixels[target + 1] = raw[source + 1];
      pixels[target + 2] = raw[source + 2];
      pixels[target + 3] = 255;
    }
  }
  return sharp(pixels, { raw: { width, height, channels: 4 } })
    .png()
    .toBuffer();
}

const poseArt = Object.fromEntries(
  await Promise.all(Object.entries(poses).map(async ([name, rect]) => [name, await cutout(rect)])),
);

// Keep one silhouette in each animation. Rapidly alternating unrelated poses
// made the old run/dash/backstep rows look like they were blinking.
const rowPoses = [
  'idle',
  'run',
  'jump',
  'fall',
  'land',
  'dash',
  'victory',
  'dash',
  'backstep',
  'crouch',
  'guard',
  'hit',
  'knockback',
  'faint',
  'victory',
];
const waveAmplitude = [1, 2, 1, 1, 0, 1, 1, 1, 1, 0, 1, 0, 1, 0, 1];
const baseFrames = {};
for (const [name, source] of Object.entries(poseArt)) {
  const art = await sharp(source)
    .resize(148, 132, { fit: 'inside', kernel: 'nearest' })
    .flop() // Phaser mirrors left-facing art when the fighter faces left.
    .png()
    .toBuffer();
  const { width, height } = await sharp(art).metadata();
  baseFrames[name] = await sharp({
    create: { width: 160, height: 160, channels: 4, background: '#00000000' },
  })
    .composite([{ input: art, left: Math.round((160 - width) / 2), top: 152 - height }])
    .raw()
    .toBuffer();
}

const overlays = [];
for (let row = 0; row < rowPoses.length; row++) {
  const base = baseFrames[rowPoses[row]];
  for (let frame = 0; frame < 6; frame++) {
    const pixels = Buffer.alloc(160 * 160 * 4);
    const phase = (frame / 6) * Math.PI * 2;
    const drift =
      row === 7
        ? [0, 1, 2, 3, 2, 1][frame]
        : row === 8 || row === 12
          ? [0, -1, -2, -3, -2, -1][frame]
          : 0;
    const bob = row === 1 ? Math.round(Math.sin(phase)) : 0;
    for (let x = 0; x < 160; x++) {
      const bend = Math.round(waveAmplitude[row] * Math.sin(phase + (x / 160) * Math.PI * 2.5));
      const sourceX = x - drift;
      if (sourceX < 0 || sourceX >= 160) continue;
      for (let y = 0; y < 160; y++) {
        const sourceY = y - bend - bob;
        if (sourceY < 0 || sourceY >= 160) continue;
        base.copy(
          pixels,
          (y * 160 + x) * 4,
          (sourceY * 160 + sourceX) * 4,
          (sourceY * 160 + sourceX + 1) * 4,
        );
      }
    }
    overlays.push({
      input: await sharp(pixels, { raw: { width: 160, height: 160, channels: 4 } })
        .png()
        .toBuffer(),
      left: frame * 160,
      top: row * 160,
    });
  }
}
await sharp({
  create: { width: 960, height: 2400, channels: 4, background: '#00000000' },
})
  .composite(overlays)
  .png()
  .toFile(resolve(output, 'runedrake-sheet.png'));
await sharp(poseArt.idle)
  .resize(300, 300, { fit: 'contain', kernel: 'nearest', background: '#00000000' })
  .png()
  .toFile(resolve(output, 'runedrake.png'));
