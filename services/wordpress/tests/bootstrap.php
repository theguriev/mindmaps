<?php
/**
 * PHPUnit bootstrap for both suites.
 *
 * PHPUnit has one bootstrap per configuration file, but the two suites have
 * very different needs: `unit` must run with no WordPress anywhere near it,
 * `integration` needs the full WordPress test library. So the bootstrap looks
 * at how it was invoked and loads WordPress only for the integration run.
 *
 * @package MindMaps
 */

declare(strict_types=1);

namespace MindMaps\Tests;

/**
 * Whether this run wants the WordPress-backed suite.
 *
 * @param string[] $argv Command line arguments.
 * @param string   $env  Value of `MINDMAPS_TESTS`.
 */
function wants_integration( array $argv, string $env ): bool {
	if ( 'integration' === $env ) {
		return true;
	}
	foreach ( $argv as $index => $argument ) {
		if ( '--testsuite=integration' === $argument ) {
			return true;
		}
		if ( '--testsuite' === $argument && 'integration' === ( $argv[ $index + 1 ] ?? '' ) ) {
			return true;
		}
	}
	return false;
}

/**
 * Absolute path of the service root.
 */
function service_dir(): string {
	return \dirname( __DIR__ );
}

/**
 * The plugin's entry file.
 */
function plugin_file(): string {
	return service_dir() . '/plugin/mind-maps/mind-maps.php';
}

$mind_maps_autoload = service_dir() . '/vendor/autoload.php';
if ( ! \is_readable( $mind_maps_autoload ) ) {
	\fwrite( \STDERR, "\n  Run `composer install` in services/wordpress first.\n\n" );
	exit( 1 );
}
require_once $mind_maps_autoload;

if ( wants_integration( $GLOBALS['argv'] ?? array(), (string) \getenv( 'MINDMAPS_TESTS' ) ) ) {
	require_once __DIR__ . '/bootstrap-integration.php';
}
