// Moving around the world: fights, walking, teleporting, and what that does to the
// expedition and the village stash. Everything here works on the whole save and is pure.

import { BALANCE } from '../config/balance';
import type { DeedDef } from '../config/deeds';
import { WORLD } from '../config/world';
import {
  addLoot,
  extendPath,
  lootAfterDeath,
  startExpedition,
  type ExpeditionBuild,
  type Loot,
} from './expedition';
import { hexKey, ORIGIN, type Hex } from './hex';
import type { SaveData } from './save';
import type { RunOutcome } from './segment';
import { earnDeeds } from './deeds';
import { hearthBonus } from './hearth';
import { completeFireQuest } from './quests';
import { EMBER_KEY } from '../config/merchant';
import { computePlayerStats } from './stats';
import type { World } from './worldgen';
import {
  addWaypoint,
  applyFightResult,
  isLit,
  lightWatchfire,
  walkTo,
  type WorldProgress,
} from './worldProgress';

export interface FightReport {
  outcome: RunOutcome;
  /** Reached a camp: healed and unlocked as a waypoint */
  rested: boolean;
  /** Lit a watchfire: the land around it is revealed */
  litWatchfire: boolean;
  /** Deeds earned by this fight (e.g. a new ring reached) */
  deeds: DeedDef[];
  /** Embers from the first watchfire quest, earned by this fight (0 when none) */
  questEmbers: number;
  /** Loot kept after a death (half of it), or null when the expedition goes on */
  lootKept: Loot | null;
  lootLost: Loot | null;
}

/** Ends the expedition at home and moves its loot into the village stash. */
function endExpeditionAtHome(save: SaveData, world: WorldProgress): SaveData {
  const loot = world.expedition?.loot ?? {};
  // Only an expedition that was under way counts as finished.
  const expeditions = world.expeditions + (world.expedition ? 1 : 0);
  return { ...save, stash: addLoot(save.stash, loot), world: { ...world, expedition: null, expeditions } };
}

/** The build a fight starts with: the expedition's build, or null for a fresh character. */
export function currentBuild(save: SaveData): ExpeditionBuild | null {
  return save.world.expedition?.build ?? null;
}

/**
 * Applies the end of a fight in `target`.
 * - Cleared: you stand on the hex, your build and loot carry on. Camps heal you fully and
 *   become waypoints.
 * - Fallen (or given up): the expedition ends, you wake up in the village and lose the loot
 *   (all of it, or what BALANCE.lootKeptOnDeath does not keep).
 */
export function finishFight(
  save: SaveData,
  world: World,
  target: Hex,
  outcome: RunOutcome,
  build: ExpeditionBuild,
  gained: Loot,
): { save: SaveData; report: FightReport } {
  const expedition = save.world.expedition ?? startExpedition(save.world.position);
  const loot = addLoot(expedition.loot, gained);

  if (outcome === 'fallen') {
    const kept = lootAfterDeath(loot, BALANCE.lootKeptOnDeath);
    const lost: Loot = {};
    for (const [id, n] of Object.entries(loot)) if (n - (kept[id] ?? 0) > 0) lost[id] = n - (kept[id] ?? 0);
    const fallen = applyFightResult(save.world, target, 'fallen');
    const progress = { ...fallen, expedition: null, expeditions: fallen.expeditions + 1 };
    return {
      save: { ...save, stash: addLoot(save.stash, kept), world: progress },
      report: {
        outcome,
        rested: false,
        litWatchfire: false,
        deeds: [],
        questEmbers: 0,
        lootKept: kept,
        lootLost: lost,
      },
    };
  }

  const key = hexKey(target);
  const isCamp = world.hexes.get(key)?.poi === 'camp';
  let progress = applyFightResult(save.world, target, 'cleared');
  if (isCamp) progress = addWaypoint(progress, key);
  const litWatchfire = world.hexes.get(key)?.poi === 'watchfire' && !isLit(progress, key);
  if (litWatchfire) progress = lightWatchfire(progress, key, WORLD.watchfireRevealRadius);
  // Reaching a new ring, camp or watchfire can earn deeds; they are saved with this fight.
  const { save: earnedSave, earned } = earnDeeds({ ...save, world: progress }, world);
  // The first watchfire you light completes the elder's quest and pays embers straight into the stash.
  const fire = completeFireQuest(earnedSave.quests, litWatchfire);
  const next: SaveData =
    fire.embers > 0
      ? {
          ...earnedSave,
          quests: fire.quests,
          stash: addLoot(earnedSave.stash, { [EMBER_KEY]: fire.embers }),
        }
      : earnedSave;
  // Camps heal fully, including health from the Hearth.
  const maxHp = computePlayerStats(build.loadout, hearthBonus(next.hearth)).maxHp;
  const nextBuild = isCamp ? { ...build, hp: maxHp } : build;
  return {
    save: {
      ...next,
      world: {
        ...next.world,
        expedition: {
          ...expedition,
          build: nextBuild,
          loot,
          areasCleared: expedition.areasCleared + 1,
          cleared: expedition.cleared.includes(key) ? expedition.cleared : [...expedition.cleared, key],
          path: extendPath(expedition.path, key),
        },
      },
    },
    report: {
      outcome,
      rested: isCamp,
      litWatchfire,
      deeds: earned,
      questEmbers: fire.embers,
      lootKept: null,
      lootLost: null,
    },
  };
}

/** Walking into a neighbouring hex without a fight. Only the village is reachable this way. */
export function walkHome(save: SaveData, target: Hex): SaveData {
  return endExpeditionAtHome(save, walkTo(save.world, target));
}

/** Walking back into a hex cleared on this expedition: no fight, the expedition goes on. */
export function walkThrough(save: SaveData, target: Hex): SaveData {
  const moved = walkTo(save.world, target);
  const expedition = moved.expedition;
  return {
    ...save,
    world: expedition
      ? { ...moved, expedition: { ...expedition, path: extendPath(expedition.path, hexKey(target)) } }
      : moved,
  };
}

/** Going home from wherever you are: the expedition ends and all its loot goes into the stash. */
export function returnHome(save: SaveData): SaveData {
  return endExpeditionAtHome(save, walkTo(save.world, ORIGIN));
}

/** Teleporting: from a waypoint back to the village (keeps the loot), or from the village to a waypoint. */
export function teleport(save: SaveData, target: Hex): SaveData {
  const moved = walkTo(save.world, target);
  if (hexKey(target) === hexKey(ORIGIN)) return endExpeditionAtHome(save, moved);
  // Setting out from a waypoint starts a fresh expedition there.
  return { ...save, world: { ...moved, expedition: startExpedition(hexKey(target)) } };
}
