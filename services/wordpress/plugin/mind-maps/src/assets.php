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

defined( 'ABSPATH' ) || exit;

use MindMaps\Render;
use MindMaps\Rest;

/** Script handle for the bundle. */
const SCRIPT_HANDLE = 'mind-maps-app';

/** Style handle prefix for the bundle's stylesheets. */
const STYLE_HANDLE = 'mind-maps-app';

// --------------------------------------------------------------------------
// Pure helpers.
// --------------------------------------------------------------------------

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
		$css = string_list( $chunk['css'] ?? array() );
		if ( array() === $css ) {
			// A build with no code splitting emits the stylesheet as its own
			// manifest asset (`"style.css": { "file": "index.css" }`) instead of
			// listing it on the entry chunk, so look for it there before
			// concluding the bundle has no styles.
			$css = stylesheet_assets( $manifest );
		}
		return array(
			'js'  => $chunk['file'],
			'css' => $css,
		);
	}

	return $fallback;
}

/**
 * Every `.css` file a manifest mentions, in manifest order.
 *
 * @param array<mixed> $manifest Decoded manifest.
 * @return string[]
 */
function stylesheet_assets( array $manifest ): array {
	$files = array();
	foreach ( $manifest as $chunk ) {
		if ( ! \is_array( $chunk ) ) {
			continue;
		}
		$file = $chunk['file'] ?? null;
		if ( \is_string( $file ) && \str_ends_with( $file, '.css' ) ) {
			$files[] = $file;
		}
	}
	return \array_values( \array_unique( $files ) );
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
	$payload = array( 'root' => $root );
	// An empty nonce is left out rather than printed as `""`: there is nothing
	// to authenticate for a visitor who cannot write, and the client already
	// treats an absent nonce and an empty one the same way.
	if ( '' !== $nonce ) {
		$payload['nonce'] = $nonce;
	}
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
 * Whether one of the given inline script lines is our boot payload.
 *
 * @param mixed $lines Whatever `WP_Scripts::get_data( …, 'before' )` returned.
 */
function holds_boot_script( mixed $lines ): bool {
	foreach ( \is_array( $lines ) ? $lines : array( $lines ) as $line ) {
		if ( \is_string( $line ) && \str_contains( $line, 'window.mindMapsBoot' ) ) {
			return true;
		}
	}
	return false;
}

// --------------------------------------------------------------------------
// WordPress shell.
// --------------------------------------------------------------------------

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

	if ( boot_printed() ) {
		return;
	}

	$writable = null === $can_edit ? default_can_edit( $map_id ) : $can_edit;
	$payload  = boot_payload(
		\untrailingslashit( \rest_url( Rest\REST_NAMESPACE ) ),
		rest_nonce(),
		$map_id,
		$writable,
		\determine_locale()
	);

	$json = \wp_json_encode( $payload );
	\wp_add_inline_script( SCRIPT_HANDLE, boot_script( \is_string( $json ) ? $json : '{}' ), 'before' );
}

/**
 * The REST nonce for this visitor, or an empty string when there is nobody to
 * mint one for.
 *
 * A nonce is only ever used to authenticate a write, and a signed-out visitor
 * cannot write anything. Printing one for them is not merely useless — it is
 * the one part of this payload that expires, and page caches outlive it. On a
 * host that caches anonymous HTML for longer than the nonce window (LiteSpeed
 * defaults to a week; edge caches that purge on content change rather than on
 * a clock never expire it at all), every anonymous reader would download the
 * bundle and be told their session had expired, with a reload that cannot
 * help because the cache serves the same stale value.
 *
 * Reading a published map needs no nonce, so an empty string costs nothing.
 */
function rest_nonce(): string {
	return \is_user_logged_in() ? (string) \wp_create_nonce( 'wp_rest' ) : '';
}

/**
 * Whether the boot payload has already been attached to this request.
 *
 * Asking the script queue rather than keeping a run-once flag of our own: the
 * queue *is* the state that matters, it is what a second `enqueue()` would
 * duplicate, and it resets with the request instead of with the process.
 */
function boot_printed(): bool {
	return holds_boot_script( \wp_scripts()->get_data( SCRIPT_HANDLE, 'before' ) );
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

	$renders_map = \has_shortcode( (string) $post->post_content, Render\SHORTCODE_TAG )
		|| \has_block( Render\BLOCK_NAME, $post );

	if ( $renders_map ) {
		enqueue( first_map_id( (string) $post->post_content ) );
	}
}

/**
 * The id of the first map a page embeds, whichever syntax embedded it.
 *
 * This runs in `wp_enqueue_scripts`, long before any block or shortcode
 * renders, so it has to find the id itself — and it has to look at blocks too.
 * Matching only the shortcode left a block-embedded map booting with no id at
 * all, which turned the payload's `canEdit` into a role check
 * (`default_can_edit( null )`) instead of an `edit_post` check on the map the
 * page actually shows, and the block's own later `enqueue()` could not correct
 * a payload that had already been printed.
 *
 * @param string $content Post content.
 */
function first_map_id( string $content ): ?string {
	if ( \function_exists( 'parse_blocks' ) ) {
		$id = first_block_map_id( \parse_blocks( $content ) );
		if ( null !== $id ) {
			return $id;
		}
	}

	return first_shortcode_map_id( $content );
}

/**
 * Walk parsed blocks in document order and return the first map id found —
 * from a `mind-maps/map` block's `id` attribute, or from a `[mind_map]` sitting
 * in a block's own HTML (a classic/freeform block, a paragraph, …).
 *
 * @param mixed $blocks Blocks from `parse_blocks()`.
 */
function first_block_map_id( mixed $blocks ): ?string {
	if ( ! \is_array( $blocks ) ) {
		return null;
	}

	foreach ( $blocks as $block ) {
		if ( ! \is_array( $block ) ) {
			continue;
		}

		if ( Render\BLOCK_NAME === ( $block['blockName'] ?? null ) ) {
			$attributes = $block['attrs'] ?? null;
			$id         = map_id_string( \is_array( $attributes ) ? ( $attributes['id'] ?? null ) : null );
			if ( null !== $id ) {
				return $id;
			}
		}

		$html = $block['innerHTML'] ?? null;
		$id   = \is_string( $html ) ? first_shortcode_map_id( $html ) : null;
		if ( null !== $id ) {
			return $id;
		}

		$id = first_block_map_id( $block['innerBlocks'] ?? null );
		if ( null !== $id ) {
			return $id;
		}
	}

	return null;
}

/**
 * The id of the first `[mind_map]` in a chunk of content.
 *
 * @param string $content Content to scan.
 */
function first_shortcode_map_id( string $content ): ?string {
	if ( ! \preg_match( '/\[mind_map\b[^\]]*\bid=["\']?(\d+)/', $content, $matches ) ) {
		return null;
	}
	return map_id_string( $matches[1] );
}

/**
 * A positive map id as a string, or null for anything else.
 *
 * @param mixed $value Candidate id.
 */
function map_id_string( mixed $value ): ?string {
	$id = \is_scalar( $value ) ? \absint( $value ) : 0;
	return $id > 0 ? (string) $id : null;
}
