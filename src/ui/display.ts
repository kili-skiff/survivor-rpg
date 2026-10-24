// Helpers for crisp rendering on phone displays and around notches.

/** Render resolution relative to CSS pixels (capped at 2 for performance). */
export function renderScale(): number {
  return Math.min(window.devicePixelRatio || 1, 2);
}

export function viewportSize(): { width: number; height: number } {
  const vv = window.visualViewport;
  return {
    width: Math.max(1, Math.round(vv?.width ?? window.innerWidth)),
    height: Math.max(1, Math.round(vv?.height ?? window.innerHeight)),
  };
}

export interface SafeArea {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

let probe: HTMLDivElement | undefined;

/** Reads the safe area (notch, home indicator) in CSS pixels. */
export function safeArea(): SafeArea {
  if (!probe) {
    probe = document.createElement('div');
    probe.style.cssText =
      'position:fixed;visibility:hidden;pointer-events:none;' +
      'padding:env(safe-area-inset-top) env(safe-area-inset-right) env(safe-area-inset-bottom) env(safe-area-inset-left);';
    document.body.appendChild(probe);
  }
  const cs = getComputedStyle(probe);
  return {
    top: parseFloat(cs.paddingTop) || 0,
    right: parseFloat(cs.paddingRight) || 0,
    bottom: parseFloat(cs.paddingBottom) || 0,
    left: parseFloat(cs.paddingLeft) || 0,
  };
}
