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
		'dashicons-share-alt',
		25
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

	// mount_markup() escapes everything it emits.
	echo Render\mount_markup( // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped -- pre-escaped markup.
		array(
			'id'        => null === $map_id ? 0 : (int) $map_id,
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
