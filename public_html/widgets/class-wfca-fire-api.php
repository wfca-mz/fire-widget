<?php
/**
 * WFCA Active Fires API
 * 
 * Lightweight REST endpoint serving active wildfire data for widget embedding.
 * 
 * DEPLOYMENT OPTIONS:
 * 
 * Option 1: WordPress REST API (Recommended)
 *   - Add to your theme's functions.php or create a small plugin
 *   - Endpoint: https://wfca.com/wp-json/wfca/v1/active-fires
 *   - Benefits: Uses WP's built-in caching, auth, and infrastructure
 * 
 * Option 2: Standalone PHP file
 *   - Place in web-accessible directory with DB config
 *   - Endpoint: https://wfca.com/api/active-fires.php
 *   - Benefits: Simpler, no WP overhead
 * 
 * Option 3: AWS Lambda (for scale)
 *   - Convert to Lambda handler with RDS connection
 *   - Benefits: Serverless, auto-scaling
 * 
 * @package WFCA
 * @version 1.0.0
 */

// ============================================================================
// CONFIGURATION
// ============================================================================

// For standalone deployment, create a config file with these constants:
// DB_HOST, DB_NAME, DB_USER, DB_PASSWORD
// For WordPress, we'll use WP's existing connection or a separate config

if (!defined('WFCA_FIRE_API_LOADED')) {
    define('WFCA_FIRE_API_LOADED', true);
}

// Allowed origins for CORS - add your domains
define('WFCA_ALLOWED_ORIGINS', [
    'https://wfca.com',
    'https://www.wfca.com',
    'https://dailydispatch.com',
    'https://www.dailydispatch.com',
    'https://fire-map.wfca.com',
    'http://localhost:3000',  // Development
    'http://localhost:8000',
]);

// Cache duration in seconds (5 minutes default)
if (!defined('WFCA_CACHE_DURATION')) {
    define('WFCA_CACHE_DURATION', 300);
}

// Fire Map base URL for generating links
if (!defined('WFCA_FIRE_MAP_URL')) {
    define('WFCA_FIRE_MAP_URL', 'https://fire-map.wfca.com');
}

// Cache directory for standalone mode (file-based cache)
if (!defined('WFCA_CACHE_DIR')) {
    define('WFCA_CACHE_DIR', __DIR__ . '/cache');
}


// ============================================================================
// WORDPRESS REST API REGISTRATION
// ============================================================================

/**
 * Register the REST API endpoint with WordPress
 * Add this to functions.php or a plugin file
 */
function wfca_register_fire_api_routes() {
    register_rest_route('wfca/v1', '/active-fires', [
        'methods'             => 'GET',
        'callback'            => 'wfca_get_active_fires',
        'permission_callback' => '__return_true', // Public endpoint
        'args'                => [
            'limit' => [
                'default'           => 20,
                'validate_callback' => function($param) {
                    return is_numeric($param) && $param >= 1 && $param <= 100;
                },
                'sanitize_callback' => 'absint',
            ],
            'state' => [
                'default'           => '',
                'sanitize_callback' => 'sanitize_text_field',
            ],
            'search' => [
                'default'           => '',
                'sanitize_callback' => 'sanitize_text_field',
            ],
        ],
    ]);
}
// Only register with WordPress if running in WP context
if (function_exists('add_action')) {
    add_action('rest_api_init', 'wfca_register_fire_api_routes');
}


// ============================================================================
// FILE-BASED CACHE (for standalone mode)
// ============================================================================

/**
 * Get cached data from file
 *
 * @param string $key Cache key
 * @return mixed|false Cached data or false if not found/expired
 */
function wfca_file_cache_get(string $key) {
    $cache_file = WFCA_CACHE_DIR . '/' . $key . '.json';

    if (!file_exists($cache_file)) {
        return false;
    }

    $content = file_get_contents($cache_file);
    if ($content === false) {
        return false;
    }

    $data = json_decode($content, true);
    if (!$data || !isset($data['expires']) || !isset($data['data'])) {
        return false;
    }

    // Check if expired
    if (time() > $data['expires']) {
        @unlink($cache_file);
        return false;
    }

    return $data['data'];
}

/**
 * Set cached data to file
 *
 * @param string $key Cache key
 * @param mixed $data Data to cache
 * @param int $ttl Time to live in seconds
 * @return bool Success
 */
function wfca_file_cache_set(string $key, $data, int $ttl): bool {
    // Create cache directory if needed
    if (!is_dir(WFCA_CACHE_DIR)) {
        if (!@mkdir(WFCA_CACHE_DIR, 0755, true)) {
            return false;
        }
        // Protect cache directory
        @file_put_contents(WFCA_CACHE_DIR . '/.htaccess', "Require all denied\n");
    }

    $cache_file = WFCA_CACHE_DIR . '/' . $key . '.json';
    $content = json_encode([
        'expires' => time() + $ttl,
        'data' => $data,
    ]);

    return file_put_contents($cache_file, $content, LOCK_EX) !== false;
}

/**
 * Clean up expired cache files
 * Runs probabilistically to avoid overhead on every request
 *
 * @param int $max_age Maximum age in seconds for cache files (default: 1 hour)
 * @param int $probability Chance of running (1-100, default: 1 = 1% of requests)
 * @return int Number of files deleted
 */
function wfca_cache_cleanup(int $max_age = 3600, int $probability = 1): int {
    // Only run probabilistically
    if (mt_rand(1, 100) > $probability) {
        return 0;
    }

    if (!is_dir(WFCA_CACHE_DIR)) {
        return 0;
    }

    $deleted = 0;
    $now = time();
    $files = glob(WFCA_CACHE_DIR . '/wfca_fires_*.json');

    if (!$files) {
        return 0;
    }

    foreach ($files as $file) {
        // Check file modification time
        $mtime = @filemtime($file);
        if ($mtime && ($now - $mtime) > $max_age) {
            if (@unlink($file)) {
                $deleted++;
            }
        }
    }

    return $deleted;
}


// ============================================================================
// CORE API HANDLER
// ============================================================================

/**
 * Main API handler - works for both WP REST and standalone
 *
 * @param WP_REST_Request|array $request Request object or params array
 * @return WP_REST_Response|array Response
 */
function wfca_get_active_fires($request) {
    // Parse parameters (handle both WP_REST_Request and array)
    $params = is_object($request)
        ? $request->get_params()
        : $request;

    $limit = min((int)($params['limit'] ?? 20), 100);
    $state = $params['state'] ?? '';
    $search = $params['search'] ?? '';

    // Generate cache key
    $cache_key = 'wfca_fires_' . md5($limit . '_' . $state . '_' . $search);

    // Try WordPress transient cache first
    if (function_exists('get_transient')) {
        $cached = get_transient($cache_key);
        if ($cached !== false) {
            return wfca_format_response($cached, true);
        }
    } else {
        // Try file-based cache for standalone mode
        $cached = wfca_file_cache_get($cache_key);
        if ($cached !== false) {
            return wfca_format_response($cached, true);
        }
    }

    // Fetch from database
    try {
        $fires = wfca_fetch_fires_from_db($limit, $state, $search);

        // Cache the result
        if (function_exists('set_transient')) {
            set_transient($cache_key, $fires, WFCA_CACHE_DURATION);
        } else {
            wfca_file_cache_set($cache_key, $fires, WFCA_CACHE_DURATION);
        }

        return wfca_format_response($fires, false);

    } catch (Exception $e) {
        error_log('WFCA Fire API Error: ' . $e->getMessage());

        if (is_object($request)) {
            return new WP_Error(
                'database_error',
                'Unable to fetch fire data',
                ['status' => 500]
            );
        }

        return ['error' => 'Unable to fetch fire data'];
    }
}


/**
 * Fetch fires from PostgreSQL database
 *
 * @param int    $limit Maximum fires to return
 * @param string $state Optional state filter
 * @param string $search Optional name search filter
 * @return array Fire data
 */
function wfca_fetch_fires_from_db(int $limit, string $state = '', string $search = ''): array {
    $pdo = wfca_get_db_connection();

    // Inline query - same logic as vw_active_fires_widget but doesn't require the view
    // This joins perimeter bbox data with incident location data
    $sql = "
        WITH
        -- Get latest incident record per irwinid for acreage/location data
        latest_incidents AS (
            SELECT DISTINCT ON (irwinid)
                irwinid,
                wfca_reportedacres,
                poostate,
                poocounty,
                percentcontained,
                incidentname
            FROM data.mvw_wfigs_incident_locations_current_history
            ORDER BY irwinid, modifiedondatetime_dt DESC NULLS LAST
        ),
        -- Parse bbox coordinates from perimeter view
        bbox_parsed AS (
            SELECT
                p.gid,
                p.poly_incidentname,
                p.poly_datecurrent,
                p.attr_irwinid,
                p.attr_modifiedondatetime_dt,
                p.globalid,
                p.wfca_timestamp,
                p.bbox,
                (p.bbox::jsonb -> 'coordinates' -> 0 -> 0 -> 0)::float AS min_lng,
                (p.bbox::jsonb -> 'coordinates' -> 0 -> 0 -> 1)::float AS min_lat,
                (p.bbox::jsonb -> 'coordinates' -> 0 -> 2 -> 0)::float AS max_lng,
                (p.bbox::jsonb -> 'coordinates' -> 0 -> 2 -> 1)::float AS max_lat
            FROM data.vw_wfigs_interagency_perimeters_current_bbox p
        )
        SELECT
            bp.gid,
            COALESCE(li.incidentname, bp.poly_incidentname) AS fire_name,
            bp.poly_datecurrent AS date_current,
            bp.attr_irwinid AS irwin_id,
            bp.attr_modifiedondatetime_dt AS modified_at,
            bp.globalid,
            bp.wfca_timestamp,
            li.wfca_reportedacres AS acres,
            li.poostate AS state,
            li.poocounty AS county,
            li.percentcontained AS percent_contained,
            ROUND(((bp.min_lng + bp.max_lng) / 2)::numeric, 6) AS center_lng,
            ROUND(((bp.min_lat + bp.max_lat) / 2)::numeric, 6) AS center_lat,
            CASE
                WHEN GREATEST(bp.max_lng - bp.min_lng, bp.max_lat - bp.min_lat) > 0.5 THEN 9
                WHEN GREATEST(bp.max_lng - bp.min_lng, bp.max_lat - bp.min_lat) > 0.1 THEN 11
                WHEN GREATEST(bp.max_lng - bp.min_lng, bp.max_lat - bp.min_lat) > 0.01 THEN 13
                ELSE 15
            END AS suggested_zoom
        FROM bbox_parsed bp
        LEFT JOIN latest_incidents li ON bp.attr_irwinid = li.irwinid
        WHERE bp.attr_modifiedondatetime_dt >= NOW() - INTERVAL '7 days'
    ";

    $params = [];

    // Optional state filter (handles both "TX" and "US-TX" formats)
    if (!empty($state)) {
        $sql .= " AND (UPPER(li.poostate) = UPPER(:state) OR UPPER(li.poostate) = UPPER(:state_prefixed))";
        $params['state'] = $state;
        $params['state_prefixed'] = 'US-' . $state;
    }

    // Optional name search filter (case-insensitive substring match)
    if (!empty($search)) {
        $sql .= " AND (UPPER(li.incidentname) LIKE UPPER(:search) OR UPPER(bp.poly_incidentname) LIKE UPPER(:search))";
        $params['search'] = '%' . $search . '%';
    }

    // Order by most recent modification date
    $sql .= " ORDER BY bp.attr_modifiedondatetime_dt DESC NULLS LAST LIMIT :limit";

    $stmt = $pdo->prepare($sql);
    $stmt->bindValue(':limit', $limit, PDO::PARAM_INT);

    foreach ($params as $key => $value) {
        $stmt->bindValue(':' . $key, $value, PDO::PARAM_STR);
    }

    $stmt->execute();

    return $stmt->fetchAll(PDO::FETCH_ASSOC);
}


/**
 * Get PDO database connection
 * 
 * Supports multiple config methods:
 * 1. WordPress constants (if defined in wp-config.php)
 * 2. Environment variables
 * 3. Separate config file
 * 
 * @return PDO Database connection
 * @throws Exception If connection fails
 */
function wfca_get_db_connection(): PDO {
    static $pdo = null;
    
    if ($pdo !== null) {
        return $pdo;
    }
    
    // Try multiple config sources
    $host = defined('WFCA_PG_HOST') ? WFCA_PG_HOST : getenv('WFCA_PG_HOST');
    $name = defined('WFCA_PG_NAME') ? WFCA_PG_NAME : getenv('WFCA_PG_NAME');
    $user = defined('WFCA_PG_USER') ? WFCA_PG_USER : getenv('WFCA_PG_USER');
    $pass = defined('WFCA_PG_PASS') ? WFCA_PG_PASS : getenv('WFCA_PG_PASS');
    $port = defined('WFCA_PG_PORT') ? WFCA_PG_PORT : (getenv('WFCA_PG_PORT') ?: 5432);
    
    if (!$host || !$name || !$user) {
        throw new Exception('PostgreSQL configuration not found');
    }
    
    $dsn = sprintf(
        'pgsql:host=%s;port=%d;dbname=%s',
        $host,
        $port,
        $name
    );
    
    $pdo = new PDO($dsn, $user, $pass, [
        PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        PDO::ATTR_EMULATE_PREPARES   => false,
    ]);
    
    return $pdo;
}


/**
 * Format the API response with metadata
 * 
 * @param array $fires     Fire data array
 * @param bool  $from_cache Whether data came from cache
 * @return WP_REST_Response|array
 */
function wfca_format_response(array $fires, bool $from_cache) {
    $response_data = [
        'meta' => [
            'generated_at' => gmdate('c'),
            'count'        => count($fires),
            'cached'       => $from_cache,
            'cache_ttl'    => WFCA_CACHE_DURATION,
        ],
        'fires' => array_map(function($fire) {
            return [
                'id'        => $fire['gid'],
                'name'      => $fire['fire_name'],
                'irwin_id'  => $fire['irwin_id'],
                'updated'   => $fire['modified_at'],
                // Acreage and location data
                'acres'     => $fire['acres'] ? (int)$fire['acres'] : null,
                'state'     => $fire['state'],
                'county'    => $fire['county'],
                'contained_pct' => $fire['percent_contained'] ? (int)$fire['percent_contained'] : null,
                // Map link
                'map_url'   => sprintf(
                    '%s/?lng=%s&lat=%s&zoom=%d',
                    WFCA_FIRE_MAP_URL,
                    $fire['center_lng'],
                    $fire['center_lat'],
                    $fire['suggested_zoom']
                ),
                'coords' => [
                    'lng'  => (float)$fire['center_lng'],
                    'lat'  => (float)$fire['center_lat'],
                    'zoom' => (int)$fire['suggested_zoom'],
                ],
            ];
        }, $fires),
    ];
    
    // Return WP_REST_Response if in WordPress context
    if (class_exists('WP_REST_Response')) {
        $response = new WP_REST_Response($response_data);
        $response->set_headers([
            'Cache-Control' => 'public, max-age=' . WFCA_CACHE_DURATION,
            'X-WFCA-Cache'  => $from_cache ? 'HIT' : 'MISS',
        ]);
        return $response;
    }
    
    return $response_data;
}


// ============================================================================
// STANDALONE MODE
// ============================================================================

/**
 * If this file is accessed directly (not via WordPress), handle the request
 */
if (!defined('ABSPATH')) {
    // Standalone mode - not running within WordPress
    
    // Load config if exists
    $config_file = __DIR__ . '/config.php';
    if (file_exists($config_file)) {
        require_once $config_file;
    }
    
    // Security: Only allow GET (also handles CLI execution gracefully)
    $request_method = $_SERVER['REQUEST_METHOD'] ?? 'CLI';
    if ($request_method !== 'GET') {
        http_response_code(405);
        header('Content-Type: application/json');
        echo json_encode(['error' => 'Method not allowed']);
        exit;
    }
    
    // CORS handling
    $origin = $_SERVER['HTTP_ORIGIN'] ?? '';
    if (in_array($origin, WFCA_ALLOWED_ORIGINS)) {
        header("Access-Control-Allow-Origin: $origin");
    }
    
    header('Content-Type: application/json');
    header('Cache-Control: public, max-age=' . WFCA_CACHE_DURATION);
    header('X-Content-Type-Options: nosniff');
    header('X-Frame-Options: DENY');
    header('Referrer-Policy: strict-origin-when-cross-origin');
    
    // Sanitize and validate input
    $sanitized_params = [
        'limit' => isset($_GET['limit']) ? min(abs((int)$_GET['limit']), 100) : 20,
        'state' => isset($_GET['state']) ? preg_replace('/[^a-zA-Z\-]/', '', substr($_GET['state'], 0, 10)) : '',
        'search' => isset($_GET['search']) ? preg_replace('/[^a-zA-Z0-9\s\-]/', '', substr($_GET['search'], 0, 50)) : '',
    ];

    // Process request
    $result = wfca_get_active_fires($sanitized_params);
    
    if (isset($result['error'])) {
        http_response_code(500);
    }

    echo json_encode($result, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES);

    // Flush output to client before cleanup
    if (function_exists('fastcgi_finish_request')) {
        fastcgi_finish_request();
    } else {
        // For non-FastCGI environments, flush output buffer
        if (ob_get_level() > 0) {
            ob_end_flush();
        }
        flush();
    }

    // Run cache cleanup after response is sent (1% of requests, files older than 1 hour)
    wfca_cache_cleanup(3600, 1);

    exit;
}
