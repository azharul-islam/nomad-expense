<script lang="ts">
	import { transactionStore } from '$lib/stores.svelte';
	import { CURRENCY_SYMBOL, formatCurrency, parseAmountToCents } from '$lib/utils/currency';
	import { onMount } from 'svelte';

	let editingId = $state<string | null>(null);
	let editAmount = $state('');
	let editNote = $state('');
	let editType = $state<'income' | 'expense'>('expense');

	onMount(() => {
		if (transactionStore.transactions.length === 0) {
			transactionStore.loadTransactions(true);
		}
	});

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

	// Aggregation
	const groupedByMonth = $derived(() => {
		const groups: Record<
			string,
			{ income: number; expense: number; items: typeof transactionStore.transactions }
		> = {};

		for (const tx of transactionStore.transactions) {
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
</script>

<div class="flex h-full flex-col overflow-hidden">
	<div class="flex-1 overflow-y-auto overscroll-contain px-4 py-4">
		{#if transactionStore.transactions.length === 0}
			<div class="flex h-full flex-col items-center justify-center text-slate-500">
				<p class="text-sm">No transactions yet</p>
				<p class="mt-1 text-xs">Go to Tracker to add your first expense</p>
			</div>
		{:else}
			<!-- Summary Cards -->
			<div class="mb-6 grid grid-cols-2 gap-3">
				<div class="rounded-2xl bg-emerald-950/40 p-4">
					<p class="text-xs font-medium text-emerald-400 uppercase">Total Income</p>
					<p class="mt-1 text-xl font-bold text-white">
						{CURRENCY_SYMBOL}{formatCurrency(
							transactionStore.transactions
								.filter((t) => t.type === 'income')
								.reduce((sum, t) => sum + t.amount, 0)
						)}
					</p>
				</div>
				<div class="rounded-2xl bg-rose-950/40 p-4">
					<p class="text-xs font-medium text-rose-400 uppercase">Total Expenses</p>
					<p class="mt-1 text-xl font-bold text-white">
						{CURRENCY_SYMBOL}{formatCurrency(
							transactionStore.transactions
								.filter((t) => t.type === 'expense')
								.reduce((sum, t) => sum + t.amount, 0)
						)}
					</p>
				</div>
			</div>

			<!-- Monthly Grouping -->
			{#each groupedByMonth() as [monthKey, data]}
				<div class="mb-6">
					<div class="mb-3 flex items-center justify-between">
						<h3 class="text-sm font-semibold text-slate-300">{formatMonthLabel(monthKey)}</h3>
						<div class="flex gap-3 text-xs">
							<span class="text-emerald-400">+{CURRENCY_SYMBOL}{formatCurrency(data.income)}</span>
							<span class="text-rose-400">-{CURRENCY_SYMBOL}{formatCurrency(data.expense)}</span>
						</div>
					</div>

					<div class="flex flex-col gap-2">
						{#each data.items as tx (tx.id)}
							{#if editingId === tx.id}
								<div class="rounded-2xl bg-slate-800 p-4">
									<div class="mb-3 flex gap-2">
										<button
											class="rounded-lg px-3 py-1.5 text-xs font-medium {editType === 'expense'
												? 'bg-rose-500 text-white'
												: 'bg-slate-700 text-slate-300'}"
											onclick={() => (editType = 'expense')}
										>
											Expense
										</button>
										<button
											class="rounded-lg px-3 py-1.5 text-xs font-medium {editType === 'income'
												? 'bg-emerald-500 text-white'
												: 'bg-slate-700 text-slate-300'}"
											onclick={() => (editType = 'income')}
										>
											Income
										</button>
									</div>
									<input
										type="number"
										step="0.01"
										class="mb-2 w-full rounded-lg bg-slate-700 px-3 py-2 text-sm text-white outline-none"
										bind:value={editAmount}
									/>
									<input
										type="text"
										placeholder="Note"
										class="mb-3 w-full rounded-lg bg-slate-700 px-3 py-2 text-sm text-white outline-none"
										bind:value={editNote}
									/>
									<div class="flex gap-2">
										<button
											class="flex-1 rounded-lg bg-sky-600 py-2 text-xs font-semibold text-white"
											onclick={() => saveEdit(tx.id)}
										>
											Save
										</button>
										<button
											class="flex-1 rounded-lg bg-slate-700 py-2 text-xs font-semibold text-slate-300"
											onclick={cancelEdit}
										>
											Cancel
										</button>
									</div>
								</div>
							{:else}
								<div class="flex items-center gap-3 rounded-2xl bg-slate-800/60 px-4 py-3">
									<div class="min-w-0 flex-1">
										{#if tx.note}
											<p class="truncate text-sm font-medium text-slate-200">{tx.note}</p>
										{:else}
											<p class="text-sm text-slate-400">
												{tx.paymentMethod === 'card' ? 'Card' : 'Cash'}
												{#if tx.cardId}
													{#each transactionStore.cards as card}
														{#if card.id === tx.cardId}
															· {card.name}
														{/if}
													{/each}
												{/if}
											</p>
										{/if}
										<p class="mt-0.5 text-xs text-slate-500">{formatDate(tx.createdAt)}</p>
									</div>
									<span
										class="shrink-0 text-base font-semibold {tx.type === 'income'
											? 'text-emerald-400'
											: 'text-rose-400'}"
									>
										{tx.type === 'expense' ? '-' : '+'}{CURRENCY_SYMBOL}{formatCurrency(tx.amount)}
									</span>
									<div class="flex shrink-0 gap-1">
										<button
											class="rounded-lg p-2 text-slate-400 transition-colors hover:bg-slate-700 hover:text-white"
											aria-label="Edit transaction"
											onclick={() => startEdit(tx)}
										>
											<svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
												<path
													stroke-linecap="round"
													stroke-linejoin="round"
													stroke-width="2"
													d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
												/>
											</svg>
										</button>
										<button
											class="rounded-lg p-2 text-slate-400 transition-colors hover:bg-rose-500/20 hover:text-rose-400"
											aria-label="Delete transaction"
											onclick={() => handleDelete(tx.id)}
										>
											<svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
												<path
													stroke-linecap="round"
													stroke-linejoin="round"
													stroke-width="2"
													d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
												/>
											</svg>
										</button>
									</div>
								</div>
							{/if}
						{/each}
					</div>
				</div>
			{/each}
		{/if}
	</div>
</div>
