import { describe, expect, it } from 'vitest';
import { facingFor } from './facing';

describe('facing', () => {
  it('faces along the larger axis', () => {
    expect(facingFor(5, 1)).toBe('right');
    expect(facingFor(-5, 1)).toBe('left');
    expect(facingFor(1, -5)).toBe('up');
    expect(facingFor(1, 5)).toBe('down');
    expect(facingFor(3, 3)).toBe('down');
  });
});
