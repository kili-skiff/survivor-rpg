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

/** The first quest: the elder gives you a lantern and sends you to light the watchfires. */
export const FIRE_QUEST = {
  name: 'Light the Watchfires',
  /** Gold for lighting the first watchfire (enough for the first better lantern) */
  rewardGold: 30,
  elder: {
    offered:
      'The darkness has broken in, wanderer. The old watchfires went cold, and with them the safe roads.\n\n' +
      'Take this lantern. Its light is small, but it shows you what hunts you.\n\n' +
      'Light the watchfires out there; every flame pushes the night back. I marked the nearest one on your ' +
      'map. Find it in the dark there and light it. There will be a reward.',
    active:
      'The nearest watchfire is marked on your map. Fight your way there and light it. ' +
      'Keep your lantern close.',
    done:
      'The first fire burns again! I can see its glow from here.\n\n' +
      'There are more watchfires out there, in every direction. Each one makes the night a little smaller.',
  },
} as const;

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
