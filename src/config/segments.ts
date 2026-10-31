import type { SegmentDef } from './types';

export const SEGMENTS: Record<string, SegmentDef> = {
  graveyard: {
    id: 'graveyard',
    name: 'Old Graveyard',
    goal: { kind: 'survive', durationSec: 180 },
    durationSec: 180,
    warningSec: 15,
    difficultyOffsetSec: 0,
    groundTint: 0x29223a,
    herbs: null,
  },
};

export const DEFAULT_SEGMENT: SegmentDef = SEGMENTS.graveyard;
