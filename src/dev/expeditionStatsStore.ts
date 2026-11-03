// Dev: the glue between the scenes and the expedition stats (src/dev/expeditionStats.ts): reads and writes
// the log in device storage and copies its text. Every call from a scene is marked `// DEV:`.

import { safeStorage } from '../logic/save';
import type { Expedition } from '../logic/expedition';
import { WEAPONS } from '../config/weapons';
import type { WeaponId } from '../config/types';
import { isDevMode } from './devMode';
import {
  addFight,
  buildName,
  loadLog,
  logText,
  markHome,
  saveLog,
  startLog,
  type ExpeditionLog,
  type FightLog,
} from './expeditionStats';

function currentBuildName(): string {
  try {
    return buildName(window.location.pathname, import.meta.env.DEV);
  } catch {
    return 'unknown';
  }
}

/**
 * A fight starts: the first fight of an expedition (nothing cleared yet) begins a new log, replacing the last
 * expedition's; later fights add to the running one.
 */
export function beginFight(expedition: Expedition | null, mainWeapon: WeaponId): void {
  if (!isDevMode()) return;
  const storage = safeStorage();
  const existing = loadLog(storage);
  const firstFight = !expedition || expedition.areasCleared === 0;
  if (existing && !firstFight && existing.ended === 'running') return;
  saveLog(
    storage,
    startLog({ now: new Date(), build: currentBuildName(), mainWeapon: WEAPONS[mainWeapon].name }),
  );
}

/** A fight is over: it goes into the log (a fight outside any log starts one). */
export function recordFight(fight: FightLog, mainWeapon: WeaponId): void {
  if (!isDevMode()) return;
  const storage = safeStorage();
  const log: ExpeditionLog =
    loadLog(storage) ??
    startLog({ now: new Date(), build: currentBuildName(), mainWeapon: WEAPONS[mainWeapon].name });
  saveLog(storage, addFight(log, fight));
}

/** The expedition ended by going home. */
export function expeditionHome(): void {
  if (!isDevMode()) return;
  const storage = safeStorage();
  const log = loadLog(storage);
  if (log) saveLog(storage, markHome(log));
}

/** The text of the last expedition, or null when there is none. */
export function expeditionStatsText(): string | null {
  const log = loadLog(safeStorage());
  return log ? logText(log, new Date()) : null;
}

/** Copies the text to the clipboard. `none`: no expedition yet; `failed`: the browser said no (see the console). */
export async function copyExpeditionStats(): Promise<'copied' | 'failed' | 'none'> {
  const text = expeditionStatsText();
  if (!text) return 'none';
  console.info(text);
  try {
    await navigator.clipboard.writeText(text);
    return 'copied';
  } catch {
    return 'failed';
  }
}

/** Words for a small toast after `copyExpeditionStats`. */
export function copyToast(result: 'copied' | 'failed' | 'none'): string {
  if (result === 'copied') return 'stats copied';
  if (result === 'none') return 'no expedition yet';
  return 'copy failed (see console)';
}
