import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { tanstackRouter } from '@tanstack/router-plugin/vite'
import { fileURLToPath, URL } from 'node:url'

export default defineConfig({
  plugins: [
    // Must run before the React plugin. Generates src/routeTree.gen.ts from the
    // route files in src/routes/ and auto-code-splits each route's component.
    tanstackRouter({ target: 'react', autoCodeSplitting: true }),
    react()
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url))
    }
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true
  }
})
