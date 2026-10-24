import { MAX_PASSIVES, PASSIVES } from '../config/passives';
import { SKILLS } from '../config/skills';
import type { PassiveId, SkillId, WeaponId } from '../config/types';
import { MAX_WEAPONS, WEAPONS } from '../config/weapons';
import type { Rng } from './spawning';
import { skillMaxLevel, weaponMaxLevel, type Loadout } from './stats';

export type UpgradeOption =
  | { kind: 'weapon'; id: WeaponId; toLevel: number }
  | { kind: 'passive'; id: PassiveId; toLevel: number }
  | { kind: 'skill'; id: SkillId; toLevel: number }
  | { kind: 'heal' };

export interface UpgradeCard {
  title: string;
  badge: string;
  text: string;
  texture: string;
  isNew: boolean;
}

const WEIGHTS = { newWeapon: 1.3, weapon: 1.1, newPassive: 0.9, passive: 0.9, skill: 0.75 };

/** All upgrades currently available, with their weight. */
export function availableUpgrades(loadout: Loadout): { option: UpgradeOption; weight: number }[] {
  const out: { option: UpgradeOption; weight: number }[] = [];
  const ownedWeapons = Object.keys(loadout.weapons) as WeaponId[];
  const ownedPassives = Object.keys(loadout.passives) as PassiveId[];

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
      if (ownedPassives.length < MAX_PASSIVES) {
        out.push({ option: { kind: 'passive', id, toLevel: 1 }, weight: WEIGHTS.newPassive });
      }
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
  return out;
}

/** Draws up to `count` distinct upgrades, weighted, without replacement. */
export function rollUpgradeOptions(loadout: Loadout, rng: Rng, count = 3): UpgradeOption[] {
  const pool = availableUpgrades(loadout);
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
        badge: isNew ? 'NEUE WAFFE' : `WAFFE · STUFE ${option.toLevel}`,
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
        badge: isNew ? 'NEUES ITEM' : `ITEM · STUFE ${option.toLevel}`,
        text: def.description,
        texture: def.texture,
        isNew,
      };
    }
    case 'skill': {
      const def = SKILLS[option.id];
      return {
        title: def.name,
        badge: `SKILL · STUFE ${option.toLevel}`,
        text: def.levels[option.toLevel - 2].text,
        texture: def.texture,
        isNew: false,
      };
    }
    case 'heal':
      return {
        title: 'Heiltrank',
        badge: 'ALLES MAXIMIERT',
        text: 'Stellt 50 Lebenspunkte wieder her.',
        texture: 'icon-vitality',
        isNew: false,
      };
  }
}
