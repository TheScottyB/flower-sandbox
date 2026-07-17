import { expect, test } from '@playwright/test';

test.describe('Marketing Site Secondary Pages', () => {
  test.beforeEach(async ({ page }) => {
    // Start at landing page
    await page.goto('/');
  });

  test('should navigate to Support page from footer and display correct elements', async ({
    page,
  }) => {
    const supportLink = page.locator('#foot-link-support');
    await expect(supportLink).toBeVisible();
    await supportLink.click();

    // Verify URL is /support or /support.html
    await expect(page).toHaveURL(/.*support.*/);

    // Verify main page heading
    const mainHeading = page.locator('h1');
    await expect(mainHeading).toContainText(/Support/i);

    // Verify support email is present
    const supportEmail = page.locator('text=beilsco@gmail.com');
    await expect(supportEmail).toBeVisible();

    // Verify support form fields exist
    const nameInput = page.locator('#contact-name');
    const emailInput = page.locator('#contact-email');
    const messageInput = page.locator('#contact-message');
    await expect(nameInput).toBeVisible();
    await expect(emailInput).toBeVisible();
    await expect(messageInput).toBeVisible();
  });

  test('should navigate to Privacy Policy page from footer and display correct elements', async ({
    page,
  }) => {
    const privacyLink = page.locator('#foot-link-privacy');
    await expect(privacyLink).toBeVisible();
    await privacyLink.click();

    // Verify URL
    await expect(page).toHaveURL(/.*privacy.*/);

    // Verify page title/heading
    const mainHeading = page.locator('h1');
    await expect(mainHeading).toContainText(/Privacy/i);
  });

  test('should navigate to Terms of Service page from footer and display correct elements', async ({
    page,
  }) => {
    const termsLink = page.locator('#foot-link-terms');
    await expect(termsLink).toBeVisible();
    await termsLink.click();

    // Verify URL
    await expect(page).toHaveURL(/.*terms.*/);

    // Verify page title/heading
    const mainHeading = page.locator('h1');
    await expect(mainHeading).toContainText(/Terms/i);
  });
});
