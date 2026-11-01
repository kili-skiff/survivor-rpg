// Brewing potions, filling the belt and the effects of drunk potions. Pure and tested.

import { maxBeltSize } from './hearth';
import { POTION_IDS, POTION_RULES, POTIONS } from '../config/potions';
import type { PlayerStats, PotionId } from '../config/types';
import type { Loot } from './expedition';

/** Potions carried on an expedition, by id. Brewed potions wait in the stash under their id. */
export type Belt = Partial<Record<PotionId, number>>;

export function beltCount(belt: Belt): number {
  return POTION_IDS.reduce((sum, id) => sum + (belt[id] ?? 0), 0);
}

/** How many potions of this kind the herbs in the stash are enough for. */
export function brewableCount(stash: Loot, id: PotionId): number {
  let max = Infinity;
  for (const [herb, need] of Object.entries(POTIONS[id].recipe)) {
    if (!need) continue;
    max = Math.min(max, Math.floor((stash[herb] ?? 0) / need));
  }
  return max === Infinity ? 0 : max;
}

/** Uses up the herbs of one recipe and puts the potion into the stash. Null if herbs are missing. */
export function brew(stash: Loot, id: PotionId): Loot | null {
  if (brewableCount(stash, id) < 1) return null;
  const out: Loot = { ...stash };
  for (const [herb, need] of Object.entries(POTIONS[id].recipe)) {
    if (!need) continue;
    out[herb] -= need;
    if (out[herb] <= 0) delete out[herb];
  }
  out[id] = (out[id] ?? 0) + 1;
  return out;
}

/** Moves one potion from the stash into the belt. Null if there is none or the belt is full. */
export function packPotion(
  stash: Loot,
  belt: Belt,
  id: PotionId,
  size: number = POTION_RULES.beltSize,
): { stash: Loot; belt: Belt } | null {
  if ((stash[id] ?? 0) < 1 || beltCount(belt) >= size) return null;
  const nextStash: Loot = { ...stash, [id]: stash[id] - 1 };
  if (nextStash[id] <= 0) delete nextStash[id];
  return { stash: nextStash, belt: { ...belt, [id]: (belt[id] ?? 0) + 1 } };
}

/** Moves one potion from the belt back into the stash. Null if the belt holds none. */
export function unpackPotion(stash: Loot, belt: Belt, id: PotionId): { stash: Loot; belt: Belt } | null {
  if ((belt[id] ?? 0) < 1) return null;
  return { stash: { ...stash, [id]: (stash[id] ?? 0) + 1 }, belt: takeFromBelt(belt, id) };
}

/** The belt with one potion of this kind removed (drunk). */
export function takeFromBelt(belt: Belt, id: PotionId): Belt {
  const out: Belt = { ...belt };
  const left = (out[id] ?? 0) - 1;
  if (left > 0) out[id] = left;
  else delete out[id];
  return out;
}

export function parseBelt(raw: unknown): Belt {
  const out: Belt = {};
  if (!raw || typeof raw !== 'object') return out;
  // The largest belt possible: how big yours is depends on the Hearth, which is read separately.
  let room: number = maxBeltSize();
  for (const id of POTION_IDS) {
    const v = (raw as Record<string, unknown>)[id];
    if (typeof v !== 'number' || !Number.isFinite(v) || v < 1) continue;
    const n = Math.min(Math.floor(v), room);
    if (n > 0) out[id] = n;
    room -= n;
  }
  return out;
}

// ---------------------------------------------------------------- effects during a fight

/** A buff from a drunk potion that runs until `endsAt` (game clock, ms). */
export interface ActiveBuff {
  id: PotionId;
  endsAt: number;
}

/** Drinking the same potion again restarts its buff instead of stacking it. */
export function addBuff(buffs: ActiveBuff[], id: PotionId, now: number): ActiveBuff[] {
  const duration = POTIONS[id].effect.durationSec * 1000;
  if (duration <= 0) return buffs;
  return [...buffs.filter((b) => b.id !== id), { id, endsAt: now + duration }];
}

export function activeBuffs(buffs: ActiveBuff[], now: number): ActiveBuff[] {
  return buffs.filter((b) => b.endsAt > now);
}

/** Player stats with all running potion buffs applied. */
export function applyBuffs(stats: PlayerStats, buffs: ActiveBuff[]): PlayerStats {
  const out = { ...stats };
  for (const b of buffs) {
    const e = POTIONS[b.id].effect;
    if (e.moveSpeedMul) out.moveSpeed *= e.moveSpeedMul;
    if (e.cooldownMul) out.haste *= e.cooldownMul;
  }
  return out;
}

export function damageTakenMultiplier(buffs: ActiveBuff[]): number {
  return buffs.reduce((m, b) => m * (POTIONS[b.id].effect.damageTakenMul ?? 1), 1);
}

/** Health restored by drinking this potion; 0 for potions that do not heal. */
export function potionHeal(id: PotionId, maxHp: number): number {
  return Math.round((POTIONS[id].effect.healShare ?? 0) * maxHp);
}

/** A potion is only used up when it does something: a healing potion at full health does nothing. */
export function canDrink(id: PotionId, hp: number, maxHp: number): boolean {
  const e = POTIONS[id].effect;
  if (e.durationSec > 0) return true;
  return (e.healShare ?? 0) > 0 && hp < maxHp;
}
