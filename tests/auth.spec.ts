import { test, expect } from '@playwright/test';

test('homepage loads and shows Log In or Get Started buttons', async ({ page }) => {
  await page.goto('/');
  
  const loginBtn = page.getByRole('button', { name: /log in/i })
    .or(page.getByRole('link', { name: /log in/i }))
    .or(page.getByRole('button', { name: /get started/i }))
    .or(page.getByRole('link', { name: /get started/i }));
  
  await expect(loginBtn.first()).toBeVisible({ timeout: 10000 });
});

test('unauthenticated user is shown the landing page', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: /The AI-first email/i })).toBeVisible({ timeout: 10000 });
});
