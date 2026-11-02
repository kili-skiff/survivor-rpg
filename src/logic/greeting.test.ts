import { describe, expect, it } from 'vitest';
import { GREETINGS } from '../config/greetings';
import { pickGreeting } from './greeting';

describe('greeting', () => {
  it('picks any greeting, from the first to the last', () => {
    expect(pickGreeting(() => 0)).toBe(GREETINGS[0]);
    expect(pickGreeting(() => 0.999999)).toBe(GREETINGS[GREETINGS.length - 1]);
  });

  it('stays in range for odd random values', () => {
    expect(pickGreeting(() => 1)).toBe(GREETINGS[GREETINGS.length - 1]);
    expect(pickGreeting(() => -0.5)).toBe(GREETINGS[0]);
  });

  it('has several different villagers with a line each', () => {
    expect(new Set(GREETINGS.map((g) => g.who)).size).toBeGreaterThanOrEqual(3);
    for (const g of GREETINGS) {
      expect(g.who.length).toBeGreaterThan(0);
      expect(g.line.length).toBeGreaterThan(0);
    }
    expect(new Set(GREETINGS.map((g) => g.line)).size).toBe(GREETINGS.length);
  });
});
