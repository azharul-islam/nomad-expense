<script lang="ts">
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';
	import { onMount } from 'svelte';
	import AmountDisplay from '$lib/components/AmountDisplay.svelte';
	import Keypad from '$lib/components/Keypad.svelte';
	import { loansStore } from '$lib/loans.svelte';
	import { parseAmountToCents } from '$lib/utils/currency';

	const personId = $derived($page.params.id);
	const loanId = $derived($page.url.searchParams.get('loan') ?? '');
	const loan = $derived(loansStore.loans.find((l) => l.id === loanId));

	// Prefill with the full outstanding amount so a quick confirm settles it.
	let amount = $state('');
	let note = $state('');
	let submitting = $state(false);
	let errorMessage = $state('');
	let backButton: HTMLButtonElement;

	onMount(() => {
		backButton?.focus();
	});

	const outstanding = $derived(loan ? loansStore.outstandingForLoan(loan.id) : 0);

	function fillFullAmount() {
		if (outstanding > 0) amount = String(outstanding / 100);
	}

	const cents = $derived(parseAmountToCents(amount));
	const canConfirm = $derived(cents > 0 && !!loan);

	function goBack() {
		goto('/loans/' + personId);
	}

	async function handleConfirm() {
		if (!loan || !canConfirm || submitting) return;
		submitting = true;
		errorMessage = '';
		try {
			await loansStore.addPayment(loan.id, cents, note, true);
			goto('/loans/' + personId);
		} catch (err) {
			errorMessage = err instanceof Error ? err.message : 'Failed to record payment';
		} finally {
			submitting = false;
		}
	}
</script>

<div class="flex h-full flex-col overflow-hidden bg-background">
	<header class="shrink-0 px-5 pt-4 pb-2">
		<h1
			class="mb-1 text-center text-xs font-semibold tracking-widest text-muted-foreground uppercase"
		>
			Payment{loan ? ' · ' + (loan.direction === 'lent' ? 'being repaid' : 'you repay') : ''}
		</h1>
		<AmountDisplay {amount} />
	</header>

	<div class="hide-scrollbar min-h-0 flex-1 overflow-y-auto px-5 py-3">
		{#if loan}
			<p class="text-center text-sm text-muted-foreground">
				{loan.direction === 'lent' ? 'They repay you' : 'You repay'} —
				<span class="font-mono font-semibold text-foreground">{outstanding / 100}</span>
				left on this loan
			</p>
			{#if outstanding > 0 && amount !== String(outstanding / 100)}
				<button
					class="mx-auto mt-3 flex items-center gap-1.5 rounded-full border-2 border-primary/40 bg-primary/10 px-4 py-2 text-sm font-semibold text-primary transition-colors active:bg-primary/20"
					onclick={fillFullAmount}
				>
					Settle with the full amount
				</button>
			{/if}
		{/if}
		<textarea
			class="hide-scrollbar mt-4 w-full resize-none rounded-2xl border-2 border-input bg-card px-4 py-3 text-base text-foreground placeholder:text-muted-foreground focus:border-ring focus:outline-none"
			placeholder="Note (optional)"
			bind:value={note}
			rows={3}
		></textarea>
		{#if errorMessage}
			<div
				class="mt-3 rounded-xl bg-destructive/10 px-3.5 py-2.5 text-sm font-medium text-destructive"
			>
				{errorMessage}
			</div>
		{/if}
	</div>

	<Keypad bind:value={amount} />

	<footer
		class="shrink-0 border-t border-border px-5 pt-3"
		style="padding-bottom: max(env(safe-area-inset-bottom), 0.75rem)"
	>
		<div class="flex items-center gap-3">
			<button
				bind:this={backButton}
				class="flex h-16 w-16 shrink-0 items-center justify-center rounded-full border-2 border-border bg-card text-foreground transition-colors active:bg-accent"
				onclick={goBack}
				aria-label="Back"
			>
				<svg class="h-7 w-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path
						stroke-linecap="round"
						stroke-linejoin="round"
						stroke-width="2"
						d="M15 19l-7-7 7-7"
					/>
				</svg>
			</button>
			<button
				class="flex h-16 min-w-0 flex-1 items-center justify-center gap-2 rounded-full bg-primary text-lg font-bold text-primary-foreground transition-all active:scale-[0.99] disabled:opacity-50"
				onclick={handleConfirm}
				disabled={!canConfirm || submitting}
			>
				{#if submitting}
					<span
						class="h-5 w-5 animate-spin rounded-full border-2 border-current border-t-transparent"
					></span>
					Saving...
				{:else}
					Record payment
				{/if}
			</button>
		</div>
	</footer>
</div>
