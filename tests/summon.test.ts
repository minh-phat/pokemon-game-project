import 'reflect-metadata';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ObjectId, MongoServerError } from 'mongodb';
import { createPetIndexes, migrateLegacyPets, type PetDocument } from '../apps/backend/src/pets';
import { randomInt } from 'node:crypto';
import type { Request, Response } from 'express';
import {
  summonQualityOdds,
  rollSummonQuality,
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
  const ordinaryOdds = {
    F: 3000,
    E: 2500,
    D: 1800,
    C: 1200,
    B: 700,
    A: 400,
    S: 250,
    SS: 100,
    SSS: 50,
  };
  it('keeps ordinary probabilities fixed and all distributions normalized', () => {
    for (let attempts = 0; attempts <= 20000; attempts++) {
      const odds = summonQualityOdds(attempts);
      expect(Object.values(odds).reduce((a, b) => a + b, 0)).toBe(10000);
      if (!SUMMON_GUARANTEES.some(({ interval }) => (attempts + 1) % interval === 0))
        expect(odds).toEqual(ordinaryOdds);
    }
  });
  it.each([
    [0, ordinaryOdds],
    [28, ordinaryOdds],
    [29, { F: 0, E: 0, D: 0, C: 0, B: 0, A: 8000, S: 1500, SS: 400, SSS: 100 }],
    [30, ordinaryOdds],
    [59, { F: 0, E: 0, D: 0, C: 0, B: 0, A: 8000, S: 1500, SS: 400, SSS: 100 }],
    [88, ordinaryOdds],
    [89, { F: 0, E: 0, D: 0, C: 0, B: 0, A: 0, S: 9000, SS: 900, SSS: 100 }],
    [90, ordinaryOdds],
    [179, { F: 0, E: 0, D: 0, C: 0, B: 0, A: 0, S: 9000, SS: 900, SSS: 100 }],
    [298, ordinaryOdds],
    [299, { F: 0, E: 0, D: 0, C: 0, B: 0, A: 0, S: 0, SS: 0, SSS: 10000 }],
    [300, ordinaryOdds],
    [599, { F: 0, E: 0, D: 0, C: 0, B: 0, A: 0, S: 0, SS: 0, SSS: 10000 }],
    [899, { F: 0, E: 0, D: 0, C: 0, B: 0, A: 0, S: 0, SS: 0, SSS: 10000 }],
  ])('uses the exact advertised distribution after %i summons', (attempts, expected) => {
    expect(summonQualityOdds(attempts)).toEqual(expected);
    const counts = { F: 0, E: 0, D: 0, C: 0, B: 0, A: 0, S: 0, SS: 0, SSS: 0 };
    for (let roll = 0; roll < 10000; roll++) counts[rollSummonQuality(attempts, roll)]++;
    expect(counts).toEqual(expected);
  });
  it('rejects invalid rolls', () => {
    for (const roll of [-1, 10000, 0.5, NaN]) expect(() => rollSummonQuality(0, roll)).toThrow();
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
        { quality: 'A', remaining: 30 },
        { quality: 'S', remaining: 90 },
        { quality: 'SSS', remaining: 300 },
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
    expect(first.received).toMatchObject({ species: 'pikachu', quality: 'F', level: 1 });
    expect(second.received).toMatchObject({ species: 'pikachu', quality: 'F', level: 1 });
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
    database(89);
    vi.mocked(randomInt).mockReturnValue(0 as never);
    const result = await new AuthController().summon(req, res());
    expect(result.received).toMatchObject({ quality: 'S', level: 1 });
    expect(result.attempts).toBe(90);
    expect(result.guarantees).toEqual([
      { quality: 'A', remaining: 30 },
      { quality: 'S', remaining: 90 },
      { quality: 'SSS', remaining: 210 },
    ]);
    expect((await new AuthController().pets(req, res())).pets).toEqual(result.pets);
  });
  it('does not advance the guarantee if a pet insert fails', async () => {
    const { pets } = database(29);
    vi.mocked(randomInt).mockReturnValue(0 as never);
    pets.insertOne.mockRejectedValueOnce(new Error('storage unavailable'));
    await expect(new AuthController().summon(req, res())).rejects.toThrow('storage unavailable');
    const collection = await new AuthController().pets(req, res());
    expect(collection.attempts).toBe(29);
    expect(collection.pets).toEqual([]);
    expect((await new AuthController().summon(req, res())).received.quality).toBe('A');
  });
  it('prevents simultaneous summons consuming the same milestone', async () => {
    const { records } = database(29);
    vi.mocked(randomInt).mockReturnValue(0 as never);
    const results = await Promise.allSettled([
      new AuthController().summon(req, res()),
      new AuthController().summon(req, res()),
    ]);
    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
    expect(results.filter((result) => result.status === 'rejected')).toHaveLength(1);
    expect(records.size).toBe(1);
    expect((await new AuthController().pets(req, res())).attempts).toBe(30);
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
