import type * as Phaser from 'phaser';
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

function paint(c: Context, id: string, element: Element, frame: number) {
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
    if (id === 'bubble-beam') {
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
  const definitions = Object.values(SKILL_BY_ID).map((s) => ({ id: s.id, element: s.element }));
  for (const id of ['paralyzed', 'electro-charge', 'electro-trail', 'electro-impact'])
    definitions.push({ id, element: 'electric' });
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
      for (let frame = 0; frame < FRAMES; frame++)
        texture.add(frame, 0, frame * SIZE, 0, SIZE, SIZE);
    }
    if (!scene.anims.exists(key))
      scene.anims.create({
        key,
        frames: scene.anims.generateFrameNames(key, { start: 0, end: FRAMES - 1 }),
        frameRate: 30,
        repeat: id.startsWith('impact-') || id === 'electro-impact' ? 0 : -1,
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
    else if (element === 'water') {
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
