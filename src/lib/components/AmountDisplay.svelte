<script lang="ts">
	import { CURRENCY_SYMBOL, formatCurrencyInput } from '$lib/utils/currency';

	interface Props {
		amount: string;
	}

	let { amount }: Props = $props();

	const displayParts = $derived(formatCurrencyInput(amount));
</script>

<div class="flex items-baseline justify-center">
	<span class="mr-2 text-2xl font-semibold text-muted-foreground">{CURRENCY_SYMBOL}</span>
	<span
		class="font-mono text-[clamp(2.5rem,13vw,4.75rem)] leading-none font-bold tracking-tight text-foreground"
		>{displayParts.integerPart}</span
	><span
		class="font-mono text-[clamp(1.5rem,7vw,2.5rem)] leading-none font-bold {displayParts.dotActive
			? 'text-foreground'
			: 'text-muted-foreground'}">.</span
	><span
		class="font-mono text-[clamp(1.5rem,7vw,2.5rem)] leading-none font-bold {displayParts.decimalDigitsEntered >=
		1
			? 'text-foreground'
			: 'text-muted-foreground'}">{displayParts.dec1}</span
	><span
		class="font-mono text-[clamp(1.5rem,7vw,2.5rem)] leading-none font-bold {displayParts.decimalDigitsEntered >=
		2
			? 'text-foreground'
			: 'text-muted-foreground'}">{displayParts.dec2}</span
	>
</div>
