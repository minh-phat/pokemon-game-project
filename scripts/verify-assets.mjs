import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import sharp from 'sharp';
const ids = ['pikachu', 'charmander', 'squirtle', 'bulbasaur'];
const expected = [
  ...ids.flatMap((id) => [`${id}.svg`, `${id}-sheet.svg`]),
  ...['forest', 'volcano', 'lake'].flatMap((id) => [
    `${id}.svg`,
    `${id}.wav`,
    ...['sky', 'far', 'near', 'ground'].map((layer) => `${id}-${layer}.svg`),
  ]),
  ...['normal', 'electric', 'fire', 'water', 'grass'].map((id) => `${id}.wav`),
  'favicon.svg',
  'eevee.png',
  'eevee-sheet.png',
  'runedrake.png',
  'runedrake-sheet.png',
  ...[
    'eevee-strike',
    'swift',
    'shadow-step',
    'counter-pounce',
    'starfall-rush',
    'starfall-impact',
    'eevee-guard',
    'eevee-adaptive',
  ].map((id) => `eevee-vfx-${id}.png`),
];
const missing = expected.filter(
  (file) => !existsSync(resolve('apps/frontend/public/assets', file)),
);
if (missing.length) throw new Error(`Missing assets: ${missing.join(', ')}`);
for (const id of ids) {
  const content = readFileSync(resolve('apps/frontend/public/assets', `${id}-sheet.svg`), 'utf8');
  if (!content.includes('width="960" height="2400"')) throw new Error(`Invalid sheet ${id}`);
}
const eeveeSheet = await sharp(resolve('apps/frontend/public/assets/eevee-sheet.png')).metadata();
if (eeveeSheet.width !== 960 || eeveeSheet.height !== 2400 || !eeveeSheet.hasAlpha)
  throw new Error('Invalid Eevee sprite sheet');
const runedrakeSheet = await sharp(
  resolve('apps/frontend/public/assets/runedrake-sheet.png'),
).metadata();
if (runedrakeSheet.width !== 960 || runedrakeSheet.height !== 2400 || !runedrakeSheet.hasAlpha)
  throw new Error('Invalid Runedrake sprite sheet');
for (const id of [
  'eevee-strike',
  'swift',
  'shadow-step',
  'counter-pounce',
  'starfall-rush',
  'starfall-impact',
  'eevee-guard',
  'eevee-adaptive',
]) {
  const sheet = await sharp(
    resolve('apps/frontend/public/assets', `eevee-vfx-${id}.png`),
  ).metadata();
  if (sheet.width !== 1536 || sheet.height !== 128 || !sheet.hasAlpha)
    throw new Error(`Invalid Eevee VFX sheet ${id}`);
}
console.log(
  `Verified ${expected.length} assets, four vector sprite sheets, and Eevee and Runedrake raster sprite sheets.`,
);
