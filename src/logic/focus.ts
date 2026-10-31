// Focus fire: a volley of bolts goes to the nearest enemy until it is as good as dead, then to the next.
// So enemies die one after another instead of all of them taking a little. Pure and tested, no Phaser.

export interface FocusTarget {
  /** Health left */
  hp: number;
  /** Damage already on its way to it (bolts in flight) */
  pending: number;
}

/**
 * For each of `shots` bolts of `damage`, the index of the target in `targets` (nearest first) it should
 * go to. A target takes bolts until the damage on its way covers its health; then the next one does.
 * When every target is covered, the remaining bolts go to the last one, or -1 when there is none.
 */
export function assignShots(targets: readonly FocusTarget[], shots: number, damage: number): number[] {
  const out: number[] = [];
  if (targets.length === 0) {
    for (let i = 0; i < shots; i++) out.push(-1);
    return out;
  }
  const left = targets.map((t) => t.hp - t.pending);
  let at = 0;
  for (let i = 0; i < shots; i++) {
    while (at < targets.length - 1 && left[at] <= 0) at += 1;
    out.push(at);
    left[at] -= damage;
  }
  return out;
}

/**
 * The candidates with the locked target in front, so fire stays on one enemy until it dies. Without a
 * lock, or when it is no longer valid (`keep` false), the order (nearest first) stays as it is.
 */
export function lockFirst<T>(candidates: readonly T[], locked: T | null, keep: boolean): T[] {
  if (!locked || !keep) return [...candidates];
  return [locked, ...candidates.filter((c) => c !== locked)];
}
