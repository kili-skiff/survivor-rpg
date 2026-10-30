// How the behaviour of an enemy type (config/enemies.ts) turns into steering values for the swarm.
// Pure and tested, no Phaser.

import { SWARM } from '../config/balance';
import type { EnemyBehavior } from '../config/types';
import type { Rng } from './swarm';

/** The part of the swarm agent that depends on the enemy's behaviour. */
export interface BehaviorSteering {
  arc: number;
  lead: number;
  wobble: number;
  wobbleHz: number;
}

/** Steering values for a new enemy of this behaviour; side and the like are decided here, per enemy. */
export function steeringFor(behavior: EnemyBehavior | undefined, rng: Rng): BehaviorSteering {
  const plain: BehaviorSteering = { arc: 0, lead: 0, wobble: SWARM.wobble, wobbleHz: SWARM.wobbleHz };
  switch (behavior?.kind) {
    case 'flank': {
      const side = rng() < 0.5 ? -1 : 1;
      return { ...plain, arc: side * ((behavior.arcDeg * Math.PI) / 180), lead: behavior.leadSec };
    }
    case 'flutter':
      return { ...plain, wobble: behavior.sway, wobbleHz: behavior.swayHz };
    default:
      return plain;
  }
}
