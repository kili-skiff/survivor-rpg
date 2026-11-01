import { describe, expect, it } from 'vitest';
import boot from '../scenes/BootScene.ts?raw';
import { MODIFIERS, type ModifierId } from '../config/modifiers';
import { MAIN_WEAPONS } from '../config/weapons';
import type { WeaponStats } from '../config/types';
import {
  applyModifierStats,
  availableModifiers,
  isModifierLevel,
  mainWeaponOf,
  parseModifiers,
  rollModifierOptions,
} from './modifiers';
import { parseExpedition } from './expedition';
import { createStartLoadout, type Loadout } from './stats';
import { applyUpgrade, describeUpgrade } from './upgrades';
import { createRng } from './rng';

const ids = Object.keys(MODIFIERS) as ModifierId[];
const withMods = (weapon: 'bolt' | 'boomerang', modifiers: ModifierId[]): Loadout => ({
  ...createStartLoadout(weapon),
  modifiers,
});

describe('weapon modifiers', () => {
  it('every main weapon has six modifiers, each with an icon', () => {
    for (const w of MAIN_WEAPONS) expect(ids.filter((id) => MODIFIERS[id].weapon === w)).toHaveLength(6);
    for (const id of ids) expect(boot).toContain(`'${MODIFIERS[id].texture}'`);
  });

  it('exclusions go both ways', () => {
    for (const id of ids) {
      for (const other of MODIFIERS[id].excludes ?? []) expect(MODIFIERS[other].excludes).toContain(id);
    }
  });

  it('comes at level 5, 10, 15 and so on', () => {
    const levels = Array.from({ length: 25 }, (_, i) => i + 1).filter(isModifierLevel);
    expect(levels).toEqual([5, 10, 15, 20, 25]);
  });

  it('offers only modifiers of the main weapon', () => {
    expect(
      availableModifiers(createStartLoadout('bolt')).every((id) => MODIFIERS[id].weapon === 'bolt'),
    ).toBe(true);
    const boomerang = { ...createStartLoadout('boomerang'), weapons: { boomerang: 1, aura: 3 } };
    expect(mainWeaponOf(boomerang)).toBe('boomerang');
    expect(availableModifiers(boomerang)).toHaveLength(6);
    expect(availableModifiers({ ...createStartLoadout('bolt'), weapons: { aura: 1 } })).toEqual([]);
  });

  it('leaves out taken modifiers and their opposites', () => {
    const left = availableModifiers(withMods('bolt', ['heavybolt', 'ricochet']));
    expect(left).not.toContain('heavybolt');
    expect(left).not.toContain('ricochet');
    expect(left).not.toContain('volley');
    expect(left).toHaveLength(3);
    expect(availableModifiers(withMods('boomerang', ['pull']))).not.toContain('whirl');
  });

  it('rolls three different ones, fewer when fewer are left', () => {
    const rng = createRng(7);
    const three = rollModifierOptions(createStartLoadout('boomerang'), rng);
    expect(new Set(three).size).toBe(3);
    const almost = withMods('bolt', ['volley', 'ricochet', 'sparkchain', 'blasttip']);
    expect(rollModifierOptions(almost, rng)).toEqual(['frostbolt']);
  });

  it('a picked modifier goes into the loadout and shows as a modifier card', () => {
    const loadout = applyUpgrade(createStartLoadout('bolt'), { kind: 'modifier', id: 'volley' });
    expect(loadout.modifiers).toEqual(['volley']);
    const card = describeUpgrade({ kind: 'modifier', id: 'volley' });
    expect(card.badge).toContain('MODIFIER');
    expect(card.title).toBe('Volley');
  });

  it('changes the numbers it is meant to change', () => {
    const base: WeaponStats = {
      damage: 10,
      cooldown: 1000,
      count: 3,
      pierce: 1,
      speed: 400,
      area: 1,
      chains: 0,
      seek: 0,
      knockback: 0,
      splash: 0,
      percent: 0,
    };
    const heavy = applyModifierStats(base, ['heavybolt']);
    expect(heavy.count).toBe(1);
    expect(heavy.damage).toBe(35);
    expect(heavy.pierce).toBe(3);
    const volley = applyModifierStats(base, ['volley']);
    expect(volley.count).toBe(6);
    expect(volley.damage).toBeCloseTo(7.5);
    expect(applyModifierStats(base, ['wideblade']).area).toBe(1.5);
    expect(applyModifierStats(base, ['orbit'])).toEqual(base);
  });

  it('reads saved modifiers: unknown, doubled and opposite ones are dropped', () => {
    expect(parseModifiers(['volley', 'nope', 'volley', 'heavybolt', 'frostbolt'])).toEqual([
      'volley',
      'frostbolt',
    ]);
    expect(parseModifiers('volley')).toEqual([]);
  });

  it('an expedition keeps its modifiers; older ones have none', () => {
    const build = { level: 6, xp: 0, hp: 50, loadout: withMods('bolt', ['volley']) };
    const exp = parseExpedition({ startedFrom: '0,0', build, loot: {}, areasCleared: 1 });
    expect(exp?.build?.loadout.modifiers).toEqual(['volley']);
    const old = parseExpedition({
      startedFrom: '0,0',
      build: { ...build, loadout: createStartLoadout('bolt') },
    });
    expect(old?.build?.loadout.modifiers).toBeUndefined();
  });
});
