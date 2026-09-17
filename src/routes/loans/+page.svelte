<script lang="ts">
	import { goto } from '$app/navigation';
	import { loansStore } from '$lib/loans.svelte';
	import { overduePersonIds } from '$lib/utils/loans';
	import { CURRENCY_SYMBOL, formatCurrency, splitCurrency } from '$lib/utils/currency';

	type Filter = 'all' | 'owed' | 'owing' | 'overdue';
	let filter = $state<Filter>('all');
	let query = $state('');

	const lentParts = $derived(splitCurrency(formatCurrency(loansStore.lentOutstanding)));
	const borrowedParts = $derived(splitCurrency(formatCurrency(loansStore.borrowedOutstanding)));
	// Gross sides are never netted, so show both plus a derived net lending position.
	const netLending = $derived(loansStore.lentOutstanding - loansStore.borrowedOutstanding);
	const netLendingParts = $derived(splitCurrency(formatCurrency(Math.abs(netLending))));

	const overdue = $derived.by(() => {
		const out = new Map<string, number>();
		for (const loan of loansStore.loans) out.set(loan.id, loansStore.outstandingForLoan(loan.id));
		return overduePersonIds(loansStore.loans, out);
	});

	const filtered = $derived.by(() => {
		const q = query.trim().toLowerCase();
		return loansStore.peopleWithBalance.filter((person) => {
			if (q && !person.name.toLowerCase().includes(q)) return false;
			if (filter === 'owed' && person.balance <= 0) return false;
			if (filter === 'owing' && person.balance >= 0) return false;
			if (filter === 'overdue' && !overdue.has(person.id)) return false;
			return true;
		});
	});

	const filterChips: { value: Filter; label: string; count?: number }[] = [
		{ value: 'all', label: 'All' },
		{ value: 'owed', label: 'They owe me' },
		{ value: 'owing', label: 'I owe' },
		{ value: 'overdue', label: 'Overdue' }
	];

	function signed(cents: number): string {
		const abs = formatCurrency(Math.abs(cents));
		if (cents > 0) return '+' + abs;
		if (cents < 0) return '-' + abs;
		return abs;
	}
</script>

<div class="flex h-full flex-col overflow-hidden bg-background">
	<!-- Header: title + summary -->
	<header class="shrink-0 border-b border-border px-5 pt-4 pb-3">
		<h1 class="text-2xl font-bold text-foreground">Loans</h1>

		<div class="mt-3 grid grid-cols-2 gap-3">
			<div class="rounded-2xl bg-success/10 px-4 py-3">
				<p class="text-xs font-semibold tracking-wide text-success uppercase">Lent</p>
				<p data-testid="lent-balance" class="mt-1 font-mono text-lg font-bold text-success">
					{CURRENCY_SYMBOL}
					{lentParts[0]}<span class="text-sm">.{lentParts[1]}</span>
				</p>
			</div>
			<div class="rounded-2xl bg-destructive/10 px-4 py-3">
				<p class="text-xs font-semibold tracking-wide text-destructive uppercase">Borrowed</p>
				<p data-testid="borrowed-balance" class="mt-1 font-mono text-lg font-bold text-destructive">
					{CURRENCY_SYMBOL}
					{borrowedParts[0]}<span class="text-sm">.{borrowedParts[1]}</span>
				</p>
			</div>
		</div>
		<div class="mt-1.5 flex items-center justify-center gap-1.5" data-testid="net-lending">
			<span class="text-xs font-semibold tracking-wider text-muted-foreground uppercase"
				>Net lending</span
			>
			<span
				class="font-mono text-base font-bold {netLending > 0
					? 'text-success'
					: netLending < 0
						? 'text-destructive'
						: 'text-muted-foreground'}"
			>
				{netLending < 0 ? '−' : ''}{CURRENCY_SYMBOL}{netLendingParts[0]}<span class="text-sm"
					>.{netLendingParts[1]}</span
				>
			</span>
		</div>

		<!-- Filters -->
		<div class="hide-scrollbar mt-3 flex gap-2 overflow-x-auto">
			{#each filterChips as chip (chip.value)}
				<button
					class="shrink-0 rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors {filter ===
					chip.value
						? 'border-primary bg-primary/10 text-primary'
						: 'border-input bg-card text-muted-foreground active:bg-accent'}"
					onclick={() => (filter = chip.value)}
					aria-pressed={filter === chip.value}
				>
					{chip.label}
				</button>
			{/each}
		</div>
	</header>

	<!-- People list -->
	<div class="hide-scrollbar min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-3">
		{#if !loansStore.initialized}
			<div class="flex h-full items-center justify-center text-sm text-muted-foreground">
				Loading...
			</div>
		{:else if loansStore.people.length === 0}
			<div class="flex h-full flex-col items-center justify-center px-6 text-center">
				<div
					class="flex h-14 w-14 items-center justify-center rounded-full bg-muted text-2xl"
					aria-hidden="true"
				>
					💸
				</div>
				<p class="mt-3 text-base font-semibold text-foreground">No loans yet</p>
				<p class="mt-1 text-sm text-muted-foreground">
					Quickly record money you lent or borrowed. We'll keep track of who owes what.
				</p>
			</div>
		{:else if filtered.length === 0}
			<div class="flex h-full flex-col items-center justify-center text-sm text-muted-foreground">
				<p>Nothing matches your filters</p>
			</div>
		{:else}
			<!-- Search -->
			<div class="relative mb-3">
				<svg
					class="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted-foreground"
					fill="none"
					stroke="currentColor"
					viewBox="0 0 24 24"
				>
					<path
						stroke-linecap="round"
						stroke-linejoin="round"
						stroke-width="2"
						d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
					/>
				</svg>
				<input
					type="search"
					placeholder="Search people…"
					class="w-full rounded-2xl border border-input bg-card py-2.5 pr-3 pl-9 text-sm text-foreground placeholder:text-muted-foreground focus:border-ring focus:outline-none"
					bind:value={query}
				/>
			</div>

			<div class="flex flex-col gap-2">
				{#each filtered as person (person.id)}
					<button
						class="flex items-center gap-3 rounded-2xl bg-card px-4 py-3 text-left shadow-sm transition-colors active:bg-accent"
						onclick={() => goto('/loans/' + person.id)}
					>
						<span
							class="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-base font-bold text-white"
							style="background-color:{person.color}"
						>
							{person.name.charAt(0).toUpperCase()}
						</span>
						<div class="min-w-0 flex-1">
							<p class="truncate text-[15px] font-semibold text-foreground">{person.name}</p>
							<p class="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
								{person.loanCount} loan{person.loanCount === 1 ? '' : 's'}
								{#if overdue.has(person.id)}
									<span class="flex items-center gap-1 font-medium text-destructive">
										<span class="h-1.5 w-1.5 rounded-full bg-destructive"></span> overdue
									</span>
								{/if}
							</p>
						</div>
						<span
							class="shrink-0 font-mono text-[15px] font-bold {person.balance > 0
								? 'text-success'
								: person.balance < 0
									? 'text-destructive'
									: 'text-muted-foreground'}"
						>
							{signed(person.balance)}
						</span>
					</button>
				{/each}
			</div>
		{/if}
	</div>

	<!-- Bottom CTA -->
	<footer
		class="shrink-0 border-t border-border px-5 pt-3"
		style="padding-bottom: max(env(safe-area-inset-bottom), 0.75rem)"
	>
		<button
			class="flex h-16 w-full items-center justify-center gap-2 rounded-full bg-primary text-lg font-bold text-primary-foreground transition-all active:scale-[0.99]"
			onclick={() => goto('/?kind=lent')}
		>
			<svg class="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
				<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
			</svg>
			New Loan
		</button>
	</footer>
</div>
