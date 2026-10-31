import { randomUUID } from 'node:crypto';
import { calculatePetStats, combatPower, POKEMON } from '@arena/game-data';
import {
  MAX_PET_LEVEL,
  MIN_PET_LEVEL,
  PET_QUALITIES,
  speciesIds,
  type OwnedPet,
  type PetQuality,
  type SpeciesId,
} from '@arena/shared-types';
import { MAX_POWER_RATIO } from './matchmaking';

type Candidate = { species: SpeciesId; level: number; quality: PetQuality; power: number };
let catalog: Map<SpeciesId, Candidate[]> | undefined;
function candidates() {
  if (!catalog) {
    catalog = new Map(
      speciesIds.map((species) => {
        const entries: Candidate[] = [];
        for (const quality of PET_QUALITIES)
          for (let level = MIN_PET_LEVEL; level <= MAX_PET_LEVEL; level++) {
            entries.push({
              species,
              level,
              quality,
              power: combatPower(calculatePetStats(POKEMON[species], { level, quality })),
            });
          }
        return [species, entries];
      }),
    );
  }
  return catalog;
}

/** Generate synthetic pets around the team actually selected for battle, never the owner's pet IDs. */
export function generateBotTeam(
  playerTeam: OwnedPet[],
  random: () => number = Math.random,
): OwnedPet[] {
  const pick = <T>(values: T[]) =>
    values[Math.min(values.length - 1, Math.floor(random() * values.length))];
  return playerTeam.map((opponent) => {
    const target = combatPower(calculatePetStats(POKEMON[opponent.species], opponent));
    const eligible = [...candidates().values()]
      .map((entries) =>
        entries.filter(
          (entry) =>
            Math.max(target, entry.power) <= Math.min(target, entry.power) * MAX_POWER_RATIO,
        ),
      )
      .filter((entries) => entries.length > 0);
    // The player's own valid species and progression guarantee at least one candidate.
    const { species, level, quality } = pick(pick(eligible));
    return {
      id: `bot:${randomUUID()}`,
      species,
      level,
      quality,
      experience: 0,
      acquiredAt: new Date().toISOString(),
    };
  });
}
