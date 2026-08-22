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

defined( 'ABSPATH' ) || exit;

/**
 * Register every hook the plugin uses.
 */
function bootstrap(): void {
	\add_action( 'init', 'MindMaps\\PostType\\register' );
	\add_action( 'init', 'MindMaps\\Render\\register_shortcode' );
	\add_action( 'init', 'MindMaps\\Render\\register_block' );

	\add_action( 'rest_api_init', 'MindMaps\\Rest\\register_routes' );

	\add_action( 'wp_enqueue_scripts', 'MindMaps\\Assets\\register_assets' );
	\add_action( 'wp_enqueue_scripts', 'MindMaps\\Assets\\maybe_enqueue_front', 20 );

	\add_action( 'admin_menu', 'MindMaps\\Admin\\register_menu' );
	\add_action( 'admin_enqueue_scripts', 'MindMaps\\Admin\\enqueue_admin' );

	// Priority 80: core builds the "+ New" node at 70, so the parent exists by
	// the time this runs. Fires on the front end too, where the admin bar is
	// the only way into the editor.
	\add_action( 'admin_bar_menu', 'MindMaps\\Admin\\register_admin_bar', 80 );
}

/*
 * Translations are not loaded here.
 *
 * `load_plugin_textdomain()` has been unnecessary for a plugin hosted on
 * wordpress.org since WordPress 4.6: core loads the translations for the
 * plugin's own slug on its own, at the right moment, and calling it by hand
 * only risks loading them too early. The plugin ships no translations of its
 * own, which is also why the header carries no `Domain Path`.
 */
