<?php
/**
 * Map document validation and normalization — pure PHP, zero WordPress.
 *
 * This is the security boundary: everything that reaches post meta, and
 * everything that leaves it, is funnelled through here. The rules mirror
 * `packages/storage/src/document.ts` one for one — when the schema changes,
 * change both files (and `docs/wordpress-contract.md`) together.
 *
 * The file is deliberately dependency-free so it can be required and unit
 * tested without loading WordPress.
 *
 * @package MindMaps
 */

declare(strict_types=1);

namespace MindMaps\Document;

defined( 'ABSPATH' ) || exit;

/** Schema version stamped on every document this build writes. */
const DOC_VERSION = 1;

/**
 * Hard ceiling on the number of `content` entries a document may carry.
 *
 * Validation is linear in the number of nodes, but every step of it still runs
 * on bytes an unauthenticated-until-the-permission-callback client chose, so
 * there has to be a point where the answer is "no" rather than "eventually".
 * Ten thousand nodes is far past anything the editor produces by hand — the
 * unit suite exercises a five-thousand-node map as a realistic upper bound —
 * and a document this size is already ~1 MB of JSON.
 */
const MAX_NODES = 10000;

/**
 * Decode a JSON string the way this module wants to see it.
 *
 * `json_decode( …, true )` is deliberately *not* used: it turns a JSON object
 * into a PHP associative array, and `{"0":…,"1":…}` then decodes into a value
 * `array_is_list()` happily calls a list. TypeScript's `Array.isArray` rejects
 * that object, so PHP must too, and the only way to keep the distinction is to
 * let objects arrive as `stdClass`.
 *
 * Returns null when the JSON is unusable (and also, unavoidably, for a literal
 * `null` — callers treat both the same).
 *
 * @param mixed $json Raw JSON text.
 */
function decode_json( mixed $json ): mixed {
	if ( ! \is_string( $json ) || '' === $json ) {
		return null;
	}
	return \json_decode( $json, false );
}

/**
 * Whether a value is a keyed record: a decoded JSON object, or a PHP array.
 *
 * Mirrors TypeScript's `typeof value === 'object' && value !== null`, which is
 * what `parseNode`/`parseMapDoc` test. PHP arrays stay acceptable because the
 * repository builds a document payload out of post columns by hand.
 *
 * @param mixed $value Candidate.
 */
function is_record( mixed $value ): bool {
	return \is_array( $value ) || $value instanceof \stdClass;
}

/**
 * Read a member from a record, or null when it is absent.
 *
 * @param mixed  $value Record.
 * @param string $key   Member name.
 */
function member( mixed $value, string $key ): mixed {
	if ( $value instanceof \stdClass ) {
		return $value->{$key} ?? null;
	}
	if ( \is_array( $value ) ) {
		return $value[ $key ] ?? null;
	}
	return null;
}

/**
 * Whether a value is a JSON array — a real, ordered list and nothing else.
 *
 * @param mixed $value Candidate.
 */
function is_list_value( mixed $value ): bool {
	return \is_array( $value ) && \array_is_list( $value );
}

/**
 * A node id is a string or a number — mirroring the TypeScript `NodeId` union.
 *
 * @param mixed $value Candidate.
 */
function is_node_id( mixed $value ): bool {
	return \is_string( $value ) || \is_int( $value ) || \is_float( $value );
}

/**
 * `Number.isFinite` in PHP: real numbers only, no numeric strings, no booleans,
 * no NAN and no INF (JSON's `1e999` decodes to INF).
 *
 * @param mixed $value Candidate.
 */
function is_finite_number( mixed $value ): bool {
	if ( \is_int( $value ) ) {
		return true;
	}
	return \is_float( $value ) && \is_finite( $value );
}

/**
 * Render a node id the way JavaScript's `String()` would.
 *
 * @param mixed $value Node id.
 */
function node_id_to_string( mixed $value ): string {
	if ( \is_string( $value ) ) {
		return $value;
	}
	if ( \is_float( $value ) ) {
		if ( \is_nan( $value ) ) {
			return 'NaN';
		}
		if ( \is_infinite( $value ) ) {
			return $value > 0 ? 'Infinity' : '-Infinity';
		}
	}
	return (string) $value;
}

/**
 * A collision-free key for using node ids in PHP arrays.
 *
 * PHP arrays coerce the string `'0'` to the integer `0`; a JavaScript `Set`
 * does not. Tagging by type keeps `'0'` and `0` distinct, so duplicate- and
 * cycle-detection behave exactly like the TypeScript original.
 *
 * @param mixed $value Node id.
 */
function node_id_tag( mixed $value ): string {
	if ( \is_string( $value ) ) {
		return 's:' . $value;
	}
	if ( \is_float( $value ) ) {
		if ( \is_nan( $value ) ) {
			return 'n:NaN';
		}
		if ( \is_infinite( $value ) ) {
			return $value > 0 ? 'n:Infinity' : 'n:-Infinity';
		}
	}
	$number = (float) $value;
	// JavaScript's SameValueZero treats -0 and 0 as one value.
	if ( 0.0 === $number ) {
		return 'n:0';
	}
	return 'n:' . (string) $number;
}

/**
 * Validate one raw node, keeping only whitelisted fields.
 *
 * Returns null for anything the engine could not draw: a missing name, a
 * non-numeric or non-finite coordinate.
 *
 * @param mixed $value Raw node.
 * @return array<string, mixed>|null
 */
function parse_node( mixed $value ): ?array {
	if ( ! is_record( $value ) ) {
		return null;
	}
	$name = member( $value, 'name' );
	if ( ! \is_string( $name ) ) {
		return null;
	}
	$x = member( $value, 'x' );
	$y = member( $value, 'y' );
	if ( ! is_finite_number( $x ) || ! is_finite_number( $y ) ) {
		return null;
	}

	$node = array(
		'name' => $name,
		'x'    => $x,
		'y'    => $y,
	);

	if ( is_node_id( member( $value, 'id' ) ) ) {
		$node['id'] = member( $value, 'id' );
	}
	if ( is_node_id( member( $value, 'parent' ) ) ) {
		$node['parent'] = member( $value, 'parent' );
	}
	if ( \is_string( member( $value, 'stroke' ) ) ) {
		$node['stroke'] = member( $value, 'stroke' );
	}
	if ( is_finite_number( member( $value, 'strokeWidth' ) ) ) {
		$node['strokeWidth'] = member( $value, 'strokeWidth' );
	}
	if ( \in_array( member( $value, 'lineStyle' ), array( 'solid', 'dashed' ), true ) ) {
		$node['lineStyle'] = member( $value, 'lineStyle' );
	}
	if ( \in_array( member( $value, 'lineShape' ), array( 'straight', 'smooth' ), true ) ) {
		$node['lineShape'] = member( $value, 'lineShape' );
	}
	if ( is_finite_number( member( $value, 'width' ) ) ) {
		$node['width'] = member( $value, 'width' );
	}
	if ( is_finite_number( member( $value, 'height' ) ) ) {
		$node['height'] = member( $value, 'height' );
	}
	if ( true === member( $value, 'sticky' ) ) {
		$node['sticky'] = true;
	}
	if ( true === member( $value, 'collapsed' ) ) {
		$node['collapsed'] = true;
	}
	if ( \is_string( member( $value, 'reaction' ) ) ) {
		$node['reaction'] = member( $value, 'reaction' );
	}

	return $node;
}

/**
 * Validate a document's `content` entries.
 *
 * Rejects anything malformed outright — a half-valid adjacency list is worse
 * than none — except parent pointers that dangle outside the document, which
 * are dropped. Parent cycles are rejected: the engine walks parent chains when
 * deriving hidden state and moving branches, and a cycle would hang it.
 *
 * Both the content and every entry inside it must be a real JSON array. A JSON
 * *object* — `{}`, or the `{"0":…,"1":…}` an attacker writes precisely because
 * PHP used to decode it into something indistinguishable from a list — is
 * rejected, exactly as `Array.isArray` rejects it in TypeScript.
 *
 * Size is bounded before any per-node or graph work: see MAX_NODES.
 *
 * @param mixed $value Candidate content.
 * @return array<int, array{0: mixed, 1: array<string, mixed>}>|null
 */
function parse_content( mixed $value ): ?array {
	if ( ! is_list_value( $value ) ) {
		return null;
	}
	if ( \count( $value ) > MAX_NODES ) {
		return null;
	}

	$entries = array();
	$seen    = array();
	foreach ( $value as $entry ) {
		if ( ! is_list_value( $entry ) || 2 !== \count( $entry ) ) {
			return null;
		}
		$key = $entry[0];
		if ( ! is_node_id( $key ) ) {
			return null;
		}
		$key_tag = node_id_tag( $key );
		if ( isset( $seen[ $key_tag ] ) ) {
			return null;
		}
		$node = parse_node( $entry[1] );
		if ( null === $node ) {
			return null;
		}
		$seen[ $key_tag ] = true;
		$entries[]        = array( $key, $node );
	}

	// A node's own `id` field wins over its entry key, exactly as the engine's
	// adjacency reader does.
	$ids   = array();
	$order = array();
	foreach ( $entries as $entry ) {
		$id  = \array_key_exists( 'id', $entry[1] ) ? $entry[1]['id'] : $entry[0];
		$tag = node_id_tag( $id );
		if ( ! isset( $ids[ $tag ] ) ) {
			$ids[ $tag ] = true;
			$order[]     = $tag;
		}
	}

	$parent_of = array();
	foreach ( $entries as $index => $entry ) {
		$id = \array_key_exists( 'id', $entry[1] ) ? $entry[1]['id'] : $entry[0];
		if ( \array_key_exists( 'parent', $entry[1] ) && ! isset( $ids[ node_id_tag( $entry[1]['parent'] ) ] ) ) {
			unset( $entries[ $index ][1]['parent'] );
		}
		$parent_of[ node_id_tag( $id ) ] = \array_key_exists( 'parent', $entries[ $index ][1] )
			? node_id_tag( $entries[ $index ][1]['parent'] )
			: null;
	}

	// Cycle detection, memoized. Walking every node's full parent chain from a
	// fresh visited set is O(n²) on the one shape an attacker gets to choose —
	// a single long chain — so a node proven to reach a root is remembered and
	// every later walk stops the moment it lands on one. Each node is walked
	// once, making the whole pass O(n).
	$acyclic = array();
	foreach ( $order as $start ) {
		$path   = array();
		$cursor = $start;
		while ( null !== $cursor && ! isset( $acyclic[ $cursor ] ) ) {
			if ( isset( $path[ $cursor ] ) ) {
				return null;
			}
			$path[ $cursor ] = true;
			$cursor          = $parent_of[ $cursor ] ?? null;
		}
		// The walk ended at a root or at a node already known to reach one, so
		// everything it crossed reaches a root too.
		foreach ( $path as $tag => $ignored ) {
			$acyclic[ $tag ] = true;
		}
	}

	return $entries;
}

/**
 * Validate and normalize an unknown value into a document, or return null.
 *
 * `$fallback_id` supplies an id when the payload carries none — a stored post
 * whose meta predates the id field, or a freshly POSTed document whose id the
 * backend is about to assign.
 *
 * @param mixed       $value       Candidate document.
 * @param string|null $fallback_id Id to use when the payload has none.
 * @return array<string, mixed>|null
 */
function parse_document( mixed $value, ?string $fallback_id = null ): ?array {
	if ( ! is_record( $value ) ) {
		return null;
	}

	$raw_id = member( $value, 'id' );
	$id     = is_node_id( $raw_id ) ? node_id_to_string( $raw_id ) : $fallback_id;
	if ( null === $id || '' === $id ) {
		return null;
	}

	$content = parse_content( member( $value, 'content' ) ?? array() );
	if ( null === $content ) {
		return null;
	}

	$title = member( $value, 'title' );
	$doc   = array(
		'id'      => $id,
		'title'   => \is_string( $title ) ? $title : '',
		'content' => $content,
		'version' => DOC_VERSION,
	);

	$modified = member( $value, 'modified' );
	if ( \is_string( $modified ) ) {
		$doc['modified'] = $modified;
	}
	$date = member( $value, 'date' );
	if ( \is_string( $date ) ) {
		$doc['date'] = $date;
	}
	$meta = member( $value, 'meta' );
	if ( is_record( $meta ) && \is_string( member( $meta, 'template' ) ) ) {
		$doc['meta'] = array( 'template' => member( $meta, 'template' ) );
	}

	return $doc;
}

/**
 * The wire form: normalized, version-stamped, keys in contract order.
 *
 * Absent optional members are omitted rather than emitted as null — that is
 * what `JSON.stringify` does to the TypeScript `toWire`'s `undefined` values,
 * and what the client's parser expects.
 *
 * @param array<string, mixed> $doc A document, ideally from parse_document().
 * @return array<string, mixed>
 */
function to_wire( array $doc ): array {
	$wire = array(
		'id'      => is_node_id( $doc['id'] ?? null ) ? node_id_to_string( $doc['id'] ) : '',
		'title'   => \is_string( $doc['title'] ?? null ) ? $doc['title'] : '',
		'content' => \is_array( $doc['content'] ?? null ) ? \array_values( $doc['content'] ) : array(),
	);
	if ( \is_string( $doc['modified'] ?? null ) ) {
		$wire['modified'] = $doc['modified'];
	}
	if ( \is_array( $doc['meta'] ?? null ) ) {
		$wire['meta'] = $doc['meta'];
	}
	$wire['version'] = DOC_VERSION;

	return $wire;
}
