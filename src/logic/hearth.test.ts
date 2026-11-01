import { describe, expect, it } from 'vitest';
import boot from '../scenes/BootScene.ts?raw';
import { DEEDS } from '../config/deeds';
import { EMBER_UPGRADES } from '../config/emberUpgrades';
import { EMBER_KEY } from '../config/merchant';
import { POTION_RULES } from '../config/potions';
import {
  beltSize,
  buyRank,
  hearthBonus,
  isUnlocked,
  maxBeltSize,
  nextRankPrice,
  parseHearth,
  upgradeDef,
} from './hearth';
import { embersOf } from './merchant';
import { packPotion } from './potions';
import { emptySave, migrate } from './save';
import { computePlayerStats, createStartLoadout } from './stats';

describe('the Hearth', () => {
  it('every upgrade has an icon, sensible ranks, and only real deeds unlock them', () => {
    expect(new Set(EMBER_UPGRADES.map((d) => d.id)).size).toBe(EMBER_UPGRADES.length);
    for (const d of EMBER_UPGRADES) {
      expect(boot).toContain(`'${d.texture}'`);
      expect(d.maxRank).toBeGreaterThan(0);
      expect(d.basePrice).toBeGreaterThan(0);
      if (d.unlockedBy) expect(DEEDS.some((x) => x.id === d.unlockedBy)).toBe(true);
    }
    // A deed unlocks at most one upgrade.
    const unlockers = EMBER_UPGRADES.flatMap((d) => (d.unlockedBy ? [d.unlockedBy] : []));
    expect(new Set(unlockers).size).toBe(unlockers.length);
  });

  it('rank n costs n times the base price, none past the highest', () => {
    const might = upgradeDef('might');
    expect(nextRankPrice(might, {})).toBe(might.basePrice);
    expect(nextRankPrice(might, { might: 2 })).toBe(might.basePrice * 3);
    expect(nextRankPrice(might, { might: might.maxRank })).toBeNull();
  });

  it('buys a rank with embers, not when too dear, maxed or locked', () => {
    const price = upgradeDef('vitality').basePrice;
    const r = buyRank({ [EMBER_KEY]: price + 5, moonbloom: 1 }, {}, [], 'vitality')!;
    expect(r.ranks).toEqual({ vitality: 1 });
    expect(r.stash).toEqual({ [EMBER_KEY]: 5, moonbloom: 1 });
    expect(buyRank({ [EMBER_KEY]: price - 1 }, {}, [], 'vitality')).toBeNull();
    expect(buyRank({ [EMBER_KEY]: 999 }, { pouch: 1 }, ['allWatchfires'], 'pouch')).toBeNull();
    // Armor is locked until "Into the Dark" (ring 4).
    expect(isUnlocked(upgradeDef('armor'), [])).toBe(false);
    expect(buyRank({ [EMBER_KEY]: 999 }, {}, [], 'armor')).toBeNull();
    const armor = buyRank({ [EMBER_KEY]: 999 }, {}, ['ring4'], 'armor')!;
    expect(armor.ranks.armor).toBe(1);
    expect(embersOf(armor.stash)).toBe(999 - upgradeDef('armor').basePrice);
  });

  it('bought ranks raise the stats in every fight', () => {
    const plain = computePlayerStats(createStartLoadout('bolt'));
    const stats = computePlayerStats(
      createStartLoadout('bolt'),
      hearthBonus({ vitality: 2, might: 1, greed: 3 }),
    );
    expect(stats.maxHp).toBe(plain.maxHp + 20);
    expect(stats.might).toBeCloseTo(plain.might + 0.05);
    expect(stats.emberGain).toBeCloseTo(1.3);
    expect(hearthBonus({})).toEqual({});
  });

  it('the Belt Pouch makes the belt bigger', () => {
    expect(beltSize({})).toBe(POTION_RULES.beltSize);
    expect(beltSize({ pouch: 1 })).toBe(POTION_RULES.beltSize + 1);
    expect(maxBeltSize()).toBe(POTION_RULES.beltSize + 1);
    const full = { healing: POTION_RULES.beltSize };
    expect(packPotion({ healing: 1 }, full, 'healing', beltSize({}))).toBeNull();
    expect(packPotion({ healing: 1 }, full, 'healing', beltSize({ pouch: 1 }))?.belt).toEqual({
      healing: POTION_RULES.beltSize + 1,
    });
  });

  it('reads saved ranks safely and starts empty in older saves', () => {
    expect(parseHearth({ might: 2.7, vitality: 99, nope: 3, greed: -1 })).toEqual({ might: 2, vitality: 5 });
    expect(parseHearth('x')).toEqual({});
    expect(emptySave().hearth).toEqual({});
    const old = { ...emptySave(), version: 17 } as Record<string, unknown>;
    delete old.hearth;
    expect(migrate(old).hearth).toEqual({});
  });
});
