/** XP required to go from `level` to `level + 1`. */
export function xpToNext(level: number): number {
  const l = Math.max(1, level) - 1;
  return Math.round(5 + l * 6 + Math.pow(l, 1.55));
}

export interface XpState {
  level: number;
  xp: number;
}

/** Adds XP and returns the new state plus the number of level-ups. */
export function addXp(state: XpState, amount: number): XpState & { levelsGained: number } {
  let { level, xp } = state;
  xp += amount;
  let levelsGained = 0;
  while (xp >= xpToNext(level)) {
    xp -= xpToNext(level);
    level += 1;
    levelsGained += 1;
  }
  return { level, xp, levelsGained };
}

export function formatTime(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  const m = Math.floor(s / 60);
  return `${String(m).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}
