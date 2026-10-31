import { describe, expect, it } from 'vitest';
import { assignShots } from './focus';

describe('assignShots', () => {
  it('sends the whole volley at the nearest enemy while it is not dead yet', () => {
    expect(
      assignShots(
        [
          { hp: 40, pending: 0 },
          { hp: 10, pending: 0 },
        ],
        3,
        12,
      ),
    ).toEqual([0, 0, 0]);
  });

  it('moves on once the damage on its way covers the health', () => {
    expect(
      assignShots(
        [
          { hp: 20, pending: 0 },
          { hp: 30, pending: 0 },
        ],
        3,
        12,
      ),
    ).toEqual([0, 0, 1]);
  });

  it('skips enemies that bolts in flight will already kill', () => {
    expect(
      assignShots(
        [
          { hp: 20, pending: 24 },
          { hp: 30, pending: 0 },
        ],
        2,
        12,
      ),
    ).toEqual([1, 1]);
  });

  it('puts left-over bolts on the last enemy when all are covered', () => {
    expect(assignShots([{ hp: 5, pending: 0 }], 3, 12)).toEqual([0, 0, 0]);
  });

  it('has no target without enemies', () => {
    expect(assignShots([], 2, 12)).toEqual([-1, -1]);
  });
});
