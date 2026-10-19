import type { Metadata } from 'next';
import './globals.css';
export const metadata: Metadata = {
  title: 'Pokémon Arena — A little team. A legendary battle.',
  description:
    'Build your team and watch or control an animated Pokémon battle. Play against AI or invite a friend.',
  icons: { icon: '/assets/favicon.svg', apple: '/assets/icon-192.png' },
  appleWebApp: {
    capable: true,
    title: 'Pokémon Arena',
    statusBarStyle: 'black-translucent',
  },
};
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
