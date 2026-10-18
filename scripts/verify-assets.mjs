import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
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
];
const missing = expected.filter(
  (file) => !existsSync(resolve('apps/frontend/public/assets', file)),
);
if (missing.length) throw new Error(`Missing assets: ${missing.join(', ')}`);
for (const id of ids) {
  const content = readFileSync(resolve('apps/frontend/public/assets', `${id}-sheet.svg`), 'utf8');
  if (!content.includes('width="960" height="2400"')) throw new Error(`Invalid sheet ${id}`);
}
console.log(`Verified ${expected.length} assets and all four 90-frame sprite sheets.`);
