<?php
/**
 * The `mindmaps/v1` REST surface — see `docs/wordpress-contract.md`.
 *
 *   GET    /maps       → MapDoc[]   (newest first, capped at 100)
 *   POST   /maps       → MapDoc
 *   GET    /maps/{id}  → MapDoc
 *   PUT    /maps/{id}  → MapDoc
 *   DELETE /maps/{id}  → { deleted: true, id }
 *
 * Handlers stay thin on purpose: validate, call the repository, respond. All
 * the judgement lives in `document.php` (what a document may contain) and in
 * the permission callbacks (who may touch it).
 *
 * @package MindMaps
 */

declare(strict_types=1);

namespace MindMaps\Rest;

defined( 'ABSPATH' ) || exit;

use MindMaps\Document;
use MindMaps\Repository;
use WP_Error;
use WP_REST_Request;

/** REST namespace. */
const REST_NAMESPACE = 'mindmaps/v1';

/** Maximum number of maps a list request returns. */
const LIST_LIMIT = 100;

/**
 * Register every route. Hooked to `rest_api_init`.
 */
function register_routes(): void {
	\register_rest_route(
		REST_NAMESPACE,
		'/maps',
		array(
			array(
				'methods'             => 'GET',
				'callback'            => __NAMESPACE__ . '\\handle_list',
				'permission_callback' => __NAMESPACE__ . '\\can_list_maps',
			),
			array(
				'methods'             => 'POST',
				'callback'            => __NAMESPACE__ . '\\handle_create',
				'permission_callback' => __NAMESPACE__ . '\\can_create_map',
			),
		)
	);

	$id_arg = array(
		'id' => array(
			'description'       => \__( 'The map id (a WordPress post id).', 'mind-maps' ),
			'type'              => 'integer',
			'required'          => true,
			'sanitize_callback' => 'absint',
		),
	);

	\register_rest_route(
		REST_NAMESPACE,
		'/maps/(?P<id>\d+)',
		array(
			array(
				'methods'             => 'GET',
				'callback'            => __NAMESPACE__ . '\\handle_get',
				'permission_callback' => __NAMESPACE__ . '\\can_read_map',
				'args'                => $id_arg,
			),
			array(
				// PUT only. `handle_update()` is a full replace — it writes the
				// document it was handed, whole — so accepting PATCH as well
				// would turn `PATCH {"title":"x"}` into a silent 200 that wipes
				// the map's content. See `docs/wordpress-contract.md`.
				'methods'             => 'PUT',
				'callback'            => __NAMESPACE__ . '\\handle_update',
				'permission_callback' => __NAMESPACE__ . '\\can_edit_map',
				'args'                => $id_arg,
			),
			array(
				'methods'             => 'DELETE',
				'callback'            => __NAMESPACE__ . '\\handle_delete',
				'permission_callback' => __NAMESPACE__ . '\\can_delete_map',
				'args'                => $id_arg,
			),
		)
	);

	\register_rest_route(
		REST_NAMESPACE,
		'/maps/(?P<id>\d+)/template',
		array(
			array(
				'methods'             => 'PUT',
				'callback'            => __NAMESPACE__ . '\\handle_set_template',
				// The same capability a full update needs: this writes to the
				// map, and a narrower route is not a weaker gate.
				'permission_callback' => __NAMESPACE__ . '\\can_edit_map',
				'args'                => $id_arg,
			),
		)
	);
}

// --------------------------------------------------------------------------
// Errors — stable codes the client branches on.
// --------------------------------------------------------------------------

/**
 * 400: the payload is not a valid document.
 */
function error_invalid_document(): WP_Error {
	return new WP_Error(
		'mindmap_invalid_document',
		\__( 'The map document is not valid.', 'mind-maps' ),
		array( 'status' => 400 )
	);
}

/**
 * 403: the user may not touch this map.
 */
function error_forbidden(): WP_Error {
	return new WP_Error(
		'mindmap_forbidden',
		\__( 'You are not allowed to do that with this mind map.', 'mind-maps' ),
		array( 'status' => 403 )
	);
}

/**
 * 404: no such map, or not a `mind_map` post.
 */
function error_not_found(): WP_Error {
	return new WP_Error(
		'mindmap_not_found',
		\__( 'No mind map with that id.', 'mind-maps' ),
		array( 'status' => 404 )
	);
}

// --------------------------------------------------------------------------
// Permissions — real capabilities, never `__return_true`.
// --------------------------------------------------------------------------

/**
 * True when the current user may see someone else's maps.
 */
function can_read_others(): bool {
	return \current_user_can( 'edit_others_posts' );
}

/**
 * Whether the current user may read a given map post.
 *
 * @param int $author_id The map's author.
 */
function owns_or_supervises( int $author_id ): bool {
	$user_id = \get_current_user_id();
	return ( $user_id > 0 && $user_id === $author_id ) || can_read_others();
}

/**
 * GET /maps — any reader; the list itself is scoped to what they may see.
 *
 * @return true|WP_Error
 */
function can_list_maps(): bool|WP_Error {
	return \current_user_can( 'read' ) ? true : error_forbidden();
}

/**
 * POST /maps.
 *
 * @return true|WP_Error
 */
function can_create_map(): bool|WP_Error {
	return \current_user_can( 'edit_posts' ) ? true : error_forbidden();
}

/**
 * GET /maps/{id} — own map, or `edit_others_posts`.
 *
 * @param WP_REST_Request $request Incoming request.
 * @return true|WP_Error
 */
function can_read_map( WP_REST_Request $request ): bool|WP_Error {
	$post = Repository\find_map_post( request_id( $request ) );
	if ( null === $post ) {
		return error_not_found();
	}

	// A published map is readable by anyone, signed in or not.
	//
	// This is what makes the shortcode and the block worth having: a map put
	// into a post is meant to be seen by whoever reads the post, and most of
	// them are not logged in. Requiring `read` here meant every embed on a
	// public site rendered "You do not have permission to open this mind map"
	// to its actual audience.
	//
	// Reading is all it grants. Writing still needs `edit_post` on the map,
	// and a signed-out visitor has no nonce, so the app puts the editor in
	// read-only mode — the map can be panned, zoomed, folded and exported,
	// and nothing that changes it can reach the API.
	if ( 'publish' === $post->post_status ) {
		return true;
	}

	// Everything else — a contributor's draft, a private map, one pending
	// review — keeps the old rule: your own, or an editor's view of everyone's.
	if ( ! \current_user_can( 'read' ) ) {
		return error_forbidden();
	}
	return owns_or_supervises( (int) $post->post_author ) ? true : error_forbidden();
}

/**
 * PUT /maps/{id}.
 *
 * @param WP_REST_Request $request Incoming request.
 * @return true|WP_Error
 */
function can_edit_map( WP_REST_Request $request ): bool|WP_Error {
	if ( ! \current_user_can( 'edit_posts' ) ) {
		return error_forbidden();
	}
	$id = request_id( $request );
	if ( null === Repository\find_map_post( $id ) ) {
		return error_not_found();
	}
	return \current_user_can( 'edit_post', $id ) ? true : error_forbidden();
}

/**
 * DELETE /maps/{id}.
 *
 * @param WP_REST_Request $request Incoming request.
 * @return true|WP_Error
 */
function can_delete_map( WP_REST_Request $request ): bool|WP_Error {
	if ( ! \current_user_can( 'edit_posts' ) ) {
		return error_forbidden();
	}
	$id = request_id( $request );
	if ( null === Repository\find_map_post( $id ) ) {
		return error_not_found();
	}
	return \current_user_can( 'delete_post', $id ) ? true : error_forbidden();
}

// --------------------------------------------------------------------------
// Handlers.
// --------------------------------------------------------------------------

/**
 * GET /maps.
 *
 * @param WP_REST_Request $request Incoming request.
 */
function handle_list( WP_REST_Request $request ) {
	unset( $request );

	$author = can_read_others() ? null : \get_current_user_id();
	$docs   = Repository\list_maps( LIST_LIMIT, $author );

	return \rest_ensure_response( \array_map( 'MindMaps\\Document\\to_wire', $docs ) );
}

/**
 * POST /maps. The client sends a document with a placeholder id; WordPress
 * owns the real one, so the incoming id is dropped before validation.
 *
 * @param WP_REST_Request $request Incoming request.
 */
function handle_create( WP_REST_Request $request ) {
	// The incoming id is overwritten rather than trusted; WordPress assigns the
	// real one a moment later and `handle_create` never reads this placeholder.
	$doc = Document\parse_document( with_id( json_body( $request ), 'new' ), 'new' );
	if ( null === $doc ) {
		return error_invalid_document();
	}

	$post_id = Repository\create_map( $doc, \get_current_user_id() );
	if ( \is_wp_error( $post_id ) ) {
		return $post_id;
	}

	return respond_with_map( $post_id, 201 );
}

/**
 * GET /maps/{id}.
 *
 * @param WP_REST_Request $request Incoming request.
 */
function handle_get( WP_REST_Request $request ) {
	return respond_with_map( request_id( $request ) );
}

/**
 * PUT /maps/{id}.
 *
 * @param WP_REST_Request $request Incoming request.
 */
function handle_update( WP_REST_Request $request ) {
	$id = request_id( $request );

	// The route's id is authoritative; a body that disagrees does not get a vote.
	$doc = Document\parse_document( with_id( json_body( $request ), (string) $id ), (string) $id );
	if ( null === $doc ) {
		return error_invalid_document();
	}

	$result = Repository\update_map( $id, $doc );
	if ( \is_wp_error( $result ) ) {
		return $result;
	}

	return respond_with_map( $id );
}

/**
 * PUT /maps/{id}/template. Marks a map as a template, or stops.
 *
 * One bit, on its own route, because the caller is a list row: it holds a
 * title and a picture, not a document, and there is nothing for it to PUT.
 * Sending the whole map to move a flag is what made starring a map somebody
 * had edited elsewhere quietly revert them.
 *
 * @param WP_REST_Request $request Incoming request.
 */
function handle_set_template( WP_REST_Request $request ) {
	$id = request_id( $request );

	// A JSON body decodes to `stdClass`, so it is read through `member()` like
	// every other one here.
	$template = Document\member( json_body( $request ), 'template' );

	// Only the two values the contract names. Anything else — a string, a
	// missing key, `null` — is a caller that does not know what it is asking
	// for, and guessing on its behalf writes the wrong flag.
	if ( ! \is_bool( $template ) ) {
		return error_invalid_document();
	}

	if ( null === \get_post( $id ) ) {
		return error_not_found();
	}

	Repository\set_template( $id, $template );

	return \rest_ensure_response(
		array(
			'id'       => (string) $id,
			'template' => $template,
		)
	);
}

/**
 * DELETE /maps/{id}.
 *
 * @param WP_REST_Request $request Incoming request.
 */
function handle_delete( WP_REST_Request $request ) {
	$id = request_id( $request );
	if ( ! Repository\delete_map( $id ) ) {
		return error_not_found();
	}

	return \rest_ensure_response(
		array(
			'deleted' => true,
			'id'      => (string) $id,
		)
	);
}

// --------------------------------------------------------------------------
// Small shared helpers.
// --------------------------------------------------------------------------

/**
 * The request body, decoded the way the validator needs to see it.
 *
 * Deliberately not `WP_REST_Request::get_json_params()`: that decodes with
 * `json_decode( …, true )`, which flattens JSON objects into PHP associative
 * arrays — and `{"0":[…],"1":[…]}` then arrives as something `array_is_list()`
 * calls a list, letting an object-shaped `content` through a check the
 * TypeScript validator's `Array.isArray` would have failed. Decoding objects
 * as `stdClass` keeps the two shapes apart.
 *
 * @param WP_REST_Request $request Incoming request.
 */
function json_body( WP_REST_Request $request ) {
	$content_type = $request->get_content_type();
	$media_type   = \is_array( $content_type ) ? (string) ( $content_type['value'] ?? '' ) : '';
	// Same gate `get_json_params()` applies: a body only counts as a document
	// when the client says it is JSON.
	if ( 'application/json' !== $media_type && 'application/ld+json' !== $media_type ) {
		return null;
	}

	return Document\decode_json( $request->get_body() );
}

/**
 * Stamp an id onto a decoded body, whatever shape it arrived in.
 *
 * Anything that is not a record is passed through untouched, so a body of
 * `"just a string"` still fails validation instead of being wrapped into
 * something that passes.
 *
 * @param mixed  $payload Decoded request body.
 * @param string $id      Id the server has decided on.
 */
function with_id( mixed $payload, string $id ): mixed {
	if ( $payload instanceof \stdClass ) {
		$payload->id = $id;
		return $payload;
	}
	if ( \is_array( $payload ) ) {
		$payload['id'] = $id;
		return $payload;
	}
	return $payload;
}

/**
 * The `id` path parameter as a post id.
 *
 * Read from the URL params on purpose, not through `$request['id']`: for a
 * request with a JSON body, WordPress resolves parameters JSON-first, so a body
 * that carries an `id` (every document does) would otherwise decide which post
 * the permission check and the write target. The route is the only authority.
 *
 * @param WP_REST_Request $request Incoming request.
 */
function request_id( WP_REST_Request $request ): int {
	$url_params = $request->get_url_params();
	return \absint( $url_params['id'] ?? 0 );
}

/**
 * Read a map back after a write and return it on the wire — the client treats
 * the response as the new truth, so it must be what was actually stored.
 *
 * @param int $id     Post id.
 * @param int $status HTTP status for the response.
 */
function respond_with_map( int $id, int $status = 200 ) {
	$doc = Repository\find_map( $id );
	if ( null === $doc ) {
		return error_not_found();
	}

	$response = \rest_ensure_response( Document\to_wire( $doc ) );
	if ( ! \is_wp_error( $response ) && 200 !== $status ) {
		$response->set_status( $status );
	}

	return $response;
}
