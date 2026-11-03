// The walkable village: its art (built by scripts/village/build_village.py) and how walking feels.
// The map, its props and the station zones come from public/assets/village/village.json.

import type { VillagerId } from './quests';

/**
 * Bump when the village art is rebuilt: the version goes into the file URLs, so browsers load the new files
 * instead of old ones from their cache (GitHub Pages keeps them cached for a while).
 */
const ART_VERSION = 7;

export const VILLAGE_ASSETS = {
  map: { key: 'village-map', path: `assets/village/village.json?v=${ART_VERSION}` },
  tiles: { key: 'village-tiles', path: `assets/village/village-tiles.png?v=${ART_VERSION}` },
  props: {
    key: 'village-props',
    image: `assets/village/village-props.png?v=${ART_VERSION}`,
    atlas: `assets/village/village-props.json?v=${ART_VERSION}`,
  },
  /** Name of the tileset inside the map */
  tilesetName: 'village-tiles',
} as const;

/** Villagers standing in the village (LPC sheets built by scripts/lpc/build_sprites.py). Where they stand comes
 * from the map (marks "villager-<name>"). */
export type VillagerSpriteId = 'elder' | 'trader' | 'smith';

export const VILLAGER_SPRITES: Record<VillagerSpriteId, { key: string; path: string }> = {
  elder: { key: 'villager-elder', path: `assets/sprites/villager-elder.png?v=${ART_VERSION}` },
  trader: { key: 'villager-trader', path: `assets/sprites/villager-trader.png?v=${ART_VERSION}` },
  smith: { key: 'villager-smith', path: `assets/sprites/villager-smith.png?v=${ART_VERSION}` },
};

/** Places you can walk to; each opens a panel. The ids match the station zones in the map. */
export type StationId = 'hearth' | 'cauldron' | 'merchant' | 'armory' | 'deeds' | 'house' | VillagerId;

export interface StationDef {
  id: StationId;
  /** Short name in the menu of places and on its sign */
  short: string;
  /** What you do there, one line in the menu of places */
  info: string;
  /** What the button says when you stand there */
  action: string;
  /** Texture of its symbol (drawn in BootScene) */
  icon: string;
}

/** In the order of the menu of places */
export const STATIONS: readonly StationDef[] = [
  {
    id: 'hearth',
    short: 'Hearth',
    info: 'Spend embers for good',
    action: 'Tend the Hearth',
    icon: 'place-hearth',
  },
  {
    id: 'cauldron',
    short: 'Cauldron',
    info: 'Brew potions from herbs',
    action: 'Brew potions',
    icon: 'place-cauldron',
  },
  {
    id: 'merchant',
    short: 'Trader',
    info: 'Lanterns, recipes, feathers',
    action: 'Trade',
    icon: 'place-merchant',
  },
  {
    id: 'armory',
    short: 'Armory',
    info: 'Choose your main weapon',
    action: 'Choose a weapon',
    icon: 'place-armory',
  },
  { id: 'elder', short: 'Elder', info: 'News and quests', action: 'Talk', icon: 'place-elder' },
  { id: 'deeds', short: 'Deeds', info: 'What you have done', action: 'Read the deeds', icon: 'place-deeds' },
  { id: 'house', short: 'House', info: 'Your stash and belt', action: 'Stash and belt', icon: 'place-house' },
];

/** The way out, last in the menu of places */
export const GATE_ENTRY = { short: 'Set out', info: 'To the map', icon: 'place-gate' } as const;

export const VILLAGE = {
  /** Walking speed (px/s, world units) */
  walkSpeed: 135,
  /** How much of the map you see: zoom = screen size / this, within the limits below */
  viewSize: 430,
  minZoom: 0.8,
  maxZoom: 2.2,
  /** Grid cell for finding a way around houses (px) */
  pathCell: 16,
  /** Kept free around the walker when finding a way (px): about its hitbox */
  pathClearance: 10,
  /** A way point counts as reached this close (px) */
  waypointReach: 6,
  /** Night over the village: darkness colour and strength (0..1), lighter than in a fight */
  nightColor: 0x05040e,
  nightDarkness: 0.72,
  /** Lights take the night away: how much at their middle (0..1) */
  lightStrength: 0.85,
  /** Reach of a light as a share of the radius its prop gives */
  lightReach: 0.85,
  /** Pools of light on the ground are flattened, as the view looks down at an angle */
  groundSquash: 0.6,
  /** Faint warm haze right around fires and lanterns (additive), its size as a share of the reach */
  hazeSize: 0.7,
  hazeStrength: 0.12,
  glowColor: 0xffb060,
  /** Reach of the light around the watchman's lantern (px) */
  lanternRadius: 85,
  /** Signs above the places: their size (px), how far they bob, and from how close their name shows */
  signSize: 26,
  signBob: 2.5,
  signNameNear: 150,
  /** Villagers turn to you when you come this close (px) */
  villagerTurnNear: 130,
  /** Their feet in the 64 px frame, from the top (px) */
  villagerFeetY: 54,
  /** They breathe: how much taller at the top of a breath, and how long one breath takes (ms) */
  villagerBreath: 0.018,
  villagerBreathMs: 1900,
  /** Seconds the note about what you brought home stays on screen */
  arrivalNoteSec: 7,
} as const;

/** Small signs of life in the village (systems/VillageAmbience.ts): times in ms, speeds in px/s */
export const VILLAGE_LIFE = {
  /** Sparks rising from the Nest and the forge */
  sparkEvery: 170,
  sparkLife: 1500,
  sparkRise: 32,
  sparkSpread: 9,
  /** Smoke from the forge's chimney, drifting with a light wind */
  smokeEvery: 420,
  smokeLife: 3600,
  smokeRise: 14,
  smokeDrift: 7,
  smokeAlpha: 0.16,
  smokeColor: 0x8a8494,
  /** Now and then a bat crosses the sky */
  batFirstMs: 6000,
  batEveryMs: 18000,
  batSpeed: 120,
  batScale: 0.75,
  /** Thin fog creeping along the palisade */
  fogPuffs: 16,
  fogSize: 220,
  fogAlpha: 0.07,
  fogColor: 0x9aa3b8,
} as const;
