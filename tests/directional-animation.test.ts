import { describe, expect, it } from 'vitest';
import sharp from 'sharp';
import {
  ASSETS,
  DIRECTIONS,
  directionFlipped,
  directionRow,
  locomotionFrame,
  movementDirection,
  worldMovementDirection,
} from '@arena/game-data';
import {
  creatureLocomotion,
  fighterDirection,
} from '../apps/frontend/src/game/creature-locomotion';
import type { Fighter, SpeciesId } from '@arena/shared-types';

describe('eight-direction locomotion', () => {
  it('uses all eight screen-space directions, preserving heading at rest and around boundaries', () => {
    for (const [index, direction] of DIRECTIONS.entries()) {
      const angle = (index * Math.PI) / 4;
      expect(movementDirection(Math.cos(angle), Math.sin(angle))).toBe(direction);
      expect(movementDirection(0, 0, direction)).toBe(direction);
    }
    expect(movementDirection(1, Math.tan(Math.PI / 8 + 0.02), 'east')).toBe('east');
    expect(movementDirection(1, Math.tan(Math.PI / 8 + 0.12), 'east')).toBe('southeast');
    expect(movementDirection(NaN, 1, 'south')).toBe('south');
  });

  it('projects world movement before selecting a view', () => {
    expect(worldMovementDirection(-1, -1)).toBe('north');
    expect(worldMovementDirection(1, 1)).toBe('south');
    expect(worldMovementDirection(1, -1)).toBe('east');
    expect(worldMovementDirection(-1, 1)).toBe('west');
    expect(worldMovementDirection(1, 0)).toBe('southeast');
    expect(worldMovementDirection(0, -1)).toBe('northeast');
  });

  it('mirrors only left-facing views and gives every moving direction six distinct frames', () => {
    for (const direction of DIRECTIONS) {
      expect(directionFlipped(direction)).toBe(
        ['west', 'northwest', 'southwest'].includes(direction),
      );
      const frames = Array.from({ length: 6 }, (_, i) =>
        locomotionFrame(direction, true, (i + 0.1) / 10, 10),
      );
      expect(new Set(frames).size).toBe(6);
      expect(frames.every((f) => Math.floor(f / 6) === directionRow(direction))).toBe(true);
      expect(locomotionFrame(direction, true, 99, 10, true)).toBe(directionRow(direction) * 6);
    }
  });

  const fighter = {
    species: 'eevee',
    animation: 'run',
    animationTime: 0,
    cast: null,
    sprinting: false,
    stamina: 100,
    maxStamina: 100,
    vx: 0,
    vDepth: -100,
  } as Fighter;
  it('faces vertical velocity, retains idle/backstep facing and leaves skill animation intact', () => {
    expect(fighterDirection(fighter, 'east')).toBe('north');
    expect(fighterDirection({ ...fighter, animation: 'idle' }, 'south')).toBe('south');
    expect(fighterDirection({ ...fighter, animation: 'backstep' }, 'south')).toBe('south');
    expect(creatureLocomotion({ ...fighter, animation: 'attack' }, 'north', 1, false)).toBeNull();
    expect(
      creatureLocomotion({ ...fighter, cast: {} as Fighter['cast'] }, 'north', 1, false),
    ).toBeNull();
    expect(creatureLocomotion({ ...fighter, animation: 'jump' }, 'north', 1, false)?.frame).toBe(
      14,
    );
    expect(creatureLocomotion({ ...fighter, animation: 'idle' }, 'north', 1, true)).toMatchObject({
      frame: 12,
      scaleY: 1,
    });
    expect(ASSETS.locomotion.pikachu).toBe('/assets/pikachu-directions.png');
    expect(creatureLocomotion({ ...fighter, species: 'pikachu' }, 'north', 1, false)?.frame).toBe(
      14,
    );
    expect(ASSETS.locomotion.bulbasaur).toBe('/assets/bulbasaur-directions.png');
    for (const direction of DIRECTIONS) {
      const bulbasaur = { ...fighter, species: 'bulbasaur' as SpeciesId };
      expect(creatureLocomotion(bulbasaur, direction, 0, false)).toMatchObject({
        frame: directionRow(direction) * 6,
        flipX: directionFlipped(direction),
      });
      expect(
        creatureLocomotion({ ...bulbasaur, animation: 'cast' }, direction, 0, false),
      ).toBeNull();
    }
  });
});

it('direction atlases contain visible, distinct, transparent, unclipped poses and preserve side animations', async () => {
  for (const [species, path] of Object.entries(ASSETS.locomotion)) {
    const width = species === 'runedrake' ? 320 : 160;
    const { data, info } = await sharp(`apps/frontend/public${path}`)
      .raw()
      .toBuffer({ resolveWithObject: true });
    expect([info.width, info.height, info.channels]).toEqual([width * 6, 960, 4]);
    const original = await sharp(`apps/frontend/public${ASSETS.sprites[species as SpeciesId]}`)
      .extract({ left: 0, top: 0, width: width * 6, height: 320 })
      .raw()
      .toBuffer();
    expect(data.subarray(0, original.length).equals(original)).toBe(true);
    for (let row = 2; row < 6; row++) {
      const hashes = new Set<string>();
      for (let col = 0; col < 6; col++) {
        let visible = 0,
          border = 0;
        for (let y = 0; y < 160; y++)
          for (let x = 0; x < width; x++) {
            const alpha = data[((row * 160 + y) * info.width + col * width + x) * 4 + 3];
            if (alpha > 32) {
              visible++;
              if (x === 0 || x === width - 1 || y === 0 || y === 159) border++;
            }
          }
        expect(visible, `${species} row ${row} frame ${col}`).toBeGreaterThan(1000);
        expect(border, `${species} row ${row} frame ${col} clips`).toBe(0);
        const frame = await sharp(data, { raw: info })
          .extract({ left: col * width, top: row * 160, width, height: 160 })
          .png()
          .toBuffer();
        hashes.add(frame.toString('base64'));
      }
      expect(hashes.size).toBe(6);
    }
  }
});
