// The touch stick: from where the thumb went down and where it is now to a movement direction.
// Shared by the fight and the village. Pure and tested.

/** Below this share of the radius the stick counts as centred */
export const STICK_DEADZONE = 0.12;
/** The base follows the thumb once it is pulled further than this many radii */
export const STICK_FOLLOW = 1.4;

export interface StickReading {
  /** Movement direction, length 0..1 */
  x: number;
  y: number;
  /** Where the base is now (it follows a thumb that pulls far out; feels better on phones) */
  originX: number;
  originY: number;
}

export function readStick(
  originX: number,
  originY: number,
  thumbX: number,
  thumbY: number,
  radius: number,
): StickReading {
  let dx = thumbX - originX;
  let dy = thumbY - originY;
  let len = Math.hypot(dx, dy);
  if (len > radius * STICK_FOLLOW) {
    originX = thumbX - (dx / len) * radius * STICK_FOLLOW;
    originY = thumbY - (dy / len) * radius * STICK_FOLLOW;
    dx = thumbX - originX;
    dy = thumbY - originY;
    len = Math.hypot(dx, dy);
  }
  const mag = Math.min(len / radius, 1);
  if (mag < STICK_DEADZONE) return { x: 0, y: 0, originX, originY };
  return { x: (dx / len) * mag, y: (dy / len) * mag, originX, originY };
}
