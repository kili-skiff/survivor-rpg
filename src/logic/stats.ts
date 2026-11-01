import type { ModifierId } from '../config/modifiers';
import { ITEMS } from '../config/balance';
import { BASE_PLAYER_STATS, PASSIVES } from '../config/passives';
import { SKILLS } from '../config/skills';
import type {
  LevelStep,
  PassiveId,
  PlayerStats,
  SkillId,
  SkillStats,
  WeaponId,
  WeaponStats,
} from '../config/types';
import { WEAPONS } from '../config/weapons';

/** What the player owns in this run: id -> level (starting at 1). */
export interface Loadout {
  weapons: Partial<Record<WeaponId, number>>;
  /**
   * The level steps each weapon has taken, in the order they came (indices into its `levels`). They are
   * drawn at random; missing (older saves) means the first steps in order.
   */
  weaponSteps?: Partial<Record<WeaponId, number[]>>;
  passives: Partial<Record<PassiveId, number>>;
  skills: Record<SkillId, number>;
  /** Modifiers of the main weapon taken in this run (config/modifiers.ts); missing = none */
  modifiers?: ModifierId[];
}

export function createStartLoadout(startWeapon: WeaponId): Loadout {
  return { weapons: { [startWeapon]: 1 }, passives: {}, skills: { dash: 1, nova: 1 } };
}

function addPartial<T extends object>(target: T, mods: Partial<T>, times = 1): T {
  const out = { ...target };
  for (const key of Object.keys(mods) as (keyof T)[]) {
    const value = mods[key];
    if (typeof value === 'number') {
      (out[key] as number) = (out[key] as number) + value * times;
    }
  }
  return out;
}

/** Applies level steps 2..level cumulatively to the base values. */
export function applyLevels<T extends object>(base: T, levels: LevelStep<T>[], level: number): T {
  let result = { ...base };
  const steps = Math.min(Math.max(level - 1, 0), levels.length);
  for (let i = 0; i < steps; i++) {
    result = addPartial(result, levels[i].mods);
  }
  return result;
}

/**
 * The player's stats: base values, permanent bonuses (`bonus`, e.g. from deeds) and the passive
 * items of this run.
 */
export function computePlayerStats(loadout: Loadout, bonus: Partial<PlayerStats> = {}): PlayerStats {
  let stats = addPartial(BASE_PLAYER_STATS, bonus);
  for (const id of Object.keys(loadout.passives) as PassiveId[]) {
    const level = loadout.passives[id] ?? 0;
    stats = addPartial(stats, PASSIVES[id].perLevel, level);
  }
  stats.haste = Math.max(0.4, stats.haste);
  stats.skillHaste = Math.max(ITEMS.minSkillHaste, stats.skillHaste);
  stats.crit = Math.min(ITEMS.maxCrit, Math.max(0, stats.crit));
  stats.dodge = Math.min(ITEMS.maxDodge, Math.max(0, stats.dodge));
  stats.area = Math.max(0.3, stats.area);
  return stats;
}

/** Applies the given level steps (indices into `levels`) to the base values. */
export function applySteps<T extends object>(base: T, levels: LevelStep<T>[], steps: readonly number[]): T {
  let result = { ...base };
  for (const i of steps) if (levels[i]) result = addPartial(result, levels[i].mods);
  return result;
}

/** The level steps a weapon has taken; without a record, the first ones in order (one per level above 1). */
export function weaponSteps(loadout: Loadout, id: WeaponId): number[] {
  const level = loadout.weapons[id] ?? 0;
  const n = Math.max(0, Math.min(level - 1, WEAPONS[id].levels.length));
  const taken = loadout.weaponSteps?.[id];
  if (taken && taken.length === n) return [...taken];
  return Array.from({ length: n }, (_, i) => i);
}

/** The level steps a weapon can still take. */
export function remainingSteps(loadout: Loadout, id: WeaponId): number[] {
  const taken = new Set(weaponSteps(loadout, id));
  return WEAPONS[id].levels.map((_, i) => i).filter((i) => !taken.has(i));
}

/**
 * A weapon's stats at `level` for the player. `steps` are the level steps it has taken (see
 * `weaponSteps`); without them, the first ones in order.
 */
export function computeWeaponStats(
  id: WeaponId,
  level: number,
  player: PlayerStats,
  steps?: readonly number[],
): WeaponStats {
  const def = WEAPONS[id];
  const raw = steps ? applySteps(def.base, def.levels, steps) : applyLevels(def.base, def.levels, level);
  return {
    ...raw,
    damage: raw.damage * player.might,
    cooldown: Math.max(80, raw.cooldown * player.haste),
    area: raw.area * player.area,
    count: raw.count + player.multishot,
    // Only weapons that pierce at all get more of it.
    pierce: raw.pierce > 0 ? raw.pierce + player.pierce : raw.pierce,
    knockback: raw.knockback + player.force,
    splash: raw.splash + player.blast,
    percent: raw.percent + player.rend,
  };
}

export function computeSkillStats(id: SkillId, level: number, player: PlayerStats): SkillStats {
  const def = SKILLS[id];
  const raw = applyLevels(def.base, def.levels, level);
  return {
    ...raw,
    damage: raw.damage * player.might,
    cooldown: Math.max(500, raw.cooldown * player.haste * player.skillHaste),
    radius: raw.radius * player.area,
  };
}

export function weaponMaxLevel(id: WeaponId): number {
  return WEAPONS[id].levels.length + 1;
}

export function skillMaxLevel(id: SkillId): number {
  return SKILLS[id].levels.length + 1;
}

/** Damage after armor, at least 1. */
export function damageAfterArmor(damage: number, armor: number): number {
  return Math.max(1, damage - armor);
}
