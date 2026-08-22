<?php
/**
 * Front-end mount points: the `[mind_map]` shortcode and the `mind-maps/map`
 * block.
 *
 * Both paths funnel into `mount_markup()`, so a change to the container's
 * attributes reaches the shortcode, the block and the admin screen at once.
 *
 * @package MindMaps
 */

declare(strict_types=1);

namespace MindMaps\Render;

use MindMaps\Assets;
use MindMaps\Repository;

/** Block name. */
const BLOCK_NAME = 'mind-maps/map';

/** Shortcode tag. */
const SHORTCODE_TAG = 'mind_map';

/** Height used when none is given. */
const DEFAULT_HEIGHT = 600;

/* -------------------------------------------------------------------------
 * Pure helpers.
 * ---------------------------------------------------------------------- */

/**
 * Normalize whatever a shortcode or block hands us into mount arguments.
 *
 * @param mixed $raw_id     Candidate map id.
 * @param mixed $raw_height Candidate height in CSS pixels.
 * @return array{id: int, height: int}
 */
function normalize_args( mixed $raw_id, mixed $raw_height ): array {
	$id     = \is_scalar( $raw_id ) ? (int) $raw_id : 0;
	$height = \is_scalar( $raw_height ) ? (int) $raw_height : 0;

	return array(
		'id'     => \max( 0, $id ),
		'height' => $height > 0 ? \min( $height, 5000 ) : DEFAULT_HEIGHT,
	);
}

/* -------------------------------------------------------------------------
 * Rendering.
 * ---------------------------------------------------------------------- */

/**
 * The mount container every entry point emits.
 *
 * The app looks for `data-mind-maps-root`. Several containers may share a page,
 * so each one states its own case in full rather than inheriting the page-wide
 * boot payload:
 *
 * - `data-map-id` is **always** present. The empty string means "no map — show
 *   the list"; falling back to `boot.mapId` for a mount that omitted the
 *   attribute made `[mind_map]` followed by `[mind_map id="42"]` render map 42
 *   twice.
 * - `data-can-edit` is `"1"` or `"0"`, resolved per mount, so a read-only embed
 *   of someone else's map next to an editable one gets the right answer.
 *
 * @param array<string, mixed> $args `id` and `height`, plus optional `class`.
 */
function mount_markup( array $args ): string {
	$normalized = normalize_args( $args['id'] ?? 0, $args['height'] ?? 0 );
	$id         = $normalized['id'];
	$map_id     = $id > 0 ? (string) $id : null;

	Assets\enqueue( $map_id );

	$classes = 'mind-maps-root';
	if ( \is_string( $args['class'] ?? null ) && '' !== $args['class'] ) {
		$classes .= ' ' . $args['class'];
	}

	$attributes = \sprintf(
		'class="%s" data-mind-maps-root="1" style="min-height:%dpx" data-map-id="%s" data-can-edit="%s"',
		\esc_attr( $classes ),
		\absint( $normalized['height'] ),
		\esc_attr( $map_id ?? '' ),
		Assets\default_can_edit( $map_id ) ? '1' : '0'
	);

	return \sprintf(
		'<div %s><noscript>%s</noscript></div>',
		$attributes,
		\esc_html__( 'This mind map needs JavaScript to render.', 'mind-maps' )
	);
}

/**
 * `[mind_map id="42" height="600"]`.
 *
 * @param array<string, mixed> $atts Shortcode attributes.
 */
function shortcode( array $atts ): string {
	$merged = \shortcode_atts(
		array(
			'id'     => '',
			'height' => (string) DEFAULT_HEIGHT,
		),
		$atts,
		SHORTCODE_TAG
	);

	return mount_markup(
		array(
			'id'     => $merged['id'],
			'height' => $merged['height'],
		)
	);
}

/**
 * Shortcode callback. WordPress passes `''` instead of an empty array when a
 * shortcode carries no attributes, which `shortcode()`'s signature refuses.
 *
 * @param mixed $atts Raw shortcode attributes.
 */
function shortcode_callback( mixed $atts = array() ): string {
	return shortcode( \is_array( $atts ) ? $atts : array() );
}

/**
 * Block `render_callback`.
 *
 * @param mixed $attributes Block attributes.
 */
function block_callback( mixed $attributes = array() ): string {
	$attributes = \is_array( $attributes ) ? $attributes : array();

	return mount_markup(
		array(
			'id'     => $attributes['id'] ?? 0,
			'height' => $attributes['height'] ?? 0,
			'class'  => 'wp-block-mind-maps-map',
		)
	);
}

/* -------------------------------------------------------------------------
 * Registration.
 * ---------------------------------------------------------------------- */

/**
 * Register the shortcode. Hooked to `init`.
 */
function register_shortcode(): void {
	\add_shortcode( SHORTCODE_TAG, __NAMESPACE__ . '\\shortcode_callback' );
}

/**
 * Register the block. Hooked to `init`.
 *
 * The editor-side script is optional: without `apps/wordpress`'s block build
 * the block still renders through `render_callback`, it just cannot be
 * inserted from the block inserter.
 */
function register_block(): void {
	if ( ! \function_exists( 'register_block_type' ) ) {
		return;
	}

	$editor_script = \defined( 'MIND_MAPS_DIR' ) && \is_readable( \MIND_MAPS_DIR . 'assets/block.js' );
	if ( $editor_script ) {
		\wp_register_script(
			'mind-maps-block',
			\MIND_MAPS_URL . 'assets/block.js',
			array( 'wp-blocks', 'wp-element', 'wp-block-editor', 'wp-components' ),
			\defined( 'MIND_MAPS_VERSION' ) ? (string) \MIND_MAPS_VERSION : '0',
			true
		);
	}

	$args = array(
		'api_version'     => 3,
		'title'           => \__( 'Mind Map', 'mind-maps' ),
		'category'        => 'widgets',
		'attributes'      => array(
			'id'     => array(
				'type'    => 'integer',
				'default' => 0,
			),
			'height' => array(
				'type'    => 'integer',
				'default' => DEFAULT_HEIGHT,
			),
		),
		'render_callback' => __NAMESPACE__ . '\\block_callback',
	);
	if ( $editor_script ) {
		$args['editor_script'] = 'mind-maps-block';
	}

	\register_block_type( BLOCK_NAME, $args );
}

/**
 * Every map the current user may pick from, as `id => title` pairs. Used by
 * the admin screen and available to the block's REST-free editor UI.
 *
 * @return array<string, string>
 */
function selectable_maps(): array {
	$options = array();
	$author  = \current_user_can( 'edit_others_posts' ) ? null : \get_current_user_id();
	foreach ( Repository\list_maps( 100, $author ) as $doc ) {
		$id             = (string) ( $doc['id'] ?? '' );
		$options[ $id ] = (string) ( $doc['title'] ?? '' );
	}
	return $options;
}
