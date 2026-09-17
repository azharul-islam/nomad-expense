import type { Transaction, Card, Person, Loan, LoanPayment } from '$lib/db';

/** Complete backup format (v2). Legacy CSV exports remain supported and unchanged. */
export interface BackupFile {
	version: 2;
	exportedAt: number;
	transactions: Transaction[];
	cards: Card[];
	people: Person[];
	loans: Loan[];
	payments: LoanPayment[];
}

function escapeCSV(value: string): string {
	if (value.includes(',') || value.includes('"') || value.includes('\n')) {
		return '"' + value.replace(/"/g, '""') + '"';
	}
	return value;
}

function formatDate(timestamp: number): string {
	const date = new Date(timestamp);
	const year = date.getFullYear();
	const month = String(date.getMonth() + 1).padStart(2, '0');
	const day = String(date.getDate()).padStart(2, '0');
	const hours = String(date.getHours()).padStart(2, '0');
	const minutes = String(date.getMinutes()).padStart(2, '0');
	return year + '-' + month + '-' + day + ' ' + hours + ':' + minutes;
}

function formatAmount(cents: number): string {
	return (cents / 100).toFixed(2);
}

export function exportToCSV(transactions: Transaction[], cards: Card[]): string {
	const cardMap = new Map<string, string>();
	for (const card of cards) {
		cardMap.set(card.id, card.name);
	}

	const headers = ['Date', 'Type', 'Amount', 'Currency', 'Payment Method', 'Card', 'Note'];
	const rows = [headers.join(',')];

	for (const tx of transactions) {
		const cardName = tx.cardId ? cardMap.get(tx.cardId) || 'Unknown' : 'N/A';
		const row = [
			escapeCSV(formatDate(tx.createdAt)),
			escapeCSV(tx.type),
			escapeCSV(formatAmount(tx.amount)),
			escapeCSV(tx.currency),
			escapeCSV(tx.paymentMethod),
			escapeCSV(cardName),
			escapeCSV(tx.note)
		];
		rows.push(row.join(','));
	}

	return rows.join('\n');
}

/** Full JSON backup of every entity type (transactions, cards, people, loans, payments). */
export function exportToBackup(backup: BackupFile): string {
	return JSON.stringify(backup, null, 2);
}

function download(content: string, filename: string, type: string): void {
	const blob = new Blob([content], { type });
	const url = URL.createObjectURL(blob);
	const link = document.createElement('a');
	link.href = url;
	link.download = filename;
	link.style.display = 'none';
	document.body.appendChild(link);
	link.click();
	document.body.removeChild(link);
	URL.revokeObjectURL(url);
}

export function downloadCSV(content: string, filename: string): void {
	download(content, filename, 'text/csv;charset=utf-8;');
}

export function downloadJSON(content: string, filename: string): void {
	download(content, filename, 'application/json;charset=utf-8;');
}
