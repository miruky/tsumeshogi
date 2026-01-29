import { defineConfig } from 'vitest/config';

export default defineConfig({
  // GitHub Pages配信時はワークフローが TSUMESHOGI_BASE=/tsumeshogi/ を与える。
  base: process.env.TSUMESHOGI_BASE ?? '/',
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
