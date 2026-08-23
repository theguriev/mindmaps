import { defineConfig, type Plugin } from 'vite'
import { scopeCss } from './src/scopeCss'
import react, { reactCompilerPreset } from '@vitejs/plugin-react'
import babel from '@rolldown/plugin-babel'
import tailwindcss from '@tailwindcss/vite'

/**
 * This app is not an SPA: WordPress enqueues its output with
 * `wp_enqueue_script`/`wp_enqueue_style`, so the build has to produce two files
 * at names the PHP can hard-code — `dist/index.js` and `dist/index.css` — plus a
 * `dist/manifest.json` the plugin reads for cache-busting metadata.
 */
/**
 * Confines every selector in the emitted stylesheet to the embed.
 *
 * Runs after Tailwind, on the finished CSS, because that is the only point at
 * which every utility exists. See `src/scopeCss.ts` for why it is needed and
 * why `:where()` makes it safe; `src/styles.test.ts` is what would notice if
 * it stopped running.
 */
function confineStylesToTheEmbed (): Plugin {
  return {
    name: 'mind-maps:confine-styles',
    enforce: 'post',
    generateBundle (_options, bundle) {
      for (const file of Object.values(bundle)) {
        if (file.type === 'asset' && file.fileName.endsWith('.css')) {
          file.source = scopeCss(String(file.source))
        }
      }
    }
  }
}

export default defineConfig({
  plugins: [
    react(),
    // React Compiler auto-memoizes components/hooks. The oxc-based React plugin
    // doesn't run Babel, so the compiler is applied via @rolldown/plugin-babel.
    babel({ presets: [reactCompilerPreset()] }),
    tailwindcss(),
    confineStylesToTheEmbed()
  ],
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    // Written to dist/manifest.json (not the default .vite/manifest.json) so the
    // plugin can read it without knowing about Vite's internal layout.
    manifest: 'manifest.json',
    // One stylesheet for one <link> tag.
    cssCodeSplit: false,
    // One chunk is the requirement here, not an oversight — React, the engine
    // and the app share a single enqueued file, so the split-it-up advice does
    // not apply and the warning would fire on every build.
    chunkSizeWarningLimit: 1024,
    rollupOptions: {
      input: 'src/main.tsx',
      output: {
        // IIFE, not ESM: `wp_enqueue_script` emits a classic <script src> and
        // adding type="module" to it needs filter gymnastics in every theme.
        format: 'iife',
        // No hashes — the plugin enqueues these exact paths and versions the
        // asset itself. `inlineDynamicImports` (implied by iife) keeps it to a
        // single chunk, so React and the engine ship in this one file.
        entryFileNames: 'index.js',
        assetFileNames: 'index[extname]'
      }
    }
  },
  server: {
    // `pnpm dev` serves index.html (the harness) and forwards REST calls to a
    // local wp-env, so the standalone dev server talks to real WordPress data.
    proxy: {
      '/wp-json': {
        target: 'http://localhost:8888',
        changeOrigin: true
      }
    }
  }
})
