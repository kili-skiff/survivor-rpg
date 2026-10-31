import type { SkillDef, SkillId } from './types';

// Active skills: triggered by the player (key or button).
export const SKILLS: Record<SkillId, SkillDef> = {
  dash: {
    id: 'dash',
    name: 'Shadow Dash',
    description: 'A short, invulnerable sprint in your movement direction.',
    texture: 'icon-dash',
    rarity: 'common',
    base: { cooldown: 3200, damage: 0, radius: 0, duration: 190, slow: 0 },
    levels: [
      { text: 'Cooldown −0.5 s', mods: { cooldown: -500 } },
      { text: 'Dash further', mods: { duration: 60 } },
      { text: 'Deals 20 damage along the path', mods: { damage: 20 } },
      { text: 'Cooldown −0.5 s, +15 damage', mods: { cooldown: -500, damage: 15 } },
    ],
  },
  nova: {
    id: 'nova',
    name: 'Frost Nova',
    description: 'A blast of ice around you that damages and heavily slows enemies.',
    texture: 'icon-nova',
    rarity: 'common',
    base: { cooldown: 8000, damage: 25, radius: 140, duration: 2200, slow: 0.55 },
    levels: [
      { text: '+15 damage', mods: { damage: 15 } },
      { text: '+25% radius', mods: { radius: 35 } },
      { text: 'Cooldown −1.5 s', mods: { cooldown: -1500 } },
      { text: '+20 damage, longer slow', mods: { damage: 20, duration: 800 } },
    ],
  },
};

/** Speed during the dash in px/s */
export const DASH_SPEED = 720;
