import { test, expect, type Page } from '@playwright/test';
import { readFileSync, writeFileSync } from 'node:fs';

test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });

const STORES = ['transactions', 'cards', 'people', 'loans', 'loanPayments'] as const;
type StoreName = (typeof STORES)[number];
type DBState = Record<StoreName, Record<string, unknown>[]>;

interface BackupShape {
	version: number;
	transactions: Record<string, unknown>[];
	cards: Record<string, unknown>[];
	people: Record<string, unknown>[];
	loans: Record<string, unknown>[];
	payments: Record<string, unknown>[];
}

/** Seed a realistic v2 database (transactions + a person with a loan and a repayment). */
async function seedData(page: Page) {
	await page.goto('/');
	// Create the v2 schema ourselves so seeding never races the app's async init
	// (indexedDB.open with no version would otherwise make a storeless v1 db).
	await page.evaluate(
		() =>
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
					const now = Date.now();
					const tx = db.transaction(
						['transactions', 'cards', 'people', 'loans', 'loanPayments'],
						'readwrite'
					);
					tx.objectStore('cards').put({
						id: 'card-a',
						name: 'Visa Gold',
						lastFour: '4242',
						color: '#3b82f6'
					});
					tx.objectStore('transactions').put({
						id: 'tx-a',
						amount: 12345,
						currency: 'QAR',
						type: 'expense',
						paymentMethod: 'card',
						cardId: 'card-a',
						note: 'Roundtrip txn',
						createdAt: now - 5000
					});
					tx.objectStore('transactions').put({
						id: 'tx-b',
						amount: 500000,
						currency: 'QAR',
						type: 'income',
						paymentMethod: 'cash',
						cardId: null,
						note: 'Roundtrip salary',
						createdAt: now - 4000
					});
					tx.objectStore('people').put({
						id: 'person-a',
						name: 'Layla',
						nameKey: 'layla',
						color: '#10b981',
						createdAt: now - 3000
					});
					tx.objectStore('loans').put({
						id: 'loan-a',
						personId: 'person-a',
						direction: 'lent',
						amount: 20000,
						currency: 'QAR',
						note: 'Lunch loan',
						dueDate: now + 86400000,
						createdAt: now - 2000
					});
					tx.objectStore('loanPayments').put({
						id: 'pay-a',
						loanId: 'loan-a',
						personId: 'person-a',
						amount: 5000,
						note: 'partial',
						createdAt: now - 1000
					});
					tx.oncomplete = () => {
						db.close();
						resolve();
					};
					tx.onerror = () => reject(tx.error);
				};
				req.onerror = () => reject(req.error);
			})
	);
	await page.reload({ waitUntil: 'networkidle' });
}

async function readDB(page: Page): Promise<DBState> {
	return page.evaluate(
		(stores) =>
			new Promise<Record<string, Record<string, unknown>[]>>((resolve, reject) => {
				const req = indexedDB.open('expense-tracker');
				req.onsuccess = () => {
					const db = req.result;
					const out: Record<string, Record<string, unknown>[]> = {};
					const tx = db.transaction(stores as string[], 'readonly');
					let pending = stores.length;
					for (const name of stores as string[]) {
						const r = tx.objectStore(name).getAll();
						r.onsuccess = () => {
							out[name] = r.result;
							if (--pending === 0) {
								db.close();
								resolve(out);
							}
						};
						r.onerror = () => reject(r.error);
					}
				};
				req.onerror = () => reject(req.error);
			}),
		STORES as unknown as string[]
	);
}

async function exportBackup(page: Page, outPath: string): Promise<BackupShape> {
	await page.goto('/settings/data');
	const [download] = await Promise.all([
		page.waitForEvent('download'),
		page.getByRole('button', { name: /Export full backup/ }).click()
	]);
	await download.saveAs(outPath);
	return JSON.parse(readFileSync(outPath, 'utf8')) as BackupShape;
}

async function exportCSV(page: Page, outPath: string): Promise<string> {
	await page.goto('/settings/data');
	const [download] = await Promise.all([
		page.waitForEvent('download'),
		page.getByRole('button', { name: /Export as CSV/ }).click()
	]);
	await download.saveAs(outPath);
	return readFileSync(outPath, 'utf8');
}

async function clearAll(page: Page) {
	await page.goto('/settings/data');
	await page.getByRole('button', { name: /Clear All Data/ }).click();
	await page.getByRole('button', { name: 'Clear All', exact: true }).click();
	await expect(page.getByText('All data cleared')).toBeVisible();
}

async function importFile(page: Page, filePath: string, mode: 'append' | 'replace') {
	await page.goto('/settings/data');
	await page.getByRole('button', { name: /Import CSV or backup/ }).click();
	await page.locator('#csv-file-input').setInputFiles(filePath);
	// Wait for the summary to render before choosing a mode and confirming.
	await expect(page.getByRole('heading', { name: 'Import Summary' })).toBeVisible();
	if (mode === 'replace') {
		await page.getByRole('button', { name: 'Replace All' }).click();
	}
	await page.getByRole('button', { name: 'Import', exact: true }).click();
	await expect(page.getByRole('heading', { name: 'Import Summary' })).toHaveCount(0);
}

test('full JSON backup survives export -> clear -> import (every entity type)', async ({
	page
}, testInfo) => {
	await seedData(page);
	const before = await readDB(page);
	expect(before.transactions).toHaveLength(2);
	expect(before.people).toHaveLength(1);
	expect(before.loans).toHaveLength(1);
	expect(before.loanPayments).toHaveLength(1);

	// Export the backup file and check the format/version marker.
	const backup = await exportBackup(page, testInfo.outputPath('backup.json'));
	expect(backup.version).toBe(2);
	expect(typeof backup.exportedAt).toBe('number');
	expect(backup.transactions).toHaveLength(2);
	expect(backup.cards.map((c) => c.name)).toContain('Visa Gold');
	expect(backup.people.map((p) => p.name)).toContain('Layla');
	expect(backup.loans).toHaveLength(1);
	expect(backup.payments).toHaveLength(1);
	// The exported transaction still points at the card it was recorded with.
	const txnA = backup.transactions.find((t) => t.note === 'Roundtrip txn')!;
	expect(txnA.cardId).toBe('card-a');

	// Wipe everything, then restore with "Replace All".
	await clearAll(page);
	const cleared = await readDB(page);
	expect(cleared.transactions).toHaveLength(0);
	expect(cleared.people).toHaveLength(0);
	expect(cleared.loans).toHaveLength(0);
	expect(cleared.loanPayments).toHaveLength(0);

	await importFile(page, testInfo.outputPath('backup.json'), 'replace');

	const after = await readDB(page);
	expect(after.transactions).toHaveLength(2);
	expect(after.transactions.map((t) => t.note).sort()).toEqual([
		'Roundtrip salary',
		'Roundtrip txn'
	]);
	expect(after.people.map((p) => p.name)).toEqual(['Layla']);
	expect(after.loans).toHaveLength(1);
	expect(after.loanPayments).toHaveLength(1);

	// Card references are remapped through the card name (ids are regenerated).
	const restoredTxn = after.transactions.find((t) => t.note === 'Roundtrip txn')!;
	const restoredCard = after.cards.find((c) => c.name === 'Visa Gold')!;
	expect(restoredTxn.paymentMethod).toBe('card');
	expect(restoredTxn.cardId).toBe(restoredCard.id);

	// Referential integrity: every loan -> person, every payment -> loan -> person.
	const personIds = new Set(after.people.map((p) => p.id));
	const loanIds = new Set(after.loans.map((l) => l.id));
	for (const loan of after.loans) expect(personIds.has(loan.personId as string)).toBe(true);
	for (const pay of after.loanPayments) {
		expect(loanIds.has(pay.loanId as string)).toBe(true);
		expect(personIds.has(pay.personId as string)).toBe(true);
	}

	// And the restored data is actually visible in the UI.
	await page.goto('/history');
	await expect(page.getByText('Roundtrip txn')).toBeVisible();
	await page.goto('/loans');
	await expect(page.getByText('Layla')).toBeVisible();
});

test('legacy CSV export still imports into a cleared app', async ({ page }, testInfo) => {
	await seedData(page);
	const csv = await exportCSV(page, testInfo.outputPath('export.csv'));
	const lines = csv.split('\n');
	// Legacy header is unchanged so old files keep importing.
	expect(lines[0]).toBe('Date,Type,Amount,Currency,Payment Method,Card,Note');
	expect(csv).toContain('Roundtrip txn');
	expect(csv).toContain('Visa Gold');

	await clearAll(page);
	await importFile(page, testInfo.outputPath('export.csv'), 'replace');

	const after = await readDB(page);
	expect(after.transactions).toHaveLength(2);
	expect(after.transactions.map((t) => t.note).sort()).toEqual([
		'Roundtrip salary',
		'Roundtrip txn'
	]);
	// Card names are re-extracted from the CSV card column.
	expect(after.cards.map((c) => c.name)).toContain('Visa Gold');
	// CSV carries no loans, so replacing with it removes existing loan data.
	expect(after.loans).toHaveLength(0);
	expect(after.people).toHaveLength(0);
});

test('append import does not duplicate existing people or cards', async ({ page }, testInfo) => {
	await seedData(page);
	await exportBackup(page, testInfo.outputPath('backup.json'));

	const before = await readDB(page);
	const cardNamesBefore = before.cards.map((c) => c.name).sort();
	const peopleBefore = before.people.length;

	// Appending the same backup must add transactions/loans but reuse existing
	// people (matched by name) and existing cards (matched by name).
	await importFile(page, testInfo.outputPath('backup.json'), 'append');

	const after = await readDB(page);
	expect(after.transactions).toHaveLength(before.transactions.length * 2);
	expect(after.people).toHaveLength(peopleBefore);
	expect(after.cards.map((c) => c.name).sort()).toEqual(cardNamesBefore);
	// Still exactly one Layla / one Visa Gold record.
	expect(after.people.filter((p) => p.name === 'Layla')).toHaveLength(1);
	expect(after.cards.filter((c) => c.name === 'Visa Gold')).toHaveLength(1);
});

test('a people-only backup can be imported through the modal', async ({ page }, testInfo) => {
	const now = Date.now();
	const path = testInfo.outputPath('people-only.json');
	writeFileSync(
		path,
		JSON.stringify({
			version: 2,
			exportedAt: now,
			transactions: [],
			cards: [],
			people: [
				{
					id: 'person-only',
					name: 'Hana',
					nameKey: 'hana',
					color: '#3b82f6',
					createdAt: now - 1000
				}
			],
			loans: [],
			payments: []
		})
	);

	await page.goto('/settings/data');
	await page.getByRole('button', { name: /Import CSV or backup/ }).click();
	await page.locator('#csv-file-input').setInputFiles(path);

	// The summary and Import button used to be gated on transactions/loans, so a
	// file like this rendered nothing and could never be imported.
	await expect(page.getByRole('heading', { name: 'Import Summary' })).toBeVisible();
	await expect(page.getByText('1 people')).toBeVisible();
	await page.getByRole('button', { name: 'Import', exact: true }).click();

	await expect(page.getByRole('heading', { name: 'Import Summary' })).toHaveCount(0);
	await expect(page.getByText('Imported 1 people')).toBeVisible();

	const after = await readDB(page);
	expect(after.people.map((p) => p.name)).toEqual(['Hana']);
	expect(after.transactions).toHaveLength(0);

	await page.goto('/loans');
	await expect(page.getByText('Hana')).toBeVisible();
});
