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
