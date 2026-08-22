<?php
/**
 * Data access for maps: WP_Post + post meta in, validated documents out.
 *
 * Stored JSON is never trusted. A row written by an older build, a rogue
 * `update_post_meta()` from another plugin or a half-finished migration all
 * come back through `MindMaps\Document\parse_document()` before anyone sees
 * them, so a corrupt map degrades to an empty one instead of breaking the
 * editor.
 *
 * @package MindMaps
 */

declare(strict_types=1);

namespace MindMaps\Repository;

use MindMaps\Document;
use MindMaps\PostType;
use WP_Error;
use WP_Post;

/**
 * Fetch the post behind a map id, or null when there is no such map.
 *
 * Guards the post type: an arbitrary post id must not become a readable map.
 *
 * @param int $id Post id.
 */
function find_map_post( int $id ): ?WP_Post {
	if ( $id <= 0 ) {
		return null;
	}
	$post = \get_post( $id );
	if ( ! $post instanceof WP_Post || PostType\POST_TYPE !== $post->post_type ) {
		return null;
	}
	if ( ! \in_array( $post->post_status, PostType\readable_statuses(), true ) ) {
		return null;
	}
	return $post;
}

/**
 * Read one map as a validated document, or null when it does not exist.
 *
 * @param int $id Post id.
 * @return array<string, mixed>|null
 */
function find_map( int $id ): ?array {
	$post = find_map_post( $id );
	return null === $post ? null : post_to_document( $post );
}

/**
 * List maps newest-modified first, capped.
 *
 * @param int      $limit  Maximum number of maps.
 * @param int|null $author Restrict to one author, or null for every author.
 * @return array<int, array<string, mixed>>
 */
function list_maps( int $limit = 100, ?int $author = null ): array {
	$query = array(
		'post_type'        => PostType\POST_TYPE,
		'post_status'      => PostType\readable_statuses(),
		'numberposts'      => \max( 1, \min( $limit, 100 ) ),
		'orderby'          => 'modified',
		'order'            => 'DESC',
		'suppress_filters' => false,
		'no_found_rows'    => true,
	);
	if ( null !== $author ) {
		$query['author'] = $author;
	}

	$posts = \get_posts( $query );

	return \array_values( \array_map( __NAMESPACE__ . '\\post_to_document', $posts ) );
}

/**
 * Create a map from a validated document. Returns the new post id.
 *
 * @param array<string, mixed> $doc    A document from parse_document().
 * @param int                  $author Author user id.
 * @return int|WP_Error
 */
function create_map( array $doc, int $author ): int|WP_Error {
	$post_id = \wp_insert_post(
		array(
			'post_type'   => PostType\POST_TYPE,
			'post_status' => create_status(),
			'post_title'  => \wp_slash( title_of( $doc ) ),
			'post_author' => $author,
		),
		true
	);

	if ( \is_wp_error( $post_id ) ) {
		return $post_id;
	}

	write_meta( (int) $post_id, $doc );

	return (int) $post_id;
}

/**
 * The status a new map is created in.
 *
 * A map has no public URL, so `publish` buys nothing — and with
 * `map_meta_cap`, `edit_post`/`delete_post` on a *published* post resolve to
 * `edit_published_posts`/`delete_published_posts`, which a Contributor does not
 * have. Publishing a Contributor's map would hand them an editor whose every
 * later save and delete 403s. Creating it as a draft (already a readable
 * status) keeps the map theirs to edit.
 */
function create_status(): string {
	return \current_user_can( 'publish_posts' ) ? 'publish' : 'draft';
}

/**
 * Overwrite an existing map with a validated document.
 *
 * @param int                  $id  Post id.
 * @param array<string, mixed> $doc A document from parse_document().
 * @return int|WP_Error
 */
function update_map( int $id, array $doc ): int|WP_Error {
	if ( null === find_map_post( $id ) ) {
		return new WP_Error(
			'mindmap_not_found',
			\__( 'No mind map with that id.', 'mind-maps' ),
			array( 'status' => 404 )
		);
	}

	$result = \wp_update_post(
		array(
			'ID'         => $id,
			'post_title' => \wp_slash( title_of( $doc ) ),
		),
		true
	);

	if ( \is_wp_error( $result ) ) {
		return $result;
	}

	write_meta( $id, $doc );

	return $id;
}

/**
 * Delete a map permanently (no trash — a trashed map would 404 anyway, but
 * would keep its content around).
 *
 * @param int $id Post id.
 */
function delete_map( int $id ): bool {
	if ( null === find_map_post( $id ) ) {
		return false;
	}
	return \wp_delete_post( $id, true ) instanceof WP_Post;
}

/**
 * Build a validated document from a post and its meta.
 *
 * Never returns null: unreadable stored content degrades to an empty document
 * so a single bad row cannot take down the list screen.
 *
 * @param WP_Post $post The map post.
 * @return array<string, mixed>
 */
function post_to_document( WP_Post $post ): array {
	$payload = array(
		'id'       => (string) $post->ID,
		'title'    => $post->post_title,
		'content'  => decode_content( \get_post_meta( $post->ID, PostType\META_CONTENT, true ) ),
		'modified' => modified_at( $post ),
		'meta'     => array( 'template' => template_flag( $post->ID ) ),
	);

	$doc = Document\parse_document( $payload, (string) $post->ID );
	if ( null !== $doc ) {
		return $doc;
	}

	$payload['content'] = array();
	$doc                = Document\parse_document( $payload, (string) $post->ID );

	// Unreachable in practice — an empty content list always parses — but the
	// caller is promised an array, not a maybe.
	return $doc ?? array(
		'id'      => (string) $post->ID,
		'title'   => \is_string( $post->post_title ) ? $post->post_title : '',
		'content' => array(),
		'version' => Document\DOC_VERSION,
	);
}

/**
 * Decode the stored content JSON into something parse_content() can chew on.
 *
 * Goes through `Document\decode_json()` so stored meta is held to the same
 * shape rules as a request body: a row someone wrote behind the plugin's back
 * as `{"0":[…]}` is a JSON object, not a list, and must be rejected rather than
 * silently accepted because PHP's associative decoding blurred the difference.
 *
 * @param mixed $stored Raw meta value.
 * @return mixed Decoded value, or an empty list when the meta is unusable.
 */
function decode_content( mixed $stored ): mixed {
	$decoded = Document\decode_json( $stored );
	return null === $decoded ? array() : $decoded;
}

/**
 * The post's last-modified time as an ISO-8601 string with an explicit offset,
 * e.g. `2026-08-22T10:00:00+00:00`.
 *
 * `get_post_modified_time( 'c', true, … )` and not `mysql2date()`: the latter
 * reads a GMT column through the *site* timezone and would label the wrong
 * instant on any site that is not UTC.
 *
 * @param WP_Post $post The map post.
 */
function modified_at( WP_Post $post ): string {
	$formatted = \get_post_modified_time( 'c', true, $post );
	return \is_string( $formatted ) ? $formatted : '';
}

/**
 * The template flag, normalized to `"1"` or `"0"`.
 *
 * @param int $post_id Post id.
 */
function template_flag( int $post_id ): string {
	return '1' === (string) \get_post_meta( $post_id, PostType\META_TEMPLATE, true ) ? '1' : '0';
}

/**
 * The title a document wants on its post.
 *
 * @param array<string, mixed> $doc A document.
 */
function title_of( array $doc ): string {
	return \is_string( $doc['title'] ?? null ) ? $doc['title'] : '';
}

/**
 * The template flag a document wants on its post.
 *
 * @param array<string, mixed> $doc A document.
 */
function template_of( array $doc ): string {
	$meta = $doc['meta'] ?? null;
	if ( ! \is_array( $meta ) ) {
		return '0';
	}
	return '1' === ( $meta['template'] ?? '' ) ? '1' : '0';
}

/**
 * Persist a validated document's meta.
 *
 * `update_post_meta()` unslashes what it is given, so the JSON has to travel
 * slashed or every quote in the document loses its escape.
 *
 * @param int                  $post_id Post id.
 * @param array<string, mixed> $doc     A document from parse_document().
 */
function write_meta( int $post_id, array $doc ): void {
	$content = \is_array( $doc['content'] ?? null ) ? \array_values( $doc['content'] ) : array();
	$json    = \wp_json_encode( $content, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE );

	\update_post_meta( $post_id, PostType\META_CONTENT, \wp_slash( \is_string( $json ) ? $json : '[]' ) );
	\update_post_meta( $post_id, PostType\META_VERSION, Document\DOC_VERSION );
	\update_post_meta( $post_id, PostType\META_TEMPLATE, template_of( $doc ) );
}
