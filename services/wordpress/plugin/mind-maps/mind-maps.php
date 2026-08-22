<?php
/**
 * Plugin Name:       Mind Maps
 * Plugin URI:        https://github.com/eugen/mind-maps
 * Description:       Embed and edit canvas mind maps in WordPress. Maps live in a custom post type and are served through the plugin's own REST namespace.
 * Version:           1.1.0
 * Requires at least: 6.3
 * Requires PHP:      8.1
 * Author:            Eugen Guriev
 * License:           GPL-2.0-or-later
 * License URI:       https://www.gnu.org/licenses/gpl-2.0.html
 * Text Domain:       mind-maps
 * Domain Path:       /languages
 *
 * @package MindMaps
 */

declare(strict_types=1);

defined( 'ABSPATH' ) || exit;

define( 'MIND_MAPS_VERSION', '1.1.0' );
define( 'MIND_MAPS_FILE', __FILE__ );
define( 'MIND_MAPS_DIR', plugin_dir_path( __FILE__ ) );
define( 'MIND_MAPS_URL', plugin_dir_url( __FILE__ ) );

// `require_once`, not `require`: Composer's `files` autoloader pulls the same
// paths in for the test suites, and PHP binds top-level functions at compile
// time — a second include of the same file would be a fatal redeclare.
require_once MIND_MAPS_DIR . 'src/document.php';
require_once MIND_MAPS_DIR . 'src/post-type.php';
require_once MIND_MAPS_DIR . 'src/repository.php';
require_once MIND_MAPS_DIR . 'src/rest.php';
require_once MIND_MAPS_DIR . 'src/assets.php';
require_once MIND_MAPS_DIR . 'src/render.php';
require_once MIND_MAPS_DIR . 'src/admin.php';
require_once MIND_MAPS_DIR . 'src/plugin.php';

MindMaps\Plugin\bootstrap();
