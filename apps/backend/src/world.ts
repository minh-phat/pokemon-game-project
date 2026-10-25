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
  capturableIds?: number[];
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
    petId: z.string().min(1).max(200).optional(),
    petIds: z.array(z.string().min(1).max(200)).min(1).optional(),
    seed: z.number().int().min(0).max(0xffffffff),
    wildId: z.number().int().min(0).max(4194303).optional(),
    wildIds: z.array(z.number().int().min(0).max(4194303)).min(1).optional(),
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
  const { seed } = parsed.data;
  const petIds = [...new Set(parsed.data.petIds ?? (parsed.data.petId ? [parsed.data.petId] : []))];
  const wildIds = [
    ...new Set(
      parsed.data.wildIds ?? (parsed.data.wildId !== undefined ? [parsed.data.wildId] : []),
    ),
  ];
  if (!petIds.length || !wildIds.length) throw new BadRequestException('Mục tiêu không hợp lệ.');
  const pets = [];
  for (const petId of petIds) {
    const pet = await db.collection<PetDocument>('pets').findOne({ _id: petId, ownerId });
    if (!pet) throw new NotFoundException('Bạn chưa sở hữu thú này.');
    pets.push(pet);
  }
  for (const wildId of wildIds) {
    if (
      await db
        .collection<PetDocument>('pets')
        .findOne({ _id: captureId(ownerId, seed, wildId), ownerId })
    )
      throw new ConflictException('Bạn đã lập khế ước với cá thể này.');
  }
  let world = worlds.get(seed);
  if (!world) {
    world = createWorld(seed);
    worlds.set(seed, world);
    if (worlds.size > 2) worlds.delete(worlds.keys().next().value!);
  }
  const wilds = [];
  for (const wildId of wildIds) {
    const chunk = Math.floor(wildId / 64);
    syncWildlife(world, { x: (chunk % 256) * 32 + 16, y: Math.floor(chunk / 256) * 32 + 16 });
    const wild = world.wildlife.find((a) => a.id === wildId);
    if (!wild) throw new NotFoundException('Không tìm thấy thú hoang.');
    wilds.push({
      id: wild.id,
      species: wild.species,
      level: wild.level,
      quality: wild.quality,
      x: wild.x,
      y: wild.y,
    });
  }
  const wild = wilds[0];
  const pet = pets[0];
  const encounters = db.collection<EncounterDocument>('worldEncounters');
  // A new deployment abandons the previous fight without rewards.
  await encounters.updateMany({ ownerId, status: 'active' }, { $set: { status: 'aborted' } });
  const ticket: WorldEncounterTicket = {
    combatVersion: 4,
    pets: pets.map(publicPet),
    wilds,
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
    const wilds = encounter.ticket.wilds ?? [encounter.ticket.wild];
    encounter.capturableIds = state.fighters
      .filter(
        (f) =>
          f.team === 1 &&
          state.result?.winner === 0 &&
          f.hp > 0 &&
          f.hp < fighterDefinition(f).hp * 0.1,
      )
      .map((f) => wilds[f.slot].id);
    encounter.capturable = encounter.capturableIds.length > 0;
    encounter.experience = wilds.reduce(
      (total, wild) => total + wildBattleExperience(wild, state.result?.winner === 0),
      0,
    );
    encounter.status = 'finished';
    await encounters.updateOne(
      { _id: id, ownerId },
      {
        $set: {
          status: encounter.status,
          experience: encounter.experience,
          capturable: encounter.capturable,
          capturableIds: encounter.capturableIds,
        },
      },
    );
  }
  if (capture && !encounter.capturable)
    throw new BadRequestException('Chỉ lập khế ước khi thắng và thú còn dưới 10% HP.');
  const pets = db.collection<PetDocument>('pets');
  const updatedPets = [];
  for (const participant of encounter.ticket.pets ?? [encounter.ticket.pet]) {
    const pet = await pets.findOne({ _id: participant.id, ownerId });
    if (!pet) throw new NotFoundException('Không tìm thấy pet tham chiến.');
    if (!pet.worldRewards?.includes(id)) {
      await pets.updateOne(
        { _id: pet._id, ownerId, worldRewards: { $ne: id } },
        {
          $set: gainExperience(pet, encounter.experience!),
          $addToSet: { worldRewards: id },
        },
      );
    }
    updatedPets.push(publicPet((await pets.findOne({ _id: pet._id, ownerId }))!));
  }
  const capturedPets = [];
  for (const wild of encounter.ticket.wilds ?? [encounter.ticket.wild]) {
    const petId = captureId(ownerId, encounter.worldSeed, wild.id);
    if (capture && (encounter.capturableIds ?? [encounter.ticket.wild.id]).includes(wild.id)) {
      const newPet: PetDocument = {
        _id: petId,
        ownerId,
        species: wild.species,
        quality: wild.quality,
        level: wild.level,
        experience: 0,
        createdAt: new Date(),
      };
      await pets.updateOne({ _id: petId, ownerId }, { $setOnInsert: newPet }, { upsert: true });
    }
    const captured = await pets.findOne({ _id: petId, ownerId });
    if (captured) capturedPets.push(publicPet(captured));
  }
  return {
    pet: updatedPets[0],
    pets: updatedPets,
    experience: encounter.experience!,
    captured: capturedPets[0] ?? null,
    capturedPets,
  };
}
