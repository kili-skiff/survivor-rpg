import { describe, expect, it } from 'vitest';
import { POTION_RULES, POTIONS } from '../config/potions';
import { HERBS } from '../config/herbs';
import { BASE_PLAYER_STATS } from '../config/passives';
import {
  activeBuffs,
  addBuff,
  applyBuffs,
  beltCount,
  brew,
  brewableCount,
  canDrink,
  damageTakenMultiplier,
  packPotion,
  parseBelt,
  potionHeal,
  takeFromBelt,
  unpackPotion,
} from './potions';

describe('potion data', () => {
  it('only uses known herbs in recipes', () => {
    for (const p of Object.values(POTIONS)) {
      for (const herb of Object.keys(p.recipe)) expect(HERBS).toHaveProperty(herb);
    }
  });
});

describe('brewing', () => {
  it('counts how many potions the stash is enough for', () => {
    expect(brewableCount({}, 'healing')).toBe(0);
    expect(brewableCount({ moonbloom: 5, mirewort: 1 }, 'healing')).toBe(1);
    expect(brewableCount({ moonbloom: 4, mirewort: 3 }, 'healing')).toBe(2);
  });

  it('uses up the herbs and adds the potion to the stash', () => {
    expect(brew({ moonbloom: 2, mirewort: 2, starlily: 1 }, 'healing')).toEqual({
      mirewort: 1,
      starlily: 1,
      healing: 1,
    });
    expect(brew({ moonbloom: 1, mirewort: 1 }, 'healing')).toBeNull();
  });
});

describe('belt', () => {
  it('moves potions between stash and belt', () => {
    const packed = packPotion({ healing: 2 }, {}, 'healing')!;
    expect(packed).toEqual({ stash: { healing: 1 }, belt: { healing: 1 } });
    expect(unpackPotion(packed.stash, packed.belt, 'healing')).toEqual({ stash: { healing: 2 }, belt: {} });
    expect(packPotion({}, {}, 'ward')).toBeNull();
    expect(unpackPotion({}, {}, 'ward')).toBeNull();
  });

  it('holds at most beltSize potions', () => {
    const full = { healing: 2, ward: POTION_RULES.beltSize - 2 };
    expect(beltCount(full)).toBe(POTION_RULES.beltSize);
    expect(packPotion({ haste: 1 }, full, 'haste')).toBeNull();
  });

  it('takes a drunk potion out of the belt', () => {
    expect(takeFromBelt({ healing: 2 }, 'healing')).toEqual({ healing: 1 });
    expect(takeFromBelt({ healing: 1 }, 'healing')).toEqual({});
  });

  it('parses saved belts and drops broken or extra entries', () => {
    expect(parseBelt(null)).toEqual({});
    expect(parseBelt({ healing: 1, nope: 3, ward: -1 })).toEqual({ healing: 1 });
    expect(beltCount(parseBelt({ healing: 9, haste: 9 }))).toBe(POTION_RULES.beltSize);
  });
});

describe('potion effects', () => {
  it('heals a share of max health, but not at full health', () => {
    expect(potionHeal('healing', 100)).toBe(40);
    expect(potionHeal('haste', 100)).toBe(0);
    expect(canDrink('healing', 100, 100)).toBe(false);
    expect(canDrink('healing', 50, 100)).toBe(true);
    expect(canDrink('ward', 100, 100)).toBe(true);
  });

  it('applies buffs to the stats while they run', () => {
    const buffs = addBuff([], 'haste', 0);
    const stats = applyBuffs(BASE_PLAYER_STATS, activeBuffs(buffs, 5000));
    expect(stats.moveSpeed).toBeCloseTo(BASE_PLAYER_STATS.moveSpeed * 1.3);
    expect(stats.haste).toBeCloseTo(BASE_PLAYER_STATS.haste * 0.7);
    expect(activeBuffs(buffs, 10_000)).toEqual([]);
  });

  it('restarts a buff instead of stacking it', () => {
    const buffs = addBuff(addBuff([], 'ward', 0), 'ward', 4000);
    expect(buffs).toEqual([{ id: 'ward', endsAt: 14_000 }]);
    expect(damageTakenMultiplier(buffs)).toBe(0.5);
    expect(damageTakenMultiplier([])).toBe(1);
  });

  it('gives instant potions no buff', () => {
    expect(addBuff([], 'healing', 0)).toEqual([]);
  });
});
