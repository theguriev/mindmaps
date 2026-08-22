#!/usr/bin/env node
/**
 * Produce `dist/mind-maps.zip` — the artefact you upload to a WordPress site.
 *
 * Runs `collect-assets.mjs` first, so a package without a bundle is impossible.
 */
import { spawnSync } from 'node:child_process'
import { mkdir, rm } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const service = resolve(here, '..')
const dist = resolve(service, 'dist')
const zip = resolve(dist, 'mind-maps.zip')

const collect = spawnSync(process.execPath, [resolve(here, 'collect-assets.mjs')], {
  cwd: service,
  stdio: 'inherit'
})
if (collect.status !== 0) process.exit(collect.status ?? 1)

await rm(dist, { recursive: true, force: true })
await mkdir(dist, { recursive: true })

const result = spawnSync(
  'zip',
  ['-r', '-q', '-X', zip, 'mind-maps', '-x', '*.DS_Store', '-x', '*/.*'],
  { cwd: resolve(service, 'plugin'), stdio: 'inherit' }
)

if (result.error) {
  process.stderr.write(
    '\n  @mindmaps/wordpress: `zip` is not on PATH. Install it (macOS ships it,\n' +
      '  Debian: `apt-get install zip`) or archive `plugin/mind-maps` by hand.\n\n'
  )
  process.exit(1)
}
if (result.status !== 0) process.exit(result.status ?? 1)

process.stdout.write('  @mindmaps/wordpress: wrote dist/mind-maps.zip\n')
