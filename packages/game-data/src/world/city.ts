/** Bình Minh uses the world's x/east and y/south axes. Distances are in tiles. */
export const CITY_RADIUS = 32;
export const CITY_GATE_HALF_WIDTH = 3;
const CITY_BUILDINGS_V1 = [
  { name: 'Bệnh viện Bình Minh', en: 'Dawn Hospital', x: -11, y: -11, sprite: 0 },
  { name: 'Học viện triệu hồi', en: 'Summoning Academy', x: 11, y: -11, sprite: 1 },
  { name: 'Bệnh viện thú triệu hồi', en: 'Creature Hospital', x: -11, y: 11, sprite: 2 },
  { name: 'Đấu trường thú', en: 'Creature Arena', x: 11, y: 11, sprite: 3 },
  { name: 'Phố thương mại', en: 'Market Hall', x: -23, y: 9, sprite: 4 },
  { name: 'Bảo tàng khế ước', en: 'Covenant Museum', x: 9, y: 23, sprite: 5 },
  { name: 'Tháp Bình Minh', en: 'Dawn Towers', x: -23, y: -9, sprite: 6 },
  { name: 'Khu vườn ánh sáng', en: 'Garden of Light', x: -9, y: -23, sprite: 7 },
  { name: 'Tháp Chân Trời', en: 'Horizon Towers', x: 9, y: -23, sprite: 6 },
  { name: 'Công viên Bình Minh', en: 'Dawn Park', x: 23, y: -9, sprite: 7 },
  { name: 'Khu dân cư', en: 'Residences', x: 23, y: 9, sprite: 6 },
  { name: 'Vườn triệu hồi', en: 'Summoners’ Garden', x: -9, y: 23, sprite: 7 },
] as const;
export const CITY_RING_RADIUS = 19.5;
export const CITY_BUILDING_HALF_SIZE = 2.8;
export const CITY_SPRITE = { cell: 256, anchorX: 128, anchorY: 196, scale: 0.896 };
// Leave a full sidewalk between each foundation and the ring carriageway.
export const CITY_BUILDINGS = CITY_BUILDINGS_V1.map((b, i) => ({
  ...b,
  x: i < 4 ? Math.sign(b.x) * 9 : Math.sign(b.x) * (Math.abs(b.x) === 23 ? 25 : 8),
  y: i < 4 ? Math.sign(b.y) * 9 : Math.sign(b.y) * (Math.abs(b.y) === 23 ? 25 : 8),
}));
export const CITY_GATES = [
  { name: 'Cổng Bắc', en: 'North Gate', x: 0, y: -CITY_RADIUS },
  { name: 'Cổng Đông', en: 'East Gate', x: CITY_RADIUS, y: 0 },
  { name: 'Cổng Nam', en: 'South Gate', x: 0, y: CITY_RADIUS },
  { name: 'Cổng Tây', en: 'West Gate', x: -CITY_RADIUS, y: 0 },
] as const;
export const CITY_VERTICES = [
  [-13, -32],
  [13, -32],
  [32, -13],
  [32, 13],
  [13, 32],
  [-13, 32],
  [-32, 13],
  [-32, -13],
] as const;
export function cityDistance(x: number, y: number) {
  return Math.max(Math.abs(x), Math.abs(y), ((Math.abs(x) + Math.abs(y)) * 32) / 45);
}
export function insideCity(x: number, y: number) {
  return cityDistance(x, y) <= CITY_RADIUS;
}
export function cityWall(x: number, y: number) {
  return (
    Math.abs(cityDistance(x, y) - CITY_RADIUS) < 0.8 &&
    Math.min(Math.abs(x), Math.abs(y)) > CITY_GATE_HALF_WIDTH
  );
}
export function cityBuildingAt(x: number, y: number, version = 2) {
  return (version === 1 ? CITY_BUILDINGS_V1 : CITY_BUILDINGS).find(
    (b) =>
      b.sprite !== 7 &&
      Math.abs(x - b.x) < CITY_BUILDING_HALF_SIZE &&
      Math.abs(y - b.y) < CITY_BUILDING_HALF_SIZE,
  );
}
export type CitySurface = 'plaza' | 'road' | 'garden' | 'pavement';
export function citySurface(x: number, y: number, version = 2): CitySurface {
  const d = cityDistance(x, y);
  if (Math.hypot(x, y) < 7) return 'plaza';
  if (version === 2) {
    if (Math.min(Math.abs(x), Math.abs(y)) <= 2 || Math.abs(d - CITY_RING_RADIUS) < 1.7)
      return 'road';
    if (
      CITY_BUILDINGS.some(
        (b) => b.sprite === 7 && Math.abs(x - b.x) < 3.2 && Math.abs(y - b.y) < 3.2,
      )
    )
      return 'garden';
    return 'pavement';
  }
  if (Math.min(Math.abs(x), Math.abs(y)) <= 2 || Math.abs(d - 19) < 1.7) return 'road';
  if (Math.min(Math.abs(x), Math.abs(y)) < 4 || Math.abs(d - 19) < 3 || d > 29) return 'pavement';
  return 'garden';
}
