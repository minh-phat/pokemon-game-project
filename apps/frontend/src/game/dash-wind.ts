import * as Phaser from 'phaser';

type Gust = {
  x: number;
  y: number;
  dx: number;
  dy: number;
  age: number;
  side: number;
  seed: number;
};

/** Layered, tapered wind ribbons in world space, aligned with the actual dash. */
export class DashWind {
  private graphics: Phaser.GameObjects.Graphics;
  private gusts: Gust[] = [];
  private bursts: Gust[] = [];
  private clock = 0;
  private emitting = false;
  private sequence = 0;

  constructor(scene: Phaser.Scene) {
    this.graphics = scene.add.graphics();
  }

  private point(gust: Gust, along: number, across: number) {
    return {
      x: gust.x + gust.dx * along - gust.dy * across,
      y: gust.y + gust.dy * along + gust.dx * across,
    };
  }

  private ribbon(gust: Gust, glow: boolean) {
    const t = gust.age / 260;
    const fade = (1 - t) ** 2;
    const length = 60 + gust.seed * 20 + t * 24;
    const points: { x: number; y: number }[] = [];
    const widths: number[] = [];
    for (let i = 0; i <= 18; i++) {
      const u = i / 18;
      const across = gust.side * (12 + Math.sin(u * Math.PI) * (17 + t * 10) - u * 9);
      points.push(this.point(gust, -16 - u * length - t * 12, across));
      widths.push(Math.sin(Math.PI * u) ** 0.8 * (glow ? 6 : 2.1) * (1 - t));
    }
    const outline = points.map((p, i) => ({
      x: p.x - gust.dy * widths[i],
      y: p.y + gust.dx * widths[i],
    }));
    for (let i = points.length - 1; i >= 0; i--) {
      outline.push({
        x: points[i].x + gust.dy * widths[i],
        y: points[i].y - gust.dx * widths[i],
      });
    }
    this.graphics.fillStyle(glow ? 0x66d9ef : 0xedfcff, fade * (glow ? 0.12 : 0.7));
    this.graphics.fillPoints(outline, true);
  }

  update(
    x: number,
    y: number,
    depth: number,
    vx: number,
    vy: number,
    active: boolean,
    visible: boolean,
    delta: number,
    paused: boolean,
    reduced: boolean,
  ) {
    this.graphics.clear().setDepth(depth - 0.01);
    if (!visible || reduced) {
      this.gusts = [];
      this.bursts = [];
      this.clock = 0;
      this.emitting = false;
      return;
    }
    const dt = paused ? 0 : Math.min(delta, 50);
    this.gusts = this.gusts.filter((gust) => (gust.age += dt) < 260);
    this.bursts = this.bursts.filter((burst) => (burst.age += dt) < 300);
    this.clock -= dt;
    const speed = Math.hypot(vx, vy);
    if (!paused) {
      const emitting = active && speed > 1;
      if (emitting) {
        const origin = { x, y, dx: vx / speed, dy: vy / speed, age: 0, side: 1, seed: 0 };
        if (!this.emitting) {
          this.bursts.push(origin);
          this.clock = 0;
        }
        if (this.clock <= 0) {
          const seed = (this.sequence++ % 5) / 4;
          for (const side of [-1, 1]) this.gusts.push({ ...origin, side, seed });
          this.clock = 36;
        }
      }
      this.emitting = emitting;
    }
    // Broad, transparent air pressure under crisp, pointed ribbon cores.
    for (const gust of this.gusts) this.ribbon(gust, true);
    for (const gust of this.gusts) {
      this.ribbon(gust, false);
      const t = gust.age / 260;
      const p = this.point(gust, -32 - t * 64, gust.side * (28 + t * 18));
      const radius = Math.sin(Math.PI * t) * 1.9;
      this.graphics.fillStyle(0xd7faff, (1 - t) * 0.65);
      this.graphics.fillCircle(p.x, p.y, radius);
      if (gust.seed > 0.6) {
        this.graphics.lineStyle(1, 0xf5ffff, (1 - t) * 0.5);
        const end = this.point(gust, -43 - t * 64, gust.side * (28 + t * 18));
        this.graphics.lineBetween(p.x, p.y, end.x, end.y);
      }
    }
    // An expanding, broken elliptical pressure ring marks the launch point.
    for (const burst of this.bursts) {
      const t = burst.age / 300;
      const expand = 1 - (1 - t) ** 3;
      for (const side of [-1, 1]) {
        const arc = [];
        for (let i = 0; i <= 24; i++) {
          const angle = -1.15 + (i / 24) * 2.3;
          arc.push(
            this.point(
              burst,
              -18 + side * Math.cos(angle) * (7 + expand * 9),
              Math.sin(angle) * (24 + expand * 24),
            ),
          );
        }
        this.graphics.lineStyle(7 * (1 - t), 0x79e5f3, 0.12 * (1 - t));
        this.graphics.strokePoints(arc, false);
        this.graphics.lineStyle(2 * (1 - t), 0xe7fcff, 0.7 * (1 - t) ** 2);
        this.graphics.strokePoints(arc, false);
      }
    }
  }

  destroy() {
    this.gusts = [];
    this.bursts = [];
    this.graphics.destroy();
  }
}
