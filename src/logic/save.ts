// Versioned save data: old saves are migrated instead of discarded.

import { SEASON } from '../config/world';
import { parseLoot, type Loot } from './expedition';
import { parseBelt, type Belt } from './potions';
import { freshQuests, parseQuests, type QuestProgress } from './quests';
import { createWorldProgress, parseWorldProgress, type WorldProgress } from './worldProgress';

export const SAVE_VERSION = 7;
const SAVE_KEY = 'survivor-rpg.save';

export interface SaveData {
  version: number;
  bestTime: number;
  bestKills: number;
  bestLevel: number;
  runs: number;
  /** Added in version 2 */
  segmentsCleared: number;
  /** Added in version 3: progress on the current season's map */
  world: WorldProgress;
  /** Added in version 4: loot brought home, kept across seasons */
  stash: Loot;
  /** Added in version 5: potions packed for expeditions, refilled in the village */
  belt: Belt;
  /** Added in version 7: quests from villagers; kept when the map is reset */
  quests: QuestProgress;
}

export interface RunResult {
  time: number;
  kills: number;
  level: number;
  cleared: boolean;
}

export interface KeyValueStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export function emptySave(): SaveData {
  return {
    version: SAVE_VERSION,
    bestTime: 0,
    bestKills: 0,
    bestLevel: 0,
    runs: 0,
    segmentsCleared: 0,
    world: freshWorld(),
    stash: {},
    belt: {},
    quests: freshQuests(),
  };
}

function freshWorld(): WorldProgress {
  return createWorldProgress(SEASON.id, SEASON.generatorVersion);
}

/** World progress only counts for the season and generator it was made with. */
function worldForCurrentSeason(raw: unknown): WorldProgress {
  const world = parseWorldProgress(raw);
  if (!world || world.seasonId !== SEASON.id || world.generatorVersion !== SEASON.generatorVersion) {
    return freshWorld();
  }
  return world;
}

/** Upgrades older save data to the current version. */
export function migrate(raw: unknown): SaveData {
  if (!raw || typeof raw !== 'object') return emptySave();
  const data = raw as Partial<SaveData>;
  const base = emptySave();
  // Older versions: keep known fields, fill in missing ones
  // (version 2 added `segmentsCleared`, version 3 `world`, version 4 `stash`, waypoints and expeditions,
  // version 5 `belt`, version 6 `cleared` hexes of the current expedition, version 7 `quests`).
  const data2 = raw as Partial<SaveData> & {
    world?: unknown;
    stash?: unknown;
    belt?: unknown;
    quests?: unknown;
  };
  return {
    version: SAVE_VERSION,
    bestTime: Number(data.bestTime) || base.bestTime,
    bestKills: Number(data.bestKills) || base.bestKills,
    bestLevel: Number(data.bestLevel) || base.bestLevel,
    runs: Number(data.runs) || base.runs,
    segmentsCleared: Number(data.segmentsCleared) || base.segmentsCleared,
    world: worldForCurrentSeason(data2.world),
    stash: parseLoot(data2.stash),
    belt: parseBelt(data2.belt),
    quests: parseQuests(data2.quests),
  };
}

export function loadSave(storage: KeyValueStorage | undefined): SaveData {
  try {
    const text = storage?.getItem(SAVE_KEY);
    return text ? migrate(JSON.parse(text)) : emptySave();
  } catch {
    return emptySave();
  }
}

export function writeSave(storage: KeyValueStorage | undefined, data: SaveData): void {
  try {
    storage?.setItem(SAVE_KEY, JSON.stringify(data));
  } catch {
    // Storage unavailable (e.g. private mode): the game keeps running.
  }
}

export function recordRun(save: SaveData, run: RunResult): SaveData {
  return {
    ...save,
    bestTime: Math.max(save.bestTime, run.time),
    bestKills: Math.max(save.bestKills, run.kills),
    bestLevel: Math.max(save.bestLevel, run.level),
    runs: save.runs + 1,
    segmentsCleared: save.segmentsCleared + (run.cleared ? 1 : 0),
  };
}

export function safeStorage(): KeyValueStorage | undefined {
  try {
    return typeof localStorage !== 'undefined' ? localStorage : undefined;
  } catch {
    return undefined;
  }
}
