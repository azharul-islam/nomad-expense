<script lang="ts">
	import { transactionStore } from '$lib/stores.svelte';
	import { CURRENCY_SYMBOL, formatCurrency } from '$lib/utils/currency';
	import type { Transaction } from '$lib/db';

	interface Props {
		transaction: Transaction;
		showActions?: boolean;
		formatDate: (timestamp: number) => string;
		onEdit?: (tx: Transaction) => void;
		onDelete?: (id: string) => void;
		class?: string;
	}

	let {
		transaction: tx,
		showActions = false,
		formatDate,
		onEdit,
		onDelete,
		class: className = ''
	}: Props = $props();
</script>

<div class="flex items-center gap-3 rounded-2xl px-4 py-3 {className}">
	<div class="shrink-0 text-gray-400 dark:text-slate-500">
		{#if tx.paymentMethod === 'card'}
			<svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
				<path
					stroke-linecap="round"
					stroke-linejoin="round"
					stroke-width="2"
					d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z"
				/>
			</svg>
		{:else}
			<svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
				<path
					stroke-linecap="round"
					stroke-linejoin="round"
					stroke-width="2"
					d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z"
				/>
			</svg>
		{/if}
	</div>

	<div class="min-w-0 flex-1">
		{#if tx.note}
			<p class="truncate text-sm font-medium text-gray-800 dark:text-slate-200">{tx.note}</p>
		{:else}
			<p class="text-sm text-gray-500 dark:text-slate-400">
				{tx.paymentMethod === 'card' ? 'Card' : 'Cash'}
				{#if tx.cardId}
				{#each transactionStore.cards as card (card.id)}
					{#if card.id === tx.cardId}
						· {card.name}
					{/if}
				{/each}
				{/if}
			</p>
		{/if}
		<p class="mt-0.5 text-xs text-gray-400 dark:text-slate-500">{formatDate(tx.createdAt)}</p>
	</div>
	{#if showActions}
		<div class="flex shrink-0 gap-1">
			<button
				class="rounded-lg p-2 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-700 dark:text-slate-400 dark:hover:bg-slate-700 dark:hover:text-white"
				aria-label="Edit transaction"
				onclick={() => onEdit?.(tx)}
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
				class="rounded-lg p-2 text-gray-400 transition-colors hover:bg-rose-50 hover:text-rose-600 dark:text-slate-400 dark:hover:bg-rose-500/20 dark:hover:text-rose-400"
				aria-label="Delete transaction"
				onclick={() => onDelete?.(tx.id)}
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
	{/if}
	<span
		class="shrink-0 text-base font-semibold {tx.type === 'income'
			? 'text-emerald-600 dark:text-emerald-400'
			: 'text-rose-600 dark:text-rose-400'}"
	>
		{tx.type === 'expense' ? '-' : '+'}<span class="font-mono">{formatCurrency(tx.amount)}</span>
	</span>


</div>
