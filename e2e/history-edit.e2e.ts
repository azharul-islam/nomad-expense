import { test, expect, type Page } from '@playwright/test';

test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });

/** Seed one expense directly so the edit flow can be tested without the keypad. */
async function seedOneExpense(page: Page, note: string, amount: number) {
	await page.goto('/');
	await page.evaluate(
		({ note, amount }) =>
			new Promise<void>((resolve, reject) => {
				const req = indexedDB.open('expense-tracker', 2);
				req.onupgradeneeded = () => {
					const db = req.result;
					const mk = (name: string, indexes: [string, string][] = []) => {
						if (db.objectStoreNames.contains(name)) return;
						const store = db.createObjectStore(name, { keyPath: 'id' });
						for (const [index, key] of indexes) {
							store.createIndex(index, key, { unique: false });
						}
					};
					mk('transactions', [['by-date', 'createdAt']]);
					mk('cards');
					mk('people', [['by-name', 'nameKey']]);
					mk('loans', [
						['by-person', 'personId'],
						['by-date', 'createdAt']
					]);
					mk('loanPayments', [
						['by-loan', 'loanId'],
						['by-person', 'personId']
					]);
				};
				req.onsuccess = () => {
					const db = req.result;
					const tx = db.transaction('transactions', 'readwrite');
					tx.objectStore('transactions').put({
						id: 'tx-edit',
						amount,
						currency: 'QAR',
						type: 'expense',
						paymentMethod: 'cash',
						cardId: null,
						note,
						createdAt: Date.now() - 1000
					});
					tx.oncomplete = () => {
						db.close();
						resolve();
					};
					tx.onerror = () => reject(tx.error);
				};
				req.onerror = () => reject(req.error);
			}),
		{ note, amount }
	);
	await page.reload({ waitUntil: 'networkidle' });
}

test('editing a transaction amount and saving updates the row and the totals', async ({ page }) => {
	await seedOneExpense(page, 'Editable', 1200);
	await page.goto('/history');
	await expect(page.getByText('Editable')).toBeVisible();

	// Open the inline editor, change the amount, save.
	await page.getByRole('button', { name: 'Edit transaction' }).click();
	const amountInput = page.locator('input[type="number"]');
	await expect(amountInput).toHaveValue('12.00');
	await amountInput.fill('34.50');
	await page.getByRole('button', { name: 'Save', exact: true }).click();

	// The editor closes and the new amount is persisted and shown.
	await expect(amountInput).toHaveCount(0);
	await expect(page.getByText('Editable')).toBeVisible();
	await expect(page.getByText('34.50').first()).toBeVisible();

	// It survives a reload (written to IndexedDB).
	await page.reload({ waitUntil: 'networkidle' });
	await expect(page.getByText('Editable')).toBeVisible();
	await expect(page.getByText('34.50').first()).toBeVisible();
});

test('editing a transaction amount to a value with thousands still works', async ({ page }) => {
	await seedOneExpense(page, 'Big edit', 100000);
	await page.goto('/history');
	await page.getByRole('button', { name: 'Edit transaction' }).click();
	const amountInput = page.locator('input[type="number"]');
	await amountInput.fill('1234.56');
	await page.getByRole('button', { name: 'Save', exact: true }).click();
	await expect(amountInput).toHaveCount(0);
	await expect(page.getByText('1,234.56').first()).toBeVisible();
});
