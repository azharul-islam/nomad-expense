import type { Transaction, Card, Person, Loan, LoanPayment } from '$lib/db';

export interface ImportTransaction extends Omit<Transaction, 'id' | 'createdAt'> {
	cardName?: string;
	createdAt?: number;
}

export interface ParsedImportData {
	transactions: ImportTransaction[];
	cards: Omit<Card, 'id'>[];
	people?: Person[];
	loans?: Loan[];
	payments?: LoanPayment[];
	errors: string[];
	summary: {
		transactionCount: number;
		cardCount: number;
		personCount: number;
		loanCount: number;
		paymentCount: number;
		dateRange: { earliest: number; latest: number } | null;
	};
}

/** Shape of a full JSON backup as produced by exportToBackup. */
export interface BackupFile {
	version: 2;
	exportedAt: number;
	transactions: Transaction[];
	cards: Card[];
	people: Person[];
	loans: Loan[];
	payments: LoanPayment[];
}

/**
 * Parse a date like the exporter writes it ("YYYY-MM-DD HH:MM") robustly on every
 * engine — WebKit/Safari rejects the space-separated form, so normalize to ISO.
 */
function parseDate(value: string): Date {
	const v = value.trim().replace(/ /g, 'T');
	// "YYYY-MM-DDTHH:MM" without seconds is not reliably ISO everywhere — add them.
	const d = new Date(v.length === 16 ? v + ':00' : v);
	return isNaN(d.getTime()) ? new Date(value) : d;
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

async function parseCSVFile(file: File): Promise<ParsedImportData> {
	const text = await file.text();
	const lines = text.split('\n').filter((line) => line.trim() !== '');

	if (lines.length < 2) {
		return {
			transactions: [],
			cards: [],
			errors: ['File is empty or has no data rows'],
			summary: {
				transactionCount: 0,
				cardCount: 0,
				personCount: 0,
				loanCount: 0,
				paymentCount: 0,
				dateRange: null
			}
		};
	}

	const headers = parseCSVLine(lines[0]).map((h) => h.toLowerCase().trim());

	const requiredColumns = ['date', 'type', 'amount'];
	const missingColumns = requiredColumns.filter((col) => !headers.some((h) => h.includes(col)));

	if (missingColumns.length > 0) {
		return {
			transactions: [],
			cards: [],
			errors: ['Missing required columns: ' + missingColumns.join(', ')],
			summary: {
				transactionCount: 0,
				cardCount: 0,
				personCount: 0,
				loanCount: 0,
				paymentCount: 0,
				dateRange: null
			}
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
				errors.push('Row ' + (i + 1) + ': Missing required fields');
				continue;
			}

			const date = parseDate(dateStr);
			if (isNaN(date.getTime())) {
				errors.push('Row ' + (i + 1) + ': Invalid date "' + dateStr + '"');
				continue;
			}

			if (typeStr !== 'income' && typeStr !== 'expense') {
				errors.push(
					'Row ' + (i + 1) + ': Invalid type "' + typeStr + '" (must be income or expense)'
				);
				continue;
			}

			const amount = parseFloat(amountStr);
			if (isNaN(amount) || amount <= 0) {
				errors.push('Row ' + (i + 1) + ': Invalid amount "' + amountStr + '"');
				continue;
			}

			const cents = Math.round(amount * 100);
			const currency = colIndex.currency >= 0 ? values[colIndex.currency] || 'QAR' : 'QAR';
			const paymentMethod =
				colIndex.paymentMethod >= 0
					? values[colIndex.paymentMethod].toLowerCase() === 'card'
						? 'card'
						: 'cash'
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
				cardName:
					paymentMethod === 'card' && cardName && cardName !== 'N/A' && cardName !== 'Unknown'
						? cardName
						: undefined
			});
		} catch {
			errors.push('Row ' + (i + 1) + ': Failed to parse');
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
			personCount: 0,
			loanCount: 0,
			paymentCount: 0,
			dateRange: earliest !== null && latest !== null ? { earliest, latest } : null
		}
	};
}

/** Parse a full JSON backup. Returns null when the file is not a v2 backup. */
function parseBackup(parsed: Record<string, unknown>): ParsedImportData | null {
	if (parsed.version !== 2 || !Array.isArray(parsed.transactions) || !Array.isArray(parsed.cards)) {
		return null;
	}

	// Remap card ids to card names so the normal (name-based) import path can reuse cards.
	const cardNameById = new Map<string, string>();
	for (const card of (parsed.cards as Card[]) ?? []) {
		if (card && typeof card.id === 'string' && typeof card.name === 'string') {
			cardNameById.set(card.id, card.name);
		}
	}

	const transactions: ImportTransaction[] = (parsed.transactions as Transaction[]).map((tx) => ({
		amount: tx.amount,
		currency: tx.currency,
		type: tx.type,
		paymentMethod: tx.paymentMethod,
		cardId: null,
		note: tx.note ?? '',
		createdAt: tx.createdAt ?? Date.now(),
		cardName: tx.cardId ? cardNameById.get(tx.cardId) : undefined
	}));

	const people = Array.isArray(parsed.people) ? (parsed.people as Person[]) : [];
	const loans = Array.isArray(parsed.loans) ? (parsed.loans as Loan[]) : [];
	const payments = Array.isArray(parsed.payments) ? (parsed.payments as LoanPayment[]) : [];

	// Drop loan/repayment records whose person or loan reference is missing from
	// the file itself. They could never be shown or settled, so keeping them would
	// only leave unreachable rows hidden in the database.
	const peopleIds = new Set<string>(people.map((p) => p.id));
	const loanIds = new Set<string>(loans.map((l) => l.id));
	const keptLoans = loans.filter((l) => peopleIds.has(l.personId));
	const keptPayments = payments.filter((p) => loanIds.has(p.loanId));
	const errors: string[] = [];
	const droppedOrphans = loans.length - keptLoans.length + (payments.length - keptPayments.length);
	if (droppedOrphans > 0) {
		errors.push(
			'Dropped ' +
				droppedOrphans +
				' loan/repayment record(s) with missing person or loan references'
		);
	}

	let earliest: number | null = null;
	let latest: number | null = null;
	for (const tx of transactions) {
		if (tx.createdAt != null) {
			if (earliest === null || tx.createdAt < earliest) earliest = tx.createdAt;
			if (latest === null || tx.createdAt > latest) latest = tx.createdAt;
		}
	}

	return {
		transactions,
		cards: (parsed.cards as Card[]).map((c) => ({
			name: c.name,
			lastFour: c.lastFour,
			color: c.color
		})),
		people,
		loans: keptLoans,
		payments: keptPayments,
		errors,
		summary: {
			transactionCount: transactions.length,
			cardCount: (parsed.cards as Card[]).length,
			personCount: people.length,
			loanCount: keptLoans.length,
			paymentCount: keptPayments.length,
			dateRange: earliest !== null && latest !== null ? { earliest, latest } : null
		}
	};
}

/**
 * Parse a file for import. Accepts either a full JSON backup (v2) or the legacy
 * transactions CSV — both are produced by this app's export feature.
 */
export async function parseImport(file: File): Promise<ParsedImportData> {
	const ext = file.name.split('.').pop()?.toLowerCase();
	const head = await file.slice(0, Math.min(file.size, 512)).text();
	const jsonLike = ext === 'json' || head.trimStart().startsWith('{');

	if (jsonLike) {
		const text = await file.text();
		try {
			const parsed = JSON.parse(text) as Record<string, unknown>;
			const result = parseBackup(parsed);
			if (result) return result;
		} catch {
			// fall through to the error result below
		}
		return {
			transactions: [],
			cards: [],
			errors: ['Not a valid expense-tracker backup file'],
			summary: {
				transactionCount: 0,
				cardCount: 0,
				personCount: 0,
				loanCount: 0,
				paymentCount: 0,
				dateRange: null
			}
		};
	}

	return parseCSVFile(file);
}

/** Legacy CSV parser (kept for existing tooling and tests). */
export async function parseCSV(file: File): Promise<ParsedImportData> {
	return parseCSVFile(file);
}
