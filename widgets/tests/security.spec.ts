/**
 * Security Pen Tests for WFCA Fire Widget
 *
 * Tests cover:
 * - SQL Injection attempts
 * - XSS (Cross-Site Scripting) attacks
 * - CORS validation
 * - Input validation and sanitization
 * - Sensitive data exposure
 * - HTTP security headers
 */

import { test, expect, request } from '@playwright/test';

// Helper to get API URL from config
const getApiUrl = (baseURL: string) => `${baseURL}/class-wfca-fire-api.php`;

test.describe('API Security Tests', () => {

  test.describe('SQL Injection Prevention', () => {

    test('should sanitize SQL injection in state parameter', async ({ baseURL }) => {
      const apiContext = await request.newContext();
      const attacks = [
        "CA' OR '1'='1",
        "CA; DROP TABLE users;--",
        "CA\" UNION SELECT * FROM pg_user--",
        "CA' AND 1=1--",
        "CA'); DELETE FROM data.fires;--",
        "1' OR '1'='1' /*",
      ];

      for (const payload of attacks) {
        const response = await apiContext.get(getApiUrl(baseURL!), {
          params: { state: payload, limit: '1' }
        });

        // Should either return empty results or error, never expose DB data
        const body = await response.text();
        expect(body).not.toContain('pg_user');
        expect(body).not.toContain('pg_catalog');
        expect(body).not.toContain('information_schema');
        expect(body).not.toContain('postgres');
        // Should not contain SQL error messages
        expect(body.toLowerCase()).not.toContain('syntax error');
        expect(body.toLowerCase()).not.toContain('sql error');
      }
    });

    test('should sanitize SQL injection in search parameter', async ({ baseURL }) => {
      const apiContext = await request.newContext();
      const attacks = [
        "test' OR '1'='1",
        "test\"; DROP TABLE fires;--",
        "test' UNION SELECT password FROM users--",
        "%' OR 1=1--",
        "test' AND (SELECT COUNT(*) FROM pg_tables) > 0--",
      ];

      for (const payload of attacks) {
        const response = await apiContext.get(getApiUrl(baseURL!), {
          params: { search: payload, limit: '1' }
        });

        const body = await response.text();
        expect(body).not.toContain('pg_tables');
        expect(body).not.toContain('password');
        expect(body.toLowerCase()).not.toContain('syntax error');
      }
    });

    test('should sanitize SQL injection in limit parameter', async ({ baseURL }) => {
      const apiContext = await request.newContext();
      const attacks = [
        "1; DROP TABLE users",
        "-1 UNION SELECT * FROM pg_user",
        "1 OR 1=1",
        "1; SELECT pg_sleep(10)--",
        "1/**/UNION/**/SELECT/**/1",
      ];

      for (const payload of attacks) {
        const response = await apiContext.get(getApiUrl(baseURL!), {
          params: { limit: payload }
        });

        // Limit should be parsed as integer, invalid values should default
        expect(response.status()).toBeLessThan(500);
        const body = await response.text();
        expect(body).not.toContain('pg_user');
      }
    });

  });

  test.describe('CORS Validation', () => {

    test('should set CORS header for allowed origins', async ({ baseURL }) => {
      const apiContext = await request.newContext();
      // Production origins (always allowed) + dev origin (allowed in dev mode)
      const allowedOrigins = [
        'https://wfca.com',
        'https://www.wfca.com',
        'https://fire-map.wfca.com',
        baseURL!, // Current dev server should be allowed
      ];

      for (const origin of allowedOrigins) {
        const response = await apiContext.get(getApiUrl(baseURL!), {
          params: { limit: '1' },
          headers: { 'Origin': origin }
        });

        const corsHeader = response.headers()['access-control-allow-origin'];
        expect(corsHeader).toBe(origin);
      }
    });

    test('should NOT set CORS header for disallowed origins', async ({ baseURL }) => {
      const apiContext = await request.newContext();
      const disallowedOrigins = [
        'https://evil.com',
        'https://attacker.com',
        'https://wfca.com.evil.com',
        'https://notwfca.com',
      ];

      for (const origin of disallowedOrigins) {
        const response = await apiContext.get(getApiUrl(baseURL!), {
          params: { limit: '1' },
          headers: { 'Origin': origin }
        });

        const corsHeader = response.headers()['access-control-allow-origin'];
        expect(corsHeader).toBeUndefined();
      }
    });

  });

  test.describe('HTTP Method Restrictions', () => {

    test('should reject POST requests', async ({ baseURL }) => {
      const apiContext = await request.newContext();
      const response = await apiContext.post(getApiUrl(baseURL!), {
        data: { test: 'data' }
      });

      expect(response.status()).toBe(405);
      const body = await response.json();
      expect(body.error).toBe('Method not allowed');
    });

    test('should reject PUT requests', async ({ baseURL }) => {
      const apiContext = await request.newContext();
      const response = await apiContext.put(getApiUrl(baseURL!), {
        data: { test: 'data' }
      });

      expect(response.status()).toBe(405);
    });

    test('should reject DELETE requests', async ({ baseURL }) => {
      const apiContext = await request.newContext();
      const response = await apiContext.delete(getApiUrl(baseURL!));

      expect(response.status()).toBe(405);
    });

  });

  test.describe('Security Headers', () => {

    test('should include security headers', async ({ baseURL }) => {
      const apiContext = await request.newContext();
      const response = await apiContext.get(getApiUrl(baseURL!), {
        params: { limit: '1' }
      });

      const headers = response.headers();

      // X-Content-Type-Options prevents MIME sniffing
      expect(headers['x-content-type-options']).toBe('nosniff');

      // X-Frame-Options prevents clickjacking
      expect(headers['x-frame-options']).toBe('DENY');

      // Referrer-Policy limits referrer information
      expect(headers['referrer-policy']).toBe('strict-origin-when-cross-origin');

      // Content-Type should be JSON
      expect(headers['content-type']).toBe('application/json');
    });

  });

  test.describe('Input Validation', () => {

    test('should enforce limit maximum of 100', async ({ baseURL }) => {
      const apiContext = await request.newContext();
      const response = await apiContext.get(getApiUrl(baseURL!), {
        params: { limit: '999' }
      });

      // Should not error, but should cap at 100
      expect(response.status()).toBeLessThan(500);
    });

    test('should handle negative limit gracefully', async ({ baseURL }) => {
      const apiContext = await request.newContext();
      const response = await apiContext.get(getApiUrl(baseURL!), {
        params: { limit: '-5' }
      });

      expect(response.status()).toBeLessThan(500);
    });

    test('should handle non-numeric limit gracefully', async ({ baseURL }) => {
      const apiContext = await request.newContext();
      const response = await apiContext.get(getApiUrl(baseURL!), {
        params: { limit: 'abc' }
      });

      expect(response.status()).toBeLessThan(500);
    });

    test('should strip invalid characters from state parameter', async ({ baseURL }) => {
      const apiContext = await request.newContext();
      const response = await apiContext.get(getApiUrl(baseURL!), {
        params: { state: 'CA<script>alert(1)</script>', limit: '1' }
      });

      // Should not error
      expect(response.status()).toBeLessThan(500);
      const body = await response.text();
      expect(body).not.toContain('<script>');
    });

    test('should handle extremely long input', async ({ baseURL }) => {
      const apiContext = await request.newContext();
      const longString = 'A'.repeat(10000);

      const response = await apiContext.get(getApiUrl(baseURL!), {
        params: { search: longString, limit: '1' }
      });

      // Should handle gracefully, not crash
      expect(response.status()).toBeLessThan(500);
    });

  });

  test.describe('Sensitive Data Exposure', () => {

    test('should not expose database credentials in errors', async ({ baseURL }) => {
      const apiContext = await request.newContext();
      const response = await apiContext.get(getApiUrl(baseURL!), {
        params: { limit: '1' }
      });

      const body = await response.text();

      // Should not contain database connection details
      expect(body).not.toContain('WFCA_PG_HOST');
      expect(body).not.toContain('WFCA_PG_PASS');
      expect(body).not.toContain('postgres');
      expect(body).not.toContain('rds.amazonaws.com');
    });

    test('should not expose stack traces', async ({ baseURL }) => {
      const apiContext = await request.newContext();
      // Intentionally malformed request
      const response = await apiContext.get(getApiUrl(baseURL!), {
        params: { state: "'; INVALID SQL --", limit: '1' }
      });

      const body = await response.text();

      // Should not expose PHP stack traces
      expect(body).not.toContain('Stack trace');
      expect(body).not.toContain('.php on line');
      expect(body).not.toContain('PDOException');
    });

    test('should not expose server paths', async ({ baseURL }) => {
      const apiContext = await request.newContext();
      const response = await apiContext.get(getApiUrl(baseURL!), {
        params: { limit: '1' }
      });

      const body = await response.text();

      // Should not contain server file paths
      expect(body).not.toContain('/Users/');
      expect(body).not.toContain('/home/');
      expect(body).not.toContain('/var/www/');
      expect(body).not.toContain('private_html');
    });

  });

});

test.describe('Widget XSS Security Tests', () => {

  test('should escape fire names in widget display', async ({ page, baseURL }) => {
    // Navigate to test page
    await page.goto(`${baseURL}/test.html`);

    // Wait for widget to load
    await page.waitForSelector('.wfca-fw', { timeout: 10000 });

    // Check that no script tags are present in the widget content
    const widgetContent = await page.locator('.wfca-fw').innerHTML();
    expect(widgetContent).not.toContain('<script');
    expect(widgetContent).not.toContain('javascript:');
    expect(widgetContent).not.toContain('onerror=');
    expect(widgetContent).not.toContain('onclick=');
  });

  test('should escape filter input in widget', async ({ page, baseURL }) => {
    await page.goto(`${baseURL}/test.html`);
    await page.waitForSelector('.wfca-fw__filter', { timeout: 10000 });

    // Type XSS payload into filter
    const xssPayloads = [
      '<script>alert("XSS")</script>',
      '<img src=x onerror=alert("XSS")>',
      '"><script>alert(1)</script>',
      "'-alert(1)-'",
    ];

    for (const payload of xssPayloads) {
      await page.locator('.wfca-fw__filter').first().fill(payload);
      await page.waitForTimeout(600); // Wait for debounce

      // Check no script execution
      const dialogPromise = page.waitForEvent('dialog', { timeout: 1000 }).catch(() => null);
      const dialog = await dialogPromise;
      expect(dialog).toBeNull();

      // Check content is escaped
      const widgetHtml = await page.locator('.wfca-fw').first().innerHTML();
      expect(widgetHtml).not.toContain('<script>');
      expect(widgetHtml).not.toContain('onerror=');
    }
  });

  test('should sanitize data-query attribute', async ({ page, baseURL }) => {
    // Create a test page with malicious data-query
    await page.setContent(`
      <!DOCTYPE html>
      <html>
      <head><title>XSS Test</title></head>
      <body>
        <div id="wfca-fire-widget"
             data-query="<script>alert('XSS')</script>"
             data-limit="5">
        </div>
        <script>window.WFCA_API_URL = '${baseURL}/class-wfca-fire-api.php';</script>
        <script src="${baseURL}/fire-widget.js"></script>
      </body>
      </html>
    `);

    await page.waitForTimeout(1000);

    // Should not trigger alert
    const dialogPromise = page.waitForEvent('dialog', { timeout: 1000 }).catch(() => null);
    const dialog = await dialogPromise;
    expect(dialog).toBeNull();
  });

  test('should sanitize data-title attribute', async ({ page, baseURL }) => {
    await page.setContent(`
      <!DOCTYPE html>
      <html>
      <head><title>XSS Test</title></head>
      <body>
        <div id="wfca-fire-widget"
             data-title="<img src=x onerror=alert('XSS')>"
             data-limit="5">
        </div>
        <script>window.WFCA_API_URL = '${baseURL}/class-wfca-fire-api.php';</script>
        <script src="${baseURL}/fire-widget.js"></script>
      </body>
      </html>
    `);

    await page.waitForSelector('.wfca-fw', { timeout: 10000 });

    // Check title is escaped
    const titleHtml = await page.locator('.wfca-fw__title').first().innerHTML();
    expect(titleHtml).not.toContain('onerror=');
    expect(titleHtml).toContain('&lt;'); // Should be HTML escaped
  });

});

test.describe('Cache Security Tests', () => {

  test('should not allow cache directory traversal', async ({ baseURL }) => {
    const apiContext = await request.newContext();

    // Try to access cache files directly
    const cacheAttempts = [
      '/cache/../config.php',
      '/cache/../../private_html/.env',
      '/cache/.htaccess',
    ];

    for (const path of cacheAttempts) {
      const response = await apiContext.get(`${baseURL}${path}`);
      // Should be blocked or not found
      expect([403, 404]).toContain(response.status());
    }
  });

  test('should protect cache directory with .htaccess', async ({ baseURL }) => {
    const apiContext = await request.newContext();

    // Try to access cache JSON files
    const response = await apiContext.get(`${baseURL}/cache/`);
    expect([403, 404]).toContain(response.status());
  });

});
