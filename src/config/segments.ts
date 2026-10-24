import type { SegmentDef } from './types';

export const SEGMENTS: Record<string, SegmentDef> = {
  graveyard: {
    id: 'graveyard',
    name: 'Old Graveyard',
    durationSec: 180,
    warningSec: 15,
  },
};

export const DEFAULT_SEGMENT: SegmentDef = SEGMENTS.graveyard;
