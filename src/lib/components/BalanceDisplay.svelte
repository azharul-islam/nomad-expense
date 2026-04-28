<script lang="ts">
	import { transactionStore } from '$lib/stores.svelte';

	function formatAmount(cents: number): string {
		const isNegative = cents < 0;
		const absCents = Math.abs(cents);
		const dollars = Math.floor(absCents / 100);
		const remainingCents = absCents % 100;
		const formatted = `${dollars.toLocaleString()}.${remainingCents.toString().padStart(2, '0')}`;
		return isNegative ? `-${formatted}` : formatted;
	}

	const isPositive = $derived(transactionStore.balance >= 0);
</script>

<div class="flex shrink-0 flex-col items-center justify-center py-6">
	<p class="text-sm font-medium tracking-wide text-slate-400 uppercase">Current Balance</p>
	<div class="mt-2 flex items-baseline gap-1">
		<span class="text-2xl font-semibold {isPositive ? 'text-emerald-400' : 'text-rose-400'}">$</span
		>
		<span class="text-5xl font-bold tracking-tight {isPositive ? 'text-white' : 'text-rose-400'}">
			{formatAmount(transactionStore.balance)}
		</span>
	</div>
</div>
