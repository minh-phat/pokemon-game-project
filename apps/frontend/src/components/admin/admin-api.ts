import type { AnimationName, Element, SpeciesId } from '@arena/shared-types';

export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

export type AdminUser = { id: string; email: string; name: string; role?: 'admin' | 'player' };
export type AnimationSpec = { start: number; end: number; frameRate: number; repeat: number };
export type SheetInfo = {
  url: string;
  version: number;
  width: number;
  height: number;
  frameWidth: number;
  frameHeight: number;
  columns: number;
  rows: number;
  frames: number;
};
export type AdminSkill = {
  id: string;
  name: string;
  element: Element;
  behavior: string;
  animation: AnimationName;
  description: string;
};
export type AdminSpecies = {
  id: SpeciesId;
  name: string;
  number: string;
  element: Element;
  color: string;
  portrait: string;
  sheets: { battle: SheetInfo; directions: SheetInfo | null };
  animations: Record<
    AnimationName,
    { base: AnimationSpec; current: AnimationSpec; overridden: boolean }
  >;
  skills: AdminSkill[];
};
export type SpriteCatalog = { writable: boolean; species: AdminSpecies[] };

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

async function request<T>(path: string, method = 'GET', body?: unknown): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${API_URL}${path}`, {
      method,
      credentials: 'include',
      cache: 'no-store',
      headers: { 'Content-Type': 'application/json', 'X-Arena-Request': '1' },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
  } catch {
    throw new ApiError(0, 'Không thể kết nối máy chủ API. Hãy chắc chắn backend đang chạy.');
  }
  const data = (await response.json().catch(() => ({}))) as { message?: unknown };
  if (!response.ok) {
    const message = Array.isArray(data.message) ? data.message.join(', ') : data.message;
    throw new ApiError(
      response.status,
      typeof message === 'string' && message ? message : `Lỗi máy chủ (${response.status}).`,
    );
  }
  return data as T;
}

export const adminApi = {
  me: () => request<{ user: AdminUser | null }>('/auth/me'),
  login: (email: string, password: string) =>
    request<{ user: AdminUser | null }>('/auth/login', 'POST', { email, password }),
  logout: () => request<{ user: null }>('/auth/logout', 'POST', {}),
  sprites: () => request<SpriteCatalog>('/auth/admin/sprites'),
  saveAnimation: (species: SpeciesId, name: AnimationName, spec: AnimationSpec) =>
    request<AdminSpecies>(`/auth/admin/sprites/${species}/animations/${name}`, 'PUT', spec),
  resetAnimation: (species: SpeciesId, name: AnimationName) =>
    request<AdminSpecies>(`/auth/admin/sprites/${species}/animations/${name}`, 'DELETE'),
  uploadFrames: (
    species: SpeciesId,
    body: {
      sheet: 'battle' | 'directions';
      mode: 'replace' | 'append';
      image: string;
      startFrame?: number;
      assignTo?: AnimationName;
    },
  ) => request<AdminSpecies>(`/auth/admin/sprites/${species}/frames`, 'POST', body),
};

export const ANIMATION_LABELS: Record<AnimationName, { vi: string; hint: string }> = {
  idle: { vi: 'Đứng yên', hint: 'Thở nhẹ khi chờ' },
  run: { vi: 'Chạy', hint: 'Di chuyển ngang' },
  jump: { vi: 'Nhảy', hint: 'Bật lên khỏi mặt đất' },
  fall: { vi: 'Rơi', hint: 'Đang rơi xuống' },
  land: { vi: 'Tiếp đất', hint: 'Chạm đất sau khi nhảy' },
  attack: { vi: 'Đánh thường', hint: 'Đòn cận chiến' },
  cast: { vi: 'Tung chiêu', hint: 'Thi triển kỹ năng' },
  dash: { vi: 'Lướt', hint: 'Lướt nhanh / né' },
  backstep: { vi: 'Lùi né', hint: 'Bật lùi về sau' },
  crouch: { vi: 'Cúi / trườn', hint: 'Hạ thấp người' },
  guard: { vi: 'Đỡ đòn', hint: 'Giữ khiên phòng thủ' },
  hit: { vi: 'Trúng đòn', hint: 'Khựng lại khi bị đánh' },
  knockback: { vi: 'Bị hất văng', hint: 'Bị đẩy lùi mạnh' },
  faint: { vi: 'Gục ngã', hint: 'Hết máu' },
  victory: { vi: 'Chiến thắng', hint: 'Ăn mừng' },
};

/** Directional atlas rows, matching `directionRow` in game-data. */
export const DIRECTION_ROWS = [
  { row: 0, vi: 'Đứng yên (ngang)', hint: 'Hướng Đông / Tây' },
  { row: 1, vi: 'Chạy ngang', hint: 'Đông / Tây (lật ảnh)' },
  { row: 2, vi: 'Chạy lên', hint: 'Hướng Bắc' },
  { row: 3, vi: 'Chạy chéo lên', hint: 'Đông Bắc / Tây Bắc' },
  { row: 4, vi: 'Chạy chéo xuống', hint: 'Đông Nam / Tây Nam' },
  { row: 5, vi: 'Chạy xuống', hint: 'Hướng Nam' },
];

export const sheetUrl = (sheet: SheetInfo) => `${sheet.url}?v=${sheet.version}`;
