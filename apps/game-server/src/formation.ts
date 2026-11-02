import type { OwnedPet } from '@arena/shared-types';
import type { MatchSize } from './matchmaking';

/** Ignore stale or invalid presets so existing team selection remains available. */
export function resolveFormation(pets: OwnedPet[], ids: unknown, size: MatchSize): OwnedPet[] {
  if (
    !Array.isArray(ids) ||
    !ids.length ||
    ids.length > pets.length ||
    (size !== 'all' && ids.length !== size) ||
    new Set(ids).size !== ids.length
  )
    return [];
  const owned = new Map(pets.map((pet) => [pet.id, pet]));
  if (ids.some((id) => typeof id !== 'string' || !owned.has(id))) return [];
  return ids.map((id) => owned.get(id)!);
}
