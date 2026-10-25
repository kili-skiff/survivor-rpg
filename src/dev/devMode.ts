import { FONT } from '../ui/theme';

// Dev mode: test helpers in the game (free herbs, map reveal, jumping, instant clears).
//
// ALL dev-only code lives in src/dev/, and every call into it from the game is marked with a
// `// DEV:` comment. For a release: set DEV_TOOLS to false (everything stays in place but is never
// shown), or delete src/dev/ and the lines marked `// DEV:`.

/** Master switch for all dev tools. */
export const DEV_TOOLS = true;

let cached: boolean | null = null;

/** On in dev builds, and in any build (including PR previews) when the URL contains `?dev`. */
export function isDevMode(): boolean {
  if (!DEV_TOOLS) return false;
  if (cached === null) cached = import.meta.env.DEV || urlHasDevFlag();
  return cached;
}

function urlHasDevFlag(): boolean {
  try {
    return new URLSearchParams(window.location.search).has('dev');
  } catch {
    return false;
  }
}

/** Look of all dev buttons: purple, so they are never mistaken for game UI. */
export function devButtonStyle(u: number, active = false) {
  return {
    fontFamily: FONT,
    fontSize: `${Math.round(12 * u)}px`,
    fontStyle: 'bold',
    color: '#f0abfc',
    backgroundColor: active ? '#6b21a8' : '#3b0764',
    padding: { x: Math.round(10 * u), y: Math.round(7 * u) },
  };
}
