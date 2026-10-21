import * as Phaser from 'phaser';
import { RUINS_ART, RUINS_FOREGROUND } from '@arena/game-data';
import type { ArenaDefinition } from '@arena/shared-types';

/** Preserve the user's artwork; only its rendering order changes around actors. */
export function drawRuins(scene: Phaser.Scene, arena: ArenaDefinition) {
  const scale = arena.width / RUINS_ART.width;
  scene.add.image(0, 0, 'arena-background').setOrigin(0).setScale(scale).setDepth(-8);
  for (const part of RUINS_FOREGROUND) {
    const left = Math.min(...part.points.map(([x]) => x));
    const top = Math.min(...part.points.map(([, y]) => y));
    const right = Math.max(...part.points.map(([x]) => x));
    const bottom = Math.max(...part.points.map(([, y]) => y));
    // These texture frames reference the original PNG, without resampling or new art.
    const texture = scene.textures.get('arena-background');
    if (!texture.has(part.id)) texture.add(part.id, 0, left, top, right - left, bottom - top);
    const outline = scene.add.graphics().setVisible(false);
    outline.fillStyle(0xffffff).fillPoints(
      part.points.map(([x, y]) => new Phaser.Geom.Point(x * scale, y * scale)),
      true,
    );
    const mask = outline.createGeometryMask();
    scene.add
      .image(left * scale, top * scale, 'arena-background', part.id)
      .setOrigin(0)
      .setScale(scale)
      .setDepth(10 + (part.baseY * scale - 300) / 300)
      .setMask(mask);
    scene.events.once('shutdown', () => mask.destroy());
  }
}
