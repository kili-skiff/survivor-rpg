import { describe, expect, it } from 'vitest';
import { fogDensity, valueNoise, type FogNoiseOptions } from './fogNoise';

const OPTIONS: FogNoiseOptions = { cells: 4, octaves: 3, low: 0.3, high: 0.75 };

describe('valueNoise', () => {
  it('stays within 0..1', () => {
    for (let i = 0; i < 200; i++) {
      const n = valueNoise(i * 0.37, i * 0.73, 8, 5);
      expect(n).toBeGreaterThanOrEqual(0);
      expect(n).toBeLessThanOrEqual(1);
    }
  });

  it('repeats after one period, so textures tile without seams', () => {
    for (let i = 0; i < 50; i++) {
      const x = i * 0.31;
      const y = i * 0.57;
      expect(valueNoise(x + 8, y, 8, 3)).toBeCloseTo(valueNoise(x, y, 8, 3), 10);
      expect(valueNoise(x, y + 8, 8, 3)).toBeCloseTo(valueNoise(x, y, 8, 3), 10);
    }
  });

  it('differs between seeds', () => {
    expect(valueNoise(1.5, 2.5, 8, 1)).not.toBe(valueNoise(1.5, 2.5, 8, 2));
  });
});

describe('fogDensity', () => {
  it('is deterministic', () => {
    expect(fogDensity(32, 7, OPTIONS)).toEqual(fogDensity(32, 7, OPTIONS));
  });

  it('fills the whole map with values', () => {
    expect(fogDensity(32, 7, OPTIONS)).toHaveLength(32 * 32);
  });

  it('has both clear air and dense fog, so the clouds have shape', () => {
    const map = fogDensity(64, 11, OPTIONS);
    expect(Math.min(...map)).toBeLessThan(40);
    expect(Math.max(...map)).toBeGreaterThan(215);
  });

  it('changes smoothly across the tile edge (no seam)', () => {
    const size = 64;
    const map = fogDensity(size, 11, OPTIONS);
    let seam = 0;
    let inner = 0;
    for (let y = 0; y < size; y++) {
      seam += Math.abs(map[y * size] - map[y * size + size - 1]);
      inner += Math.abs(map[y * size + 31] - map[y * size + 30]);
    }
    // The wrap-around step is no bigger than an ordinary step (with a little slack).
    expect(seam).toBeLessThanOrEqual(inner * 3 + size * 4);
  });
});
