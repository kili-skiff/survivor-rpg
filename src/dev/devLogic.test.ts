import { describe, expect, it } from 'vitest';
import { HERBS } from '../config/herbs';
import { emptySave } from '../logic/save';
import { isDiscovered } from '../logic/worldProgress';
import { SEASON } from '../config/world';
import { areNeighbors, hexDistance, hexKey, hexNeighbors, parseHexKey } from '../logic/hex';
import { generateWorld } from '../logic/worldgen';
import { BASE_PLAYER_STATS } from '../config/passives';
import { godModeStats, grantAllHerbs, jumpTo } from './devLogic';

describe('dev helpers', () => {
  it('adds every herb to the stash and keeps what is there', () => {
    const stash = grantAllHerbs({ moonbloom: 2, healing: 1 }, 5);
    expect(stash.moonbloom).toBe(7);
    expect(stash.healing).toBe(1);
    for (const id of Object.keys(HERBS)) expect(stash[id]).toBeGreaterThanOrEqual(5);
  });

  const world = generateWorld(SEASON.seed, SEASON.generatorVersion);

  it('jumps to any hex and reveals its neighbours', () => {
    const plain = [...world.hexes.values()].find((h) => h.ring === 4 && !h.poi)!;
    const save = jumpTo(world, emptySave(), plain.hex);
    expect(save.world.position).toBe(plain.key);
    expect(isDiscovered(save.world, hexKey(hexNeighbors(plain.hex)[0]))).toBe(true);
    expect(save.stash).toEqual(emptySave().stash);
  });

  it('lands next to an unlit watchfire, so its fight can still light it', () => {
    const fire = [...world.hexes.values()].find((h) => h.poi === 'watchfire')!;
    const save = jumpTo(world, emptySave(), fire.hex);
    const pos = parseHexKey(save.world.position);
    expect(areNeighbors(pos, fire.hex)).toBe(true);
    expect(hexDistance(pos, { q: 0, r: 0 })).toBe(fire.ring - 1);
  });

  it('makes the player much stronger in god mode', () => {
    const god = godModeStats(BASE_PLAYER_STATS);
    expect(god.might).toBeCloseTo(BASE_PLAYER_STATS.might * 10);
    expect(god.haste).toBeLessThan(BASE_PLAYER_STATS.haste);
    expect(god.maxHp).toBe(BASE_PLAYER_STATS.maxHp);
  });
});
