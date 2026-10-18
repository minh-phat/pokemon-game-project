export const ASSETS = {
  favicon: '/assets/favicon.svg',
  previews: ['forest', 'volcano', 'lake'].map((id) => `/assets/${id}.svg`),
  portraits: {
    pikachu: '/assets/pikachu.svg',
    charmander: '/assets/charmander.svg',
    squirtle: '/assets/squirtle.svg',
    bulbasaur: '/assets/bulbasaur.svg',
  },
  sprites: {
    pikachu: '/assets/pikachu-sheet.svg',
    charmander: '/assets/charmander-sheet.svg',
    squirtle: '/assets/squirtle-sheet.svg',
    bulbasaur: '/assets/bulbasaur-sheet.svg',
  },
  frame: { width: 160, height: 160, columns: 6, rows: 15 },
  arenas: ['forest', 'volcano', 'lake'].flatMap((id) =>
    ['sky', 'far', 'near', 'ground'].map((layer) => `/assets/${id}-${layer}.svg`),
  ),
  audio: ['normal', 'electric', 'fire', 'water', 'grass', 'forest', 'volcano', 'lake'].map(
    (id) => `/assets/${id}.wav`,
  ),
};
