import type { BiomeId } from './types';

// Seamless ground tiles for fights, one per biome (made by scripts/ground/build_ground.py).
// To give the ground other art later, replace the files and keep the names and the tile size.

/** Width and height of one ground tile in px (a power of two, so it repeats cleanly) */
export const GROUND_TILE = 256;

export interface GroundTexture {
  key: string;
  path: string;
}

export const GROUND_TEXTURES: Record<BiomeId, GroundTexture> = {
  meadow: { key: 'ground-meadow', path: 'assets/ground/meadow.png' },
  forest: { key: 'ground-forest', path: 'assets/ground/forest.png' },
  swamp: { key: 'ground-swamp', path: 'assets/ground/swamp.png' },
  graveyard: { key: 'ground-graveyard', path: 'assets/ground/graveyard.png' },
  hills: { key: 'ground-hills', path: 'assets/ground/hills.png' },
};
