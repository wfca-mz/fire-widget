/**
 * API Functional Tests for WFCA Fire API
 *
 * Tests cover:
 * - Basic API responses
 * - Parameter handling
 * - Response structure
 * - Caching behavior
 */

import { test, expect, request } from '@playwright/test';

const getApiUrl = (baseURL: string) => `${baseURL}/class-wfca-fire-api.php`;

test.describe('API Basic Functionality', () => {

  test('should return JSON response', async ({ baseURL }) => {
    const apiContext = await request.newContext();
    const response = await apiContext.get(getApiUrl(baseURL!), {
      params: { limit: '5' }
    });

    expect(response.headers()['content-type']).toBe('application/json');
  });

  test('should return valid response structure', async ({ baseURL }) => {
    const apiContext = await request.newContext();
    const response = await apiContext.get(getApiUrl(baseURL!), {
      params: { limit: '5' }
    });

    const data = await response.json();

    // Should have meta and fires
    expect(data).toHaveProperty('meta');
    expect(data).toHaveProperty('fires');

    // Meta should have expected fields
    expect(data.meta).toHaveProperty('generated_at');
    expect(data.meta).toHaveProperty('count');
    expect(data.meta).toHaveProperty('cached');
    expect(data.meta).toHaveProperty('cache_ttl');

    // Fires should be an array
    expect(Array.isArray(data.fires)).toBe(true);
  });

  test('should return fire objects with expected fields', async ({ baseURL }) => {
    const apiContext = await request.newContext();
    const response = await apiContext.get(getApiUrl(baseURL!), {
      params: { limit: '1' }
    });

    const data = await response.json();

    if (data.fires.length > 0) {
      const fire = data.fires[0];

      expect(fire).toHaveProperty('id');
      expect(fire).toHaveProperty('name');
      expect(fire).toHaveProperty('irwin_id');
      expect(fire).toHaveProperty('updated');
      expect(fire).toHaveProperty('acres');
      expect(fire).toHaveProperty('state');
      expect(fire).toHaveProperty('county');
      expect(fire).toHaveProperty('map_url');
      expect(fire).toHaveProperty('coords');

      // Coords should have lat, lng, zoom
      expect(fire.coords).toHaveProperty('lat');
      expect(fire.coords).toHaveProperty('lng');
      expect(fire.coords).toHaveProperty('zoom');
    }
  });

});

test.describe('API Parameters', () => {

  test('should respect limit parameter', async ({ baseURL }) => {
    const apiContext = await request.newContext();
    const response = await apiContext.get(getApiUrl(baseURL!), {
      params: { limit: '3' }
    });

    const data = await response.json();
    expect(data.fires.length).toBeLessThanOrEqual(3);
  });

  test('should cap limit at 100', async ({ baseURL }) => {
    const apiContext = await request.newContext();
    const response = await apiContext.get(getApiUrl(baseURL!), {
      params: { limit: '500' }
    });

    const data = await response.json();
    expect(data.fires.length).toBeLessThanOrEqual(100);
  });

  test('should filter by state parameter', async ({ baseURL }) => {
    const apiContext = await request.newContext();
    const response = await apiContext.get(getApiUrl(baseURL!), {
      params: { state: 'CA', limit: '50' }
    });

    const data = await response.json();

    // All fires should be in California
    for (const fire of data.fires) {
      const state = fire.state?.replace('US-', '');
      expect(['CA', 'US-CA', '']).toContain(state || '');
    }
  });

  test('should filter by search parameter', async ({ baseURL }) => {
    const apiContext = await request.newContext();

    // First get a fire name to search for
    const initialResponse = await apiContext.get(getApiUrl(baseURL!), {
      params: { limit: '1' }
    });
    const initialData = await initialResponse.json();

    if (initialData.fires.length > 0) {
      const fireName = initialData.fires[0].name;
      const searchTerm = fireName.substring(0, 4).toUpperCase();

      const searchResponse = await apiContext.get(getApiUrl(baseURL!), {
        params: { search: searchTerm, limit: '50' }
      });
      const searchData = await searchResponse.json();

      // Should find at least the original fire
      const foundNames = searchData.fires.map((f: any) => f.name.toUpperCase());
      const hasMatch = foundNames.some((name: string) => name.includes(searchTerm));
      expect(hasMatch).toBe(true);
    }
  });

  test('should handle empty results gracefully', async ({ baseURL }) => {
    const apiContext = await request.newContext();
    const response = await apiContext.get(getApiUrl(baseURL!), {
      params: { search: 'XYZNONEXISTENT999', limit: '10' }
    });

    expect(response.ok()).toBe(true);
    const data = await response.json();

    expect(data.fires).toEqual([]);
    expect(data.meta.count).toBe(0);
  });

});

test.describe('API Caching', () => {

  test('should include cache header', async ({ baseURL }) => {
    const apiContext = await request.newContext();
    const response = await apiContext.get(getApiUrl(baseURL!), {
      params: { limit: '5' }
    });

    const cacheControl = response.headers()['cache-control'];
    expect(cacheControl).toContain('max-age=');
  });

  test('should indicate cache status in response', async ({ baseURL }) => {
    const apiContext = await request.newContext();

    // First request
    const response1 = await apiContext.get(getApiUrl(baseURL!), {
      params: { limit: '5' }
    });
    const data1 = await response1.json();

    // Second request should hit cache
    const response2 = await apiContext.get(getApiUrl(baseURL!), {
      params: { limit: '5' }
    });
    const data2 = await response2.json();

    // At least one should indicate cached status
    expect(data1.meta.cached === true || data2.meta.cached === true).toBe(true);
  });

});

test.describe('API Map URLs', () => {

  test('should generate valid fire map URLs', async ({ baseURL }) => {
    const apiContext = await request.newContext();
    const response = await apiContext.get(getApiUrl(baseURL!), {
      params: { limit: '5' }
    });

    const data = await response.json();

    for (const fire of data.fires) {
      expect(fire.map_url).toMatch(/^https:\/\/fire-map\.wfca\.com\/\?lng=/);
      expect(fire.map_url).toContain('lat=');
      expect(fire.map_url).toContain('zoom=');

      // Coordinates should be valid
      expect(fire.coords.lat).toBeGreaterThan(-90);
      expect(fire.coords.lat).toBeLessThan(90);
      expect(fire.coords.lng).toBeGreaterThan(-180);
      expect(fire.coords.lng).toBeLessThan(180);
      expect(fire.coords.zoom).toBeGreaterThan(0);
      expect(fire.coords.zoom).toBeLessThan(20);
    }
  });

});
