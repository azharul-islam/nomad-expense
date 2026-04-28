import type { Transaction, Card } from '$lib/db';

export interface ImportTransaction extends Omit<Transaction, 'id' | 'createdAt'> {
	cardName?: string;
}

export interface ParsedImportData {
	transactions: ImportTransaction[];
	cards: Omit<Card, 'id'>[];
	errors: string[];
	summary: {
		transactionCount: number;
		cardCount: number;
		dateRange: { earliest: number; latest: number } | null;
	};
}

function parseCSVLine(line: string): string[] {
	const result: string[] = [];
	let current = '';
	let inQuotes = false;

	for (let i = 0; i < line.length; i++) {
		const char = line[i];

		if (inQuotes) {
			if (char === '"') {
				if (i + 1 < line.length && line[i + 1] === '"') {
					current += '"';
					i++;
				} else {
					inQuotes = false;
				}
			} else {
				current += char;
			}
		} else {
			if (char === '"') {
				inQuotes = true;
			} else if (char === ',') {
				result.push(current.trim());
				current = '';
			} else {
				current += char;
			}
		}
	}

	result.push(current.trim());
	return result;
}

export async function parseCSV(file: File): Promise<ParsedImportData> {
	const text = await file.text();
	const lines = text.split('\n').filter((line) => line.trim() !== '');

	if (lines.length < 2) {
		return {
			transactions: [],
			cards: [],
			errors: ['File is empty or has no data rows'],
			summary: { transactionCount: 0, cardCount: 0, dateRange: null }
		};
	}

	const headers = parseCSVLine(lines[0]).map((h) => h.toLowerCase().trim());

	const requiredColumns = ['date', 'type', 'amount'];
	const missingColumns = requiredColumns.filter(
		(col) => !headers.some((h) => h.includes(col))
	);

	if (missingColumns.length > 0) {
		return {
			transactions: [],
			cards: [],
			errors: [`Missing required columns: ${missingColumns.join(', ')}`],
			summary: { transactionCount: 0, cardCount: 0, dateRange: null }
		};
	}

	const colIndex = {
		date: headers.findIndex((h) => h.includes('date')),
		type: headers.findIndex((h) => h.includes('type')),
		amount: headers.findIndex((h) => h.includes('amount')),
		currency: headers.findIndex((h) => h.includes('currency')),
		paymentMethod: headers.findIndex((h) => h.includes('payment')),
		card: headers.findIndex((h) => h.includes('card')),
		note: headers.findIndex((h) => h.includes('note'))
	};

	const transactions: ImportTransaction[] = [];
	const cardNames = new Set<string>();
	const errors: string[] = [];
	let earliest: number | null = null;
	let latest: number | null = null;

	for (let i = 1; i < lines.length; i++) {
		const values = parseCSVLine(lines[i]);

		try {
			const dateStr = values[colIndex.date];
			const typeStr = values[colIndex.type].toLowerCase();
			const amountStr = values[colIndex.amount];

			if (!dateStr || !typeStr || !amountStr) {
				errors.push(`Row ${i + 1}: Missing required fields`);
				continue;
			}

			const date = new Date(dateStr);
			if (isNaN(date.getTime())) {
				errors.push(`Row ${i + 1}: Invalid date "${dateStr}"`);
				continue;
			}

			if (typeStr !== 'income' && typeStr !== 'expense') {
				errors.push(`Row ${i + 1}: Invalid type "${typeStr}" (must be income or expense)`);
				continue;
			}

			const amount = parseFloat(amountStr);
			if (isNaN(amount) || amount <= 0) {
				errors.push(`Row ${i + 1}: Invalid amount "${amountStr}"`);
				continue;
			}

			const cents = Math.round(amount * 100);
			const currency = colIndex.currency >= 0 ? values[colIndex.currency] || 'QAR' : 'QAR';
			const paymentMethod =
				colIndex.paymentMethod >= 0
					? (values[colIndex.paymentMethod].toLowerCase() === 'card' ? 'card' : 'cash')
					: 'cash';
			const cardName = colIndex.card >= 0 ? values[colIndex.card] : '';
			const note = colIndex.note >= 0 ? values[colIndex.note] : '';

			if (paymentMethod === 'card' && cardName && cardName !== 'N/A' && cardName !== 'Unknown') {
				cardNames.add(cardName);
			}

			const timestamp = date.getTime();
			if (earliest === null || timestamp < earliest) earliest = timestamp;
			if (latest === null || timestamp > latest) latest = timestamp;

			transactions.push({
				amount: cents,
				currency,
				type: typeStr as 'income' | 'expense',
				paymentMethod,
				cardId: null,
				note,
				cardName: paymentMethod === 'card' && cardName && cardName !== 'N/A' && cardName !== 'Unknown' ? cardName : undefined
			});
		} catch {
			errors.push(`Row ${i + 1}: Failed to parse`);
		}
	}

	const cards: Omit<Card, 'id'>[] = Array.from(cardNames).map((name) => ({
		name,
		lastFour: '0000',
		color: '#3b82f6'
	}));

	return {
		transactions,
		cards,
		errors,
		summary: {
			transactionCount: transactions.length,
			cardCount: cards.length,
			dateRange: earliest !== null && latest !== null ? { earliest, latest } : null
		}
	};
}
