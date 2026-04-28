import { describe, it, expect } from 'vitest';
import { exportToCSV } from './export';
import type { Transaction, Card } from '$lib/db';

function makeTransaction(overrides: Partial<Transaction> = {}): Transaction {
	return {
		id: 'test-id-1',
		amount: 15000,
		currency: 'QAR',
		type: 'expense',
		paymentMethod: 'cash',
		cardId: null,
		note: '',
		createdAt: 1700000000000,
		...overrides
	};
}

function makeCard(overrides: Partial<Card> = {}): Card {
	return {
		id: 'card-1',
		name: 'Test Card',
		lastFour: '1234',
		color: '#3b82f6',
		...overrides
	};
}

describe('exportToCSV', () => {
	it('returns header row when no transactions', () => {
		const csv = exportToCSV([], []);
		const lines = csv.split('\n');
		expect(lines).toHaveLength(1);
		expect(lines[0]).toBe('Date,Type,Amount,Currency,Payment Method,Card,Note');
	});

	it('exports a single cash transaction', () => {
		const tx = makeTransaction({
			amount: 25000,
			type: 'expense',
			note: 'Groceries',
			createdAt: 1700000000000
		});
		const csv = exportToCSV([tx], []);
		const lines = csv.split('\n');

		expect(lines).toHaveLength(2);
		expect(lines[1]).toContain('expense');
		expect(lines[1]).toContain('250.00');
		expect(lines[1]).toContain('QAR');
		expect(lines[1]).toContain('cash');
		expect(lines[1]).toContain('N/A');
		expect(lines[1]).toContain('Groceries');
	});

	it('exports a card transaction with card name lookup', () => {
		const tx = makeTransaction({
			cardId: 'card-1',
			paymentMethod: 'card'
		});
		const card = makeCard({ id: 'card-1', name: 'Visa Gold' });
		const csv = exportToCSV([tx], [card]);
		const lines = csv.split('\n');

		expect(lines[1]).toContain('Visa Gold');
	});

	it('shows Unknown for card transaction with missing card', () => {
		const tx = makeTransaction({
			cardId: 'nonexistent',
			paymentMethod: 'card'
		});
		const csv = exportToCSV([tx], []);
		const lines = csv.split('\n');

		expect(lines[1]).toContain('Unknown');
	});

	it('formats income transactions correctly', () => {
		const tx = makeTransaction({
			amount: 100000,
			type: 'income',
			note: 'Salary'
		});
		const csv = exportToCSV([tx], []);
		const lines = csv.split('\n');

		expect(lines[1]).toContain('income');
		expect(lines[1]).toContain('1000.00');
		expect(lines[1]).toContain('Salary');
	});

	it('escapes commas in note field', () => {
		const tx = makeTransaction({
			note: 'Lunch, coffee, and snacks'
		});
		const csv = exportToCSV([tx], []);
		const lines = csv.split('\n');

		expect(lines[1]).toContain('"Lunch, coffee, and snacks"');
	});

	it('escapes quotes in note field', () => {
		const tx = makeTransaction({
			note: 'He said "hello"'
		});
		const csv = exportToCSV([tx], []);
		const lines = csv.split('\n');

		expect(lines[1]).toContain('"He said ""hello"""');
	});

	it('escapes newlines in note field', () => {
		const tx = makeTransaction({
			note: 'Line one\nLine two'
		});
		const csv = exportToCSV([tx], []);

		expect(csv).toContain('"Line one\nLine two"');
	});

	it('formats date as YYYY-MM-DD HH:MM', () => {
		const tx = makeTransaction({
			createdAt: new Date('2024-03-15T14:30:00').getTime()
		});
		const csv = exportToCSV([tx], []);
		const lines = csv.split('\n');

		expect(lines[1]).toContain('2024-03-15 14:30');
	});

	it('pads single-digit months and days', () => {
		const tx = makeTransaction({
			createdAt: new Date('2024-01-05T09:05:00').getTime()
		});
		const csv = exportToCSV([tx], []);
		const lines = csv.split('\n');

		expect(lines[1]).toContain('2024-01-05 09:05');
	});

	it('exports multiple transactions in order', () => {
		const tx1 = makeTransaction({ id: '1', note: 'First' });
		const tx2 = makeTransaction({ id: '2', note: 'Second' });
		const tx3 = makeTransaction({ id: '3', note: 'Third' });
		const csv = exportToCSV([tx1, tx2, tx3], []);
		const lines = csv.split('\n');

		expect(lines).toHaveLength(4);
		expect(lines[1]).toContain('First');
		expect(lines[2]).toContain('Second');
		expect(lines[3]).toContain('Third');
	});

	it('handles empty note field', () => {
		const tx = makeTransaction({ note: '' });
		const csv = exportToCSV([tx], []);
		const lines = csv.split('\n');

		const parts = lines[1].split(',');
		expect(parts[parts.length - 1]).toBe('');
	});

	it('handles small amounts correctly', () => {
		const tx = makeTransaction({ amount: 50 });
		const csv = exportToCSV([tx], []);
		const lines = csv.split('\n');

		expect(lines[1]).toContain('0.50');
	});

	it('handles large amounts correctly', () => {
		const tx = makeTransaction({ amount: 123456789 });
		const csv = exportToCSV([tx], []);
		const lines = csv.split('\n');

		expect(lines[1]).toContain('1234567.89');
	});
});
