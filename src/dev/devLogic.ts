// Dev-only game logic (no Phaser, tested). See devMode.ts for how to remove dev tools.

import { DEEDS, type DeedId } from '../config/deeds';
import { MODIFIERS } from '../config/modifiers';
import { HERBS } from '../config/herbs';
import { EMBER_KEY } from '../config/merchant';
import type { PlayerStats, WeaponId } from '../config/types';
import { MAIN_WEAPONS, START_WEAPON } from '../config/weapons';
import { addLoot, type Loot } from '../logic/expedition';
import { hexDistance, hexKey, hexNeighbors, ORIGIN, type Hex } from '../logic/hex';
import type { SaveData } from '../logic/save';
import type { World } from '../logic/worldgen';
import type { Loadout } from '../logic/stats';
import { remainingSteps } from '../logic/stats';
import { availableModifiers, isModifierLevel, rollModifierOptions } from '../logic/modifiers';
import {
  applyUpgrade,
  availableUpgrades,
  describeUpgrade,
  mainWeaponCanGrow,
  offersMainWeapon,
  rollUpgradeOptions,
  type UpgradeOption,
} from '../logic/upgrades';
import { isLit, lightWatchfire, walkTo } from '../logic/worldProgress';
import { WORLD } from '../config/world';

/** Adds `amount` of every herb and `embers` embers to the stash. */
export function grantTestLoot(stash: Loot, amount: number, embers: number): Loot {
  const gift: Loot = { [EMBER_KEY]: embers };
  for (const id of Object.keys(HERBS)) gift[id] = amount;
  return addLoot(stash, gift);
}

/** God mode: much stronger and faster, so fights are quick to clear (damage is blocked elsewhere). */
export function godModeStats(stats: PlayerStats): PlayerStats {
  return {
    ...stats,
    might: stats.might * 10,
    haste: Math.max(0.2, stats.haste * 0.5),
    moveSpeed: stats.moveSpeed * 1.3,
    magnet: stats.magnet * 3,
  };
}

/**
 * Where a jump to `target` lands. An unlit watchfire is only lit by winning its fight, so the jump
 * lands next to it (on the side towards the village) instead of on it.
 */
export function jumpTarget(world: World, save: SaveData, target: Hex): Hex {
  const info = world.hexes.get(hexKey(target));
  if (info?.poi !== 'watchfire' || isLit(save.world, info.key)) return target;
  const options = hexNeighbors(target).filter((n) => world.hexes.has(hexKey(n)));
  return options.reduce(
    (best, n) => (hexDistance(n, ORIGIN) < hexDistance(best, ORIGIN) ? n : best),
    options[0],
  );
}

/** Jumps without a fight (see jumpTarget): the expedition and its loot stay as they are. */
export function jumpTo(world: World, save: SaveData, target: Hex): SaveData {
  const landing = jumpTarget(world, save, target);
  return { ...save, world: walkTo(save.world, landing) };
}

/** All deeds, or none once you have them all: to try out their bonuses. */
export function toggleAllDeeds(deeds: readonly DeedId[]): DeedId[] {
  return deeds.length === DEEDS.length ? [] : DEEDS.map((d) => d.id);
}

/** Below this many frames per second the FPS label lights up. */
export const LOW_FPS = 50;
/** How long frame times are collected before the FPS label updates (ms). */
const FPS_WINDOW_MS = 500;

export interface FpsReading {
  fps: number;
  /** The longest single frame in the window (ms): shows hitches that the average hides */
  worstMs: number;
}

/** Collects frame times and reports the average frame rate and the worst frame every half second. */
export class FrameWindow {
  private elapsed = 0;
  private frames = 0;
  private worst = 0;

  /** Adds one frame (ms). Returns a reading when a window is full, else null. */
  add(deltaMs: number): FpsReading | null {
    this.elapsed += deltaMs;
    this.frames += 1;
    this.worst = Math.max(this.worst, deltaMs);
    if (this.elapsed < FPS_WINDOW_MS) return null;
    const reading = { fps: (this.frames * 1000) / this.elapsed, worstMs: this.worst };
    this.elapsed = 0;
    this.frames = 0;
    this.worst = 0;
    return reading;
  }
}

/** Counts something that only goes up (kills) as a rate per minute over the last half minute. */
export class RollingRate {
  private samples: { t: number; total: number }[] = [];

  constructor(private readonly windowMs = 30000) {}

  /** Feed the running total at game time `nowMs`; returns the rate per minute. 0 until two seconds are measured. */
  update(total: number, nowMs: number): number {
    const samples = this.samples;
    // A smaller total or earlier time means a new run: start over.
    if (
      samples.length > 0 &&
      (total < samples[samples.length - 1].total || nowMs < samples[samples.length - 1].t)
    ) {
      samples.length = 0;
    }
    samples.push({ t: nowMs, total });
    // Keep one sample at or before the start of the window, drop the older ones.
    while (samples.length > 2 && samples[1].t <= nowMs - this.windowMs) samples.shift();
    const first = samples[0];
    const dt = nowMs - first.t;
    if (dt < 2000) return 0;
    return ((total - first.total) / dt) * 60000;
  }
}

export interface DevReadout {
  fps: FpsReading;
  enemies: number;
  killsPerMinute: number;
  /** What the spawn director is doing: its phase and how strong the stream is right now */
  director?: { phase: string; pressure: number };
}

/**
 * The dev readout in two parts: a short summary that sits in the panel's header (frame rate, enemies),
 * and the details shown when the panel is open (worst frame, kills per minute, the spawn director's pace).
 */
export function readoutParts(r: DevReadout): { summary: string; details: string } {
  const details = [`worst ${Math.round(r.fps.worstMs)} ms · ${Math.round(r.killsPerMinute)} kills/min`];
  if (r.director) details.push(`${r.director.phase} · x${r.director.pressure.toFixed(1)}`);
  return {
    summary: `${Math.round(r.fps.fps)} fps · ${r.enemies} enemies`,
    details: details.join('\n'),
  };
}

/**
 * A build as it could come in a real run: every level-up from 2 to `level` draws three cards and takes one
 * of them at random; at modifier levels a random modifier of the main weapon is taken instead. One-time
 * cards are left out (they leave nothing in the build).
 */
export function randomBuild(start: Loadout, level: number, rng: () => number): Loadout {
  let loadout = start;
  let misses = 0;
  for (let l = 2; l <= level; l++) {
    if (isModifierLevel(l)) {
      const mods = rollModifierOptions(loadout, rng);
      if (mods.length > 0) {
        loadout = applyUpgrade(loadout, {
          kind: 'modifier',
          id: mods[Math.floor(rng() * mods.length) % mods.length],
        });
        continue;
      }
    }
    const options = rollUpgradeOptions(loadout, rng, 3, false, misses);
    if (mainWeaponCanGrow(loadout)) misses = offersMainWeapon(options, loadout) ? 0 : misses + 1;
    loadout = applyUpgrade(loadout, pickLikeAPlayer(options, loadout, rng));
  }
  return loadout;
}

/** How much a typical player prefers a kind of card: their main weapon first, then their other weapons. */
const PLAYER_TASTE = { mainWeapon: 3, ownWeapon: 2, newWeapon: 1.2, item: 1, skill: 0.8 };

/** Picks one of the offered cards, leaning the way a typical player would (see PLAYER_TASTE). */
function pickLikeAPlayer(options: UpgradeOption[], loadout: Loadout, rng: () => number): UpgradeOption {
  const main = devMainWeapon(loadout);
  const weight = (o: UpgradeOption): number => {
    if (o.kind === 'weapon') {
      if (o.id === main) return PLAYER_TASTE.mainWeapon;
      return o.toLevel > 1 ? PLAYER_TASTE.ownWeapon : PLAYER_TASTE.newWeapon;
    }
    if (o.kind === 'skill') return PLAYER_TASTE.skill;
    return PLAYER_TASTE.item;
  };
  const total = options.reduce((s, o) => s + weight(o), 0);
  let roll = rng() * total;
  for (const o of options) {
    roll -= weight(o);
    if (roll < 0) return o;
  }
  return options[options.length - 1];
}

/** One entry of the dev upgrade list. */
export interface DevUpgradeEntry {
  option: UpgradeOption;
  label: string;
  group: DevUpgradeGroup;
}

/** The tabs of the dev upgrade list. */
export type DevUpgradeGroup = 'weapons' | 'mods' | 'items' | 'other';
export const DEV_UPGRADE_GROUPS: readonly DevUpgradeGroup[] = ['weapons', 'mods', 'items', 'other'];

/**
 * Every upgrade that could come now, for picking by hand: each missing level step of a weapon is its
 * own entry (instead of one card with a random step), then items, skills and one-time cards.
 */
export function devUpgradeList(loadout: Loadout): DevUpgradeEntry[] {
  const out: DevUpgradeEntry[] = [];
  for (const { option } of availableUpgrades(loadout, true)) {
    const options: UpgradeOption[] =
      option.kind === 'weapon' && option.toLevel > 1
        ? remainingSteps(loadout, option.id).map((step) => ({ ...option, step }))
        : [option];
    for (const o of options) {
      const card = describeUpgrade(o);
      const level = 'toLevel' in o ? (o.toLevel === 1 ? ' (new)' : ` ${o.toLevel}`) : '';
      const group = o.kind === 'weapon' ? 'weapons' : o.kind === 'passive' ? 'items' : 'other';
      out.push({ option: o, label: `${card.title}${level}: ${card.text}`, group });
    }
  }
  // Modifiers of the main weapon, which otherwise only come at modifier levels.
  for (const id of availableModifiers(loadout)) {
    const option: UpgradeOption = { kind: 'modifier', id };
    const card = describeUpgrade(option);
    out.push({ option, label: `${card.title}: ${card.text}`, group: 'mods' });
  }
  return out;
}

/** The main weapon in the loadout (the first one found), or undefined. */
export function devMainWeapon(loadout: Loadout): WeaponId | undefined {
  return MAIN_WEAPONS.find((id) => (loadout.weapons[id] ?? 0) > 0);
}

/** Swaps the main weapon for the next one at level 1; other weapons and items stay. */
export function devSwapMainWeapon(loadout: Loadout): Loadout {
  const current = devMainWeapon(loadout);
  const next =
    current === undefined
      ? START_WEAPON
      : MAIN_WEAPONS[(MAIN_WEAPONS.indexOf(current) + 1) % MAIN_WEAPONS.length];
  const weapons: Loadout['weapons'] = {};
  const weaponSteps: Loadout['weaponSteps'] = { ...loadout.weaponSteps };
  for (const [id, level] of Object.entries(loadout.weapons) as [WeaponId, number][]) {
    if (id === current) weapons[next] = 1;
    else weapons[id] = level;
  }
  if (current === undefined) weapons[next] = 1;
  if (current) delete weaponSteps[current];
  delete weaponSteps[next];
  // Modifiers belong to the weapon that is put away.
  const modifiers = (loadout.modifiers ?? []).filter((id) => MODIFIERS[id].weapon !== current);
  return { ...loadout, weapons, weaponSteps, modifiers };
}

/**
 * Lights every watchfire on the map (each reveals the land around it), or puts them all out when every one
 * already burns. The map then earns the watchfire deeds as usual (with their embers).
 */
export function toggleAllWatchfires(world: World, save: SaveData): SaveData {
  const fires = [...world.hexes.values()].filter((h) => h.poi === 'watchfire').map((h) => h.key);
  if (fires.every((k) => isLit(save.world, k)))
    return { ...save, world: { ...save.world, litWatchfires: [] } };
  let progress = save.world;
  for (const key of fires) progress = lightWatchfire(progress, key, WORLD.watchfireRevealRadius);
  return { ...save, world: progress };
}

/** The dev autopilot: how it moves (px for distances). */
export const AUTOPILOT = {
  /** Enemies within this distance push it away; closer ones push harder */
  fleeRadius: 220,
  /** It circles around where it started, at about this distance, so it does not run off into the dark */
  orbitRadius: 260,
  /** How strongly it keeps circling (sideways) compared to fleeing */
  circle: 0.6,
};

/**
 * The dev autopilot's move direction, like a player who kites: away from the enemies close by (closer ones
 * count more), sideways around its starting point, and back towards it when it wandered too far. Returns a
 * unit vector (or zero when nothing pulls).
 */
export function autopilotDirection(
  px: number,
  py: number,
  enemies: readonly { x: number; y: number }[],
  home: { x: number; y: number },
): { x: number; y: number } {
  let fx = 0;
  let fy = 0;
  for (const e of enemies) {
    const dx = px - e.x;
    const dy = py - e.y;
    const d = Math.hypot(dx, dy);
    if (d < 1 || d > AUTOPILOT.fleeRadius) continue;
    const w = 1 - d / AUTOPILOT.fleeRadius;
    fx += (dx / d) * w * w;
    fy += (dy / d) * w * w;
  }
  // Around the starting point: sideways, plus a pull back that grows the further out it is.
  const hx = px - home.x;
  const hy = py - home.y;
  const hd = Math.hypot(hx, hy) || 1;
  const out = hd / AUTOPILOT.orbitRadius;
  let x = fx + (-hy / hd) * AUTOPILOT.circle - (hx / hd) * Math.max(0, out - 1) * 2;
  let y = fy + (hx / hd) * AUTOPILOT.circle - (hy / hd) * Math.max(0, out - 1) * 2;
  const len = Math.hypot(x, y);
  if (len < 1e-6) return { x: 0, y: 0 };
  x /= len;
  y /= len;
  return { x, y };
}
