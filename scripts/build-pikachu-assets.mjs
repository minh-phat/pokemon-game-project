import sharp from 'sharp';
import { mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';

const source = 'docs/character-concepts/pikachu/';
const extracted = 'docs/character-concepts/pikachu/extracted/';
const output = 'apps/frontend/public/assets/';
await mkdir(output, { recursive: true });

const blank = (width = 160, height = 160) =>
  sharp({ create: { width, height, channels: 4, background: '#00000000' } });

// Engine animation order (15 rows x 6 frames, each 160 x 160):
// 0: idle
// 1: run
// 2: jump
// 3: fall
// 4: land
// 5: attack
// 6: cast
// 7: dash
// 8: backstep
// 9: crouch
// 10: guard
// 11: hit
// 12: knockback
// 13: faint
// 14: victory
const rowFrames = [
  // 0: idle (breathing and blinking loop)
  [
    'movement_r0_c0.png',
    'movement_r0_c1.png',
    'movement_r0_c2.png',
    'movement_r0_c3.png',
    'movement_r0_c4.png',
    'movement_r0_c5.png',
  ],
  // 1: run (dynamic run cycle)
  [
    'movement_r1_c0.png',
    'movement_r1_c1.png',
    'movement_r1_c2.png',
    'movement_r1_c3.png',
    'movement_r1_c4.png',
    'movement_r1_c5.png',
  ],
  // 2: jump (squat windup -> launch -> rising -> apex)
  [
    'movement_r2_c0.png',
    'movement_r2_c1.png',
    'movement_r2_c2.png',
    'movement_r2_c3.png',
    'movement_r2_c2.png',
    'movement_r2_c1.png',
  ],
  // 3: fall (airborne falling with downward momentum)
  [
    'movement_r2_c3.png',
    'movement_r2_c4.png',
    'movement_r2_c4.png',
    'movement_r2_c4.png',
    'movement_r2_c5.png',
    'movement_r2_c5.png',
  ],
  // 4: land (impact squash -> rising back to standing)
  [
    'movement_r2_c5.png',
    'movement_r2_c5.png',
    'movement_r2_c6.png',
    'movement_r2_c0.png',
    'movement_r0_c0.png',
    'movement_r0_c0.png',
  ],
  // 5: attack (tackle lunge -> strike -> tail slap spin -> recover)
  [
    'combat_r0_c0.png',
    'combat_r0_c1.png',
    'combat_r0_c2.png',
    'combat_r0_c3.png',
    'combat_r0_c4.png',
    'combat_r0_c5.png',
  ],
  // 6: cast (cheeks sparking -> electricity surge -> thunderbolt discharge -> recover)
  [
    'combat_r1_c0.png',
    'combat_r1_c1.png',
    'combat_r1_c2a.png',
    'combat_r1_c2b.png',
    'combat_r1_c3.png',
    'combat_r1_c4.png',
  ],
  // 7: dash (Volt Tackle high-speed charge -> glide -> skid stop)
  [
    'combat_r2_c0.png',
    'combat_r2_c1.png',
    'combat_r2_c2.png',
    'combat_r2_c3.png',
    'combat_r2_c4.png',
    'combat_r2_c5.png',
  ],
  // 8: backstep (dodge leap backward -> landing)
  [
    'combat_r3_c0.png',
    'combat_r3_c1.png',
    'combat_r3_c2.png',
    'combat_r3_c3.png',
    'combat_r3_c2.png',
    'combat_r3_c0.png',
  ],
  // 9: crouch (low crouching stance)
  [
    'combat_r3_c4.png',
    'combat_r3_c5.png',
    'combat_r3_c4.png',
    'combat_r3_c5.png',
    'combat_r3_c4.png',
    'combat_r3_c5.png',
  ],
  // 10: guard (raising paws and wrapping tail forward in defensive posture)
  [
    'movement_r3_c1.png',
    'movement_r3_c2.png',
    'movement_r3_c3.png',
    'movement_r3_c4.png',
    'movement_r3_c5.png',
    'movement_r3_c6.png',
  ],
  // 11: hit (flinching back in pain)
  [
    'combat_r4_c0.png',
    'combat_r4_c1.png',
    'combat_r4_c0.png',
    'combat_r4_c1.png',
    'combat_r4_c0.png',
    'combat_r4_c3.png',
  ],
  // 12: knockback (tumbling onto ground -> rolling -> pushing back up)
  [
    'combat_r4_c1.png',
    'combat_r4_c2.png',
    'combat_r4_c3.png',
    'combat_r4_c2.png',
    'combat_r4_c1.png',
    'combat_r4_c0.png',
  ],
  // 13: faint (collapsing forward -> knocked out on belly with closed eyes)
  [
    'movement_r4_c0.png',
    'movement_r4_c1.png',
    'movement_r4_c2.png',
    'movement_r4_c3.png',
    'movement_r4_c4.png',
    'movement_r4_c5.png',
  ],
  // 14: victory (joyful victory bounce and cheering with both hands raised!)
  [
    'combat_r4_c3.png',
    'combat_r4_c4.png',
    'combat_r4_c5.png',
    'combat_r4_c4.png',
    'combat_r4_c5.png',
    'combat_r4_c4.png',
  ],
];

const scale = 0.74;
const overlays = [];

for (let r = 0; r < rowFrames.length; r++) {
  for (let c = 0; c < 6; c++) {
    const file = rowFrames[r][c];
    const img = sharp(extracted + file);
    const meta = await img.metadata();

    const w = Math.round(meta.width * scale);
    const h = Math.round(meta.height * scale);

    // Dynamic vertical displacement for jumps, falls and celebration bounces
    let yOffset = 0;
    if (r === 2) {
      yOffset = [0, -8, -18, -26, -18, -8][c]; // jump trajectory
    } else if (r === 3) {
      yOffset = [-24, -18, -12, -8, -4, 0][c]; // fall descending
    } else if (r === 14) {
      yOffset = [0, -8, -12, -8, -12, -8][c]; // victory hopping
    }

    const resized = await img.resize(w, h).png().toBuffer();
    const left = c * 160 + Math.round((160 - w) / 2);
    // Baseline: y = 150 (leaves 10px floor margin, matching Lam Quy and Eevee)
    const top = Math.max(r * 160 + 2, r * 160 + 150 - h + yOffset);

    overlays.push({ input: resized, left, top });
  }
}

// Build 960 x 2400 sprite sheet
await blank(960, 2400)
  .composite(overlays)
  .png()
  .toFile(output + 'pikachu-sheet.png');

// Build 160 x 160 portrait from user reference figurine
const refImage = sharp(source + 'pikachu-isolated.png');
const { data, info } = await refImage.raw().toBuffer({ resolveWithObject: true });
let minX = info.width,
  maxX = 0,
  minY = info.height,
  maxY = 0;
for (let y = 0; y < info.height; y++) {
  for (let x = 0; x < info.width; x++) {
    if (data[(y * info.width + x) * 4 + 3] > 30) {
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
  }
}

const portraitCropped = await refImage
  .extract({ left: minX, top: minY, width: maxX - minX + 1, height: maxY - minY + 1 })
  .png()
  .toBuffer();

const pMeta = await sharp(portraitCropped).metadata();
const pScale = 126 / pMeta.height;
const pW = Math.round(pMeta.width * pScale);
const pH = Math.round(pMeta.height * pScale);
const pResized = await sharp(portraitCropped).resize(pW, pH).png().toBuffer();

await blank(160, 160)
  .composite([
    {
      input: pResized,
      left: Math.round((160 - pW) / 2),
      top: 150 - pH,
    },
  ])
  .png()
  .toFile(output + 'pikachu.png');

console.log('Packaged Pikachu: 15 animation states × 6 frames and portrait.');
