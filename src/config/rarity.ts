import type { Rarity } from './types';

/**
 * Card rarities. `color` frames the card, `weight` scales how often it is offered next to the others
 * (1 = as often as a common card), `label` names it on the card.
 */
export const RARITIES: Record<Rarity, { label: string; color: number; weight: number }> = {
  common: { label: 'COMMON', color: 0x9ca3af, weight: 1 },
  magic: { label: 'MAGIC', color: 0x3b82f6, weight: 0.6 },
  legendary: { label: 'LEGENDARY', color: 0xf59e0b, weight: 0.25 },
};
