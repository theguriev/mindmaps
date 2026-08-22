<?php
/**
 * Unit tests for the pure document validator.
 *
 * Every case in `packages/storage/src/document.test.ts` is ported here, plus
 * the ones only the PHP side can get wrong: NAN/INF coordinates, deep parent
 * chains, documents large enough to matter, and unicode that must survive a
 * round trip untouched.
 *
 * No WordPress is loaded for this suite — `src/document.php` may never depend
 * on it.
 *
 * @package MindMaps
 */

declare(strict_types=1);

namespace MindMaps\Tests\Unit;

use PHPUnit\Framework\TestCase;

use function MindMaps\Document\decode_json;
use function MindMaps\Document\parse_content;
use function MindMaps\Document\parse_document;
use function MindMaps\Document\to_wire;

use const MindMaps\Document\DOC_VERSION;
use const MindMaps\Document\MAX_NODES;

final class DocumentTest extends TestCase {

	/**
	 * A minimal valid node, with overrides merged on top.
	 *
	 * @param array<string, mixed> $over Fields to add or replace.
	 * @return array<string, mixed>
	 */
	private static function node( array $over = array() ): array {
		return \array_merge(
			array(
				'name' => 'n',
				'x'    => 0,
				'y'    => 0,
			),
			$over
		);
	}

	public function test_document_php_needs_no_wordpress(): void {
		$this->assertFalse(
			\function_exists( 'add_action' ),
			'The unit suite must run with no WordPress loaded.'
		);
	}

	/* ---------------------------------------------------------------------
	 * parse_content
	 * ------------------------------------------------------------------ */

	public function test_accepts_well_formed_entries_and_keeps_known_optional_fields(): void {
		$content = parse_content(
			array(
				array( 0, self::node( array( 'name' => 'root' ) ) ),
				array(
					'a',
					self::node(
						array(
							'parent'    => 0,
							'stroke'    => '#00f',
							'collapsed' => true,
							'width'     => 200,
						)
					),
				),
			)
		);

		$this->assertNotNull( $content );
		$this->assertSame( 0, $content[1][1]['parent'] );
		$this->assertSame( '#00f', $content[1][1]['stroke'] );
		$this->assertTrue( $content[1][1]['collapsed'] );
		$this->assertSame( 200, $content[1][1]['width'] );
	}

	public function test_drops_unknown_and_ill_typed_optional_fields(): void {
		$content = parse_content(
			array(
				array(
					0,
					self::node(
						array(
							'editing'   => true,
							'component' => 'root',
							'lineStyle' => 'wavy',
							'width'     => 'wide',
						)
					),
				),
			)
		);

		$this->assertNotNull( $content );
		$this->assertSame(
			array(
				'name' => 'n',
				'x'    => 0,
				'y'    => 0,
			),
			$content[0][1]
		);
	}

	public function test_keeps_every_whitelisted_optional_field(): void {
		$content = parse_content(
			array(
				array(
					'a',
					self::node(
						array(
							'id'          => 'a',
							'stroke'      => '#123456',
							'strokeWidth' => 2.5,
							'lineStyle'   => 'dashed',
							'lineShape'   => 'smooth',
							'width'       => 120,
							'height'      => 40,
							'sticky'      => true,
							'collapsed'   => true,
							'reaction'    => '🎉',
						)
					),
				),
			)
		);

		$this->assertNotNull( $content );
		$this->assertSame(
			array( 'name', 'x', 'y', 'id', 'stroke', 'strokeWidth', 'lineStyle', 'lineShape', 'width', 'height', 'sticky', 'collapsed', 'reaction' ),
			\array_keys( $content[0][1] )
		);
	}

	public function test_sticky_and_collapsed_only_accept_literal_true(): void {
		$content = parse_content(
			array(
				array(
					'a',
					self::node(
						array(
							'sticky'    => 1,
							'collapsed' => 'yes',
						)
					),
				),
			)
		);

		$this->assertNotNull( $content );
		$this->assertArrayNotHasKey( 'sticky', $content[0][1] );
		$this->assertArrayNotHasKey( 'collapsed', $content[0][1] );
	}

	/**
	 * @param mixed $value Candidate content.
	 * @dataProvider malformed_content
	 */
	public function test_rejects_malformed_entries( mixed $value ): void {
		$this->assertNull( parse_content( $value ) );
	}

	/**
	 * @return array<string, array{0: mixed}>
	 */
	public static function malformed_content(): array {
		return array(
			'not a list'          => array( 'nope' ),
			'object not array'    => array( array( 'a' => self::node() ) ),
			'entry of one'        => array( array( array( 'a' ) ) ),
			'entry of three'      => array( array( array( 'a', self::node(), 'extra' ) ) ),
			'node without coords' => array( array( array( 'a', array( 'name' => 'x' ) ) ) ),
			'node without name'   => array( array( array( 'a', array( 'x' => 0, 'y' => 0 ) ) ) ),
			'name not a string'   => array( array( array( 'a', self::node( array( 'name' => 7 ) ) ) ) ),
			'coordinate string'   => array( array( array( 'a', self::node( array( 'x' => 'far' ) ) ) ) ),
			'coordinate bool'     => array( array( array( 'a', self::node( array( 'y' => true ) ) ) ) ),
			'numeric string x'    => array( array( array( 'a', self::node( array( 'x' => '10' ) ) ) ) ),
			'duplicate keys'      => array( array( array( 'a', self::node() ), array( 'a', self::node() ) ) ),
			'node is a string'    => array( array( array( 'a', 'node' ) ) ),
			'key is an array'     => array( array( array( array( 'a' ), self::node() ) ) ),
			'key is null'         => array( array( array( null, self::node() ) ) ),
			'key is a bool'       => array( array( array( true, self::node() ) ) ),
		);
	}

	public function test_rejects_non_finite_coordinates_from_json(): void {
		$decoded = \json_decode( '[["a",{"name":"n","x":1e999,"y":0}]]', true );

		// PHP decodes 1e999 to INF, exactly as JavaScript's JSON.parse does.
		$this->assertTrue( \is_infinite( $decoded[0][1]['x'] ) );
		$this->assertNull( parse_content( $decoded ) );
	}

	/**
	 * @param float $value A coordinate PHP can hold but the engine cannot draw.
	 * @dataProvider non_finite_numbers
	 */
	public function test_rejects_nan_and_inf_coordinates( float $value ): void {
		$this->assertNull( parse_content( array( array( 'a', self::node( array( 'x' => $value ) ) ) ) ) );
		$this->assertNull( parse_content( array( array( 'a', self::node( array( 'y' => $value ) ) ) ) ) );
	}

	/**
	 * @return array<string, array{0: float}>
	 */
	public static function non_finite_numbers(): array {
		return array(
			'NAN'  => array( \NAN ),
			'INF'  => array( \INF ),
			'-INF' => array( -\INF ),
		);
	}

	public function test_drops_non_finite_optional_measurements(): void {
		$content = parse_content(
			array(
				array(
					'a',
					self::node(
						array(
							'width'       => \INF,
							'height'      => \NAN,
							'strokeWidth' => \INF,
						)
					),
				),
			)
		);

		$this->assertNotNull( $content );
		$this->assertSame(
			array(
				'name' => 'n',
				'x'    => 0,
				'y'    => 0,
			),
			$content[0][1]
		);
	}

	public function test_drops_parent_pointers_that_dangle_outside_the_document(): void {
		$content = parse_content( array( array( 'a', self::node( array( 'parent' => 'ghost' ) ) ) ) );

		$this->assertNotNull( $content );
		$this->assertArrayNotHasKey( 'parent', $content[0][1] );
	}

	public function test_rejects_cycles(): void {
		$this->assertNull(
			parse_content(
				array(
					array( 'a', self::node( array( 'parent' => 'b' ) ) ),
					array( 'b', self::node( array( 'parent' => 'a' ) ) ),
				)
			)
		);
		$this->assertNull( parse_content( array( array( 'a', self::node( array( 'parent' => 'a' ) ) ) ) ) );
	}

	public function test_rejects_a_deep_cycle(): void {
		$entries = array();
		$depth   = 500;
		for ( $i = 0; $i < $depth; $i++ ) {
			$parent    = 0 === $i ? (string) ( $depth - 1 ) : (string) ( $i - 1 );
			$entries[] = array( (string) $i, self::node( array( 'parent' => $parent ) ) );
		}

		$this->assertNull( parse_content( $entries ), 'A 500-long parent ring must be rejected.' );
	}

	public function test_accepts_a_deep_acyclic_chain(): void {
		$entries = array( array( '0', self::node() ) );
		for ( $i = 1; $i < 2000; $i++ ) {
			$entries[] = array( (string) $i, self::node( array( 'parent' => (string) ( $i - 1 ) ) ) );
		}

		$content = parse_content( $entries );

		$this->assertNotNull( $content );
		$this->assertCount( 2000, $content );
		$this->assertSame( '1998', $content[1999][1]['parent'] );
	}

	public function test_accepts_a_huge_flat_document(): void {
		$entries = array( array( 'root', self::node() ) );
		for ( $i = 0; $i < 5000; $i++ ) {
			$entries[] = array(
				'n' . $i,
				self::node(
					array(
						'name'   => 'node ' . $i,
						'x'      => $i * 10,
						'y'      => $i % 97,
						'parent' => 'root',
					)
				),
			);
		}

		$content = parse_content( $entries );

		$this->assertNotNull( $content );
		$this->assertCount( 5001, $content );
		$this->assertSame( 'root', $content[5000][1]['parent'] );
	}

	public function test_distinguishes_string_and_numeric_node_ids(): void {
		// PHP arrays coerce '0' to 0; a JavaScript Set does not. These are two
		// different nodes, and neither is a duplicate of the other.
		$content = parse_content(
			array(
				array( 0, self::node( array( 'name' => 'number' ) ) ),
				array( '0', self::node( array( 'name' => 'string' ) ) ),
			)
		);

		$this->assertNotNull( $content );
		$this->assertCount( 2, $content );
		$this->assertSame( 'number', $content[0][1]['name'] );
		$this->assertSame( 'string', $content[1][1]['name'] );
	}

	public function test_a_node_id_field_overrides_its_entry_key(): void {
		// The child points at the parent's `id`, not at its entry key.
		$content = parse_content(
			array(
				array( 'key', self::node( array( 'id' => 'real' ) ) ),
				array( 'child', self::node( array( 'parent' => 'real' ) ) ),
			)
		);

		$this->assertNotNull( $content );
		$this->assertSame( 'real', $content[1][1]['parent'] );
	}

	public function test_accepts_an_empty_document(): void {
		$this->assertSame( array(), parse_content( array() ) );
	}

	/* ---------------------------------------------------------------------
	 * JSON shape: an object is not a list, however PHP decodes it.
	 * ------------------------------------------------------------------ */

	public function test_decode_json_keeps_objects_and_arrays_apart(): void {
		// The trap this whole group exists for: decoded associatively, an
		// object with consecutive numeric keys is indistinguishable from a
		// list, and `array_is_list()` waves it through. TypeScript's
		// `Array.isArray` never would.
		$associative = \json_decode( '{"0":"a","1":"b"}', true );
		$this->assertTrue( \is_array( $associative ) && \array_is_list( $associative ) );

		$this->assertInstanceOf( \stdClass::class, decode_json( '{"0":"a","1":"b"}' ) );
		$this->assertInstanceOf( \stdClass::class, decode_json( '{}' ) );
		$this->assertSame( array( 'a', 'b' ), decode_json( '["a","b"]' ) );
		$this->assertNull( decode_json( 'not json' ) );
		$this->assertNull( decode_json( '' ) );
		$this->assertNull( decode_json( null ) );
	}

	/**
	 * @param string $json A body whose `content` is an object, not an array.
	 * @dataProvider object_shaped_content
	 */
	public function test_rejects_object_shaped_content( string $json ): void {
		$this->assertNull( parse_document( decode_json( $json ) ), $json );
	}

	/**
	 * @return array<string, array{0: string}>
	 */
	public static function object_shaped_content(): array {
		$node = '{"name":"n","x":0,"y":0}';

		return array(
			'content is an empty object'   => array( '{"id":"a","content":{}}' ),
			'content is a keyed object'    => array( '{"id":"a","content":{"nodes":[]}}' ),
			// The interesting one: numeric keys from 0 up, which decodes to a
			// PHP list under `json_decode( …, true )`.
			'content is a numbered object' => array( '{"id":"a","content":{"0":["a",' . $node . '],"1":["b",' . $node . ']}}' ),
			'an entry is an object'        => array( '{"id":"a","content":[{"0":"a","1":' . $node . '}]}' ),
			'an entry is a keyed object'   => array( '{"id":"a","content":[{"key":"a","node":' . $node . '}]}' ),
		);
	}

	public function test_parse_content_rejects_an_object_even_when_it_looks_like_a_list(): void {
		$this->assertNull( parse_content( decode_json( '{"0":["a",{"name":"n","x":0,"y":0}]}' ) ) );
		$this->assertNull( parse_content( decode_json( '{}' ) ) );
	}

	public function test_still_parses_a_document_decoded_as_objects(): void {
		// The other half of the same change: nodes and documents legitimately
		// arrive as `stdClass` now, and must keep parsing.
		$doc = parse_document(
			decode_json( '{"id":"7","title":"T","content":[["0",{"name":"Root","x":1,"y":2,"collapsed":true}]],"meta":{"template":"1"}}' )
		);

		$this->assertNotNull( $doc );
		$this->assertSame( '7', $doc['id'] );
		$this->assertSame( 'T', $doc['title'] );
		$this->assertSame( array( 'template' => '1' ), $doc['meta'] );
		$this->assertSame(
			array(
				'name'      => 'Root',
				'x'         => 1,
				'y'         => 2,
				'collapsed' => true,
			),
			$doc['content'][0][1]
		);
	}

	/* ---------------------------------------------------------------------
	 * Size and cost bounds.
	 * ------------------------------------------------------------------ */

	public function test_rejects_a_document_above_the_node_ceiling(): void {
		$entries = array();
		for ( $i = 0; $i <= MAX_NODES; $i++ ) {
			$entries[] = array( (string) $i, self::node() );
		}

		$this->assertCount( MAX_NODES + 1, $entries );
		$this->assertNull( parse_content( $entries ), 'A document above MAX_NODES must be refused outright.' );
		$this->assertNull(
			parse_document(
				array(
					'id'      => 'a',
					'content' => $entries,
				)
			)
		);

		// And exactly at the ceiling it is still accepted.
		\array_pop( $entries );
		$this->assertNotNull( parse_content( $entries ) );
	}

	public function test_validates_a_long_chain_in_linear_time(): void {
		// Cycle detection used to walk every node's full parent chain from a
		// fresh visited set, which is quadratic on exactly the shape a hostile
		// client would send: one chain, MAX_NODES long. On the reference
		// machine that took ~1s; memoized it takes ~10ms. The bound below sits
		// between the two with room on either side.
		$entries = array( array( '0', self::node() ) );
		for ( $i = 1; $i < MAX_NODES; $i++ ) {
			$entries[] = array( (string) $i, self::node( array( 'parent' => (string) ( $i - 1 ) ) ) );
		}

		$started = \microtime( true );
		$content = parse_content( $entries );
		$elapsed = \microtime( true ) - $started;

		$this->assertNotNull( $content );
		$this->assertCount( MAX_NODES, $content );
		$this->assertLessThan(
			0.25,
			$elapsed,
			\sprintf( 'A %d-node chain took %.3fs — cycle detection is not linear.', MAX_NODES, $elapsed )
		);
	}

	public function test_still_rejects_a_cycle_hidden_behind_a_long_acyclic_prefix(): void {
		// Memoizing "this node reaches a root" must not let a cycle further
		// along the document slip through.
		$entries = array( array( '0', self::node() ) );
		for ( $i = 1; $i < 1000; $i++ ) {
			$entries[] = array( (string) $i, self::node( array( 'parent' => (string) ( $i - 1 ) ) ) );
		}
		$entries[] = array( 'x', self::node( array( 'parent' => 'y' ) ) );
		$entries[] = array( 'y', self::node( array( 'parent' => 'x' ) ) );

		$this->assertNull( parse_content( $entries ) );
	}

	/* ---------------------------------------------------------------------
	 * parse_document
	 * ------------------------------------------------------------------ */

	public function test_normalizes_a_document_and_stamps_the_schema_version(): void {
		$doc = parse_document(
			array(
				'id'       => 42,
				'title'    => 'Plan',
				'content'  => array( array( 0, self::node( array( 'name' => 'root' ) ) ) ),
				'modified' => '2026-01-01T00:00:00.000Z',
				'meta'     => array( 'template' => '1' ),
			)
		);

		$this->assertNotNull( $doc );
		$this->assertSame( '42', $doc['id'] );
		$this->assertSame( 'Plan', $doc['title'] );
		$this->assertSame( '2026-01-01T00:00:00.000Z', $doc['modified'] );
		$this->assertSame( array( 'template' => '1' ), $doc['meta'] );
		$this->assertSame( DOC_VERSION, $doc['version'] );
	}

	public function test_falls_back_to_the_given_id_and_an_empty_title(): void {
		$doc = parse_document( array( 'content' => array() ), 'legacy-1' );

		$this->assertNotNull( $doc );
		$this->assertSame( 'legacy-1', $doc['id'] );
		$this->assertSame( '', $doc['title'] );
		$this->assertSame( array(), $doc['content'] );
	}

	public function test_treats_a_missing_content_member_as_empty(): void {
		$doc = parse_document( array( 'id' => 'a' ) );

		$this->assertNotNull( $doc );
		$this->assertSame( array(), $doc['content'] );
	}

	/**
	 * @param mixed       $value       Candidate document.
	 * @param string|null $fallback_id Fallback id.
	 * @dataProvider unparseable_documents
	 */
	public function test_returns_null_for_unparseable_documents( mixed $value, ?string $fallback_id = null ): void {
		$this->assertNull( parse_document( $value, $fallback_id ) );
	}

	/**
	 * @return array<string, array{0: mixed, 1?: string|null}>
	 */
	public static function unparseable_documents(): array {
		return array(
			'no id at all'       => array( array( 'content' => array() ) ),
			'corrupt content'    => array(
				array(
					'id'      => 'a',
					'content' => 'nope',
				),
			),
			'null'               => array( null ),
			'a string'           => array( 'string' ),
			'an integer'         => array( 7 ),
			'a bool'             => array( true ),
			// An empty-string id does not fall back — the client sends one on
			// create, and the server must notice rather than store a blank id.
			'empty string id'    => array( array( 'id' => '' ), 'fallback' ),
			'empty fallback too' => array( array( 'content' => array() ), '' ),
		);
	}

	public function test_ignores_a_non_string_title_and_a_malformed_meta(): void {
		$doc = parse_document(
			array(
				'id'    => 'a',
				'title' => 7,
				'meta'  => array( 'template' => 1 ),
			)
		);

		$this->assertNotNull( $doc );
		$this->assertSame( '', $doc['title'] );
		$this->assertArrayNotHasKey( 'meta', $doc );
	}

	public function test_preserves_unicode_titles_and_node_names(): void {
		$titles = array(
			'日本語のマインドマップ',
			'Карта мыслей',
			'خريطة ذهنية',
			'Emoji 🧠🗺️ plan',
			"Combining a\u{0301}cute + ZWJ 👩‍💻",
		);

		foreach ( $titles as $title ) {
			$doc = parse_document(
				array(
					'id'      => 'a',
					'title'   => $title,
					'content' => array( array( 0, self::node( array( 'name' => $title ) ) ) ),
				)
			);

			$this->assertNotNull( $doc );
			$this->assertSame( $title, $doc['title'] );
			$this->assertSame( $title, $doc['content'][0][1]['name'] );

			// And through a JSON round trip, the way the repository stores it.
			$json    = \json_encode( to_wire( $doc ), JSON_UNESCAPED_UNICODE );
			$reparse = parse_document( \json_decode( (string) $json, true ) );
			$this->assertNotNull( $reparse );
			$this->assertSame( $title, $reparse['title'] );
			$this->assertSame( $title, $reparse['content'][0][1]['name'] );
		}
	}

	public function test_rejects_a_document_whose_content_holds_a_cycle(): void {
		$this->assertNull(
			parse_document(
				array(
					'id'      => 'a',
					'content' => array(
						array( 'x', self::node( array( 'parent' => 'y' ) ) ),
						array( 'y', self::node( array( 'parent' => 'x' ) ) ),
					),
				)
			)
		);
	}

	/* ---------------------------------------------------------------------
	 * to_wire
	 * ------------------------------------------------------------------ */

	public function test_emits_the_persisted_shape_with_the_current_version(): void {
		$wire = to_wire(
			array(
				'id'      => 'a',
				'title'   => 'T',
				'content' => array(),
				'version' => 999,
			)
		);

		$this->assertSame(
			array(
				'id'      => 'a',
				'title'   => 'T',
				'content' => array(),
				'version' => DOC_VERSION,
			),
			$wire
		);
	}

	public function test_wire_keys_follow_the_contract_order(): void {
		$wire = to_wire(
			array(
				'id'       => '42',
				'title'    => 'Product plan',
				'content'  => array( array( '0', self::node( array( 'name' => 'Root' ) ) ) ),
				'modified' => '2026-08-22T10:00:00+00:00',
				'meta'     => array( 'template' => '0' ),
				'date'     => '2026-08-01T00:00:00+00:00',
			)
		);

		$this->assertSame(
			array( 'id', 'title', 'content', 'modified', 'meta', 'version' ),
			\array_keys( $wire ),
			'`date` is not part of the wire shape.'
		);
	}

	public function test_wire_content_encodes_as_a_json_array(): void {
		$doc = parse_document(
			array(
				'id'      => '1',
				'content' => array( array( '0', self::node( array( 'name' => 'Root' ) ) ) ),
			)
		);

		$this->assertNotNull( $doc );
		$this->assertSame(
			'{"id":"1","title":"","content":[["0",{"name":"Root","x":0,"y":0}]],"version":1}',
			\json_encode( to_wire( $doc ) )
		);
	}

	public function test_wire_survives_a_full_round_trip(): void {
		$original = parse_document(
			array(
				'id'      => '7',
				'title'   => 'Round trip',
				'content' => array(
					array( '0', self::node( array( 'name' => 'Root' ) ) ),
					array(
						'1',
						self::node(
							array(
								'name'      => 'Child',
								'x'         => -12.5,
								'y'         => 3,
								'parent'    => '0',
								'lineShape' => 'smooth',
								'reaction'  => '✅',
							)
						),
					),
				),
				'meta'    => array( 'template' => '1' ),
			)
		);

		$this->assertNotNull( $original );

		$json    = \json_encode( to_wire( $original ) );
		$reparse = parse_document( \json_decode( (string) $json, true ) );

		$this->assertSame( to_wire( $original ), to_wire( (array) $reparse ) );
	}

	/**
	 * @dataProvider provide_storable_colors
	 *
	 * @param string $color A colour the editor emits.
	 */
	public function test_a_node_keeps_a_colour_it_could_have_drawn( string $color ): void {
		$doc = parse_document(
			array(
				'id'      => '1',
				'title'   => 'T',
				'content' => array( array( 'a', array( 'name' => 'n', 'x' => 0, 'y' => 0, 'stroke' => $color ) ) ),
			),
			'1'
		);

		$this->assertSame( $color, $doc['content'][0][1]['stroke'] );
	}

	/**
	 * @return array<string, array{string}>
	 */
	public static function provide_storable_colors(): array {
		return array(
			'short hex'   => array( '#fff' ),
			'short alpha' => array( '#ffff' ),
			'long hex'    => array( '#00ff00' ),
			'long alpha'  => array( '#00ff0080' ),
			'keyword'     => array( 'black' ),
		);
	}

	/**
	 * @dataProvider provide_unstorable_colors
	 *
	 * @param mixed $color A colour that is not one.
	 */
	public function test_a_colour_that_could_close_an_attribute_is_dropped( mixed $color ): void {
		// The exporter writes this into an SVG attribute, so a string that can
		// end one must not reach storage. The node survives without it.
		$doc = parse_document(
			array(
				'id'      => '1',
				'title'   => 'T',
				'content' => array( array( 'a', array( 'name' => 'n', 'x' => 0, 'y' => 0, 'stroke' => $color ) ) ),
			),
			'1'
		);

		$this->assertCount( 1, $doc['content'] );
		$this->assertArrayNotHasKey( 'stroke', $doc['content'][0][1] );
	}

	/**
	 * @return array<string, array{mixed}>
	 */
	public static function provide_unstorable_colors(): array {
		return array(
			'markup'    => array( '#000" /><script>alert(1)</script><path d="' ),
			'a rule'    => array( 'red;background:url(x)' ),
			'a url'     => array( 'url(#x)' ),
			'functional'=> array( 'rgb(0,0,0)' ),
			'a number'  => array( 42 ),
			'null'      => array( null ),
		);
	}
}