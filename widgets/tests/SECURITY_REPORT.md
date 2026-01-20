# WFCA Fire Widget - Security Pen Test Report

**Date:** January 20, 2026
**Tested Components:** fire-widget.js, class-wfca-fire-api.php, test.html

## Executive Summary

The WFCA Fire Widget demonstrates **strong security posture** with proper input sanitization, prepared statements for SQL, XSS prevention through HTML escaping, and appropriate security headers. A few minor recommendations are noted below.

## Test Results Overview

| Category | Status | Notes |
|----------|--------|-------|
| SQL Injection Prevention | ✅ PASS | Prepared statements used throughout |
| XSS Prevention | ✅ PASS | `escapeHtml()` function escapes all user content |
| CORS Validation | ✅ PASS | Whitelist-based origin checking |
| HTTP Method Restrictions | ✅ PASS | Only GET allowed, POST/PUT/DELETE rejected |
| Security Headers | ✅ PASS | All recommended headers present |
| Sensitive Data Exposure | ✅ PASS | No credentials, paths, or stack traces exposed |

---

## Detailed Findings

### 1. SQL Injection Prevention ✅

**Finding:** The PHP API uses PDO prepared statements with parameterized queries.

**Evidence (class-wfca-fire-api.php:438-443):**
```php
$stmt = $pdo->prepare($sql);
$stmt->bindValue(':limit', $limit, PDO::PARAM_INT);
foreach ($params as $key => $value) {
    $stmt->bindValue(':' . $key, $value, PDO::PARAM_STR);
}
```

**Input Sanitization (lines 592-596):**
```php
$sanitized_params = [
    'limit' => isset($_GET['limit']) ? min(abs((int)$_GET['limit']), 100) : 20,
    'state' => isset($_GET['state']) ? preg_replace('/[^a-zA-Z\-]/', '', substr($_GET['state'], 0, 10)) : '',
    'search' => isset($_GET['search']) ? preg_replace('/[^a-zA-Z0-9\s\-]/', '', substr($_GET['search'], 0, 50)) : '',
];
```

**Tested Attack Vectors:**
- `state=CA' OR '1'='1` → Sanitized, special characters stripped
- `state=CA; DROP TABLE users;--` → Sanitized, only alphanumeric kept
- `search=test' UNION SELECT password` → Sanitized, quotes stripped

---

### 2. XSS Prevention ✅

**Finding:** The JavaScript widget uses a dedicated `escapeHtml()` function for all dynamic content.

**Evidence (fire-widget.js:495-500):**
```javascript
function escapeHtml(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}
```

**Usage in rendering (line 640-644):**
```javascript
<a href="${escapeHtml(fire.map_url)}"
   title="View ${escapeHtml(fire.name)} on Fire Map">
    ${escapeHtml(fire.name)}
</a>
```

**Data attributes are also escaped (line 684):**
```javascript
value="${escapeHtml(filterTerm)}"
```

---

### 3. CORS Validation ✅

**Finding:** The API uses a whitelist approach for CORS origins.

**Evidence (class-wfca-fire-api.php:40-48):**
```php
define('WFCA_ALLOWED_ORIGINS', [
    'https://wfca.com',
    'https://www.wfca.com',
    'https://dailydispatch.com',
    'https://fire-map.wfca.com',
    'http://localhost:3000',  // Development
]);
```

**Origin checking (lines 580-583):**
```php
$origin = $_SERVER['HTTP_ORIGIN'] ?? '';
if (in_array($origin, WFCA_ALLOWED_ORIGINS)) {
    header("Access-Control-Allow-Origin: $origin");
}
```

**Test Results:**
- `Origin: https://wfca.com` → CORS header set ✅
- `Origin: https://evil.com` → CORS header NOT set ✅

---

### 4. HTTP Method Restrictions ✅

**Finding:** Only GET requests are allowed.

**Evidence (class-wfca-fire-api.php:570-577):**
```php
$request_method = $_SERVER['REQUEST_METHOD'] ?? 'CLI';
if ($request_method !== 'GET') {
    http_response_code(405);
    header('Content-Type: application/json');
    echo json_encode(['error' => 'Method not allowed']);
    exit;
}
```

**Test Results:**
- POST → 405 Method Not Allowed ✅
- PUT → 405 Method Not Allowed ✅
- DELETE → 405 Method Not Allowed ✅

---

### 5. Security Headers ✅

**Finding:** All recommended security headers are present.

**Evidence (class-wfca-fire-api.php:585-589):**
```php
header('Content-Type: application/json');
header('Cache-Control: public, max-age=' . WFCA_CACHE_DURATION);
header('X-Content-Type-Options: nosniff');
header('X-Frame-Options: DENY');
header('Referrer-Policy: strict-origin-when-cross-origin');
```

| Header | Value | Purpose |
|--------|-------|---------|
| X-Content-Type-Options | nosniff | Prevents MIME sniffing |
| X-Frame-Options | DENY | Prevents clickjacking |
| Referrer-Policy | strict-origin-when-cross-origin | Limits referrer exposure |
| Content-Type | application/json | Explicit content type |

---

### 6. Sensitive Data Exposure ✅

**Finding:** Error responses do not expose sensitive information.

**Error response format:**
```json
{"error": "Unable to fetch fire data"}
```

**Verified NOT exposed:**
- Database credentials (WFCA_PG_HOST, WFCA_PG_PASS)
- Server file paths (/Users/, /home/, /var/www/)
- PHP stack traces
- SQL error messages

---

### 7. Cache Security ✅

**Finding:** Cache directory is protected.

**Evidence (class-wfca-fire-api.php:155):**
```php
@file_put_contents(WFCA_CACHE_DIR . '/.htaccess', "Require all denied\n");
```

**widgets/cache/.htaccess content:**
```apache
Require all denied
```

---

## Recommendations

### Minor Improvements

1. **Add Content-Security-Policy header** (optional, low priority)
   ```php
   header("Content-Security-Policy: default-src 'none'");
   ```

2. **Add rate limiting** (recommended for production)
   - Consider implementing request throttling to prevent API abuse
   - Could use file-based tracking or Redis for distributed systems

3. **Remove localhost from CORS whitelist in production**
   ```php
   // Remove these in production deployment:
   // 'http://localhost:3000',
   // 'http://localhost:8000',
   ```

4. **Consider adding Subresource Integrity (SRI)** for the widget script
   ```html
   <script src="fire-widget.js"
           integrity="sha384-..."
           crossorigin="anonymous"></script>
   ```

---

## Running the Security Tests

```bash
cd widgets/tests
npm install
npm run test:security
```

**Test files:**
- `security.spec.ts` - SQL injection, XSS, CORS, headers, data exposure
- `widget.spec.ts` - Functional widget tests
- `api.spec.ts` - API response structure tests

---

## Conclusion

The WFCA Fire Widget implementation follows security best practices:

- ✅ Input validation and sanitization
- ✅ Parameterized SQL queries (no injection possible)
- ✅ HTML escaping for XSS prevention
- ✅ Whitelist-based CORS
- ✅ Security headers
- ✅ Protected cache directory
- ✅ No sensitive data leakage

**Risk Level: LOW**

The widget is suitable for production deployment pending the minor recommendations above.
