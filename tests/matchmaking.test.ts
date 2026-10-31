import { describe, expect, it } from 'vitest';
import type { OwnedPet } from '@arena/shared-types';
import {
  MatchmakingQueue,
  pointsAfterMatch,
  rankForPoints,
  strongestPets,
} from '../apps/game-server/src/matchmaking';

const pets = (level = 1): OwnedPet[] =>
  Array.from({ length: 6 }, (_, i) => ({
    id: String(i),
    species: 'pikachu',
    quality: 'C',
    level,
    experience: 0,
    acquiredAt: '2026-01-01T00:00:00.000Z',
  }));
const entry = (
  playerId: string,
  overrides: Partial<Parameters<MatchmakingQueue['enqueue']>[0]> = {},
) => ({
  playerId,
  mode: 'casual' as const,
  size: 3 as const,
  points: 0,
  pets: pets(),
  startedAt: 0,
  ...overrides,
});

describe('matchmaking policy', () => {
  it('selects the strongest owned companions and requires enough distinct pets', () => {
    const roster = pets();
    roster[5] = { ...roster[5], level: 10 };
    expect(strongestPets(roster, 3)[0].pet.id).toBe('5');
    expect(() => strongestPets(roster.slice(0, 2), 3)).toThrow();
    expect(() => strongestPets([...roster, roster[0]], 3)).toThrow();
  });
  it('pairs compatible humans once and chooses a map', () => {
    const queue = new MatchmakingQueue(() => 0.76);
    queue.enqueue(entry('a'));
    queue.enqueue(entry('b'));
    const matches = queue.poll(1);
    expect(matches).toHaveLength(1);
    expect(matches[0].players.map((p) => p?.playerId)).toEqual(['a', 'b']);
    expect(matches[0].arena).toBe('ruins');
    expect(queue.poll(60_000)).toEqual([]);
  });
  it('separates sizes and ranks and waits a minute for fallback', () => {
    const queue = new MatchmakingQueue();
    queue.enqueue(entry('a', { mode: 'ranked' }));
    queue.enqueue(entry('b', { mode: 'ranked', points: 300 }));
    queue.enqueue(entry('c', { mode: 'ranked', size: 6 }));
    expect(queue.poll(59_999)).toEqual([]);
    expect(queue.poll(60_000)).toHaveLength(3);
  });
  it.each([3, 6] as const)('matches ranked players with %i pets regardless of power', (size) => {
    const queue = new MatchmakingQueue();
    queue.enqueue(entry('a', { mode: 'ranked', size, startedAt: 0 }));
    queue.enqueue(entry('b', { mode: 'ranked', size, pets: pets(100), startedAt: 1 }));
    queue.enqueue(entry('c', { mode: 'ranked', size, startedAt: 2 }));
    expect(queue.poll(3)[0].players.map((player) => player?.playerId)).toEqual(['a', 'b']);
  });
  it('still requires similar power in casual matches', () => {
    const queue = new MatchmakingQueue();
    queue.enqueue(entry('a'));
    queue.enqueue(entry('b', { pets: pets(100) }));
    expect(queue.poll(59_999)).toEqual([]);
    expect(queue.poll(60_000).map((match) => match.players[1])).toEqual([null, null]);
  });
  it('supports cancellation and applies rank points with a floor', () => {
    const queue = new MatchmakingQueue();
    queue.enqueue(entry('a'));
    expect(queue.cancel('a')).toBe(true);
    expect(queue.poll(60_000)).toEqual([]);
    expect(rankForPoints(300)).toBe('silver');
    expect(pointsAfterMatch(5, 'loss')).toBe(0);
    expect(pointsAfterMatch(290, 'win')).toBe(315);
  });
});

describe('matched battle', () => {
  it('starts six owned pets with their progression and an AI opponent', async () => {
    const { BattleSession } = await import('../apps/game-server/src/session');
    const { DEFAULT_RULES } = await import('@arena/shared-types');
    const team = pets(10);
    const session = new BattleSession('test-room', {
      ...DEFAULT_RULES,
      teamSize: 6,
      activeSize: 1,
      duplicates: true,
    });
    session.startMatched(
      [
        { id: 'player', name: 'Player', pets: team },
        { id: 'bot', name: 'Bot', pets: team },
      ],
      true,
    );
    for (let i = 0; i < 181; i++) session.tick(1 / 60);
    expect(session.lobby.phase).toBe('battle');
    expect(session.engine?.state.fighters).toHaveLength(12);
    expect(session.engine?.state.fighters[0].progression).toEqual({ level: 10, quality: 'C' });
    expect(session.engine?.state.manualTeams).toEqual([true, false]);
    session.leave('player');
    expect(session.engine?.state.result?.winner).toBe(1);
  });
});

describe('matched team selection', () => {
  it('keeps each player’s choices private and fills missing slots with strongest owned pets', async () => {
    const { MatchSelection } = await import('../apps/game-server/src/match-selection');
    const first = pets().map((pet, i) => ({ ...pet, id: `a${i}`, level: i + 1 }));
    const second = pets().map((pet, i) => ({ ...pet, id: `b${i}`, level: i + 1 }));
    const selection = new MatchSelection(
      3,
      [
        { id: 'a', pets: first },
        { id: 'b', pets: second },
      ],
      1000,
    );
    selection.select('a', ['a0'], 2000);
    selection.select('b', ['b1', 'b0'], 2000);
    expect(selection.snapshot('a', 2000).pets.every((pet) => pet.id.startsWith('a'))).toBe(true);
    expect(selection.snapshot('a', 2000).selected).toEqual(['a0']);
    expect(selection.complete(15999)).toBe(false);
    expect(selection.complete(16000)).toBe(true);
    expect(selection.teams().map((team) => team.map((pet) => pet.id))).toEqual([
      ['a0', 'a5', 'a4'],
      ['b1', 'b0', 'b5'],
    ]);
    expect(() => selection.select('a', ['a1'], 16000)).toThrow();
  });
  it('rejects duplicate and unowned pets, locks ready players and lets both start early', async () => {
    const { MatchSelection } = await import('../apps/game-server/src/match-selection');
    const first = pets().map((pet) => ({ ...pet, id: `a${pet.id}` }));
    const second = pets().map((pet) => ({ ...pet, id: `b${pet.id}` }));
    const selection = new MatchSelection(
      6,
      [
        { id: 'a', pets: first },
        { id: 'b', pets: second },
      ],
      0,
    );
    expect(() => selection.select('a', ['b0'], 1)).toThrow();
    expect(() => selection.select('a', ['a0', 'a0'], 1)).toThrow();
    selection.select('a', ['a1'], 1);
    selection.ready('a', 2);
    expect(() => selection.select('a', [], 3)).toThrow();
    expect(selection.complete(3)).toBe(false);
    selection.ready('b', 4);
    expect(selection.complete(4)).toBe(true);
    expect(selection.teams()[0]).toHaveLength(6);
  });
  it('uses the chosen individual progression when starting the battle', async () => {
    const { MatchSelection } = await import('../apps/game-server/src/match-selection');
    const { BattleSession } = await import('../apps/game-server/src/session');
    const { DEFAULT_RULES } = await import('@arena/shared-types');
    const roster = pets().map((pet, i) => ({ ...pet, id: `p${i}`, level: i + 1 }));
    const selection = new MatchSelection(
      3,
      [
        { id: 'a', pets: roster },
        { id: 'bot', pets: roster, bot: true },
      ],
      0,
    );
    selection.select('a', ['p0'], 1);
    selection.ready('a', 2);
    const session = new BattleSession('test', { ...DEFAULT_RULES, teamSize: 3, duplicates: true });
    session.prepareMatched(
      [
        { id: 'a', name: 'Player' },
        { id: 'bot', name: 'Bot' },
      ],
      true,
    );
    session.startPreparedMatched(selection.teams());
    for (let i = 0; i < 181; i++) session.tick(1 / 60);
    expect(session.engine?.state.fighters[0].progression?.level).toBe(1);
    expect(session.engine?.state.fighters[1].progression?.level).toBe(6);
  });
});

describe('random bot teams', () => {
  it.each([3, 6] as const)(
    'generates %i pets near the power of the team actually selected',
    async (size) => {
      const { generateBotTeam } = await import('../apps/game-server/src/bot-team');
      const { combatPower, calculatePetStats, POKEMON } = await import('@arena/game-data');
      const roster = pets()
        .map((pet, i) => ({
          ...pet,
          id: `player-${i}`,
          level: [1, 100, 20, 75, 5, 50][i],
          quality: (i === 1 ? 'SS' : 'C') as 'SS' | 'C',
        }))
        .slice(0, size);
      const first = generateBotTeam(roster, () => 0);
      const second = generateBotTeam(roster, () => 0.999999);
      const power = (pet: OwnedPet) => combatPower(calculatePetStats(POKEMON[pet.species], pet));
      for (const bot of [first, second]) {
        expect(bot).toHaveLength(size);
        expect(new Set(bot.map((pet) => pet.id)).size).toBe(size);
        expect(bot.every((pet) => !roster.some((p) => p.id === pet.id))).toBe(true);
        const ownTotal = roster.reduce((sum, pet) => sum + power(pet), 0);
        const botTotal = bot.reduce((sum, pet) => sum + power(pet), 0);
        expect(Math.max(ownTotal, botTotal)).toBeLessThanOrEqual(
          Math.min(ownTotal, botTotal) * 1.2,
        );
      }
      expect(first.map(({ species, level, quality }) => [species, level, quality])).not.toEqual(
        second.map(({ species, level, quality }) => [species, level, quality]),
      );
    },
  );
  it('builds the bot after the player chooses, rather than using their strongest pets', async () => {
    const { MatchRoom } = await import('../apps/game-server/src/match-room');
    const { MatchSelection } = await import('../apps/game-server/src/match-selection');
    const { BattleSession } = await import('../apps/game-server/src/session');
    const { DEFAULT_RULES } = await import('@arena/shared-types');
    const { combatPower, calculatePetStats, POKEMON } = await import('@arena/game-data');
    const roster = pets().map((pet, i) => ({ ...pet, id: `p${i}`, level: i < 3 ? 1 : 100 }));
    const selection = new MatchSelection(
      3,
      [
        { id: 'player', pets: roster },
        { id: 'bot', pets: roster, bot: true },
      ],
      0,
    );
    selection.select('player', ['p0', 'p1', 'p2'], 1);
    const session = new BattleSession('test', { ...DEFAULT_RULES, teamSize: 3, duplicates: true });
    session.prepareMatched(
      [
        { id: 'player', name: 'Player' },
        { id: 'bot', name: 'Bot' },
      ],
      true,
    );
    const fight = { selection, session, bot: true };
    (
      new MatchRoom() as unknown as { finishSelection: (value: typeof fight) => void }
    ).finishSelection(fight);
    for (let i = 0; i < 181; i++) session.tick(1 / 60);
    const fighters = session.engine!.state.fighters;
    const power = (f: (typeof fighters)[number]) =>
      combatPower(calculatePetStats(POKEMON[f.species], f.progression));
    const totals = [0, 1].map((team) =>
      fighters.filter((f) => f.team === team).reduce((sum, f) => sum + power(f), 0),
    );
    expect(Math.max(...totals)).toBeLessThanOrEqual(Math.min(...totals) * 1.2);
  });
});

describe('full roster matchmaking', () => {
  it('matches by total roster power and falls back after 30 seconds', () => {
    const queue = new MatchmakingQueue();
    queue.enqueue(entry('a', { size: 'all' }));
    queue.enqueue(entry('b', { size: 'all', pets: pets().slice(0, 3) }));
    expect(queue.poll(29_999)).toEqual([]);
    expect(queue.poll(30_000).map((match) => match.players[1])).toEqual([null, null]);
  });
  it('summons one pet per side every half second with unequal rosters', async () => {
    const { BattleSession } = await import('../apps/game-server/src/session');
    const { DEFAULT_RULES } = await import('@arena/shared-types');
    const session = new BattleSession(
      'full',
      {
        ...DEFAULT_RULES,
        teamSize: 1,
        activeSize: 1,
        duration: 0,
        duplicates: true,
        switching: false,
      },
      1,
      true,
    );
    session.startMatched(
      [
        { id: 'a', name: 'Player', pets: pets() },
        { id: 'b', name: 'Bot', pets: pets().slice(0, 3) },
      ],
      true,
    );
    session.lobby.countdown = 0;
    session.tick(0);
    const engine = session.engine!;
    expect(engine.state.fighters.filter((f) => f.active)).toHaveLength(2);
    expect(engine.state.arenaDefinition?.width).toBe(2400);
    expect(engine.state.fighters.filter((f) => f.active).map((f) => f.x)).toEqual([330, 2070]);
    for (let i = 0; i < 29; i++) engine.updateBattle(1 / 60);
    expect(engine.state.fighters.filter((f) => f.active)).toHaveLength(2);
    engine.updateBattle(1 / 60);
    expect(engine.state.fighters.filter((f) => f.active)).toHaveLength(4);
    engine.state.fighters
      .filter((f) => f.team === 0 && f.active)
      .forEach((f) => {
        f.hp = 0;
      });
    expect(engine.determineWinner()?.winner).toBe(1);
  });
});

it('uses shorter skill reach and slower projectiles only in full-roster battles', async () => {
  const { battleSkill, SKILL_BY_ID } = await import('@arena/game-data');
  const id = Object.keys(SKILL_BY_ID)[0];
  expect(battleSkill(id, true).range).toBeCloseTo(battleSkill(id).range * 0.65);
  expect(battleSkill(id, true).projectileSpeed).toBeCloseTo(battleSkill(id).projectileSpeed * 0.7);
  expect(battleSkill(id)).toBe(SKILL_BY_ID[id]);
});
