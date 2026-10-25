import { describe, expect, it } from 'vitest';
import { HERBS } from '../config/herbs';
import { emptySave } from '../logic/save';
import { isDiscovered } from '../logic/worldProgress';
import { grantAllHerbs, jumpTo } from './devLogic';

describe('dev helpers', () => {
  it('adds every herb to the stash and keeps what is there', () => {
    const stash = grantAllHerbs({ moonbloom: 2, healing: 1 }, 5);
    expect(stash.moonbloom).toBe(7);
    expect(stash.healing).toBe(1);
    for (const id of Object.keys(HERBS)) expect(stash[id]).toBeGreaterThanOrEqual(5);
  });

  it('jumps to any hex and reveals its neighbours', () => {
    const save = jumpTo(emptySave(), { q: 4, r: -2 });
    expect(save.world.position).toBe('4,-2');
    expect(isDiscovered(save.world, '5,-2')).toBe(true);
    expect(save.stash).toEqual(emptySave().stash);
  });
});
