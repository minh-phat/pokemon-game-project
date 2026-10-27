import type { SkillDefinition } from '@arena/shared-types';

/** Distances use arena coordinates, independent of screen size or camera zoom. */
export function formatSkillRange(skill: SkillDefinition, language: string): string {
  const vi = language === 'vi';
  if (skill.behavior === 'buff' && skill.damagePercent === 0) {
    return vi ? 'Phạm vi: Bản thân' : 'Target: Self';
  }
  return vi ? `Tầm đánh: ${skill.range} đơn vị` : `Range: ${skill.range} units`;
}
