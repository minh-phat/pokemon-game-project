import { terrainContact, terrainMove, terrainWaypoint } from './terrain';
export * from './terrain';
import {
  RulesSchema,
  BASIC_GUARD_REDUCTION,
  STAMINA_RULES,
  ManualBattleCommandSchema,
  validateTeam,
  type AIAction,
  type BattleConfig,
  type BattleBeam,
  type BattleEvent,
  type BattleResult,
  type BattleSnapshot,
  type Fighter,
  type SkillDefinition,
  type SpeciesId,
  type AnimationName,
} from '@arena/shared-types';
import { ARENAS, DIFFICULTY, POKEMON, SKILL_BY_ID } from '@arena/game-data';
import { decideAction, decideManualAction } from '@arena/game-ai';
import {
  calculateDamage,
  fighterBox,
  meleeBox,
  overlaps,
  seededRandom,
  staminaSpeedMultiplier,
} from './geometry';
export * from './geometry';
export const FIXED_DELTA = 1 / 60;
const GRAVITY = 1050;

export class BattleEngine {
  readonly config: BattleConfig;
  state: BattleSnapshot;
  private rng: () => number;
  private accumulator = 0;
  private eventId = 0;
  private projectileId = 0;
  private terrainOrigins = new Map<string, { x: number; depth: number }>();
  private get arena() {
    return ARENAS.find((a) => a.id === this.state.rules.arena)!;
  }
  private constrain(f: Fighter) {
    const origin = this.terrainOrigins.get(f.id);
    if (origin && this.arena.obstacles)
      Object.assign(f, terrainMove(this.arena, origin, f, POKEMON[f.species].collision.width / 2));
  }
  private groundHazardId = 0;
  private selections = new Map<string, SpeciesId[]>();
  private manualMovement = new Map<
    string,
    { direction: number; depthDirection: number; until: number }
  >();
  constructor(
    config: BattleConfig,
    readonly seed: number,
  ) {
    if (config.players.length !== 2 || config.players[0] === config.players[1])
      throw new Error('Two distinct players are required');
    this.config = { ...config, rules: RulesSchema.parse(config.rules) };
    this.rng = seededRandom(seed);
    this.state = this.emptyState();
    config.teams?.forEach((team, i) => this.submitTeamSelection(config.players[i], team));
  }
  private emptyState(): BattleSnapshot {
    return {
      seed: this.seed,
      tick: 0,
      elapsed: 0,
      phase: 'selection',
      manualTeams: [false, false],
      controlledFighterIds: [null, null],
      rules: this.config.rules,
      fighters: [],
      projectiles: [],
      beams: [],
      groundHazards: [],
      events: [],
      result: null,
    };
  }
  submitTeamSelection(playerId: string, team: SpeciesId[]) {
    if (this.state.phase !== 'selection') throw new Error('Selection is closed');
    if (!this.config.players.includes(playerId)) throw new Error('Unknown player');
    this.selections.set(playerId, validateTeam(team, this.config.rules));
  }
  startBattle() {
    if (this.state.phase !== 'selection') throw new Error('Battle already started');
    if (this.selections.size !== 2) throw new Error('Both teams must be selected');
    this.config.players.forEach((playerId, team) =>
      this.selections.get(playerId)!.forEach((species, slot) => {
        const def = POKEMON[species],
          active = slot < this.config.rules.activeSize;
        this.state.fighters.push({
          id: `${team}-${slot}`,
          playerId,
          team: team as 0 | 1,
          species,
          slot,
          hp: def.hp,
          energy: def.energy,
          stamina: def.maxStamina,
          maxStamina: def.maxStamina,
          sprinting: false,
          x: this.arena.obstacles
            ? this.arena.spawns[team]
            : team === 0
              ? 190 + slot * 65
              : 1010 - slot * 65,
          y: 0,
          depth:
            (this.arena.spawnDepth ?? -100) +
            (slot - (this.config.rules.activeSize - 1) / 2) * (this.arena.spawnSpacing ?? 65),
          vDepth: 0,
          moveDepth: 0,
          aimX: team === 0 ? 1 : -1,
          aimDepth: 0,
          vx: 0,
          vy: 0,
          facing: team === 0 ? 1 : -1,
          active,
          state: active ? 'FindTarget' : 'Idle',
          animation: 'idle',
          animationTime: 0,
          cooldowns: {},
          dodgeCooldown: 0.4,
          invulnerable: active ? 0.5 : 0,
          actionTime: 0,
          thinkIn: 0.15 + this.rng() * 0.2,
          cast: null,
          effects: [],
          targetId: null,
          guarded: false,
          crouched: false,
          moveIntent: 0,
          swapCooldown: 10,
          damageDealt: 0,
        });
      }),
    );
    this.state.phase = 'battle';
    this.ensureControlledFighters();
    this.state.fighters
      .filter((f) => f.active)
      .forEach((f) => this.event('deploy', f, `${POKEMON[f.species].name} enters the arena`));
  }
  updateBattle(delta: number) {
    if (!Number.isFinite(delta) || delta < 0 || delta > 0.25)
      throw new Error('Use a delta between 0 and 0.25 seconds');
    this.accumulator += delta;
    while (this.accumulator + 1e-9 >= FIXED_DELTA) {
      this.accumulator -= FIXED_DELTA;
      if (this.state.phase === 'battle') this.tick();
    }
  }
  getBattleSnapshot(): BattleSnapshot {
    return structuredClone(this.state);
  }
  setManualMode(playerId: string, enabled: boolean): boolean {
    const team = this.config.players.indexOf(playerId);
    if (team < 0 || this.state.phase !== 'battle') return false;
    this.state.manualTeams[team] = enabled;
    for (const f of this.state.fighters.filter((v) => v.team === team))
      this.manualMovement.delete(f.id);
    this.ensureControlledFighters();
    for (const f of this.state.fighters.filter((v) => v.team === team)) {
      f.moveIntent = 0;
      f.moveDepth = 0;
      f.sprinting = false;
      this.setGuard(f, false);
      f.thinkIn = 0;
    }
    return true;
  }
  selectControlledFighter(playerId: string, fighterId: unknown): boolean {
    const team = this.config.players.indexOf(playerId);
    if (
      team < 0 ||
      this.state.phase !== 'battle' ||
      !this.state.manualTeams[team] ||
      typeof fighterId !== 'string'
    )
      return false;
    const next = this.state.fighters.find((f) => f.id === fighterId);
    if (!next || next.team !== team || !next.active || next.hp <= 0) return false;
    if (this.state.controlledFighterIds[team] === fighterId) return true;
    const previous = this.state.fighters.find(
      (f) => f.id === this.state.controlledFighterIds[team],
    );
    if (previous) {
      this.manualMovement.delete(previous.id);
      this.setGuard(previous, false);
      previous.thinkIn = 0;
    }
    this.state.controlledFighterIds[team] = fighterId;
    this.setGuard(next, false);
    next.thinkIn = 0;
    return true;
  }
  private ensureControlledFighters() {
    for (const team of [0, 1] as const) {
      const selected = this.state.fighters.find(
        (f) => f.id === this.state.controlledFighterIds[team],
      );
      if (selected?.active && selected.hp > 0) continue;
      this.state.controlledFighterIds[team] =
        this.state.fighters.find((f) => f.team === team && f.active && f.hp > 0)?.id ?? null;
    }
  }
  private isManuallyControlled(f: Fighter) {
    return this.state.manualTeams[f.team] && this.state.controlledFighterIds[f.team] === f.id;
  }
  command(playerId: string, value: unknown): boolean {
    const parsed = ManualBattleCommandSchema.safeParse(value);
    if (!parsed.success || this.state.phase !== 'battle') return false;
    const team = this.config.players.indexOf(playerId);
    if (team < 0 || !this.state.manualTeams[team]) return false;
    const command = parsed.data;
    const f = this.state.fighters.find((v) => v.id === command.fighterId);
    if (!f || f.team !== team || !f.active || f.hp <= 0 || !this.isManuallyControlled(f))
      return false;
    if (command.type === 'move') {
      const length = Math.max(1, Math.hypot(command.direction, command.depthDirection));
      const direction = command.direction / length;
      const depthDirection = command.depthDirection / length;
      if (Math.hypot(direction, depthDirection) < 0.08) {
        this.manualMovement.delete(f.id);
        f.moveIntent = 0;
        f.moveDepth = 0;
      } else {
        this.manualMovement.set(f.id, {
          direction,
          depthDirection,
          until: this.state.elapsed + 0.3,
        });
        this.setGuard(f, false);
        f.moveIntent = direction;
        f.moveDepth = depthDirection;
        f.sprinting = false;
        f.state = 'Chase';
      }
      return true;
    }
    if (command.type === 'target') {
      const target = this.state.fighters.find((v) => v.id === command.targetId);
      if (!target || target.team === team || !target.active || target.hp <= 0) return false;
      f.targetId = target.id;
      return true;
    }
    if (command.type === 'guard') return this.setGuard(f, command.active);
    if (command.type === 'dodge') {
      const x = command.mode === 'dash' ? (command.direction ?? f.facing) : f.facing;
      const depth = command.mode === 'dash' ? (command.depthDirection ?? 0) : 0;
      const length = Math.hypot(x, depth);
      return this.beginDodge(
        f,
        command.mode,
        length > 0 ? x / length : f.facing,
        length > 0 ? depth / length : 0,
      );
    }
    if (f.effects.some((e) => e.kind === 'stun') || f.cast || f.actionTime > 0) return false;
    return this.beginSkill(f, command.skillId);
  }
  determineWinner(): BattleResult | null {
    if (this.state.result) return this.state.result;
    const rosters = [0, 1].map((team) => this.state.fighters.filter((f) => f.team === team));
    if (!rosters[0].length || !rosters[1].length) return null;
    const survivors = rosters.map((fs) => fs.filter((f) => f.hp > 0).length);
    const scores = rosters.map((fs) =>
      fs.reduce((sum, f) => sum + Math.max(0, f.hp) / POKEMON[f.species].hp, 0),
    ) as [number, number];
    if (survivors[0] === 0 || survivors[1] === 0)
      return {
        winner: survivors[0] === survivors[1] ? 'draw' : survivors[0] > 0 ? 0 : 1,
        reason: 'elimination',
        scores,
      };
    if (this.config.rules.duration > 0 && this.state.elapsed + 1e-6 >= this.config.rules.duration) {
      const difference = scores[0] - scores[1];
      return {
        winner:
          Math.abs(difference) > 0.0001
            ? difference > 0
              ? 0
              : 1
            : survivors[0] === survivors[1]
              ? 'draw'
              : survivors[0] > survivors[1]
                ? 0
                : 1,
        reason: 'time',
        scores,
      };
    }
    return null;
  }
  forfeit(team: 0 | 1) {
    if (this.state.phase === 'finished') return;
    this.state.result = { winner: team === 0 ? 1 : 0, reason: 'disconnect', scores: [0, 0] };
    this.state.phase = 'finished';
  }
  resetBattle() {
    this.state = this.emptyState();
    this.rng = seededRandom(this.seed);
    this.accumulator = 0;
    this.eventId = 0;
    this.projectileId = 0;
    this.groundHazardId = 0;
  }
  private animate(f: Fighter, animation: AnimationName) {
    if (f.animation !== animation) {
      f.animation = animation;
      f.animationTime = 0;
    }
  }
  private event(
    kind: BattleEvent['kind'],
    f: Fighter,
    text: string,
    extra: Partial<BattleEvent> = {},
  ) {
    this.state.events.push({
      id: ++this.eventId,
      tick: this.state.tick,
      kind,
      fighterId: f.id,
      text,
      x: f.x,
      y: f.y,
      depth: f.depth,
      ...extra,
    });
    if (this.state.events.length > 100) this.state.events.shift();
  }
  private tick() {
    const dt = FIXED_DELTA;
    this.state.tick++;
    this.state.elapsed = this.state.tick * dt;
    this.ensureControlledFighters();
    for (const f of this.state.fighters) {
      f.animationTime += dt;
      if (f.hp <= 0) continue;
      for (const key of Object.keys(f.cooldowns)) {
        f.cooldowns[key] = Math.max(0, f.cooldowns[key] - dt);
      }
      f.dodgeCooldown = Math.max(0, f.dodgeCooldown - dt);
      f.invulnerable = Math.max(0, f.invulnerable - dt);
      f.adaptiveCharge = Math.max(0, (f.adaptiveCharge ?? 0) - dt);
      f.dodgeWindow = Math.max(0, (f.dodgeWindow ?? 0) - dt);
      f.swapCooldown = Math.max(0, f.swapCooldown - dt);
      f.energy = Math.min(POKEMON[f.species].energy, f.energy + dt * (f.active ? 6.5 : 9));
      if (!f.active) {
        this.staminaTick(f, dt, false);
        continue;
      }
      this.terrainOrigins.set(f.id, { x: f.x, depth: f.depth });
      this.statusTick(f, dt);
      if (f.hp <= 0) continue;
      const stunned = f.effects.some((e) => e.kind === 'stun');
      f.actionTime = Math.max(0, f.actionTime - dt);
      if (f.actionTime === 0) {
        f.crouched = false;
      }
      const enemies = this.state.fighters.filter((v) => v.team !== f.team && v.hp > 0 && v.active);
      const target =
        (this.isManuallyControlled(f) && enemies.find((v) => v.id === f.targetId)) ||
        enemies.sort(
          (a, b) =>
            Math.hypot(a.x - f.x, a.depth - f.depth) - Math.hypot(b.x - f.x, b.depth - f.depth),
        )[0];
      f.targetId = target?.id ?? null;
      if (
        target &&
        f.actionTime === 0 &&
        (!f.cast || SKILL_BY_ID[f.cast.skillId].channel || SKILL_BY_ID[f.cast.skillId].beam)
      ) {
        const distance = Math.hypot(target.x - f.x, target.depth - f.depth) || 1;
        const angle = Math.atan2(target.depth - f.depth, target.x - f.x);
        if (f.cast) {
          const current = Math.atan2(f.aimDepth, f.aimX);
          const difference = Math.atan2(Math.sin(angle - current), Math.cos(angle - current));
          const turn = Math.max(-7.5 * dt, Math.min(7.5 * dt, difference));
          f.aimX = Math.cos(current + turn);
          f.aimDepth = Math.sin(current + turn);
        } else {
          f.aimX = (target.x - f.x) / distance;
          f.aimDepth = (target.depth - f.depth) / distance;
        }
        if (Math.abs(f.aimX) > 0.01) f.facing = f.aimX >= 0 ? 1 : -1;
      }
      if (stunned) {
        f.guarded = false;
        f.sprinting = false;
        f.cast = null;
        f.moveIntent = 0;
        f.moveDepth = 0;
        f.state = 'Stunned';
        this.animate(f, 'hit');
      } else if (f.cast) this.castTick(f, dt);
      else if (f.actionTime === 0 && (!this.isManuallyControlled(f) || !f.guarded)) {
        f.thinkIn -= dt;
        if (f.thinkIn <= 0) {
          const difficulty = this.config.aiTeams?.includes(f.team)
            ? this.config.rules.difficulty
            : 'normal';
          const movement = this.isManuallyControlled(f) ? this.manualMovement.get(f.id) : undefined;
          if (movement && movement.until > this.state.elapsed)
            this.act(f, {
              type: 'move',
              direction: movement.direction,
              depthDirection: movement.depthDirection,
              state: 'Chase',
            });
          else {
            if (movement) this.manualMovement.delete(f.id);
            this.act(
              f,
              this.isManuallyControlled(f)
                ? decideManualAction(f, this.state)
                : decideAction(f, this.state, this.rng, difficulty),
            );
          }
          f.thinkIn = DIFFICULTY[difficulty].reaction * (0.8 + this.rng() * 0.4);
        }
      }
      this.constrain(f);
      const beforeX = f.x,
        beforeDepth = f.depth;
      this.move(f, dt, stunned);
      this.constrain(f);
      this.staminaTick(f, dt, Math.hypot(f.x - beforeX, f.depth - beforeDepth) > 0.001 || f.y > 0);

      this.trySwitch(f);
    }
    this.resolveBodies();
    for (const f of this.state.fighters) if (f.active) this.constrain(f);
    this.beamTick();
    this.groundHazardTick(dt);
    this.projectileTick(dt);
    this.deployReserves();
    this.ensureControlledFighters();
    const result = this.determineWinner();
    if (result) {
      this.state.result = result;
      this.state.phase = 'finished';
      this.state.projectiles = [];
      this.state.beams = [];
      this.state.groundHazards = [];
      for (const f of this.state.fighters)
        if (f.hp > 0 && f.active) {
          f.cast = null;
          f.guarded = false;
          f.sprinting = false;
          f.vx = 0;
          f.vDepth = 0;
          f.state = 'Idle';
          this.animate(f, result.winner === f.team ? 'victory' : 'idle');
        }
    }
  }
  private staminaTick(f: Fighter, dt: number, moving: boolean) {
    const fast =
      f.sprinting ||
      (f.state === 'Dodge' && f.actionTime > 0) ||
      f.y > 0 ||
      (f.cast && SKILL_BY_ID[f.cast.skillId].movement);
    const rate = f.guarded
      ? -STAMINA_RULES.guardDrain
      : !moving
        ? STAMINA_RULES.idleRecovery
        : fast
          ? STAMINA_RULES.sprintRecovery
          : STAMINA_RULES.moveRecovery;
    f.stamina = Math.max(0, Math.min(f.maxStamina, f.stamina + rate * dt));
  }
  /** Basic defense drains stamina while held, with no timer or cooldown. */
  setGuard(f: Fighter, active: boolean): boolean {
    if (!active) {
      if (f.guarded) {
        f.guarded = false;
        f.state = 'Idle';
        this.animate(f, 'idle');
        if (this.isManuallyControlled(f)) f.thinkIn = 0;
      }
      return true;
    }
    if (
      this.state.phase !== 'battle' ||
      !f.active ||
      f.hp <= 0 ||
      f.cast ||
      f.actionTime > 0 ||
      f.y > 0 ||
      f.effects.some((e) => e.kind === 'stun')
    )
      return false;
    if (!f.guarded)
      this.event('guard', f, `${POKEMON[f.species].name} guards · 20% damage reduction`);
    f.guarded = true;
    f.sprinting = false;
    f.crouched = false;
    f.moveIntent = 0;
    f.moveDepth = 0;
    f.vx = 0;
    f.vDepth = 0;
    f.state = 'Guard';
    this.animate(f, 'guard');
    return true;
  }
  private act(f: Fighter, action: AIAction) {
    const target = this.state.fighters.find((t) => t.id === f.targetId && t.active && t.hp > 0);
    if (
      !this.isManuallyControlled(f) &&
      target &&
      this.arena.obstacles &&
      terrainContact(this.arena, f, target, POKEMON[f.species].collision.width / 2) < 1
    ) {
      const waypoint = terrainWaypoint(
        this.arena,
        f,
        target,
        POKEMON[f.species].collision.width / 2,
      );
      const dx = waypoint.x - f.x,
        dz = waypoint.depth - f.depth,
        length = Math.hypot(dx, dz) || 1;
      action = {
        type: 'move',
        direction: dx / length,
        depthDirection: dz / length,
        state: 'Chase',
      };
    }
    // Keep the old action compatible without charging the dodge cooldown.
    if (action.type === 'guard' || (action.type === 'dodge' && action.mode === 'guard')) {
      this.setGuard(f, true);
      return;
    }
    if (action.type === 'wait') return;

    if (action.type === 'move') {
      this.setGuard(f, false);
      const length = Math.max(1, Math.hypot(action.direction, action.depthDirection ?? 0));
      f.moveIntent = action.direction / length;
      f.moveDepth = (action.depthDirection ?? 0) / length;
      f.sprinting =
        Boolean(action.sprint) && f.stamina >= f.maxStamina * STAMINA_RULES.lowThreshold;
      f.state = action.state;
    }
    if (action.type === 'skill') this.beginSkill(f, action.skillId, this.isManuallyControlled(f));
    if (action.type === 'dodge' && action.mode !== 'guard')
      this.beginDodge(f, action.mode, action.direction, action.depthDirection);
  }
  beginDodge(
    f: Fighter,
    mode: 'dash' | 'jump' | 'crouch',
    direction: number,
    depthDirection = 0,
  ): boolean {
    if (
      this.state.phase !== 'battle' ||
      !f.active ||
      f.hp <= 0 ||
      (f.cast && (!this.isManuallyControlled(f) || !f.cast.autoBasic)) ||
      f.actionTime > 0 ||
      f.effects.some((e) => e.kind === 'stun') ||
      (!this.isManuallyControlled(f) && f.dodgeCooldown > 0) ||
      f.y > 1 ||
      f.stamina < STAMINA_RULES.dodgeCost
    )
      return false;
    f.cast = null;
    if (f.species === 'eevee') {
      f.dodgeOriginX = f.x;
      f.dodgeOriginDepth = f.depth;
      f.dodgeWindow = mode === 'dash' ? 0.25 : mode === 'jump' ? 0.4 : 0.48;
      f.dodgeEarned = false;
    }
    f.stamina -= STAMINA_RULES.dodgeCost;
    f.sprinting = false;
    this.setGuard(f, false);
    const def = POKEMON[f.species];
    const speed = def.speed * staminaSpeedMultiplier(f);
    f.moveIntent = 0;
    f.moveDepth = 0;
    f.vDepth = depthDirection * speed * (mode === 'dash' ? 2.8 : mode === 'jump' ? 1 : 0);
    f.dodgeCooldown = this.isManuallyControlled(f) ? 0 : def.dodgeCooldown;
    if (mode === 'jump') {
      f.vy = def.jumpStrength;
      f.vx = direction * speed;
      f.state = 'Jump';
      f.actionTime = 0.32;
      this.animate(f, 'jump');
    } else if (mode === 'crouch') {
      f.crouched = true;
      f.vx = f.species === 'squirtle' ? f.facing * speed * 0.7 : 0;
      f.actionTime = 0.48;
      f.state = 'Dodge';
      this.animate(f, 'crouch');
    } else {
      f.vx = direction * speed * 2.8;
      f.actionTime = 0.25;
      f.invulnerable = 0.13;
      f.state = 'Dodge';
      this.animate(f, Math.sign(direction) === f.facing ? 'dash' : 'backstep');
    }
    this.event(
      'dodge',
      f,
      `${POKEMON[f.species].name} ${mode === 'jump' ? 'jumps' : mode === 'crouch' ? 'ducks' : 'dashes'}`,
    );
    f.thinkIn = 0.03; // Counterattack promptly after the defense ends.
    return true;
  }
  beginSkill(f: Fighter, skillId: string, autoBasic = false): boolean {
    const def = POKEMON[f.species],
      s = def.skills.find((s) => s.id === skillId);
    if (
      !s ||
      f.hp <= 0 ||
      !f.active ||
      f.cast ||
      f.actionTime > 0 ||
      f.effects.some((e) => e.kind === 'stun') ||
      f.energy < s.energy ||
      f.cooldowns[s.id] > 0
    )
      return false;
    const bindTarget =
      s.id === 'cursed-scroll-bind'
        ? this.state.fighters
            .filter((v) => v.team !== f.team && v.active && v.hp > 0)
            .sort(
              (a, b) =>
                (a.id === f.targetId ? -1 : b.id === f.targetId ? 1 : 0) ||
                Math.hypot(a.x - f.x, a.depth - f.depth) - Math.hypot(b.x - f.x, b.depth - f.depth),
            )[0]
        : undefined;
    this.setGuard(f, false);
    f.sprinting = false;
    f.energy -= s.energy;
    f.cooldowns[s.id] = s.cooldown;
    const target = this.state.fighters
      .filter((v) => v.active && v.hp > 0 && v.team !== f.team)
      .sort(
        (a, b) =>
          Math.hypot(a.x - f.x, a.depth - f.depth) - Math.hypot(b.x - f.x, b.depth - f.depth),
      )[0];
    const chosenTarget = bindTarget ?? target;
    const bindDistance = chosenTarget
      ? Math.hypot(chosenTarget.x - f.x, chosenTarget.depth - f.depth)
      : 0;
    const bindDirectionX =
      chosenTarget && bindDistance > 0 ? (chosenTarget.x - f.x) / bindDistance : f.aimX;
    const bindDirectionDepth =
      chosenTarget && bindDistance > 0 ? (chosenTarget.depth - f.depth) / bindDistance : f.aimDepth;
    const bindTravel = chosenTarget ? Math.min(s.range, Math.max(0, bindDistance - 43)) : s.range;
    f.cast = {
      skillId,
      elapsed: 0,
      fired: 0,
      hitIds: [],
      targetId: bindTarget?.id ?? f.targetId ?? target?.id,
      originX: f.x,
      originDepth: f.depth,
      ...(s.id === 'cursed-scroll-bind' && {
        bindEligible:
          !!chosenTarget &&
          bindDistance <= s.range &&
          POKEMON[chosenTarget.species].collision.width <= 90 &&
          POKEMON[chosenTarget.species].collision.height <= 90,
      }),
      ...(autoBasic && { autoBasic: true }),
      lockX: s.id === 'cursed-scroll-bind' ? f.x + bindDirectionX * bindTravel : target?.x,
      lockDepth:
        s.id === 'cursed-scroll-bind' ? f.depth + bindDirectionDepth * bindTravel : target?.depth,
    };
    if (s.id === 'shadow-step') f.dodgeEarned = false;
    f.moveIntent = 0;
    f.moveDepth = 0;
    f.vx *= 0.25;
    f.vDepth *= 0.25;
    f.state = s.behavior === 'melee' ? 'Attack' : 'CastSkill';
    this.animate(f, s.animation);
    this.event('skill', f, s.name, { element: s.element });
    return true;
  }
  private castTick(f: Fighter, dt: number) {
    const cast = f.cast!,
      s = SKILL_BY_ID[cast.skillId];
    cast.elapsed += dt;
    if (f.species === 'eevee' && this.eeveeCastTick(f, cast, s)) return;
    if (s.id === 'cursed-scroll-bind') {
      this.cursedScrollBindTick(f, cast, s, dt);
      return;
    }
    s.events.forEach((event, index) => {
      if (cast.elapsed + 1e-9 >= event.at && !(cast.fired & (1 << index))) {
        cast.fired |= 1 << index;
        if (event.kind === 'projectile') {
          const glyphSpread = s.id === 'ember-glyph' ? [-0.16, 0, 0.16] : [0];
          for (const [shot, offset] of glyphSpread.entries()) {
            const aim = Math.atan2(f.aimDepth, f.aimX);
            const angle = aim + offset;
            const forward = shot === 1 && s.id === 'ember-glyph' ? 14 : 0;
            const side = s.id === 'ember-glyph' ? (shot - 1) * 10 : 0;
            const x = f.x + f.aimX * (32 + forward) - f.aimDepth * side;
            const depth = f.depth + f.aimDepth * (32 + forward) + f.aimX * side;
            this.state.projectiles.push({
              id: `p${++this.projectileId}`,
              ownerId: f.id,
              team: f.team,
              skillId: s.id,
              x,
              previousX: x,
              y: f.y + s.hitbox.altitude,
              vx: Math.cos(angle) * s.projectileSpeed,
              depth,
              previousDepth: depth,
              vDepth: Math.sin(angle) * s.projectileSpeed,
              width: s.hitbox.width,
              height: s.hitbox.height,
              life: s.range / s.projectileSpeed,
              targetId: s.homing ? cast.targetId : undefined,
              age: 0,
            });
          }
        }
        if (event.kind === 'buff')
          f.effects.push(...s.effects.map((e) => ({ ...e, sourceId: f.id })));
      }
    });
    if (s.channel) {
      // A channel samples the cone at a fixed cadence, so targets can enter or leave it.
      while (
        (cast.channelTicks ?? 0) * s.channel.interval < s.active - 1e-9 &&
        cast.elapsed + 1e-9 >= s.startup + (cast.channelTicks ?? 0) * s.channel.interval
      ) {
        cast.channelTicks = (cast.channelTicks ?? 0) + 1;
        for (const target of this.state.fighters)
          if (
            target.active &&
            target.hp > 0 &&
            target.team !== f.team &&
            this.coneHits(f, target, s)
          )
            this.hit(f, target, s);
      }
    }
    // Ordinary melee active windows hit each target once.
    const hitEvents = s.events.filter((e) => e.kind === 'hit');
    if (
      !s.channel &&
      hitEvents.some((e) => cast.elapsed >= e.at && cast.elapsed <= e.at + s.active)
    ) {
      for (const target of this.state.fighters) {
        if (
          !target.active ||
          target.hp <= 0 ||
          target.team === f.team ||
          cast.hitIds.includes(target.id)
        )
          continue;
        if (this.meleeHits(f, target, s)) {
          cast.hitIds.push(target.id);
          this.hit(f, target, s);
        } else if (
          (target.dodgeWindow ?? 0) > 0 &&
          target.dodgeOriginX !== undefined &&
          this.meleeHits(
            f,
            {
              ...target,
              x: target.dodgeOriginX,
              depth: target.dodgeOriginDepth ?? target.depth,
              y: 0,
              crouched: false,
            },
            s,
          )
        )
          this.grantAdaptiveDodge(target);
      }
    }
    if (cast.elapsed >= s.startup + s.active + s.recovery) {
      f.cast = null;
      f.state = 'Recover';
      f.thinkIn = 0.06;
    }
  }
  private cursedScrollBindTick(
    f: Fighter,
    cast: NonNullable<Fighter['cast']>,
    s: SkillDefinition,
    dt: number,
  ) {
    const target = this.state.fighters.find((v) => v.id === cast.targetId && v.active && v.hp > 0);
    if (cast.elapsed <= s.startup && !cast.bound) {
      const pursuing = cast.bindEligible && target;
      const destinationX = pursuing ? target.x - f.aimX * 43 : (cast.lockX ?? f.x);
      const destinationDepth = pursuing
        ? target.depth - f.aimDepth * 43
        : (cast.lockDepth ?? f.depth);
      const dx = destinationX - f.x,
        dz = destinationDepth - f.depth;
      const distance = Math.hypot(dx, dz) || 1;
      const travel = Math.min(1700 * dt, distance);
      f.x += (dx / distance) * travel;
      f.depth += (dz / distance) * travel;
      f.aimX = dx / distance;
      f.aimDepth = dz / distance;
      f.facing = f.aimX >= 0 ? 1 : -1;
      f.vx = f.vDepth = 0;
      this.animate(f, 'dash');
    }
    this.constrain(f);
    if (cast.elapsed >= s.startup && !cast.bound && !(cast.fired & 1)) {
      cast.fired |= 1;
      if (
        cast.bindEligible &&
        target &&
        terrainContact(this.arena, f, target) === 1 &&
        target.invulnerable <= 0 &&
        Math.hypot(target.x - f.x, target.depth - f.depth) <= 85 &&
        POKEMON[target.species].collision.width <= 90 &&
        POKEMON[target.species].collision.height <= 90
      ) {
        cast.bound = true;
        target.cast = null;
        target.vx = target.vDepth = 0;
        target.moveIntent = target.moveDepth = 0;
        this.animate(f, 'guard');
        this.animate(target, 'hit');
      }
    }
    if (cast.bound && target && cast.elapsed <= s.startup + s.active + FIXED_DELTA) {
      target.actionTime = Math.max(target.actionTime, 2 * FIXED_DELTA);
      target.vx = target.vDepth = 0;
      f.vx = f.vDepth = 0;
      for (let pulse = 0; pulse < 3; pulse++) {
        const mask = 1 << (pulse + 1);
        if (cast.elapsed + 1e-9 >= s.startup + pulse + 1 && !(cast.fired & mask)) {
          cast.fired |= mask;
          this.hit(f, target, s, 10);
        }
      }
    }
    if (cast.elapsed >= s.startup + (cast.bound ? s.active : 0) + s.recovery) {
      f.cast = null;
      f.state = 'Recover';
      f.thinkIn = 0.06;
    }
  }
  private eeveeCastTick(f: Fighter, cast: NonNullable<Fighter['cast']>, s: SkillDefinition) {
    if (s.id === 'shadow-step') {
      const target = this.state.fighters.find(
        (v) => v.id === cast.targetId && v.active && v.hp > 0,
      );
      if (cast.elapsed >= s.startup && cast.elapsed < s.startup + 1) {
        const p = Math.min(1, (cast.elapsed - s.startup) / 1);
        const fromX = cast.originX ?? f.x,
          fromDepth = cast.originDepth ?? f.depth;
        const sign = Math.sign((target?.x ?? fromX + f.facing) - fromX) || f.facing;
        const desiredX = target ? target.x + sign * 48 : fromX + f.aimX * 220;
        const desiredDepth = target ? target.depth : fromDepth + f.aimDepth * 220;
        const length = Math.hypot(desiredX - fromX, desiredDepth - fromDepth) || 1;
        const travel = Math.min(1, s.range / length);
        const endX = fromX + (desiredX - fromX) * travel;
        const endDepth = fromDepth + (desiredDepth - fromDepth) * travel;
        const curve = Math.sin(Math.PI * p) * 76 * (f.team === 0 ? 1 : -1);
        f.x = fromX + (endX - fromX) * p;
        f.depth = fromDepth + (endDepth - fromDepth) * p + curve;
        f.vx = f.vDepth = 0;
        f.invulnerable = Math.max(f.invulnerable, 2 * FIXED_DELTA);
        this.animate(f, 'dash');
      }
      if (cast.elapsed >= s.startup + 1 && !(cast.fired & 1)) {
        cast.fired |= 1;
        f.invulnerable = 0;
        if (target && target.y <= 42 && Math.hypot(target.x - f.x, target.depth - f.depth) <= 105) {
          f.aimX = Math.sign(target.x - f.x) || f.facing;
          f.aimDepth = 0;
          this.hit(f, target, s);
        }
        this.animate(f, 'attack');
      }
      if (cast.elapsed >= s.startup + s.active + s.recovery) f.cast = null;
    } else if (s.id === 'counter-pounce') {
      if (cast.counterAt !== undefined) {
        const age = cast.elapsed - cast.counterAt;
        if (age >= 0.55 && !(cast.fired & 1)) {
          cast.fired |= 1;
          const target = this.state.fighters.find(
            (v) => v.id === cast.counterTargetId && v.active && v.hp > 0,
          );
          if (
            target &&
            target.y <= 42 &&
            Math.hypot(target.x - f.x, target.depth - f.depth) <= s.range + 20
          )
            this.hit(f, target, s, 28);
          this.animate(f, 'land');
        }
        if (age >= 0.8) f.cast = null;
      } else if (cast.elapsed >= 3) f.cast = null;
    } else if (s.id === 'starfall-rush') {
      const times = [0.46, 0.7, 0.94, 1.18, 1.56];
      const target = this.state.fighters.find(
        (v) => v.id === cast.targetId && v.active && v.hp > 0,
      );
      for (let i = 0; i < times.length; i++) {
        if (cast.elapsed < times[i] || cast.fired & (1 << i)) continue;
        cast.fired |= 1 << i;
        if (!target) continue;
        const offsets = [-42, 38, -36, 32, -24];
        const depthOffsets = [-35, 38, 34, -32, 0];
        const arena = ARENAS.find((a) => a.id === this.state.rules.arena)!;
        const centerX =
          (cast.lockX ?? target.x) +
          Math.max(-30, Math.min(30, target.x - (cast.lockX ?? target.x)));
        const centerDepth =
          (cast.lockDepth ?? target.depth) +
          Math.max(-30, Math.min(30, target.depth - (cast.lockDepth ?? target.depth)));
        f.x = Math.max(arena.bounds[0], Math.min(arena.bounds[1], centerX + offsets[i]));
        f.depth = Math.max(
          arena.depthBounds[0],
          Math.min(arena.depthBounds[1], centerDepth + depthOffsets[i]),
        );
        if (i === 3) {
          f.y = 82;
          f.vy = 0;
        }
        if (i === 4) {
          f.y = 0;
          f.vy = 0;
        }
        f.vx = f.vDepth = 0;
        f.aimX = Math.sign(target.x - f.x) || f.facing;
        f.aimDepth = 0;
        this.animate(f, i === 4 ? 'land' : 'dash');
        if (target.y <= 42 && Math.hypot(target.x - f.x, target.depth - f.depth) <= 80)
          this.hit(
            f,
            target,
            {
              ...s,
              name: i === 4 ? 'Starfall Rush · finale' : s.name,
              knockback: i === 4 ? 220 : 0,
            },
            i === 4 ? 18 : 8,
          );
      }
      if (cast.elapsed >= s.startup + s.active + s.recovery) f.cast = null;
    } else return false;
    return true;
  }
  private beamTick() {
    const beams: BattleBeam[] = [];
    for (const f of this.state.fighters) {
      if (!f.active || f.hp <= 0 || !f.cast) continue;
      const skill = SKILL_BY_ID[f.cast.skillId];
      if (
        !skill.beam ||
        f.cast.elapsed < skill.startup ||
        f.cast.elapsed > skill.startup + skill.active + FIXED_DELTA
      )
        continue;
      const length = Math.hypot(f.aimX, f.aimDepth) || 1;
      const dx = f.aimX / length,
        dz = f.aimDepth / length;
      const startX = f.x + dx * 34,
        startDepth = f.depth + dz * 34;
      if (terrainContact(this.arena, f, { x: startX, depth: startDepth }, skill.beam.width / 2) < 1)
        continue;
      beams.push({
        ownerId: f.id,
        team: f.team,
        skillId: skill.id,
        startX,
        startDepth,
        endX: startX + dx * skill.range,
        endDepth: startDepth + dz * skill.range,
        width: skill.beam.width,
      });
    }
    for (const beam of beams) {
      const owner = this.state.fighters.find((f) => f.id === beam.ownerId)!;
      const skill = SKILL_BY_ID[beam.skillId];
      const dx = (beam.endX - beam.startX) / skill.range,
        dz = (beam.endDepth - beam.startDepth) / skill.range;
      let nearest =
        skill.range *
        terrainContact(
          this.arena,
          { x: beam.startX, depth: beam.startDepth },
          { x: beam.endX, depth: beam.endDepth },
          beam.width / 2,
        );
      for (const target of this.state.fighters) {
        if (
          !target.active ||
          target.hp <= 0 ||
          target.team === beam.team ||
          !this.beamHits(owner, target, beam, skill)
        )
          continue;
        const forward = (target.x - beam.startX) * dx + (target.depth - beam.startDepth) * dz;
        nearest = Math.min(
          nearest,
          Math.max(0, forward - POKEMON[target.species].collision.width * 0.35),
        );
      }
      beam.endX = beam.startX + dx * nearest;
      beam.endDepth = beam.startDepth + dz * nearest;
    }
    // All beam types share this collision path; a future laser only needs a beam definition.
    for (let i = 0; i < beams.length; i++) {
      for (let j = i + 1; j < beams.length; j++) {
        const a = beams[i],
          b = beams[j];
        if (a.team === b.team) continue;
        const sa = SKILL_BY_ID[a.skillId],
          sb = SKILL_BY_ID[b.skillId];
        const aLength = Math.hypot(a.endX - a.startX, a.endDepth - a.startDepth);
        const bLength = Math.hypot(b.endX - b.startX, b.endDepth - b.startDepth);
        if (aLength < 1 || bLength < 1) continue;
        const ax = (a.endX - a.startX) / aLength,
          az = (a.endDepth - a.startDepth) / aLength;
        const bx = (b.endX - b.startX) / bLength,
          bz = (b.endDepth - b.startDepth) / bLength;
        if (ax * bx + az * bz > -0.85) continue;
        const betweenX = b.startX - a.startX,
          betweenDepth = b.startDepth - a.startDepth;
        const separation = betweenX * ax + betweenDepth * az;
        if (
          separation <= 0 ||
          Math.abs(betweenX * az - betweenDepth * ax) > (a.width + b.width) / 2 + 15
        )
          continue;
        const lower = Math.max(0, separation - bLength),
          upper = Math.min(aLength, separation);
        if (lower > upper) continue;
        const powerA = sa.beam!.clashPower,
          powerB = sb.beam!.clashPower;
        const distance = Math.max(
          lower,
          Math.min(
            upper,
            (separation * powerA) / (powerA + powerB) + Math.sin(this.state.elapsed * 9) * 7,
          ),
        );
        const pointX = a.startX + ax * distance,
          pointDepth = a.startDepth + az * distance;
        if (
          distance < aLength &&
          Math.hypot(pointX - b.startX, pointDepth - b.startDepth) < bLength
        ) {
          a.endX = b.endX = pointX;
          a.endDepth = b.endDepth = pointDepth;
          a.clashWith = b.ownerId;
          b.clashWith = a.ownerId;
        }
      }
    }
    this.state.beams = beams;
    for (const beam of beams) {
      const owner = this.state.fighters.find((f) => f.id === beam.ownerId)!;
      const cast = owner.cast;
      if (!cast) continue;
      const skill = SKILL_BY_ID[beam.skillId];
      const interval = skill.beam!.interval;
      while (
        (cast.channelTicks ?? 0) * interval < skill.active - 1e-9 &&
        cast.elapsed + 1e-9 >= skill.startup + 0.2 + (cast.channelTicks ?? 0) * interval
      ) {
        cast.channelTicks = (cast.channelTicks ?? 0) + 1;
        for (const target of this.state.fighters)
          if (
            target.active &&
            target.hp > 0 &&
            target.team !== beam.team &&
            this.beamHits(owner, target, beam, skill)
          )
            this.hit(owner, target, skill);
      }
    }
  }
  private beamHits(owner: Fighter, target: Fighter, beam: BattleBeam, skill: SkillDefinition) {
    const dx = beam.endX - beam.startX,
      dz = beam.endDepth - beam.startDepth;
    const length = Math.hypot(dx, dz) || 1;
    const toX = target.x - beam.startX,
      toDepth = target.depth - beam.startDepth;
    const forward = (toX * dx + toDepth * dz) / length;
    const side = Math.abs(toX * dz - toDepth * dx) / length;
    const radius = POKEMON[target.species].collision.width / 2;
    const targetBox = fighterBox(target);
    const bottom = owner.y + skill.hitbox.altitude - skill.hitbox.height / 2;
    const top = owner.y + skill.hitbox.altitude + skill.hitbox.height / 2;
    return (
      forward >= -radius &&
      forward <= length + radius &&
      side <= beam.width / 2 + radius &&
      targetBox.top >= bottom &&
      targetBox.bottom <= top
    );
  }
  private meleeHits(f: Fighter, target: Fighter, skill: SkillDefinition) {
    const dx = target.x - f.x,
      dz = target.depth - f.depth;
    const forward = dx * f.aimX + dz * f.aimDepth;
    const side = Math.abs(dx * f.aimDepth - dz * f.aimX);
    const radius = POKEMON[target.species].collision.width / 2;
    return (
      forward >= -radius &&
      forward <= skill.range + radius &&
      side <= skill.hitbox.width / 2 + radius &&
      overlaps(meleeBox({ ...f, x: 0, facing: 1 }, skill), fighterBox({ ...target, x: forward }))
    );
  }
  private coneHits(f: Fighter, target: Fighter, skill: SkillDefinition) {
    const dx = target.x - f.x,
      dz = target.depth - f.depth;
    const forward = dx * f.aimX + dz * f.aimDepth;
    const side = Math.abs(dx * f.aimDepth - dz * f.aimX);
    const radius = POKEMON[target.species].collision.width / 2;
    return (
      forward >= -radius &&
      forward <= skill.range + radius &&
      side <=
        Math.max(0, forward) * Math.tan((skill.channel!.halfAngle * Math.PI) / 180) + radius &&
      overlaps(meleeBox({ ...f, x: 0, facing: 1 }, skill), fighterBox({ ...target, x: forward }))
    );
  }
  private move(f: Fighter, dt: number, stunned: boolean) {
    const def = POKEMON[f.species],
      arena = ARENAS.find((a) => a.id === this.state.rules.arena)!;
    const staminaScale = staminaSpeedMultiplier(f);
    if (f.stamina < f.maxStamina * STAMINA_RULES.lowThreshold) f.sprinting = false;
    const speed = (f.sprinting ? def.sprintSpeed : def.speed) * staminaScale;
    const movement = f.cast ? SKILL_BY_ID[f.cast.skillId].movement : undefined;
    if (movement && f.cast!.elapsed <= movement.duration && !stunned) {
      f.vx = f.aimX * movement.speed * staminaScale;
      f.vDepth = f.aimDepth * movement.speed * staminaScale;
    } else if (f.actionTime === 0 || stunned) {
      const slow = f.effects
        .filter((e) => e.kind === 'slow')
        .reduce((v, e) => Math.min(v, 1 - e.strength), 1);
      const desired = (f.cast || stunned ? 0 : f.moveIntent) * speed * slow;
      const step = def.acceleration * dt;
      const desiredDepth = (f.cast || stunned ? 0 : f.moveDepth) * speed * slow;
      const dx = desired - f.vx,
        dz = desiredDepth - f.vDepth;
      const factor = Math.min(1, step / (Math.hypot(dx, dz) || 1));
      f.vx += dx * factor;
      f.vDepth += dz * factor;
    }
    f.depth = Math.max(
      arena.depthBounds[0],
      Math.min(arena.depthBounds[1], f.depth + f.vDepth * dt),
    );
    const oldY = f.y;
    f.x = Math.max(arena.bounds[0], Math.min(arena.bounds[1], f.x + f.vx * dt));
    if (f.y > 0 || f.vy > 0) {
      f.vy -= GRAVITY * dt;
      f.y = Math.max(0, f.y + f.vy * dt);
      if (f.y === 0) {
        f.vy = 0;
        this.animate(f, 'land');
        f.actionTime = Math.max(f.actionTime, 0.09);
      }
    }
    if (!f.cast && f.actionTime === 0 && !stunned) {
      if (f.guarded) this.animate(f, 'guard');
      else if (f.y > 0) this.animate(f, f.vy > 0 ? 'jump' : 'fall');
      else if (oldY === 0) this.animate(f, Math.hypot(f.vx, f.vDepth) > 15 ? 'run' : 'idle');
    }
  }
  private resolveBodies() {
    const fs = this.state.fighters.filter((f) => f.active && f.hp > 0);
    for (let i = 0; i < fs.length; i++)
      for (let j = i + 1; j < fs.length; j++) {
        const a = fs[i],
          b = fs[j];
        if (!overlaps(fighterBox(a), fighterBox(b))) continue;
        const min = (POKEMON[a.species].collision.width + POKEMON[b.species].collision.width) / 2;
        const d = Math.hypot(a.x - b.x, a.depth - b.depth);
        const push = (min - d) * 0.5;
        if (push > 0) {
          const sign = d > 0 ? (a.x - b.x) / d : -1;
          const depthSign = d > 0 ? (a.depth - b.depth) / d : 0;
          const bounds = ARENAS.find((arena) => arena.id === this.state.rules.arena)!.depthBounds;
          a.depth = Math.max(bounds[0], Math.min(bounds[1], a.depth + depthSign * push));
          b.depth = Math.max(bounds[0], Math.min(bounds[1], b.depth - depthSign * push));
          a.x = Math.max(this.arena.bounds[0], Math.min(this.arena.bounds[1], a.x + sign * push));
          b.x = Math.max(this.arena.bounds[0], Math.min(this.arena.bounds[1], b.x - sign * push));
        }
      }
  }
  private projectileTick(dt: number) {
    for (const p of this.state.projectiles) {
      const skill = SKILL_BY_ID[p.skillId];
      if (!(p.age ?? 0)) {
        const origin = this.state.fighters.find((f) => f.id === p.ownerId);
        if (
          origin &&
          terrainContact(
            this.arena,
            origin,
            { x: p.x, depth: p.depth ?? origin.depth },
            p.width / 2,
          ) < 1
        ) {
          p.life = 0;
          continue;
        }
      }
      p.age = (p.age ?? 0) + dt;
      if (skill.homing && p.age <= skill.homing.duration) {
        const target = this.state.fighters.find((f) => f.id === p.targetId && f.active && f.hp > 0);
        if (target) {
          const current = Math.atan2(p.vDepth ?? 0, p.vx);
          const wanted = Math.atan2(target.depth - (p.depth ?? 0), target.x - p.x);
          const difference = Math.atan2(Math.sin(wanted - current), Math.cos(wanted - current));
          const turn = Math.max(
            -skill.homing.turnRate * dt,
            Math.min(skill.homing.turnRate * dt, difference),
          );
          const speed = Math.hypot(p.vx, p.vDepth ?? 0);
          p.vx = Math.cos(current + turn) * speed;
          p.vDepth = Math.sin(current + turn) * speed;
        }
      }
      p.previousDepth = p.depth ?? ownerDepth(this.state, p);
      p.depth = p.previousDepth + (p.vDepth ?? 0) * dt;
      p.previousX = p.x;
      p.x += p.vx * dt;
      p.life -= dt;
      const contact = terrainContact(
        this.arena,
        { x: p.previousX, depth: p.previousDepth },
        { x: p.x, depth: p.depth },
        p.width / 2,
      );
      const blocked = contact < 1;
      if (blocked) {
        p.x = p.previousX + (p.x - p.previousX) * Math.max(0, contact - 0.001);
        p.depth = p.previousDepth + (p.depth - p.previousDepth) * Math.max(0, contact - 0.001);
        p.life = 0;
      }
      const owner = this.state.fighters.find((f) => f.id === p.ownerId)!;
      // Swept horizontal boxes avoid tunnelling even for Solar Beam.
      const box = {
        left: Math.min(p.x, p.previousX) - p.width / 2,
        right: Math.max(p.x, p.previousX) + p.width / 2,
        bottom: p.y - p.height / 2,
        top: p.y + p.height / 2,
      };
      const targets = this.state.fighters
        .filter((f) => f.active && f.hp > 0 && f.team !== p.team)
        .sort((a, b) => Math.abs(a.x - p.previousX) - Math.abs(b.x - p.previousX));
      let landed = false;
      for (const f of targets)
        if (this.projectileCrosses(p, f)) {
          const body = fighterBox(f);
          if (!overlaps(box, body)) {
            if (
              (f.dodgeWindow ?? 0) > 0 &&
              f.dodgeOriginX !== undefined &&
              overlaps(box, fighterBox({ ...f, x: f.dodgeOriginX, y: 0, crouched: false })) &&
              this.projectileCrosses(p, {
                ...f,
                x: f.dodgeOriginX,
                depth: f.dodgeOriginDepth ?? f.depth,
              })
            )
              this.grantAdaptiveDodge(f);
            continue;
          }
          if (f.invulnerable <= 0) {
            this.hit(owner, f, skill, skill.id === 'ember-glyph' ? skill.damage : undefined, {
              x: p.previousX,
              depth: p.previousDepth,
            });
            if (skill.groundHazard) this.createGroundHazard(p, f.x, f.depth);
            p.life = 0;
            landed = true;
            break;
          } else this.grantAdaptiveDodge(f);
        }
      if (
        !blocked &&
        !landed &&
        skill.groundHazard &&
        (p.life <= 0 || p.x <= -50 || p.x >= this.arena.width + 50)
      )
        this.createGroundHazard(p, p.x, p.depth ?? owner.depth);
      if (p.life > 0 && skill.electricAura) {
        const { reach, damageScale } = skill.electricAura;
        const aura = { ...p, width: p.width + reach * 2, height: p.height + reach * 2 };
        for (const f of targets) {
          if (f.invulnerable > 0 || p.auraHitIds?.includes(f.id)) continue;
          const body = fighterBox(f);
          if (body.bottom > p.y + aura.height / 2 || body.top < p.y - aura.height / 2) continue;
          if (!this.projectileCrosses(aura, f)) continue;
          this.hit(owner, f, {
            ...skill,
            name: `${skill.name} · arc`,
            damage: skill.damage * damageScale,
          });
          (p.auraHitIds ??= []).push(f.id);
        }
      }
    }
    this.state.projectiles = this.state.projectiles.filter(
      (p) => p.life > 0 && p.x > -50 && p.x < this.arena.width + 50,
    );
  }
  private createGroundHazard(p: BattleSnapshot['projectiles'][number], x: number, depth: number) {
    const config = SKILL_BY_ID[p.skillId].groundHazard;
    if (!config) return;
    const arena = ARENAS.find((value) => value.id === this.state.rules.arena)!;
    this.state.groundHazards.push({
      id: `h${++this.groundHazardId}`,
      ownerId: p.ownerId,
      team: p.team,
      skillId: p.skillId,
      x: Math.max(arena.bounds[0], Math.min(arena.bounds[1], x)),
      depth: Math.max(arena.depthBounds[0], Math.min(arena.depthBounds[1], depth)),
      radius: config.radius,
      duration: config.duration,
      pulse: 0,
    });
  }
  private groundHazardTick(dt: number) {
    for (const hazard of this.state.groundHazards) {
      const skill = SKILL_BY_ID[hazard.skillId];
      const config = skill.groundHazard!;
      hazard.duration = Math.max(0, hazard.duration - dt);
      hazard.pulse += dt;
      if (hazard.pulse + 1e-9 < config.interval) continue;
      hazard.pulse -= config.interval;
      const source = this.state.fighters.find((fighter) => fighter.id === hazard.ownerId);
      if (!source) continue;
      for (const target of this.state.fighters) {
        if (
          !target.active ||
          target.hp <= 0 ||
          target.team === hazard.team ||
          target.invulnerable > 0 ||
          target.y > 8 ||
          terrainContact(this.arena, hazard, target) < 1 ||
          Math.hypot(target.x - hazard.x, target.depth - hazard.depth) >
            hazard.radius + POKEMON[target.species].collision.width * 0.25
        )
          continue;
        const shield = target.effects
          .filter((effect) => effect.kind === 'shield')
          .reduce((value, effect) => Math.max(value, effect.strength), 0);
        const guard = Math.max(target.guarded ? BASIC_GUARD_REDUCTION : 0, shield);
        const damage = Math.min(
          target.hp,
          calculateDamage(
            config.damage,
            POKEMON[source.species].attack,
            POKEMON[target.species].defense,
            skill.element,
            POKEMON[target.species].element,
            this.state.rules.elements,
            guard,
          ),
        );
        target.hp -= damage;
        source.damageDealt += damage;
        this.event('damage', target, `${skill.name} · pool`, {
          value: damage,
          targetId: source.id,
          element: skill.element,
        });
        this.faint(target);
      }
    }
    this.state.groundHazards = this.state.groundHazards.filter((hazard) => hazard.duration > 0);
  }
  private projectileCrosses(p: BattleSnapshot['projectiles'][number], f: Fighter) {
    // Slab intersection of the swept projectile with the ground-plane hitbox.
    let enter = 0,
      exit = 1;
    const radius = POKEMON[f.species].collision.width / 2;
    for (const [start, end, center, half] of [
      [p.previousX, p.x, f.x, radius + p.width / 2],
      [p.previousDepth!, p.depth!, f.depth, radius + p.height / 2],
    ]) {
      const delta = end - start;
      if (Math.abs(delta) < 1e-8) {
        if (Math.abs(center - start) > half) return false;
      } else {
        const a = (center - half - start) / delta,
          b = (center + half - start) / delta;
        enter = Math.max(enter, Math.min(a, b));
        exit = Math.min(exit, Math.max(a, b));
      }
    }
    return enter <= exit;
  }
  private grantAdaptiveDodge(f: Fighter) {
    if (
      f.species === 'eevee' &&
      !f.dodgeEarned &&
      ((f.dodgeWindow ?? 0) > 0 || f.cast?.skillId === 'shadow-step')
    ) {
      f.adaptiveCharge = 2;
      f.dodgeEarned = true;
    }
  }
  private hit(
    source: Fighter,
    target: Fighter,
    s: SkillDefinition,
    flatDamage?: number,
    origin?: { x: number; depth: number },
  ) {
    this.constrain(source);
    if (terrainContact(this.arena, origin ?? source, target) < 1) return;
    if (target.invulnerable > 0) {
      this.grantAdaptiveDodge(target);
      return;
    }
    const counter =
      target.species === 'eevee' &&
      target.cast?.skillId === 'counter-pounce' &&
      target.cast.elapsed <= 3 &&
      target.cast.counterAt === undefined;
    const shield = target.effects
      .filter((e) => e.kind === 'shield')
      .reduce((v, e) => Math.max(v, e.strength), 0);
    const guard = Math.max(counter ? 0.7 : target.guarded ? BASIC_GUARD_REDUCTION : 0, shield);
    const amount = Math.round(
      (flatDamage === undefined
        ? calculateDamage(
            s.damage,
            POKEMON[source.species].attack,
            POKEMON[target.species].defense,
            s.element,
            POKEMON[target.species].element,
            this.state.rules.elements,
            guard,
          )
        : flatDamage * (1 - guard)) *
        (source.species === 'eevee' && (source.adaptiveCharge ?? 0) > 0 ? 1.15 : 1),
    );
    if (source.species === 'eevee' && (source.adaptiveCharge ?? 0) > 0) source.adaptiveCharge = 0;
    target.hp = Math.max(0, target.hp - amount);
    source.damageDealt += amount;
    const distance = Math.hypot(target.x - source.x, target.depth - source.depth) || 1;
    if (!counter) {
      target.vx = ((target.x - source.x) / distance) * s.knockback * (1 - guard);
      target.vDepth = ((target.depth - source.depth) / distance) * s.knockback * (1 - guard);
    }
    if (!target.guarded && !counter) target.actionTime = Math.max(target.actionTime, 0.14);
    target.sprinting = false;
    if (counter) {
      target.cast!.counterAt = target.cast!.elapsed;
      target.cast!.counterTargetId = source.id;
      target.vy = 320;
      this.animate(target, 'jump');
    } else if (
      !(
        target.species === 'eevee' &&
        target.cast?.skillId === 'starfall-rush' &&
        target.cast.elapsed >= 0.46
      )
    )
      target.cast = null;
    target.moveIntent = 0;
    target.moveDepth = 0;
    target.state = counter ? 'Attack' : target.guarded ? 'Guard' : 'Recover';
    if (!counter)
      this.animate(target, target.guarded ? 'guard' : s.knockback > 170 ? 'knockback' : 'hit');
    if (s.behavior !== 'buff')
      for (const effect of s.effects) {
        target.effects = target.effects.filter((e) => e.kind !== effect.kind);
        target.effects.push({ ...effect, sourceId: source.id, pulse: 0 });
      }
    if (target.effects.some((e) => e.kind === 'stun')) {
      target.guarded = false;
      target.state = 'Stunned';
      this.animate(target, 'hit');
    }
    this.event('damage', target, `${s.name}${guard ? ' · guarded' : ''}`, {
      value: amount,
      targetId: source.id,
      element: s.element,
    });
    this.faint(target);
  }
  private statusTick(f: Fighter, dt: number) {
    for (const effect of f.effects) {
      effect.duration -= dt;
      if (effect.kind === 'burn' || effect.kind === 'leech') {
        effect.pulse = (effect.pulse ?? 0) + dt;
        if (effect.pulse >= 1) {
          effect.pulse -= 1;
          const damage = Math.min(
            f.hp,
            effect.strength * (f.guarded ? 1 - BASIC_GUARD_REDUCTION : 1),
          );
          f.hp -= damage;
          this.event('damage', f, effect.kind, {
            value: damage,
            element: effect.kind === 'burn' ? 'fire' : 'grass',
          });
          const source = this.state.fighters.find((s) => s.id === effect.sourceId);
          if (source) {
            source.damageDealt += damage;
            if (effect.kind === 'leech' && source.hp > 0) {
              const heal = Math.min(damage, POKEMON[source.species].hp - source.hp);
              source.hp += heal;
              if (heal > 0) this.event('heal', source, 'Leech Seed', { value: heal });
            }
          }
        }
      }
    }
    f.effects = f.effects.filter((e) => e.duration > 0);
    this.faint(f);
  }
  private faint(f: Fighter) {
    if (f.hp <= 0 && f.state !== 'Fainted') {
      f.hp = 0;
      f.guarded = false;
      f.sprinting = false;
      f.active = false;
      f.cast = null;
      f.vx = 0;
      f.vy = 0;
      f.vDepth = 0;
      f.moveDepth = 0;
      f.state = 'Fainted';
      this.animate(f, 'faint');
      this.event('faint', f, `${POKEMON[f.species].name} fainted`);
    }
  }
  private deploy(f: Fighter) {
    const team = f.team;
    const allies = this.state.fighters.filter((v) => v.active && v.team === team);
    f.guarded = false;
    f.sprinting = false;
    f.active = true;
    f.x = this.arena.obstacles
      ? this.arena.spawns[team]
      : team === 0
        ? 100 + allies.length * 65
        : 1100 - allies.length * 65;
    f.depth =
      (this.arena.spawnDepth ?? -100) +
      (allies.length - (this.config.rules.activeSize - 1) / 2) * (this.arena.spawnSpacing ?? 65);
    f.moveIntent = 0;
    f.moveDepth = 0;
    f.vDepth = 0;
    f.y = 0;
    f.vy = 0;
    f.vx = 0;
    f.cast = null;
    f.effects = [];
    f.invulnerable = 0.7;
    f.state = 'FindTarget';
    f.thinkIn = 0.15;
    f.swapCooldown = 12;
    this.animate(f, 'idle');
    this.event('deploy', f, `${POKEMON[f.species].name} enters the arena`);
  }
  private deployReserves() {
    for (const team of [0, 1]) {
      let active = this.state.fighters.filter(
        (f) => f.team === team && f.hp > 0 && f.active,
      ).length;
      for (const f of this.state.fighters.filter((f) => f.team === team && f.hp > 0 && !f.active))
        if (active < this.state.rules.activeSize) {
          this.deploy(f);
          active++;
        }
    }
  }
  private trySwitch(f: Fighter) {
    if (
      !this.state.rules.switching ||
      f.swapCooldown > 0 ||
      f.effects.some((effect) => effect.kind === 'stun') ||
      f.cast ||
      f.hp / POKEMON[f.species].hp > 0.22
    )
      return;
    const reserve = this.state.fighters.find(
      (v) => v.team === f.team && !v.active && v.hp / POKEMON[v.species].hp > 0.5,
    );
    if (reserve) {
      f.guarded = false;
      f.sprinting = false;
      f.active = false;
      f.cast = null;
      f.swapCooldown = 15;
      this.event('switch', f, `${POKEMON[f.species].name} switches out`);
      this.deploy(reserve);
    }
  }
}
export function initializeBattle(config: BattleConfig, seed = 1) {
  return new BattleEngine(config, seed);
}

function ownerDepth(state: BattleSnapshot, p: BattleSnapshot['projectiles'][number]) {
  return state.fighters.find((f) => f.id === p.ownerId)?.depth ?? -100;
}
