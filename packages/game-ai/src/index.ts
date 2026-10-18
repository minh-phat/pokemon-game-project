import type { AIAction, BattleSnapshot, Fighter, Projectile } from '@arena/shared-types';
import { ARENAS, DIFFICULTY, EFFECTIVENESS, POKEMON, SKILL_BY_ID } from '@arena/game-data';

/** Predict a projectile crossing a fighter on the arena plane, in seconds. */
export function predictThreat(f: Fighter, p: Projectile, horizon = 0.65): number | null {
  if (p.team === f.team) return null;
  const width = (POKEMON[f.species].collision.width + p.width) / 2;
  let enter = 0,
    exit = horizon;
  for (const [offset, velocity, radius] of [
    [p.x - f.x, p.vx - f.vx, width],
    [
      (p.depth ?? f.depth) - f.depth,
      (p.vDepth ?? 0) - f.vDepth,
      (POKEMON[f.species].collision.width + p.height) / 2,
    ],
  ]) {
    if (Math.abs(velocity) < 1) {
      if (Math.abs(offset) > radius) return null;
    } else {
      const a = (-radius - offset) / velocity,
        b = (radius - offset) / velocity;
      enter = Math.max(enter, Math.min(a, b));
      exit = Math.min(exit, Math.max(a, b));
    }
  }
  const time = enter;
  const h = POKEMON[f.species].collision.height * (f.crouched ? 0.42 : 1);
  if (enter > exit || p.y + p.height / 2 < f.y || p.y - p.height / 2 > f.y + h) return null;
  return Math.max(0, time);
}

/** Pure utility/FSM decision layer. Only called after a fighter's reaction delay. */
export function decideAction(
  f: Fighter,
  state: BattleSnapshot,
  random: () => number,
  difficulty: keyof typeof DIFFICULTY = 'normal',
): AIAction {
  if (
    f.hp <= 0 ||
    !f.active ||
    f.effects.some((e) => e.kind === 'stun') ||
    f.cast ||
    f.actionTime > 0
  )
    return { type: 'wait' };
  const def = POKEMON[f.species],
    tuning = DIFFICULTY[difficulty];
  const enemies = state.fighters.filter((v) => v.active && v.hp > 0 && v.team !== f.team);
  const target = enemies.sort(
    (a, b) =>
      Math.hypot(a.x - f.x, a.depth - f.depth) - Math.hypot(b.x - f.x, b.depth - f.depth) ||
      a.id.localeCompare(b.id),
  )[0];
  if (!target) return { type: 'move', direction: 0, state: 'FindTarget' };
  const distance = Math.hypot(target.x - f.x, target.depth - f.depth),
    direction = (target.x - f.x) / (distance || 1),
    depthDirection = (target.depth - f.depth) / (distance || 1);
  const arena = ARENAS.find((a) => a.id === state.rules.arena)!;
  // Hold a route for several reactions instead of picking a noisy direction every tick.
  const phase = state.elapsed + f.slot * 0.71 + f.team * 0.37 + (state.seed % 13) * 0.03;
  const orbitSign = Math.floor(phase / 2.6) % 2 === 0 ? 1 : -1;
  const steer = (
    radial: number,
    lateral: number,
    movementState: 'Chase' | 'Retreat' | 'MaintainDistance',
  ): AIAction => {
    let x = direction * radial - depthDirection * lateral * orbitSign;
    let depth = depthDirection * radial + direction * lateral * orbitSign;
    // Turn back into the playable area before reaching an edge, including during retreat.
    const margin = 48;
    if (f.depth < arena.depthBounds[0] + margin && depth < 0) depth = Math.abs(depth) + 0.45;
    if (f.depth > arena.depthBounds[1] - margin && depth > 0) depth = -Math.abs(depth) - 0.45;
    if (f.x < arena.bounds[0] + margin && x < 0) x = Math.abs(x) + 0.45;
    if (f.x > arena.bounds[1] - margin && x > 0) x = -Math.abs(x) - 0.45;
    const length = Math.hypot(x, depth) || 1;
    return {
      type: 'move',
      direction: x / length,
      depthDirection: depth / length,
      state: movementState,
    };
  };
  const threat = state.projectiles
    .map((p) => ({ p, time: predictThreat(f, p) }))
    .filter((t) => t.time !== null)
    .sort((a, b) => a.time! - b.time!)[0];
  const meleeDanger =
    target.cast &&
    SKILL_BY_ID[target.cast.skillId]?.behavior === 'melee' &&
    distance < SKILL_BY_ID[target.cast.skillId].range + 25;
  if (
    f.dodgeCooldown <= 0 &&
    f.y < 2 &&
    (threat || meleeDanger) &&
    random() < def.ai.dodge * tuning.accuracy
  ) {
    // Jump only when the predicted feet height clears the projectile; crouch only
    // when its lower edge clears the reduced collision box. Reactions can fail.
    if (threat) {
      const t = Math.max(0.04, threat.time! * (0.85 + random() * 0.3));
      const jumpY = def.jumpStrength * t - 0.5 * 1050 * t * t;
      if (threat.p.y + threat.p.height / 2 < jumpY && f.species !== 'squirtle')
        return { type: 'dodge', mode: 'jump', direction, depthDirection };
      if (threat.p.y - threat.p.height / 2 > def.collision.height * 0.42 + 3)
        return { type: 'dodge', mode: 'crouch', direction: 0 };
    }
    const away = -direction,
      enoughSpace = f.x + away * 100 > 55 && f.x + away * 100 < 1145;
    if (def.ai.guard > 0.6 || !enoughSpace) return { type: 'dodge', mode: 'guard', direction: 0 };
    const sidestep = steer(-0.3, 1, 'Retreat');
    if (sidestep.type === 'move')
      return {
        type: 'dodge',
        mode: 'dash',
        direction: sidestep.direction,
        depthDirection: sidestep.depthDirection,
      };
    return { type: 'wait' };
  }
  const hpRatio = f.hp / def.hp;
  const available = def.skills.filter(
    (s) =>
      !f.cooldowns[s.id] &&
      f.energy >= s.energy &&
      distance <= s.range + 10 &&
      distance >= s.usage.minRange &&
      (!s.usage.belowHP || hpRatio < s.usage.belowHP),
  );
  const chosen = available
    .map((s) => ({
      s,
      score:
        s.usage.priority *
          (state.rules.elements
            ? (EFFECTIVENESS[s.element]?.[POKEMON[target.species].element] ?? 1)
            : 1) +
        s.damage / 65 +
        random() * 0.65 +
        (s.behavior === 'buff' && hpRatio < 0.5 ? 0.65 : 0),
    }))
    .sort((a, b) => b.score - a.score)[0];
  const allies = state.fighters.filter(
    (v) =>
      v.active &&
      v.hp > 0 &&
      v.team === f.team &&
      v.id !== f.id &&
      Math.hypot(v.x - f.x, v.depth - f.depth) < 80,
  );
  // Brief, staggered repositioning windows give movement a chance even with skills ready.
  // Keep most of the cycle available for attacks so ranged fighters cannot kite forever.
  if (
    phase % 2.6 < 0.85 &&
    distance < def.ai.preferredDistance + 160 &&
    chosen &&
    chosen.s.behavior !== 'buff'
  )
    return steer(distance < def.ai.preferredDistance * 0.65 ? -0.4 : 0.2, 1, 'MaintainDistance');
  if (chosen && random() < 0.65 + def.ai.aggression * 0.32 * tuning.aggression)
    return { type: 'skill', skillId: chosen.s.id };
  if (
    (distance < def.ai.preferredDistance * 0.65 || (hpRatio < 0.24 && distance < 160)) &&
    random() < def.ai.retreat &&
    f.x - direction * 60 > 55 &&
    f.x - direction * 60 < 1145
  )
    return steer(-1, 0.8, 'Retreat');
  if (distance > def.ai.preferredDistance || (!available.length && distance > def.attackRange))
    return steer(1, distance > 300 ? 0.65 : 0.45, 'Chase');
  if (allies.length) return steer(0.1, 1, 'MaintainDistance');
  if (
    f.species === 'charmander' &&
    f.y === 0 &&
    distance > 120 &&
    distance < 280 &&
    random() < 0.13
  )
    return { type: 'dodge', mode: 'jump', direction, depthDirection };
  return steer(distance > def.attackRange ? 0.45 : 0, 1, 'MaintainDistance');
}
