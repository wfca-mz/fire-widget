<?php
/**
 * Local configuration for WFCA Fire API
 * Load credentials from parent .env file
 */

// Load .env from parent directory
$envFile = __DIR__ . '/../.env';
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
