// Modifiers for main weapons (config/modifiers.ts): when they come, which can be offered and what they do
// to a weapon's numbers. Pure and tested, no Phaser.

import { MOD, MODIFIER_CHOICES, MODIFIER_LEVELS, MODIFIERS, type ModifierId } from '../config/modifiers';
import type { WeaponId, WeaponStats } from '../config/types';
import { MAIN_WEAPONS } from '../config/weapons';
import type { Rng } from './spawning';
import type { Loadout } from './stats';

/** True when reaching `level` brings a modifier choice instead of the level-up cards. */
export function isModifierLevel(level: number): boolean {
  const { first, every } = MODIFIER_LEVELS;
  return level >= first && (level - first) % every === 0;
}

/** The main weapon the loadout carries (the first one found), or undefined. */
export function mainWeaponOf(loadout: Loadout): WeaponId | undefined {
  return MAIN_WEAPONS.find((id) => (loadout.weapons[id] ?? 0) > 0);
}

/** True when one of the two modifiers rules the other out. */
function excluded(a: ModifierId, b: ModifierId): boolean {
  return !!MODIFIERS[a].excludes?.includes(b) || !!MODIFIERS[b].excludes?.includes(a);
}

/** The modifiers that can still be offered: for the main weapon, not taken yet, not ruled out by one taken. */
export function availableModifiers(loadout: Loadout): ModifierId[] {
  const main = mainWeaponOf(loadout);
  if (!main) return [];
  const taken = loadout.modifiers ?? [];
  return (Object.keys(MODIFIERS) as ModifierId[]).filter(
    (id) => MODIFIERS[id].weapon === main && !taken.includes(id) && !taken.some((t) => excluded(t, id)),
  );
}

/** Up to `count` different modifiers to choose from, at random. */
export function rollModifierOptions(loadout: Loadout, rng: Rng, count = MODIFIER_CHOICES): ModifierId[] {
  const pool = availableModifiers(loadout);
  const out: ModifierId[] = [];
  while (out.length < count && pool.length > 0) {
    const i = Math.floor(rng() * pool.length) % pool.length;
    out.push(pool[i]);
    pool.splice(i, 1);
  }
  return out;
}

/** The modifiers of one weapon in the loadout. */
export function modifiersOf(loadout: Loadout, weapon: WeaponId): ModifierId[] {
  return (loadout.modifiers ?? []).filter((id) => MODIFIERS[id].weapon === weapon);
}

/** A weapon's numbers with its modifiers applied (the ones that change numbers; the rest change behaviour). */
export function applyModifierStats(stats: WeaponStats, mods: readonly ModifierId[]): WeaponStats {
  const out = { ...stats };
  if (mods.includes('heavybolt')) {
    out.count = 1;
    out.damage *= MOD.heavy.damageMul;
    out.pierce += MOD.heavy.pierce;
    out.knockback += MOD.heavy.knockback;
  }
  if (mods.includes('volley')) {
    out.count += MOD.volley.extra;
    out.damage *= MOD.volley.damageMul;
  }
  if (mods.includes('wideblade')) out.area *= 1 + MOD.wide.area;
  return out;
}

/** Reads saved modifiers: known ones only, each once, without opposites (the first one wins). */
export function parseModifiers(raw: unknown): ModifierId[] {
  if (!Array.isArray(raw)) return [];
  const out: ModifierId[] = [];
  for (const v of raw) {
    if (typeof v !== 'string' || !(v in MODIFIERS)) continue;
    const id = v as ModifierId;
    if (out.includes(id) || out.some((t) => excluded(t, id))) continue;
    out.push(id);
  }
  return out;
}
