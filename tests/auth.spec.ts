import { test, expect } from '@playwright/test';

test('homepage loads and shows Sign In button', async ({ page }) => {
  await page.goto('http://localhost:3000/');
  
  // Assuming the unauthenticated homepage has a "Sign In" button or link
  // Update this to match the actual text or ID of your login button
  const signInBtn = page.getByRole('button', { name: /sign in/i }).or(page.getByRole('link', { name: /sign in/i }));
  
  // We expect it to be visible
  await expect(signInBtn.first()).toBeVisible({ timeout: 10000 });
});

test('dashboard requires authentication and redirects to /login or /', async ({ page }) => {
  const response = await page.goto('http://localhost:3000/dashboard');
  
  // If we try to go to /dashboard without auth, it should redirect us.
  expect(page.url()).not.toBe('http://localhost:3000/dashboard');
});
