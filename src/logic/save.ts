// Versioned save data: old saves are migrated instead of discarded.

import { SEASON } from '../config/world';
import { parseLoot, type Loot } from './expedition';
import { parseBelt, type Belt } from './potions';
import { parseDeeds } from './deeds';
import type { DeedId } from '../config/deeds';
import { freshQuests, parseQuests, type QuestProgress } from './quests';
import { LANTERN_TIERS, STARTING_RECIPES } from '../config/merchant';
import { POTION_IDS } from '../config/potions';
import type { PotionId } from '../config/types';
import { createWorldProgress, parseWorldProgress, type WorldProgress } from './worldProgress';

export const SAVE_VERSION = 12;
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
  /** Added in version 9: lantern tiers bought from the merchant (0..LANTERN_TIERS.length) */
  lanternLevel: number;
  /** Added in version 9: potion recipes the player knows */
  recipes: PotionId[];
  /** Added in version 10: deeds earned by exploring; kept when the map is reset */
  deeds: DeedId[];
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
    lanternLevel: 0,
    recipes: [...STARTING_RECIPES],
    deeds: [],
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
  // version 5 `belt`, version 6 `cleared` hexes of the current expedition, version 7 `quests`,
  // version 8 `litWatchfires` in the world progress, version 9 `lanternLevel` and `recipes`, version 10 `deeds`, version 11 `fire` quest stage in the quests, version 12 `weaponSteps` in the
  // expedition build's loadout; parseLoadout fills it in: without it, weapons count their first steps in order).
  const data2 = raw as Partial<SaveData> & {
    world?: unknown;
    stash?: unknown;
    belt?: unknown;
    quests?: unknown;
    lanternLevel?: unknown;
    recipes?: unknown;
    deeds?: unknown;
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
    lanternLevel: parseLanternLevel(data2.lanternLevel),
    recipes: parseRecipes(data2.recipes),
    deeds: parseDeeds(data2.deeds),
  };
}

function parseLanternLevel(raw: unknown): number {
  return typeof raw === 'number' && Number.isFinite(raw)
    ? Math.max(0, Math.min(LANTERN_TIERS.length, Math.floor(raw)))
    : 0;
}

/** Known recipes: valid potion ids, always including the starting recipes. */
function parseRecipes(raw: unknown): PotionId[] {
  const known = new Set<PotionId>(STARTING_RECIPES);
  if (Array.isArray(raw))
    for (const id of raw) if (POTION_IDS.includes(id as PotionId)) known.add(id as PotionId);
  return POTION_IDS.filter((id) => known.has(id));
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
