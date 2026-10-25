// Quests given by villagers. For now one: find the old tower far out on the map.
// The tower itself is sealed; the quest is about the way there.

import { areNeighbors, parseHexKey } from './hex';
import type { World } from './worldgen';
import type { WorldProgress } from './worldProgress';

/** none: not offered yet · offered: the elder has something to say · active: on the way · done: reached */
export type QuestStage = 'none' | 'offered' | 'active' | 'done';

export interface QuestProgress {
  tower: QuestStage;
  /** The scout told you about the camp on the way to the tower */
  scoutTalked: boolean;
}

export function freshQuests(): QuestProgress {
  return { tower: 'none', scoutTalked: false };
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
export function questRevealed(q: QuestProgress, world: World): string[] {
  const keys: string[] = [];
  if (q.tower === 'active' || q.tower === 'done') keys.push(world.tower);
  if (q.scoutTalked && world.roadCamp) keys.push(world.roadCamp);
  return keys;
}

/** Hexes marked as goals: the tower until reached, the road camp until it is a waypoint. */
export function questMarked(q: QuestProgress, world: World, progress: WorldProgress): string[] {
  const keys: string[] = [];
  if (q.tower === 'active') keys.push(world.tower);
  if (q.scoutTalked && world.roadCamp && !progress.waypoints.includes(world.roadCamp))
    keys.push(world.roadCamp);
  return keys;
}

const STAGES: readonly QuestStage[] = ['none', 'offered', 'active', 'done'];

export function parseQuests(raw: unknown): QuestProgress {
  const base = freshQuests();
  if (!raw || typeof raw !== 'object') return base;
  const d = raw as Record<string, unknown>;
  return {
    tower: STAGES.includes(d.tower as QuestStage) ? (d.tower as QuestStage) : base.tower,
    scoutTalked: d.scoutTalked === true,
  };
}
