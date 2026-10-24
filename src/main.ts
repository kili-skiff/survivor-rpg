import * as Phaser from 'phaser';
import { BootScene } from './scenes/BootScene';
import { GameScene } from './scenes/GameScene';
import { UIScene } from './scenes/UIScene';
import { WorldMapScene } from './scenes/WorldMapScene';
import { renderScale, viewportSize } from './ui/display';

// The canvas renders in device pixels (max 2x) and is scaled to screen size via CSS,
// so everything stays sharp on phone displays.
function gameSize() {
  const vp = viewportSize();
  const rs = renderScale();
  return { width: Math.round(vp.width * rs), height: Math.round(vp.height * rs) };
}

const initial = gameSize();

const game = new Phaser.Game({
  type: Phaser.WEBGL,
  parent: 'game',
  backgroundColor: '#14111c',
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    width: initial.width,
    height: initial.height,
  },
  physics: {
    default: 'arcade',
    arcade: { debug: false },
  },
  input: { activePointers: 3 },
  render: { antialias: true, powerPreference: 'high-performance' },
  scene: [BootScene, WorldMapScene, GameScene, UIScene],
});

let resizeTimer: number | undefined;
function onViewportChange() {
  window.clearTimeout(resizeTimer);
  resizeTimer = window.setTimeout(() => {
    const { width, height } = gameSize();
    if (width !== game.scale.width || height !== game.scale.height) {
      game.scale.setGameSize(width, height);
    }
  }, 80);
}
window.addEventListener('resize', onViewportChange);
window.visualViewport?.addEventListener('resize', onViewportChange);
window.addEventListener('orientationchange', onViewportChange);

// Dev only: global access for debugging and automated tests.
if (import.meta.env.DEV) {
  (window as unknown as { __game: Phaser.Game }).__game = game;
}
