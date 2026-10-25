// Hex grid math with axial coordinates (q, r). World generation uses the pointy-top layout;
// the world map draws the same grid flat-top (rotated by 30°) to match its tile art.
// Reference: https://www.redblobgames.com/grids/hexagons/

export interface Hex {
  q: number;
  r: number;
}

export const HEX_DIRECTIONS: readonly Hex[] = [
  { q: 1, r: 0 },
  { q: 1, r: -1 },
  { q: 0, r: -1 },
  { q: -1, r: 0 },
  { q: -1, r: 1 },
  { q: 0, r: 1 },
];

export const ORIGIN: Hex = { q: 0, r: 0 };

export function hexKey(h: Hex): string {
  return `${h.q},${h.r}`;
}

export function parseHexKey(key: string): Hex {
  const [q, r] = key.split(',').map(Number);
  return { q, r };
}

export function hexEquals(a: Hex, b: Hex): boolean {
  return a.q === b.q && a.r === b.r;
}

export function hexAdd(a: Hex, b: Hex): Hex {
  return { q: a.q + b.q, r: a.r + b.r };
}

/** Number of steps between two hexes. */
export function hexDistance(a: Hex, b: Hex): number {
  const dq = a.q - b.q;
  const dr = a.r - b.r;
  return (Math.abs(dq) + Math.abs(dr) + Math.abs(dq + dr)) / 2;
}

export function hexNeighbors(h: Hex): Hex[] {
  return HEX_DIRECTIONS.map((d) => hexAdd(h, d));
}

export function areNeighbors(a: Hex, b: Hex): boolean {
  return hexDistance(a, b) === 1;
}

/** All hexes within `radius` steps of the origin, ordered by ring. */
export function hexesInRadius(radius: number): Hex[] {
  const out: Hex[] = [];
  for (let q = -radius; q <= radius; q++) {
    for (let r = Math.max(-radius, -q - radius); r <= Math.min(radius, -q + radius); r++) {
      out.push({ q, r });
    }
  }
  return out.sort((a, b) => hexDistance(a, ORIGIN) - hexDistance(b, ORIGIN));
}

/** Centre of a hex in pixels for a pointy-top layout with the given hex radius. */
export function hexToPixel(h: Hex, size: number): { x: number; y: number } {
  return { x: size * Math.sqrt(3) * (h.q + h.r / 2), y: size * 1.5 * h.r };
}

/** The hex under a pixel position (inverse of hexToPixel). */
export function pixelToHex(x: number, y: number, size: number): Hex {
  const q = ((Math.sqrt(3) / 3) * x - y / 3) / size;
  const r = ((2 / 3) * y) / size;
  return hexRound(q, r);
}

/** Centre of a hex in pixels for a flat-top layout with the given hex radius. */
export function hexToPixelFlat(h: Hex, size: number): { x: number; y: number } {
  return { x: size * 1.5 * h.q, y: size * Math.sqrt(3) * (h.r + h.q / 2) };
}

/** The hex under a pixel position in a flat-top layout (inverse of hexToPixelFlat). */
export function pixelToHexFlat(x: number, y: number, size: number): Hex {
  const q = ((2 / 3) * x) / size;
  const r = ((-1 / 3) * x + (Math.sqrt(3) / 3) * y) / size;
  return hexRound(q, r);
}

/** Rounds fractional axial coordinates to the nearest hex. */
export function hexRound(q: number, r: number): Hex {
  const s = -q - r;
  let rq = Math.round(q);
  let rr = Math.round(r);
  const rs = Math.round(s);
  const dq = Math.abs(rq - q);
  const dr = Math.abs(rr - r);
  const ds = Math.abs(rs - s);
  if (dq > dr && dq > ds) rq = -rr - rs;
  else if (dr > ds) rr = -rq - rs;
  // `|| 0` turns -0 into 0 so keys stay stable.
  return { q: rq || 0, r: rr || 0 };
}
