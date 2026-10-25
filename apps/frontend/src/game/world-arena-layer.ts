import * as Phaser from 'phaser';
import { worldArenaView } from './world-combat-visuals';
import { createArenaScene, type WorldArenaSource } from './arena-scene';
import type { MatchRules } from '@arena/shared-types';

/** Render the actual arena actors, skill VFX and audio over the exploration canvas. */
export class WorldArenaLayer {
  readonly canvas = document.createElement('canvas');
  private game: Phaser.Game;
  readonly view: ReturnType<typeof worldArenaView>;
  ready = false;
  error = '';

  constructor(arena: MatchRules['arena'], source: WorldArenaSource) {
    this.view = worldArenaView(source().snapshot?.arenaDefinition);
    this.canvas.dataset.testid = 'world-arena-layer';
    this.game = new Phaser.Game({
      type: Phaser.CANVAS,
      canvas: this.canvas,
      parent: document.createElement('div'),
      width: this.view.width,
      height: this.view.height,
      transparent: true,
      banner: false,
      audio: { noAudio: true },
      input: { keyboard: false, mouse: false, touch: false, gamepad: false },
      scene: createArenaScene(
        arena,
        () => {
          this.ready = true;
        },
        (message) => {
          this.error = message;
        },
        source,
        this.view,
      ),
    });
  }

  destroy() {
    this.ready = false;
    this.game.destroy(true);
  }
}
