<script lang="ts">
	import { transactionStore } from '$lib/stores.svelte';
	import { CURRENCY_SYMBOL, formatCurrency } from '$lib/utils/currency';
	import TransactionListItem from '$lib/components/TransactionListItem.svelte';
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
	{#if !transactionStore.initialized}
		<div class="flex h-full flex-col items-center justify-center text-gray-400 dark:text-slate-500">
			<p class="text-sm">Loading transactions...</p>
		</div>
	{:else if transactionStore.transactions.length === 0}
		<div class="flex h-full flex-col items-center justify-center text-gray-400 dark:text-slate-500">
			<p class="text-sm">No transactions yet</p>
			<p class="mt-1 text-xs">Add your first expense below</p>
		</div>
	{:else}
		{#if transactionStore.loading && transactionStore.hasMore}
			<div class="py-2 text-center text-xs text-gray-400 dark:text-slate-500">Loading...</div>
		{/if}

		{#each grouped as group}
			<div class="mb-4">
				<div class="sticky top-0 z-10 mb-2 flex justify-center">
					<span class="rounded-full bg-white px-3 py-0.5 text-xs font-medium text-gray-500 shadow-sm dark:bg-slate-800 dark:text-slate-400">
						{new Date(group.date).toLocaleDateString([], {
							weekday: 'short',
							month: 'short',
							day: 'numeric'
						})}
					</span>
				</div>

				<div class="flex flex-col gap-2">
					{#each group.items as tx (tx.id)}
						<TransactionListItem
							transaction={tx}
							formatDate={formatDate}
							class={tx.type === 'income'
								? 'bg-emerald-50 dark:bg-emerald-950/40'
								: 'bg-white/80 shadow-sm dark:bg-slate-800/60'}
						/>
					{/each}
				</div>
			</div>
		{/each}
	{/if}
</div>
