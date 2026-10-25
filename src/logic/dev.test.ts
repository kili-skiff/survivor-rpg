import { describe, expect, it } from 'vitest';
import { HERBS } from '../config/herbs';
import { grantAllHerbs } from './dev';

describe('dev helpers', () => {
  it('adds every herb to the stash and keeps what is there', () => {
    const stash = grantAllHerbs({ moonbloom: 2, healing: 1 }, 5);
    expect(stash.moonbloom).toBe(7);
    expect(stash.healing).toBe(1);
    for (const id of Object.keys(HERBS)) expect(stash[id]).toBeGreaterThanOrEqual(5);
  });
});
