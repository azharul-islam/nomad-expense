<script lang="ts">
	import { fly } from 'svelte/transition';
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';
	import BalanceDisplay from '$lib/components/BalanceDisplay.svelte';
	import AmountDisplay from '$lib/components/AmountDisplay.svelte';
	import Keypad from '$lib/components/Keypad.svelte';
	import { entryDraft, type EntryKind } from '$lib/entry-draft.svelte';
	import { parseAmountToCents } from '$lib/utils/currency';

	let amount = $state(entryDraft.amount);
	let kind = $state<EntryKind>(entryDraft.kind);

	// Keep the draft in sync so it round-trips to /add and back (even after reloads).
	$effect(() => {
		entryDraft.update({ amount, kind });
	});

	// Loans screens deep-link here with ?kind=lent&person=<id>.
	$effect(() => {
		const search = $page.url.search;
		if (!search) return;
		const params = new URLSearchParams(search);
		const k = params.get('kind');
		if (k === 'expense' || k === 'income' || k === 'lent' || k === 'borrowed') kind = k;
		const person = params.get('person');
		if (person) entryDraft.update({ personId: person });
	});

	const justAdded = $derived(entryDraft.justAdded);
	const cents = $derived(parseAmountToCents(amount));
	const canContinue = $derived(cents > 0);

	const isLoanKind = $derived(kind === 'lent' || kind === 'borrowed');

	function openWizard() {
		if (!canContinue) return;
		goto('/add');
	}
</script>

<div class="flex h-full flex-col overflow-hidden">
	<BalanceDisplay />

	<div class="flex min-h-0 flex-1 flex-col items-center justify-center px-6">
		<div class="flex flex-col items-center">
			<AmountDisplay {amount} />
		</div>

		<p class="mt-4 text-sm text-muted-foreground">
			{canContinue
				? isLoanKind
					? 'Tap Continue to choose who'
					: 'Tap Continue to choose details'
				: 'Enter an amount to get started'}
		</p>
	</div>

	<Keypad bind:value={amount} onEnter={openWizard} />

	<button
		class="mx-4 mt-3 mb-3 flex h-16 shrink-0 items-center justify-center gap-2 rounded-full bg-primary text-lg font-bold text-primary-foreground transition-all active:scale-[0.98] disabled:opacity-40"
		onclick={openWizard}
		disabled={!canContinue}
	>
		Continue
		<svg class="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
			<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
		</svg>
	</button>
</div>

{#if justAdded}
	<div
		class="fixed left-1/2 z-50 flex -translate-x-1/2 items-center gap-1.5 rounded-full bg-success px-4 py-2 text-sm font-semibold text-success-foreground shadow-lg"
		style="top: calc(env(safe-area-inset-top) + 4.25rem)"
		transition:fly={{ y: -12, duration: 200 }}
		role="status"
	>
		<svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
			<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M5 13l4 4L19 7" />
		</svg>
		Added
	</div>
{/if}
