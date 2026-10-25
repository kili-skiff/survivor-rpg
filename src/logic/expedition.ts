import { PASSIVES } from '../config/passives';
import { SKILLS } from '../config/skills';
import type { PassiveId, SkillId, WeaponId } from '../config/types';
import { WEAPONS } from '../config/weapons';
import type { Loadout } from './stats';

/** Items by id and amount, e.g. herbs. Empty until loot items exist. */
export type Loot = Record<string, number>;

/** The character's in-run build, carried from hex to hex during an expedition. */
export interface ExpeditionBuild {
  level: number;
  xp: number;
  hp: number;
  loadout: Loadout;
}

/** One trip out of the village, from setting out until returning home or dying. */
export interface Expedition {
  /** Null until the first fight is won */
  build: ExpeditionBuild | null;
  loot: Loot;
  areasCleared: number;
  /** Hex key where the expedition started (village or a waypoint) */
  startedFrom: string;
}

export function startExpedition(fromKey: string): Expedition {
  return { build: null, loot: {}, areasCleared: 0, startedFrom: fromKey };
}

export function addLoot(a: Loot, b: Loot): Loot {
  const out: Loot = { ...a };
  for (const [id, n] of Object.entries(b)) out[id] = (out[id] ?? 0) + n;
  return out;
}

/** What survives a death: each stack keeps `share` of its amount, rounded down. */
export function lootAfterDeath(loot: Loot, share: number): Loot {
  const out: Loot = {};
  for (const [id, n] of Object.entries(loot)) {
    const kept = Math.floor(n * share);
    if (kept > 0) out[id] = kept;
  }
  return out;
}

/** What `after` has more of than `before`, per item. Used to show what was just brought home. */
export function lootGained(before: Loot, after: Loot): Loot {
  const out: Loot = {};
  for (const [id, n] of Object.entries(after)) {
    const diff = n - (before[id] ?? 0);
    if (diff > 0) out[id] = diff;
  }
  return out;
}

export function lootCount(loot: Loot): number {
  return Object.values(loot).reduce((sum, n) => sum + n, 0);
}

// ---------------------------------------------------------------- validation of saved data

function isNumber(v: unknown): v is number {
  return typeof v === 'number' && Number.isFinite(v);
}

function parseLoot(raw: unknown): Loot {
  const out: Loot = {};
  if (!raw || typeof raw !== 'object') return out;
  for (const [id, n] of Object.entries(raw as Record<string, unknown>)) {
    if (isNumber(n) && n > 0) out[id] = Math.floor(n);
  }
  return out;
}

/** Keeps only known ids with sensible levels, so an outdated save cannot crash the game. */
function parseLevels<T extends string>(raw: unknown, known: readonly T[]): Partial<Record<T, number>> {
  const out: Partial<Record<T, number>> = {};
  if (!raw || typeof raw !== 'object') return out;
  for (const id of known) {
    const v = (raw as Record<string, unknown>)[id];
    if (isNumber(v) && v >= 1) out[id] = Math.floor(v);
  }
  return out;
}

function parseLoadout(raw: unknown): Loadout | null {
  if (!raw || typeof raw !== 'object') return null;
  const d = raw as Record<string, unknown>;
  const weapons = parseLevels(d.weapons, Object.keys(WEAPONS) as WeaponId[]);
  if (Object.keys(weapons).length === 0) return null;
  const skills = parseLevels(d.skills, Object.keys(SKILLS) as SkillId[]);
  return {
    weapons,
    passives: parseLevels(d.passives, Object.keys(PASSIVES) as PassiveId[]),
    skills: { dash: skills.dash ?? 1, nova: skills.nova ?? 1 },
  };
}

export function parseExpedition(raw: unknown): Expedition | null {
  if (!raw || typeof raw !== 'object') return null;
  const d = raw as Record<string, unknown>;
  if (typeof d.startedFrom !== 'string') return null;
  let build: ExpeditionBuild | null = null;
  if (d.build && typeof d.build === 'object') {
    const b = d.build as Record<string, unknown>;
    const loadout = parseLoadout(b.loadout);
    if (loadout && isNumber(b.level) && isNumber(b.xp) && isNumber(b.hp)) {
      build = {
        level: Math.max(1, Math.floor(b.level)),
        xp: Math.max(0, b.xp),
        hp: Math.max(1, b.hp),
        loadout,
      };
    }
  }
  return {
    build,
    loot: parseLoot(d.loot),
    areasCleared: isNumber(d.areasCleared) ? Math.max(0, Math.floor(d.areasCleared)) : 0,
    startedFrom: d.startedFrom,
  };
}

export { parseLoot };
