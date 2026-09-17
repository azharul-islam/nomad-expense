import { test, expect } from '@playwright/test';

test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });

/**
 * Guards the data-safety requirement: a user with locally stored v1 data must keep
 * every transaction/card after the app adds the loans stores (additive v2 migration).
 */
test('legacy v1 data survives the additive v2 upgrade', async ({ page }) => {
	// Load the shell with the app scripts blocked so we can seed a v1 database first.
	await page.route('**/_app/**', (route) => route.abort());
	await page.goto('/', { waitUntil: 'domcontentloaded' }).catch(() => {});
	await page.waitForTimeout(300);

	await page.evaluate(
		() =>
			new Promise<void>((resolve, reject) => {
				const req = indexedDB.open('expense-tracker', 1);
				req.onupgradeneeded = () => {
					const db = req.result;
					const tx = db.createObjectStore('transactions', { keyPath: 'id' });
					tx.createIndex('by-date', 'createdAt', { unique: false });
					db.createObjectStore('cards', { keyPath: 'id' });
				};
				req.onsuccess = () => {
					const db = req.result;
					const t = db.transaction('transactions', 'readwrite');
					t.objectStore('transactions').put({
						id: 'legacy-1',
						amount: 1234,
						currency: 'QAR',
						type: 'expense',
						paymentMethod: 'cash',
						cardId: null,
						note: 'Legacy txn',
						createdAt: 1700000000000
					});
					t.objectStore('transactions').put({
						id: 'legacy-2',
						amount: 5000,
						currency: 'QAR',
						type: 'income',
						paymentMethod: 'cash',
						cardId: null,
						note: 'Legacy salary',
						createdAt: 1700000100000
					});
					t.oncomplete = () => {
						db.close();
						resolve();
					};
				};
				req.onerror = () => reject(req.error);
			})
	);

	// Unblock and load the app: it opens v2 additively.
	await page.unroute('**/_app/**');
	await page.goto('/', { waitUntil: 'networkidle' });
	await expect(page.getByText('Enter an amount to get started')).toBeVisible();

	const state = await page.evaluate(
		() =>
			new Promise<{ version: number; stores: string[] }>((resolve) => {
				const req = indexedDB.open('expense-tracker');
				req.onsuccess = () => {
					const db = req.result;
					const result = { version: db.version, stores: Array.from(db.objectStoreNames) };
					db.close();
					resolve(result);
				};
			})
	);
	expect(state.version).toBe(2);
	expect(state.stores).toEqual(
		expect.arrayContaining(['transactions', 'cards', 'people', 'loans', 'loanPayments'])
	);

	// Legacy rows are still there and visible in History.
	await page.getByRole('link', { name: 'History' }).click();
	await expect(page.getByText('Legacy txn')).toBeVisible();
	await expect(page.getByText('Legacy salary')).toBeVisible();
});
