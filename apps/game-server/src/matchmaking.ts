import { calculatePetStats, combatPower, POKEMON } from '@arena/game-data';
import type { OwnedPet } from '@arena/shared-types';

export type MatchMode = 'casual' | 'ranked';
export type MatchSize = 3 | 6 | 'all';
export type Rank = 'bronze' | 'silver' | 'gold' | 'platinum' | 'diamond';
export const MATCH_WAIT_MS = 60_000;
// The difference is symmetric: neither player is more than 20% stronger than the other.
export const MAX_POWER_RATIO = 1.2;

export function rankForPoints(points: number): Rank {
  if (!Number.isSafeInteger(points) || points < 0) throw new Error('Invalid rank points');
  if (points >= 1600) return 'diamond';
  if (points >= 1000) return 'platinum';
  if (points >= 600) return 'gold';
  if (points >= 300) return 'silver';
  return 'bronze';
}

export function pointsAfterMatch(points: number, result: 'win' | 'loss' | 'draw') {
  rankForPoints(points);
  return Math.max(0, points + (result === 'win' ? 25 : result === 'loss' ? -15 : 0));
}

export function strongestPets(pets: OwnedPet[], size: MatchSize) {
  if (new Set(pets.map((pet) => pet.id)).size !== pets.length)
    throw new Error('Duplicate owned pet');
  if (!pets.length || (size !== 'all' && pets.length < size))
    throw new Error('Not enough owned pets');
  return pets
    .map((pet) => ({ pet, power: combatPower(calculatePetStats(POKEMON[pet.species], pet)) }))
    .sort((a, b) => b.power - a.power || a.pet.id.localeCompare(b.pet.id))
    .slice(0, size === 'all' ? undefined : size);
}

export interface SearchEntry {
  playerId: string;
  mode: MatchMode;
  size: MatchSize;
  points: number;
  pets: OwnedPet[];
  startedAt: number;
}
interface Queued extends Omit<SearchEntry, 'pets'> {
  pets: OwnedPet[];
  power: number;
}
export type Match = {
  players: [Queued, Queued | null];
  arena: 'forest' | 'volcano' | 'lake' | 'ruins';
};

/** In-memory policy. Transport, authentication and durable rank updates must be supplied by callers. */
export class MatchmakingQueue {
  private entries = new Map<string, Queued>();
  constructor(private readonly random: () => number = Math.random) {}
  enqueue(entry: SearchEntry) {
    if (!entry.playerId || this.entries.has(entry.playerId)) throw new Error('Already searching');
    if (!Number.isFinite(entry.startedAt)) throw new Error('Invalid search time');
    rankForPoints(entry.points);
    const selected = strongestPets(entry.pets, entry.size);
    const queued: Queued = {
      ...entry,
      pets: selected.map(({ pet }) => structuredClone(pet)),
      power: selected.reduce((total, item) => total + item.power, 0),
    };
    this.entries.set(entry.playerId, queued);
  }
  cancel(playerId: string) {
    return this.entries.delete(playerId);
  }
  poll(now: number): Match[] {
    const result: Match[] = [];
    const entries = [...this.entries.values()].sort((a, b) => a.startedAt - b.startedAt);
    const createMatch = (a: Queued, b: Queued | null) => {
      this.entries.delete(a.playerId);
      if (b) this.entries.delete(b.playerId);
      const arenas = ['forest', 'volcano', 'lake', 'ruins'] as const;
      const index = Math.min(3, Math.max(0, Math.floor(this.random() * 4)));
      result.push({ players: [a, b], arena: arenas[index] });
    };
    for (const a of entries) {
      if (!this.entries.has(a.playerId)) continue;
      const candidate = entries
        .filter(
          (b) =>
            a !== b &&
            this.entries.has(b.playerId) &&
            a.mode === b.mode &&
            a.size === b.size &&
            (a.mode === 'ranked'
              ? rankForPoints(a.points) === rankForPoints(b.points)
              : Math.max(a.power, b.power) <= Math.min(a.power, b.power) * MAX_POWER_RATIO),
        )
        .sort((x, y) =>
          a.mode === 'ranked'
            ? x.startedAt - y.startedAt
            : Math.abs(a.power - x.power) - Math.abs(a.power - y.power) ||
              x.startedAt - y.startedAt,
        )[0];
      if (candidate) createMatch(a, candidate);
      else if (now - a.startedAt >= (a.size === 'all' ? 30_000 : MATCH_WAIT_MS))
        createMatch(a, null);
    }
    return result;
  }
}
