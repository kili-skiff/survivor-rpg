// The watchman waking up in the Nest's fire, weak and in pain, and staggering out of it, as a pure function of time.

import { REBIRTH, REBIRTH_TOTAL_MS } from '../config/rebirth';

export interface RebirthFrame {
  /** Height of the fire: 0 = none, 1 = at its peak */
  fire: number;
  /** How much of the watchman is there: 0 = invisible, 1 = fully visible */
  body: number;
  /** How much he still glows like the fire: 1 = a glowing shape, 0 = his own colours */
  glow: number;
  /** How bent he is: 1 = hunched over, 0 = standing straight */
  hunch: number;
  /** How hard he trembles: 0 = still, 1 = as at the start */
  tremble: number;
  /** A jolt of pain: 1 at the moment it hits, fading fast */
  flinch: number;
  /** How far he has staggered from the fire to the spot where the village is his again: 0..1 */
  walk: number;
  /** He is in the middle of a lunge (walking); between lunges he stands and gasps */
  stepping: boolean;
  /** 0..1..0 over a lunge: the lurch up and forward of a step (0 when standing) */
  lurch: number;
  /** Which way he leans in this step: -1 or 1, alternating */
  lean: number;
  /** Strength of the lantern's flame: 0 = out, 1 = as usual (a flare can go above 1) */
  lantern: number;
  /** The rebirth is over: the villager may walk */
  done: boolean;
}

const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
const smooth = (x: number) => x * x * (3 - 2 * x);

export function rebirthFrame(timeMs: number): RebirthFrame {
  const R = REBIRTH;
  const up = smooth(clamp01(timeMs / R.fireUpMs));
  const down = 1 - smooth(clamp01((timeMs - R.fireDownFrom) / (R.fireOutAt - R.fireDownFrom)));
  const body = smooth(clamp01((timeMs - R.riseFrom) / R.riseMs));
  const glow = body > 0 ? 1 - smooth(clamp01((timeMs - R.glowFrom) / R.glowMs)) : 0;

  const getUp = smooth(clamp01((timeMs - R.getUpFrom) / R.getUpMs));
  const straighten = smooth(clamp01((timeMs - (R.walkFrom + R.walkMs)) / R.straightenMs));
  const hunch = (1 - getUp * (1 - R.hunchWalk)) * (1 - straighten);
  const tremble = timeMs < R.riseFrom ? 0 : (1 - 0.5 * getUp) * (1 - straighten);

  let flinch = 0;
  for (const at of R.flinchAt) if (timeMs >= at) flinch += Math.exp(-(timeMs - at) / R.flinchMs);

  // Stagger: a few lunges, each followed by a pause.
  const u = clamp01((timeMs - R.walkFrom) / R.walkMs);
  const k = u * R.steps;
  const idx = Math.min(R.steps - 1, Math.floor(k));
  const stride = u >= 1 ? 1 : clamp01((k - idx) / R.stepShare);
  const walk = u >= 1 ? 1 : (idx + smooth(stride)) / R.steps;
  const stepping = u > 0 && u < 1 && stride < 1;
  const lurch = stepping ? Math.sin(Math.PI * stride) : 0;
  const lean = idx % 2 === 0 ? 1 : -1;

  const x = clamp01((timeMs - R.lanternFrom) / R.lanternMs);
  const lantern = timeMs < R.lanternFrom ? 0 : smooth(x) + R.lanternFlare * Math.sin(Math.PI * x);

  return {
    fire: Math.min(up, down),
    body,
    glow,
    hunch,
    tremble,
    flinch,
    walk,
    stepping,
    lurch,
    lean,
    lantern,
    done: timeMs >= REBIRTH_TOTAL_MS,
  };
}
