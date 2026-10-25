// Villagers and what they say. Texts per quest stage; see logic/quests.ts for the rules.

export type VillagerId = 'elder' | 'scout';

export interface VillagerDef {
  id: VillagerId;
  name: string;
  /** Short role shown under the name */
  role: string;
  /** Colour of the villager's badge */
  color: number;
}

export const VILLAGERS: Record<VillagerId, VillagerDef> = {
  elder: { id: 'elder', name: 'Elder Maren', role: 'Village elder', color: 0xfbbf24 },
  scout: { id: 'scout', name: 'Scout Ilka', role: 'Scout', color: 0x7dd3fc },
};

export const TOWER_QUEST = {
  name: 'The Old Tower',
  elder: {
    none: 'Rest, wanderer. The night is long, and you have only just begun to walk it.',
    offered:
      'You made it home. Not many do these days.\n\nFar out, past the swamps and the hills, an old tower rises ' +
      'from the dark. Its light went out long ago. Find it, and tell me what you see.\n\n' +
      'I will mark it on your map.',
    active:
      'The tower stands at the very edge of the land; it is marked on your map. Scout Ilka knows the first ' +
      'stretch of the road. Talk to her before you set out.',
    done:
      'You stood before the tower, and its gate is sealed? Then the old magic still sleeps inside.\n\n' +
      'Rest now. When the time comes, we will find a way in.',
  },
  scout: {
    first:
      'Heading for the tower? Then go by the camp two hills out, that way. I have marked it on your map.\n\n' +
      'Rest there before you push further. Beyond it you will have to find your own camps.',
    after:
      'The camp is your first stop. Rest there, then keep going. There are more camps out there, if you look.',
  },
  /** Shown on the map for the tower */
  towerSealed: 'The gate is sealed. Old magic sleeps inside, for now.',
  towerFar: 'Elder Maren asked you to find it. Travel to a hex next to the tower.',
} as const;
