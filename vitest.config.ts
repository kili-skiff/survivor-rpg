import { defineConfig } from 'vitest/config';

// Tests only cover src/logic and src/config: no Phaser, no browser.
export default defineConfig({
  test: {
    include: ['src/**/*.test.ts'],
    environment: 'node',
  },
});
