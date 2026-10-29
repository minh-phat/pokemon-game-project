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
  'pikachu.png',
  'pikachu-sheet.png',
  'charmander.png',
  'charmander-sheet.png',
  'bulbasaur.png',
  'bulbasaur-sheet.png',
  'water-slime.png',
  'water-slime-sheet.png',
  'water-slime-wrap.png',
  'lam-quy.png',
  'lam-quy-sheet.png',
  'eevee.png',
  'eevee-sheet.png',
  'runedrake.png',
  'runedrake-sheet.png',
  'runedrake-ember-glyph.png',
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
if (runedrakeSheet.width !== 1920 || runedrakeSheet.height !== 2400 || !runedrakeSheet.hasAlpha)
  throw new Error('Invalid Runedrake sprite sheet');
const emberGlyph = await sharp(
  resolve('apps/frontend/public/assets/runedrake-ember-glyph.png'),
).metadata();
if (emberGlyph.width !== 256 || emberGlyph.height !== 128 || !emberGlyph.hasAlpha)
  throw new Error('Invalid Ember Glyph sprite');
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
  `Verified ${expected.length} assets, four legacy vector sprite sheets, and Eevee, Runedrake, Water Slime, Lam Quy and Pikachu raster sprite sheets.`,
);

const slime = await sharp(resolve('apps/frontend/public/assets/water-slime-sheet.png')).metadata();
if (slime.width !== 960 || slime.height !== 2400 || !slime.hasAlpha)
  throw new Error('Invalid Water Slime sprite sheet');

const lamQuy = await sharp(resolve('apps/frontend/public/assets/lam-quy-sheet.png')).metadata();
if (lamQuy.width !== 960 || lamQuy.height !== 2400 || !lamQuy.hasAlpha)
  throw new Error('Invalid Lam Quy sprite sheet');

const pikachu = await sharp(resolve('apps/frontend/public/assets/pikachu-sheet.png')).metadata();
if (pikachu.width !== 960 || pikachu.height !== 2400 || !pikachu.hasAlpha)
  throw new Error('Invalid Pikachu sprite sheet');

const charmander = await sharp(
  resolve('apps/frontend/public/assets/charmander-sheet.png'),
).metadata();
if (charmander.width !== 960 || charmander.height !== 2400 || !charmander.hasAlpha)
  throw new Error('Invalid Charmander sprite sheet');

const bulbasaur = await sharp(
  resolve('apps/frontend/public/assets/bulbasaur-sheet.png'),
).metadata();
if (bulbasaur.width !== 960 || bulbasaur.height !== 2400 || !bulbasaur.hasAlpha)
  throw new Error('Invalid Bulbasaur sprite sheet');
