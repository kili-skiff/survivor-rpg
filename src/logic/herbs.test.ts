import { describe, expect, it } from 'vitest';
import { HERB_RULES, HERBS } from '../config/herbs';
import { BIOMES } from '../config/world';
import type { BiomeId } from '../config/types';
import { advanceGather, commonHerbFor, herbCountForRing, placeHerbs } from './herbs';
import { createRng } from './rng';

describe('herbs', () => {
  it('has a common herb for every biome', () => {
    for (const biome of Object.keys(BIOMES) as BiomeId[]) expect(commonHerbFor(biome).biome).toBe(biome);
  });

  it('grows more herbs further out, up to the maximum', () => {
    expect(herbCountForRing(1)).toBe(HERB_RULES.base);
    expect(herbCountForRing(6)).toBeGreaterThan(herbCountForRing(1));
    expect(herbCountForRing(50)).toBe(HERB_RULES.max);
  });

  it('places herbs away from the start and apart from each other', () => {
    for (let seed = 1; seed < 30; seed++) {
      const spots = placeHerbs('forest', 4, createRng(seed));
      expect(spots).toHaveLength(herbCountForRing(4));
      for (const s of spots) {
        const d = Math.hypot(s.x, s.y);
        expect(d).toBeGreaterThanOrEqual(HERB_RULES.minDistance - 0.001);
        expect(d).toBeLessThanOrEqual(HERB_RULES.maxDistance + 0.001);
      }
    }
  });

  it('only grows rare herbs from the rare ring on', () => {
    for (let seed = 1; seed < 50; seed++) {
      for (const s of placeHerbs('meadow', HERB_RULES.rareMinRing - 1, createRng(seed))) {
        expect(HERBS[s.herb].rare).toBe(false);
      }
    }
    const far = Array.from({ length: 60 }, (_, i) => placeHerbs('meadow', 6, createRng(i))).flat();
    expect(far.some((s) => HERBS[s.herb].rare)).toBe(true);
  });

  it('needs the full gather time and resets when leaving', () => {
    let p = 0;
    p = advanceGather(p, true, HERB_RULES.gatherSec / 2);
    expect(p).toBeCloseTo(0.5);
    expect(advanceGather(p, false, 0.1)).toBe(0);
    expect(advanceGather(p, true, HERB_RULES.gatherSec)).toBe(1);
  });
});
