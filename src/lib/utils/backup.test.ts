import { describe, it, expect } from 'vitest';
import { exportToBackup, type BackupFile } from './export';
import { parseImport } from './import';

function sampleBackup(): BackupFile {
	return {
		version: 2,
		exportedAt: 1750000000000,
		transactions: [
			{
				id: 't1',
				amount: 1200,
				currency: 'QAR',
				type: 'expense',
				paymentMethod: 'card',
				cardId: 'c1',
				note: 'Lunch',
				createdAt: 1750000000100
			},
			{
				id: 't2',
				amount: 5000,
				currency: 'QAR',
				type: 'income',
				paymentMethod: 'cash',
				cardId: null,
				note: '',
				createdAt: 1750000000200
			}
		],
		cards: [{ id: 'c1', name: 'Visa', lastFour: '1234', color: '#3b82f6' }],
		people: [{ id: 'p1', name: 'Ali', nameKey: 'ali', color: '#10b981', createdAt: 1750000000300 }],
		loans: [
			{
				id: 'l1',
				personId: 'p1',
				direction: 'lent',
				amount: 10000,
				currency: 'QAR',
				note: 'Trip',
				dueDate: 1750000000400,
				createdAt: 1750000000500
			}
		],
		payments: [
			{ id: 'pay1', loanId: 'l1', personId: 'p1', amount: 2500, note: '', createdAt: 1750000000600 }
		]
	};
}

describe('full JSON backup (export -> import)', () => {
	it('round-trips every entity type', async () => {
		const file = new File([exportToBackup(sampleBackup())], 'backup.json', {
			type: 'application/json'
		});
		const parsed = await parseImport(file);

		expect(parsed.errors).toEqual([]);
		expect(parsed.summary.transactionCount).toBe(2);
		expect(parsed.summary.cardCount).toBe(1);
		expect(parsed.summary.personCount).toBe(1);
		expect(parsed.summary.loanCount).toBe(1);
		expect(parsed.summary.paymentCount).toBe(1);

		// Transactions keep their original timestamps and card references by name.
		expect(parsed.transactions[0].createdAt).toBe(1750000000100);
		expect(parsed.transactions[0].cardName).toBe('Visa');

		expect(parsed.people?.[0]?.name).toBe('Ali');
		expect(parsed.loans?.[0]?.direction).toBe('lent');
		expect(parsed.payments?.[0]?.amount).toBe(2500);
	});

	it('rejects a non-backup JSON file', async () => {
		const file = new File(['{"hello":1}'], 'x.json', { type: 'application/json' });
		const parsed = await parseImport(file);
		expect(parsed.errors.length).toBeGreaterThan(0);
		expect(parsed.summary.transactionCount).toBe(0);
	});

	it('drops loan/repayment records that reference missing people/loans', async () => {
		const backup = sampleBackup();
		// A payment whose loan is not in the file, and a loan whose person is missing.
		backup.payments.push({
			id: 'orphan-pay',
			loanId: 'missing-loan',
			personId: 'p1',
			amount: 100,
			note: 'orphan',
			createdAt: 1
		});
		backup.loans.push({
			id: 'orphan-loan',
			personId: 'ghost-person',
			direction: 'borrowed',
			amount: 50,
			currency: 'QAR',
			note: 'orphan',
			dueDate: null,
			createdAt: 2
		});

		const file = new File([exportToBackup(backup)], 'backup.json', { type: 'application/json' });
		const parsed = await parseImport(file);

		// The two valid records survive; the orphans are dropped with a warning.
		expect(parsed.summary.loanCount).toBe(1);
		expect(parsed.summary.paymentCount).toBe(1);
		expect(parsed.errors).toHaveLength(1);
		expect(parsed.errors[0]).toContain('Dropped 2');
		expect(parsed.loans?.some((l) => l.id === 'orphan-loan')).toBe(false);
		expect(parsed.payments?.some((p) => p.id === 'orphan-pay')).toBe(false);
	});

	it('accepts a v2 backup that omits loans/payments (transactions-only file)', async () => {
		const file = new File(
			[
				JSON.stringify({
					version: 2,
					exportedAt: 1,
					transactions: [
						{
							id: 't1',
							amount: 100,
							currency: 'QAR',
							type: 'expense',
							paymentMethod: 'cash',
							cardId: null,
							note: '',
							createdAt: 123
						}
					],
					cards: []
				})
			],
			'backup.json',
			{ type: 'application/json' }
		);
		const parsed = await parseImport(file);
		expect(parsed.summary.transactionCount).toBe(1);
		expect(parsed.errors).toEqual([]);
		expect(parsed.loans).toEqual([]);
		expect(parsed.payments).toEqual([]);
	});

	it('still parses a legacy CSV via parseImport', async () => {
		const csv =
			'Date,Type,Amount,Currency,Payment Method,Card,Note\n2024-03-15 14:30,expense,10.50,QAR,cash,N/A,Coffee';
		const file = new File([csv], 'legacy.csv', { type: 'text/csv' });
		const parsed = await parseImport(file);
		expect(parsed.summary.transactionCount).toBe(1);
		expect(parsed.transactions[0].amount).toBe(1050);
		expect(parsed.summary.loanCount).toBe(0);
		// Space-separated exporter dates are normalized so Safari/WebKit parse them too.
		expect(parsed.summary.dateRange!.earliest).toBe(new Date('2024-03-15T14:30:00').getTime());
	});
});
