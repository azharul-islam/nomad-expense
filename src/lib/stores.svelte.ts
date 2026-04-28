import {
	addTransaction,
	updateTransaction,
	deleteTransaction,
	getTransactions,
	getAllTransactions,
	getCards,
	seedDefaultCards,
	addCard as dbAddCard,
	updateCard as dbUpdateCard,
	deleteCard as dbDeleteCard,
	requestPersistentStorage,
	isStoragePersisted,
	resetDB,
	bulkAddTransactions,
	bulkAddCards,
	clearAllTransactions,
	clearAllCards,
	type Transaction,
	type Card
} from './db';

class TransactionStore {
	transactions = $state<Transaction[]>([]);
	cards = $state<Card[]>([]);
	loading = $state(false);
	initialized = $state(false);
	hasMore = $state(true);
	private cursor: number | null = null;
	private currency = 'QAR';
	private initPromise: Promise<void> | null = null;

	balance = $derived(
		this.transactions.reduce((sum, t) => {
			if (t.currency !== this.currency) return sum;
			return sum + (t.type === 'income' ? t.amount : -t.amount);
		}, 0)
	);

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
			this.hasMore = false;
			this.cursor = null;
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

	private reloading = false;
	async reload() {
		if (this.reloading) return;
		this.reloading = true;
		try {
			this.initialized = false;
			this.transactions = [];
			this.cursor = null;
			this.hasMore = true;
			await resetDB();
			await this.init();
		} finally {
			this.reloading = false;
		}
	}

	async loadTransactions(reset = false) {
		if (this.loading) return;
		this.loading = true;

		try {
			if (reset) {
				this.cursor = null;
				this.transactions = [];
				this.hasMore = true;
			}

			const { items, nextCursor } = await getTransactions({
				cursor: this.cursor ?? undefined,
				limit: 50,
				direction: 'prev'
			});

			if (reset) {
				this.transactions = items;
			} else {
				this.transactions = [...this.transactions, ...items];
			}

			this.cursor = nextCursor;
			this.hasMore = nextCursor !== null;
		} finally {
			this.loading = false;
		}
	}

	async loadMore() {
		if (!this.hasMore || this.loading) return;
		await this.loadTransactions();
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
		if (mode === 'replace') {
			await clearAllTransactions();
			await clearAllCards();
			this.transactions = [];
			this.cards = [];
		}

		const cardMap = new Map<string, string>();

		if (cards.length > 0) {
			const newCards: Card[] = cards.map((c) => ({
				...c,
				id: crypto.randomUUID()
			}));
			await bulkAddCards(newCards);
			for (const card of newCards) {
				cardMap.set(card.name, card.id);
			}
			this.cards = [...this.cards, ...newCards];
		}

		const existingCardMap = new Map<string, string>();
		for (const card of this.cards) {
			existingCardMap.set(card.name, card.id);
		}

		const transactionsWithIds: Transaction[] = transactions.map((tx) => {
			let cardId: string | null = null;
			const txCardName = (tx as { cardName?: string }).cardName;
			if (tx.paymentMethod === 'card' && txCardName) {
				cardId = existingCardMap.get(txCardName) || cardMap.get(txCardName) || null;
			}
			return {
				...tx,
				id: crypto.randomUUID(),
				createdAt: Date.now(),
				cardId
			};
		});

		await bulkAddTransactions(transactionsWithIds);

		if (mode === 'replace') {
			this.transactions = transactionsWithIds.sort(
				(a, b) => b.createdAt - a.createdAt
			);
		} else {
			this.transactions = [
				...this.transactions,
				...transactionsWithIds
			].sort((a, b) => b.createdAt - a.createdAt);
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
