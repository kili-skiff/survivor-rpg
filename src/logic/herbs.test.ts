import { describe, expect, it } from 'vitest';
import { HERB_RULES, HERBS } from '../config/herbs';
import type { BiomeId } from '../config/types';
import { BIOMES } from '../config/world';
import {
  advanceGather,
  bloomPosition,
  commonHerbFor,
  herbCountForRing,
  herbForecast,
  planHerbBlooms,
  progressAfterHit,
} from './herbs';
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

  it('spreads blooms over the fight, one per window, at random moments', () => {
    const duration = 120;
    const start = duration * HERB_RULES.bloomFrom;
    const end = duration * HERB_RULES.bloomUntil;
    const seen = new Set<number>();
    for (let seed = 1; seed < 40; seed++) {
      const blooms = planHerbBlooms('forest', 4, duration, createRng(seed));
      expect(blooms).toHaveLength(herbCountForRing(4));
      const window = (end - start) / blooms.length;
      blooms.forEach((b, i) => {
        expect(b.atSec).toBeGreaterThanOrEqual(start + i * window);
        expect(b.atSec).toBeLessThanOrEqual(start + (i + 1) * window);
      });
      seen.add(Math.round(blooms[0].atSec));
    }
    // Different seeds give different timings.
    expect(seen.size).toBeGreaterThan(3);
  });

  it('only grows rare herbs from the rare ring on', () => {
    for (let seed = 1; seed < 50; seed++) {
      for (const b of planHerbBlooms('meadow', HERB_RULES.rareMinRing - 1, 90, createRng(seed))) {
        expect(HERBS[b.herb].rare).toBe(false);
      }
    }
    const far = Array.from({ length: 60 }, (_, i) => planHerbBlooms('meadow', 6, 90, createRng(i))).flat();
    expect(far.some((b) => HERBS[b.herb].rare)).toBe(true);
  });

  it('blooms just off screen around the player', () => {
    const player = { x: 500, y: -300 };
    const viewW = 400;
    const viewH = 800;
    for (let seed = 1; seed < 40; seed++) {
      const p = bloomPosition(player, viewW, viewH, [], createRng(seed));
      const outX = Math.max(0, Math.abs(p.x - player.x) - viewW / 2);
      const outY = Math.max(0, Math.abs(p.y - player.y) - viewH / 2);
      const beyond = Math.hypot(outX, outY);
      expect(beyond).toBeGreaterThan(0);
      expect(beyond).toBeLessThanOrEqual(HERB_RULES.revealBeyondScreen);
    }
  });

  it('keeps blooms apart from existing herbs when possible', () => {
    const player = { x: 0, y: 0 };
    const others = [{ x: 260, y: 0 }];
    for (let seed = 1; seed < 20; seed++) {
      const p = bloomPosition(player, 400, 400, others, createRng(seed));
      expect(Math.hypot(p.x - 260, p.y)).toBeGreaterThanOrEqual(HERB_RULES.minSpacing);
    }
  });

  it('needs the full gather time, resets when leaving and halves on a hit', () => {
    const p = advanceGather(0, true, HERB_RULES.gatherSec / 2);
    expect(p).toBeCloseTo(0.5);
    expect(advanceGather(p, false, 0.1)).toBe(0);
    expect(advanceGather(p, true, HERB_RULES.gatherSec)).toBe(1);
    expect(progressAfterHit(0.8)).toBeCloseTo(0.8 * HERB_RULES.progressKeptOnHit);
  });
});

describe('herb forecast', () => {
  it('names the biome herb, the count and rare herbs from the rare ring on', () => {
    const near = herbForecast('graveyard', 1);
    expect(near.common.id).toBe('gravemoss');
    expect(near.count).toBe(herbCountForRing(1));
    expect(near.rare).toEqual([]);
    const far = herbForecast('meadow', HERB_RULES.rareMinRing);
    expect(far.common.id).toBe('moonbloom');
    expect(far.rare.map((h) => h.id)).toContain('starlily');
  });
});
