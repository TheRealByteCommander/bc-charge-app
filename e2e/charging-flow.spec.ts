import { test, expect } from '@playwright/test';

/**
 * Core Charging Flow Smoke Test
 * This test validates that the critical UI paths for starting and stopping a charge are accessible.
 * In a full CI environment, this would be coupled with a seed script that ensures
 * a test user and a test station exist in the database.
 */

test.describe('Charging Flow Smoke Test', () => {
  
  test.beforeEach(async ({ page }) => {
    // Setup: Ensure we are at the root and the app has loaded
    await page.goto('/');
    await expect(page).toHaveTitle(/BC Charge/);
  });

  test('Critical Path: Station Selection and Start Attempt', async ({ page }) => {
    // 1. Discovery: Try to find a station
    // Note: In real E2E, we use data-testid for stability
    const stationMarker = page.locator('[data-testid="station-marker"]').first();
    
    // If no stations are present (common in fresh dev envs), we skip but log
    if (await stationMarker.count() === 0) {
      console.log('No stations found. Please seed the database with test stations.');
      test.skip();
    }

    await stationMarker.click();

    // 2. Detail View: Verify we can see the price and a start button
    const detailsView = page.locator('[data-testid="station-details"]');
    await expect(detailsView).toBeVisible();
    
    const startButton = page.locator('button:has-text("Start Charging")');
    await expect(startButton).toBeVisible();

    // 3. Interaction: Attempt to start
    // We don't expect this to actually start a physical charger in the smoke test,
    // but we verify the app triggers the auth/payment flow.
    await startButton.click();
    
    // Verify we transition to either the active session view or the login/payment prompt
    const activeSession = page.locator('[data-testid="active-charging-view"]');
    const authPrompt = page.locator('[data-testid="auth-prompt"]');
    
    await expect(activeSession.or(authPrompt)).toBeVisible({ timeout: 5000 });
  });

  test('User History: Accessing past sessions', async ({ page }) => {
    // Navigate to history
    await page.click('text=History');
    await expect(page.locator('[data-testid="charging-history-list"]')).toBeVisible();
  });
});
