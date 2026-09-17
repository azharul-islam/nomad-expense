import {
	addTransaction,
	updateTransaction,
	deleteTransaction,
	getAllTransactions,
	getCards,
	seedDefaultCards,
	addCard as dbAddCard,
	updateCard as dbUpdateCard,
	deleteCard as dbDeleteCard,
	requestPersistentStorage,
	isStoragePersisted,
	bulkAddTransactions,
	bulkAddCards,
	clearAllTransactions,
	clearAllCards,
	generateUUID,
	type Transaction,
	type Card
} from './db';

class TransactionStore {
	transactions = $state<Transaction[]>([]);
	cards = $state<Card[]>([]);
	loading = $state(false);
	initialized = $state(false);
	private currency = 'QAR';
	private initPromise: Promise<void> | null = null;

	private totals = $derived.by(() => {
		let income = 0;
		let expense = 0;
		for (const t of this.transactions) {
			if (t.currency !== this.currency) continue;
			if (t.type === 'income') income += t.amount;
			else expense += t.amount;
		}
		return { income, expense };
	});

	incomeTotal = $derived(this.totals.income);
	expenseTotal = $derived(this.totals.expense);

	/**
	 * Tracker balance: income − expense for the primary currency only.
	 * Loans are deliberately excluded — they have their own balances on the Loans tab.
	 */
	netBalance = $derived(this.incomeTotal - this.expenseTotal);

	init(): Promise<void> {
		if (this.initialized) return Promise.resolve();
		if (this.initPromise) return this.initPromise;
		this.initPromise = this._init();
		return this.initPromise;
	}

	private async _init() {
		try {
			this.loading = true;
			// Request persistent storage early to maximize protection against iOS eviction
			await this.ensurePersistentStorage();
			await seedDefaultCards();
			await this.loadCards();
			const all = await getAllTransactions();
			this.transactions = all;
			this.initialized = true;
		} catch (err) {
			console.error('Store init failed:', err);
			this.initialized = true;
			throw err;
		} finally {
			this.loading = false;
			this.initPromise = null;
		}
	}

	async add(tx: Parameters<typeof addTransaction>[0]) {
		try {
			const newTx = await addTransaction(tx);
			this.transactions = [newTx, ...this.transactions];
			return newTx;
		} catch (err) {
			console.error('Failed to add transaction:', err);
			throw err;
		}
	}

	async update(id: string, updates: Parameters<typeof updateTransaction>[1]) {
		const updated = await updateTransaction(id, updates);
		if (updated) {
			const idx = this.transactions.findIndex((t) => t.id === id);
			if (idx !== -1) {
				this.transactions[idx] = updated;
			}
		}
		return updated;
	}

	async remove(id: string) {
		await deleteTransaction(id);
		this.transactions = this.transactions.filter((t) => t.id !== id);
	}

	async loadCards() {
		this.cards = await getCards();
	}

	async addCard(card: Omit<Card, 'id'>) {
		const newCard = await dbAddCard(card);
		this.cards = [...this.cards, newCard];
		return newCard;
	}

	async updateCard(id: string, updates: Partial<Omit<Card, 'id'>>) {
		const updated = await dbUpdateCard(id, updates);
		if (updated) {
			this.cards = this.cards.map((c) => (c.id === id ? updated : c));
		}
		return updated;
	}

	async deleteCard(id: string) {
		await dbDeleteCard(id);
		this.cards = this.cards.filter((c) => c.id !== id);
	}

	private storagePersistenceRequested = false;
	async ensurePersistentStorage() {
		if (this.storagePersistenceRequested) return;
		this.storagePersistenceRequested = true;

		const isPersisted = await isStoragePersisted();
		if (!isPersisted) {
			await requestPersistentStorage();
		}
	}

	async importData(
		transactions: Omit<Transaction, 'id' | 'createdAt'>[],
		cards: Omit<Card, 'id'>[],
		mode: 'replace' | 'append'
	) {
		// Ensure the store is loaded so existing cards/transactions are known
		// before deciding what to merge (prevents duplicates on append).
		await this.init();

		if (mode === 'replace') {
			await clearAllTransactions();
			await clearAllCards();
			this.transactions = [];
			this.cards = [];
		}

		// Merge incoming cards into the existing set by name — appending a backup
		// must not grow the card list with re-created duplicates.
		const cardByName = new Map<string, string>();
		for (const card of this.cards) {
			cardByName.set(card.name, card.id);
		}

		const newCards: Card[] = [];
		for (const incoming of cards) {
			if (cardByName.has(incoming.name)) continue;
			const created: Card = { ...incoming, id: generateUUID() };
			newCards.push(created);
			cardByName.set(incoming.name, created.id);
		}
		if (newCards.length > 0) {
			await bulkAddCards(newCards);
			this.cards = [...this.cards, ...newCards];
		}

		const transactionsWithIds: Transaction[] = transactions.map((tx) => {
			let cardId: string | null = null;
			const txCardName = (tx as { cardName?: string }).cardName;
			if (tx.paymentMethod === 'card' && txCardName) {
				cardId = cardByName.get(txCardName) || null;
			}
			const withId = tx as Transaction;
			return {
				...tx,
				id: generateUUID(),
				// Full JSON backups carry their original timestamps; CSV imports use now.
				createdAt: withId.createdAt ?? Date.now(),
				cardId
			};
		});

		await bulkAddTransactions(transactionsWithIds);

		if (mode === 'replace') {
			this.transactions = transactionsWithIds.sort((a, b) => b.createdAt - a.createdAt);
		} else {
			this.transactions = [...this.transactions, ...transactionsWithIds].sort(
				(a, b) => b.createdAt - a.createdAt
			);
		}
	}

	async clearAllData() {
		await clearAllTransactions();
		await clearAllCards();
		this.transactions = [];
		this.cards = [];
		await seedDefaultCards();
		this.cards = await getCards();
	}
}

export const transactionStore = new TransactionStore();
