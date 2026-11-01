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

describe('main weapon card', () => {
  it('comes often, but not every time', async () => {
    const { rollUpgradeOptions, offersMainWeapon } = await import('./upgrades');
    const { createStartLoadout } = await import('./stats');
    const { createRng } = await import('./rng');
    const rng = createRng(11);
    const loadout = createStartLoadout('boomerang');
    let offered = 0;
    for (let i = 0; i < 400; i++)
      if (offersMainWeapon(rollUpgradeOptions(loadout, rng, 3, true, 0), loadout)) offered++;
    expect(offered / 400).toBeGreaterThan(0.4);
    expect(offered / 400).toBeLessThan(0.9);
  });

  it('is sure to come after missing too long', async () => {
    const { rollUpgradeOptions, offersMainWeapon } = await import('./upgrades');
    const { MAIN_WEAPON_OFFER } = await import('../config/weapons');
    const { createStartLoadout } = await import('./stats');
    const { createRng } = await import('./rng');
    const rng = createRng(3);
    for (const main of ['bolt', 'boomerang'] as const) {
      const loadout = createStartLoadout(main);
      for (let i = 0; i < 50; i++) {
        const options = rollUpgradeOptions(loadout, rng, 3, true, MAIN_WEAPON_OFFER.pityAfter);
        expect(options).toHaveLength(3);
        expect(offersMainWeapon(options, loadout)).toBe(true);
      }
    }
  });

  it('a fully grown main weapon brings no card of its own', async () => {
    const { rollUpgradeOptions, mainWeaponCanGrow } = await import('./upgrades');
    const { WEAPONS } = await import('../config/weapons');
    const { createRng } = await import('./rng');
    const loadout = {
      weapons: { bolt: WEAPONS.bolt.levels.length + 1 },
      passives: {},
      skills: { dash: 1, nova: 1 },
    };
    expect(mainWeaponCanGrow(loadout)).toBe(false);
    const options = rollUpgradeOptions(loadout, createRng(2), 3, true, 5);
    expect(options.some((o) => o.kind === 'weapon' && o.id === 'bolt')).toBe(false);
  });
});

describe('chests and the main weapon', () => {
  it('chests do not always bring the main weapon', async () => {
    const { rollChest } = await import('./chest');
    const { createStartLoadout } = await import('./stats');
    const { createRng } = await import('./rng');
    const rng = createRng(4);
    let other = 0;
    for (let i = 0; i < 40; i++) {
      for (const u of rollChest(createStartLoadout('bolt'), 1, rng).upgrades) {
        if (!(u.kind === 'weapon' && u.id === 'bolt')) other += 1;
      }
    }
    expect(other).toBeGreaterThan(20);
  });
});
