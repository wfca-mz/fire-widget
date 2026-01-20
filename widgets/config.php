<?php
/**
 * Local configuration for WFCA Fire API
 * Load credentials from parent .env file
 */

// Load .env from private_html (outside web root)
$envFile = __DIR__ . '/../../private_html/.env';
if (file_exists($envFile)) {
    $lines = file($envFile, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
    foreach ($lines as $line) {
        // Skip comments
        if (strpos(trim($line), '#') === 0) continue;

        // Parse KEY=VALUE
        if (strpos($line, '=') !== false) {
            list($key, $value) = explode('=', $line, 2);
            $key = trim($key);
            $value = trim($value);

            // Set as environment variable
            putenv("$key=$value");
            $_ENV[$key] = $value;
        }
    }
}

// Define constants from environment
define('WFCA_PG_HOST', getenv('WFCA_PG_HOST'));
define('WFCA_PG_NAME', getenv('WFCA_PG_NAME'));
define('WFCA_PG_USER', getenv('WFCA_PG_USER'));
define('WFCA_PG_PASS', getenv('WFCA_PG_PASS'));
define('WFCA_PG_PORT', getenv('WFCA_PG_PORT') ?: 5432);

// Environment detection
define('WFCA_ENVIRONMENT', getenv('ENVIRONMENT') ?: 'production');
define('WFCA_IS_DEV', WFCA_ENVIRONMENT === 'development');

// API URLs based on environment
if (!defined('WFCA_API_URL')) {
    define('WFCA_API_URL', WFCA_IS_DEV
        ? getenv('DEV_API_URL')
        : getenv('PROD_API_URL')
    );
}
if (!defined('WFCA_FIRE_MAP_URL')) {
    define('WFCA_FIRE_MAP_URL', getenv('FIRE_MAP_URL') ?: 'https://fire-map.wfca.com');
}

/**
 * Get widget config as JSON for injecting into pages
 */
function wfca_get_widget_config_json(): string {
    return json_encode([
        'apiUrl' => WFCA_API_URL,
        'fireMapUrl' => WFCA_FIRE_MAP_URL,
        'environment' => WFCA_ENVIRONMENT,
    ]);
}
