import sharp from 'sharp';
import { mkdir, writeFile } from 'node:fs/promises';

const source = 'docs/character-concepts/directions-v1';
const output = 'apps/frontend/public/assets';
const ids = process.argv.slice(2);
const species = ids.length
  ? ids
  : ['water-slime', 'charmander', 'lam-quy', 'eevee', 'runedrake', 'pikachu', 'bulbasaur'];
await mkdir(output, { recursive: true });

for (const id of species) {
  const path = `${source}/${id}.png`;
  const { data, info } = await sharp(path)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const alpha = (x, y) => data[(y * info.width + x) * 4 + 3];
  let transparent = 0;
  for (let i = 3; i < data.length; i += 4) if (data[i] === 0) transparent++;
  if (transparent < info.width * info.height * 0.15)
    throw new Error(`${id}: source needs real transparent alpha`);
  // Use empty seams near the requested grid rather than clipping slightly uneven generated rows.
  const seams = (size, count, score) => {
    const result = [0];
    for (let i = 1; i < count; i++) {
      const expected = (size * i) / count;
      let best = Math.round(expected),
        cost = Infinity;
      for (
        let p = Math.round(expected - (size / count) * 0.15);
        p <= expected + (size / count) * 0.15;
        p++
      ) {
        const value = score(p) + Math.abs(p - expected) * 0.001;
        if (value < cost) {
          best = p;
          cost = value;
        }
      }
      result.push(best);
    }
    return [...result, size];
  };
  const rows = seams(info.height, 4, (y) => {
    let sum = 0;
    for (let x = 0; x < info.width; x++) if (alpha(x, y) > 32) sum++;
    return sum;
  });
  const cells = [];
  for (let row = 0; row < 4; row++) {
    const columns = seams(info.width, 6, (x) => {
      let sum = 0;
      for (let y = rows[row]; y < rows[row + 1]; y++) if (alpha(x, y) > 32) sum++;
      return sum;
    });
    for (let col = 0; col < 6; col++) {
      let x0 = info.width,
        y0 = info.height,
        x1 = -1,
        y1 = -1;
      for (let y = rows[row]; y < rows[row + 1]; y++)
        for (let x = columns[col]; x < columns[col + 1]; x++)
          if (alpha(x, y) > 32) {
            x0 = Math.min(x0, x);
            y0 = Math.min(y0, y);
            x1 = Math.max(x1, x);
            y1 = Math.max(y1, y);
          }
      if (x1 < x0) throw new Error(`${id}: empty pose ${row}, ${col}`);
      // Keep antialiased edges while preserving the tool's original transparency.
      const left = Math.max(columns[col], x0 - 2),
        top = Math.max(rows[row], y0 - 2);
      cells.push({
        row,
        col,
        left,
        top,
        width: Math.min(columns[col + 1], x1 + 3) - left,
        height: Math.min(rows[row + 1], y1 + 3) - top,
      });
    }
  }
  const frameWidth = id === 'runedrake' ? 320 : 160;
  const scale = Math.min(
    ...cells.map((c) => Math.min((frameWidth - 20) / c.width, 138 / c.height)),
  );
  const base = await sharp(`${output}/${id}-sheet.png`)
    .extract({ left: 0, top: 0, width: frameWidth * 6, height: 320 })
    .png()
    .toBuffer();
  const frames = [{ input: base, left: 0, top: 0 }];
  for (const cell of cells) {
    const { row, col, left, top, width, height } = cell;
    const w = Math.max(1, Math.round(width * scale)),
      h = Math.max(1, Math.round(height * scale));
    let pose = sharp(path).extract({ left, top, width, height });
    // The generated dragon's front diagonal faces left; register it as southeast.
    if (id === 'runedrake' && row === 2) pose = pose.flop();
    frames.push({
      input: await pose.resize(w, h).png().toBuffer(),
      left: col * frameWidth + Math.round((frameWidth - w) / 2),
      top: (row + 2) * 160 + 150 - h,
    });
  }
  const packed = await sharp({
    create: { width: frameWidth * 6, height: 960, channels: 4, background: '#00000000' },
  })
    .composite(frames)
    .raw()
    .toBuffer();
  // Preserve the original pixels exactly; alpha compositing can round RGB at translucent edges.
  const original = await sharp(base).raw().toBuffer();
  original.copy(packed, 0);
  await sharp(packed, { raw: { width: frameWidth * 6, height: 960, channels: 4 } })
    .png()
    .toFile(`${output}/${id}-directions.png`);
  await writeFile(
    `${source}/${id}-registration.json`,
    JSON.stringify(
      {
        frameWidth,
        frameHeight: 160,
        baseline: 150,
        scale,
        rows: ['east-idle', 'east-run', 'north-run', 'northeast-run', 'southeast-run', 'south-run'],
        cells,
      },
      null,
      2,
    ) + '\n',
  );
  console.log(
    `${id}: 24 new directional run poses, original side idle/run, 8 headings with mirroring.`,
  );
}
