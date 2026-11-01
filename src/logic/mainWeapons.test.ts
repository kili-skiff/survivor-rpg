import { describe, expect, it } from 'vitest';
import { MAIN_WEAPONS, START_WEAPON, WEAPONS } from '../config/weapons';
import { emptySave, migrate } from './save';
import { computePlayerStats, computeWeaponStats, createStartLoadout, weaponMaxLevel } from './stats';
import { availableUpgrades } from './upgrades';

describe('main weapons', () => {
  it('are real weapons, Arcane Bolt among them as the default', () => {
    for (const id of MAIN_WEAPONS) expect(WEAPONS[id]).toBeDefined();
    expect(MAIN_WEAPONS).toContain(START_WEAPON);
    expect(MAIN_WEAPONS).toContain('boomerang');
  });

  it('are never offered as a new weapon on a card', () => {
    for (const main of MAIN_WEAPONS) {
      const options = availableUpgrades(createStartLoadout(main)).map((u) => u.option);
      for (const other of MAIN_WEAPONS) {
        if (other === main) continue;
        expect(options.some((o) => o.kind === 'weapon' && o.id === other)).toBe(false);
      }
    }
  });

  it('but their own level steps are', () => {
    const options = availableUpgrades(createStartLoadout('boomerang')).map((u) => u.option);
    expect(options.some((o) => o.kind === 'weapon' && o.id === 'boomerang' && o.toLevel === 2)).toBe(true);
  });

  it('extra weapons still come from cards', () => {
    const options = availableUpgrades(createStartLoadout('boomerang')).map((u) => u.option);
    expect(options.some((o) => o.kind === 'weapon' && o.id === 'chain' && o.toLevel === 1)).toBe(true);
  });
});

describe('the boomerang', () => {
  it('throws more boomerangs and hits harder at its highest level', () => {
    const player = computePlayerStats(createStartLoadout('boomerang'));
    const first = computeWeaponStats('boomerang', 1, player);
    const last = computeWeaponStats('boomerang', weaponMaxLevel('boomerang'), player);
    expect(last.count).toBeGreaterThan(first.count);
    expect(last.damage).toBeGreaterThan(first.damage);
    expect(last.cooldown).toBeLessThan(first.cooldown);
  });
});

describe('the chosen main weapon in the save', () => {
  it('is Arcane Bolt in a new save and in older saves', () => {
    expect(emptySave().mainWeapon).toBe('bolt');
    const old = emptySave() as unknown as Record<string, unknown>;
    delete old.mainWeapon;
    expect(migrate(old).mainWeapon).toBe('bolt');
  });

  it('is kept when it is a main weapon, and falls back otherwise', () => {
    expect(migrate({ ...emptySave(), mainWeapon: 'boomerang' }).mainWeapon).toBe('boomerang');
    expect(migrate({ ...emptySave(), mainWeapon: 'chain' }).mainWeapon).toBe('bolt');
    expect(migrate({ ...emptySave(), mainWeapon: 42 }).mainWeapon).toBe('bolt');
  });
});
