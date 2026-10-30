import type { SpeciesId } from '@arena/shared-types';

export const LOCOMOTION_SPRITES: Partial<Record<SpeciesId, string>> = {
  'water-slime': '/assets/water-slime-directions.png',
  charmander: '/assets/charmander-directions.png',
  squirtle: '/assets/lam-quy-directions.png',
  eevee: '/assets/eevee-directions.png',
  runedrake: '/assets/runedrake-directions.png',
};

export const ASSETS = {
  favicon: '/assets/favicon.svg',
  previews: ['forest', 'volcano', 'lake'].map((id) => `/assets/${id}.svg`),
  portraits: {
    'water-slime': '/assets/water-slime.png',
    pikachu: '/assets/pikachu.png',
    charmander: '/assets/charmander.png',
    squirtle: '/assets/lam-quy.png',
    bulbasaur: '/assets/bulbasaur.png',
    eevee: '/assets/eevee.png',
    runedrake: '/assets/runedrake.png',
  },
  sprites: {
    'water-slime': '/assets/water-slime-sheet.png',
    pikachu: '/assets/pikachu-sheet.png',
    charmander: '/assets/charmander-sheet.png',
    squirtle: '/assets/lam-quy-sheet.png',
    bulbasaur: '/assets/bulbasaur-sheet.png',
    eevee: '/assets/eevee-sheet.png',
    runedrake: '/assets/runedrake-sheet.png',
  },
  frame: { width: 160, height: 160, columns: 6, rows: 15 },
  locomotion: LOCOMOTION_SPRITES,
  arenas: ['forest', 'volcano', 'lake'].flatMap((id) =>
    ['sky', 'far', 'near', 'ground'].map((layer) => `/assets/${id}-${layer}.svg`),
  ),
  audio: ['normal', 'electric', 'fire', 'water', 'grass', 'forest', 'volcano', 'lake'].map(
    (id) => `/assets/${id}.wav`,
  ),
};
