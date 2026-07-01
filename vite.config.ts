import { defineConfig } from 'vite'
import react, { reactCompilerPreset } from '@vitejs/plugin-react'
import babel from '@rolldown/plugin-babel'
import { tanstackRouter } from '@tanstack/router-plugin/vite'
import { fileURLToPath, URL } from 'node:url'

export default defineConfig({
  plugins: [
    // Must run before the React plugin. Generates src/routeTree.gen.ts from the
    // route files in src/routes/ and auto-code-splits each route's component.
    tanstackRouter({ target: 'react', autoCodeSplitting: true }),
    react(),
    // React Compiler auto-memoizes components/hooks. The oxc-based React plugin
    // doesn't run Babel, so the compiler is applied via @rolldown/plugin-babel.
    // React 19 ships the compiler runtime, so no extra runtime dep is needed.
    babel({ presets: [reactCompilerPreset()] })
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
