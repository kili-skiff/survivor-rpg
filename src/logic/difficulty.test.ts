import { describe, expect, it } from 'vitest';
import { ELITE } from '../config/balance';
import { eliteChance, ringModifiers } from './difficulty';

describe('ring difficulty', () => {
  it('leaves ring 1 as it is and gets harder further out', () => {
    expect(ringModifiers(1)).toEqual({ hp: 1, damage: 1, spawnRate: 1 });
    const far = ringModifiers(6);
    expect(far.hp).toBeGreaterThan(2);
    expect(far.damage).toBeGreaterThan(1.5);
    expect(far.spawnRate).toBeGreaterThan(1.1);
  });

  it('rises with every ring, gently at first, and keeps rising past the table', () => {
    for (let r = 2; r <= 10; r++) {
      const a = ringModifiers(r - 1);
      const b = ringModifiers(r);
      expect(b.hp).toBeGreaterThan(a.hp);
      expect(b.damage).toBeGreaterThan(a.damage);
      expect(b.spawnRate).toBeGreaterThan(a.spawnRate);
    }
    // Rings 1–2 stay easy: the step to ring 2 is smaller than later ones.
    expect(ringModifiers(2).hp - ringModifiers(1).hp).toBeLessThan(ringModifiers(4).hp - ringModifiers(3).hp);
  });

  it('has elites only from their ring on, more often further out, with a cap', () => {
    expect(eliteChance(1)).toBe(0);
    expect(eliteChance(ELITE.minRing)).toBeGreaterThan(0);
    expect(eliteChance(5)).toBeGreaterThan(eliteChance(2));
    expect(eliteChance(100)).toBe(ELITE.maxChance);
  });
});
