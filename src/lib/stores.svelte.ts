import {
	addTransaction,
	updateTransaction,
	deleteTransaction,
	getTransactions,
	getBalance,
	getCards,
	seedDefaultCards,
	requestPersistentStorage,
	isStoragePersisted,
	type Transaction,
	type Card
} from './db';

class TransactionStore {
	transactions = $state<Transaction[]>([]);
	balance = $state(0);
	cards = $state<Card[]>([]);
	loading = $state(false);
	hasMore = $state(true);
	private cursor: number | null = null;
	private currency = 'USD';

	async init() {
		await seedDefaultCards();
		await this.loadCards();
		await this.loadTransactions();
		await this.refreshBalance();
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
		const newTx = await addTransaction(tx);
		this.transactions = [newTx, ...this.transactions];
		await this.refreshBalance();
		await this.ensurePersistentStorage();
		return newTx;
	}

	async update(id: string, updates: Parameters<typeof updateTransaction>[1]) {
		const updated = await updateTransaction(id, updates);
		if (updated) {
			const idx = this.transactions.findIndex((t) => t.id === id);
			if (idx !== -1) {
				this.transactions[idx] = updated;
			}
			await this.refreshBalance();
		}
		return updated;
	}

	async remove(id: string) {
		await deleteTransaction(id);
		this.transactions = this.transactions.filter((t) => t.id !== id);
		await this.refreshBalance();
	}

	async refreshBalance() {
		this.balance = await getBalance(this.currency);
	}

	async loadCards() {
		this.cards = await getCards();
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
}

export const transactionStore = new TransactionStore();
