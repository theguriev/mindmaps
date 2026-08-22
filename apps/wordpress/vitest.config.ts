import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    // Only the pure logic is unit-tested here — the editor draws to a real
    // canvas, so rendering it belongs in the plugin's browser tests, not jsdom.
    environment: 'node',
    include: ['src/**/*.test.ts']
  }
})
