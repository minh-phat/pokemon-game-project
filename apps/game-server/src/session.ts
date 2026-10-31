import { initializeBattle, type BattleEngine } from '@arena/game-core';
import {
  DEFAULT_RULES,
  PlayerNameSchema,
  RulesSchema,
  validateTeam,
  type LobbySnapshot,
  type MatchRules,
  type OwnedPet,
  type PetProgression,
} from '@arena/shared-types';

/** Transport-independent room policy; persistence can be attached outside this class. */
export class BattleSession {
  lobby: LobbySnapshot;
  engine: BattleEngine | null = null;
  lastActivity = Date.now();
  private operations = new Map<string, { tokens: number; time: number }>();
  private movements = new Map<string, { tokens: number; time: number }>();
  private matchedTeams?: [OwnedPet[], OwnedPet[]];
  private botId?: string;
  constructor(
    code: string,
    rules: unknown = DEFAULT_RULES,
    readonly seed = 1,
  ) {
    this.lobby = {
      code,
      hostId: '',
      rules: RulesSchema.parse(rules),
      players: [],
      phase: 'lobby',
      countdown: 0,
      reconnectSeconds: 30,
    };
  }
  startMatched(
    players: [
      { id: string; name: string; pets: OwnedPet[] },
      { id: string; name: string; pets: OwnedPet[] },
    ],
    bot = false,
  ) {
    this.prepareMatched(players, bot);
    this.startPreparedMatched([players[0].pets, players[1].pets]);
  }
  prepareMatched(
    players: [{ id: string; name: string }, { id: string; name: string }],
    bot = false,
  ) {
    if (bot) this.botId = players[1].id;
    for (const player of players) this.join(player.id, player.name);
  }
  startPreparedMatched(teams: [OwnedPet[], OwnedPet[]]) {
    this.matchedTeams = teams;
    for (const [index, player] of this.lobby.players.entries()) {
      this.select(
        player.id,
        teams[index].map((pet) => pet.species),
      );
      this.ready(player.id, true);
    }
  }
  join(id: string, name: unknown) {
    if (this.lobby.phase !== 'lobby' || this.lobby.players.length >= 2)
      throw new Error('This room is full or already playing');
    const parsedName = PlayerNameSchema.parse(name);
    if (this.lobby.players.some((p) => p.id === id)) throw new Error('Player already joined');
    this.lobby.players.push({
      id,
      name: parsedName,
      team: [],
      ready: false,
      connected: true,
      rematch: false,
    });
    if (!this.lobby.hostId) this.lobby.hostId = id;
    this.lastActivity = Date.now();
  }
  private player(id: string) {
    const p = this.lobby.players.find((p) => p.id === id);
    if (!p) throw new Error('Unknown player');
    return p;
  }
  rateLimit(id: string, now = Date.now()) {
    const p = this.operations.get(id) ?? { tokens: 20, time: now };
    p.tokens = Math.min(20, p.tokens + ((now - p.time) / 1000) * 5);
    p.time = now;
    if (p.tokens < 1) throw new Error('Too many room operations. Try again shortly.');
    p.tokens--;
    this.operations.set(id, p);
    this.lastActivity = now;
  }
  allowMovement(id: string, now = Date.now()) {
    const p = this.movements.get(id) ?? { tokens: 20, time: now };
    p.tokens = Math.min(20, p.tokens + ((now - p.time) / 1000) * 20);
    p.time = now;
    if (p.tokens < 1) {
      this.movements.set(id, p);
      return false;
    }
    p.tokens--;
    this.movements.set(id, p);
    this.lastActivity = now;
    return true;
  }
  rules(id: string, value: unknown) {
    this.player(id);
    if (id !== this.lobby.hostId) throw new Error('Only the host can change rules');
    if (this.lobby.phase !== 'lobby') throw new Error('Rules are locked after ready check');
    this.lobby.rules = RulesSchema.parse(value);
    for (const p of this.lobby.players) {
      p.ready = false;
      p.team = [];
    }
  }
  select(id: string, value: unknown) {
    if (this.lobby.phase !== 'lobby') throw new Error('Team selection is closed');
    const p = this.player(id);
    p.team = validateTeam(value, this.lobby.rules);
    p.ready = false;
  }
  ready(id: string, value: unknown) {
    if (typeof value !== 'boolean') throw new Error('Ready must be a boolean');
    if (this.lobby.phase !== 'lobby') throw new Error('Match is already starting');
    const p = this.player(id);
    if (value) validateTeam(p.team, this.lobby.rules);
    p.ready = value;
    if (
      this.lobby.players.length === 2 &&
      this.lobby.players.every((v) => v.ready && v.connected)
    ) {
      this.lobby.phase = 'countdown';
      this.lobby.countdown = 3;
    }
  }
  manualMode(id: string, value: unknown) {
    this.player(id);
    if (typeof value !== 'boolean' || !this.engine?.setManualMode(id, value))
      throw new Error('Manual mode is unavailable');
  }
  selectFighter(id: string, value: unknown) {
    this.player(id);
    if (!this.engine?.selectControlledFighter(id, value))
      throw new Error('Pokémon selection is unavailable');
  }
  command(id: string, value: unknown) {
    this.player(id);
    if (!this.engine?.command(id, value)) throw new Error('Battle command is unavailable');
  }
  tick(delta: number) {
    if (this.lobby.players.some((p) => !p.connected)) return;
    if (this.lobby.phase === 'countdown') {
      this.lobby.countdown = Math.max(0, this.lobby.countdown - delta);
      if (this.lobby.countdown <= 0) {
        const [a, b] = this.lobby.players;
        this.engine = initializeBattle(
          {
            rules: this.lobby.rules,
            players: [a.id, b.id],
            teams: [a.team, b.team],
            ...(this.matchedTeams
              ? {
                  progressions: this.matchedTeams.map((team) =>
                    team.map(({ level, quality }) => ({ level, quality })),
                  ) as [PetProgression[], PetProgression[]],
                }
              : {}),
            ...(this.botId ? { aiTeams: [1] } : {}),
          },
          this.seed,
        );
        this.engine.startBattle();
        this.engine.setManualMode(a.id, true);
        if (!this.botId) this.engine.setManualMode(b.id, true);
        this.lobby.phase = 'battle';
      }
    }
    if (this.lobby.phase === 'battle' && this.engine) {
      this.engine.updateBattle(delta);
      if (this.engine.state.phase === 'finished') this.lobby.phase = 'finished';
    }
  }
  disconnected(id: string) {
    const p = this.player(id);
    p.connected = false;
    const team = this.lobby.players.indexOf(p);
    if (this.engine?.state.manualTeams[team]) this.engine.setManualMode(id, true);
    this.lastActivity = Date.now();
  }
  reconnected(id: string) {
    this.player(id).connected = true;
    this.lastActivity = Date.now();
  }
  leave(id: string) {
    const index = this.lobby.players.findIndex((p) => p.id === id);
    if (index < 0) return;
    if (this.lobby.phase === 'battle') {
      this.engine?.forfeit(index as 0 | 1);
      this.lobby.phase = 'finished';
      this.lobby.players[index].connected = false;
    } else if (this.lobby.phase === 'finished') {
      this.lobby.players[index].connected = false;
    } else {
      this.lobby.players.splice(index, 1);
      this.lobby.phase = 'lobby';
      this.lobby.countdown = 0;
      this.lobby.hostId = this.lobby.players[0]?.id ?? '';
      this.lobby.players.forEach((p) => {
        p.ready = false;
      });
    }
    this.operations.delete(id);
    this.movements.delete(id);
    this.lastActivity = Date.now();
  }
  rematch(id: string) {
    if (this.lobby.phase !== 'finished') throw new Error('Finish this match first');
    if (this.lobby.players.some((p) => !p.connected))
      throw new Error('Your opponent has left. Create a new room.');
    this.player(id).rematch = true;
    if (this.lobby.players.length === 2 && this.lobby.players.every((p) => p.rematch)) {
      this.lobby.phase = 'lobby';
      this.engine = null;
      for (const p of this.lobby.players) {
        p.ready = false;
        p.rematch = false;
      }
    }
  }
  expired(now = Date.now()) {
    return (
      now - this.lastActivity > (this.lobby.phase === 'battle' ? 60 * 60 * 1000 : 10 * 60 * 1000)
    );
  }
  snapshot() {
    return structuredClone(this.lobby);
  }
}
