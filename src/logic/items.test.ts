import { describe, expect, it } from 'vitest';
// The icons are drawn in code, so the test reads the source of the scene that draws them.
import boot from '../scenes/BootScene.ts?raw';
import { ITEMS } from '../config/balance';
import { BOON_DEFS } from '../config/boons';
import { BASE_PLAYER_STATS, PASSIVES } from '../config/passives';
import { RARITIES } from '../config/rarity';
import { SKILLS } from '../config/skills';
import type { BoonId, PassiveId, WeaponId } from '../config/types';
import { WEAPONS } from '../config/weapons';
import { buildChain, chainDamage, pickChainStart, type ChainTarget } from './chain';
import { dropsChest, rollChest } from './chest';
import { neutralMods, resolveHit, situationalDamage } from './hitEffects';
import { computePlayerStats, computeSkillStats, computeWeaponStats, createStartLoadout } from './stats';
import { availableUpgrades, describeUpgrade, rollUpgradeOptions } from './upgrades';
import type { Loadout } from './stats';

function loadoutWith(passives: Partial<Record<PassiveId, number>>): Loadout {
  return { ...createStartLoadout('bolt'), passives };
}

describe('items', () => {
  it('only change stats that exist', () => {
    for (const def of Object.values(PASSIVES)) {
      for (const key of Object.keys(def.perLevel)) expect(key in BASE_PLAYER_STATS).toBe(true);
    }
  });

  it('have no limit: a new one is offered however many are owned', () => {
    const all = Object.keys(PASSIVES) as PassiveId[];
    const owned = Object.fromEntries(all.slice(0, all.length - 1).map((id) => [id, 1]));
    const options = availableUpgrades(loadoutWith(owned)).map((u) => u.option);
    const last = all[all.length - 1];
    expect(options.some((o) => o.kind === 'passive' && o.id === last && o.toLevel === 1)).toBe(true);
  });

  it('start with base values that change nothing', () => {
    const player = computePlayerStats(createStartLoadout('bolt'));
    const base = WEAPONS.bolt.base;
    const stats = computeWeaponStats('bolt', 1, player);
    expect(stats.count).toBe(base.count);
    expect(stats.pierce).toBe(base.pierce);
    expect(stats.area).toBe(base.area);
    expect(stats.splash).toBe(base.splash);
    expect(stats.knockback).toBe(base.knockback);
  });

  it('feed into every weapon', () => {
    const player = computePlayerStats(
      loadoutWith({ twin: 2, piercing: 1, force: 2, volatile: 1, rend: 3, reach: 2 }),
    );
    const bolt = computeWeaponStats('bolt', 1, player);
    expect(bolt.count).toBe(WEAPONS.bolt.base.count + 2);
    expect(bolt.pierce).toBe(WEAPONS.bolt.base.pierce + 1);
    expect(bolt.knockback).toBe(180);
    expect(bolt.splash).toBe(PASSIVES.volatile.perLevel.blast);
    expect(bolt.percent).toBeCloseTo(0.03);
    expect(bolt.area).toBeCloseTo(1.24);
  });

  it('give extra pierce only to weapons that pierce', () => {
    const player = computePlayerStats(loadoutWith({ piercing: 3 }));
    expect(computeWeaponStats('blades', 1, player).pierce).toBe(0);
    expect(computeWeaponStats('chain', 1, player).pierce).toBe(0);
  });

  it('make skills faster and wider', () => {
    const player = computePlayerStats(loadoutWith({ quickhands: 2, reach: 1 }));
    const plain = computeSkillStats('nova', 1, computePlayerStats(createStartLoadout('bolt')));
    const nova = computeSkillStats('nova', 1, player);
    expect(nova.cooldown).toBeCloseTo(plain.cooldown * 0.7);
    expect(nova.radius).toBeCloseTo(plain.radius * 1.12);
  });

  it('keep chances and cooldowns inside sane limits', () => {
    const player = computePlayerStats(
      loadoutWith({ keenedge: 5, shadowstep: 5, quickhands: 4, emberheart: 5 }),
      { crit: 3, dodge: 3, skillHaste: -3 },
    );
    expect(player.crit).toBe(1);
    expect(player.dodge).toBe(ITEMS.maxDodge);
    expect(player.skillHaste).toBe(ITEMS.minSkillHaste);
  });

  it('Blood Pact trades health for damage', () => {
    const player = computePlayerStats(loadoutWith({ bloodpact: 2 }));
    expect(player.might).toBeCloseTo(1.4);
    expect(player.curse).toBeCloseTo(0.3);
  });
});

describe('hit modifiers', () => {
  const target = { hp: 100, maxHp: 100, elite: false };

  it('change nothing by default', () => {
    expect(resolveHit(10, neutralMods(), target, () => 0)).toEqual({
      damage: 10,
      crit: false,
      executed: false,
    });
  });

  it('crit on a lucky roll only', () => {
    const mods = { ...neutralMods(), crit: 0.3, critMul: 2.5 };
    expect(resolveHit(10, mods, target, () => 0.29).damage).toBe(25);
    expect(resolveHit(10, mods, target, () => 0.31).damage).toBe(10);
    expect(resolveHit(10, mods, target, () => 0.29).crit).toBe(true);
  });

  it('deal extra damage to elites', () => {
    const mods = { ...neutralMods(), eliteMul: 1.5 };
    expect(resolveHit(10, mods, { ...target, elite: true }, () => 1).damage).toBe(15);
    expect(resolveHit(10, mods, target, () => 1).damage).toBe(10);
  });

  it('execute enemies below the threshold, elites at a quarter of it', () => {
    const mods = { ...neutralMods(), execute: 0.2 };
    const weak = { hp: 15, maxHp: 100, elite: false };
    expect(resolveHit(1, mods, weak, () => 1)).toMatchObject({ damage: 15, executed: true });
    expect(resolveHit(1, mods, { ...weak, hp: 30 }, () => 1).executed).toBe(false);
    expect(resolveHit(1, mods, { ...weak, elite: true }, () => 1).executed).toBe(false);
    expect(resolveHit(1, mods, { ...weak, hp: 4, elite: true }, () => 1).executed).toBe(true);
  });

  it('scale with the situation', () => {
    const calm = { moving: false, momentum: 0.5, hpShare: 1, desperation: 1, surge: 0 };
    expect(situationalDamage(calm)).toBe(1);
    expect(situationalDamage({ ...calm, moving: true })).toBeCloseTo(1.5);
    expect(situationalDamage({ ...calm, hpShare: 0.25 })).toBeCloseTo(1.75);
    expect(situationalDamage({ ...calm, surge: 0.5 })).toBeCloseTo(1.5);
    expect(situationalDamage({ ...calm, moving: true, hpShare: 0, surge: 0.5 })).toBeCloseTo(4.5);
  });
});

describe('chain lightning', () => {
  const at = (id: number, x: number, y: number): ChainTarget => ({ id, x, y, r: 10 });

  it('starts at the nearest enemy', () => {
    const targets = [at(0, 200, 0), at(1, 80, 0), at(2, 0, 120)];
    expect(pickChainStart(targets, 0, 0, 300, 0, 100, new Set())?.id).toBe(1);
  });

  it('ignores enemies out of reach or already struck', () => {
    const targets = [at(0, 500, 0), at(1, 80, 0)];
    expect(pickChainStart(targets, 0, 0, 300, 0, 100, new Set([1]))).toBeUndefined();
  });

  it('seeks the biggest crowd when it should', () => {
    const targets = [at(0, 50, 0), at(1, 250, 0), at(2, 260, 20), at(3, 240, -20)];
    expect(pickChainStart(targets, 0, 0, 300, 0, 100, new Set())?.id).toBe(0);
    const seeker = pickChainStart(targets, 0, 0, 300, 1, 100, new Set());
    expect([1, 2, 3]).toContain(seeker?.id);
  });

  it('jumps to the nearest enemy not hit yet', () => {
    const targets = [at(0, 0, 0), at(1, 60, 0), at(2, 120, 0), at(3, 400, 0)];
    const path = buildChain(targets[0], targets, 5, 100);
    expect(path.map((t) => t.id)).toEqual([0, 1, 2]);
  });

  it('never jumps further than it has jumps', () => {
    const targets = [0, 1, 2, 3, 4].map((i) => at(i, i * 40, 0));
    expect(buildChain(targets[0], targets, 2, 100)).toHaveLength(3);
    expect(buildChain(targets[0], targets, 0, 100)).toHaveLength(1);
  });

  it('loses a little damage with every jump', () => {
    expect(chainDamage(10, 0, 0.9)).toBe(10);
    expect(chainDamage(10, 2, 0.9)).toBeCloseTo(8.1);
  });

  it('grows stronger with every level', () => {
    const player = computePlayerStats(createStartLoadout('chain'));
    const first = computeWeaponStats('chain', 1, player);
    const last = computeWeaponStats('chain', WEAPONS.chain.levels.length + 1, player);
    expect(last.chains).toBeGreaterThan(first.chains);
    expect(last.count).toBeGreaterThan(first.count);
    expect(last.damage).toBeGreaterThan(first.damage);
    expect(last.seek).toBe(1);
  });
});

describe('one-time cards', () => {
  const start = createStartLoadout('bolt');

  it('are offered next to the build upgrades', () => {
    const boons = availableUpgrades(start).filter((u) => u.option.kind === 'boon');
    expect(boons).toHaveLength(Object.keys(BOON_DEFS).length);
  });

  it('can be left out', () => {
    expect(availableUpgrades(start, false).some((u) => u.option.kind === 'boon')).toBe(false);
  });

  it('have readable cards that do not claim a place in the build', () => {
    for (const id of Object.keys(BOON_DEFS) as BoonId[]) {
      const card = describeUpgrade({ kind: 'boon', id });
      expect(card.title.length).toBeGreaterThan(0);
      expect(card.text.length).toBeGreaterThan(0);
      expect(card.badge).toBe('ONE-TIME');
    }
  });

  it('never come out of a chest', () => {
    for (let seed = 1; seed < 60; seed++) {
      let s = seed;
      const rng = () => {
        s = (s * 1664525 + 1013904223) % 4294967296;
        return s / 4294967296;
      };
      expect(rollChest(start, 1, rng).upgrades.some((o) => o.kind === 'boon')).toBe(false);
    }
  });
});

describe('Fortune', () => {
  it('raises the chance of a chest', () => {
    expect(dropsChest(false, () => 0.004)).toBe(false);
    expect(dropsChest(false, () => 0.004, 0.5)).toBe(true);
  });
});

describe('icons', () => {
  const hasIcon = (texture: string) => boot.includes(`icon('${texture}'`);

  it('exist for every weapon, item and one-time card', () => {
    const missing: string[] = [];
    for (const id of Object.keys(WEAPONS) as WeaponId[]) {
      if (!hasIcon(WEAPONS[id].texture)) missing.push(WEAPONS[id].texture);
    }
    for (const def of Object.values(PASSIVES)) if (!hasIcon(def.texture)) missing.push(def.texture);
    for (const def of Object.values(BOON_DEFS)) if (!hasIcon(def.texture)) missing.push(def.texture);
    expect(missing).toEqual([]);
  });
});

describe('rarity', () => {
  const defs = [
    ...Object.values(WEAPONS),
    ...Object.values(PASSIVES),
    ...Object.values(SKILLS),
    ...Object.values(BOON_DEFS),
  ];

  it('is set for every card and known', () => {
    for (const def of defs) expect(Object.keys(RARITIES)).toContain(def.rarity);
  });

  it('has colours that differ and weights that fall with rarity', () => {
    const { common, magic, legendary } = RARITIES;
    expect(new Set([common.color, magic.color, legendary.color]).size).toBe(3);
    expect(common.weight).toBeGreaterThan(magic.weight);
    expect(magic.weight).toBeGreaterThan(legendary.weight);
  });

  it('every rarity is in use', () => {
    for (const rarity of Object.keys(RARITIES)) expect(defs.some((d) => d.rarity === rarity)).toBe(true);
  });

  it('shows on the card', () => {
    expect(describeUpgrade({ kind: 'boon', id: 'judgement' }).rarity).toBe('legendary');
    expect(describeUpgrade({ kind: 'passive', id: 'might', toLevel: 2 }).rarity).toBe('common');
    expect(describeUpgrade({ kind: 'heal' }).rarity).toBe('common');
  });

  it('makes legendary cards turn up less often than common ones', () => {
    let s = 7;
    const rng = () => {
      s = (s * 1664525 + 1013904223) % 4294967296;
      return s / 4294967296;
    };
    const seen = { common: 0, magic: 0, legendary: 0 };
    for (let i = 0; i < 400; i++) {
      // Without a main weapon, so no card is set aside for it.
      for (const o of rollUpgradeOptions({ ...createStartLoadout('bolt'), weapons: { aura: 1 } }, rng, 1)) {
        seen[describeUpgrade(o).rarity] += 1;
      }
    }
    expect(seen.common).toBeGreaterThan(seen.legendary);
    expect(seen.legendary).toBeGreaterThan(0);
  });
});
