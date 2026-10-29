import { translateCopy } from '../apps/frontend/src/lib/ui-copy';
import { SKILLS } from '@arena/game-data';
import { describe, expect, it } from 'vitest';
import { hydroCrossfireHits, hydroCrossfirePoint } from '@arena/game-data';

describe('rotating ballistic water geometry', () => {
  it('has four perpendicular arms and curves behind shell rotation', () => {
    const near = hydroCrossfirePoint(1, 0, 40);
    const far = hydroCrossfirePoint(1, 0, 220);
    expect(Math.atan2(far.depth, far.x)).toBeLessThan(Math.atan2(near.depth, near.x));
    for (let arm = 0; arm < 4; arm++) {
      const p = hydroCrossfirePoint(1, arm, 160);
      expect(hydroCrossfireHits(1, p.x, p.depth, 0)).toBe(true);
      const next = hydroCrossfirePoint(1, (arm + 1) % 4, 160);
      expect(p.x * next.x + p.depth * next.depth).toBeCloseTo(0);
    }
  });
  it('does not hit gaps between streams or outrun water propagation', () => {
    const p = hydroCrossfirePoint(1, 0, 160);
    const angle = Math.atan2(p.depth, p.x) + Math.PI / 4;
    expect(hydroCrossfireHits(1, Math.cos(angle) * 160, Math.sin(angle) * 160, 0)).toBe(false);
    expect(hydroCrossfireHits(0.05, 180, 0, 0)).toBe(false);
  });
});

it('displays only the skill name for the selected language', () => {
  expect(SKILLS.hydroCrossfire.name).toBe('Hydro Crossfire');
  expect(translateCopy(SKILLS.hydroCrossfire.name, 'vi')).toBe('Thập Tự Thủy Kích');
  expect(translateCopy(SKILLS.hydroCrossfire.name, 'en')).toBe('Hydro Crossfire');
});
