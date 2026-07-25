import { test, expect } from '@playwright/test';

test.describe('Charging Flow', () => {
  test('should allow user to find a charger and start a session', async ({ page }) => {
    // 1. Navigate to charger map/list
    await page.goto('/chargers');
    await expect(page).toHaveTitle(/Chargers/i);

    // 2. Select a charger from the list
    const chargerItem = page.locator('.charger-item').first();
    await expect(chargerItem).toBeVisible();
    await chargerItem.click();

    // 3. Verify charger details page
    await expect(page).toHaveURL(/.*\/charger\/\d+/);
    await expect(page.locator('h1')).toContainText('Charger Details');

    // 4. Start charging process
    const startButton = page.locator('button:has-text("Start Charging")');
    await expect(startButton).toBeEnabled();
    await startButton.click();

    // 5. Confirm session start (assuming a confirmation modal or success message)
    const successMessage = page.locator('.charging-status-success');
    await expect(successMessage).toBeVisible();
    await expect(successMessage).toContainText('Charging started');
  });

  test('should handle authorization failure', async ({ page }) => {
    await page.goto('/chargers');
    await page.locator('.charger-item').first().click();
    
    // Simulate invalid RFID/User
    await page.fill('input[name="rfid"]', 'INVALID_ID');
    await page.click('button:has-text("Authorize")');

    const errorMessage = page.locator('.error-message');
    await expect(errorMessage).toBeVisible();
    await expect(errorMessage).toContainText('Authorization failed');
  });
});
