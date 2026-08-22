<?php
/**
 * The `mind_map` custom post type and its meta.
 *
 * The post type is deliberately invisible to WordPress' own UI and REST
 * surface: the plugin owns `mindmaps/v1` and the editor screen, so exposing a
 * second, unvalidated way to write `_mindmap_content` would only widen the
 * attack surface.
 *
 * @package MindMaps
 */

declare(strict_types=1);

namespace MindMaps\PostType;

/** Post type name. */
const POST_TYPE = 'mind_map';

/** Meta key holding the JSON-encoded `content` entries. */
const META_CONTENT = '_mindmap_content';

/** Meta key holding the integer schema version. */
const META_VERSION = '_mindmap_version';

/** Meta key holding the "starred as a template" flag, `"1"` or `"0"`. */
const META_TEMPLATE = '_mindmap_template';

/**
 * Post statuses a map may hold and still be listed or fetched.
 *
 * @return string[]
 */
function readable_statuses(): array {
	return array( 'publish', 'private', 'draft', 'pending' );
}

/**
 * Register the post type. Hooked to `init`.
 */
function register(): void {
	\register_post_type(
		POST_TYPE,
		array(
			'labels'              => array(
				'name'          => \__( 'Mind Maps', 'mind-maps' ),
				'singular_name' => \__( 'Mind Map', 'mind-maps' ),
			),
			'public'              => false,
			'publicly_queryable'  => false,
			'exclude_from_search' => true,
			'show_ui'             => false,
			'show_in_menu'        => false,
			'show_in_nav_menus'   => false,
			'show_in_admin_bar'   => false,
			// The plugin owns its REST surface; core's would bypass validation.
			'show_in_rest'        => false,
			'hierarchical'        => false,
			'has_archive'         => false,
			'rewrite'             => false,
			'query_var'           => false,
			'can_export'          => true,
			'delete_with_user'    => true,
			'capability_type'     => 'post',
			// Required for `current_user_can( 'edit_post', $id )` to resolve.
			'map_meta_cap'        => true,
			'supports'            => array( 'title', 'author', 'revisions' ),
		)
	);

	register_meta_keys();
}

/**
 * Register the three meta keys. Never exposed through core REST — the values
 * are only ever written by the repository, after validation.
 */
function register_meta_keys(): void {
	foreach ( array( META_CONTENT, META_TEMPLATE ) as $key ) {
		\register_post_meta(
			POST_TYPE,
			$key,
			array(
				'type'          => 'string',
				'single'        => true,
				'default'       => '',
				'show_in_rest'  => false,
				'auth_callback' => __NAMESPACE__ . '\\can_edit_meta',
			)
		);
	}

	\register_post_meta(
		POST_TYPE,
		META_VERSION,
		array(
			'type'          => 'integer',
			'single'        => true,
			'default'       => 0,
			'show_in_rest'  => false,
			'auth_callback' => __NAMESPACE__ . '\\can_edit_meta',
		)
	);
}

/**
 * Meta auth callback: only someone who may edit the post may touch its meta.
 *
 * Parameters are `mixed` on purpose — this runs as a filter under
 * `strict_types`, and core has been known to hand it a numeric string id.
 *
 * @param mixed $allowed   Unused core default.
 * @param mixed $meta_key  Unused meta key.
 * @param mixed $object_id Post id.
 */
function can_edit_meta( mixed $allowed = false, mixed $meta_key = '', mixed $object_id = 0 ): bool {
	unset( $allowed, $meta_key );
	return \current_user_can( 'edit_post', (int) $object_id );
}
