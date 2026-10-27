import { CITY_PLANTERS } from './binh-minh-ground';
import { addCityLife } from './binh-minh-life';
import {
  CITY_BUILDINGS,
  CITY_SPRITE,
  CITY_BUILDING_HALF_SIZE,
  CITY_GATES,
  CITY_VERTICES,
  cityWall,
  type World,
  type Point,
  type Tile,
} from './open-world-world';

type DrawObject = { depth: number; draw: () => void };
const alphaMasks = new WeakMap<HTMLImageElement, ImageData>();
function spriteCovers(
  atlas: HTMLImageElement,
  index: number,
  p: Point,
  actor: Point,
  scale: number,
) {
  let mask = alphaMasks.get(atlas);
  if (!mask) {
    const buffer = document.createElement('canvas');
    buffer.width = atlas.naturalWidth;
    buffer.height = atlas.naturalHeight;
    const ctx = buffer.getContext('2d', { willReadFrequently: true })!;
    ctx.drawImage(atlas, 0, 0);
    mask = ctx.getImageData(0, 0, buffer.width, buffer.height);
    alphaMasks.set(atlas, mask);
  }
  // Test the trainer's head and torso against opaque artwork, not an oversized rectangle.
  for (const rise of [8, 20]) {
    const x = Math.floor((actor.x - p.x) / scale + CITY_SPRITE.anchorX);
    const y = Math.floor((actor.y - rise - p.y) / scale + CITY_SPRITE.anchorY);
    if (x < 0 || y < 0 || x >= 256 || y >= 256) continue;
    const pixel = ((Math.floor(index / 3) * 256 + y) * mask.width + (index % 3) * 256 + x) * 4;
    if (mask.data[pixel + 3] > 180) return true;
  }
  return false;
}
export const cityColors = {
  plaza: '#eee9d7',
  road: '#41585e',
  pavement: '#d7d3bd',
  garden: '#4d8460',
};
const project = (x: number, y: number, level: number) => ({
  x: (x - y) * 16,
  y: (x + y) * 8 - level * 8,
});

export function paintCityTile(c: CanvasRenderingContext2D, t: Tile, x: number, y: number) {
  if (!t.citySurface) return;
  c.fillStyle = cityColors[t.citySurface];
  c.beginPath();
  c.moveTo(x, y);
  c.lineTo(x + 16, y + 8);
  c.lineTo(x, y + 16);
  c.lineTo(x - 16, y + 8);
  c.closePath();
  c.fill();
  c.strokeStyle = t.citySurface === 'garden' ? '#90c3a3' : '#ffffff18';
  c.lineWidth = 0.6;
  c.stroke();
  if (t.citySurface === 'road' && (t.x + t.y) % 3 === 0) {
    c.fillStyle = '#9ad9de';
    c.fillRect(x - 2, y + 7, 4, 1);
  }
}

/** Only nearby objects enter the existing depth-sorted render queue. */
export function addCityObjects(
  c: CanvasRenderingContext2D,
  world: World,
  atlas: HTMLImageElement | null,
  props: HTMLImageElement | null,
  player: Point,
  left: number,
  top: number,
  width: number,
  height: number,
  time: number,
  objects: DrawObject[],
) {
  if (!world.cityVersion || Math.hypot(player.x - world.spawn.x, player.y - world.spawn.y) > 100)
    return;
  const center = world.spawn;
  const point = (x: number, y: number, rise = 0) => {
    const p = project(center.x + x, center.y + y, world.campLevel);
    return { x: p.x - left, y: p.y - top - rise };
  };
  const visible = (p: Point, margin = 200) =>
    p.x > -margin && p.x < width + margin && p.y > -60 && p.y < height + margin;
  if (world.cityVersion === 2)
    addCityLife(
      c,
      point,
      visible,
      center.x + center.y,
      time,
      objects,
      point(player.x - center.x, player.y - center.y),
    );
  const label = (text: string, p: Point) => {
    c.font = '500 10px system-ui';
    c.textAlign = 'center';
    const w = c.measureText(text).width + 16;
    c.fillStyle = '#112f42df';
    c.beginPath();
    c.roundRect(p.x - w / 2, p.y + 6, w, 20, 6);
    c.fill();
    c.fillStyle = '#e0fcf5';
    c.fillText(text, p.x, p.y + 20);
    c.textAlign = 'start';
  };
  const sprite = (index: number, p: Point, scale = CITY_SPRITE.scale) => {
    if (!atlas) return;
    c.imageSmoothingEnabled = true;
    c.drawImage(
      atlas,
      (index % 3) * 256,
      Math.floor(index / 3) * 256,
      256,
      256,
      p.x - CITY_SPRITE.anchorX * scale,
      p.y - CITY_SPRITE.anchorY * scale,
      256 * scale,
      256 * scale,
    );
    c.imageSmoothingEnabled = false;
  };
  // Portal ground rings are below the trainer; the gate itself stands behind the arrival point.
  const origin = point(0, 0);
  if (visible(origin)) {
    objects.push({
      depth: center.x + center.y - 1,
      draw: () => {
        sprite(8, point(-1.5, -1.5), 0.58);
        c.save();
        c.globalAlpha = 0.2 + Math.sin(time * 2) * 0.08;
        c.fillStyle = '#8bf9ff';
        c.beginPath();
        c.ellipse(origin.x, origin.y - 68, 11, 22, 0, 0, Math.PI * 2);
        c.fill();
        c.restore();
      },
    });
  }
  for (const b of CITY_BUILDINGS) {
    const p = point(b.x, b.y);
    if (!visible(p)) continue;
    objects.push({
      depth: center.x + center.y + b.x + b.y + CITY_BUILDING_HALF_SIZE * 2,
      draw: () => {
        const playerScreen = point(player.x - center.x, player.y - center.y);
        const covers =
          player.x + player.y < center.x + center.y + b.x + b.y + CITY_BUILDING_HALF_SIZE * 2 &&
          Boolean(atlas && spriteCovers(atlas, b.sprite, p, playerScreen, CITY_SPRITE.scale));
        c.save();
        c.globalAlpha = covers ? 0.38 : 1;
        sprite(b.sprite, p);
        c.restore();
        if (Math.hypot(player.x - center.x - b.x, player.y - center.y - b.y) < 12)
          label(b.name, { x: p.x, y: p.y + 46 });
      },
    });
  }
  // Ornament trees and benches make the bounded green beds readable as gardens.
  for (const bed of CITY_PLANTERS) {
    const p = point(bed.x, bed.y);
    if (!visible(p, 80)) continue;
    objects.push({
      depth: center.x + center.y + bed.x + bed.y + 0.6,
      draw: () => {
        if (props && !bed.flowers) {
          c.save();
          c.imageSmoothingEnabled = true;
          c.drawImage(props, 0, 0, 96, 112, p.x - 20, p.y - 43, 40, 47);
          c.restore();
        }
        const a = point(bed.x + 1.1, bed.y - 0.7, 5),
          b = point(bed.x + 1.1, bed.y + 0.7, 5);
        c.strokeStyle = '#97734e';
        c.lineWidth = 4;
        c.beginPath();
        c.moveTo(a.x, a.y);
        c.lineTo(b.x, b.y);
        c.stroke();
        c.strokeStyle = '#45645f';
        c.lineWidth = 1.5;
        for (const q of [a, b]) {
          c.beginPath();
          c.moveTo(q.x, q.y);
          c.lineTo(q.x, q.y + 5);
          c.stroke();
        }
      },
    });
  }
  // Lamps and planters mark the four pedestrian avenues without blocking them.
  for (const axis of [0, 1])
    for (const sign of [-1, 1])
      for (const d of [8, 16, 25])
        for (const side of [-1, 1]) {
          const x = axis === 0 ? d * sign : side * 3.5,
            y = axis === 1 ? d * sign : side * 3.5;
          const p = point(x, y);
          if (!visible(p, 40)) continue;
          objects.push({
            depth: center.x + center.y + x + y,
            draw: () => {
              c.fillStyle = '#6a8b96';
              c.fillRect(p.x - 1, p.y - 22, 2, 22);
              c.fillStyle = '#d9ffff';
              c.fillRect(p.x - 4, p.y - 24, 8, 3);
              c.fillStyle = '#c7ffff22';
              c.beginPath();
              c.ellipse(p.x, p.y - 23, 9, 4, 0, 0, Math.PI * 2);
              c.fill();
            },
          });
        }
  for (let i = 0; i < CITY_VERTICES.length; i++) {
    const a = CITY_VERTICES[i],
      b = CITY_VERTICES[(i + 1) % CITY_VERTICES.length];
    const steps = Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]));
    for (let j = 0; j < steps; j++) {
      const ax = a[0] + ((b[0] - a[0]) * j) / steps,
        ay = a[1] + ((b[1] - a[1]) * j) / steps;
      const bx = a[0] + ((b[0] - a[0]) * (j + 1)) / steps,
        by = a[1] + ((b[1] - a[1]) * (j + 1)) / steps;
      if (!cityWall((ax + bx) / 2, (ay + by) / 2)) continue;
      const p = point(ax, ay),
        q = point(bx, by);
      if (!visible(p, 120)) continue;
      objects.push({
        depth: center.x + center.y + (ax + ay + bx + by) / 2,
        draw: () => {
          c.save();
          const gradient = c.createLinearGradient(p.x, p.y - 75, p.x, p.y);
          gradient.addColorStop(0, '#7df5ff88');
          gradient.addColorStop(0.5, '#45cee330');
          gradient.addColorStop(1, '#32bfd77a');
          c.fillStyle = gradient;
          c.beginPath();
          c.moveTo(p.x, p.y);
          c.lineTo(q.x, q.y);
          c.lineTo(q.x, q.y - 75);
          c.lineTo(p.x, p.y - 75);
          c.closePath();
          c.fill();
          c.strokeStyle = '#a1fbff';
          c.lineWidth = 1.5;
          c.beginPath();
          c.moveTo(p.x, p.y - 75);
          c.lineTo(q.x, q.y - 75);
          c.stroke();
          c.strokeStyle = '#a1fbff38';
          c.lineWidth = 0.7;
          for (let rise = 12; rise < 75; rise += 16) {
            c.beginPath();
            c.moveTo(p.x, p.y - rise);
            c.lineTo((p.x + q.x) / 2, (p.y + q.y) / 2 - rise - 5);
            c.lineTo(q.x, q.y - rise);
            c.stroke();
          }
          if (j % 7 === 0) {
            c.fillStyle = '#bfd9df';
            c.fillRect(p.x - 3, p.y - 83, 6, 85);
            c.fillStyle = '#72efff';
            c.fillRect(p.x - 1, p.y - 80, 2, 74);
          }
          c.restore();
        },
      });
    }
  }
  for (const gate of CITY_GATES) {
    const p = point(gate.x, gate.y);
    if (!visible(p)) continue;
    objects.push({
      depth: center.x + center.y + gate.x + gate.y,
      draw: () => {
        const alongX = gate.y !== 0;
        const a = point(gate.x - (alongX ? 3 : 0), gate.y - (alongX ? 0 : 3));
        const b = point(gate.x + (alongX ? 3 : 0), gate.y + (alongX ? 0 : 3));
        c.lineWidth = 8;
        c.strokeStyle = '#e0efef';
        c.beginPath();
        c.moveTo(a.x, a.y);
        c.lineTo(a.x, a.y - 94);
        c.lineTo(b.x, b.y - 94);
        c.lineTo(b.x, b.y);
        c.stroke();
        c.lineWidth = 2;
        c.strokeStyle = '#5cdef2';
        c.stroke();
        label(gate.name, p);
      },
    });
  }
}
