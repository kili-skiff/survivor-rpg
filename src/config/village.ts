// The walkable village: its art (built by scripts/village/build_village.py) and how walking feels.
// The map, its props and the station zones come from public/assets/village/village.json.

import type { VillagerId } from './quests';

export const VILLAGE_ASSETS = {
  map: { key: 'village-map', path: 'assets/village/village.json' },
  tiles: { key: 'village-tiles', path: 'assets/village/village-tiles.png' },
  props: {
    key: 'village-props',
    image: 'assets/village/village-props.png',
    atlas: 'assets/village/village-props.json',
  },
  /** Name of the tileset inside the map */
  tilesetName: 'village-tiles',
} as const;

/** Places you can walk to; each opens a panel. The ids match the station zones in the map. */
export type StationId = 'hearth' | 'cauldron' | 'merchant' | 'armory' | 'deeds' | 'house' | VillagerId;

export interface StationDef {
  id: StationId;
  /** Short name on the shortcut bar */
  short: string;
  /** What the button says when you stand there */
  action: string;
}

/** In the order of the shortcut bar */
export const STATIONS: readonly StationDef[] = [
  { id: 'hearth', short: 'Hearth', action: 'Tend the Hearth' },
  { id: 'cauldron', short: 'Cauldron', action: 'Brew potions' },
  { id: 'merchant', short: 'Trader', action: 'Trade' },
  { id: 'armory', short: 'Armory', action: 'Choose a weapon' },
  { id: 'elder', short: 'Elder', action: 'Talk' },
  { id: 'deeds', short: 'Deeds', action: 'Read the deeds' },
  { id: 'house', short: 'House', action: 'Stash and belt' },
];

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
  nightDarkness: 0.62,
  /** Warm glow of fires, lanterns and windows (additive) */
  glowStrength: 0.22,
  glowColor: 0xffb060,
  /** Radius of the lantern's glow around the watchman (px) */
  lanternRadius: 90,
  /** Seconds the note about what you brought home stays on screen */
  arrivalNoteSec: 7,
} as const;
