import { ConflictException } from '@nestjs/common';
import { randomInt, randomUUID } from 'node:crypto';
import { MongoServerError, type Db, type ObjectId } from 'mongodb';
import {
  MIN_PET_LEVEL,
  PET_QUALITIES,
  speciesIds,
  rollSummonQuality,
  summonQualityOdds,
  SUMMON_GUARANTEES,
  type OwnedPet,
  type PetCollection,
  type PetQuality,
  type SpeciesId,
  type SummonResult,
} from '@arena/shared-types';

export interface PetOwner {
  _id: ObjectId;
  createdAt: Date;
  summonAttempts?: number;
  /** Legacy fields, removed only after all pets have been copied successfully. */
  pets?: Partial<Record<SpeciesId, number>>;
  petQualities?: Partial<Record<SpeciesId, Partial<Record<PetQuality, number>>>>;
}
export interface PetDocument {
  experience?: number;
  worldRewards?: string[];
  _id: string;
  ownerId: ObjectId;
  species: SpeciesId;
  quality: PetQuality;
  level: number;
  createdAt: Date;
  summonNumber?: number;
}
export const publicPet = (pet: PetDocument): OwnedPet => ({
  id: pet._id,
  species: pet.species,
  quality: pet.quality,
  level: pet.level,
  experience: pet.experience ?? 0,
  acquiredAt: pet.createdAt.toISOString(),
});
export async function createPetIndexes(db: Db) {
  await db.collection<PetDocument>('pets').createIndex({ ownerId: 1, createdAt: -1 });
  await db
    .collection<PetDocument>('pets')
    .createIndex(
      { ownerId: 1, summonNumber: -1 },
      { unique: true, partialFilterExpression: { summonNumber: { $exists: true } } },
    );
}
/** Stable IDs and insert-only upserts make retries/concurrent migrations harmless. */
export async function migrateLegacyPets(db: Db, owner: PetOwner) {
  if (!owner.pets && !owner.petQualities) return;
  const pets = db.collection<PetDocument>('pets');
  for (const species of speciesIds) {
    for (const quality of PET_QUALITIES) {
      const count =
        (owner.petQualities?.[species]?.[quality] ?? 0) +
        (quality === 'C' ? (owner.pets?.[species] ?? 0) : 0);
      for (let start = 0; start < count; start += 100) {
        await pets.bulkWrite(
          Array.from({ length: Math.min(100, count - start) }, (_, offset) => {
            const pet: PetDocument = {
              _id: `legacy:${owner._id.toHexString()}:${species}:${quality}:${start + offset}`,
              ownerId: owner._id,
              species,
              quality,
              level: MIN_PET_LEVEL,
              createdAt: owner.createdAt,
            };
            return {
              updateOne: { filter: { _id: pet._id }, update: { $setOnInsert: pet }, upsert: true },
            };
          }),
        );
      }
    }
  }
  await db
    .collection<PetOwner>('users')
    .updateOne({ _id: owner._id }, { $unset: { pets: '', petQualities: '' } });
}
async function attemptsFor(db: Db, owner: PetOwner) {
  const latest = await db
    .collection<PetDocument>('pets')
    .findOne(
      { ownerId: owner._id, summonNumber: { $exists: true } },
      { sort: { summonNumber: -1 } },
    );
  return Math.max(owner.summonAttempts ?? 0, latest?.summonNumber ?? 0);
}
export async function loadPetCollection(db: Db, owner: PetOwner): Promise<PetCollection> {
  const [attempts, pets] = await Promise.all([
    attemptsFor(db, owner),
    db
      .collection<PetDocument>('pets')
      .find({ ownerId: owner._id })
      .sort({ createdAt: -1, _id: 1 })
      .toArray(),
  ]);
  return {
    attempts,
    pets: pets.map(publicPet),
    cost: 0,
    qualityOdds: summonQualityOdds(attempts),
    guarantees: SUMMON_GUARANTEES.map(({ quality, interval }) => ({
      quality,
      remaining: interval - (attempts % interval),
    })),
  };
}
export async function summonPet(db: Db, owner: PetOwner): Promise<SummonResult> {
  const attempts = await attemptsFor(db, owner);
  const pet: PetDocument = {
    _id: randomUUID(),
    ownerId: owner._id,
    species: speciesIds[randomInt(speciesIds.length)],
    quality: rollSummonQuality(attempts, randomInt(10000)),
    level: MIN_PET_LEVEL,
    createdAt: new Date(),
    summonNumber: attempts + 1,
  };
  // One insert commits both the reward and its attempt number. The unique index
  // prevents concurrent rolls from consuming the same guarantee, even on standalone MongoDB.
  try {
    await db.collection<PetDocument>('pets').insertOne(pet);
  } catch (error) {
    if (error instanceof MongoServerError && error.code === 11000)
      throw new ConflictException('Một lượt khác vừa hoàn tất. Vui lòng tải lại bộ sưu tập.');
    throw error;
  }
  return { ...(await loadPetCollection(db, owner)), received: publicPet(pet) };
}
