import type { Point } from './open-world-world';

type DrawObject = { depth: number; draw: () => void };
type Project = (x: number, y: number, rise?: number) => Point;

/** Decorative city life stays separate from wildlife, combat and saved simulation. */
export function addCityLife(
  c: CanvasRenderingContext2D,
  point: Project,
  visible: (p: Point, margin?: number) => boolean,
  depth: number,
  time: number,
  objects: DrawObject[],
  player: Point,
) {
  const queue = (x: number, y: number, draw: (p: Point) => void) => {
    const p = point(x, y);
    if (visible(p, 100))
      objects.push({
        depth: depth + x + y,
        draw: () => {
          c.save();
          if (Math.abs(p.x - player.x) < 28 && p.y >= player.y - 3 && p.y < player.y + 32)
            c.globalAlpha = 0.4;
          draw(p);
          c.restore();
        },
      });
  };
  const face = (color: string, points: Point[]) => {
    c.fillStyle = color;
    c.beginPath();
    points.forEach((p, i) => (i ? c.lineTo(p.x, p.y) : c.moveTo(p.x, p.y)));
    c.closePath();
    c.fill();
  };
  const shadow = (p: Point, radius: number) => {
    c.fillStyle = '#25484630';
    c.beginPath();
    c.ellipse(p.x + radius * 0.3, p.y + 2, radius, radius * 0.3, 0.1, 0, Math.PI * 2);
    c.fill();
  };
  const sun = (x: number, y: number, r: number) => {
    c.strokeStyle = '#ffe2a0';
    c.lineWidth = 0.8;
    c.beginPath();
    c.arc(x, y, r, 0, Math.PI * 2);
    for (let i = 0; i < 8; i++) {
      const a = (i * Math.PI) / 4;
      c.moveTo(x + Math.cos(a) * (r + 1.5), y + Math.sin(a) * (r + 1.5));
      c.lineTo(x + Math.cos(a) * (r + 3), y + Math.sin(a) * (r + 3));
    }
    c.stroke();
  };

  // Banners frame the plaza; the warmer cloth carries the sunrise emblem.
  for (const [x, y] of [
    [-5, -5],
    [5, -5],
    [-5, 5],
    [5, 5],
  ]) {
    queue(x, y, (p) => {
      shadow(p, 7);
      c.fillStyle = '#d8c6a0';
      c.fillRect(p.x - 2, p.y - 36, 3, 36);
      c.fillStyle = '#a48150';
      c.fillRect(p.x - 5, p.y - 1, 9, 3);
      const flutter = Math.sin(time * 1.6 + x) * 1.5;
      face('#bc7257', [
        { x: p.x + 1, y: p.y - 34 },
        { x: p.x + 17, y: p.y - 33 + flutter },
        { x: p.x + 17, y: p.y - 11 + flutter },
        { x: p.x + 9, y: p.y - 15 },
        { x: p.x + 1, y: p.y - 11 },
      ]);
      sun(p.x + 9, p.y - 25 + flutter * 0.3, 3);
      c.fillStyle = '#ffdf9d';
      c.beginPath();
      c.arc(p.x - 0.5, p.y - 38, 2, 0, Math.PI * 2);
      c.fill();
    });
  }

  // Small open-air stands cluster around the market instead of duplicating towers.
  for (const [index, [x, y]] of [
    [-27, 13],
    [-23.5, 13],
    [-27, 3.6],
  ].entries()) {
    queue(x, y, (p) => {
      shadow(p, 24);
      const q = (dx: number, dy: number, z = 0) => point(x + dx, y + dy, z);
      face('#805e48', [q(-0.8, 0.65, 0), q(0.8, 0.65, 0), q(0.8, 0.65, 11), q(-0.8, 0.65, 11)]);
      face('#b88d61', [q(0.8, -0.65, 0), q(0.8, 0.65, 0), q(0.8, 0.65, 11), q(0.8, -0.65, 11)]);
      face('#e6c895', [q(-0.8, -0.65, 11), q(0.8, -0.65, 11), q(0.8, 0.65, 11), q(-0.8, 0.65, 11)]);
      for (const dx of [-0.85, 0.85]) {
        const post = q(dx, -0.55);
        c.fillStyle = '#836c50';
        c.fillRect(post.x - 1, post.y - 31, 2, 31);
      }
      for (let i = 0; i < 6; i++) {
        const start = -1 + i / 3;
        face(i % 2 ? '#fff0cf' : ['#c77a5e', '#639b87', '#d0a351'][index], [
          q(start, -0.85, 31),
          q(start + 1 / 3, -0.85, 31),
          q(start + 1 / 3, 0.9, 24),
          q(start, 0.9, 24),
        ]);
        const berry = q(-0.55 + (i % 3) * 0.5, 0.2 + Math.floor(i / 3) * 0.3, 14);
        c.fillStyle = ['#e9ac6f', '#d76861', '#83a65f'][index];
        c.beginPath();
        c.arc(berry.x, berry.y, 2.4, 0, Math.PI * 2);
        c.fill();
      }
    });
  }

  // Café seating sits in the inner forecourts, clear of the four travel axes.
  for (const [x, y] of [
    [-13.5, 7],
    [-13.5, 10.5],
    [13.5, -7],
  ]) {
    queue(x, y, (p) => {
      shadow(p, 18);
      c.fillStyle = '#735f47';
      c.fillRect(p.x - 1, p.y - 11, 2, 11);
      c.fillStyle = '#e0c396';
      c.beginPath();
      c.ellipse(p.x, p.y - 11, 9, 4, 0, 0, Math.PI * 2);
      c.fill();
      for (const offset of [-13, 13]) {
        c.fillStyle = '#886e50';
        c.fillRect(p.x + offset - 3, p.y - 4, 6, 3);
        c.fillRect(p.x + offset - 3, p.y - 2, 1, 5);
        c.fillRect(p.x + offset + 2, p.y - 2, 1, 5);
      }
      c.fillStyle = '#cbb58a';
      c.fillRect(p.x - 1, p.y - 30, 2, 25);
      for (let i = 0; i < 8; i++) {
        const a = (i * Math.PI) / 4,
          b = ((i + 1) * Math.PI) / 4;
        face(i % 2 ? '#e8c19a' : '#f8e6bf', [
          { x: p.x, y: p.y - 35 },
          { x: p.x + Math.cos(a) * 21, y: p.y - 28 + Math.sin(a) * 9 },
          { x: p.x + Math.cos(b) * 21, y: p.y - 28 + Math.sin(b) * 9 },
        ]);
      }
    });
  }

  // Gentle back-and-forth promenades on known clear sidewalks. No random AI work.
  for (let i = 0; i < 12; i++) {
    const phase = time * 0.25 + i * 1.7;
    const distance = 9.5 + (1 + Math.sin(phase)) * 3;
    const side = i % 2 ? -3.3 : 3.3;
    const x = i % 4 < 2 ? distance * (i % 3 ? 1 : -1) : side;
    const y = i % 4 < 2 ? side : distance * (i % 3 ? -1 : 1);
    queue(x, y, (p) => {
      shadow(p, 6);
      const stride = Math.sin(time * 5 + i) * Math.abs(Math.cos(phase)) * 2;
      c.fillStyle = '#43515a';
      c.fillRect(p.x - 3, p.y - 5, 2.5, 5 + stride);
      c.fillRect(p.x + 1, p.y - 5, 2.5, 5 - stride);
      c.fillStyle = ['#bc8067', '#548f8c', '#a5a071', '#6f87a4'][i % 4];
      c.fillRect(p.x - 4, p.y - 14, 8, 10);
      c.fillStyle = ['#e9c398', '#c28d6c', '#a57254'][i % 3];
      c.fillRect(p.x - 3, p.y - 21, 6, 7);
      c.fillRect(p.x - 6, p.y - 12, 2, 6);
      c.fillRect(p.x + 4, p.y - 12, 2, 6);
      c.fillStyle = i % 2 ? '#725745' : '#d8bd86';
      c.fillRect(p.x - 4, p.y - 23, 8, 4);
      if (i % 2 === 0) c.fillRect(p.x - 6, p.y - 20, 12, 2);
      c.fillStyle = '#dfc59a';
      if (i % 3 === 0) c.fillRect(p.x + 5, p.y - 7, 4, 5);
    });
  }
}
