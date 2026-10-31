import type { MatchSelectionSnapshot, OwnedPet } from '@arena/shared-types';
import { strongestPets } from './matchmaking';

export const SELECTION_MS = 15_000;
type Participant = { id: string; pets: OwnedPet[]; bot?: boolean };
type Choice = Participant & { selected: string[]; ready: boolean; revision: number };

/** The queue's strongest teams determine compatibility; only owned IDs may enter a battle. */
export class MatchSelection {
  readonly deadline: number;
  private choices: [Choice, Choice];
  constructor(
    readonly size: 3 | 6,
    participants: [Participant, Participant],
    now: number,
  ) {
    this.deadline = now + SELECTION_MS;
    this.choices = participants.map((participant) => ({
      ...participant,
      pets: structuredClone(participant.pets),
      selected: participant.bot
        ? strongestPets(participant.pets, size).map(({ pet }) => pet.id)
        : [],
      ready: !!participant.bot,
      revision: 0,
    })) as [Choice, Choice];
  }
  private choice(id: string) {
    const choice = this.choices.find((item) => item.id === id);
    if (!choice || choice.bot) throw new Error('Unknown player');
    return choice;
  }
  select(id: string, ids: unknown, now: number) {
    const choice = this.choice(id);
    if (now >= this.deadline || choice.ready)
      throw new Error('Thời gian chọn đội hình đã kết thúc.');
    if (
      !Array.isArray(ids) ||
      ids.length > this.size ||
      ids.some((item) => typeof item !== 'string') ||
      new Set(ids).size !== ids.length ||
      ids.some((item) => !choice.pets.some((pet) => pet.id === item))
    )
      throw new Error('Đội hình không hợp lệ.');
    choice.selected = [...ids];
    choice.revision++;
  }
  ready(id: string, now: number) {
    const choice = this.choice(id);
    if (now >= this.deadline || choice.ready)
      throw new Error('Thời gian chọn đội hình đã kết thúc.');
    choice.ready = true;
  }
  complete(now: number) {
    return now >= this.deadline || this.choices.every((choice) => choice.ready);
  }
  teams(): [OwnedPet[], OwnedPet[]] {
    return this.choices.map((choice) => {
      const selected = choice.selected.map((id) => choice.pets.find((pet) => pet.id === id)!);
      const selectedIds = new Set(choice.selected);
      const defaults = strongestPets(choice.pets, this.size)
        .map(({ pet }) => pet)
        .filter((pet) => !selectedIds.has(pet.id));
      return [...selected, ...defaults].slice(0, this.size);
    }) as [OwnedPet[], OwnedPet[]];
  }
  snapshot(id: string, now = Date.now()): MatchSelectionSnapshot {
    const me = this.choice(id);
    const other = this.choices.find((item) => item.id !== id)!;
    return {
      pets: structuredClone(me.pets),
      selected: [...me.selected],
      revision: me.revision,
      ready: me.ready,
      opponentReady: other.ready,
      deadline: this.deadline,
      serverNow: now,
      size: this.size,
    };
  }
}
