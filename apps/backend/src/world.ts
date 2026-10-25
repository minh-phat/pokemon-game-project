import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { randomInt, randomUUID } from 'node:crypto';
import type { Db, ObjectId } from 'mongodb';
import { z } from 'zod';
import {
  WorldBattleActionSchema,
  type WorldEncounterTicket,
  type WorldBattleReward,
} from '@arena/shared-types';
import { gainExperience, fighterDefinition, wildBattleExperience } from '@arena/game-data';
import { createWorld, syncWildlife, type World } from '@arena/game-data/world';
import { createWorldBattleArena } from '@arena/game-data/world-combat';
import { replayWorldEncounter } from '@arena/game-core';
import { publicPet, type PetDocument } from './pets';

interface EncounterDocument {
  _id: string;
  ownerId: ObjectId;
  worldSeed: number;
  ticket: WorldEncounterTicket;
  startedAt: Date;
  status: 'active' | 'finished' | 'aborted';
  experience?: number;
  capturable?: boolean;
}
const worlds = new Map<number, World>();
const locks = new Map<string, Promise<unknown>>();
export async function withWorldLock<T>(owner: ObjectId, action: () => Promise<T>): Promise<T> {
  const key = owner.toHexString();
  const previous = locks.get(key) ?? Promise.resolve();
  const next = previous.catch(() => {}).then(action);
  locks.set(key, next);
  try {
    return await next;
  } finally {
    if (locks.get(key) === next) locks.delete(key);
  }
}
const startSchema = z
  .object({
    petId: z.string().min(1).max(200),
    seed: z.number().int().min(0).max(0xffffffff),
    wildId: z.number().int().min(0).max(4194303),
  })
  .strict();
const finishSchema = z
  .object({
    id: z.string().uuid(),
    ticks: z.number().int().min(1).max(7200),
    actions: z.array(WorldBattleActionSchema).max(3600),
    capture: z.boolean().default(false),
  })
  .strict();
export async function startWorldBattle(db: Db, ownerId: ObjectId, body: unknown) {
  const parsed = startSchema.safeParse(body);
  if (!parsed.success) throw new BadRequestException('Mục tiêu không hợp lệ.');
  const { petId, seed, wildId } = parsed.data;
  const pet = await db.collection<PetDocument>('pets').findOne({ _id: petId, ownerId });
  if (!pet) throw new NotFoundException('Bạn chưa sở hữu thú này.');
  if (
    await db
      .collection<PetDocument>('pets')
      .findOne({ _id: captureId(ownerId, seed, wildId), ownerId })
  )
    throw new ConflictException('Bạn đã lập khế ước với cá thể này.');
  let world = worlds.get(seed);
  if (!world) {
    world = createWorld(seed);
    worlds.set(seed, world);
    if (worlds.size > 2) worlds.delete(worlds.keys().next().value!);
  }
  const chunk = Math.floor(wildId / 64);
  syncWildlife(world, { x: (chunk % 256) * 32 + 16, y: Math.floor(chunk / 256) * 32 + 16 });
  const wild = world.wildlife.find((a) => a.id === wildId);
  if (!wild) throw new NotFoundException('Không tìm thấy thú hoang.');
  const encounters = db.collection<EncounterDocument>('worldEncounters');
  // A new deployment abandons the previous fight without rewards.
  await encounters.updateMany({ ownerId, status: 'active' }, { $set: { status: 'aborted' } });
  const ticket: WorldEncounterTicket = {
    combatVersion: 3,
    arenaDefinition: createWorldBattleArena(world, wild),
    id: randomUUID(),
    seed: randomInt(0x7fffffff),
    pet: publicPet(pet),
    wild: {
      id: wild.id,
      species: wild.species,
      level: wild.level,
      quality: wild.quality,
      x: wild.x,
      y: wild.y,
    },
  };
  await encounters.insertOne({
    _id: ticket.id,
    ownerId,
    worldSeed: seed,
    ticket,
    startedAt: new Date(),
    status: 'active',
  });
  return ticket;
}
const captureId = (owner: ObjectId, seed: number, id: number) =>
  `wild:${owner.toHexString()}:${seed}:${id}`;

export async function finishWorldBattle(
  db: Db,
  ownerId: ObjectId,
  body: unknown,
): Promise<WorldBattleReward> {
  const parsed = finishSchema.safeParse(body);
  if (!parsed.success) throw new BadRequestException('Dữ liệu trận đấu không hợp lệ.');
  const { id, ticks, actions, capture } = parsed.data;
  const encounters = db.collection<EncounterDocument>('worldEncounters');
  const encounter = await encounters.findOne({ _id: id, ownerId });
  if (!encounter || encounter.status === 'aborted')
    throw new NotFoundException('Trận đấu không còn hiệu lực.');
  if (encounter.status === 'active') {
    const elapsed = Date.now() - encounter.startedAt.getTime();
    if (elapsed > 86400000 || ticks / 60 > elapsed / 1000 + 1)
      throw new BadRequestException('Thời gian trận đấu không hợp lệ.');
    let state;
    try {
      state = replayWorldEncounter(encounter.ticket, actions, ticks);
    } catch {
      throw new BadRequestException('Không xác minh được trận đấu.');
    }
    const wild = state.fighters.find((f) => f.team === 1)!;
    encounter.capturable =
      state.result?.winner === 0 && wild.hp > 0 && wild.hp < fighterDefinition(wild).hp * 0.1;
    encounter.experience = wildBattleExperience(encounter.ticket.wild, state.result?.winner === 0);
    encounter.status = 'finished';
    await encounters.updateOne(
      { _id: id, ownerId },
      {
        $set: {
          status: encounter.status,
          experience: encounter.experience,
          capturable: encounter.capturable,
        },
      },
    );
  }
  if (capture && !encounter.capturable)
    throw new BadRequestException('Chỉ lập khế ước khi thắng và thú còn dưới 10% HP.');
  const pets = db.collection<PetDocument>('pets');
  const pet = await pets.findOne({ _id: encounter.ticket.pet.id, ownerId });
  if (!pet) throw new NotFoundException('Không tìm thấy pet tham chiến.');
  if (!pet.worldRewards?.includes(id)) {
    const progress = gainExperience(pet, encounter.experience!);
    await pets.updateOne(
      { _id: pet._id, ownerId, worldRewards: { $ne: id } },
      {
        $set: progress,
        $addToSet: { worldRewards: id },
      },
    );
  }
  let captured = await pets.findOne({
    _id: captureId(ownerId, encounter.worldSeed, encounter.ticket.wild.id),
    ownerId,
  });
  if (capture) {
    const wild = encounter.ticket.wild;
    const newPet: PetDocument = {
      _id: captureId(ownerId, encounter.worldSeed, wild.id),
      ownerId,
      species: wild.species,
      quality: wild.quality,
      level: wild.level,
      experience: 0,
      createdAt: new Date(),
    };
    await pets.updateOne({ _id: newPet._id, ownerId }, { $setOnInsert: newPet }, { upsert: true });
    captured = await pets.findOne({ _id: newPet._id, ownerId });
  }
  return {
    pet: publicPet((await pets.findOne({ _id: pet._id, ownerId }))!),
    experience: encounter.experience!,
    captured: captured ? publicPet(captured) : null,
  };
}
