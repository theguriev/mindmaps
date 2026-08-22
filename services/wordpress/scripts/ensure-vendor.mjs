#!/usr/bin/env node
/**
 * Make sure `vendor/autoload.php` exists before PHPUnit is invoked.
 *
 * Composer is not a workspace dependency, so `pnpm install` cannot bring it in;
 * this bridges the gap and, when Composer is genuinely missing, says so in one
 * line instead of leaving a "no such file: ./vendor/bin/phpunit".
 */
import { spawnSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const service = resolve(dirname(fileURLToPath(import.meta.url)), '..')

if (existsSync(resolve(service, 'vendor', 'autoload.php'))) {
  process.exit(0)
}

const composer = spawnSync('composer', ['install', '--no-interaction', '--prefer-dist'], {
  cwd: service,
  stdio: 'inherit'
})

if (composer.error || composer.status !== 0) {
  process.stderr.write(
    [
      '',
      '  @mindmaps/wordpress: could not run `composer install`.',
      '',
      '  The PHP test suites need Composer and PHP >= 8.1 on PATH:',
      '',
      '      brew install php composer      # macOS',
      '',
      '  Or run the suite inside a container:',
      '',
      '      docker run --rm -v "$PWD":/app -w /app composer:2 install',
      '      docker run --rm -v "$PWD":/app -w /app php:8.2-cli ./vendor/bin/phpunit --testsuite unit',
      ''
    ].join('\n')
  )
  process.exit(1)
}
