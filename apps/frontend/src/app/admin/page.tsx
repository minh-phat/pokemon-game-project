import type { Metadata } from 'next';
import { SpriteStudio } from '@/components/admin/sprite-studio';
import './admin.css';

export const metadata: Metadata = {
  title: 'Quản Trị Sprite & Animation — Triệu Hồi Sư',
  description: 'Bảng điều khiển quản trị xem và tinh chỉnh animation sprite của các thú triệu hồi.',
};

export default function AdminPage() {
  return <SpriteStudio />;
}
