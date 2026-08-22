#!/usr/bin/env node
/**
 * Assemble the distributable plugin: copy the built front-end bundle from
 * `apps/wordpress/dist` into `plugin/mind-maps/assets/`.
 *
 * The plugin is a PHP artefact; this is the only step that needs Node. It
 * fails loudly rather than shipping a plugin with no bundle, because a missing
 * `assets/index.js` only shows up as a blank container at runtime.
 */
import { cp, mkdir, readdir, rm, stat, writeFile, readFile } from 'node:fs/promises'
import { dirname, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const service = resolve(here, '..')
const repoRoot = resolve(service, '..', '..')

const source = resolve(repoRoot, 'apps', 'wordpress', 'dist')
const target = resolve(service, 'plugin', 'mind-maps', 'assets')

/** Vite writes its manifest here; the plugin looks for `assets/manifest.json`. */
const viteManifest = ['.vite/manifest.json', 'manifest.json']

async function exists (path) {
  try {
    await stat(path)
    return true
  } catch {
    return false
  }
}

async function fail (message) {
  process.stderr.write(`\n  @mindmaps/wordpress: ${message}\n\n`)
  process.exit(1)
}

async function main () {
  if (!(await exists(source))) {
    await fail(
      [
        `no built bundle at ${relative(repoRoot, source)}`,
        '',
        '  The plugin embeds the front-end built by @mindmaps/wordpress-app.',
        '  Build it first:',
        '',
        '      pnpm --filter @mindmaps/wordpress-app run build',
        '',
        '  or build the whole workspace with `pnpm build` from the repo root,',
        '  which orders the two through turbo.'
      ].join('\n')
    )
  }

  const entries = await readdir(source)
  if (entries.length === 0) {
    await fail(`${relative(repoRoot, source)} is empty — nothing to package`)
  }

  await rm(target, { recursive: true, force: true })
  await mkdir(target, { recursive: true })
  await cp(source, target, { recursive: true })

  // Normalize the manifest location so `src/assets.php` finds one place.
  if (!(await exists(join(target, 'manifest.json')))) {
    for (const candidate of viteManifest) {
      const path = join(target, candidate)
      if (await exists(path)) {
        await writeFile(join(target, 'manifest.json'), await readFile(path))
        break
      }
    }
  }

  const copied = await readdir(target)
  process.stdout.write(
    `  @mindmaps/wordpress: copied ${copied.length} entr${copied.length === 1 ? 'y' : 'ies'} ` +
      `into ${relative(repoRoot, target)}\n`
  )
}

await main()
