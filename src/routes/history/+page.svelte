<script lang="ts">
	import { transactionStore } from '$lib/stores.svelte';
	import { filterStore } from '$lib/filters.svelte';
	import {
		CURRENCY_SYMBOL,
		formatCurrency,
		parseAmountToCents,
		splitCurrency
	} from '$lib/utils/currency';
	import TransactionListItem from '$lib/components/TransactionListItem.svelte';
	import FilterPills from '$lib/components/FilterPills.svelte';
	import FilterModal from '$lib/components/FilterModal.svelte';

	let editingId = $state<string | null>(null);
	let editAmount = $state('');
	let editNote = $state('');
	let editType = $state<'income' | 'expense'>('expense');
	let showFilterModal = $state(false);

	function formatDate(timestamp: number): string {
		return new Date(timestamp).toLocaleDateString([], {
			weekday: 'short',
			year: 'numeric',
			month: 'short',
			day: 'numeric',
			hour: '2-digit',
			minute: '2-digit'
		});
	}

	function startEdit(tx: (typeof transactionStore.transactions)[0]) {
		editingId = tx.id;
		editAmount = (tx.amount / 100).toFixed(2);
		editNote = tx.note;
		editType = tx.type;
	}

	function cancelEdit() {
		editingId = null;
		editAmount = '';
		editNote = '';
	}

	async function saveEdit(id: string) {
		const cents = parseAmountToCents(editAmount);
		if (isNaN(cents) || cents <= 0) return;

		await transactionStore.update(id, {
			amount: cents,
			note: editNote.trim(),
			type: editType
		});
		editingId = null;
	}

	async function handleDelete(id: string) {
		if (confirm('Delete this transaction?')) {
			await transactionStore.remove(id);
		}
	}

	const filteredTransactions = $derived.by(() => {
		if (!filterStore.hasActiveFilters) return transactionStore.transactions;
		return transactionStore.transactions.filter((tx) => filterStore.matches(tx));
	});

	const filteredTotals = $derived.by(() => {
		let income = 0;
		let expense = 0;
		for (const tx of filteredTransactions) {
			if (tx.type === 'income') income += tx.amount;
			else expense += tx.amount;
		}
		return { income, expense };
	});

	const groupedByMonth = $derived.by(() => {
		const groups: Record<
			string,
			{ income: number; expense: number; items: typeof transactionStore.transactions }
		> = {};

		for (const tx of filteredTransactions) {
			const date = new Date(tx.createdAt);
			const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;

			if (!groups[key]) {
				groups[key] = { income: 0, expense: 0, items: [] };
			}

			if (tx.type === 'income') {
				groups[key].income += tx.amount;
			} else {
				groups[key].expense += tx.amount;
			}

			groups[key].items.push(tx);
		}

		return Object.entries(groups).sort((a, b) => b[0].localeCompare(a[0]));
	});

	function formatMonthLabel(key: string): string {
		const [year, month] = key.split('-');
		return new Date(parseInt(year), parseInt(month) - 1).toLocaleDateString([], {
			month: 'long',
			year: 'numeric'
		});
	}

	const incomeParts = $derived(splitCurrency(formatCurrency(filteredTotals.income)));
	const expenseParts = $derived(splitCurrency(formatCurrency(filteredTotals.expense)));
</script>

<div class="flex h-full flex-col overflow-hidden">
	<div class="flex shrink-0 items-center justify-between px-4 pt-4 pb-2">
		<h2 class="text-lg font-semibold text-gray-900 dark:text-white">History</h2>
		<button
			class="relative rounded-lg p-2 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600 active:bg-gray-100 dark:hover:bg-slate-800 dark:hover:text-white dark:active:bg-slate-800 {filterStore.hasActiveFilters
				? 'text-blue-600 dark:text-sky-400'
				: ''}"
			aria-label="Filter transactions"
			onclick={() => (showFilterModal = true)}
		>
			<svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
				<path
					stroke-linecap="round"
					stroke-linejoin="round"
					stroke-width="2"
					d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z"
				/>
			</svg>
			{#if filterStore.hasActiveFilters}
				<span class="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-blue-500 dark:bg-sky-400"
				></span>
			{/if}
		</button>
	</div>

	<div class="flex-1 overflow-y-auto overscroll-contain px-4 pb-4">
		{#if !transactionStore.initialized}
			<div
				class="flex h-full flex-col items-center justify-center text-gray-400 dark:text-slate-500"
			>
				<p class="text-sm">Loading transactions...</p>
			</div>
		{:else if transactionStore.transactions.length === 0}
			<div
				class="flex h-full flex-col items-center justify-center text-gray-400 dark:text-slate-500"
			>
				<p class="text-sm">No transactions yet</p>
				<p class="mt-1 text-xs">Go to Tracker to add your first expense</p>
			</div>
		{:else}
			<!-- Summary Cards -->
			<div class="mb-6 grid grid-cols-2 gap-3">
				<div class="rounded-2xl bg-emerald-50 p-4 dark:bg-emerald-950/40">
					<p class="text-xs font-medium text-emerald-600 uppercase dark:text-emerald-400">
						{filterStore.hasActiveFilters ? 'Income (filtered)' : 'Total Income'}
					</p>
					<p class="mt-1 text-xl font-bold text-gray-900 dark:text-white">
						{CURRENCY_SYMBOL}<span class="font-mono"
							>{incomeParts[0]}<span class="text-sm">.{incomeParts[1]}</span></span
						>
					</p>
				</div>
				<div class="rounded-2xl bg-rose-50 p-4 dark:bg-rose-950/40">
					<p class="text-xs font-medium text-rose-600 uppercase dark:text-rose-400">
						{filterStore.hasActiveFilters ? 'Expenses (filtered)' : 'Total Expenses'}
					</p>
					<p class="mt-1 text-xl font-bold text-gray-900 dark:text-white">
						{CURRENCY_SYMBOL}<span class="font-mono"
							>{expenseParts[0]}<span class="text-sm">.{expenseParts[1]}</span></span
						>
					</p>
				</div>
			</div>

			<!-- Filter Pills -->
			<FilterPills />

			<!-- Result Count -->
			{#if filterStore.hasActiveFilters}
				<p class="mb-3 text-xs text-gray-500 dark:text-slate-400">
					Showing {filteredTransactions.length} of {transactionStore.transactions.length}
				</p>
			{/if}

			<!-- No Results -->
			{#if filteredTransactions.length === 0}
				<div
					class="flex flex-col items-center justify-center py-12 text-gray-400 dark:text-slate-500"
				>
					<p class="text-sm">No transactions match your filters</p>
					<button
						class="mt-2 rounded-lg bg-blue-50 px-3 py-1.5 text-xs font-medium text-blue-600 hover:bg-blue-100 dark:bg-sky-500/10 dark:text-sky-400 dark:hover:bg-sky-500/20"
						onclick={() => filterStore.reset()}
					>
						Clear Filters
					</button>
				</div>
			{:else}
				<!-- Monthly Grouping -->
				{#each groupedByMonth as [monthKey, data] (monthKey)}
					<div class="mb-6">
						<div class="mb-3 flex items-center justify-between">
							<h3 class="text-sm font-semibold text-gray-700 dark:text-slate-300">
								{formatMonthLabel(monthKey)}
							</h3>
							<div class="flex gap-3 text-xs">
								<span class="text-emerald-600 dark:text-emerald-400"
									>+{CURRENCY_SYMBOL}<span class="font-mono"
										>{splitCurrency(formatCurrency(data.income))[0]}<span class="text-[0.6rem]"
											>.{splitCurrency(formatCurrency(data.income))[1]}</span
										></span
									></span
								>
								<span class="text-rose-600 dark:text-rose-400"
									>-{CURRENCY_SYMBOL}<span class="font-mono"
										>{splitCurrency(formatCurrency(data.expense))[0]}<span class="text-[0.6rem]"
											>.{splitCurrency(formatCurrency(data.expense))[1]}</span
										></span
									></span
								>
							</div>
						</div>

						<div class="flex flex-col gap-2">
							{#each data.items as tx (tx.id)}
								{#if editingId === tx.id}
									<div class="rounded-2xl bg-white p-4 shadow-sm dark:bg-slate-800">
										<div class="mb-3 flex gap-2">
											<button
												class="rounded-lg px-3 py-1.5 text-xs font-medium {editType === 'expense'
													? 'bg-rose-500 text-white'
													: 'bg-gray-100 text-gray-600 dark:bg-slate-700 dark:text-slate-300'}"
												onclick={() => (editType = 'expense')}
											>
												Expense
											</button>
											<button
												class="rounded-lg px-3 py-1.5 text-xs font-medium {editType === 'income'
													? 'bg-emerald-500 text-white'
													: 'bg-gray-100 text-gray-600 dark:bg-slate-700 dark:text-slate-300'}"
												onclick={() => (editType = 'income')}
											>
												Income
											</button>
										</div>
										<input
											type="number"
											step="0.01"
											class="mb-2 w-full rounded-lg bg-gray-100 px-3 py-2 text-sm text-gray-900 outline-none dark:bg-slate-700 dark:text-white"
											bind:value={editAmount}
										/>
										<input
											type="text"
											placeholder="Note"
											class="mb-3 w-full rounded-lg bg-gray-100 px-3 py-2 text-sm text-gray-900 outline-none dark:bg-slate-700 dark:text-white"
											bind:value={editNote}
										/>
										<div class="flex gap-2">
											<button
												class="flex-1 rounded-lg bg-blue-600 py-2 text-xs font-semibold text-white dark:bg-sky-600"
												onclick={() => saveEdit(tx.id)}
											>
												Save
											</button>
											<button
												class="flex-1 rounded-lg bg-gray-100 py-2 text-xs font-semibold text-gray-600 dark:bg-slate-700 dark:text-slate-300"
												onclick={cancelEdit}
											>
												Cancel
											</button>
										</div>
									</div>
								{:else}
									<TransactionListItem
										transaction={tx}
										showActions={true}
										{formatDate}
										onEdit={startEdit}
										onDelete={handleDelete}
										class="bg-white/80 shadow-sm dark:bg-slate-800/60"
									/>
								{/if}
							{/each}
						</div>
					</div>
				{/each}
			{/if}
		{/if}
	</div>
</div>

{#if showFilterModal}
	<FilterModal onClose={() => (showFilterModal = false)} />
{/if}
