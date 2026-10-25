// Deterministic randomness for world generation.
// Never use Math.random for anything that must be the same on every device (the map, hex contents).
// Only integer math is used here, so results are identical across browsers and platforms.

/** Turns any string into a 32-bit seed (FNV-1a). */
export function seedFromString(text: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** Mixes a seed and up to three integers into a well-distributed 32-bit value. */
export function hash32(seed: number, a: number, b = 0, c = 0): number {
  let h = seed ^ Math.imul(a | 0, 0x27d4eb2d) ^ Math.imul(b | 0, 0x165667b1) ^ Math.imul(c | 0, 0x9e3779b1);
  h = Math.imul(h ^ (h >>> 15), 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
  return (h ^ (h >>> 16)) >>> 0;
}

/** Like hash32, but as a float in [0, 1). */
export function hashFloat(seed: number, a: number, b = 0, c = 0): number {
  return hash32(seed, a, b, c) / 4294967296;
}

/** A seeded random number generator (mulberry32). Returns floats in [0, 1). */
export function createRng(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
