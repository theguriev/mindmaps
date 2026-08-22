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

/** Schema version stamped on every document this build writes. */
const DOC_VERSION = 1;

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
	if ( ! \is_array( $value ) ) {
		return null;
	}
	$name = $value['name'] ?? null;
	if ( ! \is_string( $name ) ) {
		return null;
	}
	$x = $value['x'] ?? null;
	$y = $value['y'] ?? null;
	if ( ! is_finite_number( $x ) || ! is_finite_number( $y ) ) {
		return null;
	}

	$node = array(
		'name' => $name,
		'x'    => $x,
		'y'    => $y,
	);

	if ( is_node_id( $value['id'] ?? null ) ) {
		$node['id'] = $value['id'];
	}
	if ( is_node_id( $value['parent'] ?? null ) ) {
		$node['parent'] = $value['parent'];
	}
	if ( \is_string( $value['stroke'] ?? null ) ) {
		$node['stroke'] = $value['stroke'];
	}
	if ( is_finite_number( $value['strokeWidth'] ?? null ) ) {
		$node['strokeWidth'] = $value['strokeWidth'];
	}
	if ( \in_array( $value['lineStyle'] ?? null, array( 'solid', 'dashed' ), true ) ) {
		$node['lineStyle'] = $value['lineStyle'];
	}
	if ( \in_array( $value['lineShape'] ?? null, array( 'straight', 'smooth' ), true ) ) {
		$node['lineShape'] = $value['lineShape'];
	}
	if ( is_finite_number( $value['width'] ?? null ) ) {
		$node['width'] = $value['width'];
	}
	if ( is_finite_number( $value['height'] ?? null ) ) {
		$node['height'] = $value['height'];
	}
	if ( true === ( $value['sticky'] ?? null ) ) {
		$node['sticky'] = true;
	}
	if ( true === ( $value['collapsed'] ?? null ) ) {
		$node['collapsed'] = true;
	}
	if ( \is_string( $value['reaction'] ?? null ) ) {
		$node['reaction'] = $value['reaction'];
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
 * @param mixed $value Candidate content.
 * @return array<int, array{0: mixed, 1: array<string, mixed>}>|null
 */
function parse_content( mixed $value ): ?array {
	if ( ! \is_array( $value ) || ! \array_is_list( $value ) ) {
		return null;
	}

	$entries = array();
	$seen    = array();
	foreach ( $value as $entry ) {
		if ( ! \is_array( $entry ) || ! \array_is_list( $entry ) || 2 !== \count( $entry ) ) {
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

	foreach ( $order as $start ) {
		$walked = array();
		$cursor = $start;
		while ( null !== $cursor ) {
			if ( isset( $walked[ $cursor ] ) ) {
				return null;
			}
			$walked[ $cursor ] = true;
			$cursor            = $parent_of[ $cursor ] ?? null;
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
	if ( ! \is_array( $value ) ) {
		return null;
	}

	$id = is_node_id( $value['id'] ?? null ) ? node_id_to_string( $value['id'] ) : $fallback_id;
	if ( null === $id || '' === $id ) {
		return null;
	}

	$content = parse_content( $value['content'] ?? array() );
	if ( null === $content ) {
		return null;
	}

	$doc = array(
		'id'      => $id,
		'title'   => \is_string( $value['title'] ?? null ) ? $value['title'] : '',
		'content' => $content,
		'version' => DOC_VERSION,
	);

	if ( \is_string( $value['modified'] ?? null ) ) {
		$doc['modified'] = $value['modified'];
	}
	if ( \is_string( $value['date'] ?? null ) ) {
		$doc['date'] = $value['date'];
	}
	if ( \is_array( $value['meta'] ?? null ) && \is_string( $value['meta']['template'] ?? null ) ) {
		$doc['meta'] = array( 'template' => $value['meta']['template'] );
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
