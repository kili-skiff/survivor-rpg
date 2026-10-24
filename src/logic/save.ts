// Versioned save data: old saves are migrated instead of discarded.

export const SAVE_VERSION = 1;
const SAVE_KEY = 'survivor-rpg.save';

export interface SaveData {
  version: number;
  bestTime: number;
  bestKills: number;
  bestLevel: number;
  runs: number;
}

export interface RunResult {
  time: number;
  kills: number;
  level: number;
}

export interface KeyValueStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export function emptySave(): SaveData {
  return { version: SAVE_VERSION, bestTime: 0, bestKills: 0, bestLevel: 0, runs: 0 };
}

/** Upgrades older save data to the current version. */
export function migrate(raw: unknown): SaveData {
  if (!raw || typeof raw !== 'object') return emptySave();
  const data = raw as Partial<SaveData>;
  const base = emptySave();
  // Version 0 (no field) -> 1: keep known fields, fill in missing ones.
  return {
    version: SAVE_VERSION,
    bestTime: Number(data.bestTime) || base.bestTime,
    bestKills: Number(data.bestKills) || base.bestKills,
    bestLevel: Number(data.bestLevel) || base.bestLevel,
    runs: Number(data.runs) || base.runs,
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
  };
}

export function safeStorage(): KeyValueStorage | undefined {
  try {
    return typeof localStorage !== 'undefined' ? localStorage : undefined;
  } catch {
    return undefined;
  }
}
