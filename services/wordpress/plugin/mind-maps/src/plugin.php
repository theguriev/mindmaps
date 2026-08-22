<?php
/**
 * Hook wiring — the plugin's only side-effecting entry point.
 *
 * Everything else in `src/` is plain functions; keeping `add_action()` and
 * `add_filter()` in one place is what makes the rest of the plugin testable
 * without a WordPress bootstrap.
 *
 * @package MindMaps
 */

declare(strict_types=1);

namespace MindMaps\Plugin;

/**
 * Register every hook the plugin uses.
 */
function bootstrap(): void {
	\add_action( 'init', 'MindMaps\\PostType\\register' );
	\add_action( 'init', 'MindMaps\\Render\\register_shortcode' );
	\add_action( 'init', 'MindMaps\\Render\\register_block' );
	\add_action( 'init', __NAMESPACE__ . '\\load_textdomain' );

	\add_action( 'rest_api_init', 'MindMaps\\Rest\\register_routes' );

	\add_action( 'wp_enqueue_scripts', 'MindMaps\\Assets\\register_assets' );
	\add_action( 'wp_enqueue_scripts', 'MindMaps\\Assets\\maybe_enqueue_front', 20 );

	\add_action( 'admin_menu', 'MindMaps\\Admin\\register_menu' );
	\add_action( 'admin_enqueue_scripts', 'MindMaps\\Admin\\enqueue_admin' );
}

/**
 * Load translations.
 */
function load_textdomain(): void {
	if ( ! \defined( 'MIND_MAPS_FILE' ) ) {
		return;
	}
	\load_plugin_textdomain(
		'mind-maps',
		false,
		\dirname( \plugin_basename( \MIND_MAPS_FILE ) ) . '/languages'
	);
}
