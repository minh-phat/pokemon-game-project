import type * as Phaser from 'phaser';
import { fighterDefinition } from '@arena/game-data';
import type { Fighter } from '@arena/shared-types';

const KEY = 'roster-status-bars';

/** Shared textures avoid replaying rounded Canvas paths / WebGL geometry per pet. */
export class RosterBars {
  private background: Phaser.GameObjects.Image;
  private hp: Phaser.GameObjects.Image;
  private energy: Phaser.GameObjects.Image;
  private stamina: Phaser.GameObjects.Image;

  constructor(scene: Phaser.Scene, team: number) {
    if (!scene.textures.exists(KEY)) {
      const texture = scene.textures.createCanvas(KEY, 64, 64)!;
      const ctx = texture.context;
      ctx.fillStyle = '#172e2bbf';
      ctx.beginPath();
      ctx.roundRect(0, 0, 62, 7, 3);
      ctx.fill();
      ctx.fillStyle = '#292b24cc';
      ctx.fillRect(1, 14, 60, 3);
      texture.add('background', 0, 0, 0, 62, 17);
      for (const [name, y, height, color] of [
        ['hp-0', 24, 5, '#d5e6a9'],
        ['hp-1', 32, 5, '#f0b0a1'],
        ['energy', 40, 2, '#a1d9e1d9'],
        ['stamina', 44, 3, '#e0be70f2'],
        ['tired', 48, 3, '#ee9777f2'],
      ] as const) {
        ctx.fillStyle = color;
        if (name.startsWith('hp')) {
          ctx.beginPath();
          ctx.roundRect(0, y, 60, height, 2);
          ctx.fill();
        } else ctx.fillRect(0, y, 60, height);
        texture.add(name, 0, 0, y, 60, height);
      }
      texture.refresh();
    }
    const image = (frame: string) => scene.add.image(0, 0, KEY, frame).setOrigin(0).setDepth(15);
    this.background = image('background');
    this.hp = image(`hp-${team}`);
    this.energy = image('energy');
    this.stamina = image('stamina');
  }

  setVisible(visible: boolean) {
    this.background.setVisible(visible);
    this.hp.setVisible(visible);
    this.energy.setVisible(visible);
    this.stamina.setVisible(visible);
  }

  update(f: Fighter, x: number, y: number) {
    const def = fighterDefinition(f);
    const ratio = (value: number, max: number) => Math.max(0, Math.min(1, value / max));
    this.background.setPosition(x - 31, y - 84);
    this.hp.setPosition(x - 30, y - 83).setScale(ratio(f.hp, def.hp), 1);
    this.energy.setPosition(x - 30, y - 74).setScale(ratio(f.energy, def.energy), 1);
    this.stamina
      .setFrame(f.stamina < f.maxStamina * 0.2 ? 'tired' : 'stamina')
      .setPosition(x - 30, y - 70)
      .setScale(ratio(f.stamina, f.maxStamina), 1);
  }
}
