import { expect, test } from '@playwright/test';

test.describe('Marketing Landing Page', () => {
  test('should load successfully and show correct title and launch CTA', async ({
    page,
  }) => {
    // Navigate to marketing site root
    await page.goto('/');

    // Check title
    await expect(page).toHaveTitle(/FlowerSandbox/i);

    // Verify hero launch app button exists and links to /app
    const ctaButton = page.locator('#btn-hero-webapp');
    await expect(ctaButton).toBeVisible();
    await expect(ctaButton).toHaveAttribute('href', '/app');

    // Clicking it should navigate to the app loader route
    await ctaButton.click();
    await expect(page).toHaveURL(/\/app/);
  });
});
