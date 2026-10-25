import type { ArenaDefinition, BattleSnapshot, Fighter } from '@arena/shared-types';
import { fighterDefinition, SKILL_BY_ID } from '@arena/game-data';
import {
  terrainContact,
  terrainHeight,
  terrainWalkable,
  terrainReachable,
  type TerrainPoint,
} from './terrain';

export function terrainSight(arena: ArenaDefinition, a: TerrainPoint, b: TerrainPoint) {
  return (
    terrainContact(
      arena,
      { ...a, y: (a.y ?? terrainHeight(arena, a)) + 28 },
      { ...b, y: (b.y ?? terrainHeight(arena, b)) + 28 },
    ) === 1
  );
}

/** Score nearby cover, firing lanes and reachable high ground; stable between reactions. */
export function tacticalPosition(
  arena: ArenaDefinition,
  f: Fighter,
  target: Fighter,
  state: BattleSnapshot,
): TerrainPoint | null {
  const def = fighterDefinition(f);
  const danger =
    Boolean(target.cast && SKILL_BY_ID[target.cast.skillId].behavior === 'projectile') ||
    state.projectiles.some(
      (p) => p.team !== f.team && Math.hypot(p.x - f.x, (p.depth ?? 0) - f.depth) < 300,
    );
  // Leave cover regularly to re-engage instead of hiding until the match times out.
  const cover = (danger || f.hp < def.hp * 0.3) && state.elapsed % 4 < 2;
  const candidates: TerrainPoint[] = [{ x: f.x, depth: f.depth }];
  for (const o of arena.obstacles ?? []) {
    candidates.push({ x: o.x, depth: o.depth });
    const dx = o.x - target.x,
      dz = o.depth - target.depth,
      length = Math.hypot(dx, dz) || 1;
    const distance = Math.max(o.width, o.length) / 2 + def.collision.width / 2 + 20;
    candidates.push({
      x: o.x + (dx / length) * distance,
      depth: o.depth + (dz / length) * distance,
    });
  }
  for (const radius of [96, 192])
    for (let i = 0; i < 8; i++)
      candidates.push({
        x: f.x + Math.cos((i * Math.PI) / 4) * radius,
        depth: f.depth + Math.sin((i * Math.PI) / 4) * radius,
      });
  const currentSight = terrainSight(arena, f, target);
  const score = (p: TerrainPoint) => {
    if (
      !terrainWalkable(arena, p, arena.surface ? 4 : def.collision.width / 2) ||
      !terrainReachable(arena, f, p, arena.surface ? 4 : def.collision.width / 2)
    )
      return -Infinity;
    const height = terrainHeight(arena, p);
    const visible = terrainSight(arena, { ...p, y: height }, target);
    if (p !== candidates[0] && !cover && currentSight && height <= (f.groundHeight ?? 0) + 32)
      return -Infinity;
    const distance = Math.hypot(p.x - target.x, p.depth - target.depth);
    const travel = Math.hypot(p.x - f.x, p.depth - f.depth);
    const heightFit =
      def.ai.preferredDistance < 120
        ? -Math.abs(height - (target.groundHeight ?? 0))
        : Math.min(80, height - (target.groundHeight ?? 0)) * 0.3;
    return (
      (cover ? (visible ? -140 : 130) : visible ? 65 : -110) +
      heightFit -
      Math.abs(distance - def.ai.preferredDistance) * 0.45 -
      travel * 0.18 -
      Math.abs(height - (f.groundHeight ?? 0)) * 0.15
    );
  };
  const current = score(candidates[0]);
  let best = candidates[0],
    value = current;
  for (const p of candidates.slice(1)) {
    const next = score(p);
    if (next > value) {
      best = p;
      value = next;
    }
  }
  return value > current + 22 && Math.hypot(best.x - f.x, best.depth - f.depth) > 24 ? best : null;
}
