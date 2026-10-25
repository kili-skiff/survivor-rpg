import type { BiomeId, PoiId } from './types';

// Hex tile art for the world map (flat-top hexes, pixel art).
// The sheet is a grid of 8 columns; frame = row * 8 + column.
export const TILESET = {
  key: 'hex-tiles',
  path: 'assets/tiles/hex-tiles.png',
  frameWidth: 32,
  frameHeight: 48,
  /** Width of the hex face in the frame (px); the face is a regular flat-top hex */
  faceWidth: 32,
  /** Vertical centre of the hex face in the frame (px); trees and mountains rise above it */
  faceCenterY: 31.5,
} as const;

const frame = (row: number, col: number) => row * 8 + col;

/** Tile variants per biome; each hex picks one by its position, so the map looks varied. */
export const BIOME_TILES: Record<BiomeId, number[]> = {
  meadow: [frame(0, 0), frame(0, 0), frame(0, 1), frame(1, 6)],
  forest: [frame(0, 2), frame(0, 2), frame(1, 4), frame(4, 0)],
  swamp: [frame(1, 5), frame(1, 5), frame(1, 7)],
  graveyard: [frame(5, 0), frame(0, 3), frame(5, 0)],
  hills: [frame(3, 1), frame(3, 2), frame(3, 1), frame(3, 3)],
};

/** Points of interest with their own tile; the others keep the biome tile and a glyph. */
export const POI_TILES: Partial<Record<PoiId, number>> = {
  village: frame(1, 0),
  merchant: frame(1, 1),
  dungeon: frame(1, 2),
};
