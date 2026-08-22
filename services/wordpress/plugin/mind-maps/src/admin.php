<?php
/**
 * The "Mind Maps" admin screen.
 *
 * It mounts the very same bundle the front end uses; the only difference is
 * the boot payload, which always reports edit access (the screen itself is
 * capability-gated) and picks the map up from `?map=<id>`.
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
	$raw = $query['map'] ?? null;
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

	// phpcs:ignore WordPress.Security.NonceVerification.Recommended -- read-only screen selector, no state change.
	Assets\enqueue( requested_map_id( \wp_unslash( $_GET ) ), true );
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

	echo '<div class="wrap mind-maps-admin">';
	echo '<h1 class="screen-reader-text">' . \esc_html__( 'Mind Maps', 'mind-maps' ) . '</h1>';

	// mount_markup() escapes everything it emits.
	echo Render\mount_markup( // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped -- pre-escaped markup.
		array(
			'id'     => null === $map_id ? 0 : (int) $map_id,
			'height' => admin_height(),
			'class'  => 'mind-maps-admin-root',
		)
	);

	echo '</div>';
}

/**
 * Height of the admin canvas, filterable for themes that change the chrome.
 */
function admin_height(): int {
	$height = \apply_filters( 'mind_maps_admin_height', 760 );
	return \is_numeric( $height ) ? (int) $height : 760;
}
