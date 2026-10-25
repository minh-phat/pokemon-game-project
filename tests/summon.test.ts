import 'reflect-metadata';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ObjectId } from 'mongodb';
import { randomInt } from 'node:crypto';
import type { Request, Response } from 'express';
import {
  summonQualityOdds,
  rollSummonQuality,
  PET_QUALITIES,
  speciesIds,
  SUMMON_GUARANTEES,
} from '@arena/shared-types';
import { AuthController, authDatabase } from '../apps/backend/src/auth';
vi.mock('node:crypto', async (original) => ({
  ...(await original<typeof import('node:crypto')>()),
  randomInt: vi.fn(),
}));
afterEach(() => vi.restoreAllMocks());
const req = {
  headers: { cookie: `arena_session=${'a'.repeat(64)}`, 'x-arena-request': '1' },
} as unknown as Request;
const res = () => ({ setHeader: vi.fn() }) as unknown as Response;
function database(attempts?: number, pets = {}, petQualities = {}) {
  const user = { _id: new ObjectId(), summonAttempts: attempts, pets, petQualities };
  const sessions = { findOne: vi.fn().mockResolvedValue({ userId: user._id }) };
  const users = {
    findOne: vi.fn().mockResolvedValue(user),
    findOneAndUpdate: vi.fn().mockImplementation(async (_filter, update) => {
      const next = structuredClone(petQualities) as Record<string, Record<string, number>>;
      const path = Object.keys(update.$inc).find((key) => key.startsWith('petQualities.'))!;
      const [, species, quality] = path.split('.');
      next[species] ??= {};
      next[species][quality] = (next[species][quality] ?? 0) + 1;
      return { ...user, summonAttempts: (attempts ?? 0) + 1, petQualities: next };
    }),
  };
  vi.spyOn(authDatabase, 'db').mockResolvedValue({
    collection: (name: string) => (name === 'sessions' ? sessions : users),
  } as never);
  return { user, users, sessions };
}
describe('account summons', () => {
  it('keeps quality probabilities normalized and increases rare chances between milestones', () => {
    for (let attempts = 0; attempts <= 2000; attempts++) {
      const odds = summonQualityOdds(attempts);
      expect(Object.values(odds).reduce((a, b) => a + b, 0)).toBe(10000);
      expect(Object.values(odds).every((n) => n >= 0)).toBe(true);
    }
    let previous = summonQualityOdds(0);
    for (let attempts = 1; attempts < 1000; attempts++) {
      if (SUMMON_GUARANTEES.some(({ interval }) => (attempts + 1) % interval === 0)) continue;
      const current = summonQualityOdds(attempts);
      for (const quality of ['A', 'S', 'SS'] as const)
        expect(current[quality]).toBeGreaterThanOrEqual(previous[quality]);
      previous = current;
    }
    expect(summonQualityOdds(99).S).toBeGreaterThan(summonQualityOdds(0).S);
    expect(summonQualityOdds(99).SS).toBeGreaterThan(summonQualityOdds(0).SS);
    expect(summonQualityOdds(1002)).toEqual(summonQualityOdds(1010));
  });
  it('guarantees A on 11, S on 101, SS on 1001 and repeats without downgrading better rolls', () => {
    for (const [attempts, minimum] of [
      [10, 'A'],
      [21, 'A'],
      [100, 'S'],
      [201, 'S'],
      [1000, 'SS'],
      [2001, 'SS'],
      [1110, 'S'],
    ] as const) {
      expect(rollSummonQuality(attempts, 0)).toBe(minimum);
      expect(rollSummonQuality(attempts, 9999)).toBe('SS');
      const odds = summonQualityOdds(attempts);
      for (const quality of PET_QUALITIES.slice(0, PET_QUALITIES.indexOf(minimum)))
        expect(odds[quality]).toBe(0);
    }
    expect(rollSummonQuality(9, 0)).toBe('C');
    expect(rollSummonQuality(11, 0)).toBe('C');
    expect(() => rollSummonQuality(0, 10000)).toThrow();
  });
  it('maps every roll to exactly one quality with the advertised distribution', () => {
    const counts = { C: 0, B: 0, A: 0, S: 0, SS: 0 };
    for (let roll = 0; roll < 10000; roll++) counts[rollSummonQuality(0, roll)]++;
    expect(counts).toEqual(summonQualityOdds(0));
  });
  it('requires a session and rejects foreign origins', async () => {
    const db = vi.spyOn(authDatabase, 'db');
    await expect(new AuthController().pets({ headers: {} } as Request, res())).rejects.toThrow(
      'đăng nhập',
    );
    await expect(
      new AuthController().summon(
        { headers: { ...req.headers, origin: 'https://evil.example' } } as Request,
        res(),
      ),
    ).rejects.toThrow('không hợp lệ');
    expect(db).not.toHaveBeenCalled();
  });
  it('rejects expired sessions', async () => {
    const { sessions, users } = database();
    sessions.findOne.mockResolvedValue(null);
    await expect(new AuthController().summon(req, res())).rejects.toThrow('hết hạn');
    expect(users.findOneAndUpdate).not.toHaveBeenCalled();
    expect(sessions.findOne.mock.calls[0][0].expiresAt.$gt).toBeInstanceOf(Date);
  });
  it('loads only the session owner and supports existing accounts', async () => {
    const { user, users } = database();
    expect(await new AuthController().pets(req, res())).toEqual({
      attempts: 0,
      pets: [],
      qualityOdds: summonQualityOdds(0),
      guarantees: [
        { quality: 'A', remaining: 11 },
        { quality: 'S', remaining: 101 },
        { quality: 'SS', remaining: 1001 },
      ],
      cost: 0,
    });
    expect(users.findOne).toHaveBeenCalledWith({ _id: user._id });
  });
  it('always grants a pet, stacks matching qualities and preserves legacy pets as C', async () => {
    const { users } = database(0, { pikachu: 2 }, { pikachu: { A: 1 } });
    vi.mocked(randomInt)
      .mockReturnValueOnce(0 as never)
      .mockReturnValueOnce(0 as never);
    const result = await new AuthController().summon(req, res());
    expect(result.received).toEqual({ species: 'pikachu', quality: 'C' });
    expect(result.pets).toEqual([
      { species: 'pikachu', quality: 'C', count: 3 },
      { species: 'pikachu', quality: 'A', count: 1 },
    ]);
    expect(result.cost).toBe(0);
    expect(result.attempts).toBe(1);
    expect(users.findOneAndUpdate.mock.calls[0][1]).toEqual({
      $inc: { summonAttempts: 1, 'petQualities.pikachu.C': 1 },
    });
    expect(randomInt).toHaveBeenCalledWith(speciesIds.length);
  });
  it('persists guaranteed quality and advances independent counters atomically', async () => {
    const { users } = database(100);
    vi.mocked(randomInt)
      .mockReturnValueOnce(0 as never)
      .mockReturnValueOnce(0 as never);
    const result = await new AuthController().summon(req, res());
    expect(result.received.quality).toBe('S');
    expect(result.pets).toEqual([{ species: 'pikachu', quality: 'S', count: 1 }]);
    expect(result.guarantees).toEqual([
      { quality: 'A', remaining: 9 },
      { quality: 'S', remaining: 101 },
      { quality: 'SS', remaining: 900 },
    ]);
    expect(users.findOneAndUpdate.mock.calls[0][0].summonAttempts).toBe(100);
  });
  it('rejects a concurrent stale attempt instead of awarding another pet', async () => {
    const { users } = database(1);
    users.findOneAndUpdate.mockResolvedValue(null);
    vi.mocked(randomInt).mockReturnValue(0 as never);
    await expect(new AuthController().summon(req, res())).rejects.toThrow('Một lượt khác');
  });
});
