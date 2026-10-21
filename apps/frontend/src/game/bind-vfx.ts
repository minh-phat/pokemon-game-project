import * as Phaser from 'phaser';

type BodyPoint = { x: number; y: number; radius: number; front: boolean };

const clamp = (value: number) => Math.max(0, Math.min(1, value));
const smooth = (value: number) => {
  const t = clamp(value);
  return t * t * (3 - 2 * t);
};

/** A continuous spine: the head leads, the neck follows, and each turn crosses the victim. */
export class BindVfx {
  private back: Phaser.GameObjects.Graphics;
  private front: Phaser.GameObjects.Graphics;
  private head: Phaser.GameObjects.Sprite;

  constructor(scene: Phaser.Scene) {
    this.back = scene.add.graphics().setDepth(9).setName('bind-body-back');
    this.front = scene.add.graphics().setDepth(14).setName('bind-body-front');
    const texture = scene.textures.get('runedrake-bind-head');
    // Use only the authored face. The old image includes an entire rigid S-shaped neck.
    if (!texture.has('bind-face')) texture.add('bind-face', 0, 1030, 475, 430, 420);
    this.head = scene.add
      .sprite(0, 0, 'runedrake-bind-head', 'bind-face')
      .setOrigin(0.18, 0.4)
      .setName('bind-head');
  }

  update(
    x: number,
    y: number,
    width: number,
    height: number,
    facing: number,
    age: number,
    duration: number,
    reduced: boolean,
  ) {
    const side = facing < 0 ? -1 : 1;
    const time = reduced ? 2.8 : age;
    const winding = smooth(time / 1.18);
    const squeeze = smooth((time - 1.05) / (duration - 1.05));
    const pulse = reduced ? 0 : Math.exp(-Math.pow((time - Math.round(time)) / 0.105, 2));
    const contraction = 1 - squeeze * 0.19 - pulse * 0.035 * smooth((time - 0.7) / 0.3);
    const radius = Math.max(44, width * 0.85 + 16) * contraction;
    const climb = Math.max(64, height * 1.25);
    const thickness = Math.max(10, Math.min(15, width * 0.24));
    const fade = 1 - smooth((age - duration) / 0.22);
    // A little forward creep remains after winding; the head never orbits a frozen body.
    const turns = 2.18 * winding + 0.08 * squeeze;
    const end = turns * Math.PI * 2;
    const points: BodyPoint[] = [];
    const steps = Math.max(1, Math.ceil(end / 0.055));
    const point = (angle: number): BodyPoint => {
      const along = angle / (Math.PI * 2 * 2.26);
      const phase = Math.PI - angle;
      const wave =
        (reduced ? 0 : Math.sin(angle * 2.1 - time * 7)) * 1.8 * Math.sin(along * Math.PI);
      return {
        x: x + side * Math.cos(phase) * (radius + wave),
        y: y + 19 - along * climb + Math.sin(phase) * radius * 0.29,
        radius: thickness * (0.23 + 0.77 * smooth(angle / 1.5)),
        front: Math.sin(phase) >= 0,
      };
    };
    // The taper starts at the dash entry and feeds into the first loop without a pop.
    for (let i = 0; i <= steps; i++) points.push(point(Math.min(end, i * 0.055)));
    this.back.clear().setAlpha(reduced ? 0.75 : fade);
    this.front.clear().setAlpha(reduced ? 0.75 : fade);
    // Draw ribbons for each half-turn, rather than individual outlined segments.
    // Shared edges keep the silhouette smooth even where the body changes depth.
    for (let start = 0; start < points.length - 1; ) {
      let finish = start + 1;
      const front = points[finish].front;
      while (finish + 1 < points.length && points[finish + 1].front === front) finish++;
      const graphics = front ? this.front : this.back;
      const ribbon = (scale: number, padding: number, offset: number, color: number) => {
        const left: Phaser.Geom.Point[] = [];
        const right: Phaser.Geom.Point[] = [];
        for (let i = start; i <= finish; i++) {
          const p = points[i];
          const prev = points[Math.max(0, i - 1)];
          const next = points[Math.min(points.length - 1, i + 1)];
          const length = Math.hypot(next.x - prev.x, next.y - prev.y) || 1;
          const nx = -(next.y - prev.y) / length;
          const ny = (next.x - prev.x) / length;
          const r = p.radius * scale + padding;
          left.push(new Phaser.Geom.Point(p.x + nx * r, p.y + ny * r + p.radius * offset));
          right.push(new Phaser.Geom.Point(p.x - nx * r, p.y - ny * r + p.radius * offset));
        }
        graphics.fillStyle(color).fillPoints([...left, ...right.reverse()], true);
      };
      ribbon(1, 1.5, 0, 0x311a24);
      ribbon(1, 0, 0, front ? 0xb92b20 : 0x752323);
      ribbon(0.63, 0, 0.22, front ? 0xe6a35e : 0xa96b47);
      ribbon(0.36, 0, 0.35, front ? 0xffdf9c : 0xc28e5f);
      // Marks stay fixed to the spine rather than swimming over a static ring.
      for (let i = start; i <= finish; i++) {
        const p = points[i];
        if (i % 13 !== 5 || p.radius < 6) continue;
        graphics
          .fillStyle(front ? 0xb73426 : 0x783326)
          .fillPoints(
            [
              new Phaser.Geom.Point(p.x, p.y + p.radius * 0.3 - 2.5),
              new Phaser.Geom.Point(p.x + 2.5, p.y + p.radius * 0.3),
              new Phaser.Geom.Point(p.x, p.y + p.radius * 0.3 + 2.5),
              new Phaser.Geom.Point(p.x - 2.5, p.y + p.radius * 0.3),
            ],
            true,
          );
      }
      start = finish;
    }
    const tip = points[points.length - 1];
    const before = point(end - 0.035);
    const tangent = Math.atan2(tip.y - before.y, tip.x - before.x);
    // The source muzzle points down and right at about 45 degrees.
    this.head
      .setPosition(tip.x, tip.y)
      .setOrigin(side > 0 ? 0.18 : 0.82, 0.4)
      .setDisplaySize(thickness * 4.5, thickness * 4.4)
      .setRotation(tangent - (side > 0 ? 0.65 : Math.PI - 0.65))
      .setFlipX(side < 0)
      .setDepth(tip.front ? 15 : 9.5)
      .setAlpha(reduced ? 0.8 : fade);
    this.front.setData({ radius, winding, headX: tip.x, headY: tip.y, points: points.length });
  }

  destroy() {
    this.back.destroy();
    this.front.destroy();
    this.head.destroy();
  }
}
