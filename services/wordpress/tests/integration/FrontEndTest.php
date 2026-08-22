<?php
/**
 * Integration tests for what the plugin puts on a page: the boot payload and
 * the mount containers the shortcode, the block and the admin screen emit.
 *
 * These need a real WordPress — the block parser, the script queue and the
 * capability map all have to be the real ones for the answers to mean
 * anything.
 *
 * @package MindMaps
 */

declare(strict_types=1);

namespace MindMaps\Tests\Integration;

use MindMaps\Admin;
use MindMaps\Assets;
use MindMaps\PostType;
use MindMaps\Render;
use WP_UnitTestCase;

final class FrontEndTest extends WP_UnitTestCase {

	private int $author;

	private int $other_author;

	private int $subscriber;

	public function set_up(): void {
		parent::set_up();

		// The boot payload is printed at most once per request, and the script
		// queue is where that "already printed" state lives. Each test is its
		// own request.
		$GLOBALS['wp_scripts'] = null;
		$GLOBALS['wp_styles']  = null;

		$this->author       = self::factory()->user->create( array( 'role' => 'author' ) );
		$this->other_author = self::factory()->user->create( array( 'role' => 'author' ) );
		$this->subscriber   = self::factory()->user->create( array( 'role' => 'subscriber' ) );
	}

	public function tear_down(): void {
		unset( $_GET['map'] );
		\wp_set_current_user( 0 );
		$GLOBALS['wp_scripts'] = null;
		$GLOBALS['wp_styles']  = null;

		parent::tear_down();
	}

	/* ---------------------------------------------------------------------
	 * Helpers.
	 * ------------------------------------------------------------------ */

	/**
	 * A map post owned by a given user.
	 *
	 * @param int    $author Owner.
	 * @param string $title  Map title.
	 */
	private function map_post( int $author, string $title = 'Plan' ): int {
		return (int) self::factory()->post->create(
			array(
				'post_type'   => PostType\POST_TYPE,
				'post_status' => 'publish',
				'post_author' => $author,
				'post_title'  => $title,
			)
		);
	}

	/**
	 * Everything the plugin has queued to run before its bundle.
	 */
	private function boot_script(): string {
		$lines = \wp_scripts()->get_data( Assets\SCRIPT_HANDLE, 'before' );
		if ( ! \is_array( $lines ) ) {
			return '';
		}
		return \implode( "\n", \array_filter( $lines, '\\is_string' ) );
	}

	/* ---------------------------------------------------------------------
	 * The admin screen must not hand out write access it does not have.
	 * ------------------------------------------------------------------ */

	public function test_the_admin_screen_reports_write_access_per_map(): void {
		$map_id = $this->map_post( $this->author );

		// Another author: `edit_posts` gets them onto the screen, but they may
		// not write *this* map. The screen used to pass a literal `true`.
		\wp_set_current_user( $this->other_author );
		$_GET['map'] = (string) $map_id;
		Admin\enqueue_admin( Admin\screen_hook() );

		$boot = $this->boot_script();
		$this->assertStringContainsString( '"mapId":"' . $map_id . '"', $boot );
		$this->assertStringContainsString( '"canEdit":false', $boot );
	}

	public function test_the_admin_screen_still_reports_write_access_to_the_owner(): void {
		$map_id = $this->map_post( $this->author );

		\wp_set_current_user( $this->author );
		$_GET['map'] = (string) $map_id;
		Admin\enqueue_admin( Admin\screen_hook() );

		$this->assertStringContainsString( '"canEdit":true', $this->boot_script() );
	}

	public function test_the_admin_screen_enqueues_nothing_off_its_own_hook(): void {
		\wp_set_current_user( $this->author );
		Admin\enqueue_admin( 'edit.php' );

		$this->assertSame( '', $this->boot_script() );
	}

	/* ---------------------------------------------------------------------
	 * A block-embedded map must reach the boot payload.
	 * ------------------------------------------------------------------ */

	public function test_first_map_id_sees_blocks_as_well_as_shortcodes(): void {
		$this->assertNull( Assets\first_map_id( 'nothing to see here' ) );
		$this->assertSame( '7', Assets\first_map_id( '[mind_map id="7"]' ) );
		$this->assertSame( '9', Assets\first_map_id( '<!-- wp:mind-maps/map {"id":9,"height":600} /-->' ) );

		// Nested inside a group, and still found.
		$this->assertSame(
			'11',
			Assets\first_map_id(
				'<!-- wp:group --><div class="wp-block-group">'
				. '<!-- wp:mind-maps/map {"id":11} /-->'
				. '</div><!-- /wp:group -->'
			)
		);

		// A block with no id is a list mount and pins nothing.
		$this->assertNull( Assets\first_map_id( '<!-- wp:mind-maps/map /-->' ) );
		$this->assertNull( Assets\first_map_id( '<!-- wp:mind-maps/map {"id":0} /-->' ) );

		// Document order decides when a page carries both syntaxes.
		$block     = '<!-- wp:mind-maps/map {"id":3} /-->';
		$shortcode = '<!-- wp:paragraph --><p>[mind_map id="4"]</p><!-- /wp:paragraph -->';
		$this->assertSame( '3', Assets\first_map_id( $block . $shortcode ) );
		$this->assertSame( '4', Assets\first_map_id( $shortcode . $block ) );
	}

	public function test_a_block_embedded_map_boots_with_its_own_id_and_access(): void {
		$map_id  = $this->map_post( $this->author );
		$post_id = (int) self::factory()->post->create(
			array(
				'post_author'  => $this->author,
				'post_content' => '<!-- wp:mind-maps/map {"id":' . $map_id . ',"height":600} /-->',
			)
		);

		// A reader who may not write the map. Before the fix the payload
		// carried no map id at all, so `canEdit` fell back to a role check.
		$this->go_to( (string) \get_permalink( $post_id ) );
		\wp_set_current_user( $this->other_author );
		Assets\maybe_enqueue_front();

		$boot = $this->boot_script();
		$this->assertStringContainsString( '"mapId":"' . $map_id . '"', $boot );
		$this->assertStringContainsString( '"canEdit":false', $boot );
	}

	public function test_a_shortcode_embedded_map_still_boots_with_its_id(): void {
		$map_id  = $this->map_post( $this->author );
		$post_id = (int) self::factory()->post->create(
			array(
				'post_author'  => $this->author,
				'post_content' => '[mind_map id="' . $map_id . '"]',
			)
		);

		$this->go_to( (string) \get_permalink( $post_id ) );
		\wp_set_current_user( $this->author );
		Assets\maybe_enqueue_front();

		$boot = $this->boot_script();
		$this->assertStringContainsString( '"mapId":"' . $map_id . '"', $boot );
		$this->assertStringContainsString( '"canEdit":true', $boot );
	}

	public function test_a_page_with_no_map_enqueues_nothing(): void {
		$post_id = (int) self::factory()->post->create(
			array(
				'post_author'  => $this->author,
				'post_content' => 'Just some prose.',
			)
		);

		$this->go_to( (string) \get_permalink( $post_id ) );
		\wp_set_current_user( $this->author );
		Assets\maybe_enqueue_front();

		$this->assertSame( '', $this->boot_script() );
	}

	/* ---------------------------------------------------------------------
	 * Every mount states its own case.
	 * ------------------------------------------------------------------ */

	public function test_every_mount_carries_its_own_map_id_and_write_access(): void {
		$mine   = $this->map_post( $this->author, 'Mine' );
		$theirs = $this->map_post( $this->other_author, 'Theirs' );

		\wp_set_current_user( $this->author );

		// The list mount: an *explicit* empty id, never an absent attribute —
		// absence let the front end fall back to the page-wide boot map id and
		// render a pinned map where the list belonged.
		$list = Render\mount_markup( array( 'id' => 0 ) );
		$this->assertStringContainsString( 'data-map-id=""', $list );
		$this->assertStringContainsString( 'data-can-edit="1"', $list );

		$own = Render\mount_markup( array( 'id' => $mine ) );
		$this->assertStringContainsString( 'data-map-id="' . $mine . '"', $own );
		$this->assertStringContainsString( 'data-can-edit="1"', $own );

		$other = Render\mount_markup( array( 'id' => $theirs ) );
		$this->assertStringContainsString( 'data-map-id="' . $theirs . '"', $other );
		$this->assertStringContainsString( 'data-can-edit="0"', $other );
	}

	public function test_a_reader_without_edit_posts_gets_a_read_only_list_mount(): void {
		\wp_set_current_user( $this->subscriber );

		$this->assertStringContainsString( 'data-can-edit="0"', Render\mount_markup( array( 'id' => 0 ) ) );
	}

	public function test_a_list_shortcode_next_to_a_pinned_one_stays_a_list(): void {
		$map_id = $this->map_post( $this->author );

		\wp_set_current_user( $this->author );
		$rendered = \do_shortcode( '[mind_map][mind_map id="' . $map_id . '"]' );

		$this->assertSame( 2, \substr_count( $rendered, 'data-mind-maps-root' ) );
		$this->assertSame( 1, \substr_count( $rendered, 'data-map-id=""' ) );
		$this->assertSame( 1, \substr_count( $rendered, 'data-map-id="' . $map_id . '"' ) );
	}

	public function test_the_block_renderer_emits_the_same_attributes(): void {
		$map_id = $this->map_post( $this->other_author );

		\wp_set_current_user( $this->author );
		$rendered = Render\block_callback(
			array(
				'id'     => $map_id,
				'height' => 400,
			)
		);

		$this->assertStringContainsString( 'data-map-id="' . $map_id . '"', $rendered );
		$this->assertStringContainsString( 'data-can-edit="0"', $rendered );
		$this->assertStringContainsString( 'min-height:400px', $rendered );

		$this->assertStringContainsString( 'data-map-id=""', Render\block_callback( array() ) );
	}

	/* ---------------------------------------------------------------------
	 * The admin screen owns its URL and its canvas.
	 * ------------------------------------------------------------------ */

	public function test_only_the_admin_mount_claims_the_page_url(): void {
		\wp_set_current_user( $this->author );

		// A shortcode sits inside somebody's post and must never rewrite that
		// post's address, so it names no parameter.
		$this->assertStringNotContainsString( 'data-map-param', \do_shortcode( '[mind_map]' ) );
		$this->assertStringNotContainsString(
			'data-map-param',
			Render\block_callback( array( 'id' => $this->map_post( $this->author ) ) )
		);

		// The admin screen is the page: the open map belongs in its URL, as
		// `post.php?post=1` names a post, so a reload comes back to it.
		$this->assertStringContainsString(
			'data-map-param="map"',
			Render\mount_markup( array(
				'id'        => 0,
				'map_param' => 'map',
			) )
		);
	}

	public function test_a_mount_can_opt_out_of_the_inline_height(): void {
		\wp_set_current_user( $this->author );

		// An inline `min-height` outranks every stylesheet rule, so the admin
		// canvas — sized against the viewport — has to be able to drop it.
		$this->assertStringNotContainsString(
			'style=',
			Render\mount_markup( array(
				'id'     => 0,
				'height' => null,
			) )
		);

		// Every other caller keeps the inline height it always had.
		$this->assertStringContainsString(
			'style="min-height:600px"',
			Render\mount_markup( array( 'id' => 0 ) )
		);
	}

	public function test_the_admin_screen_renders_a_full_bleed_canvas(): void {
		\wp_set_current_user( $this->admin_user() );
		$_GET = array( 'page' => 'mind-maps' );

		\ob_start();
		Admin\render_page();
		$rendered = (string) \ob_get_clean();
		$_GET     = array();

		// `.wrap` carries WordPress' document margins — half the grey this
		// screen removes — and is where `common.js` moves admin notices to,
		// which would drop them between the heading and the canvas.
		$this->assertStringNotContainsString( 'class="wrap', $rendered );
		// The marker core prefers for notices, so they land in the strip above
		// the map rather than nowhere.
		$this->assertStringContainsString( 'class="wp-header-end"', $rendered );
		$this->assertStringContainsString( 'mind-maps-admin-root', $rendered );
		$this->assertStringContainsString( 'data-map-param="map"', $rendered );
		$this->assertStringNotContainsString( 'style=', $rendered );
	}

	public function test_the_admin_screen_opens_the_map_its_url_names(): void {
		$map_id = $this->map_post( $this->author, 'Routed' );

		\wp_set_current_user( $this->author );
		$_GET = array(
			'page' => 'mind-maps',
			'map'  => (string) $map_id,
		);

		\ob_start();
		Admin\render_page();
		$rendered = (string) \ob_get_clean();
		$_GET     = array();

		// Reloading `?map=<id>` must land on that map, not back on the list.
		$this->assertStringContainsString( 'data-map-id="' . $map_id . '"', $rendered );
	}

	/* ---------------------------------------------------------------------
	 * The admin bar's "+ New" entry.
	 * ------------------------------------------------------------------ */

	public function test_the_admin_bar_offers_a_new_mind_map(): void {
		\wp_set_current_user( $this->author );

		$bar = $this->admin_bar_with_new_menu();
		Admin\register_admin_bar( $bar );

		$node = $bar->get_node( 'new-mind-map' );
		$this->assertNotNull( $node, 'The node should hang off core\'s "+ New" menu.' );
		$this->assertSame( 'new-content', $node->parent );
		// The link only opens the picker — creating a map is a REST write, and a
		// GET a browser may prefetch must not make one.
		$this->assertStringContainsString( 'page=mind-maps', (string) $node->href );
		$this->assertStringContainsString( 'new=1', (string) $node->href );
	}

	public function test_a_reader_is_offered_no_new_mind_map(): void {
		\wp_set_current_user( $this->subscriber );

		$bar = $this->admin_bar_with_new_menu();
		Admin\register_admin_bar( $bar );

		$this->assertNull( $bar->get_node( 'new-mind-map' ) );
	}

	public function test_the_entry_is_skipped_when_core_omits_the_new_menu(): void {
		// Core builds "+ New" only for a user who may create something; without
		// the parent the node would be dropped silently rather than shown.
		\wp_set_current_user( $this->author );

		$bar = $this->admin_bar();
		Admin\register_admin_bar( $bar );

		$this->assertNull( $bar->get_node( 'new-mind-map' ) );
	}

	public function test_the_screen_opens_its_picker_when_asked(): void {
		\wp_set_current_user( $this->author );
		$_GET = array(
			'page' => 'mind-maps',
			'new'  => '1',
		);

		\ob_start();
		Admin\render_page();
		$rendered = (string) \ob_get_clean();
		$_GET     = array();

		$this->assertStringContainsString( 'data-new="1"', $rendered );

		// And not otherwise — a shortcode embed must never pop a picker open.
		$this->assertStringNotContainsString(
			'data-new',
			\do_shortcode( '[mind_map]' )
		);
	}

	/**
	 * A bare admin bar.
	 *
	 * WordPress loads `WP_Admin_Bar` lazily, when a request actually renders the
	 * bar, so a test has to ask for the file itself.
	 */
	private function admin_bar(): \WP_Admin_Bar {
		require_once ABSPATH . WPINC . '/class-wp-admin-bar.php';
		return new \WP_Admin_Bar();
	}

	/** An admin bar carrying core's "+ New" parent node. */
	private function admin_bar_with_new_menu(): \WP_Admin_Bar {
		$bar = $this->admin_bar();
		$bar->add_node( array(
			'id'    => 'new-content',
			'title' => 'New',
		) );
		return $bar;
	}

	/** An administrator id, created on demand. */
	private function admin_user(): int {
		return self::factory()->user->create( array( 'role' => 'administrator' ) );
	}
}
