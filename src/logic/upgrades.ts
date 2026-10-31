import { BOON_DEFS } from '../config/boons';
import { PASSIVES } from '../config/passives';
import { SKILLS } from '../config/skills';
import type { BoonId, PassiveId, SkillId, WeaponId } from '../config/types';
import { MAX_WEAPONS, WEAPONS } from '../config/weapons';
import type { Rng } from './spawning';
import { skillMaxLevel, weaponMaxLevel, type Loadout } from './stats';

export type UpgradeOption =
  | { kind: 'weapon'; id: WeaponId; toLevel: number }
  | { kind: 'passive'; id: PassiveId; toLevel: number }
  | { kind: 'skill'; id: SkillId; toLevel: number }
  /** One-time effect (config/boons.ts); not part of the build */
  | { kind: 'boon'; id: BoonId }
  | { kind: 'heal' };

export interface UpgradeCard {
  title: string;
  badge: string;
  text: string;
  texture: string;
  isNew: boolean;
}

const WEIGHTS = { newWeapon: 1.3, weapon: 1.1, newPassive: 0.9, passive: 0.9, skill: 0.75, boon: 0.45 };

/**
 * All upgrades currently available, with their weight. Items have no limit; one-time boons are
 * left out when `boons` is false (chests).
 */
export function availableUpgrades(
  loadout: Loadout,
  boons = true,
): { option: UpgradeOption; weight: number }[] {
  const out: { option: UpgradeOption; weight: number }[] = [];
  const ownedWeapons = Object.keys(loadout.weapons) as WeaponId[];

  for (const id of Object.keys(WEAPONS) as WeaponId[]) {
    const level = loadout.weapons[id] ?? 0;
    if (level === 0) {
      if (ownedWeapons.length < MAX_WEAPONS) {
        out.push({ option: { kind: 'weapon', id, toLevel: 1 }, weight: WEIGHTS.newWeapon });
      }
    } else if (level < weaponMaxLevel(id)) {
      out.push({ option: { kind: 'weapon', id, toLevel: level + 1 }, weight: WEIGHTS.weapon });
    }
  }

  for (const id of Object.keys(PASSIVES) as PassiveId[]) {
    const level = loadout.passives[id] ?? 0;
    if (level === 0) {
      out.push({ option: { kind: 'passive', id, toLevel: 1 }, weight: WEIGHTS.newPassive });
    } else if (level < PASSIVES[id].maxLevel) {
      out.push({ option: { kind: 'passive', id, toLevel: level + 1 }, weight: WEIGHTS.passive });
    }
  }

  for (const id of Object.keys(SKILLS) as SkillId[]) {
    const level = loadout.skills[id];
    if (level < skillMaxLevel(id)) {
      out.push({ option: { kind: 'skill', id, toLevel: level + 1 }, weight: WEIGHTS.skill });
    }
  }
  if (boons) {
    for (const id of Object.keys(BOON_DEFS) as BoonId[]) {
      out.push({ option: { kind: 'boon', id }, weight: WEIGHTS.boon });
    }
  }
  return out;
}

/** Draws up to `count` distinct upgrades, weighted, without replacement. */
export function rollUpgradeOptions(loadout: Loadout, rng: Rng, count = 3, boons = true): UpgradeOption[] {
  const pool = availableUpgrades(loadout, boons);
  const picked: UpgradeOption[] = [];
  while (picked.length < count && pool.length > 0) {
    const total = pool.reduce((sum, e) => sum + e.weight, 0);
    let roll = rng() * total;
    let index = pool.length - 1;
    for (let i = 0; i < pool.length; i++) {
      roll -= pool[i].weight;
      if (roll < 0) {
        index = i;
        break;
      }
    }
    picked.push(pool[index].option);
    pool.splice(index, 1);
  }
  if (picked.length === 0) picked.push({ kind: 'heal' });
  return picked;
}

/** Returns a new loadout (the old one stays unchanged). */
export function applyUpgrade(loadout: Loadout, option: UpgradeOption): Loadout {
  switch (option.kind) {
    case 'weapon':
      return { ...loadout, weapons: { ...loadout.weapons, [option.id]: option.toLevel } };
    case 'passive':
      return { ...loadout, passives: { ...loadout.passives, [option.id]: option.toLevel } };
    case 'skill':
      return { ...loadout, skills: { ...loadout.skills, [option.id]: option.toLevel } };
    case 'boon':
    case 'heal':
      return loadout;
  }
}

export function describeUpgrade(option: UpgradeOption): UpgradeCard {
  switch (option.kind) {
    case 'weapon': {
      const def = WEAPONS[option.id];
      const isNew = option.toLevel === 1;
      return {
        title: def.name,
        badge: isNew ? 'NEW WEAPON' : `WEAPON · LEVEL ${option.toLevel}`,
        text: isNew ? def.description : def.levels[option.toLevel - 2].text,
        texture: def.texture,
        isNew,
      };
    }
    case 'passive': {
      const def = PASSIVES[option.id];
      const isNew = option.toLevel === 1;
      return {
        title: def.name,
        badge: isNew ? 'NEW ITEM' : `ITEM · LEVEL ${option.toLevel}`,
        text: def.description,
        texture: def.texture,
        isNew,
      };
    }
    case 'skill': {
      const def = SKILLS[option.id];
      return {
        title: def.name,
        badge: `SKILL · LEVEL ${option.toLevel}`,
        text: def.levels[option.toLevel - 2].text,
        texture: def.texture,
        isNew: false,
      };
    }
    case 'boon': {
      const def = BOON_DEFS[option.id];
      return {
        title: def.name,
        badge: 'ONE-TIME',
        text: def.description,
        texture: def.texture,
        isNew: false,
      };
    }
    case 'heal':
      return {
        title: 'Healing Potion',
        badge: 'EVERYTHING MAXED',
        text: 'Restores 50 health.',
        texture: 'icon-vitality',
        isNew: false,
      };
  }
}
