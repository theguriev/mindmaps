<?php
/**
 * Unit tests for the plugin's other WordPress-free helpers: asset selection,
 * the boot payload, mount argument normalization and the admin screen guard.
 *
 * @package MindMaps
 */

declare(strict_types=1);

namespace MindMaps\Tests\Unit;

use PHPUnit\Framework\TestCase;

use function MindMaps\Admin\is_map_screen;
use function MindMaps\Assets\boot_payload;
use function MindMaps\Assets\boot_script;
use function MindMaps\Assets\select_assets;
use function MindMaps\Assets\string_list;
use function MindMaps\Render\normalize_args;
use function MindMaps\Tests\wants_integration;

use const MindMaps\Render\DEFAULT_HEIGHT;

final class PureHelpersTest extends TestCase {

	/* ------------------------------------------------------------------ */

	public function test_falls_back_to_unhashed_asset_names(): void {
		$expected = array(
			'js'  => 'index.js',
			'css' => array( 'index.css' ),
		);

		$this->assertSame( $expected, select_assets( null ) );
		$this->assertSame( $expected, select_assets( 'not a manifest' ) );
		$this->assertSame( $expected, select_assets( array() ) );
		$this->assertSame( $expected, select_assets( array( 'js' => '' ) ) );
	}

	public function test_reads_a_plain_manifest(): void {
		$this->assertSame(
			array(
				'js'  => 'app.9f2a.js',
				'css' => array( 'app.9f2a.css' ),
			),
			select_assets(
				array(
					'js'  => 'app.9f2a.js',
					'css' => 'app.9f2a.css',
				)
			)
		);
	}

	public function test_reads_a_vite_manifest(): void {
		$this->assertSame(
			array(
				'js'  => 'assets/index-BQ7l.js',
				'css' => array( 'assets/index-Cx1.css' ),
			),
			select_assets(
				array(
					'_vendor.js'  => array( 'file' => 'assets/vendor-a.js' ),
					'src/main.ts' => array(
						'file'    => 'assets/index-BQ7l.js',
						'isEntry' => true,
						'css'     => array( 'assets/index-Cx1.css' ),
					),
				)
			)
		);
	}

	public function test_string_list_tolerates_junk(): void {
		$this->assertSame( array(), string_list( null ) );
		$this->assertSame( array(), string_list( '' ) );
		$this->assertSame( array( 'a.css' ), string_list( 'a.css' ) );
		$this->assertSame( array( 'a.css', 'b.css' ), string_list( array( 'a.css', 7, null, 'b.css' ) ) );
	}

	/* ------------------------------------------------------------------ */

	public function test_boot_payload_matches_the_contract(): void {
		$this->assertSame(
			array(
				'root'    => 'https://site.test/wp-json/mindmaps/v1',
				'nonce'   => 'a1b2c3d4e5',
				'mapId'   => '42',
				'canEdit' => true,
				'locale'  => 'en_US',
			),
			boot_payload( 'https://site.test/wp-json/mindmaps/v1', 'a1b2c3d4e5', '42', true, 'en_US' )
		);
	}

	public function test_boot_payload_omits_the_map_id_for_the_list_view(): void {
		$payload = boot_payload( 'https://site.test/wp-json/mindmaps/v1', 'n', null, false, 'de_DE' );

		$this->assertArrayNotHasKey( 'mapId', $payload );
		$this->assertFalse( $payload['canEdit'] );
		$this->assertSame( 'de_DE', $payload['locale'] );

		$this->assertArrayNotHasKey(
			'mapId',
			boot_payload( 'https://site.test/wp-json/mindmaps/v1', 'n', '', false, 'de_DE' )
		);
	}

	public function test_boot_script_publishes_the_global(): void {
		$this->assertSame(
			'window.mindMapsBoot = {"root":"/x"};',
			boot_script( '{"root":"/x"}' )
		);
	}

	/* ------------------------------------------------------------------ */

	public function test_normalize_args_defaults_and_clamps(): void {
		$this->assertSame(
			array(
				'id'     => 0,
				'height' => DEFAULT_HEIGHT,
			),
			normalize_args( '', '' )
		);
		$this->assertSame(
			array(
				'id'     => 42,
				'height' => 600,
			),
			normalize_args( '42', '600' )
		);
		$this->assertSame(
			array(
				'id'     => 0,
				'height' => DEFAULT_HEIGHT,
			),
			normalize_args( '-7', '-1' )
		);
		$this->assertSame(
			array(
				'id'     => 0,
				'height' => DEFAULT_HEIGHT,
			),
			normalize_args( array( 'nope' ), array( 'nope' ) )
		);
		$this->assertSame( 5000, normalize_args( 1, 999999 )['height'] );
	}

	/* ------------------------------------------------------------------ */

	public function test_recognizes_only_our_admin_screen(): void {
		$this->assertTrue( is_map_screen( 'toplevel_page_mind-maps' ) );
		$this->assertFalse( is_map_screen( 'edit.php' ) );
		$this->assertFalse( is_map_screen( null ) );
		$this->assertFalse( is_map_screen( 7 ) );
	}

	/* ------------------------------------------------------------------ */

	public function test_bootstrap_only_loads_wordpress_for_the_integration_suite(): void {
		$this->assertTrue( wants_integration( array( 'phpunit', '--testsuite', 'integration' ), '' ) );
		$this->assertTrue( wants_integration( array( 'phpunit', '--testsuite=integration' ), '' ) );
		$this->assertTrue( wants_integration( array( 'phpunit' ), 'integration' ) );
		$this->assertFalse( wants_integration( array( 'phpunit', '--testsuite', 'unit' ), '' ) );
		$this->assertFalse( wants_integration( array( 'phpunit' ), '' ) );
		$this->assertFalse( wants_integration( array( 'phpunit', '--testsuite' ), '' ) );
	}
}
