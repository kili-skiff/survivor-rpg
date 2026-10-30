// Aiming in the direction the player looks. Pure and tested, no Phaser.

/** Cosine of the half angle of a cone, for `inCone`. */
export function coneCos(halfAngleDeg: number): number {
  return Math.cos((halfAngleDeg * Math.PI) / 180);
}

/**
 * Whether the offset (dx, dy) lies within a cone around the unit direction (dirX, dirY).
 * `cosHalf` is `coneCos` of the cone's half angle. An offset of zero counts as inside.
 */
export function inCone(dx: number, dy: number, dirX: number, dirY: number, cosHalf: number): boolean {
  const d = Math.hypot(dx, dy);
  if (d < 0.001) return true;
  return (dx * dirX + dy * dirY) / d >= cosHalf;
}

/**
 * Angle offset of the k-th shot of a volley that fans out around the middle: 0, +step, -step, +2 step,
 * -2 step ... so one shot goes straight and more shots spread evenly to both sides.
 */
export function fanOffset(k: number, step: number): number {
  if (k <= 0) return 0;
  const side = k % 2 === 1 ? 1 : -1;
  return side * Math.ceil(k / 2) * step;
}
