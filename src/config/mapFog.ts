// The fog that drifts over the world map. All values here, so the mood can be tuned in one place.
// Sizes are in hexes, so the fog looks the same at every zoom and screen size. No Phaser here.

/** One drifting sheet of fog. Two or more sheets moving differently make the fog look alive. */
export interface FogLayer {
  /** Texture key (generated at runtime) */
  key: string;
  /** Seed of the cloud pattern */
  seed: number;
  /** Cloud pattern: lattice cells per texture side, detail layers, and the density range */
  cells: number;
  octaves: number;
  low: number;
  high: number;
  /** Colour of the fog */
  color: number;
  /** Strongest opacity (0..1); the pattern thins it out in places */
  alpha: number;
  /** How many hexes one texture tile covers (bigger = larger clouds) */
  tileHexes: number;
  /** Drift in hexes per second */
  driftX: number;
  driftY: number;
  /** The opacity breathes by this share, once every `breathSec` seconds */
  breath: number;
  breathSec: number;
}

export const MAP_FOG = {
  /** Resolution of the cloud textures; they are soft, so a small size is enough */
  textureSize: 256,
  layers: [
    // Darkness: a heavy, slow sheet that dims the land and keeps the night mood.
    {
      key: 'map-fog-dark',
      seed: 4107,
      cells: 3,
      octaves: 4,
      low: 0.12,
      high: 0.62,
      color: 0x07060d,
      alpha: 0.62,
      tileHexes: 16,
      driftX: 0.22,
      driftY: 0.07,
      breath: 0.18,
      breathSec: 23,
    },
    // Mist: thin cold wisps drifting the other way, a little faster.
    {
      key: 'map-fog-mist',
      seed: 9931,
      cells: 5,
      octaves: 4,
      low: 0.32,
      high: 0.72,
      color: 0x7a76a2,
      alpha: 0.22,
      tileHexes: 10,
      driftX: -0.16,
      driftY: 0.1,
      breath: 0.3,
      breathSec: 15,
    },
  ] as FogLayer[],
  /** Warm light around a lit watchfire: it shows the land, but the fog stays */
  fireGlow: {
    color: 0xffa24a,
    /** Radius in hexes beyond the revealed area's edge */
    extraHexes: 0.6,
    /** Strength (additive, 0..1) */
    strength: 0.28,
    /** Flicker share of the strength */
    flicker: 0.12,
  },
  /** The village glows like a lit watchfire, always: the Nest never goes out */
  villageGlow: {
    /** Radius of the glow in hexes */
    radiusHexes: 3.2,
    /** Strength (additive, 0..1) */
    strength: 0.42,
  },
  /** How much of the fog over unexplored hexes and outside the map is covered up again (0 = none, 1 = fully black) */
  unexploredCover: 0.82,
  /** The fog stops this far (in hexes) beyond the outermost hex; beyond it only background */
  edgeHexes: 0.6,
  /** The fog sheets reach this far (in hexes) beyond the outermost hex; the part past the edge is covered up */
  marginHexes: 16,
} as const;
