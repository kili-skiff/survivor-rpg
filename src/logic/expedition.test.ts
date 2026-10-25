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
import { finishFight, teleport, walkHome } from './journey';
import { emptySave, migrate, type SaveData } from './save';
import { computePlayerStats, createStartLoadout } from './stats';
import { generateWorld, type World } from './worldgen';
import { travelKind } from './worldProgress';

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
    expect(save.world.expedition?.build?.hp).toBe(computePlayerStats(createStartLoadout('bolt')).maxHp);
  });

  it('ends the expedition on death, back home with half the loot', () => {
    const out = finishFight(emptySave(), world, { q: 1, r: 0 }, 'cleared', build(), { herb: 3 }).save;
    const { save, report } = finishFight(out, world, { q: 2, r: 0 }, 'fallen', build(), { herb: 2 });
    expect(save.world.position).toBe('0,0');
    expect(save.world.expedition).toBeNull();
    expect(save.stash).toEqual({ herb: 2 });
    expect(report.lootLost).toEqual({ herb: 3 });
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

  it('survives a save round trip and rejects broken data', () => {
    const out = finishFight(emptySave(), world, { q: 1, r: 0 }, 'cleared', build(), { herb: 1 }).save;
    const loaded = migrate(JSON.parse(JSON.stringify(out)));
    expect(loaded.world.expedition).toEqual(out.world.expedition);
    expect(
      parseExpedition({ startedFrom: '0,0', build: { level: 2, xp: 0, hp: 10, loadout: { weapons: {} } } })
        ?.build,
    ).toBeNull();
    expect(parseExpedition('nope')).toBeNull();
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
