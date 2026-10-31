import { describe, expect, it } from 'vitest';
import { PASSIVES } from '../config/passives';
import { WEAPONS } from '../config/weapons';
import { rollChest } from './chest';
import { parseExpedition } from './expedition';
import {
  computePlayerStats,
  computeWeaponStats,
  createStartLoadout,
  remainingSteps,
  weaponMaxLevel,
  weaponSteps,
  type Loadout,
} from './stats';
import { applyUpgrade, describeUpgrade, rollUpgradeOptions } from './upgrades';

function seeded(seed: number) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}

/** Takes every bolt card until the bolt is maxed; nothing else is offered. */
function growBolt(seed: number): Loadout {
  const rng = seeded(seed);
  let loadout: Loadout = { ...createStartLoadout('bolt'), passives: maxedPassives() };
  for (let i = 0; i < 40 && (loadout.weapons.bolt ?? 0) < weaponMaxLevel('bolt'); i++) {
    const bolt = rollUpgradeOptions(loadout, rng, 99, false).find(
      (o) => o.kind === 'weapon' && o.id === 'bolt',
    );
    if (!bolt) break;
    loadout = applyUpgrade(loadout, bolt);
  }
  return loadout;
}

function maxedPassives(): Loadout['passives'] {
  return Object.fromEntries(Object.values(PASSIVES).map((p) => [p.id, p.maxLevel]));
}

describe('random weapon steps', () => {
  it('a weapon card carries one of the missing steps, with its text', () => {
    const loadout: Loadout = {
      ...createStartLoadout('bolt'),
      weapons: { bolt: 2 },
      weaponSteps: { bolt: [3] },
    };
    for (let seed = 1; seed < 30; seed++) {
      const card = rollUpgradeOptions(loadout, seeded(seed), 99, false).find(
        (o) => o.kind === 'weapon' && o.id === 'bolt',
      );
      if (card?.kind !== 'weapon') throw new Error('no bolt card');
      expect(card.step).toBeDefined();
      expect(card.step).not.toBe(3);
      expect(describeUpgrade(card).text).toBe(WEAPONS.bolt.levels[card.step!].text);
    }
  });

  it('come in different orders in different runs', () => {
    const orders = new Set([1, 2, 3, 4, 5].map((seed) => growBolt(seed).weaponSteps?.bolt?.join(',')));
    expect(orders.size).toBeGreaterThan(1);
  });

  it('end with every step exactly once at the highest level', () => {
    const loadout = growBolt(7);
    expect(loadout.weapons.bolt).toBe(weaponMaxLevel('bolt'));
    expect([...weaponSteps(loadout, 'bolt')].sort((a, b) => a - b)).toEqual(
      WEAPONS.bolt.levels.map((_, i) => i),
    );
    expect(remainingSteps(loadout, 'bolt')).toEqual([]);
  });

  it('give the same stats at the highest level, whatever the order', () => {
    const player = computePlayerStats(createStartLoadout('bolt'));
    const a = growBolt(1);
    const b = growBolt(2);
    const max = weaponMaxLevel('bolt');
    expect(computeWeaponStats('bolt', max, player, weaponSteps(a, 'bolt'))).toEqual(
      computeWeaponStats('bolt', max, player, weaponSteps(b, 'bolt')),
    );
  });

  it('count the steps taken, not the first ones in order', () => {
    const player = computePlayerStats(createStartLoadout('bolt'));
    // Step 2 of the bolt is +1 bolt.
    const stats = computeWeaponStats('bolt', 2, player, [2]);
    expect(stats.count).toBe(WEAPONS.bolt.base.count + 1);
    expect(stats.splash).toBe(0);
  });

  it('a new weapon starts without steps', () => {
    const loadout = applyUpgrade(createStartLoadout('bolt'), { kind: 'weapon', id: 'aura', toLevel: 1 });
    expect(weaponSteps(loadout, 'aura')).toEqual([]);
  });

  it('a chest never gives the same step twice', () => {
    for (let seed = 1; seed < 40; seed++) {
      const start: Loadout = { ...createStartLoadout('bolt'), passives: maxedPassives() };
      let build = start;
      for (const option of rollChest(start, 1, seeded(seed)).upgrades) build = applyUpgrade(build, option);
      const steps = weaponSteps(build, 'bolt');
      expect(new Set(steps).size).toBe(steps.length);
    }
  });
});

describe('saved weapon steps', () => {
  const expedition = (loadout: unknown) =>
    parseExpedition({ startedFrom: 'village', build: { loadout, level: 3, xp: 0, hp: 50 } });

  it('are read back', () => {
    const e = expedition({ weapons: { bolt: 3 }, weaponSteps: { bolt: [4, 1] }, passives: {}, skills: {} });
    expect(weaponSteps(e!.build!.loadout, 'bolt')).toEqual([4, 1]);
  });

  it('older saves without them count the first steps in order', () => {
    const e = expedition({ weapons: { bolt: 3 }, passives: {}, skills: {} });
    expect(weaponSteps(e!.build!.loadout, 'bolt')).toEqual([0, 1]);
  });

  it('a list that does not fit the level is dropped', () => {
    const e = expedition({ weapons: { bolt: 3 }, weaponSteps: { bolt: [4, 4] }, passives: {}, skills: {} });
    expect(weaponSteps(e!.build!.loadout, 'bolt')).toEqual([0, 1]);
  });
});
