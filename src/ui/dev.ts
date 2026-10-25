// Dev mode: test helpers in the game, e.g. free herbs in the village.
// On in dev builds, and in any build (including PR previews) when the URL contains `?dev`.

let cached: boolean | null = null;

export function isDevMode(): boolean {
  if (cached === null) {
    cached = import.meta.env.DEV || urlHasDevFlag();
  }
  return cached;
}

function urlHasDevFlag(): boolean {
  try {
    return new URLSearchParams(window.location.search).has('dev');
  } catch {
    return false;
  }
}
