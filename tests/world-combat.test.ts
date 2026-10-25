import 'reflect-metadata';
import { describe, expect, it, vi, afterEach } from 'vitest';
import { ObjectId, type Db } from 'mongodb';
import { createWorldEncounter, applyWorldAction, replayWorldEncounter } from '@arena/game-core';
import {
  fighterDefinition,
  POKEMON,
  gainExperience,
  experienceToNextLevel,
  wildBattleExperience,
} from '@arena/game-data';
import { createWorld } from '@arena/game-data/world';
import type { WorldEncounterTicket, WorldBattleAction } from '@arena/shared-types';
import { finishWorldBattle, startWorldBattle, withWorldLock } from '../apps/backend/src/world';
import type { PetDocument } from '../apps/backend/src/pets';

const ticket: WorldEncounterTicket = {
  id: '00000000-0000-4000-8000-000000000001',
  seed: 42,
  pet: {
    id: 'owned',
    species: 'pikachu',
    level: 50,
    quality: 'SS',
    experience: 0,
    acquiredAt: '2026-01-01',
  },
  wild: { id: 1, species: 'pikachu', level: 1, quality: 'C', x: 0, y: 0 },
};
function complete(value = ticket, actions: WorldBattleAction[] = []) {
  const engine = createWorldEncounter(value);
  let index = 0;
  while (engine.state.phase === 'battle' && engine.state.tick < 7200) {
    while (actions[index]?.tick === engine.state.tick) applyWorldAction(engine, actions[index++]);
    engine.updateBattle(1 / 60);
  }
  return engine.state;
}
afterEach(() => vi.restoreAllMocks());

describe('world battle and progression', () => {
  it('uses cumulative increasing XP thresholds, carries overflow and caps level 100', () => {
    expect([1, 2, 3, 10].map(experienceToNextLevel)).toEqual([100, 130, 170, 730]);
    expect(gainExperience({ level: 1 }, 99)).toEqual({ level: 1, experience: 99 });
    expect(gainExperience({ level: 1 }, 100)).toEqual({ level: 2, experience: 0 });
    expect(gainExperience({ level: 1, experience: 90 }, 310)).toEqual({ level: 4, experience: 0 });
    expect(gainExperience({ level: 99 }, 999999)).toEqual({ level: 100, experience: 0 });
    expect(gainExperience({ level: 100 }, 500)).toEqual({ level: 100, experience: 0 });
    for (const amount of [-1, NaN, Infinity, 0.5])
      expect(() => gainExperience({ level: 1 }, amount)).toThrow();
    expect(wildBattleExperience({ level: 1, quality: 'C' }, true)).toBe(50);
    expect(wildBattleExperience({ level: 1, quality: 'C' }, false)).toBe(13);
  });
  it('scales each fighter independently even when both are the same species', () => {
    const engine = createWorldEncounter(ticket);
    const [pet, wild] = engine.state.fighters;
    expect(pet.hp).toBe(fighterDefinition(pet).hp);
    expect(pet.hp).toBeGreaterThan(wild.hp);
    expect(wild.hp).toBe(POKEMON.pikachu.hp);
    expect(POKEMON.pikachu.hp).toBe(155);
  });
  it('stops below 10% without killing a capturable wild Pokémon, including lethal hits', () => {
    const state = complete();
    expect(state.result?.winner).toBe(0);
    expect(state.fighters[1].hp).toBeGreaterThan(0);
    expect(state.fighters[1].hp).toBeLessThan(fighterDefinition(state.fighters[1]).hp * 0.1);
    expect(state.fighters[1].state).not.toBe('Fainted');
    expect(replayWorldEncounter(ticket, [], state.tick)).toEqual(state);
  });
  it('does not surrender at exactly 10%, and a trainer can still lose normally', () => {
    const engine = createWorldEncounter(ticket);
    engine.state.fighters[1].hp = fighterDefinition(engine.state.fighters[1]).hp / 10;
    expect(engine.determineWinner()).toBeNull();
    engine.state.fighters[1].hp -= 0.01;
    expect(engine.determineWinner()?.winner).toBe(0);
    const state = complete({
      ...ticket,
      pet: { ...ticket.pet, level: 1, quality: 'C' },
      wild: { ...ticket.wild, level: 100, quality: 'SS' },
    });
    expect(state.result?.winner).toBe(1);
    expect(state.fighters[0].hp).toBe(0);
  });
  it('replays manual mode, guard and skill commands exactly and rejects forged completion', () => {
    const actions: WorldBattleAction[] = [
      { tick: 0, type: 'mode', manual: true },
      { tick: 2, type: 'command', command: { type: 'guard', fighterId: '0-0', active: true } },
      { tick: 40, type: 'command', command: { type: 'guard', fighterId: '0-0', active: false } },
      {
        tick: 41,
        type: 'command',
        command: { type: 'skill', fighterId: '0-0', skillId: POKEMON.pikachu.skills[1].id },
      },
      { tick: 42, type: 'mode', manual: false },
    ];
    const state = complete(ticket, actions);
    expect(replayWorldEncounter(ticket, actions, state.tick)).toEqual(state);
    expect(() => replayWorldEncounter(ticket, [], 1)).toThrow('not finished');
    expect(() => replayWorldEncounter(ticket, [...actions].reverse(), state.tick)).toThrow('order');
    expect(() => replayWorldEncounter(ticket, actions, state.tick + 1)).toThrow('already ended');
  });
  it('generates reproducible level and quality with safe level-1 camp wildlife', () => {
    const world = createWorld(42),
      second = createWorld(42);
    expect(world.wildlife).toEqual(second.wildlife);
    expect(
      world.wildlife.every(
        (p) => p.level >= 1 && p.level <= 60 && ['C', 'B', 'A', 'S', 'SS'].includes(p.quality),
      ),
    ).toBe(true);
    expect(
      world.wildlife
        .filter((p) => Math.hypot(p.home.x - world.spawn.x, p.home.y - world.spawn.y) < 1)
        .every((p) => p.level === 1 && p.quality === 'C'),
    ).toBe(true);
  });
});

// Models Mongo's filters and atomic updates, including idempotency guards.
function database() {
  const ownerId = new ObjectId();
  const records = new Map<string, Map<string, any>>();
  const matches = (doc: any, filter: any) =>
    Object.entries(filter).every(([key, value]: [string, any]) => {
      if (value instanceof ObjectId) return doc[key]?.equals(value);
      if (value && typeof value === 'object' && '$ne' in value)
        return !doc[key]?.includes(value.$ne);
      return doc[key] === value;
    });
  const collection = (name: string) => {
    if (!records.has(name)) records.set(name, new Map());
    const rows = records.get(name)!;
    const update = (doc: any, change: any) => {
      Object.assign(doc, change.$set ?? {});
      for (const [key, value] of Object.entries(change.$addToSet ?? {})) {
        doc[key] ??= [];
        if (!doc[key].includes(value)) doc[key].push(value);
      }
    };
    return {
      findOne: async (filter: any) => {
        const doc = [...rows.values()].find((doc) => matches(doc, filter));
        return doc ? { ...doc } : null;
      },
      insertOne: async (doc: any) => {
        rows.set(doc._id, { ...doc });
      },
      updateMany: async (filter: any, change: any) => {
        for (const doc of rows.values()) if (matches(doc, filter)) update(doc, change);
      },
      updateOne: async (filter: any, change: any, options?: any) => {
        const doc = [...rows.values()].find((doc) => matches(doc, filter));
        if (doc) update(doc, change);
        else if (options?.upsert) rows.set(filter._id, { ...change.$setOnInsert });
        return { modifiedCount: doc ? 1 : 0 };
      },
    };
  };
  const db = { collection } as unknown as Db;
  const pet: PetDocument = {
    _id: 'owned',
    ownerId,
    species: 'pikachu',
    quality: 'SS',
    level: 50,
    createdAt: new Date(),
  };
  collection('pets').insertOne(pet);
  return { db, ownerId, records, pet };
}

describe('server verified world rewards', () => {
  it('ignores client species/level, verifies ownership and rejects invalid wild IDs', async () => {
    const { db, ownerId } = database();
    await expect(
      startWorldBattle(db, ownerId, { petId: 'stolen', seed: 42, wildId: 1 }),
    ).rejects.toThrow('sở hữu');
    await expect(
      startWorldBattle(db, ownerId, { petId: 'owned', seed: 42, wildId: 1, level: 100 }),
    ).rejects.toThrow('hợp lệ');
    await expect(
      startWorldBattle(db, ownerId, { petId: 'owned', seed: 42, wildId: 63 }),
    ).rejects.toThrow('Không tìm thấy');
  });
  it('persists XP once, captures once at original level/quality, and isolates owners', async () => {
    const { db, ownerId, records } = database();
    const world = createWorld(42);
    const wild = world.wildlife.find(
      (p) => Math.hypot(p.home.x - world.spawn.x, p.home.y - world.spawn.y) < 1,
    )!;
    const value = await startWorldBattle(db, ownerId, {
      petId: 'owned',
      seed: 42,
      wildId: wild.id,
    });
    const state = complete(value);
    const payload = { id: value.id, ticks: state.tick, actions: [], capture: false };
    await expect(finishWorldBattle(db, new ObjectId(), payload)).rejects.toThrow('hiệu lực');
    await expect(finishWorldBattle(db, ownerId, payload)).rejects.toThrow('Thời gian');
    records.get('worldEncounters')!.get(value.id).startedAt = new Date(Date.now() - 180000);
    await expect(finishWorldBattle(db, ownerId, { ...payload, ticks: 1 })).rejects.toThrow(
      'xác minh',
    );
    const first = await withWorldLock(ownerId, () => finishWorldBattle(db, ownerId, payload));
    expect(first.experience).toBe(50);
    expect(first.pet.experience).toBe(50);
    expect(first.captured).toBeNull();
    const [a, b] = await Promise.all(
      [1, 2].map(() =>
        withWorldLock(ownerId, () => finishWorldBattle(db, ownerId, { ...payload, capture: true })),
      ),
    );
    expect(a.pet.experience).toBe(50);
    expect(b).toEqual(a);
    expect(a.captured).toMatchObject({
      level: wild.level,
      quality: wild.quality,
      species: wild.species,
      experience: 0,
    });
    expect(records.get('pets')!.size).toBe(2);
    await expect(
      startWorldBattle(db, ownerId, { petId: 'owned', seed: 42, wildId: wild.id }),
    ).rejects.toThrow('đã lập khế ước');
  });
  it('does not allow an unfinished or abandoned battle to award XP', async () => {
    const { db, ownerId, records } = database();
    const world = createWorld(42),
      wild = world.wildlife[0];
    const first = await startWorldBattle(db, ownerId, {
      petId: 'owned',
      seed: 42,
      wildId: wild.id,
    });
    const second = await startWorldBattle(db, ownerId, {
      petId: 'owned',
      seed: 42,
      wildId: wild.id,
    });
    await expect(
      finishWorldBattle(db, ownerId, { id: first.id, ticks: 1, actions: [] }),
    ).rejects.toThrow('hiệu lực');
    await expect(
      finishWorldBattle(db, ownerId, { id: second.id, ticks: 1, actions: [], capture: true }),
    ).rejects.toThrow('xác minh');
    expect(records.get('pets')!.get('owned').experience).toBeUndefined();
  });
});

describe('open-world squads', () => {
  it('deploys more than four pets against multiple targets and verifies every reward exactly once', async () => {
    const { db, ownerId, records, pet } = database();
    const petIds = Array.from({ length: 6 }, (_, i) => `squad-${i}`);
    for (const id of petIds) await db.collection('pets').insertOne({ ...pet, _id: id } as any);
    const world = createWorld(42);
    const wilds = world.wildlife
      .filter((w) => Math.hypot(w.home.x - world.spawn.x, w.home.y - world.spawn.y) < 1)
      .slice(0, 2);
    expect(wilds).toHaveLength(2);
    const value = await startWorldBattle(db, ownerId, {
      petIds: [...petIds, petIds[0]],
      wildIds: wilds.map((w) => w.id),
      seed: 42,
    });
    const engine = createWorldEncounter(value);
    expect(engine.state.fighters.filter((f) => f.team === 0 && f.active)).toHaveLength(6);
    expect(engine.state.fighters.filter((f) => f.team === 1 && f.active)).toHaveLength(2);
    const enemies = engine.state.fighters.filter((f) => f.team === 1);
    enemies[0].hp = 1;
    expect(engine.determineWinner()).toBeNull();
    const actions: WorldBattleAction[] = [
      { tick: 0, type: 'mode', manual: true },
      { tick: 0, type: 'control', fighterId: '0-5' },
      { tick: 1, type: 'command', command: { type: 'guard', fighterId: '0-5', active: true } },
      { tick: 2, type: 'mode', manual: false },
    ];
    const state = complete(value, actions);
    expect(state.result?.winner).toBe(0);
    expect(replayWorldEncounter(value, actions, state.tick)).toEqual(state);
    records.get('worldEncounters')!.get(value.id).startedAt = new Date(Date.now() - 180000);
    const body = { id: value.id, ticks: state.tick, actions, capture: true };
    const reward = await finishWorldBattle(db, ownerId, body);
    expect(reward.pets).toHaveLength(6);
    expect(reward.capturedPets).toHaveLength(2);
    expect(reward.pets!.every((p) => p.experience === reward.experience)).toBe(true);
    expect(await finishWorldBattle(db, ownerId, body)).toEqual(reward);
    await expect(
      startWorldBattle(db, ownerId, {
        petIds: [petIds[0], 'stolen'],
        wildIds: [wilds[0].id],
        seed: 42,
      }),
    ).rejects.toThrow('sở hữu');
  });
});
