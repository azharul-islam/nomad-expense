import { test, expect } from '@playwright/test';

test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });

test('month picker steps one month at a time from a 31-day month', async ({ page }) => {
	// Pin "today" to the 31st. Stepping used to carry the day-of-month into the
	// target month, where it overflows (Feb 31 -> Mar 3) and skips February.
	await page.clock.install({ time: new Date(2026, 0, 31, 12).getTime() });

	await page.goto('/history');
	await page.getByRole('button', { name: 'Filter transactions' }).click();
	await expect(page.getByText('January 2026')).toBeVisible();

	await page.getByRole('button', { name: 'Next month' }).click();
	await expect(page.getByText('February 2026')).toBeVisible();

	await page.getByRole('button', { name: 'Next month' }).click();
	await expect(page.getByText('March 2026')).toBeVisible();

	await page.getByRole('button', { name: 'Previous month' }).click();
	await expect(page.getByText('February 2026')).toBeVisible();

	await page.getByRole('button', { name: 'Previous month' }).click();
	await expect(page.getByText('January 2026')).toBeVisible();
});
