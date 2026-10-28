import sharp from 'sharp';
import { mkdir } from 'node:fs/promises';

const source = 'docs/character-concepts/charmander/';
const extracted = 'docs/character-concepts/charmander/extracted/';
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
  // 0: idle (breathing, blinking and tail flame flicker loop)
  [
    'movement_r0_c0.png',
    'movement_r0_c1.png',
    'movement_r0_c2.png',
    'movement_r0_c3.png',
    'movement_r0_c4.png',
    'movement_r0_c5.png',
  ],
  // 1: run (smooth, grounded 6-frame biped walk/run cycle with alternating footsteps and gentle gait)
  [
    'walk_v4_c0.png',
    'walk_v4_c1.png',
    'walk_v4_c2.png',
    'walk_v4_c3.png',
    'walk_v4_c4.png',
    'walk_v4_c5.png',
  ],
  // 2: jump (squat windup -> launch -> rising -> apex)
  [
    'movement_r2_c0.png',
    'movement_r2_c1.png',
    'movement_r2_c1.png',
    'movement_r2_c2.png',
    'movement_r2_c2.png',
    'movement_r2_c3.png',
  ],
  // 3: fall (airborne falling with downward momentum)
  [
    'movement_r2_c3.png',
    'movement_r2_c3.png',
    'movement_r2_c4.png',
    'movement_r2_c4.png',
    'movement_r2_c4.png',
    'movement_r2_c4.png',
  ],
  // 4: land (impact squash -> rising back to standing)
  [
    'movement_r2_c4.png',
    'movement_r2_c5.png',
    'movement_r2_c5.png',
    'movement_r2_c0.png',
    'movement_r0_c0.png',
    'movement_r0_c0.png',
  ],
  // 5: attack (Scratch & Slash: windup -> claw slash with swipe arc -> follow through)
  [
    'combat_r0_c0.png',
    'combat_r0_c1.png',
    'combat_r0_c2.png',
    'combat_r0_c3.png',
    'combat_r0_c4.png',
    'combat_r0_c5.png',
  ],
  // 6: cast (Ember & Flamethrower: deep breath -> spark surge -> blazing fireball and fire stream)
  [
    'combat_r1_c0.png',
    'combat_r1_c1.png',
    'combat_r1_c2.png',
    'combat_r1_c3.png',
    'combat_r1_c4.png',
    'combat_r1_c5.png',
  ],
  // 7: dash (Flame Charge: fiery burst sprint with blazing trail -> skid stop)
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
    'combat_r3_c2.png',
    'combat_r3_c1.png',
    'combat_r3_c0.png',
  ],
  // 9: crouch (low crouching stance)
  [
    'combat_r3_c3.png',
    'combat_r3_c4.png',
    'combat_r3_c4.png',
    'combat_r3_c4.png',
    'combat_r3_c4.png',
    'combat_r3_c5.png',
  ],
  // 10: guard (raising arms and claws defensively, protecting body)
  [
    'movement_r3_c0.png',
    'movement_r3_c1.png',
    'movement_r3_c2.png',
    'movement_r3_c3.png',
    'movement_r3_c4.png',
    'movement_r3_c5.png',
  ],
  // 11: hit (wincing back in pain from damage)
  [
    'combat_r4_c0.png',
    'combat_r4_c1.png',
    'combat_r4_c0.png',
    'combat_r4_c1.png',
    'combat_r4_c0.png',
    'combat_r4_c2.png',
  ],
  // 12: knockback (tumbling stumble -> slide on ground -> pushing back up)
  [
    'combat_r4_c1.png',
    'combat_r4_c1.png',
    'combat_r4_c2.png',
    'combat_r4_c2.png',
    'combat_r4_c1.png',
    'combat_r4_c0.png',
  ],
  // 13: faint (collapsing down -> knocked out lying flat on stomach with eyes closed)
  [
    'movement_r4_c0.png',
    'movement_r4_c1.png',
    'movement_r4_c2.png',
    'movement_r4_c3.png',
    'movement_r4_c4.png',
    'movement_r4_c5.png',
  ],
  // 14: victory (joyful victory bounce and cheering with both arms raised high!)
  [
    'combat_r4_c3.png',
    'combat_r4_c4.png',
    'combat_r4_c5.png',
    'combat_r4_c3.png',
    'combat_r4_c4.png',
    'combat_r4_c5.png',
  ],
];

const defaultScale = 0.74;
// walk_v4 frames have height ~242 vs idle height 151; scale factor preserves matching character size:
const walkScale = (151 * defaultScale) / 242;
const overlays = [];

for (let r = 0; r < rowFrames.length; r++) {
  for (let c = 0; c < 6; c++) {
    const file = rowFrames[r][c];
    const img = sharp(extracted + file);
    const meta = await img.metadata();

    const currentScale = r === 1 ? walkScale : defaultScale;
    const w = Math.round(meta.width * currentScale);
    const h = Math.round(meta.height * currentScale);

    // Dynamic vertical displacement for jumps, falls and celebration bounces
    let yOffset = 0;
    if (r === 2) {
      yOffset = [0, -8, -18, -26, -20, -12][c]; // jump trajectory
    } else if (r === 3) {
      yOffset = [-22, -18, -14, -10, -5, 0][c]; // fall descending
    } else if (r === 14) {
      yOffset = [0, -8, -12, -8, -12, -8][c]; // victory hopping
    }

    const resized = await img.resize(w, h).png().toBuffer();
    const left = c * 160 + Math.round((160 - w) / 2);
    // Baseline: y = 150 (leaves 10px floor margin, matching Pikachu, Lam Quy and Eevee)
    const top = Math.max(r * 160 + 2, r * 160 + 150 - h + yOffset);

    overlays.push({ input: resized, left, top });
  }
}

// Build 960 x 2400 sprite sheet
await blank(960, 2400)
  .composite(overlays)
  .png()
  .toFile(output + 'charmander-sheet.png');

// Build 160 x 160 portrait from in-game sprite (matching Pikachu, Lam Quy, Water Slime, and Eevee)
const portraitSprite = sharp(extracted + 'movement_r0_c0.png');
const pMeta = await portraitSprite.metadata();
const pW = Math.round(pMeta.width * defaultScale);
const pH = Math.round(pMeta.height * defaultScale);
const pResized = await portraitSprite.resize(pW, pH).png().toBuffer();

await blank(160, 160)
  .composite([
    {
      input: pResized,
      left: Math.round((160 - pW) / 2),
      top: 150 - pH,
    },
  ])
  .png()
  .toFile(output + 'charmander.png');

console.log('Packaged Charmander: 15 animation states × 6 frames and portrait.');
