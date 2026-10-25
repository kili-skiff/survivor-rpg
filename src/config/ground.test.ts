import { describe, expect, it } from 'vitest';
import { GROUND_TEXTURES } from './ground';
import { BIOMES } from './world';

describe('ground tiles', () => {
  it('every biome has its own tile with a unique key and path', () => {
    const ids = Object.keys(BIOMES);
    expect(Object.keys(GROUND_TEXTURES).sort()).toEqual([...ids].sort());
    const tiles = Object.values(GROUND_TEXTURES);
    expect(new Set(tiles.map((t) => t.key)).size).toBe(ids.length);
    expect(new Set(tiles.map((t) => t.path)).size).toBe(ids.length);
  });
});
