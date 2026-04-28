<script lang="ts">
	import { transactionStore } from '$lib/stores.svelte';
	import { CURRENCY_SYMBOL, formatCurrency, splitCurrency } from '$lib/utils/currency';

	const isPositive = $derived(transactionStore.balance >= 0);
	const balanceParts = $derived(splitCurrency(formatCurrency(transactionStore.balance)));
</script>

<div class="flex shrink-0 flex-col items-center justify-center pt-2 pb-4">
	<div class="mt-2 flex items-baseline gap-1.5 ">
		<span class="text-lg font-semibold text-gray-400 dark:text-slate-500">{CURRENCY_SYMBOL}</span>
		<span class="font-mono text-5xl font-bold tracking-tight {isPositive ? 'text-gray-900 dark:text-white' : 'text-rose-600 dark:text-rose-400'}" 
		>
			{balanceParts[0]}<span class="text-3xl">.{balanceParts[1]}</span>
		</span>
	</div>
</div>
