#!/usr/bin/env node
/**
 * Lint every PHP file in the service.
 *
 * Uses PHPCS with the WordPress standard when it has been installed
 * (`composer install` pulls it in as a dev dependency); otherwise falls back to
 * `php -l`, which at least guarantees the plugin parses.
 */
import { spawnSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { readdir } from 'node:fs/promises'
import { dirname, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const service = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const roots = ['plugin', 'tests'].map((dir) => resolve(service, dir))

async function phpFiles (dir) {
  const found = []
  let entries
  try {
    entries = await readdir(dir, { withFileTypes: true })
  } catch {
    return found
  }
  for (const entry of entries) {
    if (entry.name === 'vendor' || entry.name === 'node_modules') continue
    const path = join(dir, entry.name)
    if (entry.isDirectory()) found.push(...(await phpFiles(path)))
    else if (entry.name.endsWith('.php')) found.push(path)
  }
  return found
}

const files = (await Promise.all(roots.map(phpFiles))).flat().sort()
if (files.length === 0) {
  process.stderr.write('  @mindmaps/wordpress: no PHP files found\n')
  process.exit(1)
}

const phpcs = resolve(service, 'vendor', 'bin', 'phpcs')
if (existsSync(phpcs)) {
  const result = spawnSync(phpcs, ['-q', ...files], { cwd: service, stdio: 'inherit' })
  process.exit(result.status ?? 1)
}

process.stdout.write(`  phpcs not installed — falling back to \`php -l\` on ${files.length} files\n`)

let failed = 0
for (const file of files) {
  const result = spawnSync('php', ['-l', '-d', 'display_errors=1', file], { encoding: 'utf8' })
  if (result.error) {
    process.stderr.write(
      '\n  @mindmaps/wordpress: no `php` on PATH — install PHP >= 8.1, or lint in a container:\n\n' +
        '      docker run --rm -v "$PWD":/app -w /app php:8.2-cli \\\n' +
        '        sh -c \'find plugin tests -name "*.php" -exec php -l {} \\;\'\n\n'
    )
    process.exit(1)
  }
  if (result.status !== 0) {
    failed += 1
    process.stderr.write(`${relative(service, file)}: ${(result.stdout || result.stderr).trim()}\n`)
  }
}

if (failed > 0) {
  process.stderr.write(`\n  ${failed} file(s) failed to parse\n`)
  process.exit(1)
}

process.stdout.write(`  ${files.length} PHP files parse cleanly\n`)
