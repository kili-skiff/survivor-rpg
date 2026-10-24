import type { SegmentDef } from '../config/types';

export type RunOutcome = 'cleared' | 'fallen';

/** Seconds left until the segment is cleared, never below 0. */
export function segmentRemaining(def: SegmentDef, time: number): number {
  return Math.max(0, def.durationSec - time);
}

export function isSegmentCleared(def: SegmentDef, time: number): boolean {
  return time >= def.durationSec;
}

/** 0 at the start, 1 when cleared. */
export function segmentProgress(def: SegmentDef, time: number): number {
  return Math.min(1, Math.max(0, time / def.durationSec));
}

export function isSegmentWarning(def: SegmentDef, time: number): boolean {
  const left = segmentRemaining(def, time);
  return left > 0 && left <= def.warningSec;
}
