<script lang="ts">
	import { transactionStore } from '$lib/stores.svelte';
	import { CURRENCY_SYMBOL, formatCurrency, splitCurrency } from '$lib/utils/currency';

	const incomeParts = $derived(splitCurrency(formatCurrency(transactionStore.incomeTotal)));
	const expenseParts = $derived(splitCurrency(formatCurrency(transactionStore.expenseTotal)));
	const netParts = $derived(splitCurrency(formatCurrency(transactionStore.netBalance)));
	const netPositive = $derived(transactionStore.netBalance >= 0);
</script>

<div class="shrink-0 px-4 pt-3 pb-1">
	<div class="grid grid-cols-2 gap-3">
		<div class="rounded-2xl bg-success/10 px-4 py-3">
			<p class="text-xs font-semibold tracking-wide text-success uppercase">Income</p>
			<p data-testid="income-balance" class="mt-1 font-mono text-lg font-bold text-success">
				{CURRENCY_SYMBOL}{incomeParts[0]}<span class="text-sm">.{incomeParts[1]}</span>
			</p>
		</div>
		<div class="rounded-2xl bg-destructive/10 px-4 py-3">
			<p class="text-xs font-semibold tracking-wide text-destructive uppercase">Expense</p>
			<p data-testid="expense-balance" class="mt-1 font-mono text-lg font-bold text-destructive">
				{CURRENCY_SYMBOL}{expenseParts[0]}<span class="text-sm">.{expenseParts[1]}</span>
			</p>
		</div>
	</div>
	<div class="mt-1.5 flex items-center justify-center gap-1.5">
		<span class="text-xs font-semibold tracking-wider text-muted-foreground uppercase">Net</span>
		<span
			data-testid="tracker-net-balance"
			class="font-mono text-base font-bold {netPositive ? 'text-foreground' : 'text-destructive'}"
		>
			{CURRENCY_SYMBOL}
			{netParts[0]}<span class="text-sm text-muted-foreground">.{netParts[1]}</span>
		</span>
	</div>
</div>
