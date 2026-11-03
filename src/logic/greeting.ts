import { GREETINGS, type Greeting } from '../config/greetings';

/** A random villager's greeting for the watchman who just woke up (`rng` returns 0..1). */
export function pickGreeting(rng: () => number = Math.random): Greeting {
  const i = Math.min(GREETINGS.length - 1, Math.max(0, Math.floor(rng() * GREETINGS.length)));
  return GREETINGS[i];
}
