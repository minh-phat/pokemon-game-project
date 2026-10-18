import type { Metadata } from 'next';
import './globals.css';
export const metadata: Metadata = {
  title: 'Pokémon Arena — A little team. A legendary battle.',
  description:
    'Build your team and watch an animated Pokémon auto-battle unfold. Play against AI or invite a friend.',
  icons: { icon: '/assets/favicon.svg' },
};
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
