export const COLORS = {
  bg: 0x14111c,
  player: 0x7dd3fc,
  playerEdge: 0xe0f2fe,
  hp: 0xf43f5e,
  hpBack: 0x3b1f2b,
  xp: 0x60a5fa,
  xpBack: 0x1e2440,
  gem: 0x60a5fa,
  gemBig: 0xc084fc,
  bolt: 0xfde68a,
  blade: 0xe5e7eb,
  aura: 0xfb923c,
  nova: 0x93c5fd,
  chain: 0xa5f3fc,
  heal: 0xf87171,
  panel: 0x221c30,
  panelEdge: 0x4c3f6b,
  accent: 0xfbbf24,
  text: 0xf5f3ff,
} as const;

export const FONT = 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';

export function css(color: number): string {
  return `#${color.toString(16).padStart(6, '0')}`;
}
