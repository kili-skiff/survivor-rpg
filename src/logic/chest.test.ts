import { describe, expect, it } from 'vitest';
import { CHEST } from '../config/balance';
import { PASSIVES } from '../config/passives';
import { SKILLS } from '../config/skills';
import { WEAPONS } from '../config/weapons';
import { chestUpgradeCount, dropsChest, rollChest } from './chest';
import { embersPerDrop } from './merchant';
import { createStartLoadout, weaponMaxLevel, type Loadout } from './stats';

function seeded(seed = 7) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}

describe('treasure chest', () => {
  it('drops rarely from anyone and likely from elites', () => {
    const just = (v: number) => () => v;
    expect(CHEST.eliteDropChance).toBeGreaterThan(CHEST.dropChance * 10);
    expect(dropsChest(false, just(CHEST.dropChance - 1e-6))).toBe(true);
    expect(dropsChest(false, just(CHEST.dropChance))).toBe(false);
    expect(dropsChest(true, just(CHEST.eliteDropChance - 1e-6))).toBe(true);
    expect(dropsChest(true, just(CHEST.eliteDropChance))).toBe(false);
  });

  it('holds one upgrade usually, three sometimes, five rarely', () => {
    expect(chestUpgradeCount(() => 0)).toBe(5);
    expect(chestUpgradeCount(() => CHEST.fiveChance + 0.01)).toBe(3);
    expect(chestUpgradeCount(() => 0.99)).toBe(1);
  });

  it('rolls upgrades on the growing build and some embers', () => {
    const rng = seeded();
    for (let i = 0; i < 50; i++) {
      const r = rollChest(createStartLoadout('bolt'), 3, rng);
      expect([1, 3, 5]).toContain(r.upgrades.length);
      expect(r.embers).toBeGreaterThanOrEqual(embersPerDrop(3) * CHEST.embersMin);
      expect(r.upgrades.every((u) => u.kind !== 'heal')).toBe(true);
    }
  });

  it('gives embers instead of upgrades when everything is maxed', () => {
    const maxed: Loadout = {
      weapons: Object.fromEntries(Object.keys(WEAPONS).map((id) => [id, weaponMaxLevel(id as never)])),
      passives: Object.fromEntries(Object.values(PASSIVES).map((p) => [p.id, p.maxLevel])),
      skills: Object.fromEntries(
        Object.values(SKILLS).map((s) => [s.id, s.levels.length + 1]),
      ) as Loadout['skills'],
    };
    const r = rollChest(maxed, 1, () => 0.99);
    expect(r.upgrades).toEqual([]);
    expect(r.embers).toBeGreaterThan(embersPerDrop(1) * CHEST.embersMax);
  });
});
