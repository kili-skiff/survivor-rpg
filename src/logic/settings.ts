// Device settings: how the player likes to hold and control the game.
// Kept apart from SaveData, because they belong to the device and not to game progress.

import type { KeyValueStorage } from './save';

const SETTINGS_KEY = 'survivor-rpg.settings';

export type Side = 'left' | 'right';

export interface Settings {
  /** Screen side of the skill buttons on touch screens. */
  skillSide: Side;
  /** Night lighting in fights (darkness and lights); can be switched off on slow devices. */
  lighting: boolean;
  /** Small health bar under the player in fights. */
  healthBar: boolean;
}

export function defaultSettings(): Settings {
  return { skillSide: 'right', lighting: true, healthBar: true };
}

/** Reads settings leniently: unknown or broken values fall back to the defaults. */
export function parseSettings(raw: unknown): Settings {
  const base = defaultSettings();
  if (!raw || typeof raw !== 'object') return base;
  const data = raw as Partial<Record<keyof Settings, unknown>>;
  return {
    skillSide: data.skillSide === 'left' || data.skillSide === 'right' ? data.skillSide : base.skillSide,
    lighting: typeof data.lighting === 'boolean' ? data.lighting : base.lighting,
    healthBar: typeof data.healthBar === 'boolean' ? data.healthBar : base.healthBar,
  };
}

export function loadSettings(storage: KeyValueStorage | undefined): Settings {
  try {
    const text = storage?.getItem(SETTINGS_KEY);
    return text ? parseSettings(JSON.parse(text)) : defaultSettings();
  } catch {
    return defaultSettings();
  }
}

export function writeSettings(storage: KeyValueStorage | undefined, settings: Settings): void {
  try {
    storage?.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch {
    // Storage unavailable (e.g. private mode): the setting only lasts for this session.
  }
}

export function otherSide(side: Side): Side {
  return side === 'left' ? 'right' : 'left';
}
