import { expect, test } from '@playwright/test';

test.describe('App Garden Interaction', () => {
  test('should load app, plant flowers on tap, and navigate tabs', async ({
    page,
  }) => {
    // 1. Navigate to the Web App root
    await page.goto('/app');

    // Wait for the app layout to load (checking for title)
    const brandTitle = page.locator('text=FlowerSandbox').first();
    await expect(brandTitle).toBeVisible({ timeout: 10000 });

    // Verify initial flower count text is 0 initially (State count begins at 0)
    const statusText = page.locator('text=planted').first();
    await expect(statusText).toBeVisible();
    await expect(statusText).toContainText(/0/);

    // 2. Locate the flower-field container and tap it
    const flowerField = page.getByTestId('flower-field');
    await expect(flowerField).toBeVisible();

    // Click on the flower field to plant a new flower
    await flowerField.click({ position: { x: 150, y: 150 } });

    // Verify flower count increments to 1
    await expect(statusText).toContainText(/1/);

    // 3. Test Tab Navigation to the About page
    const aboutTabButton = page.getByTestId('tab-button-about');
    await expect(aboutTabButton).toBeVisible();
    await aboutTabButton.click();

    // Verify we navigate to about tab
    await expect(page).toHaveURL(/\/app\/about/);

    // Verify content on the About page is visible (checking for version text)
    const versionText = page.locator('text=Version').first();
    await expect(versionText).toBeVisible();

    // Go back to Home tab
    const homeTabButton = page.getByTestId('tab-button-index');
    await expect(homeTabButton).toBeVisible();
    await homeTabButton.click();
    await expect(page).toHaveURL(/\/app/);
  });
});
