import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Triệu Hồi Sư',
    short_name: 'Triệu Hồi Sư',
    description: 'Build a Pokémon team and battle in the arena.',
    start_url: '/',
    scope: '/',
    display: 'fullscreen',
    orientation: 'landscape',
    background_color: '#0b1736',
    theme_color: '#0b1736',
    icons: [
      { src: '/assets/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/assets/icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
  };
}
