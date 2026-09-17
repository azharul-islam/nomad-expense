import type { Transaction } from './db';

export type FilterType = 'all' | 'income' | 'expense';
export type FilterPayment = 'all' | 'cash' | 'card';
export type FilterDatePreset = 'all' | 'thisMonth' | 'lastMonth' | 'thisYear';

export function formatMonthTimestamp(ts: number): string {
	const d = new Date(ts);
	return d.toLocaleDateString([], { month: 'long', year: 'numeric' });
}

class FilterStore {
	type = $state<FilterType>('all');
	paymentMethod = $state<FilterPayment>('all');
	cardIds = $state<string[]>([]);
	datePreset = $state<FilterDatePreset>('all');
	selectedMonth = $state<number | null>(null);
	amountMin = $state<number | null>(null);
	amountMax = $state<number | null>(null);
	noteSearch = $state('');

	hasActiveFilters = $derived(
		this.type !== 'all' ||
			this.paymentMethod !== 'all' ||
			this.cardIds.length > 0 ||
			this.datePreset !== 'all' ||
			this.selectedMonth !== null ||
			this.amountMin !== null ||
			this.amountMax !== null ||
			this.noteSearch !== ''
	);

	dateRange = $derived.by(() => {
		if (this.selectedMonth !== null) {
			const d = new Date(this.selectedMonth);
			return {
				start: new Date(d.getFullYear(), d.getMonth(), 1).getTime(),
				end: new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59, 999).getTime()
			};
		}
		const now = new Date();
		switch (this.datePreset) {
			case 'thisMonth':
				return {
					start: new Date(now.getFullYear(), now.getMonth(), 1).getTime(),
					end: new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999).getTime()
				};
			case 'lastMonth':
				return {
					start: new Date(now.getFullYear(), now.getMonth() - 1, 1).getTime(),
					end: new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999).getTime()
				};
			case 'thisYear':
				return {
					start: new Date(now.getFullYear(), 0, 1).getTime(),
					end: new Date(now.getFullYear(), 11, 31, 23, 59, 59, 999).getTime()
				};
			default:
				return { start: null, end: null };
		}
	});

	matches(tx: Transaction): boolean {
		if (this.type !== 'all' && tx.type !== this.type) return false;
		if (this.paymentMethod !== 'all' && tx.paymentMethod !== this.paymentMethod) return false;
		if (this.cardIds.length > 0 && (!tx.cardId || !this.cardIds.includes(tx.cardId))) return false;

		const range = this.dateRange;
		if (range.start !== null && tx.createdAt < range.start) return false;
		if (range.end !== null && tx.createdAt > range.end) return false;

		if (this.amountMin !== null && tx.amount < this.amountMin * 100) return false;
		if (this.amountMax !== null && tx.amount > this.amountMax * 100) return false;

		if (this.noteSearch && !tx.note.toLowerCase().includes(this.noteSearch.toLowerCase()))
			return false;

		return true;
	}

	setDatePreset(preset: FilterDatePreset) {
		this.datePreset = preset;
		this.selectedMonth = null;
	}

	setSelectedMonth(ts: number) {
		this.selectedMonth = ts;
		this.datePreset = 'all';
	}

	reset() {
		this.type = 'all';
		this.paymentMethod = 'all';
		this.cardIds = [];
		this.datePreset = 'all';
		this.selectedMonth = null;
		this.amountMin = null;
		this.amountMax = null;
		this.noteSearch = '';
	}
}

export const filterStore = new FilterStore();
