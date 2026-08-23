import { defineConfig } from 'vite'

/**
 * The block's editor script, built on its own.
 *
 * A second build rather than a second entry in the main one: that build emits
 * a single IIFE, which by definition has one entry, and these two must not be
 * merged anyway. `src/main.tsx` carries React and the whole engine; this one
 * carries neither — it runs inside WordPress' editor, uses WordPress' React
 * through `window.wp`, and imports only the pure projection functions. Keeping
 * the builds apart is what keeps that promise checkable: `block.js` is a few
 * kilobytes, and if React ever leaked into it, it would not be.
 */
export default defineConfig({
  build: {
    outDir: 'dist',
    // The main build already wrote index.js/index.css here and runs first.
    emptyOutDir: false,
    rollupOptions: {
      input: 'src/block.ts',
      output: {
        format: 'iife',
        entryFileNames: 'block.js'
      }
    }
  }
})
