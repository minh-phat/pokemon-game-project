export const ASSETS = {
  favicon: '/assets/favicon.svg',
  previews: ['forest', 'volcano', 'lake'].map((id) => `/assets/${id}.svg`),
  portraits: {
    'water-slime': '/assets/water-slime.png',
    pikachu: '/assets/pikachu.svg',
    charmander: '/assets/charmander.svg',
    squirtle: '/assets/lam-quy.png',
    bulbasaur: '/assets/bulbasaur.svg',
    eevee: '/assets/eevee.png',
    runedrake: '/assets/runedrake.png',
  },
  sprites: {
    'water-slime': '/assets/water-slime-sheet.png',
    pikachu: '/assets/pikachu-sheet.svg',
    charmander: '/assets/charmander-sheet.svg',
    squirtle: '/assets/lam-quy-sheet.png',
    bulbasaur: '/assets/bulbasaur-sheet.svg',
    eevee: '/assets/eevee-sheet.png',
    runedrake: '/assets/runedrake-sheet.png',
  },
  frame: { width: 160, height: 160, columns: 6, rows: 15 },
  arenas: ['forest', 'volcano', 'lake'].flatMap((id) =>
    ['sky', 'far', 'near', 'ground'].map((layer) => `/assets/${id}-${layer}.svg`),
  ),
  audio: ['normal', 'electric', 'fire', 'water', 'grass', 'forest', 'volcano', 'lake'].map(
    (id) => `/assets/${id}.wav`,
  ),
};
