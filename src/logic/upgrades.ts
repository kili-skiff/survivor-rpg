import { BOON_DEFS } from '../config/boons';
import { MODIFIERS, type ModifierId } from '../config/modifiers';
import { PASSIVES } from '../config/passives';
import { RARITIES } from '../config/rarity';
import { SKILLS } from '../config/skills';
import type { BoonId, PassiveId, Rarity, SkillId, WeaponId } from '../config/types';
import { MAIN_WEAPON_CARD_GUARANTEED, MAIN_WEAPONS, MAX_WEAPONS, WEAPONS } from '../config/weapons';
import { mainWeaponOf } from './modifiers';
import type { Rng } from './spawning';
import { remainingSteps, skillMaxLevel, weaponMaxLevel, weaponSteps, type Loadout } from './stats';

export type UpgradeOption =
  /** `step`: which of the weapon's level steps (index into its `levels`); drawn when the card is rolled */
  | { kind: 'weapon'; id: WeaponId; toLevel: number; step?: number }
  | { kind: 'passive'; id: PassiveId; toLevel: number }
  | { kind: 'skill'; id: SkillId; toLevel: number }
  /** One-time effect (config/boons.ts); not part of the build */
  | { kind: 'boon'; id: BoonId }
  /** A modifier of the main weapon (config/modifiers.ts); only offered at modifier levels */
  | { kind: 'modifier'; id: ModifierId }
  | { kind: 'heal' };

export interface UpgradeCard {
  title: string;
  badge: string;
  text: string;
  texture: string;
  rarity: Rarity;
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
      // Main weapons are chosen in the village; cards only bring their level steps.
      if (ownedWeapons.length < MAX_WEAPONS && !MAIN_WEAPONS.includes(id)) {
        out.push({
          option: { kind: 'weapon', id, toLevel: 1 },
          weight: WEIGHTS.newWeapon * RARITIES[WEAPONS[id].rarity].weight,
        });
      }
    } else if (level < weaponMaxLevel(id)) {
      out.push({
        option: { kind: 'weapon', id, toLevel: level + 1 },
        weight: WEIGHTS.weapon * RARITIES[WEAPONS[id].rarity].weight,
      });
    }
  }

  for (const id of Object.keys(PASSIVES) as PassiveId[]) {
    const level = loadout.passives[id] ?? 0;
    if (level === 0) {
      out.push({
        option: { kind: 'passive', id, toLevel: 1 },
        weight: WEIGHTS.newPassive * RARITIES[PASSIVES[id].rarity].weight,
      });
    } else if (level < PASSIVES[id].maxLevel) {
      out.push({
        option: { kind: 'passive', id, toLevel: level + 1 },
        weight: WEIGHTS.passive * RARITIES[PASSIVES[id].rarity].weight,
      });
    }
  }

  for (const id of Object.keys(SKILLS) as SkillId[]) {
    const level = loadout.skills[id];
    if (level < skillMaxLevel(id)) {
      out.push({
        option: { kind: 'skill', id, toLevel: level + 1 },
        weight: WEIGHTS.skill * RARITIES[SKILLS[id].rarity].weight,
      });
    }
  }
  if (boons) {
    for (const id of Object.keys(BOON_DEFS) as BoonId[]) {
      out.push({
        option: { kind: 'boon', id },
        weight: WEIGHTS.boon * RARITIES[BOON_DEFS[id].rarity].weight,
      });
    }
  }
  return out;
}

/** Draws up to `count` distinct upgrades from `pool`, weighted, without replacement. */
function drawFrom(
  pool: { option: UpgradeOption; weight: number }[],
  loadout: Loadout,
  rng: Rng,
  count: number,
): UpgradeOption[] {
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
    picked.push(withStep(pool[index].option, loadout, rng));
    pool.splice(index, 1);
  }
  return picked;
}

/** Draws up to `count` distinct upgrades, weighted, without replacement. */
export function rollUpgradeOptions(loadout: Loadout, rng: Rng, count = 3, boons = true): UpgradeOption[] {
  const pool = availableUpgrades(loadout, boons);
  // One card for the main weapon while it can still grow (at a random place among the cards).
  const main = mainWeaponOf(loadout);
  const mainIndex = pool.findIndex((e) => e.option.kind === 'weapon' && e.option.id === main);
  if (MAIN_WEAPON_CARD_GUARANTEED && mainIndex >= 0 && count > 0) {
    const [entry] = pool.splice(mainIndex, 1);
    const rest = drawFrom(pool, loadout, rng, count - 1);
    const at = Math.floor(rng() * (rest.length + 1)) % (rest.length + 1);
    rest.splice(at, 0, withStep(entry.option, loadout, rng));
    return rest;
  }
  const picked = drawFrom(pool, loadout, rng, count);
  if (picked.length === 0) picked.push({ kind: 'heal' });
  return picked;
}

/**
 * The "rare card" reward: a choice among magic and legendary cards only (no one-time cards). When there
 * are not enough of them, ordinary cards fill up the choice.
 */
export function rollRareOptions(loadout: Loadout, rng: Rng, count = 3): UpgradeOption[] {
  const all = availableUpgrades(loadout, false);
  const rare = all.filter((e) => describeUpgrade(e.option).rarity !== 'common');
  const picked = drawFrom(rare, loadout, rng, count);
  if (picked.length < count) {
    const rest = all.filter((e) => !rare.includes(e));
    picked.push(...drawFrom(rest, loadout, rng, count - picked.length));
  }
  if (picked.length === 0) picked.push({ kind: 'heal' });
  return picked;
}

/** A weapon card gets one of the weapon's missing level steps at random, so no two runs grow the same way. */
function withStep(option: UpgradeOption, loadout: Loadout, rng: Rng): UpgradeOption {
  if (option.kind !== 'weapon' || option.toLevel === 1 || option.step !== undefined) return option;
  const left = remainingSteps(loadout, option.id);
  if (left.length === 0) return option;
  return { ...option, step: left[Math.floor(rng() * left.length) % left.length] };
}

/** Returns a new loadout (the old one stays unchanged). */
export function applyUpgrade(loadout: Loadout, option: UpgradeOption): Loadout {
  switch (option.kind) {
    case 'weapon': {
      const weapons = { ...loadout.weapons, [option.id]: option.toLevel };
      let steps: number[] = [];
      if (option.toLevel > 1) {
        // Without a drawn step (e.g. built by hand), the first missing one.
        const step = option.step ?? remainingSteps(loadout, option.id)[0];
        steps = [...weaponSteps(loadout, option.id), ...(step === undefined ? [] : [step])];
      }
      return { ...loadout, weapons, weaponSteps: { ...loadout.weaponSteps, [option.id]: steps } };
    }
    case 'passive':
      return { ...loadout, passives: { ...loadout.passives, [option.id]: option.toLevel } };
    case 'skill':
      return { ...loadout, skills: { ...loadout.skills, [option.id]: option.toLevel } };
    case 'modifier':
      return { ...loadout, modifiers: [...(loadout.modifiers ?? []), option.id] };
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
        text: isNew ? def.description : def.levels[option.step ?? option.toLevel - 2].text,
        texture: def.texture,
        rarity: def.rarity,
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
        rarity: def.rarity,
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
        rarity: def.rarity,
        isNew: false,
      };
    }
    case 'modifier': {
      const def = MODIFIERS[option.id];
      return {
        title: def.name,
        badge: `${WEAPONS[def.weapon].name.toUpperCase()} MODIFIER`,
        text: def.description,
        texture: def.texture,
        rarity: 'legendary',
        isNew: true,
      };
    }
    case 'boon': {
      const def = BOON_DEFS[option.id];
      return {
        title: def.name,
        badge: 'ONE-TIME',
        text: def.description,
        texture: def.texture,
        rarity: def.rarity,
        isNew: false,
      };
    }
    case 'heal':
      return {
        title: 'Healing Potion',
        badge: 'EVERYTHING MAXED',
        text: 'Restores 50 health.',
        texture: 'icon-vitality',
        rarity: 'common',
        isNew: false,
      };
  }
}
