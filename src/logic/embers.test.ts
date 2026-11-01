import { describe, expect, it } from 'vitest';
import { EMBER_KEY } from '../config/merchant';
import { startExpedition } from './expedition';
import { bankEmbers, embersOf, embersText } from './merchant';
import { emptySave, migrate, SAVE_VERSION } from './save';

describe('embers', () => {
  it('go straight into the stash, on top of what is there', () => {
    const save = { ...emptySave(), stash: { [EMBER_KEY]: 5, moonbloom: 2 } };
    const banked = bankEmbers(save, 7);
    expect(embersOf(banked.stash)).toBe(12);
    expect(banked.stash.moonbloom).toBe(2);
    expect(bankEmbers(save, 0)).toBe(save);
  });

  it('old gold in the stash becomes embers', () => {
    const old = { ...emptySave(), version: 16, stash: { gold: 40, moonbloom: 1 } };
    const save = migrate(JSON.parse(JSON.stringify(old)));
    expect(save.version).toBe(SAVE_VERSION);
    expect(save.stash).toEqual({ [EMBER_KEY]: 40, moonbloom: 1 });
  });

  it('gold an expedition carried becomes embers in the stash, its herbs stay with the expedition', () => {
    const base = emptySave();
    const expedition = { ...startExpedition(base.world.position), loot: { gold: 12, moonbloom: 3 } };
    const old = { ...base, version: 16, stash: { gold: 8 }, world: { ...base.world, expedition } };
    const save = migrate(JSON.parse(JSON.stringify(old)));
    expect(embersOf(save.stash)).toBe(20);
    expect(save.world.expedition?.loot).toEqual({ moonbloom: 3 });
  });

  it('reads "1 ember" and "5 embers"', () => {
    expect(embersText(1)).toBe('1 ember');
    expect(embersText(5)).toBe('5 embers');
  });
});
