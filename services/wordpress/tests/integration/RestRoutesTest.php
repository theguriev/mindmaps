<?php
/**
 * Integration tests for the `mindmaps/v1` routes, run inside a real
 * WordPress with a real database.
 *
 * This is the one place the codebase uses objects: `WP_UnitTestCase`,
 * `WP_REST_Server` and `WP_REST_Request` are WordPress' own API and there is
 * no functional equivalent. The plugin under test stays functional.
 *
 * @package MindMaps
 */

declare(strict_types=1);

namespace MindMaps\Tests\Integration;

use MindMaps\PostType;
use WP_REST_Request;
use WP_REST_Server;
use WP_UnitTestCase;

final class RestRoutesTest extends WP_UnitTestCase {

	private const NS = '/mindmaps/v1';

	private WP_REST_Server $server;

	private int $author;

	private int $other_author;

	private int $subscriber;

	private int $editor;

	private int $contributor;

	public function set_up(): void {
		parent::set_up();

		global $wp_rest_server;
		$wp_rest_server = new WP_REST_Server();
		$this->server   = $wp_rest_server;
		\do_action( 'rest_api_init', $this->server );

		$this->author       = self::factory()->user->create( array( 'role' => 'author' ) );
		$this->other_author = self::factory()->user->create( array( 'role' => 'author' ) );
		$this->subscriber   = self::factory()->user->create( array( 'role' => 'subscriber' ) );
		$this->editor       = self::factory()->user->create( array( 'role' => 'editor' ) );
		$this->contributor  = self::factory()->user->create( array( 'role' => 'contributor' ) );
	}

	public function tear_down(): void {
		global $wp_rest_server;
		$wp_rest_server = null;
		\wp_set_current_user( 0 );

		parent::tear_down();
	}

	/* ---------------------------------------------------------------------
	 * Helpers.
	 * ------------------------------------------------------------------ */

	/**
	 * A small valid document body.
	 *
	 * @param string $title Map title.
	 * @return array<string, mixed>
	 */
	private static function document( string $title = 'Plan' ): array {
		return array(
			'id'      => '',
			'title'   => $title,
			'content' => array(
				array( '0', array( 'name' => 'Root', 'x' => 0, 'y' => 0 ) ),
				array(
					'1',
					array(
						'name'      => 'Child',
						'x'         => -12.5,
						'y'         => 40,
						'parent'    => '0',
						'stroke'    => '#00f',
						'lineShape' => 'smooth',
						'collapsed' => true,
					),
				),
			),
			'meta'    => array( 'template' => '0' ),
			'version' => 1,
		);
	}

	/**
	 * Dispatch a request against the plugin's namespace.
	 *
	 * @param string                    $method HTTP verb.
	 * @param string                    $route  Route below the namespace.
	 * @param array<string, mixed>|null $body   JSON body, if any.
	 */
	private function request( string $method, string $route, ?array $body = null ): \WP_REST_Response {
		$request = new WP_REST_Request( $method, self::NS . $route );
		if ( null !== $body ) {
			$request->set_header( 'content-type', 'application/json' );
			$request->set_body( (string) \wp_json_encode( $body ) );
		}
		return $this->server->dispatch( $request );
	}

	/**
	 * Create a map as a user and return the response data.
	 *
	 * @param int                       $user User id.
	 * @param array<string, mixed>|null $body Document body.
	 * @return array<string, mixed>
	 */
	private function create_as( int $user, ?array $body = null ): array {
		\wp_set_current_user( $user );
		$response = $this->request( 'POST', '/maps', $body ?? self::document() );
		$this->assertSame( 201, $response->get_status(), 'Creating a map should return 201.' );

		return (array) $response->get_data();
	}

	/**
	 * Assert a response is a WP_Error-backed failure with a given code/status.
	 *
	 * @param \WP_REST_Response $response Dispatched response.
	 * @param string            $code     Expected error code.
	 * @param int               $status   Expected HTTP status.
	 */
	private function assert_error( \WP_REST_Response $response, string $code, int $status ): void {
		$this->assertSame( $status, $response->get_status() );
		$data = $response->get_data();
		$this->assertIsArray( $data );
		$this->assertSame( $code, $data['code'] ?? null );
	}

	/* ---------------------------------------------------------------------
	 * Routes exist.
	 * ------------------------------------------------------------------ */

	public function test_registers_the_contracted_routes(): void {
		$routes = $this->server->get_routes();

		$this->assertArrayHasKey( self::NS . '/maps', $routes );
		$this->assertArrayHasKey( self::NS . '/maps/(?P<id>\d+)', $routes );
		$this->assertArrayHasKey( self::NS . '/maps/(?P<id>\d+)/template', $routes );
	}

	/* ---------------------------------------------------------------------
	 * The template flag.
	 * ------------------------------------------------------------------ */

	public function test_flagging_a_template_touches_nothing_but_the_flag(): void {
		$created = $this->create_as( $this->author );
		$id      = (int) $created['id'];
		$before  = \get_post( $id )->post_modified_gmt;

		$response = $this->request( 'PUT', '/maps/' . $id . '/template', array( 'template' => true ) );

		$this->assertSame( 200, $response->get_status() );
		$this->assertSame( array( 'id' => (string) $id, 'template' => true ), (array) $response->get_data() );

		// The map itself is untouched: same content, and — because a star says
		// nothing about the map — the same modified time, so a list ordered by
		// it does not reshuffle when somebody stars a row.
		$map = (array) $this->request( 'GET', '/maps/' . $id )->get_data();
		$this->assertSame( '1', $map['meta']['template'] );
		$this->assertCount( 2, $map['content'] );
		$this->assertSame( $before, \get_post( $id )->post_modified_gmt );

		$this->request( 'PUT', '/maps/' . $id . '/template', array( 'template' => false ) );
		$this->assertSame(
			'0',
			( (array) $this->request( 'GET', '/maps/' . $id )->get_data() )['meta']['template']
		);
	}

	/**
	 * @dataProvider provide_non_boolean_flags
	 *
	 * @param mixed $flag Candidate flag value.
	 */
	public function test_a_flag_that_is_not_a_boolean_is_rejected( mixed $flag ): void {
		$created = $this->create_as( $this->author );

		$response = $this->request(
			'PUT',
			'/maps/' . (int) $created['id'] . '/template',
			array( 'template' => $flag )
		);

		$this->assert_error( $response, 'mindmap_invalid_document', 400 );
	}

	/**
	 * @return array<string, array{mixed}>
	 */
	public static function provide_non_boolean_flags(): array {
		return array(
			'the string the flag is stored as' => array( '1' ),
			'a number'                         => array( 1 ),
			'null'                             => array( null ),
			'an object'                        => array( array( 'on' => true ) ),
		);
	}

	public function test_one_user_cannot_flag_anothers_map(): void {
		$created = $this->create_as( $this->author );
		\wp_set_current_user( $this->other_author );

		$response = $this->request(
			'PUT',
			'/maps/' . (int) $created['id'] . '/template',
			array( 'template' => true )
		);

		$this->assert_error( $response, 'mindmap_forbidden', 403 );
	}

	public function test_no_route_is_publicly_readable(): void {
		foreach ( $this->server->get_routes() as $route => $handlers ) {
			// The bare namespace index is core's own route, not the plugin's.
			if ( ! \str_starts_with( $route, self::NS . '/' ) ) {
				continue;
			}
			foreach ( $handlers as $handler ) {
				$this->assertNotSame(
					'__return_true',
					$handler['permission_callback'] ?? null,
					"Route {$route} must check a real capability."
				);
			}
		}
	}

	/* ---------------------------------------------------------------------
	 * Authentication and authorization.
	 * ------------------------------------------------------------------ */

	public function test_an_unauthenticated_request_is_rejected(): void {
		$map_id = (int) $this->create_as( $this->author )['id'];
		\wp_set_current_user( 0 );

		// Reading one published map is the single thing a signed-out visitor
		// may do, and it has a test of its own. Everything else is shut: no
		// listing somebody's maps, and no writing of any kind.
		$this->assert_error( $this->request( 'GET', '/maps' ), 'mindmap_forbidden', 403 );
		$this->assert_error( $this->request( 'POST', '/maps', self::document() ), 'mindmap_forbidden', 403 );
		$this->assert_error( $this->request( 'PUT', '/maps/' . $map_id, self::document() ), 'mindmap_forbidden', 403 );
		$this->assert_error(
			$this->request( 'PUT', '/maps/' . $map_id . '/template', array( 'template' => true ) ),
			'mindmap_forbidden',
			403
		);
		$this->assert_error( $this->request( 'DELETE', '/maps/' . $map_id ), 'mindmap_forbidden', 403 );

		$this->assertSame( 'Plan', \get_post( $map_id )->post_title );
	}

	public function test_a_subscriber_cannot_create_a_map(): void {
		\wp_set_current_user( $this->subscriber );

		$this->assert_error(
			$this->request( 'POST', '/maps', self::document() ),
			'mindmap_forbidden',
			403
		);
		$this->assertSame( 0, ( new \WP_Query( array( 'post_type' => PostType\POST_TYPE ) ) )->found_posts );
	}

	public function test_one_user_cannot_write_another_users_map(): void {
		$map_id = (int) $this->create_as( $this->author )['id'];

		\wp_set_current_user( $this->other_author );

		// Reading is allowed — the map is published, and published maps are
		// what the shortcode and the block put in front of readers. Writing is
		// the part that stays the author's.
		$this->assertSame( 200, $this->request( 'GET', '/maps/' . $map_id )->get_status() );
		$this->assert_error(
			$this->request( 'PUT', '/maps/' . $map_id, self::document( 'Hijacked' ) ),
			'mindmap_forbidden',
			403
		);
		$this->assert_error(
			$this->request( 'PUT', '/maps/' . $map_id . '/template', array( 'template' => true ) ),
			'mindmap_forbidden',
			403
		);
		$this->assert_error( $this->request( 'DELETE', '/maps/' . $map_id ), 'mindmap_forbidden', 403 );

		// And nothing changed.
		$this->assertSame( 'Plan', \get_post( $map_id )->post_title );
	}

	/* ---------------------------------------------------------------------
	 * Signed-out readers.
	 * ------------------------------------------------------------------ */

	public function test_a_signed_out_visitor_can_read_a_published_map(): void {
		// The case the shortcode and the block exist for: a map embedded in a
		// post, read by the people the post was written for.
		$map_id = (int) $this->create_as( $this->author )['id'];

		\wp_set_current_user( 0 );
		$response = $this->request( 'GET', '/maps/' . $map_id );

		$this->assertSame( 200, $response->get_status() );
		$data = (array) $response->get_data();
		$this->assertSame( 'Plan', $data['title'] );
		$this->assertCount( 2, $data['content'] );
	}

	public function test_a_signed_out_visitor_cannot_read_an_unpublished_map(): void {
		// A contributor's map is created as a draft, and a draft is not a
		// thing anyone put in front of readers.
		$map_id = (int) $this->create_as( $this->contributor )['id'];
		$this->assertSame( 'draft', \get_post( $map_id )->post_status );

		\wp_set_current_user( 0 );

		$this->assert_error( $this->request( 'GET', '/maps/' . $map_id ), 'mindmap_forbidden', 403 );
	}

	public function test_one_user_still_cannot_read_anothers_draft(): void {
		$map_id = (int) $this->create_as( $this->contributor )['id'];

		\wp_set_current_user( $this->other_author );

		$this->assert_error( $this->request( 'GET', '/maps/' . $map_id ), 'mindmap_forbidden', 403 );
	}

	public function test_an_editor_may_read_someone_elses_map(): void {
		$map_id = (int) $this->create_as( $this->author )['id'];

		\wp_set_current_user( $this->editor );
		$response = $this->request( 'GET', '/maps/' . $map_id );

		$this->assertSame( 200, $response->get_status() );
		$this->assertSame( 'Plan', $response->get_data()['title'] );
	}

	/* ---------------------------------------------------------------------
	 * The happy path.
	 * ------------------------------------------------------------------ */

	public function test_an_author_can_create_read_update_and_delete_their_own_map(): void {
		$created = $this->create_as( $this->author );
		$map_id  = (int) $created['id'];

		$this->assertSame( 'Plan', $created['title'] );
		$this->assertSame( 1, $created['version'] );
		$this->assertSame( array( 'template' => '0' ), $created['meta'] );
		$this->assertNotEmpty( $created['modified'] );
		$this->assertSame( $this->author, (int) \get_post( $map_id )->post_author );
		$this->assertSame( PostType\POST_TYPE, \get_post( $map_id )->post_type );

		// Read.
		$read = $this->request( 'GET', '/maps/' . $map_id );
		$this->assertSame( 200, $read->get_status() );
		$this->assertSame( $created['content'], $read->get_data()['content'] );

		// Update.
		$updated_doc          = self::document( 'Plan v2' );
		$updated_doc['meta']  = array( 'template' => '1' );
		$updated_doc['content'][] = array( '2', array( 'name' => 'Third', 'x' => 10, 'y' => 20, 'parent' => '1' ) );

		$updated = $this->request( 'PUT', '/maps/' . $map_id, $updated_doc );
		$this->assertSame( 200, $updated->get_status() );
		$this->assertSame( 'Plan v2', $updated->get_data()['title'] );
		$this->assertSame( array( 'template' => '1' ), $updated->get_data()['meta'] );
		$this->assertCount( 3, $updated->get_data()['content'] );
		$this->assertSame( 'Plan v2', \get_post( $map_id )->post_title );

		// List.
		$list = $this->request( 'GET', '/maps' );
		$this->assertSame( 200, $list->get_status() );
		$this->assertCount( 1, $list->get_data() );
		$this->assertSame( (string) $map_id, $list->get_data()[0]['id'] );

		// Delete.
		$deleted = $this->request( 'DELETE', '/maps/' . $map_id );
		$this->assertSame( 200, $deleted->get_status() );
		$this->assertSame(
			array(
				'deleted' => true,
				'id'      => (string) $map_id,
			),
			$deleted->get_data()
		);
		$this->assertNull( \get_post( $map_id ) );
		$this->assert_error( $this->request( 'GET', '/maps/' . $map_id ), 'mindmap_not_found', 404 );
	}

	public function test_the_list_is_scoped_to_what_the_caller_may_see(): void {
		$mine   = (int) $this->create_as( $this->author, self::document( 'Mine' ) )['id'];
		$theirs = (int) $this->create_as( $this->other_author, self::document( 'Theirs' ) )['id'];

		\wp_set_current_user( $this->author );
		$ids = \array_column( (array) $this->request( 'GET', '/maps' )->get_data(), 'id' );
		$this->assertSame( array( (string) $mine ), $ids );

		\wp_set_current_user( $this->editor );
		$ids = \array_column( (array) $this->request( 'GET', '/maps' )->get_data(), 'id' );
		\sort( $ids );
		$expected = array( (string) $mine, (string) $theirs );
		\sort( $expected );
		$this->assertSame( $expected, $ids );
	}

	public function test_a_created_document_round_trips_byte_for_byte(): void {
		$body = self::document( 'Sürvïve 🧠 the round trip' );
		$body['content'][] = array(
			'2',
			array(
				'name'        => "# Markdown\n\nwith a \"quote\", a \\ backslash and </script>",
				'x'           => 1234.5678,
				'y'           => -0.25,
				'parent'      => '0',
				'strokeWidth' => 3,
				'lineStyle'   => 'dashed',
				'width'       => 320,
				'height'      => 96,
				'sticky'      => true,
				'reaction'    => '👍',
			),
		);

		$created = $this->create_as( $this->author, $body );
		$fetched = $this->request( 'GET', '/maps/' . (int) $created['id'] )->get_data();

		$this->assertSame( $body['content'], $created['content'] );
		$this->assertSame( $body['content'], $fetched['content'] );
		$this->assertSame( 'Sürvïve 🧠 the round trip', $fetched['title'] );
		$this->assertSame( 'Sürvïve 🧠 the round trip', \get_post( (int) $created['id'] )->post_title );
	}

	/* ---------------------------------------------------------------------
	 * Failure modes.
	 * ------------------------------------------------------------------ */

	/**
	 * @return array<string, array{0: mixed}>
	 */
	public static function invalid_documents(): array {
		$node = array( 'name' => 'n', 'x' => 0, 'y' => 0 );

		return array(
			'content is a string'   => array( array( 'content' => 'nope' ) ),
			'entry is not a pair'   => array( array( 'content' => array( array( 'a' ) ) ) ),
			'coordinate is a word'  => array( array( 'content' => array( array( 'a', array( 'name' => 'n', 'x' => 'far', 'y' => 0 ) ) ) ) ),
			'duplicate node ids'    => array( array( 'content' => array( array( 'a', $node ), array( 'a', $node ) ) ) ),
			'parents form a cycle'  => array(
				array(
					'content' => array(
						array( 'a', array( 'name' => 'n', 'x' => 0, 'y' => 0, 'parent' => 'b' ) ),
						array( 'b', array( 'name' => 'n', 'x' => 0, 'y' => 0, 'parent' => 'a' ) ),
					),
				),
			),
		);
	}

	/**
	 * @param mixed $body Invalid document body.
	 * @dataProvider invalid_documents
	 */
	public function test_an_invalid_document_is_rejected_on_create_and_update( mixed $body ): void {
		\wp_set_current_user( $this->author );

		$this->assert_error(
			$this->request( 'POST', '/maps', (array) $body ),
			'mindmap_invalid_document',
			400
		);

		$map_id = (int) $this->create_as( $this->author )['id'];
		$this->assert_error(
			$this->request( 'PUT', '/maps/' . $map_id, (array) $body ),
			'mindmap_invalid_document',
			400
		);

		// The stored map is untouched.
		$this->assertSame( 'Plan', $this->request( 'GET', '/maps/' . $map_id )->get_data()['title'] );
	}

	public function test_a_missing_map_is_a_404(): void {
		\wp_set_current_user( $this->author );
		$ghost = 999999;

		$this->assert_error( $this->request( 'GET', '/maps/' . $ghost ), 'mindmap_not_found', 404 );
		$this->assert_error( $this->request( 'PUT', '/maps/' . $ghost, self::document() ), 'mindmap_not_found', 404 );
		$this->assert_error( $this->request( 'DELETE', '/maps/' . $ghost ), 'mindmap_not_found', 404 );
	}

	public function test_a_post_of_another_type_is_not_a_map(): void {
		$post_id = self::factory()->post->create( array( 'post_author' => $this->author ) );

		\wp_set_current_user( $this->author );
		$this->assert_error( $this->request( 'GET', '/maps/' . $post_id ), 'mindmap_not_found', 404 );
		$this->assert_error( $this->request( 'DELETE', '/maps/' . $post_id ), 'mindmap_not_found', 404 );
		$this->assertNotNull( \get_post( $post_id ), 'A foreign post must not be deleted.' );
	}

	/**
	 * @return array<string, array{0: string}>
	 */
	public static function corrupt_meta(): array {
		return array(
			'not json'          => array( 'not json at all' ),
			'json but an object'=> array( '{"nodes":[]}' ),
			'json but a number' => array( '42' ),
			'cyclic parents'    => array( '[["a",{"name":"n","x":0,"y":0,"parent":"b"}],["b",{"name":"n","x":0,"y":0,"parent":"a"}]]' ),
			'infinite x'        => array( '[["a",{"name":"n","x":1e999,"y":0}]]' ),
			'truncated'         => array( '[["a",{"name":"n","x":0,' ),
		);
	}

	/**
	 * @param string $stored Raw meta value written behind the plugin's back.
	 * @dataProvider corrupt_meta
	 */
	public function test_a_stored_corrupt_map_degrades_gracefully( string $stored ): void {
		$map_id = (int) $this->create_as( $this->author )['id'];
		\update_post_meta( $map_id, PostType\META_CONTENT, \wp_slash( $stored ) );

		$response = $this->request( 'GET', '/maps/' . $map_id );

		$this->assertSame( 200, $response->get_status(), 'A corrupt map must not break the endpoint.' );
		$this->assertSame( array(), $response->get_data()['content'] );
		$this->assertSame( 'Plan', $response->get_data()['title'] );

		// And it must not poison the list either.
		$list = $this->request( 'GET', '/maps' );
		$this->assertSame( 200, $list->get_status() );
		$this->assertCount( 1, $list->get_data() );
		$this->assertSame( array(), $list->get_data()[0]['content'] );
	}

	public function test_a_create_body_that_is_not_an_object_is_rejected(): void {
		\wp_set_current_user( $this->author );

		$request = new WP_REST_Request( 'POST', self::NS . '/maps' );
		$request->set_header( 'content-type', 'application/json' );
		$request->set_body( '"just a string"' );

		$this->assert_error( $this->server->dispatch( $request ), 'mindmap_invalid_document', 400 );
	}

	public function test_an_infinite_coordinate_never_reaches_the_database(): void {
		\wp_set_current_user( $this->author );

		// `1e999` cannot be expressed as a PHP float this test could encode, so
		// the JSON goes in raw — exactly as a hostile client would send it.
		$request = new WP_REST_Request( 'POST', self::NS . '/maps' );
		$request->set_header( 'content-type', 'application/json' );
		$request->set_body( '{"title":"Boom","content":[["a",{"name":"n","x":1e999,"y":0}]]}' );

		$this->assert_error( $this->server->dispatch( $request ), 'mindmap_invalid_document', 400 );
		$this->assertSame( 0, ( new \WP_Query( array( 'post_type' => PostType\POST_TYPE ) ) )->found_posts );
	}

	public function test_the_route_id_wins_over_a_body_that_disagrees(): void {
		$mine   = (int) $this->create_as( $this->author, self::document( 'Mine' ) )['id'];
		$theirs = (int) $this->create_as( $this->other_author, self::document( 'Theirs' ) )['id'];

		\wp_set_current_user( $this->author );
		$body       = self::document( 'Renamed' );
		$body['id'] = (string) $theirs;

		$response = $this->request( 'PUT', '/maps/' . $mine, $body );

		$this->assertSame( 200, $response->get_status() );
		$this->assertSame( (string) $mine, $response->get_data()['id'] );
		$this->assertSame( 'Renamed', \get_post( $mine )->post_title );
		$this->assertSame( 'Theirs', \get_post( $theirs )->post_title );
	}

	/* ---------------------------------------------------------------------
	 * A creator must be able to save what they created.
	 * ------------------------------------------------------------------ */

	public function test_a_contributor_can_create_read_update_and_delete_their_own_map(): void {
		\wp_set_current_user( $this->contributor );

		$created = $this->request( 'POST', '/maps', self::document( 'Contribution' ) );
		$this->assertSame( 201, $created->get_status(), 'A contributor has edit_posts, so POST is allowed.' );
		$map_id = (int) $created->get_data()['id'];

		// The map must land in a status its own author can still edit: with
		// map_meta_cap, edit_post/delete_post on a *published* post resolve to
		// edit_published_posts/delete_published_posts, which a contributor
		// does not have — so publishing it would make every later write 403.
		$this->assertSame( 'draft', \get_post( $map_id )->post_status );
		$this->assertTrue( \current_user_can( 'edit_post', $map_id ) );
		$this->assertTrue( \current_user_can( 'delete_post', $map_id ) );

		// Read.
		$read = $this->request( 'GET', '/maps/' . $map_id );
		$this->assertSame( 200, $read->get_status() );
		$this->assertCount( 2, $read->get_data()['content'] );

		// It is listed, draft status and all.
		$list = $this->request( 'GET', '/maps' );
		$this->assertSame( 200, $list->get_status() );
		$this->assertSame( array( (string) $map_id ), \array_column( (array) $list->get_data(), 'id' ) );

		// Save.
		$updated = $this->request( 'PUT', '/maps/' . $map_id, self::document( 'Contribution v2' ) );
		$this->assertSame( 200, $updated->get_status(), 'A contributor must be able to save their own map.' );
		$this->assertSame( 'Contribution v2', $updated->get_data()['title'] );
		$this->assertSame( 'Contribution v2', \get_post( $map_id )->post_title );

		// Delete.
		$deleted = $this->request( 'DELETE', '/maps/' . $map_id );
		$this->assertSame( 200, $deleted->get_status(), 'A contributor must be able to delete their own map.' );
		$this->assertNull( \get_post( $map_id ) );
	}

	public function test_a_creator_who_may_publish_still_gets_a_published_map(): void {
		$map_id = (int) $this->create_as( $this->author )['id'];

		$this->assertSame( 'publish', \get_post( $map_id )->post_status );
	}

	public function test_one_contributor_still_cannot_touch_anothers_map(): void {
		$map_id = (int) $this->create_as( $this->contributor )['id'];
		$other  = self::factory()->user->create( array( 'role' => 'contributor' ) );

		\wp_set_current_user( $other );
		$this->assert_error( $this->request( 'GET', '/maps/' . $map_id ), 'mindmap_forbidden', 403 );
		$this->assert_error(
			$this->request( 'PUT', '/maps/' . $map_id, self::document( 'Hijacked' ) ),
			'mindmap_forbidden',
			403
		);
		$this->assert_error( $this->request( 'DELETE', '/maps/' . $map_id ), 'mindmap_forbidden', 403 );
		$this->assertSame( 'Plan', \get_post( $map_id )->post_title );
	}

	/* ---------------------------------------------------------------------
	 * PUT is a full replace, so PATCH must not be routed to it.
	 * ------------------------------------------------------------------ */

	public function test_patch_is_not_routed_and_cannot_wipe_a_map(): void {
		$map_id = (int) $this->create_as( $this->author )['id'];
		\wp_set_current_user( $this->author );

		$handlers = $this->server->get_routes()[ self::NS . '/maps/(?P<id>\d+)' ];
		foreach ( $handlers as $handler ) {
			$this->assertEmpty(
				$handler['methods']['PATCH'] ?? null,
				'handle_update() is a full replace; PATCH must not reach it.'
			);
		}

		// `PATCH {"title": …}` used to answer 200 and leave the document empty.
		$patched = $this->request( 'PATCH', '/maps/' . $map_id, array( 'title' => 'Wiped' ) );
		$this->assertSame( 404, $patched->get_status() );
		$this->assertSame( 'rest_no_route', $patched->get_data()['code'] ?? null );

		$after = $this->request( 'GET', '/maps/' . $map_id )->get_data();
		$this->assertSame( 'Plan', $after['title'] );
		$this->assertCount( 2, $after['content'], 'A rejected PATCH must not empty the document.' );

		// PUT is unaffected.
		$put = $this->request( 'PUT', '/maps/' . $map_id, self::document( 'Plan v2' ) );
		$this->assertSame( 200, $put->get_status() );
		$this->assertSame( 'Plan v2', $put->get_data()['title'] );
		$this->assertCount( 2, $put->get_data()['content'] );
	}

	/* ---------------------------------------------------------------------
	 * A JSON object is not a JSON array, whatever PHP decodes it into.
	 * ------------------------------------------------------------------ */

	/**
	 * @return array<string, array{0: string}>
	 */
	public static function object_shaped_bodies(): array {
		$node = '{"name":"n","x":0,"y":0}';

		return array(
			'content is an object'         => array( '{"title":"Sneaky","content":{}}' ),
			// Decoded associatively — which is what `get_json_params()` does —
			// this one becomes a PHP list and sails past `array_is_list()`.
			'content is a numbered object' => array( '{"title":"Sneaky","content":{"0":["a",' . $node . '],"1":["b",' . $node . ']}}' ),
			'an entry is an object'        => array( '{"title":"Sneaky","content":[{"0":"a","1":' . $node . '}]}' ),
		);
	}

	/**
	 * @param string $body Raw JSON body.
	 * @dataProvider object_shaped_bodies
	 */
	public function test_object_shaped_content_is_rejected_on_create_and_update( string $body ): void {
		\wp_set_current_user( $this->author );

		$create = new WP_REST_Request( 'POST', self::NS . '/maps' );
		$create->set_header( 'content-type', 'application/json' );
		$create->set_body( $body );
		$this->assert_error( $this->server->dispatch( $create ), 'mindmap_invalid_document', 400 );
		$this->assertSame( 0, ( new \WP_Query( array( 'post_type' => PostType\POST_TYPE ) ) )->found_posts );

		$map_id = (int) $this->create_as( $this->author )['id'];
		$update = new WP_REST_Request( 'PUT', self::NS . '/maps/' . $map_id );
		$update->set_header( 'content-type', 'application/json' );
		$update->set_body( $body );
		$this->assert_error( $this->server->dispatch( $update ), 'mindmap_invalid_document', 400 );

		// And the stored map is untouched.
		$this->assertCount( 2, $this->request( 'GET', '/maps/' . $map_id )->get_data()['content'] );
	}

	public function test_object_shaped_stored_meta_degrades_to_an_empty_document(): void {
		$map_id = (int) $this->create_as( $this->author )['id'];
		\update_post_meta(
			$map_id,
			PostType\META_CONTENT,
			\wp_slash( '{"0":["a",{"name":"n","x":0,"y":0}]}' )
		);

		$response = $this->request( 'GET', '/maps/' . $map_id );

		$this->assertSame( 200, $response->get_status() );
		$this->assertSame( array(), $response->get_data()['content'] );
	}

	public function test_the_post_type_is_invisible_to_core_rest(): void {
		$post_type = \get_post_type_object( PostType\POST_TYPE );

		$this->assertNotNull( $post_type );
		$this->assertFalse( $post_type->public );
		$this->assertFalse( $post_type->show_in_rest );
		$this->assertTrue( $post_type->map_meta_cap );
	}
}
