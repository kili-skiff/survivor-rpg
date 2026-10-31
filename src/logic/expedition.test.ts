import { describe, expect, it } from 'vitest';
import { hexKey, hexNeighbors, ORIGIN, type Hex } from './hex';
import {
  addLoot,
  lootAfterDeath,
  lootGained,
  parseExpedition,
  startExpedition,
  type ExpeditionBuild,
} from './expedition';
import { GOLD_KEY } from '../config/merchant';
import { deedBonus } from './deeds';
import { acceptFireQuest, freshQuests } from './quests';
import { finishFight, returnHome, teleport, walkHome, walkThrough } from './journey';
import { emptySave, migrate, type SaveData } from './save';
import { computePlayerStats, createStartLoadout } from './stats';
import { generateWorld, type World } from './worldgen';
import { isUsedUp, travelKind } from './worldProgress';

const world: World = generateWorld('expedition-test', 1);
const camp = [...world.hexes.values()].find((h) => h.poi === 'camp' && h.ring <= 2)!;

function build(hp = 40, level = 3): ExpeditionBuild {
  return { level, xp: 2, hp, loadout: createStartLoadout('bolt') };
}

/** A path from the village to `target` along neighbours (straight towards it). */
function pathTo(target: Hex): Hex[] {
  const path: Hex[] = [];
  let cur = ORIGIN;
  while (hexKey(cur) !== hexKey(target)) {
    cur = hexNeighbors(cur).reduce((best, n) =>
      Math.abs(n.q - target.q) + Math.abs(n.r - target.r) + Math.abs(-n.q - n.r + target.q + target.r) <
      Math.abs(best.q - target.q) +
        Math.abs(best.r - target.r) +
        Math.abs(-best.q - best.r + target.q + target.r)
        ? n
        : best,
    );
    path.push(cur);
  }
  return path;
}

function clearPath(save: SaveData, path: Hex[], gained = {}): SaveData {
  for (const hex of path) save = finishFight(save, world, hex, 'cleared', build(), gained).save;
  return save;
}

describe('loot', () => {
  it('adds stacks and keeps half on death, rounded down', () => {
    expect(addLoot({ herb: 2 }, { herb: 3, root: 1 })).toEqual({ herb: 5, root: 1 });
    expect(lootAfterDeath({ herb: 5, root: 1 }, 0.5)).toEqual({ herb: 2 });
  });

  it('computes what was gained between two stashes', () => {
    expect(lootGained({ herb: 2 }, { herb: 5, root: 1 })).toEqual({ herb: 3, root: 1 });
    expect(lootGained({ herb: 2 }, { herb: 2 })).toEqual({});
  });
});

describe('expeditions', () => {
  it('carries the build over and counts cleared areas', () => {
    const first = { q: 1, r: 0 };
    const { save } = finishFight(emptySave(), world, first, 'cleared', build(30, 4), { herb: 2 });
    expect(save.world.expedition?.build).toMatchObject({ hp: 30, level: 4 });
    expect(save.world.expedition?.areasCleared).toBe(1);
    expect(save.world.expedition?.loot).toEqual({ herb: 2 });
    expect(save.world.position).toBe('1,0');
  });

  it('heals at camps and unlocks them as waypoints', () => {
    const path = pathTo(camp.hex);
    const before = clearPath(emptySave(), path.slice(0, -1));
    const { save, report } = finishFight(before, world, camp.hex, 'cleared', build(5), {});
    expect(report.rested).toBe(true);
    expect(save.world.waypoints).toContain(camp.key);
    // Fully healed, including health from deeds (reaching ring 2 can earn one right here).
    expect(save.world.expedition?.build?.hp).toBe(
      computePlayerStats(createStartLoadout('bolt'), deedBonus(save.deeds)).maxHp,
    );
  });

  it('ends the expedition on death, back home without the loot', () => {
    const out = finishFight(emptySave(), world, { q: 1, r: 0 }, 'cleared', build(), { herb: 3 }).save;
    const { save, report } = finishFight(out, world, { q: 2, r: 0 }, 'fallen', build(), { herb: 2 });
    expect(save.world.position).toBe('0,0');
    expect(save.world.expedition).toBeNull();
    expect(save.stash).toEqual({});
    expect(report.lootKept).toEqual({});
    expect(report.lootLost).toEqual({ herb: 5 });
  });

  it('banks all loot when walking home', () => {
    const out = finishFight(emptySave(), world, { q: 1, r: 0 }, 'cleared', build(), { herb: 3 }).save;
    expect(travelKind(world, out.world, ORIGIN)).toBe('walk');
    const home = walkHome(out, ORIGIN);
    expect(home.world.expedition).toBeNull();
    expect(home.stash).toEqual({ herb: 3 });
  });

  it('teleports between the village and waypoints', () => {
    const path = pathTo(camp.hex);
    let save = clearPath(emptySave(), path, { herb: 1 });
    // From the camp back home: keeps the loot.
    if (camp.ring > 1) expect(travelKind(world, save.world, ORIGIN)).toBe('teleport');
    save = teleport(save, ORIGIN);
    expect(save.world.position).toBe('0,0');
    expect(save.stash).toEqual({ herb: path.length });
    // From home to the camp: starts a fresh expedition there.
    expect(travelKind(world, save.world, camp.hex)).toBe(camp.ring > 1 ? 'teleport' : 'fight');
    save = teleport(save, camp.hex);
    expect(save.world.position).toBe(camp.key);
    expect(save.world.expedition).toEqual(startExpedition(camp.key));
  });

  it('walks back through hexes cleared on this expedition without a fight', () => {
    const first = { q: 1, r: 0 };
    const second = { q: 2, r: 0 };
    let save = clearPath(emptySave(), [first, second]);
    expect(isUsedUp(save.world, '1,0')).toBe(true);
    expect(travelKind(world, save.world, first)).toBe('walk');
    save = walkThrough(save, first);
    expect(save.world.position).toBe('1,0');
    expect(save.world.expedition?.cleared).toEqual(['1,0', '2,0']);
    // A fresh expedition starts with every hex full again.
    const home = walkHome(save, ORIGIN);
    expect(isUsedUp(home.world, '1,0')).toBe(false);
    expect(travelKind(world, home.world, first)).toBe('fight');
  });

  it('returns home from anywhere and keeps all loot', () => {
    const save = clearPath(
      emptySave(),
      [
        { q: 1, r: 0 },
        { q: 2, r: 0 },
      ],
      { herb: 2 },
    );
    const home = returnHome(save);
    expect(home.world.position).toBe('0,0');
    expect(home.world.expedition).toBeNull();
    expect(home.stash).toEqual({ herb: 4 });
  });

  it('lights a watchfire when its hex is cleared', () => {
    const fire = [...world.hexes.values()].find((h) => h.poi === 'watchfire')!;
    const { save, report } = finishFight(emptySave(), world, fire.hex, 'cleared', build(), {});
    expect(report.litWatchfire).toBe(true);
    expect(save.world.litWatchfires).toEqual([fire.key]);
    const again = finishFight(save, world, fire.hex, 'cleared', build(), {});
    expect(again.report.litWatchfire).toBe(false);
  });

  it('survives a save round trip and rejects broken data', () => {
    const out = finishFight(emptySave(), world, { q: 1, r: 0 }, 'cleared', build(), { herb: 1 }).save;
    const loaded = migrate(JSON.parse(JSON.stringify(out)));
    expect(loaded.world.expedition).toEqual(out.world.expedition);
    expect(
      parseExpedition({ startedFrom: '0,0', build: { level: 2, xp: 0, hp: 10, loadout: { weapons: {} } } })
        ?.build,
    ).toBeNull();
    expect(parseExpedition('nope')).toBeNull();
    expect(parseExpedition({ startedFrom: '0,0' })?.cleared).toEqual([]);
  });

  it('migrates version 3 saves with empty stash and no expedition', () => {
    const v3 = {
      version: 3,
      runs: 1,
      world: { ...emptySave().world, waypoints: undefined, expedition: undefined },
    };
    const save = migrate(v3);
    expect(save.stash).toEqual({});
    expect(save.world.waypoints).toEqual([]);
    expect(save.world.expedition).toBeNull();
  });
});

describe('watchfire quest reward', () => {
  const fire = [...world.hexes.values()].find((h) => h.poi === 'watchfire')!;

  it('pays gold into the stash when the first watchfire is lit, only once', () => {
    const active = { ...emptySave(), quests: acceptFireQuest(freshQuests()) };
    const first = finishFight(active, world, fire.hex, 'cleared', build(), {});
    expect(first.report.litWatchfire).toBe(true);
    expect(first.report.questGold).toBeGreaterThan(0);
    expect(first.save.quests.fire).toBe('done');
    expect(first.save.stash[GOLD_KEY]).toBe(first.report.questGold);
    // Fighting there again lights nothing new and pays nothing.
    const again = finishFight(first.save, world, fire.hex, 'cleared', build(), {});
    expect(again.report.questGold).toBe(0);
    expect(again.save.stash[GOLD_KEY]).toBe(first.save.stash[GOLD_KEY]);
  });

  it('pays nothing without the quest', () => {
    const idle = { ...emptySave(), quests: { ...freshQuests(), fire: 'offered' as const } };
    const { report, save } = finishFight(idle, world, fire.hex, 'cleared', build(), {});
    expect(report.questGold).toBe(0);
    expect(save.stash[GOLD_KEY]).toBeUndefined();
  });
});

describe('expedition count', () => {
  const first = hexNeighbors(ORIGIN)[0];

  it('counts an expedition that ends at home', () => {
    const out = finishFight(emptySave(), world, first, 'cleared', build(), {}).save;
    expect(out.world.expeditions).toBe(0);
    expect(returnHome(out).world.expeditions).toBe(1);
  });

  it('counts an expedition that ends in death', () => {
    const { save } = finishFight(emptySave(), world, first, 'fallen', build(), {});
    expect(save.world.expeditions).toBe(1);
  });

  it('does not count going home without an expedition', () => {
    expect(returnHome(emptySave()).world.expeditions).toBe(0);
  });

  it('is 0 in older saves', () => {
    const old = emptySave() as unknown as { world: Record<string, unknown> };
    delete old.world.expeditions;
    expect(migrate(old).world.expeditions).toBe(0);
  });
});
