import { describe, expect, it } from 'vitest';
import { ENEMIES } from '../config/enemies';
import { PASSIVES } from '../config/passives';
import { SKILLS } from '../config/skills';
import { WEAPONS } from '../config/weapons';
import { addXp, formatTime, xpToNext } from './progression';
import { emptySave, loadSave, migrate, recordRun, SAVE_VERSION } from './save';
import { isSegmentCleared, isSegmentWarning, segmentProgress, segmentRemaining } from './segment';
import { enemyHpMultiplier, pickEnemy, spawnIntervalMs } from './spawning';
import {
  applyLevels,
  computePlayerStats,
  computeSkillStats,
  computeWeaponStats,
  createStartLoadout,
  damageAfterArmor,
  weaponMaxLevel,
  type Loadout,
} from './stats';
import { applyUpgrade, availableUpgrades, describeUpgrade, rollUpgradeOptions } from './upgrades';

/** Deterministic RNG for reproducible tests. */
function seeded(seed = 42) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}

describe('progression', () => {
  it('xp curve grows', () => {
    expect(xpToNext(1)).toBe(5);
    for (let l = 1; l < 50; l++) expect(xpToNext(l + 1)).toBeGreaterThan(xpToNext(l));
  });

  it('addXp handles multiple level-ups at once', () => {
    const r = addXp({ level: 1, xp: 0 }, xpToNext(1) + xpToNext(2) + 1);
    expect(r.level).toBe(3);
    expect(r.levelsGained).toBe(2);
    expect(r.xp).toBe(1);
  });

  it('formats time', () => {
    expect(formatTime(0)).toBe('00:00');
    expect(formatTime(125.9)).toBe('02:05');
  });
});

describe('stats', () => {
  it('applies weapon levels cumulatively', () => {
    const lv1 = applyLevels(WEAPONS.bolt.base, WEAPONS.bolt.levels, 1);
    const lv3 = applyLevels(WEAPONS.bolt.base, WEAPONS.bolt.levels, 3);
    expect(lv1.damage).toBe(12);
    expect(lv3.damage).toBe(18);
    expect(lv3.count).toBe(2);
  });

  it('caps levels at max', () => {
    const max = weaponMaxLevel('bolt');
    const a = applyLevels(WEAPONS.bolt.base, WEAPONS.bolt.levels, max);
    const b = applyLevels(WEAPONS.bolt.base, WEAPONS.bolt.levels, max + 5);
    expect(b).toEqual(a);
  });

  it('Lantern Oil raises the light radius for the run', () => {
    expect(computePlayerStats(createStartLoadout('bolt')).light).toBe(1);
    const lit = computePlayerStats({ ...createStartLoadout('bolt'), passives: { lantern: 2 } });
    expect(lit.light).toBeCloseTo(1.3);
  });

  it('passives modify player stats and weapon output', () => {
    const loadout: Loadout = { ...createStartLoadout('bolt'), passives: { might: 2, haste: 1 } };
    const stats = computePlayerStats(loadout);
    expect(stats.might).toBeCloseTo(1.2);
    const w = computeWeaponStats('bolt', 1, stats);
    expect(w.damage).toBeCloseTo(12 * 1.2);
    expect(w.cooldown).toBeCloseTo(900 * 0.92);
  });

  it('skills scale with might', () => {
    const stats = computePlayerStats({ ...createStartLoadout('bolt'), passives: { might: 1 } });
    expect(computeSkillStats('nova', 1, stats).damage).toBeCloseTo(25 * 1.1);
  });

  it('armor never reduces damage below 1', () => {
    expect(damageAfterArmor(5, 10)).toBe(1);
    expect(damageAfterArmor(10, 3)).toBe(7);
  });
});

describe('upgrades', () => {
  it('rolls distinct options', () => {
    const opts = rollUpgradeOptions(createStartLoadout('bolt'), seeded(), 3);
    expect(opts).toHaveLength(3);
    expect(new Set(opts.map((o) => JSON.stringify(o))).size).toBe(3);
  });

  it('never offers maxed upgrades', () => {
    const loadout: Loadout = {
      weapons: { bolt: weaponMaxLevel('bolt') },
      passives: { might: PASSIVES.might.maxLevel },
      skills: { dash: 5, nova: 5 },
    };
    const ids = availableUpgrades(loadout).map((u) => u.option);
    expect(ids.find((o) => o.kind === 'weapon' && o.id === 'bolt')).toBeUndefined();
    expect(ids.find((o) => o.kind === 'passive' && o.id === 'might')).toBeUndefined();
    expect(ids.find((o) => o.kind === 'skill')).toBeUndefined();
  });

  it('falls back to heal when everything is maxed', () => {
    const loadout: Loadout = {
      weapons: Object.fromEntries(
        (Object.keys(WEAPONS) as (keyof typeof WEAPONS)[]).map((id) => [id, weaponMaxLevel(id)]),
      ),
      passives: Object.fromEntries(Object.values(PASSIVES).map((p) => [p.id, p.maxLevel])),
      skills: { dash: SKILLS.dash.levels.length + 1, nova: SKILLS.nova.levels.length + 1 },
    };
    expect(rollUpgradeOptions(loadout, seeded())).toEqual([{ kind: 'heal' }]);
  });

  it('applyUpgrade is immutable', () => {
    const before = createStartLoadout('bolt');
    const after = applyUpgrade(before, { kind: 'weapon', id: 'aura', toLevel: 1 });
    expect(before.weapons.aura).toBeUndefined();
    expect(after.weapons.aura).toBe(1);
  });

  it('every option has a readable card', () => {
    for (const { option } of availableUpgrades(createStartLoadout('bolt'))) {
      const card = describeUpgrade(option);
      expect(card.title.length).toBeGreaterThan(0);
      expect(card.text.length).toBeGreaterThan(0);
    }
  });
});

describe('spawning', () => {
  it('gets harder over time', () => {
    expect(spawnIntervalMs(300)).toBeLessThan(spawnIntervalMs(0));
    expect(enemyHpMultiplier(300)).toBeGreaterThan(enemyHpMultiplier(0));
  });

  it('only picks unlocked enemies', () => {
    const rng = seeded(7);
    for (let i = 0; i < 200; i++) expect(pickEnemy(0, Object.values(ENEMIES), rng).id).toBe('bat');
  });
});

describe('segment', () => {
  const def = {
    id: 'test',
    name: 'Test',
    durationSec: 100,
    warningSec: 10,
    difficultyOffsetSec: 0,
    groundTint: 0,
    herbs: null,
  };

  it('counts down and clears at the duration', () => {
    expect(segmentRemaining(def, 0)).toBe(100);
    expect(segmentRemaining(def, 130)).toBe(0);
    expect(isSegmentCleared(def, 99.9)).toBe(false);
    expect(isSegmentCleared(def, 100)).toBe(true);
    expect(segmentProgress(def, 50)).toBe(0.5);
  });

  it('warns only in the last seconds', () => {
    expect(isSegmentWarning(def, 80)).toBe(false);
    expect(isSegmentWarning(def, 95)).toBe(true);
    expect(isSegmentWarning(def, 100)).toBe(false);
  });
});

describe('save', () => {
  it('migrates old or broken data', () => {
    expect(migrate(null)).toEqual(emptySave());
    expect(migrate({ bestTime: 99 }).bestTime).toBe(99);
    expect(migrate({ bestTime: 99 }).version).toBe(SAVE_VERSION);
  });

  it('survives corrupt storage', () => {
    const broken = { getItem: () => '{nope', setItem: () => {} };
    expect(loadSave(broken)).toEqual(emptySave());
  });

  it('records best values and cleared segments', () => {
    const s = recordRun(recordRun(emptySave(), { time: 60, kills: 10, level: 3, cleared: true }), {
      time: 30,
      kills: 50,
      level: 2,
      cleared: false,
    });
    expect(s).toMatchObject({ bestTime: 60, bestKills: 50, bestLevel: 3, runs: 2, segmentsCleared: 1 });
  });

  it('migrates a version 1 save without losing data', () => {
    const v1 = { version: 1, bestTime: 120, bestKills: 300, bestLevel: 9, runs: 4 };
    expect(migrate(v1)).toEqual({
      ...v1,
      version: SAVE_VERSION,
      segmentsCleared: 0,
      world: emptySave().world,
      stash: {},
      belt: {},
      quests: emptySave().quests,
    });
  });

  it('migrates a version 4 save and keeps stash and belt valid', () => {
    const v4 = { ...emptySave(), version: 4, stash: { moonbloom: 3 } } as Record<string, unknown>;
    delete v4.belt;
    expect(migrate(v4)).toMatchObject({ version: SAVE_VERSION, stash: { moonbloom: 3 }, belt: {} });
    expect(migrate({ ...v4, belt: { healing: 2 } }).belt).toEqual({ healing: 2 });
  });
});
