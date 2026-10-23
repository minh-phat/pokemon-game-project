import * as Phaser from 'phaser';
import { ELEMENTS, SKILL_BY_ID } from '@arena/game-data';
import type { Element } from '@arena/shared-types';

const SIZE = 128;
const FRAMES = 12;
const TAU = Math.PI * 2;
type Context = CanvasRenderingContext2D;

function stroke(c: Context, points: number[][], color: string, width = 2) {
  c.strokeStyle = color;
  c.lineWidth = width;
  c.beginPath();
  points.forEach(([x, y], i) => (i ? c.lineTo(x!, y!) : c.moveTo(x!, y!)));
  c.stroke();
}
function ring(c: Context, x: number, y: number, r: number, color: string, width = 2) {
  c.strokeStyle = color;
  c.lineWidth = width;
  c.beginPath();
  c.arc(x, y, r, 0, TAU);
  c.stroke();
}
function glow(c: Context, x: number, y: number, r: number, color: string) {
  const gradient = c.createRadialGradient(x, y, 0, x, y, r);
  gradient.addColorStop(0, color);
  gradient.addColorStop(1, `${color.slice(0, 7)}00`);
  c.fillStyle = gradient;
  c.fillRect(x - r, y - r, r * 2, r * 2);
}
function leaf(c: Context, x: number, y: number, angle: number, size: number) {
  c.save();
  c.translate(x, y);
  c.rotate(angle);
  c.fillStyle = '#84e695';
  c.beginPath();
  c.moveTo(-size, 0);
  c.quadraticCurveTo(0, -size, size, 0);
  c.quadraticCurveTo(0, size, -size, 0);
  c.fill();
  stroke(
    c,
    [
      [-size, 0],
      [size * 0.8, 0],
    ],
    '#e7ffba',
    1.3,
  );
  c.restore();
}

function electricBolt(c: Context, points: number[][], width: number, alpha = 1) {
  c.save();
  c.globalAlpha *= alpha;
  c.shadowColor = '#ffe34d';
  c.shadowBlur = 12;
  stroke(c, points, '#e88b17', width + 5);
  stroke(c, points, '#ffe14a', width + 2);
  c.shadowBlur = 5;
  stroke(c, points, '#fffef0', width);
  c.restore();
}

function electricArt(c: Context, id: string, frame: number) {
  const phase = (frame / FRAMES) * TAU;
  const pulse = Math.sin(phase * 2);
  if (id === 'electro-ball' || id === 'electro-charge') {
    const charging = id === 'electro-charge';
    glow(c, 64, 64, 61, '#ffa5263b');
    glow(c, 64, 64, 48, '#fff06466');
    const shell = c.createRadialGradient(55, 51, 3, 64, 64, 32);
    shell.addColorStop(0, '#ffffff');
    shell.addColorStop(0.24, '#fffbd3');
    shell.addColorStop(0.55, '#ffe755');
    shell.addColorStop(0.82, '#e69a21');
    shell.addColorStop(1, '#9b50194d');
    c.fillStyle = shell;
    c.beginPath();
    c.arc(64, 64, (charging ? 23 : 31) + pulse * 1.5, 0, TAU);
    c.fill();
    ring(c, 64, 64, (charging ? 25 : 33) + pulse * 1.5, '#fff8a6', 2);
    c.save();
    c.translate(64, 64);
    c.rotate(phase * 0.35);
    c.strokeStyle = '#fff9bead';
    c.lineWidth = 2;
    c.beginPath();
    c.ellipse(0, 0, 38, 16, -0.38, 0.1, 2.8);
    c.stroke();
    c.beginPath();
    c.ellipse(0, 0, 36, 23, 0.55, 3.2, 6);
    c.stroke();
    c.restore();
  } else if (id === 'electro-trail') {
    glow(c, 64, 64, 43, '#f9b83b4d');
    ring(c, 64, 64, 23 + pulse * 3, '#ffed82', 2);
  } else if (id === 'electro-impact') {
    c.globalAlpha = 1 - frame / FRAMES;
    glow(c, 64, 64, 62, '#ffe56d99');
    ring(c, 64, 64, 15 + frame * 3, '#fff4a2', 4);
  }
  const count = id === 'paralyzed' ? 6 : id === 'electro-trail' ? 4 : 9;
  for (let i = 0; i < count; i++) {
    const a = (i / count) * TAU + phase * (i % 2 ? -0.4 : 0.6);
    const start = id === 'paralyzed' ? 27 : id === 'electro-impact' ? 10 + frame * 2 : 30;
    const end = id === 'paralyzed' ? 54 : id === 'electro-trail' ? 43 : 59;
    const radii = [start, start + 9, end - 9, end];
    const points = radii.map((r, j) => {
      const zigzag = j === 1 ? 0.19 : j === 2 ? -0.15 : 0;
      return [64 + Math.cos(a + zigzag) * r, 64 + Math.sin(a + zigzag) * r];
    });
    electricBolt(c, points, id === 'paralyzed' ? 1.2 : 1.6, i % 3 === 0 ? 1 : 0.6);
    if (id !== 'paralyzed' && i % 2 === 0) {
      const x = 64 + Math.cos(a) * (end + 2);
      const y = 64 + Math.sin(a) * (end + 2);
      glow(c, x, y, 7, '#fff7b0cc');
    }
  }
}

function pixelFire(c: Context, id: 'inferno-stream' | 'burning', frame: number) {
  const cell = 4;
  const stream = id === 'inferno-stream';
  const colors = ['#571b2e', '#9e2731', '#e54827', '#ff8728', '#ffc447', '#fff3b0'];
  const hash = (x: number, y: number) => ((x * 37 + y * 71 + frame * 19) % 23) / 23;
  c.imageSmoothingEnabled = false;
  if (stream) {
    for (let px = 1; px < 32; px++) {
      const reach = px / 31;
      const center =
        16 +
        Math.sin(px * 0.39 - frame * 0.52) * reach * 1.15 +
        Math.sin(px * 0.83 + frame * 0.31) * reach * 0.5;
      const radius = 0.8 + reach * 10.2;
      const coreCenter = center + Math.sin(px * 0.64 + frame * 0.7) * reach * 0.85;
      for (let py = 1; py < 31; py++) {
        const edge = Math.abs(py - center) / radius;
        const grain = hash(px, py);
        if (edge < 1.18 && grain > 0.32) {
          c.fillStyle = '#4e192980';
          c.fillRect(px * cell, (py + 1) * cell, cell, cell);
        }
        if (edge > 1 + (grain - 0.5) * 0.18) continue;
        const shade = edge > 0.88 ? 1 : edge > 0.7 ? 2 : edge > 0.47 ? 3 : edge > 0.25 ? 4 : 5;
        c.fillStyle = colors[shade]!;
        c.fillRect(px * cell, py * cell, cell, cell);
        // A separate hot ribbon travels inside the darker outer plume.
        if (Math.abs(py - coreCenter) < radius * 0.24 && grain > 0.18) {
          c.fillStyle = grain > 0.64 ? '#ffffff' : '#fff8c6';
          c.fillRect(px * cell, py * cell, cell, cell);
        }
      }
    }
  } else {
    for (let px = 8; px < 24; px++) {
      const distance = Math.abs(px - 15.5);
      const tip = 5 + distance * 2.2 + Math.sin(px * 1.1 - frame * 0.65) * 2.5;
      for (let py = Math.max(1, Math.ceil(tip)); py < 29; py++) {
        const grain = hash(px, py);
        const edge = distance / 8;
        const shade = edge > 0.78 ? 1 : edge > 0.58 ? 2 : edge > 0.34 ? 3 : 4;
        c.fillStyle = colors[shade + (grain > 0.82 && shade < 5 ? 1 : 0)]!;
        c.fillRect(px * cell, py * cell, cell, cell);
      }
    }
  }
  // Detached square embers preserve the silhouette and give the flame depth in motion.
  for (let i = 0; i < (stream ? 32 : 18); i++) {
    const px = stream ? 5 + ((i * 23 + frame * 5) % 27) : 8 + ((i * 11 + frame * 3) % 16);
    const spread = stream ? 2 + (px / 31) * 11 : 9 + ((i * 3) % 8);
    const py = stream
      ? 16 + (i % 2 ? 1 : -1) * (spread + 1 + ((i * 7 + frame) % 5))
      : 2 + ((i * 13 + frame * 2) % 17);
    if (py < 1 || py > 30) continue;
    c.fillStyle = i % 4 === 0 ? '#fff4bc' : i % 3 === 0 ? '#ffb43b' : '#e9512b';
    c.fillRect(px * cell, py * cell, i % 6 === 0 ? 8 : cell, cell);
  }
}

function dragonLaserArt(c: Context, id: string, frame: number) {
  const phase = (frame / FRAMES) * TAU;
  const pulse = Math.sin(phase * 2);
  if (id === 'dragon-laser') {
    // Transparent edges and irregular silhouettes keep a stretched beam from becoming a rectangle.
    const halo = c.createLinearGradient(0, 9, 0, 119);
    halo.addColorStop(0, '#ff3b1000');
    halo.addColorStop(0.3, '#ff501322');
    halo.addColorStop(0.5, '#ffb03d88');
    halo.addColorStop(0.7, '#ff501322');
    halo.addColorStop(1, '#ff3b1000');
    c.fillStyle = halo;
    c.fillRect(0, 9, 128, 110);
    const ribbon = (radius: number, wave: number, color: string) => {
      c.fillStyle = color;
      c.beginPath();
      for (const side of [-1, 1]) {
        for (let step = 0; step <= 64; step++) {
          const x = side < 0 ? step * 2 : 128 - step * 2;
          const taper = 0.56 + 0.44 * Math.sin((x / 128) * Math.PI);
          const ripple =
            Math.sin(x * 0.17 - phase * 2 + side) * wave +
            Math.sin(x * 0.33 - phase * 3) * wave * 0.35;
          const y = 64 + side * (radius + ripple) * taper;
          if (side < 0 && step === 0) c.moveTo(x, y);
          else c.lineTo(x, y);
        }
      }
      c.closePath();
      c.fill();
    };
    ribbon(26, 8, '#f33b1666');
    ribbon(19, 5, '#ff621bcc');
    ribbon(12, 3, '#ffb53cee');
    ribbon(6.5, 1.2, '#fff1a4');
    ribbon(2.4, 0.4, '#fffefa');
    // Hot filaments flow forwards through the flame sheath.
    c.lineCap = 'round';
    for (let i = 0; i < 8; i++) {
      const x = ((i * 19 + frame * (128 / FRAMES)) % 156) - 14;
      const side = i % 2 ? 1 : -1;
      const y = 64 + side * (13 + (i % 3) * 5);
      c.strokeStyle = i % 3 ? '#ffe08cbb' : '#fff9d9ee';
      c.lineWidth = i % 3 ? 1.4 : 2;
      c.beginPath();
      c.moveTo(x - 13, y + side * 4);
      c.quadraticCurveTo(x, y - side * 5, x + 9, y);
      c.stroke();
    }
    const fade = c.createLinearGradient(0, 0, 128, 0);
    fade.addColorStop(0, '#ffffff00');
    fade.addColorStop(0.08, '#ffffff');
    fade.addColorStop(0.92, '#ffffff');
    fade.addColorStop(1, '#ffffff00');
    c.globalCompositeOperation = 'destination-in';
    c.fillStyle = fade;
    c.fillRect(0, 0, 128, 128);
    return;
  }
  if (id === 'dragon-laser-impact') {
    glow(c, 64, 64, 61, '#ff581b66');
    glow(c, 64, 64, 33 + pulse * 2, '#ffbd46bb');
    for (let i = 0; i < 10; i++) {
      const angle = (i * TAU) / 10 + Math.sin(phase) * 0.12;
      const reach = 27 + ((i * 13) % 23) + Math.sin(phase + i * 2) * 6;
      c.save();
      c.translate(64, 64);
      c.rotate(angle);
      c.fillStyle = i % 2 ? '#ff7e28bb' : '#ffd174dd';
      c.beginPath();
      c.moveTo(8, -5);
      c.quadraticCurveTo(reach * 0.65, -10, reach, -3);
      c.quadraticCurveTo(reach * 0.55, 2, 10, 5);
      c.fill();
      c.restore();
    }
    const shock = 24 + ((frame * 3) % 22);
    c.strokeStyle = '#ffe9a5aa';
    c.lineWidth = 1.5;
    for (let i = 0; i < 3; i++) {
      c.beginPath();
      c.arc(64, 64, shock, (i * TAU) / 3 + phase * 0.2, (i * TAU) / 3 + 1.2 + phase * 0.2);
      c.stroke();
    }
    glow(c, 64, 64, 18, '#fffdeeee');
    c.fillStyle = '#fffdf0';
    c.beginPath();
    c.ellipse(64, 64, 8 + pulse, 13 + pulse, 0, 0, TAU);
    c.fill();
    return;
  }
  glow(c, 64, 64, 59, '#ff511b55');
  glow(c, 64, 64, 35, '#ffb64caa');
  const radius = 15 + pulse * 1.5;
  const heart = c.createRadialGradient(61, 61, 1, 64, 64, radius);
  heart.addColorStop(0, '#fffff4');
  heart.addColorStop(0.4, '#fff6b9');
  heart.addColorStop(0.75, '#ffb43b');
  heart.addColorStop(1, '#f34b1b66');
  c.fillStyle = heart;
  c.beginPath();
  c.arc(64, 64, radius, 0, TAU);
  c.fill();
  for (let i = 0; i < 3; i++) {
    c.save();
    c.translate(64, 64);
    c.rotate((i * TAU) / 3 - phase);
    c.fillStyle = '#ff882fcc';
    c.beginPath();
    c.moveTo(9, -8);
    c.bezierCurveTo(30, -30, 46, -13, 39, 13);
    c.bezierCurveTo(39, -4, 24, -15, 13, 3);
    c.closePath();
    c.fill();
    c.strokeStyle = '#ffe8a3';
    c.lineWidth = 1.5;
    c.beginPath();
    c.arc(0, 0, 23, -1.2, 0.15);
    c.stroke();
    c.restore();
  }
}

function pixelSludge(
  c: Context,
  id: 'sludge-bomb' | 'sludge-trail' | 'sludge-impact' | 'sludge-puddle',
  frame: number,
) {
  const cell = 4;
  const block = (x: number, y: number, color: string, size = cell) => {
    c.fillStyle = color;
    c.fillRect(Math.round(x / cell) * cell, Math.round(y / cell) * cell, size, size);
  };
  const phase = (frame / FRAMES) * TAU;
  c.imageSmoothingEnabled = false;
  if (id === 'sludge-puddle') {
    for (let y = 39; y <= 100; y += cell)
      for (let x = 4; x <= 124; x += cell) {
        const dx = (x - 64) / 55;
        const dy = (y - 70) / 27;
        const distance = Math.hypot(dx, dy);
        const edge = 1 + Math.sin(x * 0.22 + y * 0.47) * 0.045;
        if (distance > edge) continue;
        block(
          x,
          y,
          distance > 0.88
            ? '#5f248c'
            : distance > 0.71
              ? '#a449d1'
              : distance > 0.48
                ? '#552276'
                : '#291633',
        );
        if (distance < 0.78 && (x * 13 + y * 7) % 17 < 3) block(x, y, '#79329a');
      }
    for (let i = 0; i < 5; i++) {
      const x = 31 + i * 17 + Math.sin(phase + i) * 2;
      const y = 58 + ((i * 13) % 26) - Math.sin(phase * 2 + i) * 3;
      const size = i % 2 ? 8 : 4;
      block(x, y, '#a5d969', size);
      block(x + cell, y + cell, '#4f8e62');
    }
    return;
  }
  if (id === 'sludge-impact') {
    const radius = 12 + frame * 3.2;
    for (let y = 4; y < 124; y += cell)
      for (let x = 4; x < 124; x += cell) {
        const d = Math.hypot(x - 64, (y - 64) * 1.35);
        if (Math.abs(d - radius) < 5 && (x * 7 + y * 11 + frame) % 13 < 10)
          block(x, y, frame < 5 ? '#d580ef' : '#773297');
      }
    for (let i = 0; i < 11; i++) {
      const angle = (i / 11) * TAU;
      const distance = 13 + frame * (1.5 + (i % 3) * 0.5);
      block(
        64 + Math.cos(angle) * distance,
        64 + Math.sin(angle) * distance * 0.75,
        i % 4 ? '#ae4bd4' : '#b2d976',
        i % 3 ? 4 : 8,
      );
    }
    return;
  }
  const trail = id === 'sludge-trail';
  if (!trail) {
    const radius = 28 + Math.sin(phase * 2) * 2;
    for (let y = 30; y <= 98; y += cell)
      for (let x = 28; x <= 100; x += cell) {
        const d = Math.hypot(x - 64, y - 64);
        const edge = radius + Math.sin(x * 0.45 + y * 0.31) * 2.5;
        if (d > edge) continue;
        block(
          x,
          y,
          d > edge - 6
            ? '#33153f'
            : d > edge - 11
              ? '#bc55dc'
              : y < 55 && x < 71
                ? '#a34ac8'
                : '#57216e',
        );
      }
    for (const [x, y] of [
      [49, 45],
      [53, 45],
      [57, 49],
      [48, 51],
    ])
      block(x, y, '#e59df1');
    for (const [x, y] of [
      [78, 49],
      [82, 52],
      [78, 55],
    ])
      block(x, y, '#b7dc70');
  }
  for (let i = 0; i < (trail ? 8 : 5); i++) {
    const x = trail ? 33 + i * 9 : 20 + ((i * 17) % 90);
    const y = trail ? 58 + Math.sin(i * 2 + phase) * 12 : 30 + ((i * 23) % 64);
    block(x, y, i % 3 === 0 ? '#b0d76e' : '#a743ce', i % 4 === 0 ? 8 : 4);
  }
}

function paint(c: Context, id: string, element: Element, frame: number) {
  if (id.startsWith('dragon-laser')) {
    dragonLaserArt(c, id, frame);
    return;
  }
  if (
    id === 'sludge-bomb' ||
    id === 'sludge-trail' ||
    id === 'sludge-impact' ||
    id === 'sludge-puddle'
  ) {
    pixelSludge(c, id, frame);
    return;
  }
  if (id === 'inferno-stream' || id === 'burning') {
    pixelFire(c, id, frame);
    return;
  }
  const t = frame / FRAMES,
    phase = t * TAU;
  const color = ELEMENTS[element].color;
  c.lineCap = 'round';
  c.lineJoin = 'round';
  c.shadowColor = color;
  c.shadowBlur = 7;
  if (id === 'charge' || id === 'impact') {
    const impact = id === 'impact';
    const r = impact ? 8 + t * 45 : 35 - Math.sin(phase) * 4;
    c.globalAlpha = impact ? 1 - t : 0.8;
    glow(c, 64, 64, r + 12, color + '65');
    ring(c, 64, 64, r, color, impact ? 3 - t * 2 : 1.5);
    for (let i = 0; i < 8; i++) {
      const a = (i * TAU) / 8 + (impact ? 0 : phase);
      const inner = impact ? r * 0.5 : r;
      const outer = impact ? r + 9 : r + 6;
      stroke(
        c,
        [
          [64 + Math.cos(a) * inner, 64 + Math.sin(a) * inner],
          [64 + Math.cos(a + 0.12) * (r + 3), 64 + Math.sin(a + 0.12) * (r + 3)],
          [64 + Math.cos(a) * outer, 64 + Math.sin(a) * outer],
        ],
        '#fff9d9',
        2,
      );
    }
    return;
  }
  if (
    ['electro-ball', 'electro-charge', 'electro-trail', 'electro-impact', 'paralyzed'].includes(id)
  ) {
    electricArt(c, id, frame);
    return;
  }
  glow(c, 67, 64, 40, color + '45');
  if (element === 'electric') {
    for (let branch = 0; branch < 3; branch++) {
      const points = Array.from({ length: 9 }, (_, i) => [
        14 + i * 12,
        64 + Math.sin(i * 4.1 + phase + branch * 2) * (i === 8 ? 2 : 12 + branch * 5),
      ]);
      stroke(c, points, '#ffb52b', 7 - branch * 2);
      stroke(c, points, '#fffbd6', 2);
    }
    if (id === 'thunder-wave')
      for (let i = 0; i < 3; i++) {
        c.beginPath();
        c.strokeStyle = '#fff3a1';
        c.lineWidth = 2;
        c.ellipse(48 + i * 20, 64, 9 + Math.sin(phase) * 2, 32 - i * 4, 0, -1.4, 1.4);
        c.stroke();
      }
    if (id === 'volt-tackle') ring(c, 64, 64, 34 + Math.sin(phase) * 3, '#ffe97f', 3);
  } else if (element === 'fire') {
    for (let i = 0; i < 5; i++) {
      const y = 44 + i * 10;
      c.fillStyle = i % 2 ? '#ffb337' : '#ff642d';
      c.beginPath();
      c.moveTo(105, 64);
      c.bezierCurveTo(88, y - 26, 39, y + Math.sin(phase + i) * 12, 12 + i * 5, y);
      c.quadraticCurveTo(60, 64, 20, 100 - i * 8);
      c.quadraticCurveTo(95, 99, 105, 64);
      c.fill();
    }
    glow(c, 86, 64, 18, '#fff3bc');
    if (id === 'flame-burst') ring(c, 83, 64, 23 + Math.sin(phase) * 3, '#ffe09c', 2);
  } else if (element === 'water') {
    if (id === 'water-orb') {
      const radius = 39 + Math.sin(phase) * 2;
      const fill = c.createRadialGradient(51, 49, 3, 64, 64, radius);
      fill.addColorStop(0, '#e4ffff');
      fill.addColorStop(0.35, '#7defff');
      fill.addColorStop(0.85, '#16b9df');
      fill.addColorStop(1, '#97f9ff');
      c.fillStyle = fill;
      c.beginPath();
      c.arc(64, 64, radius, 0, TAU);
      c.fill();
      ring(c, 64, 64, radius, '#b9ffff', 2);
      ring(c, 53, 50, 8, '#f5ffff', 3);
    } else if (id === 'bubble-beam') {
      for (let i = 0; i < 5; i++) {
        const x = 25 + i * 18,
          y = 64 + Math.sin(phase + i * 2) * 15,
          r = 8 + (i % 3) * 3;
        glow(c, x, y, r, '#58cfff85');
        ring(c, x, y, r, '#a9efff', 2);
        stroke(
          c,
          [
            [x - r * 0.5, y - 2],
            [x - r * 0.3, y - r * 0.6],
          ],
          '#ffffff',
          2,
        );
      }
    } else if (id === 'rapid-spin') {
      for (let i = 0; i < 3; i++) {
        c.beginPath();
        c.strokeStyle = i === 1 ? '#efffff' : '#61d6f7';
        c.lineWidth = 4 - i;
        c.ellipse(64, 64, 42 - i * 7, 25 - i * 4, phase, i * 2, i * 2 + 4.5);
        c.stroke();
      }
    } else {
      for (let i = 0; i < 4; i++)
        stroke(
          c,
          Array.from({ length: 13 }, (_, j) => [
            12 + j * 8,
            64 + Math.sin(j * 0.6 + phase + i) * (6 + i * 3),
          ]),
          i % 2 ? '#d8fbff' : '#41bbf4',
          5 - i,
        );
      glow(c, 99, 64, 13, '#d9ffff');
    }
  } else if (element === 'grass') {
    if (id === 'solar-beam') {
      for (let i = 0; i < 3; i++)
        stroke(
          c,
          [
            [9, 64],
            [118, 64],
          ],
          ['#64d66b', '#caff7d', '#ffffdc'][i]!,
          24 - i * 9,
        );
      for (let i = 0; i < 3; i++)
        ring(c, 25 + i * 32, 64, 14 + Math.sin(phase + i) * 3, '#eaffb7', 1);
    } else if (id === 'vine-whip') {
      const points = Array.from({ length: 15 }, (_, i) => [
        8 + i * 8,
        64 + Math.sin(i * 0.45 + phase) * 17,
      ]);
      stroke(c, points, '#318b55', 6);
      stroke(c, points, '#b3f69a', 2);
      leaf(c, 72, points[8]![1]!, -0.6, 10);
    } else if (id === 'leech-seed') {
      glow(c, 70, 64, 23, '#beed7470');
      c.fillStyle = '#e9c174';
      c.beginPath();
      c.ellipse(68, 67, 10, 13, phase * 0.2, 0, TAU);
      c.fill();
      leaf(c, 61, 53, 0.6, 12);
      leaf(c, 78, 51, -0.7, 11);
    } else {
      leaf(c, 65, 64, phase, 31);
      leaf(c, 30, 72, phase + 1, 12);
      stroke(
        c,
        [
          [13, 88],
          [37, 83],
          [53, 74],
        ],
        '#d1f6b1',
        2,
      );
    }
  } else {
    for (let i = 0; i < (id === 'scratch' ? 3 : 1); i++) {
      c.beginPath();
      c.strokeStyle = '#fff8e6';
      c.lineWidth = 5 - t * 2;
      c.ellipse(56 + i * 10, 64, 43, 30 - i * 5, -0.5 + t * 0.6, -1.5, 1.4);
      c.stroke();
    }
    for (let i = 0; i < 4; i++)
      stroke(
        c,
        [
          [12 + i * 7, 43 + i * 13],
          [50, 48 + i * 10],
        ],
        '#cdeaff',
        2,
      );
  }
}

/** Bake transparent frame atlases once; combat renders animated Sprites, not Graphics. */
export function createSkillTextures(scene: Phaser.Scene) {
  const definitions = Object.values(SKILL_BY_ID)
    .filter((skill) => skill.id !== 'tail-whip' && skill.id !== 'ember-glyph')
    .map((skill) => ({ id: skill.id, element: skill.element }));
  for (const id of ['paralyzed', 'electro-charge', 'electro-trail', 'electro-impact'])
    definitions.push({ id, element: 'electric' });
  definitions.push({ id: 'burning', element: 'fire' });
  definitions.push({ id: 'dragon-laser-charge', element: 'fire' });
  definitions.push({ id: 'dragon-laser-impact', element: 'fire' });
  definitions.push(
    { id: 'eevee-guard', element: 'normal' },
    { id: 'eevee-adaptive', element: 'normal' },
    { id: 'starfall-impact', element: 'normal' },
  );
  for (const id of ['sludge-trail', 'sludge-impact', 'sludge-puddle'])
    definitions.push({ id, element: 'poison' });
  for (const element of Object.keys(ELEMENTS) as Element[]) {
    definitions.push({ id: `charge-${element}`, element }, { id: `impact-${element}`, element });
  }
  for (const { id, element } of definitions) {
    const key = `skill-vfx-${id}`;
    if (!scene.textures.exists(key)) {
      const canvas = document.createElement('canvas');
      canvas.width = SIZE * FRAMES;
      canvas.height = SIZE;
      const c = canvas.getContext('2d')!;
      for (let frame = 0; frame < FRAMES; frame++) {
        c.save();
        c.translate(frame * SIZE, 0);
        c.beginPath();
        c.rect(0, 0, SIZE, SIZE);
        c.clip();
        paint(
          c,
          id.startsWith('charge-') ? 'charge' : id.startsWith('impact-') ? 'impact' : id,
          element,
          frame,
        );
        c.restore();
      }
      const texture = scene.textures.addCanvas(key, canvas)!;
      if (id === 'inferno-stream' || id === 'burning' || id.startsWith('sludge-'))
        texture.setFilter(Phaser.Textures.FilterMode.NEAREST);
      for (let frame = 0; frame < FRAMES; frame++)
        texture.add(frame, 0, frame * SIZE, 0, SIZE, SIZE);
    }
    if (!scene.anims.exists(key))
      scene.anims.create({
        key,
        frames: scene.anims.generateFrameNames(key, { start: 0, end: FRAMES - 1 }),
        frameRate: 30,
        repeat:
          id.startsWith('impact-') || id === 'electro-impact' || id === 'sludge-impact' ? 0 : -1,
      });
  }
  for (const element of Object.keys(ELEMENTS) as Element[]) {
    const key = `skill-particle-${element}`;
    if (scene.textures.exists(key)) continue;
    const canvas = document.createElement('canvas');
    canvas.width = 32;
    canvas.height = 32;
    const c = canvas.getContext('2d')!;
    c.shadowColor = ELEMENTS[element].color;
    c.shadowBlur = 4;
    if (element === 'grass') leaf(c, 16, 16, -0.5, 10);
    else if (element === 'poison') {
      c.imageSmoothingEnabled = false;
      c.fillStyle = '#a44aca';
      c.fillRect(8, 10, 12, 12);
      c.fillStyle = '#c1dd7b';
      c.fillRect(12, 10, 4, 4);
    } else if (element === 'water') {
      glow(c, 16, 16, 11, '#69d7ff85');
      ring(c, 16, 16, 8, '#cafaff', 2);
    } else if (element === 'electric')
      stroke(
        c,
        [
          [19, 4],
          [11, 17],
          [20, 15],
          [13, 28],
        ],
        '#fff0a3',
        2.5,
      );
    else {
      glow(c, 16, 16, 12, element === 'fire' ? '#ffb358' : '#f0efff');
    }
    scene.textures.addCanvas(key, canvas);
  }
}
