<?php
/**
 * Load the WordPress test library and this plugin inside it.
 *
 * `wp-env` provides the library at `/wordpress-phpunit` and exports
 * `WP_TESTS_DIR`; a hand-rolled environment can point `WP_TESTS_DIR` or
 * `WP_PHPUNIT__DIR` wherever it keeps the suite.
 *
 * @package MindMaps
 */

declare(strict_types=1);

namespace MindMaps\Tests;

/**
 * Locate the WordPress PHPUnit test library.
 */
function tests_dir(): string {
	foreach ( array( 'WP_TESTS_DIR', 'WP_PHPUNIT__DIR', 'WP_DEVELOP_DIR' ) as $variable ) {
		$value = (string) \getenv( $variable );
		if ( '' === $value ) {
			continue;
		}
		$value = \rtrim( $value, '/' );
		if ( 'WP_DEVELOP_DIR' === $variable ) {
			$value .= '/tests/phpunit';
		}
		if ( \is_readable( $value . '/includes/functions.php' ) ) {
			return $value;
		}
	}
	return '/wordpress-phpunit';
}

/**
 * Load the plugin. Hooked to `muplugins_loaded` inside the test bootstrap so
 * it is active before any test runs.
 */
function load_plugin(): void {
	require_once plugin_file();
}

$mind_maps_tests_dir = tests_dir();

if ( ! \is_readable( $mind_maps_tests_dir . '/includes/functions.php' ) ) {
	\fwrite(
		\STDERR,
		"\n  The WordPress test library is not where this bootstrap looked ("
		. $mind_maps_tests_dir . ").\n"
		. "  Run the integration suite through wp-env:\n\n"
		. "      pnpm --filter @mindmaps/wordpress run env:start\n"
		. "      pnpm --filter @mindmaps/wordpress run test:integration\n\n"
		. "  or export WP_TESTS_DIR to point at your own checkout.\n\n"
	);
	exit( 1 );
}

require_once $mind_maps_tests_dir . '/includes/functions.php';

\tests_add_filter( 'muplugins_loaded', __NAMESPACE__ . '\\load_plugin' );

require $mind_maps_tests_dir . '/includes/bootstrap.php';
