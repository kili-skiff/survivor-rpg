import { describe, expect, it } from 'vitest';
import type { KeyValueStorage } from './save';
import { defaultSettings, loadSettings, otherSide, parseSettings, writeSettings } from './settings';

function memoryStorage(): KeyValueStorage & { data: Map<string, string> } {
  const data = new Map<string, string>();
  return {
    data,
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => void data.set(key, value),
  };
}

describe('settings', () => {
  it('defaults to skills on the right', () => {
    expect(defaultSettings().skillSide).toBe('right');
    expect(loadSettings(undefined)).toEqual(defaultSettings());
    expect(loadSettings(memoryStorage())).toEqual(defaultSettings());
  });

  it('falls back to defaults for broken or unknown values', () => {
    expect(parseSettings(null)).toEqual(defaultSettings());
    expect(parseSettings('left')).toEqual(defaultSettings());
    expect(parseSettings({ skillSide: 'top' })).toEqual(defaultSettings());
    const storage = memoryStorage();
    storage.setItem('survivor-rpg.settings', '{not json');
    expect(loadSettings(storage)).toEqual(defaultSettings());
  });

  it('round-trips through storage', () => {
    const storage = memoryStorage();
    writeSettings(storage, { skillSide: 'left' });
    expect(loadSettings(storage).skillSide).toBe('left');
  });

  it('does not touch the save data', () => {
    const storage = memoryStorage();
    writeSettings(storage, { skillSide: 'left' });
    expect(storage.data.has('survivor-rpg.save')).toBe(false);
  });

  it('flips sides', () => {
    expect(otherSide('left')).toBe('right');
    expect(otherSide('right')).toBe('left');
  });
});
