<script lang="ts">
	import { filterStore, formatMonthTimestamp } from '$lib/filters.svelte';
	import { transactionStore } from '$lib/stores.svelte';

	interface Pill {
		key: string;
		label: string;
		onDismiss: () => void;
	}

	let pills = $derived.by(() => {
		const result: Pill[] = [];

		if (filterStore.type !== 'all') {
			result.push({
				key: 'type',
				label: filterStore.type === 'income' ? 'Income' : 'Expense',
				onDismiss: () => {
					filterStore.type = 'all';
				}
			});
		}

		if (filterStore.paymentMethod !== 'all') {
			result.push({
				key: 'payment',
				label: filterStore.paymentMethod === 'cash' ? 'Cash' : 'Card',
				onDismiss: () => {
					filterStore.paymentMethod = 'all';
					filterStore.cardIds = [];
				}
			});
		}

		if (filterStore.paymentMethod === 'card' && filterStore.cardIds.length > 0) {
			for (const cardId of filterStore.cardIds) {
				const card = transactionStore.cards.find((c) => c.id === cardId);
				if (card) {
					result.push({
						key: `card-${cardId}`,
						label: card.name,
						onDismiss: () => {
							filterStore.cardIds = filterStore.cardIds.filter((id) => id !== cardId);
						}
					});
				}
			}
		}

		if (filterStore.selectedMonth !== null) {
			result.push({
				key: 'date-month',
				label: formatMonthTimestamp(filterStore.selectedMonth),
				onDismiss: () => {
					filterStore.selectedMonth = null;
				}
			});
		} else if (filterStore.datePreset !== 'all') {
			const labels: Record<string, string> = {
				thisMonth: 'This Month',
				lastMonth: 'Last Month',
				thisYear: 'This Year'
			};
			result.push({
				key: 'date-preset',
				label: labels[filterStore.datePreset] || filterStore.datePreset,
				onDismiss: () => {
					filterStore.datePreset = 'all';
				}
			});
		}

		if (filterStore.amountMin !== null) {
			result.push({
				key: 'amount-min',
				label: `Min QR ${filterStore.amountMin}`,
				onDismiss: () => {
					filterStore.amountMin = null;
				}
			});
		}

		if (filterStore.amountMax !== null) {
			result.push({
				key: 'amount-max',
				label: `Max QR ${filterStore.amountMax}`,
				onDismiss: () => {
					filterStore.amountMax = null;
				}
			});
		}

		if (filterStore.noteSearch) {
			result.push({
				key: 'note',
				label: `"${filterStore.noteSearch}"`,
				onDismiss: () => {
					filterStore.noteSearch = '';
				}
			});
		}

		return result;
	});
</script>

{#if pills.length > 0}
	<div class="mb-3 flex gap-2 overflow-x-auto pb-1">
		{#each pills as pill (pill.key)}
			<button
				class="flex shrink-0 items-center gap-1 rounded-full bg-blue-50 px-3 py-1 text-xs font-medium text-blue-600 active:bg-blue-100 dark:bg-sky-500/10 dark:text-sky-400 dark:active:bg-sky-500/20"
				onclick={pill.onDismiss}
			>
				{pill.label}
				<svg class="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path
						stroke-linecap="round"
						stroke-linejoin="round"
						stroke-width="2"
						d="M6 18L18 6M6 6l12 12"
					/>
				</svg>
			</button>
		{/each}
		<button
			class="flex shrink-0 items-center gap-1 rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-500 active:bg-gray-200 dark:bg-slate-700 dark:text-slate-400 dark:active:bg-slate-600"
			onclick={() => filterStore.reset()}
		>
			Clear All
		</button>
	</div>
{/if}
