import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Pokémon Arena',
    short_name: 'Pokémon Arena',
    description: 'Build a Pokémon team and battle in the arena.',
    start_url: '/',
    scope: '/',
    display: 'fullscreen',
    background_color: '#14251f',
    theme_color: '#14251f',
    icons: [
      { src: '/assets/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/assets/icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
  };
}
