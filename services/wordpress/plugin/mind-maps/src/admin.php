<?php
/**
 * The "Mind Maps" admin screen.
 *
 * It mounts the very same bundle the front end uses; the only difference is
 * that the boot payload picks its map up from `?map=<id>` rather than from the
 * page's content. Write access is still decided per map: reaching the screen
 * needs `edit_posts`, editing the map someone asked for needs `edit_post` on
 * that map.
 *
 * @package MindMaps
 */

declare(strict_types=1);

namespace MindMaps\Admin;

use MindMaps\Assets;
use MindMaps\Render;

/** Admin menu slug. */
const MENU_SLUG = 'mind-maps';

/** Capability required to reach the screen. */
const MENU_CAPABILITY = 'edit_posts';

/** Query parameter naming the open map, as `post.php` uses `post`. */
const MAP_QUERY_ARG = 'map';

/** Query parameter asking the screen to open its template picker. */
const NEW_QUERY_ARG = 'new';

/**
 * The `$hook_suffix` WordPress gives a top-level page with our slug.
 */
function screen_hook(): string {
	return 'toplevel_page_' . MENU_SLUG;
}

/**
 * Whether a given admin hook suffix is our screen.
 *
 * @param mixed $hook_suffix Hook suffix from `admin_enqueue_scripts`.
 */
function is_map_screen( mixed $hook_suffix ): bool {
	return \is_string( $hook_suffix ) && screen_hook() === $hook_suffix;
}

/**
 * The map id the screen was opened with, or null for the list view.
 *
 * @param array<string, mixed> $query Typically `$_GET`.
 */
function requested_map_id( array $query ): ?string {
	$raw = $query[ MAP_QUERY_ARG ] ?? null;
	if ( ! \is_scalar( $raw ) ) {
		return null;
	}
	$id = \absint( $raw );
	return $id > 0 ? (string) $id : null;
}

/**
 * Register the menu. Hooked to `admin_menu`.
 */
function register_menu(): void {
	\add_menu_page(
		\__( 'Mind Maps', 'mind-maps' ),
		\__( 'Mind Maps', 'mind-maps' ),
		MENU_CAPABILITY,
		MENU_SLUG,
		__NAMESPACE__ . '\\render_page',
		menu_icon(),
		25
	);
}

/**
 * The menu mark: the product's own logo rather than a dashicon.
 *
 * Passed as an SVG data URI, which is the only form WordPress sizes for the
 * menu — it renders that as a 20px background. An image *URL* is emitted as a
 * bare `<img>` with no width, so the 256px logo would fill the screen; and a
 * dashicon class would mean giving the mark up. The SVG is a thin wrapper
 * around a 40px raster (2× for retina, ~3KB) so the gradient survives, which
 * recolouring would have destroyed.
 *
 * Falls back to a dashicon when the file or the constants are missing, so a
 * hand-assembled install still gets a menu entry it can see.
 */
function menu_icon(): string {
	if ( ! \defined( 'MIND_MAPS_DIR' ) ) {
		return 'dashicons-share-alt';
	}

	$svg = \MIND_MAPS_DIR . 'img/menu-icon.svg';
	if ( ! \is_readable( $svg ) ) {
		return 'dashicons-share-alt';
	}

	$markup = \file_get_contents( $svg ); // phpcs:ignore WordPress.WP.AlternativeFunctions.file_get_contents_file_get_contents -- local plugin asset, not a remote request.
	return \is_string( $markup )
		? 'data:image/svg+xml;base64,' . \base64_encode( $markup )
		: 'dashicons-share-alt';
}

/**
 * The URL of the screen, optionally asking it to start a new map.
 *
 * @param bool $new Open the template picker on arrival.
 */
function screen_url( bool $new = false ): string {
	$args = array( 'page' => MENU_SLUG );
	if ( $new ) {
		$args[ NEW_QUERY_ARG ] = '1';
	}
	return \add_query_arg( $args, \admin_url( 'admin.php' ) );
}

/**
 * Whether a query asks for a new map.
 *
 * @param array<string, mixed> $query Typically `$_GET`.
 */
function wants_new_map( array $query ): bool {
	$raw = $query[ NEW_QUERY_ARG ] ?? null;
	return \is_scalar( $raw ) && \in_array( (string) $raw, array( '1', 'true' ), true );
}

/**
 * Add "Mind Map" to the admin bar's "+ New" menu. Hooked to `admin_bar_menu`.
 *
 * Core builds that menu from post types with `show_in_admin_bar`, and links
 * them to `post-new.php` — the editor this plugin deliberately does not use
 * (the post type is `show_ui: false`). So the node is added by hand, pointing
 * at the screen that does own map creation.
 *
 * The link only opens the picker: creating a map is a REST write, and a plain
 * `GET` a browser may prefetch has no business making one.
 *
 * @param \WP_Admin_Bar $bar The admin bar being built.
 */
function register_admin_bar( \WP_Admin_Bar $bar ): void {
	if ( ! \current_user_can( MENU_CAPABILITY ) ) {
		return;
	}

	// Without the parent the node would be dropped silently — that happens when
	// the user may create nothing else, and core omits the whole "+ New" menu.
	$parent = null === $bar->get_node( 'new-content' ) ? null : 'new-content';
	if ( null === $parent ) {
		return;
	}

	$bar->add_node(
		array(
			'parent' => $parent,
			'id'     => 'new-mind-map',
			'title'  => \__( 'Mind Map', 'mind-maps' ),
			'href'   => screen_url( true ),
		)
	);
}

/**
 * Enqueue the bundle on our screen only. Hooked to `admin_enqueue_scripts`.
 *
 * @param mixed $hook_suffix Current admin page hook suffix.
 */
function enqueue_admin( mixed $hook_suffix = '' ): void {
	if ( ! is_map_screen( $hook_suffix ) || ! \current_user_can( MENU_CAPABILITY ) ) {
		return;
	}

	// No `can_edit` override: `MENU_CAPABILITY` says the user may reach the
	// screen, not that they may write whichever map `?map=` names. Forcing
	// `true` handed anyone with `edit_posts` a fully writable editor over a map
	// every REST write would then refuse. `default_can_edit()` decides.
	// phpcs:ignore WordPress.Security.NonceVerification.Recommended -- read-only screen selector, no state change.
	Assets\enqueue( requested_map_id( \wp_unslash( $_GET ) ) );

	enqueue_screen_style();
}

/**
 * The stylesheet that turns this screen's document layout into a full canvas.
 *
 * Its own file rather than part of the app's bundle: that one is enqueued on
 * front-end pages too, where the admin chrome it neutralizes does not exist.
 */
function enqueue_screen_style(): void {
	if ( ! \defined( 'MIND_MAPS_URL' ) ) {
		return;
	}

	\wp_enqueue_style(
		'mind-maps-admin',
		\MIND_MAPS_URL . 'css/admin.css',
		array(),
		\defined( 'MIND_MAPS_VERSION' ) ? (string) \MIND_MAPS_VERSION : '0'
	);
}

/**
 * Render the screen.
 */
function render_page(): void {
	if ( ! \current_user_can( MENU_CAPABILITY ) ) {
		\wp_die( \esc_html__( 'You are not allowed to manage mind maps.', 'mind-maps' ) );
	}

	// phpcs:ignore WordPress.Security.NonceVerification.Recommended -- read-only screen selector, no state change.
	$map_id = requested_map_id( \wp_unslash( $_GET ) );

	// No `.wrap`: its margins are half the grey this screen is getting rid of,
	// and WordPress moves admin notices inside it (`common.js` anchors on
	// `.wrap h1`), which would drop them between the heading and the canvas.
	// The `.wp-header-end` marker below is the anchor core prefers, so notices
	// land in the strip above the map instead — visible, and out of the way.
	echo '<h1 class="screen-reader-text">' . \esc_html__( 'Mind Maps', 'mind-maps' ) . '</h1>';
	echo '<hr class="wp-header-end">';

	// phpcs:ignore WordPress.Security.NonceVerification.Recommended -- opens a picker, changes nothing.
	$new = wants_new_map( \wp_unslash( $_GET ) );

	// mount_markup() escapes everything it emits.
	echo Render\mount_markup( // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped -- pre-escaped markup.
		array(
			'id'        => null === $map_id ? 0 : (int) $map_id,
			// "+ New → Mind Map" in the admin bar lands here.
			'new'       => $new,
			// The screen's stylesheet sizes the canvas against the viewport; an
			// inline `min-height` would outrank it and bring the grey back on a
			// short window.
			'height'    => null,
			'class'     => 'mind-maps-admin-root',
			// This screen is the page, so the open map belongs in its URL:
			// opening one rewrites `?map=`, and a reload comes back to it.
			'map_param' => MAP_QUERY_ARG,
		)
	);
}
