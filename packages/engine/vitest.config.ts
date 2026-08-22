import { defineConfig } from 'vitest/config'

// Pure-logic unit tests (domain, markdown layout, geometry). No Vite plugins:
// the router codegen, React Compiler and Tailwind aren't needed here.
export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts']
  }
})
