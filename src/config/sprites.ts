// Animated character sprites for fights (art: LPC, see CREDITS.md; built by scripts/lpc/build_sprites.py).
// To swap the art later, replace the sheets and adjust the numbers here; nothing else needs to change.

/** Where a character looks or walks */
export type Facing = 'up' | 'left' | 'down' | 'right';

/** Layout shared by all sheets: frames of `frameSize` px, one walk row per facing, then a death row. */
export const SHEET = {
  frameSize: 64,
  /** Frames per row in the sheet */
  columns: 9,
  /** Walk frames per facing; frame 0 is the standing pose */
  walkFrames: 9,
  dieFrames: 6,
  rows: { up: 0, left: 1, down: 2, right: 3, die: 4 } as const,
} as const;

export interface CharacterSprite {
  key: string;
  path: string;
  /** Display scale of the 64 px frames */
  scale: number;
  /** Walk animation speed (frames per second) */
  walkFps: number;
  /** Centre of the body in the frame, below the frame centre (px, unscaled): hitboxes sit here */
  bodyY: number;
  /** Height of the eyes above the frame centre (px, unscaled): where glowing eyes show in the dark */
  eyesY: number;
}

export type CharacterSpriteId = 'player' | 'zombie' | 'ghoul' | 'brute';

export const CHARACTER_SPRITES: Record<CharacterSpriteId, CharacterSprite> = {
  player: {
    key: 'sprite-player',
    path: 'assets/sprites/player.png',
    scale: 1,
    walkFps: 11,
    bodyY: 10,
    eyesY: 9,
  },
  zombie: {
    key: 'sprite-zombie',
    path: 'assets/sprites/zombie.png',
    scale: 1,
    walkFps: 7,
    bodyY: 10,
    eyesY: 9,
  },
  ghoul: {
    key: 'sprite-ghoul',
    path: 'assets/sprites/ghoul.png',
    scale: 1,
    walkFps: 12,
    bodyY: 10,
    eyesY: 9,
  },
  brute: {
    key: 'sprite-brute',
    path: 'assets/sprites/brute.png',
    scale: 1.5,
    walkFps: 6,
    bodyY: 10,
    eyesY: 9,
  },
};

/** Animation keys of a sheet */
export const walkAnim = (key: string, facing: Facing) => `${key}-walk-${facing}`;
export const dieAnim = (key: string) => `${key}-die`;
