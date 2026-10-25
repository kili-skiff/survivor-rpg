import { describe, expect, it } from 'vitest';
import { GOLD_KEY, HERB_PRICES, LANTERN_TIERS, RECIPE_PRICES } from '../config/merchant';
import {
  buyLantern,
  buyRecipe,
  goldOf,
  goldPerDrop,
  lanternMultiplier,
  nextLantern,
  sellHerb,
} from './merchant';

describe('merchant', () => {
  it('drops a little more gold further out', () => {
    expect(goldPerDrop(1)).toBe(1);
    expect(goldPerDrop(3)).toBe(2);
    expect(goldPerDrop(8)).toBeGreaterThan(goldPerDrop(3));
  });

  it('sells lantern tiers in order, each raising the light for good', () => {
    expect(lanternMultiplier(0)).toBe(1);
    expect(lanternMultiplier(3)).toBeCloseTo(1.6);
    expect(lanternMultiplier(9)).toBeCloseTo(1.6);
    expect(nextLantern(0)?.price).toBe(LANTERN_TIERS[0].price);
    expect(nextLantern(LANTERN_TIERS.length)).toBeNull();
    expect(buyLantern({ [GOLD_KEY]: 10 }, 0)).toBeNull();
    const bought = buyLantern({ [GOLD_KEY]: LANTERN_TIERS[0].price + 5, moonbloom: 1 }, 0)!;
    expect(bought.level).toBe(1);
    expect(bought.stash).toEqual({ [GOLD_KEY]: 5, moonbloom: 1 });
  });

  it('sells recipes once', () => {
    const r = buyRecipe({ [GOLD_KEY]: RECIPE_PRICES.haste }, ['healing'], 'haste')!;
    expect(r.recipes).toEqual(['healing', 'haste']);
    expect(goldOf(r.stash)).toBe(0);
    expect(r.stash).toEqual({});
    expect(buyRecipe({ [GOLD_KEY]: 999 }, ['healing', 'haste'], 'haste')).toBeNull();
    expect(buyRecipe({}, ['healing'], 'ward')).toBeNull();
  });

  it('buys herbs one at a time', () => {
    const s = sellHerb({ starlily: 2 }, 'starlily')!;
    expect(s).toEqual({ starlily: 1, [GOLD_KEY]: HERB_PRICES.starlily });
    expect(sellHerb({}, 'moonbloom')).toBeNull();
    expect(sellHerb({ moonbloom: 1 }, 'moonbloom')).toEqual({ [GOLD_KEY]: 1 });
  });
});
