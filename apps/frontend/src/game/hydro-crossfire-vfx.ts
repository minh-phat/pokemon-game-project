import * as Phaser from 'phaser';
import { HYDRO_CROSSFIRE, hydroCrossfirePoint, hydroCrossfireRotation } from '@arena/game-data';

const TAU = Math.PI * 2;

/** Keep the stream centre on the combat curve; only its surface ripples. */
export function drawHydroCrossfire(
  g: Phaser.GameObjects.Graphics,
  elapsed: number,
  startup: number,
  active: number,
  recovery: number,
  reduced: boolean,
  drawStreams = true,
) {
  const age = Math.max(0, elapsed - startup);
  const charge = Math.min(1, elapsed / startup);
  const release = Phaser.Math.Clamp((age - active) / recovery, 0, 1);
  const motion = reduced ? 0 : age;
  g.clear();

  // A soft contact shadow and a shallow pool anchor the shell to the arena.
  g.fillStyle(0x071e29, 0.28).fillEllipse(0, 16, 82, 31);
  g.fillStyle(0x179cb5, 0.12 * (1 - release)).fillEllipse(0, 12, 104, 49);
  if (elapsed < startup) {
    const radius = 68 - charge * 30;
    g.lineStyle(2, 0x8ee9ef, charge * 0.7).strokeEllipse(0, 5, radius * 2, radius);
    for (let i = 0; i < 8; i++) {
      const a = (i * TAU) / 8 + charge * 0.5;
      g.fillStyle(0xdcffff, charge * 0.8).fillCircle(
        Math.cos(a) * radius,
        Math.sin(a) * radius * 0.5,
        1.5 + charge,
      );
    }
  }

  const extent = Math.min(HYDRO_CROSSFIRE.range, age * HYDRO_CROSSFIRE.speed);
  // The final water travels outward during recovery, exposing the shell again.
  const inner = Math.max(28, release * (HYDRO_CROSSFIRE.range + 32));
  if (drawStreams && extent > inner && release < 1) {
    const opacity = 1 - release;
    for (let arm = 0; arm < 4; arm++) {
      const count = reduced ? 28 : 48;
      const samples = Array.from({ length: count + 1 }, (_, i) => {
        const radius = inner + ((extent - inner) * i) / count;
        const p = hydroCrossfirePoint(age, arm, radius);
        const a = Math.atan2(p.depth, p.x);
        const ripple = reduced ? 0 : Math.sin(radius * 0.13 - motion * 25 + arm) * 0.6;
        return {
          x: p.x - Math.sin(a) * ripple,
          y: p.depth + Math.cos(a) * ripple,
          radius,
        };
      });
      // Continuous ribbons avoid the seams of overlapping transparent line segments.
      const widthAt = (radius: number) =>
        17 *
        (1 - 0.38 * (radius / HYDRO_CROSSFIRE.range)) *
        (reduced ? 1 : 1 + 0.1 * Math.sin(radius * 0.09 - motion * 19));
      for (const layer of [
        { scale: 1.4, color: 0x075f91, alpha: 0.16, lift: 3 },
        { scale: 1, color: 0x168fb9, alpha: 0.67, lift: 0 },
        { scale: 0.55, color: 0x64d8e7, alpha: 0.7, lift: -2 },
      ]) {
        const edges = [-1, 1].map((side) =>
          samples.map((p, i) => {
            const before = samples[Math.max(0, i - 1)];
            const after = samples[Math.min(count, i + 1)];
            const angle = Math.atan2(after.y - before.y, after.x - before.x);
            const half = widthAt(p.radius) * layer.scale * 0.5 * side;
            return new Phaser.Math.Vector2(
              p.x - Math.sin(angle) * half,
              p.y + Math.cos(angle) * half + layer.lift,
            );
          }),
        );
        g.fillStyle(layer.color, layer.alpha * opacity).fillPoints(
          [...edges[0], ...edges[1].reverse()],
          true,
        );
      }
      // Broken foam streaks travel outward along the surface.
      for (let i = 0; i < count; i++) {
        const p = samples[i];
        const next = samples[i + 1];
        const taper = 1 - 0.38 * (p.radius / HYDRO_CROSSFIRE.range);
        const width = widthAt(p.radius);
        const flow = (((p.radius - motion * 180 + arm * 13) % 47) + 47) % 47;
        if (flow < 17) {
          g.lineStyle(2.5 * taper, 0xe1ffff, 0.85 * opacity).lineBetween(
            p.x,
            p.y - width * 0.25,
            next.x,
            next.y - width * 0.25,
          );
        }
        if (!reduced && flow < 7 && i % 2 === 0) {
          const a = Math.atan2(p.y, p.x);
          const side = Math.sin(i * 4 + arm) > 0 ? 1 : -1;
          const offset = width * 0.5 + 3 + Math.sin(motion * 15 + i) * 2;
          g.fillStyle(0xb8f5f5, 0.65 * opacity).fillCircle(
            p.x - Math.sin(a) * offset * side,
            p.y + Math.cos(a) * offset * side,
            1.2 + (i % 3) * 0.5,
          );
        }
      }
      const tip = samples[count];
      const angle = Math.atan2(tip.y, tip.x);
      for (let j = 0; j < (reduced ? 3 : 7); j++) {
        const flight = (motion * 3.7 + j / 7) % 1;
        const spread = (j - 3) * 0.16;
        const distance = 3 + flight * 23;
        g.fillStyle(j % 2 ? 0xc6ffff : 0x55cddd, (1 - flight) * 0.65 * opacity).fillEllipse(
          tip.x + Math.cos(angle + spread) * distance,
          tip.y + Math.sin(angle + spread) * distance,
          3 + (1 - flight) * 3,
          2 + (1 - flight) * 2,
        );
      }
    }
  }

  // Brief expanding water rings give the release a distinct beat.
  if (age > 0 && age < 0.32) {
    const burst = age / 0.32;
    g.lineStyle(4 * (1 - burst) + 1, 0xc1ffff, (1 - burst) * 0.65).strokeEllipse(
      0,
      8,
      70 + burst * 110,
      38 + burst * 60,
    );
  }

  const rotation = hydroCrossfireRotation(motion);
  const shellPoint = (angle: number, radius: number, lift = 0) =>
    new Phaser.Math.Vector2(
      Math.cos(angle + rotation) * radius,
      Math.sin(angle + rotation) * radius * 0.73 - lift,
    );
  const rim = Array.from({ length: 49 }, (_, i) => shellPoint((i * TAU) / 48, 33));
  g.fillStyle(0x092b3c).fillEllipse(0, 6, 68, 49);
  g.fillStyle(0x397887).fillPoints(rim, true);
  g.lineStyle(5, 0xb4d8c5).strokePoints(rim, true);
  g.lineStyle(1.5, 0xf0f1cd, 0.9).strokeEllipse(0, -2, 62, 43);
  const dome = Array.from({ length: 6 }, (_, i) => shellPoint((i * TAU) / 6, 28, 5));
  const plates = Array.from({ length: 6 }, (_, i) => shellPoint((i * TAU) / 6, 15, 8));
  for (let i = 0; i < 6; i++) {
    const next = (i + 1) % 6;
    const light = Math.cos((i * TAU) / 6 + rotation + 2.2);
    g.fillStyle(light > 0.35 ? 0x5b9e9c : light < -0.35 ? 0x20566c : 0x367e88).fillPoints(
      [plates[i], dome[i], dome[next], plates[next]],
      true,
    );
    g.lineStyle(1.8, 0x133e52, 0.85).lineBetween(plates[i].x, plates[i].y, dome[i].x, dome[i].y);
  }
  g.fillStyle(0x579b9c).fillPoints(plates, true);
  g.lineStyle(2, 0x163e50).strokePoints(plates, true);
  g.fillStyle(0xc0eee1, 0.22).fillEllipse(-9, -15, 26, 9);
  if (age > 0 && age < active && !reduced) {
    for (let i = 0; i < 3; i++) {
      const a = rotation * 1.7 + (i * TAU) / 3;
      g.lineStyle(2, 0xa5e9e6, 0.4)
        .beginPath()
        .arc(0, 3, 39 + i * 3, a, a + 0.7)
        .strokePath();
    }
  }
}

export function drawHydroImpact(
  g: Phaser.GameObjects.Graphics,
  progress: number,
  reduced: boolean,
) {
  g.clear();
  const fade = 1 - progress;
  g.lineStyle(2, 0xc5ffff, fade * 0.8).strokeEllipse(
    progress * 14,
    0,
    8 + progress * 22,
    20 + progress * 30,
  );
  for (let i = 0; i < (reduced ? 4 : 9); i++) {
    const angle = -1.15 + (i / 8) * 2.3;
    const distance = 5 + progress * (24 + (i % 3) * 10);
    const x = Math.cos(angle) * distance;
    const y = Math.sin(angle) * distance;
    g.lineStyle(2 + fade * 2, i % 2 ? 0xcfffff : 0x60d5e4, fade * 0.85).lineBetween(
      x * 0.65,
      y * 0.65,
      x,
      y,
    );
    g.fillStyle(0xd8ffff, fade * 0.8).fillCircle(x, y, 1 + fade * 1.5);
  }
}
