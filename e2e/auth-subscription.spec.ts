import { expect, test } from '@playwright/test';

test.describe('Authentication and Subscription Flow', () => {
  test.skip(
    process.env.E2E_RUN_STRIPE_FLOW !== '1',
    'Set E2E_RUN_STRIPE_FLOW=1 to run the live auth and Stripe Checkout integration flow.',
  );

  test('should sign up a user and redirect to Stripe Checkout', async ({
    page,
  }) => {
    // Generate a unique test email to prevent collisions in the database
    const testEmail = `e2e-test-${Date.now()}-${Math.floor(Math.random() * 1000)}@example.com`;
    const testPassword = 'password123';

    // 1. Navigate to Sign Up route
    await page.goto('/app/signup');
    await expect(page).toHaveURL(/\/app\/signup/);

    page.on('console', (msg) => console.log('BROWSER LOG:', msg.text()));
    page.on('pageerror', (err) => console.error('BROWSER ERROR:', err.message));

    // 2. Fill registration form
    const emailInput = page.locator('input[placeholder*="email" i]');
    const passwordInput = page.locator('input[placeholder*="password" i]');

    await expect(emailInput).toBeVisible();
    await expect(passwordInput).toBeVisible();

    await emailInput.fill(testEmail);
    await passwordInput.fill(testPassword);

    // 3. Click Sign Up button
    const signUpButton = page
      .locator('[role="button"], button, div')
      .filter({ hasText: /^Sign Up$/ })
      .first();
    await expect(signUpButton).toBeVisible();
    await signUpButton.click();

    // 4. Wait for authentication session to resolve and redirect to main screen
    console.log(`Signed up with: ${testEmail}. Waiting for authentication...`);
    await page.waitForTimeout(6000);

    // 5. Navigate to subscription management screen
    await page.goto('/app/subscription');
    await expect(page).toHaveURL(/\/app\/subscription/);

    // Verify subscription status is "Not Subscribed"
    const subStatusText = page.locator('text=Not Subscribed');
    await expect(subStatusText).toBeVisible({ timeout: 10000 });

    // 6. Click "Subscribe Now" button to trigger checkout redirect
    const subscribeButton = page
      .locator('[role="button"], button, div')
      .filter({ hasText: /^Subscribe Now$/ })
      .first();
    await expect(subscribeButton).toBeVisible();

    console.log('Clicking "Subscribe Now" and waiting for Stripe redirect...');
    await subscribeButton.click();

    // 7. Verify redirection to Stripe Checkout (which proves the backend Edge Function successfully created a Stripe Checkout session)
    await expect(page).toHaveURL(/.*stripe\.com.*/, { timeout: 20000 });
    console.log('✅ Successfully redirected to Stripe Checkout page!');
  });
});
