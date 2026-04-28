<script lang="ts">
	import { transactionStore } from '$lib/stores.svelte';
	import { CURRENCY_SYMBOL, formatCurrency } from '$lib/utils/currency';
	import { onMount, tick } from 'svelte';

	let listContainer: HTMLDivElement;
	let shouldAutoScroll = $state(true);

	function formatDate(timestamp: number): string {
		const date = new Date(timestamp);
		const now = new Date();
		const isToday = date.toDateString() === now.toDateString();
		if (isToday) {
			return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
		}
		return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
	}

	function groupByDate(transactions: typeof transactionStore.transactions) {
		const reversed = [...transactions].reverse();
		const groups: { date: string; items: typeof transactions }[] = [];
		let currentGroup: { date: string; items: typeof transactions } | null = null;

		for (const tx of reversed) {
			const dateStr = new Date(tx.createdAt).toDateString();
			if (!currentGroup || currentGroup.date !== dateStr) {
				currentGroup = { date: dateStr, items: [] };
				groups.push(currentGroup);
			}
			currentGroup.items.push(tx);
		}

		return groups;
	}

	async function scrollToBottom() {
		if (!shouldAutoScroll || !listContainer) return;
		await tick();
		listContainer.scrollTop = listContainer.scrollHeight;
	}

	$effect(() => {
		if (transactionStore.transactions.length > 0) {
			scrollToBottom();
		}
	});

	function handleScroll() {
		if (!listContainer) return;
		const { scrollTop, scrollHeight, clientHeight } = listContainer;
		const isNearBottom = scrollHeight - scrollTop - clientHeight < 50;
		shouldAutoScroll = isNearBottom;

		if (scrollTop < 50 && transactionStore.hasMore && !transactionStore.loading) {
			transactionStore.loadMore();
		}
	}

	onMount(() => {
		scrollToBottom();
	});

	const grouped = $derived(groupByDate(transactionStore.transactions));
</script>

<div
	bind:this={listContainer}
	onscroll={handleScroll}
	class="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-2"
>
	{#if transactionStore.transactions.length === 0}
		<div class="flex h-full flex-col items-center justify-center text-slate-500">
			<p class="text-sm">No transactions yet</p>
			<p class="mt-1 text-xs">Add your first expense below</p>
		</div>
	{:else}
		{#if transactionStore.loading && transactionStore.hasMore}
			<div class="py-2 text-center text-xs text-slate-500">Loading...</div>
		{/if}

		{#each grouped as group}
			<div class="mb-4">
				<div class="sticky top-0 z-10 mb-2 flex justify-center">
					<span class="rounded-full bg-slate-800 px-3 py-0.5 text-xs font-medium text-slate-400">
						{new Date(group.date).toLocaleDateString([], {
							weekday: 'short',
							month: 'short',
							day: 'numeric'
						})}
					</span>
				</div>

				<div class="flex flex-col gap-2">
					{#each group.items as tx (tx.id)}
						<div
							class="flex items-center gap-3 rounded-2xl px-4 py-3 {tx.type === 'income'
								? 'bg-emerald-950/40'
								: 'bg-slate-800/60'}"
						>
							<div class="flex-1 min-w-0">
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
						</div>
					{/each}
				</div>
			</div>
		{/each}
	{/if}
</div>
