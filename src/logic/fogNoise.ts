import { hashFloat } from './rng';

// Seamless cloud noise for the fog on the world map. Pure maths, so it is tested and needs no Phaser.

const smooth = (t: number) => t * t * (3 - 2 * t);

/**
 * Value noise in [0, 1] that repeats every `cells` lattice cells in both directions,
 * so a texture made from it tiles without seams.
 */
export function valueNoise(x: number, y: number, cells: number, seed: number): number {
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const fx = smooth(x - x0);
  const fy = smooth(y - y0);
  const wrap = (v: number) => ((v % cells) + cells) % cells;
  const at = (ix: number, iy: number) => hashFloat(seed, wrap(ix), wrap(iy));
  const top = at(x0, y0) * (1 - fx) + at(x0 + 1, y0) * fx;
  const bottom = at(x0, y0 + 1) * (1 - fx) + at(x0 + 1, y0 + 1) * fx;
  return top * (1 - fy) + bottom * fy;
}

export interface FogNoiseOptions {
  /** Lattice cells per texture side of the coarsest layer (more = smaller clouds) */
  cells: number;
  /** Layers of finer detail on top of the coarse one */
  octaves: number;
  /** Noise below this is clear air (0..1) */
  low: number;
  /** Noise above this is dense fog (0..1) */
  high: number;
}

/**
 * A square, seamlessly tiling fog density map: `size * size` values in 0..255, row by row.
 * Same seed and options always give the same map.
 */
export function fogDensity(size: number, seed: number, options: FogNoiseOptions): Uint8Array {
  const { cells, octaves, low, high } = options;
  const out = new Uint8Array(size * size);
  let weightSum = 0;
  for (let o = 0; o < octaves; o++) weightSum += 0.5 ** o;
  for (let py = 0; py < size; py++) {
    for (let px = 0; px < size; px++) {
      let n = 0;
      for (let o = 0; o < octaves; o++) {
        const c = cells * 2 ** o;
        n += valueNoise((px / size) * c, (py / size) * c, c, seed + o * 101) * 0.5 ** o;
      }
      const t = Math.min(1, Math.max(0, (n / weightSum - low) / (high - low)));
      out[py * size + px] = Math.round(smooth(t) * 255);
    }
  }
  return out;
}
