import { openDB, type DBSchema, type IDBPDatabase } from 'idb';

export interface Transaction {
	id: string;
	amount: number; // stored in smallest unit (cents) to avoid float issues
	currency: string;
	type: 'income' | 'expense';
	paymentMethod: 'cash' | 'card';
	cardId: string | null;
	note: string;
	createdAt: number;
}

export interface Card {
	id: string;
	name: string;
	lastFour: string;
	color: string;
}

interface ExpenseDB extends DBSchema {
	transactions: {
		key: string;
		value: Transaction;
		indexes: { 'by-date': number };
	};
	cards: {
		key: string;
		value: Card;
	};
}

const DB_NAME = 'expense-tracker';
const DB_VERSION = 1;

let dbPromise: Promise<IDBPDatabase<ExpenseDB>> | null = null;

function getDB(): Promise<IDBPDatabase<ExpenseDB>> {
	if (dbPromise) return dbPromise;
	dbPromise = openDB<ExpenseDB>(DB_NAME, DB_VERSION, {
		upgrade(db) {
			const txStore = db.createObjectStore('transactions', { keyPath: 'id' });
			txStore.createIndex('by-date', 'createdAt', { unique: false });

			db.createObjectStore('cards', { keyPath: 'id' });
		}
	});
	return dbPromise;
}

export async function addTransaction(
	tx: Omit<Transaction, 'id' | 'createdAt'>
): Promise<Transaction> {
	const db = await getDB();
	const transaction: Transaction = {
		...tx,
		id: crypto.randomUUID(),
		createdAt: Date.now()
	};
	await db.put('transactions', transaction);
	return transaction;
}

export async function updateTransaction(
	id: string,
	updates: Partial<Omit<Transaction, 'id'>>
): Promise<Transaction | null> {
	const db = await getDB();
	const existing = await db.get('transactions', id);
	if (!existing) return null;
	const updated = { ...existing, ...updates };
	await db.put('transactions', updated);
	return updated;
}

export async function deleteTransaction(id: string): Promise<boolean> {
	const db = await getDB();
	await db.delete('transactions', id);
	return true;
}

export async function getTransactions(
	options: { cursor?: number; limit?: number; direction?: 'prev' | 'next' } = {}
): Promise<{ items: Transaction[]; nextCursor: number | null }> {
	const db = await getDB();
	const limit = options.limit ?? 50;
	const direction = options.direction ?? 'prev';

	const tx = db.transaction('transactions', 'readonly');
	const store = tx.objectStore('transactions');
	const index = store.index('by-date');

	const items: Transaction[] = [];
	let cursor = options.cursor
		? index.openCursor(options.cursor, direction)
		: index.openCursor(null, direction);

	let result = await cursor;
	while (result && items.length < limit) {
		items.push(result.value);
		result = await result.continue();
	}

	// If we got fewer items than limit, there's no more data
	const nextCursor = items.length < limit ? null : (items[items.length - 1]?.createdAt ?? null);

	return { items, nextCursor };
}

export async function getTransactionsByDateRange(
	start: number,
	end: number,
	options: { limit?: number; offset?: number } = {}
): Promise<Transaction[]> {
	const db = await getDB();
	const limit = options.limit ?? 100;
	const offset = options.offset ?? 0;

	const index = db.transaction('transactions').store.index('by-date');
	const range = IDBKeyRange.bound(start, end);
	let cursor = await index.openCursor(range, 'prev');

	const items: Transaction[] = [];
	let skipped = 0;

	while (cursor) {
		if (skipped < offset) {
			skipped++;
		} else if (items.length < limit) {
			items.push(cursor.value);
		} else {
			break;
		}
		cursor = await cursor.continue();
	}

	return items;
}

export async function getBalance(currency: string = 'USD'): Promise<number> {
	const db = await getDB();
	const tx = db.transaction('transactions', 'readonly');
	const store = tx.store;
	let cursor = await store.openCursor();

	let balance = 0;
	while (cursor) {
		const item = cursor.value;
		if (item.currency === currency) {
			balance += item.type === 'income' ? item.amount : -item.amount;
		}
		cursor = await cursor.continue();
	}

	return balance;
}

// Card management
export async function getCards(): Promise<Card[]> {
	const db = await getDB();
	return db.getAll('cards');
}

export async function addCard(card: Omit<Card, 'id'>): Promise<Card> {
	const db = await getDB();
	const newCard: Card = { ...card, id: crypto.randomUUID() };
	await db.put('cards', newCard);
	return newCard;
}

export async function updateCard(
	id: string,
	updates: Partial<Omit<Card, 'id'>>
): Promise<Card | null> {
	const db = await getDB();
	const existing = await db.get('cards', id);
	if (!existing) return null;
	const updated = { ...existing, ...updates };
	await db.put('cards', updated);
	return updated;
}

export async function deleteCard(id: string): Promise<void> {
	const db = await getDB();
	await db.delete('cards', id);
}

// Seed default cards if none exist
export async function seedDefaultCards(): Promise<void> {
	const existing = await getCards();
	if (existing.length > 0) return;

	await addCard({ name: 'Card 1', lastFour: '0001', color: '#3b82f6' });
	await addCard({ name: 'Card 2', lastFour: '0002', color: '#10b981' });
	await addCard({ name: 'Card 3', lastFour: '0003', color: '#f59e0b' });
}

// Persistent storage request
export async function requestPersistentStorage(): Promise<boolean> {
	if (navigator.storage && navigator.storage.persist) {
		return navigator.storage.persist();
	}
	return false;
}

export async function isStoragePersisted(): Promise<boolean> {
	if (navigator.storage && navigator.storage.persisted) {
		return navigator.storage.persisted();
	}
	return false;
}
