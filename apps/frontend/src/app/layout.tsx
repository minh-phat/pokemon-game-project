import type { Metadata, Viewport } from 'next';
import './globals.css';
import './home.css';
import './world.css';
export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: '#0b1736',
};
export const metadata: Metadata = {
  title: 'Triệu Hồi Sư — Summoner Arena',
  description:
    'Bước vào thế giới triệu hồi, xây dựng đội hình và chiến đấu cùng bạn bè. Build your team and begin a magical adventure.',
  icons: { icon: '/assets/favicon.svg', apple: '/assets/icon-192.png' },
  appleWebApp: {
    capable: true,
    title: 'Triệu Hồi Sư',
    statusBarStyle: 'black-translucent',
  },
};
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="vi">
      <body>{children}</body>
    </html>
  );
}
