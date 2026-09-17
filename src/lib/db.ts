import { openDB, type DBSchema, type IDBPDatabase } from 'idb';

/** UUID generator with a fallback for non-secure contexts. */
export function generateUUID(): string {
	if (typeof crypto !== 'undefined' && crypto.randomUUID) {
		return crypto.randomUUID();
	}
	// Fallback for non-secure contexts
	return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
		const r = (Math.random() * 16) | 0;
		const v = c === 'x' ? r : (r & 0x3) | 0x8;
		return v.toString(16);
	});
}

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

export interface Person {
	id: string;
	name: string;
	/** Lowercased/trimmed name used to prevent duplicate people. */
	nameKey: string;
	color: string;
	createdAt: number;
}

export type LoanDirection = 'lent' | 'borrowed';

export interface Loan {
	id: string;
	personId: string;
	/** 'lent' = you gave money out; 'borrowed' = you took money in. */
	direction: LoanDirection;
	/** Principal, positive, in the smallest unit (cents). */
	amount: number;
	currency: string;
	note: string;
	dueDate: number | null;
	createdAt: number;
}

export interface LoanPayment {
	id: string;
	loanId: string;
	personId: string;
	/** Repayment amount, positive, in the smallest unit (cents). */
	amount: number;
	note: string;
	createdAt: number;
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
	people: {
		key: string;
		value: Person;
		indexes: { 'by-name': string };
	};
	loans: {
		key: string;
		value: Loan;
		indexes: { 'by-person': string; 'by-date': number };
	};
	loanPayments: {
		key: string;
		value: LoanPayment;
		indexes: { 'by-loan': string; 'by-person': string };
	};
}

const DB_NAME = 'expense-tracker';
const DB_VERSION = 2;

let dbPromise: Promise<IDBPDatabase<ExpenseDB>> | null = null;

function getDB(): Promise<IDBPDatabase<ExpenseDB>> {
	if (dbPromise) return dbPromise;
	dbPromise = openDB<ExpenseDB>(DB_NAME, DB_VERSION, {
		// Additive migration: existing stores are only created for fresh installs,
		// so upgrading from v1 keeps every transaction and card untouched.
		upgrade(db, oldVersion) {
			if (oldVersion < 1) {
				const txStore = db.createObjectStore('transactions', { keyPath: 'id' });
				txStore.createIndex('by-date', 'createdAt', { unique: false });
				db.createObjectStore('cards', { keyPath: 'id' });
			}

			if (oldVersion < 2) {
				const people = db.createObjectStore('people', { keyPath: 'id' });
				people.createIndex('by-name', 'nameKey', { unique: false });

				const loans = db.createObjectStore('loans', { keyPath: 'id' });
				loans.createIndex('by-person', 'personId', { unique: false });
				loans.createIndex('by-date', 'createdAt', { unique: false });

				const payments = db.createObjectStore('loanPayments', { keyPath: 'id' });
				payments.createIndex('by-loan', 'loanId', { unique: false });
				payments.createIndex('by-person', 'personId', { unique: false });
			}
		}
	});
	return dbPromise;
}

export async function getAllTransactions(): Promise<Transaction[]> {
	const db = await getDB();
	const items = await db.getAll('transactions');
	return items.sort((a, b) => b.createdAt - a.createdAt);
}

export async function addTransaction(
	tx: Omit<Transaction, 'id' | 'createdAt'>
): Promise<Transaction> {
	const db = await getDB();
	const transaction: Transaction = {
		...tx,
		id: generateUUID(),
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

// Card management
export async function getCards(): Promise<Card[]> {
	const db = await getDB();
	return db.getAll('cards');
}

export async function addCard(card: Omit<Card, 'id'>): Promise<Card> {
	const db = await getDB();
	const newCard: Card = { ...card, id: generateUUID() };
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

export async function bulkAddTransactions(transactions: Transaction[]): Promise<void> {
	const db = await getDB();
	const tx = db.transaction('transactions', 'readwrite');
	for (const transaction of transactions) {
		await tx.store.put(transaction);
	}
	await tx.done;
}

export async function bulkAddCards(cards: Card[]): Promise<void> {
	const db = await getDB();
	const tx = db.transaction('cards', 'readwrite');
	for (const card of cards) {
		await tx.store.put(card);
	}
	await tx.done;
}

export async function clearAllTransactions(): Promise<void> {
	const db = await getDB();
	await db.clear('transactions');
}

export async function clearAllCards(): Promise<void> {
	const db = await getDB();
	await db.clear('cards');
}
// ---- People ----
export async function getAllPeople(): Promise<Person[]> {
	const db = await getDB();
	const items = await db.getAll('people');
	return items.sort((a, b) => a.name.localeCompare(b.name));
}

export async function addPerson(person: Omit<Person, 'id'>): Promise<Person> {
	const db = await getDB();
	const newPerson: Person = { ...person, id: generateUUID() };
	await db.put('people', newPerson);
	return newPerson;
}

export async function updatePerson(
	id: string,
	updates: Partial<Omit<Person, 'id'>>
): Promise<Person | null> {
	const db = await getDB();
	const existing = await db.get('people', id);
	if (!existing) return null;
	const updated = { ...existing, ...updates };
	await db.put('people', updated);
	return updated;
}

export async function deletePerson(id: string): Promise<void> {
	const db = await getDB();
	await db.delete('people', id);
}

export async function bulkAddPeople(people: Person[]): Promise<void> {
	const db = await getDB();
	const tx = db.transaction('people', 'readwrite');
	for (const person of people) await tx.store.put(person);
	await tx.done;
}

export async function clearAllPeople(): Promise<void> {
	const db = await getDB();
	await db.clear('people');
}

// ---- Loans ----
export async function getAllLoans(): Promise<Loan[]> {
	const db = await getDB();
	const items = await db.getAll('loans');
	return items.sort((a, b) => b.createdAt - a.createdAt);
}

export async function addLoan(loan: Omit<Loan, 'id'>): Promise<Loan> {
	const db = await getDB();
	const newLoan: Loan = { ...loan, id: generateUUID() };
	await db.put('loans', newLoan);
	return newLoan;
}

export async function updateLoan(
	id: string,
	updates: Partial<Omit<Loan, 'id'>>
): Promise<Loan | null> {
	const db = await getDB();
	const existing = await db.get('loans', id);
	if (!existing) return null;
	const updated = { ...existing, ...updates };
	await db.put('loans', updated);
	return updated;
}

export async function deleteLoan(id: string): Promise<void> {
	const db = await getDB();
	await db.delete('loans', id);
}

export async function bulkAddLoans(loans: Loan[]): Promise<void> {
	const db = await getDB();
	const tx = db.transaction('loans', 'readwrite');
	for (const loan of loans) await tx.store.put(loan);
	await tx.done;
}

export async function clearAllLoans(): Promise<void> {
	const db = await getDB();
	await db.clear('loans');
}

// ---- Loan payments ----
export async function getAllLoanPayments(): Promise<LoanPayment[]> {
	const db = await getDB();
	const items = await db.getAll('loanPayments');
	return items.sort((a, b) => b.createdAt - a.createdAt);
}

export async function addLoanPayment(payment: Omit<LoanPayment, 'id'>): Promise<LoanPayment> {
	const db = await getDB();
	const newPayment: LoanPayment = { ...payment, id: generateUUID() };
	await db.put('loanPayments', newPayment);
	return newPayment;
}

export async function updateLoanPayment(
	id: string,
	updates: Partial<Omit<LoanPayment, 'id'>>
): Promise<LoanPayment | null> {
	const db = await getDB();
	const existing = await db.get('loanPayments', id);
	if (!existing) return null;
	const updated = { ...existing, ...updates };
	await db.put('loanPayments', updated);
	return updated;
}

export async function deleteLoanPayment(id: string): Promise<void> {
	const db = await getDB();
	await db.delete('loanPayments', id);
}

export async function bulkAddLoanPayments(payments: LoanPayment[]): Promise<void> {
	const db = await getDB();
	const tx = db.transaction('loanPayments', 'readwrite');
	for (const payment of payments) await tx.store.put(payment);
	await tx.done;
}

export async function clearAllLoanPayments(): Promise<void> {
	const db = await getDB();
	await db.clear('loanPayments');
}
