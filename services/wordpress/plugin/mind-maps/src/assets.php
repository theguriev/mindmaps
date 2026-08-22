<?php
/**
 * Enqueueing the built front-end bundle and printing its boot payload.
 *
 * The bundle is produced by `apps/wordpress` and copied into `assets/` by
 * `services/wordpress/scripts/collect-assets.mjs`. A build manifest is used
 * when present (hashed filenames survive caching); otherwise the plain
 * `index.js` / `index.css` pair is assumed.
 *
 * Nothing is enqueued on pages that do not actually render a map.
 *
 * @package MindMaps
 */

declare(strict_types=1);

namespace MindMaps\Assets;

use MindMaps\Rest;

/** Script handle for the bundle. */
const SCRIPT_HANDLE = 'mind-maps-app';

/** Style handle prefix for the bundle's stylesheets. */
const STYLE_HANDLE = 'mind-maps-app';

/* -------------------------------------------------------------------------
 * Pure helpers.
 * ---------------------------------------------------------------------- */

/**
 * Pick the entry files out of a build manifest.
 *
 * Understands two shapes: the hand-rolled `{ "js": …, "css": … }` and Vite's
 * chunk manifest. Falls back to unhashed defaults for anything else, so a
 * missing or unrecognised manifest still yields a usable plugin.
 *
 * @param mixed $manifest Decoded manifest, or null.
 * @return array{js: string, css: string[]}
 */
function select_assets( mixed $manifest ): array {
	$fallback = array(
		'js'  => 'index.js',
		'css' => array( 'index.css' ),
	);

	if ( ! \is_array( $manifest ) ) {
		return $fallback;
	}

	if ( \is_string( $manifest['js'] ?? null ) && '' !== $manifest['js'] ) {
		return array(
			'js'  => $manifest['js'],
			'css' => string_list( $manifest['css'] ?? array() ),
		);
	}

	foreach ( $manifest as $chunk ) {
		if ( ! \is_array( $chunk ) || true !== ( $chunk['isEntry'] ?? null ) ) {
			continue;
		}
		if ( ! \is_string( $chunk['file'] ?? null ) || '' === $chunk['file'] ) {
			continue;
		}
		return array(
			'js'  => $chunk['file'],
			'css' => string_list( $chunk['css'] ?? array() ),
		);
	}

	return $fallback;
}

/**
 * Coerce a manifest's css member (string, list, or nonsense) into a list.
 *
 * @param mixed $value Candidate.
 * @return string[]
 */
function string_list( mixed $value ): array {
	if ( \is_string( $value ) ) {
		return '' === $value ? array() : array( $value );
	}
	if ( ! \is_array( $value ) ) {
		return array();
	}
	return \array_values( \array_filter( $value, '\\is_string' ) );
}

/**
 * Build the `window.mindMapsBoot` payload.
 *
 * `mapId` is omitted rather than nulled when there is no map: the app reads
 * its absence as "show the list".
 *
 * @param string      $root     REST root for the namespace, no trailing slash.
 * @param string      $nonce    `wp_rest` nonce.
 * @param string|null $map_id   Map id, or null.
 * @param bool        $can_edit Whether the viewer may write.
 * @param string      $locale   WordPress locale, e.g. `en_US`.
 * @return array<string, mixed>
 */
function boot_payload( string $root, string $nonce, ?string $map_id, bool $can_edit, string $locale ): array {
	$payload = array(
		'root'  => $root,
		'nonce' => $nonce,
	);
	if ( null !== $map_id && '' !== $map_id ) {
		$payload['mapId'] = $map_id;
	}
	$payload['canEdit'] = $can_edit;
	$payload['locale']  = $locale;

	return $payload;
}

/**
 * The inline script that publishes the boot payload.
 *
 * @param string $json JSON encoding of the payload.
 */
function boot_script( string $json ): string {
	return 'window.mindMapsBoot = ' . $json . ';';
}

/**
 * Run-once bookkeeping for things that must be printed a single time per
 * request (the boot payload). Returns true the first time a key is claimed.
 *
 * @param string $key Arbitrary key.
 */
function claim_once( string $key ): bool {
	static $claimed = array();
	if ( isset( $claimed[ $key ] ) ) {
		return false;
	}
	$claimed[ $key ] = true;
	return true;
}

/* -------------------------------------------------------------------------
 * WordPress shell.
 * ---------------------------------------------------------------------- */

/**
 * Absolute path of the plugin's `assets/` directory.
 */
function assets_dir(): string {
	return \defined( 'MIND_MAPS_DIR' ) ? \MIND_MAPS_DIR . 'assets/' : '';
}

/**
 * Public URL of the plugin's `assets/` directory.
 */
function assets_url(): string {
	return \defined( 'MIND_MAPS_URL' ) ? \MIND_MAPS_URL . 'assets/' : '';
}

/**
 * Plugin version, used to bust caches for unhashed asset names.
 */
function version(): string {
	return \defined( 'MIND_MAPS_VERSION' ) ? (string) \MIND_MAPS_VERSION : '0';
}

/**
 * Read and decode `assets/manifest.json`, or null when there is none.
 *
 * @return mixed
 */
function read_manifest(): mixed {
	$path = assets_dir() . 'manifest.json';
	if ( '' === assets_dir() || ! \is_readable( $path ) ) {
		return null;
	}
	$raw = \file_get_contents( $path ); // phpcs:ignore WordPress.WP.AlternativeFunctions.file_get_contents_file_get_contents -- local plugin asset, not a remote request.
	if ( ! \is_string( $raw ) ) {
		return null;
	}
	return \json_decode( $raw, true );
}

/**
 * Register (but do not enqueue) the bundle. Hooked to `wp_enqueue_scripts`
 * and `admin_enqueue_scripts` so both sides share one definition.
 */
function register_assets(): void {
	if ( \wp_script_is( SCRIPT_HANDLE, 'registered' ) ) {
		return;
	}

	$picked = select_assets( read_manifest() );
	$base   = assets_url();

	\wp_register_script(
		SCRIPT_HANDLE,
		$base . $picked['js'],
		array(),
		version(),
		array(
			'in_footer' => true,
			'strategy'  => 'defer',
		)
	);

	foreach ( $picked['css'] as $index => $file ) {
		\wp_register_style(
			style_handle( $index ),
			$base . $file,
			array(),
			version()
		);
	}
}

/**
 * Handle for the nth stylesheet of the bundle.
 *
 * @param int $index Zero-based index.
 */
function style_handle( int $index ): string {
	return 0 === $index ? STYLE_HANDLE : STYLE_HANDLE . '-' . $index;
}

/**
 * Enqueue the bundle and print the boot payload.
 *
 * Safe to call more than once per request: the styles and script deduplicate
 * themselves and the payload is printed only for the first mount.
 *
 * @param string|null $map_id   Map the page is showing, or null for the list.
 * @param bool|null   $can_edit Override for the viewer's write access.
 */
function enqueue( ?string $map_id = null, ?bool $can_edit = null ): void {
	register_assets();

	\wp_enqueue_script( SCRIPT_HANDLE );
	$index = 0;
	while ( \wp_style_is( style_handle( $index ), 'registered' ) ) {
		\wp_enqueue_style( style_handle( $index ) );
		++$index;
	}

	if ( ! claim_once( 'boot' ) ) {
		return;
	}

	$writable = null === $can_edit ? default_can_edit( $map_id ) : $can_edit;
	$payload  = boot_payload(
		\untrailingslashit( \rest_url( Rest\REST_NAMESPACE ) ),
		\wp_create_nonce( 'wp_rest' ),
		$map_id,
		$writable,
		\determine_locale()
	);

	$json = \wp_json_encode( $payload );
	\wp_add_inline_script( SCRIPT_HANDLE, boot_script( \is_string( $json ) ? $json : '{}' ), 'before' );
}

/**
 * Whether the current user may write the map the page is showing.
 *
 * @param string|null $map_id Map id, or null.
 */
function default_can_edit( ?string $map_id ): bool {
	if ( null === $map_id || '' === $map_id ) {
		return \current_user_can( 'edit_posts' );
	}
	return \current_user_can( 'edit_post', \absint( $map_id ) );
}

/**
 * Front-end pass: enqueue only when the queried post really renders a map.
 *
 * Shortcodes and blocks also enqueue at render time, which covers maps that
 * arrive through a widget or a template call; this pass exists so the common
 * case gets its assets in the head-and-footer order WordPress prefers.
 */
function maybe_enqueue_front(): void {
	if ( \is_admin() || ! \is_singular() ) {
		return;
	}

	$post = \get_post();
	if ( ! $post instanceof \WP_Post ) {
		return;
	}

	$renders_map = \has_shortcode( (string) $post->post_content, 'mind_map' )
		|| \has_block( 'mind-maps/map', $post );

	if ( $renders_map ) {
		enqueue( first_shortcode_map_id( (string) $post->post_content ) );
	}
}

/**
 * The id of the first `[mind_map]` on a page, for the global boot payload.
 * Individual mounts still carry their own `data-map-id`.
 *
 * @param string $content Post content.
 */
function first_shortcode_map_id( string $content ): ?string {
	if ( ! \preg_match( '/\[mind_map\b[^\]]*\bid=["\']?(\d+)/', $content, $matches ) ) {
		return null;
	}
	$id = \absint( $matches[1] );
	return $id > 0 ? (string) $id : null;
}
