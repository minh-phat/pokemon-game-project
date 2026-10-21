import * as Phaser from 'phaser';

type SpinePoint = { x: number; y: number; front: boolean; distance: number };
type Layer = { texture: Phaser.Textures.CanvasTexture; image: Phaser.GameObjects.Image };

const smooth = (value: number) => {
  const t = Math.max(0, Math.min(1, value));
  return t * t * (3 - 2 * t);
};
const ART = 'runedrake-bind-rig';
const BODY_START = 430;
const BODY_END = 1810;
const ORIGIN_X = 352;
const ORIGIN_Y = 160;
let nextId = 0;

// Authored parchment centerline in the rig image. Following it removes the source
// pose's bends while retaining the seals, folded fins and flames on either side.
const SOURCE_SPINE = [
  [430, 375],
  [500, 350],
  [600, 365],
  [700, 405],
  [800, 390],
  [900, 365],
  [1000, 390],
  [1100, 390],
  [1200, 425],
  [1300, 420],
  [1400, 370],
  [1500, 370],
  [1600, 405],
  [1700, 410],
  [1810, 355],
];
const sourceY = (x: number) => {
  let i = 1;
  while (i < SOURCE_SPINE.length - 1 && SOURCE_SPINE[i][0] < x) i++;
  const a = SOURCE_SPINE[i - 1],
    b = SOURCE_SPINE[i];
  return Phaser.Math.Linear(a[1], b[1], (x - a[0]) / (b[0] - a[0]));
};

/** Bend the full pixel-art creature along a spine; never redraw its anatomy as vector shapes. */
export class BindVfx {
  private back: Layer;
  private front: Layer;
  private head: Phaser.GameObjects.Sprite;
  private tail: Phaser.GameObjects.Sprite;
  private source: HTMLImageElement;
  private lastPose = '';

  constructor(private scene: Phaser.Scene) {
    const id = nextId++;
    const layer = (name: string, depth: number): Layer => {
      const texture = scene.textures.createCanvas(`bind-${id}-${name}`, 512, 320)!;
      texture.setFilter(Phaser.Textures.FilterMode.NEAREST);
      texture.context.imageSmoothingEnabled = false;
      const image = scene.add
        .image(0, 0, texture.key)
        .setOrigin(0)
        .setDepth(depth)
        .setName(`bind-body-${name}`);
      return { texture, image };
    };
    this.back = layer('back', 9);
    this.front = layer('front', 14);
    const art = scene.textures.get(ART);
    art.setFilter(Phaser.Textures.FilterMode.NEAREST);
    this.source = art.getSourceImage() as HTMLImageElement;
    if (!art.has('head')) art.add('head', 0, BODY_END, 100, 362, 460);
    if (!art.has('tail')) art.add('tail', 0, 0, 180, BODY_START + 3, 340);
    this.head = scene.add.sprite(0, 0, ART, 'head').setName('bind-head');
    this.tail = scene.add.sprite(0, 0, ART, 'tail').setName('bind-tail');
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
    const artScale = thickness / 55;
    const fade = 1 - smooth((age - duration) / 0.22);
    const end = (2.18 * winding + 0.08 * squeeze) * Math.PI * 2;
    const steps = Math.max(1, Math.ceil(end / 0.055));
    const points: SpinePoint[] = [];
    const add = (px: number, py: number, front: boolean) => {
      const prev = points[points.length - 1];
      const distance = prev ? prev.distance + Math.hypot(px - prev.x, py - prev.y) : 0;
      if (prev && distance - prev.distance < 0.001) return;
      points.push({ x: px, y: py, front, distance });
    };
    // The entire creature feeds into the coil: its smoky tail remains attached
    // instead of a head and a short body appearing from nowhere at contact.
    const feed = 1 - winding;
    const entryLift = -22 * (1 - smooth(time / 0.28));
    for (let i = 0; i <= 40; i++) {
      const t = i / 40;
      add(
        side * (-radius - 120 * feed * (1 - t) ** 2),
        19 + entryLift - Math.sin(t * Math.PI) ** 3 * 28 * feed,
        true,
      );
    }
    for (let i = 0; i <= steps; i++) {
      const angle = Math.min(end, i * 0.055);
      const along = angle / (Math.PI * 2 * 2.26);
      const phase = Math.PI - angle;
      const wave =
        (reduced ? 0 : Math.sin(angle * 2.1 - time * 7)) * 1.8 * Math.sin(along * Math.PI);
      add(
        side * Math.cos(phase) * (radius + wave),
        19 + entryLift - along * climb + Math.sin(phase) * radius * 0.29,
        Math.sin(phase) >= 0,
      );
    }
    const tip = points[points.length - 1];
    const total = tip.distance;
    const pose = `${time}:${width}:${height}:${side}:${reduced}`;
    if (pose !== this.lastPose) {
      for (const layer of [this.back, this.front]) {
        layer.texture.context.setTransform(1, 0, 0, 1, 0, 0);
        layer.texture.context.clearRect(0, 0, 512, 320);
      }
      let segment = 1;
      // Sample by arc length, keeping the printed seals attached to the same skin
      // throughout winding and contraction. All fin/flame pixels accompany the skin.
      const slices = Math.ceil((BODY_END - BODY_START) / 3);
      for (let i = 0; i < slices; i++) {
        const u = i / slices;
        const distance = u * total;
        while (segment < points.length - 1 && points[segment].distance < distance) segment++;
        const a = points[segment - 1],
          b = points[segment];
        const length = b.distance - a.distance;
        const t = (distance - a.distance) / length;
        const dx = (b.x - a.x) / length,
          dy = (b.y - a.y) / length;
        const ctx = (b.front ? this.front : this.back).texture.context;
        const sx = BODY_START + u * (BODY_END - BODY_START);
        const sy = sourceY(sx);
        ctx.setTransform(
          dx,
          dy,
          -dy * side,
          dx * side,
          ORIGIN_X + Phaser.Math.Linear(a.x, b.x, t),
          ORIGIN_Y + Phaser.Math.Linear(a.y, b.y, t),
        );
        ctx.globalAlpha = b.front ? 1 : 0.86;
        ctx.drawImage(
          this.source,
          sx,
          sy - 155,
          (BODY_END - BODY_START) / slices + 1,
          310,
          -0.5,
          -155 * artScale,
          total / slices + 1,
          310 * artScale,
        );
      }
      for (const layer of [this.back, this.front]) {
        layer.texture.context.setTransform(1, 0, 0, 1, 0, 0);
        layer.texture.context.globalAlpha = 1;
        layer.texture.refresh();
      }
      this.lastPose = pose;
    }
    for (const layer of [this.back, this.front]) {
      layer.image.setPosition(x - ORIGIN_X, y - ORIGIN_Y).setAlpha(fade);
    }
    const before = points[points.length - 2];
    const tangent = Math.atan2(tip.y - before.y, tip.x - before.x);
    this.head
      .setPosition(x + tip.x, y + tip.y)
      .setOrigin(0, side > 0 ? 255 / 460 : 1 - 255 / 460)
      .setScale(artScale)
      .setRotation(tangent)
      .setFlipY(side < 0)
      .setDepth(tip.front ? 15 : 9.5)
      .setAlpha(fade);
    const start = points[0],
      next = points[1];
    this.tail
      .setPosition(x + start.x, y + start.y)
      .setOrigin(BODY_START / (BODY_START + 3), side > 0 ? 195 / 340 : 1 - 195 / 340)
      .setScale(artScale)
      .setRotation(Math.atan2(next.y - start.y, next.x - start.x))
      .setFlipY(side < 0)
      .setDepth(start.front ? 14 : 9)
      .setAlpha(fade);
    this.front.image.setData({ radius, winding, points: steps + 1, art: ART });
  }

  destroy() {
    for (const layer of [this.back, this.front]) {
      layer.image.destroy();
      this.scene.textures.remove(layer.texture.key);
    }
    this.head.destroy();
    this.tail.destroy();
  }
}
