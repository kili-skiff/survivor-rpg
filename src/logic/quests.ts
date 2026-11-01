// Quests given by villagers. For now one: find the old tower far out on the map.
// The tower itself is sealed; the quest is about the way there.

import { FIRE_QUEST } from '../config/quests';
import { areNeighbors, hexDistance, ORIGIN, parseHexKey } from './hex';
import type { World } from './worldgen';
import type { WorldProgress } from './worldProgress';

/** none: not offered yet · offered: the elder has something to say · active: on the way · done: reached */
export type QuestStage = 'none' | 'offered' | 'active' | 'done';

export interface QuestProgress {
  /** The first quest: the elder gives you the lantern and sends you to light a watchfire */
  fire: QuestStage;
  tower: QuestStage;
  /** The scout told you about the camp on the way to the tower */
  scoutTalked: boolean;
  /** Quest goals are marked on the map (the player can switch this off) */
  tracked: boolean;
}

export function freshQuests(): QuestProgress {
  return { fire: 'offered', tower: 'none', scoutTalked: false, tracked: true };
}

/** Taking the lantern: the watchfire quest starts. */
export function acceptFireQuest(q: QuestProgress): QuestProgress {
  return q.fire === 'offered' ? { ...q, fire: 'active' } : q;
}

/** The unlit watchfire closest to the village: the first one the elder points out. */
export function nearestWatchfire(world: World, progress: WorldProgress): string | null {
  let best: { key: string; d: number } | null = null;
  for (const h of world.hexes.values()) {
    if (h.poi !== 'watchfire' || progress.litWatchfires.includes(h.key)) continue;
    const d = hexDistance(h.hex, ORIGIN);
    if (!best || d < best.d || (d === best.d && h.key < best.key)) best = { key: h.key, d };
  }
  return best?.key ?? null;
}

/** Lighting any watchfire completes the quest. Returns the embers reward (0 when nothing happened). */
export function completeFireQuest(
  q: QuestProgress,
  litWatchfire: boolean,
): { quests: QuestProgress; embers: number } {
  if (!litWatchfire || q.fire !== 'active') return { quests: q, embers: 0 };
  return { quests: { ...q, fire: 'done' }, embers: FIRE_QUEST.rewardEmbers };
}

/** Coming home for the first time: the elder offers the tower quest. */
export function questsOnArrival(q: QuestProgress): QuestProgress {
  return q.tower === 'none' ? { ...q, tower: 'offered' } : q;
}

export function acceptTowerQuest(q: QuestProgress): QuestProgress {
  return q.tower === 'offered' ? { ...q, tower: 'active' } : q;
}

/** The scout only has something to tell once the tower quest is under way. */
export function scoutAvailable(q: QuestProgress): boolean {
  return q.tower === 'active' || q.tower === 'done';
}

export function talkToScout(q: QuestProgress): QuestProgress {
  return scoutAvailable(q) ? { ...q, scoutTalked: true } : q;
}

/** Standing next to the tower completes the quest. */
export function questsAfterMove(q: QuestProgress, world: World, progress: WorldProgress): QuestProgress {
  if (q.tower !== 'active') return q;
  const pos = parseHexKey(progress.position);
  const tower = parseHexKey(world.tower);
  return areNeighbors(pos, tower) ? { ...q, tower: 'done' } : q;
}

/** Hexes the quests reveal on the map (shown even in the fog). */
export function questRevealed(q: QuestProgress, world: World, progress: WorldProgress): string[] {
  const keys: string[] = [];
  const fire = q.fire === 'active' ? nearestWatchfire(world, progress) : null;
  if (fire) keys.push(fire);
  if (q.tower === 'active' || q.tower === 'done') keys.push(world.tower);
  if (q.scoutTalked && world.roadCamp) keys.push(world.roadCamp);
  return keys;
}

/** Hexes that are quest goals: the tower until reached, the road camp until it is a waypoint. */
export function questGoals(q: QuestProgress, world: World, progress: WorldProgress): string[] {
  const keys: string[] = [];
  const fire = q.fire === 'active' ? nearestWatchfire(world, progress) : null;
  if (fire) keys.push(fire);
  if (q.tower === 'active') keys.push(world.tower);
  if (q.scoutTalked && world.roadCamp && !progress.waypoints.includes(world.roadCamp))
    keys.push(world.roadCamp);
  return keys;
}

/** Goals marked on the map: none while tracking is switched off. */
export function questMarked(q: QuestProgress, world: World, progress: WorldProgress): string[] {
  return q.tracked ? questGoals(q, world, progress) : [];
}

export function toggleTracking(q: QuestProgress): QuestProgress {
  return { ...q, tracked: !q.tracked };
}

const STAGES: readonly QuestStage[] = ['none', 'offered', 'active', 'done'];

export function parseQuests(raw: unknown): QuestProgress {
  const base = freshQuests();
  if (!raw || typeof raw !== 'object') return base;
  const d = raw as Record<string, unknown>;
  const tower = STAGES.includes(d.tower as QuestStage) ? (d.tower as QuestStage) : base.tower;
  return {
    // Saves from before this quest existed skip it when the player is already further along.
    fire: STAGES.includes(d.fire as QuestStage)
      ? (d.fire as QuestStage)
      : tower === 'none'
        ? base.fire
        : 'done',
    tower,
    scoutTalked: d.scoutTalked === true,
    tracked: d.tracked !== false,
  };
}
