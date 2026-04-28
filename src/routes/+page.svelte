<script lang="ts">
	import BalanceDisplay from '$lib/components/BalanceDisplay.svelte';
	import TransactionList from '$lib/components/TransactionList.svelte';
	import CalculatorKeypad from '$lib/components/CalculatorKeypad.svelte';
</script>

<div class="flex h-full flex-col">
	<BalanceDisplay />
	<TransactionList />
	<CalculatorKeypad />
</div>
