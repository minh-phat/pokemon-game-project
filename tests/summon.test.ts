import 'reflect-metadata';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ObjectId, MongoServerError } from 'mongodb';
import { createPetIndexes, migrateLegacyPets, type PetDocument } from '../apps/backend/src/pets';
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
function database(
  attempts?: number,
  legacyPets?: Record<string, number>,
  petQualities?: Record<string, Record<string, number>>,
) {
  const user = {
    _id: new ObjectId(),
    createdAt: new Date('2026-01-01'),
    summonAttempts: attempts,
    pets: legacyPets,
    petQualities,
  };
  const records = new Map<string, PetDocument>();
  const sessions = { findOne: vi.fn().mockResolvedValue({ userId: user._id }) };
  const users = {
    findOne: vi.fn().mockResolvedValue(user),
    updateOne: vi.fn().mockImplementation(async () => {
      delete user.pets;
      delete user.petQualities;
      return { modifiedCount: 1 };
    }),
  };
  const pets = {
    createIndex: vi.fn(),
    findOne: vi
      .fn()
      .mockImplementation(
        async (filter) =>
          [...records.values()]
            .filter((pet) => pet.ownerId.equals(filter.ownerId) && pet.summonNumber !== undefined)
            .sort((a, b) => b.summonNumber! - a.summonNumber!)[0] ?? null,
      ),
    find: vi.fn().mockImplementation((filter) => ({
      sort: () => ({
        toArray: async () =>
          [...records.values()].filter((pet) => pet.ownerId.equals(filter.ownerId)),
      }),
    })),
    bulkWrite: vi.fn().mockImplementation(async (operations) => {
      for (const { updateOne } of operations) {
        if (!records.has(updateOne.filter._id))
          records.set(updateOne.filter._id, updateOne.update.$setOnInsert);
      }
    }),
    insertOne: vi.fn().mockImplementation(async (pet: PetDocument) => {
      if (
        [...records.values()].some(
          (other) => other.ownerId.equals(pet.ownerId) && other.summonNumber === pet.summonNumber,
        )
      )
        throw new MongoServerError({ code: 11000, message: 'duplicate summon number' });
      records.set(pet._id, pet);
      return { insertedId: pet._id };
    }),
  };
  const db = {
    collection: (name: string) => (name === 'sessions' ? sessions : name === 'pets' ? pets : users),
  };
  vi.spyOn(authDatabase, 'db').mockResolvedValue(db as never);
  return { db, user, users, sessions, pets, records };
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
    const { sessions, pets } = database();
    sessions.findOne.mockResolvedValue(null);
    await expect(new AuthController().summon(req, res())).rejects.toThrow('hết hạn');
    expect(pets.insertOne).not.toHaveBeenCalled();
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
  it('migrates counts to individual level-one pets and removes embedded ownership', async () => {
    const { user, users, records } = database(5, { pikachu: 2 }, { pikachu: { A: 1 } });
    const result = await new AuthController().pets(req, res());
    expect(result.pets).toHaveLength(3);
    expect(new Set(result.pets.map((pet) => pet.id)).size).toBe(3);
    expect(result.pets.map((pet) => [pet.species, pet.quality, pet.level])).toEqual([
      ['pikachu', 'C', 1],
      ['pikachu', 'C', 1],
      ['pikachu', 'A', 1],
    ]);
    expect(result.attempts).toBe(5);
    expect(records.size).toBe(3);
    expect(users.updateOne).toHaveBeenCalledWith(
      { _id: user._id },
      { $unset: { pets: '', petQualities: '' } },
    );
    expect(user.pets).toBeUndefined();
    expect(user.petQualities).toBeUndefined();
    expect(await new AuthController().pets(req, res())).toEqual(result);
  });
  it('retries partial migration without losing, duplicating or resetting existing pets', async () => {
    const { db, user, pets, users, records } = database(110, { pikachu: 101 });
    const staleOwner = { ...user };
    const write = pets.bulkWrite.getMockImplementation()!;
    pets.bulkWrite
      .mockImplementationOnce(write)
      .mockRejectedValueOnce(new Error('connection lost'));
    await expect(new AuthController().pets(req, res())).rejects.toThrow('connection lost');
    expect(records.size).toBe(100);
    expect(users.updateOne).not.toHaveBeenCalled();
    expect(user.pets).toEqual({ pikachu: 101 });
    const first = [...records.values()][0];
    first.level = 7;
    const result = await new AuthController().pets(req, res());
    expect(result.pets).toHaveLength(101);
    expect(result.attempts).toBe(110);
    await migrateLegacyPets(db as never, staleOwner);
    expect(records.size).toBe(101);
    expect(records.get(first._id)?.level).toBe(7);
  });
  it('stores identical summons as separate level-one pets without writing rewards to users', async () => {
    const { pets, users, records } = database();
    vi.mocked(randomInt).mockReturnValue(0 as never);
    const first = await new AuthController().summon(req, res());
    const second = await new AuthController().summon(req, res());
    expect(first.received).toMatchObject({ species: 'pikachu', quality: 'C', level: 1 });
    expect(second.received).toMatchObject({ species: 'pikachu', quality: 'C', level: 1 });
    expect(first.received.id).not.toBe(second.received.id);
    expect(second.pets).toHaveLength(2);
    expect(second.attempts).toBe(2);
    expect(second.cost).toBe(0);
    expect(records.size).toBe(2);
    expect(pets.insertOne).toHaveBeenCalledTimes(2);
    expect(users.updateOne).not.toHaveBeenCalled();
    expect(randomInt).toHaveBeenCalledWith(speciesIds.length);
  });
  it('preserves guarantee progress from existing accounts', async () => {
    database(100);
    vi.mocked(randomInt).mockReturnValue(0 as never);
    const result = await new AuthController().summon(req, res());
    expect(result.received).toMatchObject({ quality: 'S', level: 1 });
    expect(result.attempts).toBe(101);
    expect(result.guarantees).toEqual([
      { quality: 'A', remaining: 9 },
      { quality: 'S', remaining: 101 },
      { quality: 'SS', remaining: 900 },
    ]);
    expect((await new AuthController().pets(req, res())).pets).toEqual(result.pets);
  });
  it('does not advance the guarantee if a pet insert fails', async () => {
    const { pets } = database(10);
    vi.mocked(randomInt).mockReturnValue(0 as never);
    pets.insertOne.mockRejectedValueOnce(new Error('storage unavailable'));
    await expect(new AuthController().summon(req, res())).rejects.toThrow('storage unavailable');
    const collection = await new AuthController().pets(req, res());
    expect(collection.attempts).toBe(10);
    expect(collection.pets).toEqual([]);
    expect((await new AuthController().summon(req, res())).received.quality).toBe('A');
  });
  it('prevents simultaneous summons consuming the same milestone', async () => {
    const { records } = database(10);
    vi.mocked(randomInt).mockReturnValue(0 as never);
    const results = await Promise.allSettled([
      new AuthController().summon(req, res()),
      new AuthController().summon(req, res()),
    ]);
    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
    expect(results.filter((result) => result.status === 'rejected')).toHaveLength(1);
    expect(records.size).toBe(1);
    expect((await new AuthController().pets(req, res())).attempts).toBe(11);
  });
  it('filters both pets and summon history by owner', async () => {
    const { records, user, pets } = database();
    records.set('other', {
      _id: 'other',
      ownerId: new ObjectId(),
      species: 'pikachu',
      quality: 'SS',
      level: 50,
      createdAt: new Date(),
      summonNumber: 1001,
    });
    const collection = await new AuthController().pets(req, res());
    expect(collection.pets).toEqual([]);
    expect(collection.attempts).toBe(0);
    expect(pets.find).toHaveBeenCalledWith({ ownerId: user._id });
    expect(pets.findOne.mock.calls[0][0].ownerId).toEqual(user._id);
  });
  it('creates a unique per-owner summon index and an ownership lookup index', async () => {
    const { db, pets } = database();
    await createPetIndexes(db as never);
    expect(pets.createIndex).toHaveBeenCalledWith(
      { ownerId: 1, summonNumber: -1 },
      { unique: true, partialFilterExpression: { summonNumber: { $exists: true } } },
    );
    expect(pets.createIndex).toHaveBeenCalledWith({ ownerId: 1, createdAt: -1 });
  });
});
