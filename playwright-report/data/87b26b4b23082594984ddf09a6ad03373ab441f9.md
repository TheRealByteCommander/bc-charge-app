# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: charging-flow.spec.ts >> Charging Flow Smoke Test >> User History: Accessing past sessions
- Location: e2e/charging-flow.spec.ts:50:3

# Error details

```
Error: page.goto: NS_ERROR_CONNECTION_REFUSED
Call log:
  - navigating to "http://localhost:5173/", waiting until "load"

```

# Page snapshot

```yaml
- article "Unable to connect" [ref=e3]:
  - img "Illustration of a fox looking at disconnected network cables." [ref=e5]
  - generic [ref=e7]:
    - heading "Unable to connect" [level=1] [ref=e8]
    - paragraph [ref=e9]:
      - text: Nightly can’t connect to the server at
      - strong [ref=e10]: localhost:5173
    - generic [ref=e11]:
      - heading "What can you do about it?" [level=3] [ref=e12]
      - list [ref=e13]:
        - listitem [ref=e14]: The site could be temporarily unavailable or too busy. Try again in a few moments.
        - listitem [ref=e15]: If you are unable to load any pages, check your computer’s network connection.
        - listitem [ref=e16]: If your computer or network is protected by a firewall or proxy, make sure that Nightly is permitted to access the web.
    - button "Try Again" [ref=e19]:
      - generic [ref=e21]:
        - generic: Try Again
```

# Test source

```ts
  1  | import { test, expect } from '@playwright/test';
  2  | 
  3  | /**
  4  |  * Core Charging Flow Smoke Test
  5  |  * This test validates that the critical UI paths for starting and stopping a charge are accessible.
  6  |  * In a full CI environment, this would be coupled with a seed script that ensures
  7  |  * a test user and a test station exist in the database.
  8  |  */
  9  | 
  10 | test.describe('Charging Flow Smoke Test', () => {
  11 |   
  12 |   test.beforeEach(async ({ page }) => {
  13 |     // Setup: Ensure we are at the root and the app has loaded
> 14 |     await page.goto('/');
     |                ^ Error: page.goto: NS_ERROR_CONNECTION_REFUSED
  15 |     await expect(page).toHaveTitle(/BC Charge/);
  16 |   });
  17 | 
  18 |   test('Critical Path: Station Selection and Start Attempt', async ({ page }) => {
  19 |     // 1. Discovery: Try to find a station
  20 |     // Note: In real E2E, we use data-testid for stability
  21 |     const stationMarker = page.locator('[data-testid="station-marker"]').first();
  22 |     
  23 |     // If no stations are present (common in fresh dev envs), we skip but log
  24 |     if (await stationMarker.count() === 0) {
  25 |       console.log('No stations found. Please seed the database with test stations.');
  26 |       test.skip();
  27 |     }
  28 | 
  29 |     await stationMarker.click();
  30 | 
  31 |     // 2. Detail View: Verify we can see the price and a start button
  32 |     const detailsView = page.locator('[data-testid="station-details"]');
  33 |     await expect(detailsView).toBeVisible();
  34 |     
  35 |     const startButton = page.locator('button:has-text("Start Charging")');
  36 |     await expect(startButton).toBeVisible();
  37 | 
  38 |     // 3. Interaction: Attempt to start
  39 |     // We don't expect this to actually start a physical charger in the smoke test,
  40 |     // but we verify the app triggers the auth/payment flow.
  41 |     await startButton.click();
  42 |     
  43 |     // Verify we transition to either the active session view or the login/payment prompt
  44 |     const activeSession = page.locator('[data-testid="active-charging-view"]');
  45 |     const authPrompt = page.locator('[data-testid="auth-prompt"]');
  46 |     
  47 |     await expect(activeSession.or(authPrompt)).toBeVisible({ timeout: 5000 });
  48 |   });
  49 | 
  50 |   test('User History: Accessing past sessions', async ({ page }) => {
  51 |     // Navigate to history
  52 |     await page.click('text=History');
  53 |     await expect(page.locator('[data-testid="charging-history-list"]')).toBeVisible();
  54 |   });
  55 | });
  56 | 
```