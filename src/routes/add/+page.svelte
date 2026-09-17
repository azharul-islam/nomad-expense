<script lang="ts">
	import { browser } from '$app/environment';
	import { goto } from '$app/navigation';
	import { onDestroy, onMount } from 'svelte';
	import { transactionStore } from '$lib/stores.svelte';
	import { loansStore } from '$lib/loans.svelte';
	import { entryDraft, type EntryKind } from '$lib/entry-draft.svelte';
	import AmountDisplay from '$lib/components/AmountDisplay.svelte';
	import SegmentedControl from '$lib/components/SegmentedControl.svelte';
	import type { Person } from '$lib/db';
	import {
		CURRENCY,
		CURRENCY_SYMBOL,
		formatCurrency,
		parseAmountToCents,
		splitCurrency
	} from '$lib/utils/currency';

	const amount = entryDraft.amount;
	const cents = $derived(parseAmountToCents(amount));
	const amountParts = $derived(splitCurrency(formatCurrency(cents)));

	let kind = $state<EntryKind>(entryDraft.kind);
	let paymentMethod = $state<'cash' | 'card'>(entryDraft.paymentMethod ?? 'cash');
	let cardId = $state<string | null>(entryDraft.cardId);
	let personId = $state<string | null>(entryDraft.personId);
	let personName = $state('');
	let newPersonMode = $state(false);
	let note = $state(entryDraft.note);
	let dueDate = $state(entryDraft.dueDate);
	let submitting = $state(false);
	let errorMessage = $state('');

	let backButton: HTMLButtonElement;
	let previouslyFocused: HTMLElement | null = null;

	const isLoan = $derived(kind === 'lent' || kind === 'borrowed');

	onMount(() => {
		previouslyFocused =
			document.activeElement instanceof HTMLElement ? document.activeElement : null;
		// An empty amount is a soft dead end here — send the user to the keypad.
		if (cents <= 0) {
			goto('/');
			return;
		}
		backButton?.focus();
	});

	// Pre-select a person when this wizard was opened from a person's screen,
	// but only once the loans store has loaded (avoids a cold-load race).
	let preselected = $state(false);
	$effect(() => {
		if (preselected || !loansStore.initialized) return;
		if (entryDraft.personId && loansStore.people.some((p) => p.id === entryDraft.personId)) {
			personId = entryDraft.personId;
		} else {
			personId = null;
		}
		preselected = true;
	});

	onDestroy(() => {
		previouslyFocused?.focus?.();
	});

	// Keep every choice in the draft so back-and-forth (and reloads) lose nothing.
	$effect(() => {
		entryDraft.update({
			kind,
			paymentMethod,
			cardId: paymentMethod === 'card' ? cardId : null,
			personId,
			personName,
			note,
			dueDate
		});
	});

	function goBack() {
		goto('/');
	}

	const kinds: {
		value: EntryKind;
		label: string;
		caption: string;
		accent: string;
		icon: 'expense' | 'income' | 'lent' | 'borrowed';
	}[] = [
		{
			value: 'expense',
			label: 'Expense',
			caption: 'Spent money',
			accent: 'border-destructive bg-destructive/10 text-destructive',
			icon: 'expense'
		},
		{
			value: 'income',
			label: 'Income',
			caption: 'Received',
			accent: 'border-success bg-success/10 text-success',
			icon: 'income'
		},
		{
			value: 'lent',
			label: 'Lent',
			caption: 'Gave a loan',
			accent: 'border-primary bg-primary/10 text-primary',
			icon: 'lent'
		},
		{
			value: 'borrowed',
			label: 'Borrowed',
			caption: 'Took a loan',
			accent: 'border-amber-500 bg-amber-500/10 text-amber-500 dark:text-amber-400',
			icon: 'borrowed'
		}
	];

	const recentPeople = $derived(
		[...loansStore.peopleWithBalance].sort(
			(a, b) => b.lastActivity - a.lastActivity || a.name.localeCompare(b.name)
		)
	);

	const nameMatch = $derived(
		personName.trim() ? loansStore.findPersonByName(personName) : undefined
	);

	function pickExisting(person: Person) {
		personId = person.id;
		newPersonMode = false;
		personName = '';
	}

	function startNewPerson() {
		personId = null;
		newPersonMode = true;
	}

	function selectMethod(m: string) {
		paymentMethod = m as 'cash' | 'card';
		if (m === 'card' && !cardId && transactionStore.cards.length > 0) {
			cardId = transactionStore.cards[0].id;
		}
	}

	const canConfirm = $derived(
		cents > 0 && (isLoan ? personId !== null || (newPersonMode && personName.trim() !== '') : true)
	);

	async function handleConfirm() {
		if (!canConfirm || submitting) return;
		submitting = true;
		errorMessage = '';
		try {
			if (kind === 'lent' || kind === 'borrowed') {
				let person: Person;
				if (personId) {
					const existing = loansStore.people.find((p) => p.id === personId);
					if (!existing) throw new Error('Please choose a person');
					person = existing;
				} else {
					({ person } = await loansStore.ensurePerson(personName));
				}
				const dueTs = dueDate ? new Date(dueDate + 'T23:59:59').getTime() : null;
				await loansStore.addLoan({
					personId: person.id,
					direction: kind as 'lent' | 'borrowed',
					amount: cents,
					currency: CURRENCY,
					note,
					dueDate: dueTs
				});
				entryDraft.reset();
				goto('/loans/' + person.id);
			} else {
				await transactionStore.add({
					amount: cents,
					currency: CURRENCY,
					type: kind as 'income' | 'expense',
					paymentMethod,
					cardId: paymentMethod === 'card' ? cardId : null,
					note
				});
				entryDraft.reset();
				entryDraft.markJustAdded();
				goto('/');
			}
		} catch (err) {
			errorMessage = err instanceof Error ? err.message : 'Failed to save';
			console.error('Save failed:', err);
		} finally {
			submitting = false;
		}
	}

	const heading = $derived(
		kind === 'expense'
			? 'Add Expense'
			: kind === 'income'
				? 'Add Income'
				: kind === 'lent'
					? 'Add Loan'
					: 'Add Borrow'
	);
	const confirmLabel = $derived(
		kind === 'lent' ? 'Add Loan' : kind === 'borrowed' ? 'Add Borrow' : heading
	);

	const focusableSelector =
		'button:not([disabled]), input, textarea, [href], [tabindex]:not([tabindex="-1"])';

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Escape') {
			goBack();
			return;
		}
		if (e.key !== 'Tab') return;
		const focusables = Array.from(document.querySelectorAll<HTMLElement>(focusableSelector)).filter(
			(el) => el.offsetParent !== null
		);
		if (focusables.length === 0) return;
		const first = focusables[0];
		const last = focusables[focusables.length - 1];
		const active = document.activeElement;
		if (e.shiftKey && (active === first || (active && !document.body.contains(active)))) {
			e.preventDefault();
			last.focus();
		} else if (!e.shiftKey && active === last) {
			e.preventDefault();
			first.focus();
		}
	}
</script>

{#snippet expenseIcon()}
	<svg class="h-6 w-6 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
		<path
			stroke-linecap="round"
			stroke-linejoin="round"
			stroke-width="2"
			d="M12 19V5m0 0l-4 4m4-4l4 4"
		/>
	</svg>
{/snippet}
{#snippet incomeIcon()}
	<svg class="h-6 w-6 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
		<path
			stroke-linecap="round"
			stroke-linejoin="round"
			stroke-width="2"
			d="M12 5v14m0 0l-4-4m4 4l4-4"
		/>
	</svg>
{/snippet}
{#snippet lentIcon()}
	<svg class="h-6 w-6 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
		<path
			stroke-linecap="round"
			stroke-linejoin="round"
			stroke-width="2"
			d="M6 18L18 6M18 6l-4.2 1.5M18 6l-1.5 4.2"
		/>
	</svg>
{/snippet}
{#snippet borrowedIcon()}
	<svg class="h-6 w-6 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
		<path
			stroke-linecap="round"
			stroke-linejoin="round"
			stroke-width="2"
			d="M18 6L6 18M6 18l4.2-1.5M6 18l1.5-4.2"
		/>
	</svg>
{/snippet}

<svelte:window onkeydown={handleKeydown} />

<div class="flex h-full flex-col overflow-hidden bg-background">
	<!-- Top: heading + the dialed amount (no buttons) -->
	<header class="flex shrink-0 flex-col items-center gap-1 border-b border-border px-6 py-4">
		<h1 class="text-xs font-semibold tracking-widest text-muted-foreground uppercase">{heading}</h1>
		<AmountDisplay {amount} />
	</header>

	<!-- Details (silent scroll fallback only on very short screens) -->
	<div
		class="hide-scrollbar flex min-h-0 flex-1 flex-col gap-5 overflow-x-hidden overflow-y-auto overscroll-contain px-5 py-4"
	>
		<section>
			<div class="grid grid-cols-2 gap-3">
				{#each kinds as k (k.value)}
					<button
						class="flex h-[4.5rem] flex-col items-center justify-center gap-1 rounded-2xl border-2 transition-colors {kind ===
						k.value
							? k.accent + ' border-current'
							: 'border-input bg-card text-muted-foreground active:bg-accent'}"
						onclick={() => (kind = k.value)}
						aria-pressed={kind === k.value}
					>
						{#if k.icon === 'expense'}
							{@render expenseIcon()}
						{:else if k.icon === 'income'}
							{@render incomeIcon()}
						{:else if k.icon === 'lent'}
							{@render lentIcon()}
						{:else}
							{@render borrowedIcon()}
						{/if}
						<span class="text-[15px] font-semibold">{k.label}</span>
					</button>
				{/each}
			</div>
		</section>

		<!-- 2a. Expense/Income: payment details -->
		{#if !isLoan}
			<section>
				<h2 class="mb-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
					Payment method
				</h2>
				<SegmentedControl
					options={[
						{ value: 'cash', label: 'Cash', icon: cashIcon },
						{ value: 'card', label: 'Card', icon: cardIcon }
					]}
					value={paymentMethod}
					onChange={selectMethod}
				/>
			</section>

			{#if transactionStore.cards.length > 0}
				<section
					class="transition-opacity duration-200 {paymentMethod !== 'card' ? 'opacity-40' : ''}"
				>
					<h2 class="mb-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
						Card
					</h2>
					<div class="grid grid-cols-3 gap-2.5">
						{#each transactionStore.cards as card (card.id)}
							<button
								class="flex flex-col items-center justify-center gap-2 rounded-2xl border-2 py-3.5 transition-colors {cardId ===
								card.id
									? 'border-primary bg-primary/10'
									: 'border-input bg-card'}"
								disabled={paymentMethod !== 'card'}
								onclick={() => (cardId = card.id)}
								aria-pressed={cardId === card.id}
							>
								<span class="h-3.5 w-3.5 rounded-full" style="background-color:{card.color}"></span>
								<span
									class="text-sm font-semibold {cardId === card.id
										? 'text-primary'
										: 'text-foreground'}"
								>
									{card.name}
								</span>
							</button>
						{/each}
					</div>
				</section>
			{/if}
		{/if}

		<!-- 2b. Loans: who + due date -->
		{#if isLoan}
			<section>
				<h2 class="mb-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
					Who
				</h2>
				{#if !newPersonMode}
					<div class="flex flex-wrap gap-2">
						{#each recentPeople as person (person.id)}
							<button
								class="flex h-11 items-center gap-1.5 rounded-full border-2 px-3.5 text-sm font-semibold transition-colors {personId ===
								person.id
									? 'border-primary bg-primary/10 text-primary'
									: 'border-input bg-card text-foreground active:bg-accent'}"
								onclick={() => pickExisting(person)}
								aria-pressed={personId === person.id}
							>
								<span class="h-3 w-3 shrink-0 rounded-full" style="background-color:{person.color}"
								></span>
								{person.name}
							</button>
						{/each}
						<button
							class="flex h-11 items-center gap-1.5 rounded-full border-2 border-dashed border-input px-3.5 text-sm font-semibold text-muted-foreground transition-colors active:bg-accent"
							onclick={startNewPerson}
						>
							<svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path
									stroke-linecap="round"
									stroke-linejoin="round"
									stroke-width="2"
									d="M12 4v16m8-8H4"
								/>
							</svg>
							New person
						</button>
					</div>
				{:else}
					<div>
						<input
							type="text"
							placeholder="Name (e.g. Ali)"
							class="w-full rounded-2xl border-2 border-input bg-card px-4 py-3.5 text-lg text-foreground placeholder:text-muted-foreground focus:border-ring focus:outline-none"
							bind:value={personName}
						/>
						{#if nameMatch}
							<button
								class="mt-2 flex w-full items-center gap-2 rounded-xl border border-primary/40 bg-primary/10 px-3 py-2 text-left text-sm font-medium text-primary transition-colors active:bg-primary/20"
								onclick={() => pickExisting(nameMatch)}
							>
								<span class="h-3 w-3 rounded-full" style="background-color:{nameMatch.color}"
								></span>
								"{nameMatch.name}" already exists — use them
							</button>
						{/if}
						<button
							class="mt-2 text-sm font-medium text-muted-foreground underline-offset-2 hover:underline"
							onclick={() => {
								newPersonMode = false;
								personName = '';
							}}
						>
							Back to list
						</button>
					</div>
				{/if}
			</section>

			<section>
				<h2 class="mb-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
					Due date (optional)
				</h2>
				<input
					type="date"
					class="w-full max-w-full min-w-0 rounded-2xl border-2 border-input bg-card px-4 py-3 text-base text-foreground focus:border-ring focus:outline-none [&::-webkit-date-and-time-value]:block [&::-webkit-date-and-time-value]:w-full [&::-webkit-date-and-time-value]:min-w-0 [&::-webkit-date-and-time-value]:text-left"
					bind:value={dueDate}
				/>
			</section>
		{/if}

		<!-- Note -->
		<section>
			<h2 class="mb-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase">Note</h2>
			<textarea
				class="hide-scrollbar w-full resize-none rounded-2xl border-2 border-input bg-card px-4 py-3 text-base text-foreground placeholder:text-muted-foreground focus:border-ring focus:outline-none"
				placeholder="Add a note (optional)"
				bind:value={note}
				rows={3}
			></textarea>
		</section>

		{#if errorMessage}
			<div class="rounded-xl bg-destructive/10 px-3.5 py-2.5 text-sm font-medium text-destructive">
				{errorMessage}
			</div>
		{/if}
	</div>

	<!-- Back + Confirm -->
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
				{:else if cents <= 0}
					Enter an amount first
				{:else}
					{confirmLabel}
					<span class="font-mono text-base font-semibold opacity-90">
						{CURRENCY_SYMBOL}
						{amountParts[0]}<span class="text-sm">.{amountParts[1]}</span>
					</span>
				{/if}
			</button>
		</div>
	</footer>
</div>

{#snippet cashIcon()}
	<svg class="h-5 w-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
		<path
			stroke-linecap="round"
			stroke-linejoin="round"
			stroke-width="2"
			d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z"
		/>
	</svg>
{/snippet}

{#snippet cardIcon()}
	<svg class="h-5 w-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
		<path
			stroke-linecap="round"
			stroke-linejoin="round"
			stroke-width="2"
			d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z"
		/>
	</svg>
{/snippet}
