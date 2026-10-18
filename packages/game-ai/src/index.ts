import type { AIAction, BattleSnapshot, Fighter, Projectile } from '@arena/shared-types';
import { DIFFICULTY, EFFECTIVENESS, POKEMON, SKILL_BY_ID } from '@arena/game-data';

/** Predict a projectile crossing a fighter's horizontal hitbox, in seconds. */
export function predictThreat(f: Fighter, p: Projectile, horizon = 0.65): number | null {
  if (p.team === f.team) return null;
  const width = (POKEMON[f.species].collision.width + p.width) / 2;
  const relative = p.vx - f.vx;
  if (Math.abs(relative) < 1) return null;
  const time = (f.x - p.x - Math.sign(relative) * width) / relative;
  const h = POKEMON[f.species].collision.height * (f.crouched ? 0.42 : 1);
  if (time < -0.05 || time > horizon || p.y + p.height / 2 < f.y || p.y - p.height / 2 > f.y + h)
    return null;
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
    (a, b) => Math.abs(a.x - f.x) - Math.abs(b.x - f.x) || a.id.localeCompare(b.id),
  )[0];
  if (!target) return { type: 'move', direction: 0, state: 'FindTarget' };
  const distance = Math.abs(target.x - f.x),
    direction = target.x >= f.x ? 1 : -1;
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
        return { type: 'dodge', mode: 'jump', direction };
      if (threat.p.y - threat.p.height / 2 > def.collision.height * 0.42 + 3)
        return { type: 'dodge', mode: 'crouch', direction: 0 };
    }
    const away = -direction,
      enoughSpace = f.x + away * 100 > 55 && f.x + away * 100 < 1145;
    if (def.ai.guard > 0.6 || !enoughSpace) return { type: 'dodge', mode: 'guard', direction: 0 };
    return { type: 'dodge', mode: 'dash', direction: away };
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
    (v) => v.active && v.hp > 0 && v.team === f.team && v.id !== f.id && Math.abs(v.x - f.x) < 55,
  );
  if (chosen && random() < 0.65 + def.ai.aggression * 0.32 * tuning.aggression)
    return { type: 'skill', skillId: chosen.s.id };
  if (
    (distance < def.ai.preferredDistance * 0.65 || (hpRatio < 0.24 && distance < 160)) &&
    random() < def.ai.retreat &&
    f.x - direction * 60 > 55 &&
    f.x - direction * 60 < 1145
  )
    return { type: 'move', direction: -direction, state: 'Retreat' };
  if (distance > def.ai.preferredDistance || (!available.length && distance > def.attackRange))
    return { type: 'move', direction, state: 'Chase' };
  if (allies.length)
    return {
      type: 'move',
      direction: f.slot % 2 ? direction : -direction,
      state: 'MaintainDistance',
    };
  if (
    f.species === 'charmander' &&
    f.y === 0 &&
    distance > 120 &&
    distance < 280 &&
    random() < 0.13
  )
    return { type: 'dodge', mode: 'jump', direction };
  return {
    type: 'move',
    direction: distance > def.attackRange ? direction * 0.35 : 0,
    state: 'MaintainDistance',
  };
}
