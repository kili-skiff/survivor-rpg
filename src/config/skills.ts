import type { SkillDef, SkillId } from './types';

// Active skills: triggered by the player (key or button).
export const SKILLS: Record<SkillId, SkillDef> = {
  dash: {
    id: 'dash',
    name: 'Schattensprung',
    description: 'Kurzer, unverwundbarer Sprint in Laufrichtung.',
    texture: 'icon-dash',
    base: { cooldown: 3200, damage: 0, radius: 0, duration: 190, slow: 0 },
    levels: [
      { text: 'Abklingzeit −0,5 s', mods: { cooldown: -500 } },
      { text: 'Weiter springen', mods: { duration: 60 } },
      { text: 'Hinterlässt Schaden (20) auf dem Weg', mods: { damage: 20 } },
      { text: 'Abklingzeit −0,5 s, +15 Schaden', mods: { cooldown: -500, damage: 15 } },
    ],
  },
  nova: {
    id: 'nova',
    name: 'Frostnova',
    description: 'Eisstoß um dich herum: Schaden und starke Verlangsamung.',
    texture: 'icon-nova',
    base: { cooldown: 8000, damage: 25, radius: 140, duration: 2200, slow: 0.55 },
    levels: [
      { text: '+15 Schaden', mods: { damage: 15 } },
      { text: '+25 % Radius', mods: { radius: 35 } },
      { text: 'Abklingzeit −1,5 s', mods: { cooldown: -1500 } },
      { text: '+20 Schaden, länger verlangsamt', mods: { damage: 20, duration: 800 } },
    ],
  },
};

/** Speed during the dash in px/s */
export const DASH_SPEED = 720;
