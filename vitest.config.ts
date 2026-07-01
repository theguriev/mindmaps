import { defineConfig } from 'vitest/config'
import { fileURLToPath, URL } from 'node:url'

// Standalone test config (does not load the app's Vite plugins — the router
// codegen, React Compiler and Tailwind aren't needed for pure-logic unit tests).
export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts']
  },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url))
    }
  }
})
