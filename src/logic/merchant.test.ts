import { describe, expect, it } from 'vitest';
import {
  EMBER_KEY,
  HERB_PRICES,
  LANTERN_LOOKS,
  LANTERN_TIERS,
  lanternLook,
  RECIPE_PRICES,
} from '../config/merchant';
import {
  buyLantern,
  buyRecipe,
  embersOf,
  embersPerDrop,
  lanternLightsAll,
  lanternMultiplier,
  nextLantern,
  sellHerb,
} from './merchant';

describe('merchant', () => {
  it('drops a few more embers further out', () => {
    expect(embersPerDrop(1)).toBe(1);
    expect(embersPerDrop(3)).toBe(2);
    expect(embersPerDrop(8)).toBeGreaterThan(embersPerDrop(3));
  });

  it('sells lantern tiers in order, each raising the light for good', () => {
    expect(lanternMultiplier(0)).toBe(1);
    for (let level = 1; level <= LANTERN_TIERS.length; level++) {
      expect(lanternMultiplier(level)).toBeGreaterThanOrEqual(lanternMultiplier(level - 1));
    }
    expect(lanternMultiplier(1)).toBeGreaterThan(1);
    expect(lanternMultiplier(99)).toBe(lanternMultiplier(LANTERN_TIERS.length));
    // Only the best lantern lights up the whole screen.
    expect(lanternLightsAll(LANTERN_TIERS.length)).toBe(true);
    expect(lanternLightsAll(LANTERN_TIERS.length - 1)).toBe(false);
    expect(lanternLightsAll(0)).toBe(false);
    expect(nextLantern(0)?.price).toBe(LANTERN_TIERS[0].price);
    expect(nextLantern(LANTERN_TIERS.length)).toBeNull();
    expect(buyLantern({ [EMBER_KEY]: 10 }, 0)).toBeNull();
    const bought = buyLantern({ [EMBER_KEY]: LANTERN_TIERS[0].price + 5, moonbloom: 1 }, 0)!;
    expect(bought.level).toBe(1);
    expect(bought.stash).toEqual({ [EMBER_KEY]: 5, moonbloom: 1 });
  });

  it('sells recipes once', () => {
    const r = buyRecipe({ [EMBER_KEY]: RECIPE_PRICES.haste }, ['healing'], 'haste')!;
    expect(r.recipes).toEqual(['healing', 'haste']);
    expect(embersOf(r.stash)).toBe(0);
    expect(r.stash).toEqual({});
    expect(buyRecipe({ [EMBER_KEY]: 999 }, ['healing', 'haste'], 'haste')).toBeNull();
    expect(buyRecipe({}, ['healing'], 'ward')).toBeNull();
  });

  it('buys herbs one at a time', () => {
    const s = sellHerb({ starlily: 2 }, 'starlily')!;
    expect(s).toEqual({ starlily: 1, [EMBER_KEY]: HERB_PRICES.starlily });
    expect(sellHerb({}, 'moonbloom')).toBeNull();
    expect(sellHerb({ moonbloom: 1 }, 'moonbloom')).toEqual({ [EMBER_KEY]: 1 });
  });
});

describe('lantern looks', () => {
  it('has a look for the old lantern and one per tier, each different', () => {
    expect(LANTERN_LOOKS).toHaveLength(LANTERN_TIERS.length + 1);
    const frames = new Set(LANTERN_LOOKS.map((l) => l.frame));
    expect(frames.size).toBe(LANTERN_LOOKS.length);
  });

  it('never goes out of range', () => {
    expect(lanternLook(-3)).toBe(LANTERN_LOOKS[0]);
    expect(lanternLook(99)).toBe(LANTERN_LOOKS[LANTERN_LOOKS.length - 1]);
  });

  it('gets bigger with every tier', () => {
    for (let i = 1; i < LANTERN_LOOKS.length; i++) {
      expect(LANTERN_LOOKS[i].scale).toBeGreaterThan(LANTERN_LOOKS[i - 1].scale);
    }
  });
});
