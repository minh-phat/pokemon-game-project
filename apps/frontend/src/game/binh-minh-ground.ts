import { CITY_BUILDINGS, CITY_RING_RADIUS, CITY_VERTICES } from './open-world-world';

export const CITY_GROUND = { width: 1536, height: 832, x: 768, y: 416 };
export const CITY_PLANTERS: { x: number; y: number; flowers: boolean }[] = [];
for (const sx of [-1, 1])
  for (const sy of [-1, 1]) {
    for (const [x, y] of [
      [5.2, 10],
      [10, 5.2],
      [29.1, 6],
      [29.1, 12],
      [6, 29.1],
      [12, 29.1],
    ])
      CITY_PLANTERS.push({ x: x * sx, y: y * sy, flowers: x === 10 || y === 12 });
  }

/** One cached city ground image: continuous geometry, no stair-stepped tile roads. */
export function createCityGround() {
  const image = document.createElement('canvas');
  image.width = CITY_GROUND.width;
  image.height = CITY_GROUND.height;
  const c = image.getContext('2d')!;
  c.setTransform(16, 8, -16, 8, CITY_GROUND.x, CITY_GROUND.y);
  const octagon = (radius: number) => {
    c.beginPath();
    CITY_VERTICES.forEach(([x, y], i) => {
      if (i === 0) c.moveTo((x * radius) / 32, (y * radius) / 32);
      else c.lineTo((x * radius) / 32, (y * radius) / 32);
    });
    c.closePath();
  };
  octagon(32.4);
  c.clip();
  c.fillStyle = '#d7d3bd';
  c.fillRect(-34, -34, 68, 68);
  // Deterministic limestone variation is baked once, never generated per frame.
  for (let y = -33; y < 33; y++)
    for (let x = -33; x < 33; x++) {
      const grain = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
      c.fillStyle = ['#dad5c0', '#d0cfbc', '#dcd6c1', '#d6d2be'][
        Math.floor((grain - Math.floor(grain)) * 4)
      ];
      c.fillRect(x + 0.025, y + 0.025, 0.95, 0.95);
    }
  // Stone paving replaces the formerly ambiguous green construction lots.
  c.strokeStyle = '#9faea51d';
  c.lineWidth = 0.025;
  for (let i = -33; i <= 33; i++) {
    c.beginPath();
    c.moveTo(i, -33);
    c.lineTo(i, 33);
    c.moveTo(-33, i);
    c.lineTo(33, i);
    c.stroke();
  }
  const streets = () => {
    octagon(CITY_RING_RADIUS);
    c.moveTo(-34, 0);
    c.lineTo(34, 0);
    c.moveTo(0, -34);
    c.lineTo(0, 34);
  };
  c.lineJoin = 'round';
  streets();
  // Continuous curb, light pedestrian paving, drainage edge and dark carriageway.
  for (const [width, color] of [
    [7.6, '#8eaaa7'],
    [7.3, '#e5e5d9'],
    [4.6, '#a9bab5'],
    [4.35, '#d5eee4'],
    [4.1, '#41585e'],
  ] as const) {
    c.lineWidth = width;
    c.strokeStyle = color;
    c.stroke();
  }
  // Subtle road grain is clipped to the carriageway by querying its analytic footprint.
  c.fillStyle = '#ffffff09';
  for (let y = -32; y < 32; y += 0.23)
    for (let x = -32; x < 32; x += 0.39) {
      const d = Math.max(Math.abs(x), Math.abs(y), ((Math.abs(x) + Math.abs(y)) * 32) / 45);
      if (Math.min(Math.abs(x), Math.abs(y)) < 1.9 || Math.abs(d - CITY_RING_RADIUS) < 1.25)
        c.fillRect(x + Math.sin(x * 97 + y * 43) * 0.1, y, 0.035, 0.035);
    }
  c.lineWidth = 0.045;
  c.strokeStyle = '#dce6cb';
  c.setLineDash([0.65, 0.65]);
  octagon(CITY_RING_RADIUS);
  c.stroke();
  c.setLineDash([]);
  // Markings follow the street axes, not the screen's horizontal direction.
  for (const rotate of [false, true]) {
    c.save();
    if (rotate) c.rotate(Math.PI / 2);
    for (const sign of [-1, 1]) {
      for (let d = 8.5; d < 31; d += 1.6) {
        if (d > 14.5 && d < 24.5) continue;
        c.fillStyle = '#cbd7bc';
        c.fillRect(d * sign, -0.035, 0.65 * sign, 0.07);
      }
      for (const d of [8, 15.5, 23.5, 30]) {
        c.fillStyle = '#e7ebdb';
        for (let stripe = -2; stripe <= 2; stripe++)
          c.fillRect(sign * d + stripe * 0.28, -1.7, 0.14, 3.4);
      }
    }
    c.restore();
  }
  // Central pedestrian plaza, separated from traffic by a broad stone curb.
  octagon(7);
  c.fillStyle = '#a8bcb0';
  c.fill();
  octagon(6.8);
  c.fillStyle = '#eee9d7';
  c.fill();
  c.save();
  octagon(6.8);
  c.clip();
  c.strokeStyle = '#c7cbb7';
  c.lineWidth = 0.04;
  for (let i = -8; i <= 8; i++) {
    c.beginPath();
    c.moveTo(i, -8);
    c.lineTo(i, 8);
    c.moveTo(-8, i);
    c.lineTo(8, i);
    c.stroke();
  }
  c.restore();
  for (const [r, color, width] of [
    [5.7, '#b9a371', 0.07],
    [4.7, '#72bcb5', 0.15],
    [3.6, '#b9a371', 0.04],
  ] as const) {
    c.beginPath();
    c.arc(0, 0, r, 0, Math.PI * 2);
    c.strokeStyle = color;
    c.lineWidth = width;
    c.stroke();
  }
  // Sunrise compass inlaid in stone: a city signature visible from every approach.
  for (let i = 0; i < 16; i++) {
    const a = (i * Math.PI) / 8;
    c.save();
    c.rotate(a);
    c.beginPath();
    c.moveTo(4.9, -0.1);
    c.lineTo(i % 4 === 0 ? 6.4 : 5.65, 0);
    c.lineTo(4.9, 0.1);
    c.closePath();
    c.fillStyle = i % 4 === 0 ? '#b6874d' : '#c7af75';
    c.fill();
    c.restore();
  }
  // Four mosaic thresholds signal a pedestrian sanctuary.
  for (let i = 0; i < 4; i++) {
    c.save();
    c.rotate((i * Math.PI) / 2);
    c.fillStyle = '#548c87';
    c.fillRect(6.2, -1.15, 0.25, 2.3);
    c.fillStyle = '#d8b976';
    for (let j = -2; j <= 2; j++) c.fillRect(6.55, j * 0.45 - 0.1, 0.15, 0.2);
    c.restore();
  }
  for (const b of CITY_BUILDINGS) {
    // A small forecourt and a connected approach make each building's plot explicit.
    const toX = Math.abs(b.x) === 25 ? Math.sign(b.x) * 22 : b.x;
    const toY =
      Math.abs(b.y) === 25 ? Math.sign(b.y) * 22 : Math.abs(b.x) === 25 ? b.y : Math.sign(b.y) * 3;
    c.beginPath();
    c.moveTo(b.x, b.y);
    c.lineTo(toX, toY);
    c.strokeStyle = '#9eafa7';
    c.lineWidth = 1.7;
    c.stroke();
    c.strokeStyle = '#ebe6d4';
    c.lineWidth = 1.5;
    c.stroke();
    c.fillStyle = '#94aba2';
    c.fillRect(b.x - 3.3, b.y - 3.3, 6.6, 6.6);
    c.fillStyle = b.sprite === 7 ? '#4d8460' : '#e3e1d0';
    c.fillRect(b.x - 3.15, b.y - 3.15, 6.3, 6.3);
    c.strokeStyle = '#c1c3ad';
    c.lineWidth = 0.025;
    for (let i = -3; i <= 3; i++) {
      c.beginPath();
      c.moveTo(b.x + i, b.y - 3.1);
      c.lineTo(b.x + i, b.y + 3.1);
      c.stroke();
    }
    // Thin foundation outline agrees with the collision footprint and sprite's diamond.
    c.strokeStyle = '#91a69a';
    c.lineWidth = 0.05;
    c.strokeRect(b.x - 2.8, b.y - 2.8, 5.6, 5.6);
  }
  for (const p of CITY_PLANTERS) {
    c.fillStyle = '#8ca398';
    c.fillRect(p.x - 0.9, p.y - 1.2, 1.8, 2.4);
    c.fillStyle = '#eff0dc';
    c.fillRect(p.x - 0.8, p.y - 1.1, 1.6, 2.2);
    c.fillStyle = '#43764e';
    c.fillRect(p.x - 0.65, p.y - 0.95, 1.3, 1.9);
    for (let i = 0; i < 30; i++) {
      c.fillStyle = i % 3 === 0 && p.flowers ? '#e9b8c3' : i % 2 ? '#70a263' : '#52894e';
      c.fillRect(p.x - 0.56 + ((i * 0.37) % 1.1), p.y - 0.8 + ((i * 0.61) % 1.6), 0.1, 0.1);
    }
  }
  // Low garden ribbons occupy the large empty corners, away from the streets.
  for (const sx of [-1, 1])
    for (const sy of [-1, 1]) {
      c.save();
      c.translate(sx * 22, sy * 18);
      c.fillStyle = '#f1e6ce';
      c.fillRect(-1.8, -1.8, 3.6, 3.6);
      c.fillStyle = '#69836a';
      c.fillRect(-1.65, -1.65, 3.3, 3.3);
      c.strokeStyle = '#c2c795';
      c.lineWidth = 0.12;
      c.strokeRect(-1.2, -1.2, 2.4, 2.4);
      for (let i = 0; i < 70; i++) {
        c.fillStyle = ['#eab6a0', '#f7d99f', '#b4be86', '#f2e4c3'][i % 4];
        c.beginPath();
        c.arc(-1.4 + ((i * 0.43) % 2.8), -1.4 + ((i * 0.71) % 2.8), 0.075, 0, Math.PI * 2);
        c.fill();
      }
      c.restore();
    }
  // Shared eastward cast shadows anchor all architecture to the same morning sun.
  for (const b of CITY_BUILDINGS) {
    if (b.sprite === 7) continue;
    c.save();
    const shadow = c.createLinearGradient(b.x, b.y, b.x + 5, b.y + 1);
    shadow.addColorStop(0, '#314a4945');
    shadow.addColorStop(1, '#314a4900');
    c.fillStyle = shadow;
    c.beginPath();
    c.moveTo(b.x - 2.5, b.y - 2.5);
    c.lineTo(b.x + 2.5, b.y - 2.5);
    c.lineTo(b.x + 6, b.y + 0.5);
    c.lineTo(b.x + 6, b.y + 5);
    c.lineTo(b.x - 2.5, b.y + 2.5);
    c.closePath();
    c.fill();
    c.restore();
  }
  // Perimeter service walk and turquoise field footing.
  octagon(31.3);
  c.strokeStyle = '#a7b8aa';
  c.lineWidth = 0.07;
  c.stroke();
  octagon(32);
  c.strokeStyle = '#64bac2';
  c.lineWidth = 0.22;
  c.stroke();
  return image;
}
