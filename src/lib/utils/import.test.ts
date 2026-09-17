import { describe, it, expect } from 'vitest';
import { parseCSV } from './import';

function makeCSV(lines: string[]): File {
	const content = lines.join('\n');
	return new File([content], 'test.csv', { type: 'text/csv' });
}

const validHeader = 'Date,Type,Amount,Currency,Payment Method,Card,Note';

describe('parseCSV', () => {
	describe('file validation', () => {
		it('returns error for empty file', async () => {
			const file = makeCSV([]);
			const result = await parseCSV(file);

			expect(result.errors).toHaveLength(1);
			expect(result.errors[0]).toContain('empty');
			expect(result.transactions).toHaveLength(0);
		});

		it('returns error for header-only file', async () => {
			const file = makeCSV([validHeader]);
			const result = await parseCSV(file);

			expect(result.errors).toHaveLength(1);
			expect(result.errors[0]).toContain('empty');
		});

		it('returns error when missing required columns', async () => {
			const file = makeCSV(['Name,Description,Value', 'John,Doe,100']);
			const result = await parseCSV(file);

			expect(result.errors).toHaveLength(1);
			expect(result.errors[0]).toContain('Missing required columns');
		});
	});

	describe('basic parsing', () => {
		it('parses a single valid transaction', async () => {
			const file = makeCSV([validHeader, '2024-03-15 14:30,expense,250.00,QAR,cash,N/A,Groceries']);
			const result = await parseCSV(file);

			expect(result.errors).toHaveLength(0);
			expect(result.transactions).toHaveLength(1);
			expect(result.transactions[0].amount).toBe(25000);
			expect(result.transactions[0].type).toBe('expense');
			expect(result.transactions[0].currency).toBe('QAR');
			expect(result.transactions[0].paymentMethod).toBe('cash');
			expect(result.transactions[0].note).toBe('Groceries');
		});

		it('parses income transactions', async () => {
			const file = makeCSV([validHeader, '2024-03-15 14:30,income,5000.00,QAR,cash,N/A,Salary']);
			const result = await parseCSV(file);

			expect(result.transactions[0].type).toBe('income');
			expect(result.transactions[0].amount).toBe(500000);
		});

		it('parses card payment method', async () => {
			const file = makeCSV([
				validHeader,
				'2024-03-15 14:30,expense,100.00,QAR,card,Visa Gold,Restaurant'
			]);
			const result = await parseCSV(file);

			expect(result.transactions[0].paymentMethod).toBe('card');
		});

		it('parses multiple transactions', async () => {
			const file = makeCSV([
				validHeader,
				'2024-03-15 14:30,expense,100.00,QAR,cash,N/A,First',
				'2024-03-16 10:00,expense,200.00,QAR,cash,N/A,Second',
				'2024-03-17 18:00,income,5000.00,QAR,cash,N/A,Income'
			]);
			const result = await parseCSV(file);

			expect(result.transactions).toHaveLength(3);
			expect(result.summary.transactionCount).toBe(3);
		});
	});

	describe('amount parsing', () => {
		it('converts decimal amounts to cents correctly', async () => {
			const file = makeCSV([validHeader, '2024-01-01 00:00,expense,1234.56,QAR,cash,N/A,']);
			const result = await parseCSV(file);

			expect(result.transactions[0].amount).toBe(123456);
		});

		it('handles whole number amounts', async () => {
			const file = makeCSV([validHeader, '2024-01-01 00:00,expense,100,QAR,cash,N/A,']);
			const result = await parseCSV(file);

			expect(result.transactions[0].amount).toBe(10000);
		});

		it('handles small decimal amounts', async () => {
			const file = makeCSV([validHeader, '2024-01-01 00:00,expense,0.50,QAR,cash,N/A,']);
			const result = await parseCSV(file);

			expect(result.transactions[0].amount).toBe(50);
		});

		it('rejects zero amount', async () => {
			const file = makeCSV([validHeader, '2024-01-01 00:00,expense,0,QAR,cash,N/A,']);
			const result = await parseCSV(file);

			expect(result.errors).toHaveLength(1);
			expect(result.errors[0]).toContain('Invalid amount');
		});

		it('rejects negative amounts', async () => {
			const file = makeCSV([validHeader, '2024-01-01 00:00,expense,-50.00,QAR,cash,N/A,']);
			const result = await parseCSV(file);

			expect(result.errors).toHaveLength(1);
			expect(result.errors[0]).toContain('Invalid amount');
		});

		it('rejects non-numeric amounts', async () => {
			const file = makeCSV([validHeader, '2024-01-01 00:00,expense,abc,QAR,cash,N/A,']);
			const result = await parseCSV(file);

			expect(result.errors).toHaveLength(1);
			expect(result.errors[0]).toContain('Invalid amount');
		});
	});

	describe('date parsing', () => {
		it('parses ISO-like date format', async () => {
			const file = makeCSV([validHeader, '2024-03-15 14:30,expense,100.00,QAR,cash,N/A,']);
			const result = await parseCSV(file);

			expect(result.summary.dateRange).not.toBeNull();
			expect(result.summary.dateRange!.earliest).toBe(new Date('2024-03-15T14:30:00').getTime());
		});

		it('rejects invalid dates', async () => {
			const file = makeCSV([validHeader, 'not-a-date,expense,100.00,QAR,cash,N/A,']);
			const result = await parseCSV(file);

			expect(result.errors).toHaveLength(1);
			expect(result.errors[0]).toContain('Invalid date');
		});

		it('tracks earliest and latest dates', async () => {
			const file = makeCSV([
				validHeader,
				'2024-01-01 00:00,expense,100.00,QAR,cash,N/A,',
				'2024-06-15 12:00,expense,200.00,QAR,cash,N/A,',
				'2024-03-10 08:00,expense,150.00,QAR,cash,N/A,'
			]);
			const result = await parseCSV(file);

			expect(result.summary.dateRange!.earliest).toBe(new Date('2024-01-01T00:00:00').getTime());
			expect(result.summary.dateRange!.latest).toBe(new Date('2024-06-15T12:00:00').getTime());
		});
	});

	describe('type validation', () => {
		it('accepts lowercase expense', async () => {
			const file = makeCSV([validHeader, '2024-01-01 00:00,expense,100.00,QAR,cash,N/A,']);
			const result = await parseCSV(file);

			expect(result.transactions[0].type).toBe('expense');
		});

		it('accepts lowercase income', async () => {
			const file = makeCSV([validHeader, '2024-01-01 00:00,income,100.00,QAR,cash,N/A,']);
			const result = await parseCSV(file);

			expect(result.transactions[0].type).toBe('income');
		});

		it('rejects invalid type', async () => {
			const file = makeCSV([validHeader, '2024-01-01 00:00,transfer,100.00,QAR,cash,N/A,']);
			const result = await parseCSV(file);

			expect(result.errors).toHaveLength(1);
			expect(result.errors[0]).toContain('Invalid type');
		});
	});

	describe('card extraction', () => {
		it('extracts card names from card transactions', async () => {
			const file = makeCSV([
				validHeader,
				'2024-01-01 00:00,expense,100.00,QAR,card,Visa Gold,Restaurant',
				'2024-01-02 00:00,expense,200.00,QAR,card,Mastercard,Groceries'
			]);
			const result = await parseCSV(file);

			expect(result.cards).toHaveLength(2);
			expect(result.cards.map((c) => c.name)).toContain('Visa Gold');
			expect(result.cards.map((c) => c.name)).toContain('Mastercard');
		});

		it('does not extract N/A as a card', async () => {
			const file = makeCSV([validHeader, '2024-01-01 00:00,expense,100.00,QAR,cash,N/A,']);
			const result = await parseCSV(file);

			expect(result.cards).toHaveLength(0);
		});

		it('does not extract Unknown as a card', async () => {
			const file = makeCSV([validHeader, '2024-01-01 00:00,expense,100.00,QAR,card,Unknown,']);
			const result = await parseCSV(file);

			expect(result.cards).toHaveLength(0);
		});

		it('deduplicates card names', async () => {
			const file = makeCSV([
				validHeader,
				'2024-01-01 00:00,expense,100.00,QAR,card,Visa Gold,First',
				'2024-01-02 00:00,expense,200.00,QAR,card,Visa Gold,Second'
			]);
			const result = await parseCSV(file);

			expect(result.cards).toHaveLength(1);
			expect(result.cards[0].name).toBe('Visa Gold');
		});

		it('sets default card properties', async () => {
			const file = makeCSV([validHeader, '2024-01-01 00:00,expense,100.00,QAR,card,My Card,']);
			const result = await parseCSV(file);

			expect(result.cards[0].lastFour).toBe('0000');
			expect(result.cards[0].color).toBe('#3b82f6');
		});
	});

	describe('CSV quoting', () => {
		it('handles quoted fields with commas', async () => {
			const file = makeCSV([
				validHeader,
				'2024-01-01 00:00,expense,100.00,QAR,cash,N/A,"Lunch, coffee, and tea"'
			]);
			const result = await parseCSV(file);

			expect(result.transactions[0].note).toBe('Lunch, coffee, and tea');
		});

		it('handles quoted fields with escaped quotes', async () => {
			const file = makeCSV([
				validHeader,
				'2024-01-01 00:00,expense,100.00,QAR,cash,N/A,"He said ""hello"""'
			]);
			const result = await parseCSV(file);

			expect(result.transactions[0].note).toBe('He said "hello"');
		});
	});

	describe('partial data', () => {
		it('defaults currency to QAR when missing', async () => {
			const file = makeCSV(['Date,Type,Amount', '2024-01-01 00:00,expense,100.00']);
			const result = await parseCSV(file);

			expect(result.transactions[0].currency).toBe('QAR');
		});

		it('defaults payment method to cash when missing', async () => {
			const file = makeCSV(['Date,Type,Amount', '2024-01-01 00:00,expense,100.00']);
			const result = await parseCSV(file);

			expect(result.transactions[0].paymentMethod).toBe('cash');
		});

		it('defaults note to empty when missing', async () => {
			const file = makeCSV(['Date,Type,Amount', '2024-01-01 00:00,expense,100.00']);
			const result = await parseCSV(file);

			expect(result.transactions[0].note).toBe('');
		});
	});

	describe('error handling', () => {
		it('skips invalid rows but continues parsing', async () => {
			const file = makeCSV([
				validHeader,
				'2024-01-01 00:00,expense,100.00,QAR,cash,N/A,Valid',
				'invalid-date,expense,100.00,QAR,cash,N/A,Invalid',
				'2024-01-03 00:00,expense,200.00,QAR,cash,N/A,Also Valid'
			]);
			const result = await parseCSV(file);

			expect(result.transactions).toHaveLength(2);
			expect(result.errors).toHaveLength(1);
			expect(result.errors[0]).toContain('Invalid date');
		});

		it('reports row numbers in errors', async () => {
			const file = makeCSV([validHeader, 'bad-date,expense,100.00,QAR,cash,N/A,']);
			const result = await parseCSV(file);

			expect(result.errors[0]).toContain('Row 2');
		});

		it('handles missing fields in a row', async () => {
			const file = makeCSV([validHeader, '2024-01-01 00:00,expense,']);
			const result = await parseCSV(file);

			expect(result.errors).toHaveLength(1);
			expect(result.errors[0]).toContain('Missing required fields');
		});
	});

	describe('summary', () => {
		it('reports correct transaction count', async () => {
			const file = makeCSV([
				validHeader,
				'2024-01-01 00:00,expense,100.00,QAR,cash,N/A,',
				'2024-01-02 00:00,expense,200.00,QAR,cash,N/A,'
			]);
			const result = await parseCSV(file);

			expect(result.summary.transactionCount).toBe(2);
		});

		it('reports correct card count', async () => {
			const file = makeCSV([
				validHeader,
				'2024-01-01 00:00,expense,100.00,QAR,card,Card A,',
				'2024-01-02 00:00,expense,200.00,QAR,card,Card B,'
			]);
			const result = await parseCSV(file);

			expect(result.summary.cardCount).toBe(2);
		});

		it('returns null dateRange for no valid transactions', async () => {
			const file = makeCSV([validHeader, 'bad-date,expense,100.00,QAR,cash,N/A,']);
			const result = await parseCSV(file);

			expect(result.summary.dateRange).toBeNull();
		});
	});
});
