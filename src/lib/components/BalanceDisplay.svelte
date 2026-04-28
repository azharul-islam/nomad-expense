<script lang="ts">
	import { transactionStore } from '$lib/stores.svelte';
	import { CURRENCY_SYMBOL, formatCurrency } from '$lib/utils/currency';

	const isPositive = $derived(transactionStore.balance >= 0);
</script>

<div class="flex shrink-0 flex-col items-center justify-center py-6">
	<p class="text-sm font-medium tracking-wide text-slate-400 uppercase">Current Balance</p>
	<div class="mt-2 flex items-baseline gap-1.5">
		<span class="text-lg font-semibold text-slate-500">{CURRENCY_SYMBOL}</span>
		<span class="text-5xl font-bold tracking-tight {isPositive ? 'text-white' : 'text-rose-400'}">
			{formatCurrency(transactionStore.balance)}
		</span>
	</div>
</div>
