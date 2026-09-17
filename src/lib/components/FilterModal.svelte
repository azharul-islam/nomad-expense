<script lang="ts">
	import {
		filterStore,
		type FilterType,
		type FilterPayment,
		type FilterDatePreset,
		formatMonthTimestamp
	} from '$lib/filters.svelte';
	import { transactionStore } from '$lib/stores.svelte';

	interface Props {
		onClose: () => void;
	}

	let { onClose }: Props = $props();

	let amountMinStr = $state(filterStore.amountMin?.toString() ?? '');
	let amountMaxStr = $state(filterStore.amountMax?.toString() ?? '');
	let noteSearchLocal = $state(filterStore.noteSearch);

	function handleReset() {
		filterStore.reset();
		amountMinStr = '';
		amountMaxStr = '';
		noteSearchLocal = '';
	}

	function handleApply() {
		const min = parseFloat(amountMinStr);
		filterStore.amountMin = isNaN(min) || min < 0 ? null : min;
		const max = parseFloat(amountMaxStr);
		filterStore.amountMax = isNaN(max) || max < 0 ? null : max;
		filterStore.noteSearch = noteSearchLocal.trim();
		onClose();
	}

	function toggleCard(cardId: string) {
		if (filterStore.cardIds.includes(cardId)) {
			filterStore.cardIds = filterStore.cardIds.filter((id) => id !== cardId);
		} else {
			filterStore.cardIds = [...filterStore.cardIds, cardId];
		}
	}

	function setType(t: FilterType) {
		filterStore.type = t;
	}

	function setPaymentMethod(method: FilterPayment) {
		filterStore.paymentMethod = method;
		if (method !== 'card') {
			filterStore.cardIds = [];
		}
	}

	function navigateMonth(direction: -1 | 1) {
		// Step from the 1st of the month: carrying today's day-of-month into
		// setMonth() overflows on short months (Jan 31 + 1 month = Mar 3), which
		// would skip February entirely and show the wrong month's data.
		const base =
			filterStore.selectedMonth !== null ? new Date(filterStore.selectedMonth) : new Date();
		filterStore.setSelectedMonth(
			new Date(base.getFullYear(), base.getMonth() + direction, 1).getTime()
		);
	}

	let displayedMonthLabel = $derived(
		filterStore.selectedMonth !== null
			? formatMonthTimestamp(filterStore.selectedMonth)
			: formatMonthTimestamp(Date.now())
	);

	let isMonthSelected = $derived(filterStore.selectedMonth !== null);

	const datePresets: { value: FilterDatePreset; label: string }[] = [
		{ value: 'all', label: 'All Time' },
		{ value: 'thisMonth', label: 'This Month' },
		{ value: 'lastMonth', label: 'Last Month' },
		{ value: 'thisYear', label: 'This Year' }
	];
</script>

<div
	class="fixed inset-0 z-50 flex items-end justify-center bg-black/50 sm:items-center"
	role="button"
	tabindex="0"
	onclick={onClose}
	onkeydown={(e) => e.key === 'Escape' && onClose()}
>
	<div
		class="flex max-h-[85vh] w-full max-w-lg flex-col rounded-t-2xl bg-white sm:rounded-2xl dark:bg-slate-800"
		role="dialog"
		tabindex="-1"
		aria-modal="true"
		aria-label="Filter transactions"
		onclick={(e: MouseEvent) => e.stopPropagation()}
		onkeydown={(e: KeyboardEvent) => e.stopPropagation()}
	>
		<div
			class="flex shrink-0 items-center justify-between border-b border-gray-100 px-4 py-3 dark:border-slate-700"
		>
			<h2 class="text-lg font-semibold text-gray-900 dark:text-white">Filters</h2>
			<div class="flex items-center gap-2">
				<button
					class="rounded-lg px-2.5 py-1 text-sm font-medium text-gray-500 hover:bg-gray-100 hover:text-gray-700 dark:text-slate-400 dark:hover:bg-slate-700 dark:hover:text-white"
					onclick={handleReset}
				>
					Reset
				</button>
				<button
					class="rounded-lg p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-slate-700 dark:hover:text-white"
					aria-label="Close"
					onclick={onClose}
				>
					<svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							stroke-width="2"
							d="M6 18L18 6M6 6l12 12"
						/>
					</svg>
				</button>
			</div>
		</div>

		<div class="flex-1 overflow-y-auto overscroll-contain px-4 py-4">
			<div class="mb-5">
				<p
					class="mb-2 text-xs font-semibold tracking-wide text-gray-500 uppercase dark:text-slate-400"
				>
					Type
				</p>
				<div class="flex gap-2">
					<button
						class="flex-1 rounded-lg border px-3 py-2 text-sm font-medium transition-colors {filterStore.type ===
						'all'
							? 'border-blue-500 bg-blue-50 text-blue-600 dark:border-sky-500 dark:bg-sky-900/30 dark:text-sky-400'
							: 'border-gray-200 text-gray-600 hover:bg-gray-50 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-700'}"
						onclick={() => setType('all')}
					>
						All
					</button>
					<button
						class="flex-1 rounded-lg border px-3 py-2 text-sm font-medium transition-colors {filterStore.type ===
						'expense'
							? 'border-rose-500 bg-rose-50 text-rose-600 dark:border-rose-500 dark:bg-rose-900/30 dark:text-rose-400'
							: 'border-gray-200 text-gray-600 hover:bg-gray-50 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-700'}"
						onclick={() => setType('expense')}
					>
						Expense
					</button>
					<button
						class="flex-1 rounded-lg border px-3 py-2 text-sm font-medium transition-colors {filterStore.type ===
						'income'
							? 'border-emerald-500 bg-emerald-50 text-emerald-600 dark:border-emerald-500 dark:bg-emerald-900/30 dark:text-emerald-400'
							: 'border-gray-200 text-gray-600 hover:bg-gray-50 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-700'}"
						onclick={() => setType('income')}
					>
						Income
					</button>
				</div>
			</div>

			<div class="mb-5">
				<p
					class="mb-2 text-xs font-semibold tracking-wide text-gray-500 uppercase dark:text-slate-400"
				>
					Payment Method
				</p>
				<div class="flex gap-2">
					<button
						class="flex-1 rounded-lg border px-3 py-2 text-sm font-medium transition-colors {filterStore.paymentMethod ===
						'all'
							? 'border-blue-500 bg-blue-50 text-blue-600 dark:border-sky-500 dark:bg-sky-900/30 dark:text-sky-400'
							: 'border-gray-200 text-gray-600 hover:bg-gray-50 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-700'}"
						onclick={() => setPaymentMethod('all')}
					>
						All
					</button>
					<button
						class="flex-1 rounded-lg border px-3 py-2 text-sm font-medium transition-colors {filterStore.paymentMethod ===
						'cash'
							? 'border-blue-500 bg-blue-50 text-blue-600 dark:border-sky-500 dark:bg-sky-900/30 dark:text-sky-400'
							: 'border-gray-200 text-gray-600 hover:bg-gray-50 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-700'}"
						onclick={() => setPaymentMethod('cash')}
					>
						Cash
					</button>
					<button
						class="flex-1 rounded-lg border px-3 py-2 text-sm font-medium transition-colors {filterStore.paymentMethod ===
						'card'
							? 'border-blue-500 bg-blue-50 text-blue-600 dark:border-sky-500 dark:bg-sky-900/30 dark:text-sky-400'
							: 'border-gray-200 text-gray-600 hover:bg-gray-50 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-700'}"
						onclick={() => setPaymentMethod('card')}
					>
						Card
					</button>
				</div>
			</div>

			{#if filterStore.paymentMethod === 'card' && transactionStore.cards.length > 0}
				<div class="mb-5">
					<p
						class="mb-2 text-xs font-semibold tracking-wide text-gray-500 uppercase dark:text-slate-400"
					>
						Cards
					</p>
					<div class="flex flex-wrap gap-2">
						{#each transactionStore.cards as card (card.id)}
							<button
								class="flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors {filterStore.cardIds.includes(
									card.id
								)
									? 'border-blue-600 bg-blue-50 text-blue-600 dark:border-sky-500 dark:bg-sky-900/30 dark:text-sky-400'
									: 'border-gray-200 text-gray-500 dark:border-slate-600 dark:text-slate-400'}"
								onclick={() => toggleCard(card.id)}
							>
								<span class="h-2 w-2 rounded-full" style="background-color: {card.color}"></span>
								{card.name}
							</button>
						{/each}
					</div>
				</div>
			{/if}

			<div class="mb-5">
				<p
					class="mb-2 text-xs font-semibold tracking-wide text-gray-500 uppercase dark:text-slate-400"
				>
					Date
				</p>
				<div class="mb-3 flex flex-wrap gap-2">
					{#each datePresets as preset (preset.value)}
						<button
							class="rounded-full border px-3 py-1.5 text-xs font-medium transition-colors {filterStore.datePreset ===
								preset.value && filterStore.selectedMonth === null
								? 'border-blue-600 bg-blue-50 text-blue-600 dark:border-sky-500 dark:bg-sky-900/30 dark:text-sky-400'
								: 'border-gray-200 text-gray-500 hover:bg-gray-50 dark:border-slate-600 dark:text-slate-400 dark:hover:bg-slate-700'}"
							onclick={() => filterStore.setDatePreset(preset.value)}
						>
							{preset.label}
						</button>
					{/each}
				</div>

				<p class="mb-2 text-xs font-medium text-gray-500 dark:text-slate-400">Or pick a month:</p>
				<div
					class="flex items-center justify-between rounded-lg border border-gray-200 px-3 py-2 dark:border-slate-600"
				>
					<button
						class="rounded-lg p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-slate-700 dark:hover:text-white"
						aria-label="Previous month"
						onclick={() => navigateMonth(-1)}
					>
						<svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path
								stroke-linecap="round"
								stroke-linejoin="round"
								stroke-width="2"
								d="M15 19l-7-7 7-7"
							/>
						</svg>
					</button>
					<span
						class="text-sm font-medium {isMonthSelected
							? 'text-blue-600 dark:text-sky-400'
							: 'text-gray-900 dark:text-slate-200'}"
					>
						{displayedMonthLabel}
					</span>
					<button
						class="rounded-lg p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-slate-700 dark:hover:text-white"
						aria-label="Next month"
						onclick={() => navigateMonth(1)}
					>
						<svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path
								stroke-linecap="round"
								stroke-linejoin="round"
								stroke-width="2"
								d="M9 5l7 7-7 7"
							/>
						</svg>
					</button>
				</div>
			</div>

			<div class="mb-5">
				<p
					class="mb-2 text-xs font-semibold tracking-wide text-gray-500 uppercase dark:text-slate-400"
				>
					Amount (QR)
				</p>
				<div class="flex gap-2">
					<div class="flex-1">
						<label
							class="mb-1 block text-xs text-gray-400 dark:text-slate-500"
							for="filter-amount-min">Min</label
						>
						<input
							id="filter-amount-min"
							type="number"
							step="0.01"
							min="0"
							placeholder="0.00"
							class="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-900 placeholder-gray-400 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 dark:border-slate-600 dark:bg-slate-700 dark:text-white dark:placeholder-slate-500 dark:focus:border-sky-500 dark:focus:ring-sky-500"
							bind:value={amountMinStr}
						/>
					</div>
					<div class="flex-1">
						<label
							class="mb-1 block text-xs text-gray-400 dark:text-slate-500"
							for="filter-amount-max">Max</label
						>
						<input
							id="filter-amount-max"
							type="number"
							step="0.01"
							min="0"
							placeholder="0.00"
							class="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-900 placeholder-gray-400 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 dark:border-slate-600 dark:bg-slate-700 dark:text-white dark:placeholder-slate-500 dark:focus:border-sky-500 dark:focus:ring-sky-500"
							bind:value={amountMaxStr}
						/>
					</div>
				</div>
			</div>

			<div class="mb-2">
				<p
					class="mb-2 text-xs font-semibold tracking-wide text-gray-500 uppercase dark:text-slate-400"
				>
					Note Search
				</p>
				<div class="relative">
					<svg
						class="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-gray-400 dark:text-slate-500"
						fill="none"
						stroke="currentColor"
						viewBox="0 0 24 24"
					>
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							stroke-width="2"
							d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
						/>
					</svg>
					<input
						type="text"
						placeholder="Search notes..."
						class="w-full rounded-lg border border-gray-200 bg-gray-50 py-2 pr-3 pl-9 text-sm text-gray-900 placeholder-gray-400 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 dark:border-slate-600 dark:bg-slate-700 dark:text-white dark:placeholder-slate-500 dark:focus:border-sky-500 dark:focus:ring-sky-500"
						bind:value={noteSearchLocal}
					/>
				</div>
			</div>
		</div>

		<div class="shrink-0 border-t border-gray-100 px-4 py-3 dark:border-slate-700">
			<button
				class="w-full rounded-lg bg-blue-600 py-2.5 text-sm font-semibold text-white transition-colors active:bg-blue-700 dark:bg-sky-600 dark:active:bg-sky-700"
				onclick={handleApply}
			>
				Apply Filters
			</button>
		</div>
	</div>
</div>
