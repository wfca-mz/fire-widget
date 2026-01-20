/**
 * Functional Tests for WFCA Fire Widget
 *
 * Tests cover:
 * - Widget loading and initialization
 * - Theme switching (light/dark)
 * - Filtering and sorting
 * - Pagination
 * - Compact mode
 * - Query preloading
 */

import { test, expect } from '@playwright/test';

test.describe('Widget Initialization', () => {

  test('should load widget on test.html', async ({ page, baseURL }) => {
    await page.goto(`${baseURL}/test.html`);
    await page.waitForSelector('.wfca-fw', { timeout: 10000 });

    const title = await page.locator('.wfca-fw__title').first().textContent();
    expect(title).toContain('Active Wildfires');
  });

  test('should display fire count in header', async ({ page, baseURL }) => {
    await page.goto(`${baseURL}/test.html`);
    await page.waitForSelector('.wfca-fw__count', { timeout: 10000 });

    const count = await page.locator('.wfca-fw__count').first().textContent();
    expect(count).toMatch(/^\d+$/);
  });

  test('should inject styles only once', async ({ page, baseURL }) => {
    await page.goto(`${baseURL}/test.html`);
    await page.waitForSelector('.wfca-fw', { timeout: 10000 });

    const styleCount = await page.locator('#wfca-fw-styles').count();
    expect(styleCount).toBe(1);
  });

  test('should expose WFCAFireWidget global object', async ({ page, baseURL }) => {
    await page.goto(`${baseURL}/test.html`);
    await page.waitForSelector('.wfca-fw', { timeout: 10000 });

    const hasGlobal = await page.evaluate(() => {
      return typeof (window as any).WFCAFireWidget === 'object' &&
             typeof (window as any).WFCAFireWidget.init === 'function';
    });
    expect(hasGlobal).toBe(true);
  });

});

test.describe('Widget Themes', () => {

  test('should render light theme by default', async ({ page, baseURL }) => {
    await page.goto(`${baseURL}/test.html`);
    await page.waitForSelector('.wfca-fw', { timeout: 10000 });

    const firstWidget = page.locator('.wfca-fw').first();
    const hasLightTheme = await firstWidget.evaluate(el => !el.classList.contains('wfca-fw--dark'));
    expect(hasLightTheme).toBe(true);
  });

  test('should render dark theme when specified', async ({ page, baseURL }) => {
    await page.goto(`${baseURL}/test.html`);
    await page.waitForSelector('.wfca-fw--dark', { timeout: 10000 });

    const darkWidget = page.locator('.wfca-fw--dark').first();
    await expect(darkWidget).toBeVisible();
  });

});

test.describe('Widget Filtering', () => {

  test('should have filter input', async ({ page, baseURL }) => {
    await page.goto(`${baseURL}/test.html`);
    await page.waitForSelector('.wfca-fw__filter', { timeout: 10000 });

    const filterInput = page.locator('.wfca-fw__filter').first();
    await expect(filterInput).toBeVisible();
  });

  test('should show empty state when no results', async ({ page, baseURL }) => {
    await page.goto(`${baseURL}/test.html`);
    await page.waitForSelector('.wfca-fw__filter', { timeout: 10000 });

    await page.locator('.wfca-fw__filter').first().fill('XYZNONEXISTENT999');
    await page.waitForTimeout(600);

    await page.waitForSelector('.wfca-fw__empty', { timeout: 10000 });
    const emptyText = await page.locator('.wfca-fw__empty').first().textContent();
    expect(emptyText).toContain('No fires');
  });

});

test.describe('Widget Sorting', () => {

  test('should have sortable column headers', async ({ page, baseURL }) => {
    await page.goto(`${baseURL}/test.html`);
    await page.waitForSelector('.wfca-fw__table-header', { timeout: 10000 });

    const sortableHeaders = page.locator('.wfca-fw__table-header [data-sort]');
    const count = await sortableHeaders.count();
    expect(count).toBe(4);
  });

  test('should sort by name when clicked', async ({ page, baseURL }) => {
    await page.goto(`${baseURL}/test.html`);
    await page.waitForSelector('[data-sort="name"]', { timeout: 10000 });

    await page.locator('[data-sort="name"]').first().click();
    await page.waitForTimeout(300);

    const sortIcon = await page.locator('[data-sort="name"] .wfca-fw__sort-icon').first().textContent();
    expect(['▲', '▼']).toContain(sortIcon?.trim());
  });

});

test.describe('Widget Pagination', () => {

  test('should show pagination when more than 10 fires', async ({ page, baseURL }) => {
    await page.goto(`${baseURL}/test.html`);
    await page.waitForSelector('.wfca-fw', { timeout: 10000 });

    const fireCount = await page.locator('.wfca-fw__count').first().textContent();

    if (parseInt(fireCount || '0') > 10) {
      const pagination = page.locator('.wfca-fw__pagination').first();
      await expect(pagination).toBeVisible();
    }
  });

  test('should disable prev button on first page', async ({ page, baseURL }) => {
    await page.goto(`${baseURL}/test.html`);
    await page.waitForSelector('.wfca-fw__pagination', { timeout: 10000 });

    const prevButton = page.locator('.wfca-fw__page-btn[data-page="prev"]').first();
    await expect(prevButton).toBeDisabled();
  });

});

test.describe('Compact Mode', () => {

  test('should render compact mode when specified', async ({ page, baseURL }) => {
    await page.goto(`${baseURL}/test.html`);
    await page.waitForSelector('.wfca-fw--compact', { timeout: 10000 });

    const compactWidget = page.locator('.wfca-fw--compact').first();
    await expect(compactWidget).toBeVisible();
  });

  test('compact mode should hide controls', async ({ page, baseURL }) => {
    await page.goto(`${baseURL}/test.html`);
    await page.waitForSelector('.wfca-fw--compact', { timeout: 10000 });

    const controls = page.locator('.wfca-fw--compact .wfca-fw__controls');
    await expect(controls).toHaveCSS('display', 'none');
  });

});

test.describe('Fire Data Display', () => {

  test('should display fire name as link', async ({ page, baseURL }) => {
    await page.goto(`${baseURL}/test.html`);
    await page.waitForSelector('.wfca-fw__link', { timeout: 10000 });

    const link = page.locator('.wfca-fw__link').first();
    await expect(link).toHaveAttribute('href', /fire-map\.wfca\.com/);
    await expect(link).toHaveAttribute('target', '_blank');
  });

  test('should display acreage badge', async ({ page, baseURL }) => {
    await page.goto(`${baseURL}/test.html`);
    await page.waitForSelector('.wfca-fw__acres', { timeout: 10000 });

    const acres = page.locator('.wfca-fw__acres').first();
    await expect(acres).toBeVisible();
  });

});
