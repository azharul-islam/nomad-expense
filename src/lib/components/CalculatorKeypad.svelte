<script lang="ts">
	import { transactionStore } from '$lib/stores.svelte';
	import { CURRENCY, CURRENCY_SYMBOL, formatCurrencyInput, parseAmountToCents } from '$lib/utils/currency';

	let amount = $state('');
	let note = $state('');
	let type = $state<'income' | 'expense'>('expense');
	let paymentMethod = $state<'cash' | 'card'>('cash');
	let selectedCardId = $state<string | null>(null);
	let isSubmitting = $state(false);
	let errorMessage = $state('');

	const digitRows = [
		['7', '8', '9'],
		['4', '5', '6'],
		['1', '2', '3'],
		['.', '0', 'backspace']
	];

	let clearTimer: ReturnType<typeof setTimeout> | null = null;

	function handleDigit(digit: string) {
		if (digit === 'backspace') {
			amount = amount.slice(0, -1);
			return;
		}
		if (digit === '.') {
			if (amount.includes('.')) return;
			if (amount === '') amount = '0';
		}
		if (amount.replace('.', '').length >= 8) return;
		amount += digit;
	}

	function handleBackspaceStart() {
		clearTimer = setTimeout(() => {
			amount = '';
			clearTimer = null;
		}, 500);
	}

	function handleBackspaceEnd() {
		if (clearTimer) {
			clearTimeout(clearTimer);
			clearTimer = null;
			amount = amount.slice(0, -1);
		}
	}

	function handleTypeToggle(newType: 'income' | 'expense') {
		type = newType;
	}

	function handlePaymentToggle(method: 'cash' | 'card') {
		paymentMethod = method;
		if (method === 'cash') {
			selectedCardId = null;
		} else if (transactionStore.cards.length > 0 && !selectedCardId) {
			selectedCardId = transactionStore.cards[0].id;
		}
	}

	async function handleSubmit() {
		const cents = parseAmountToCents(amount);
		if (cents <= 0) return;

		isSubmitting = true;
		errorMessage = '';

		try {
			await transactionStore.add({
				amount: cents,
				currency: CURRENCY,
				type,
				paymentMethod,
				cardId: paymentMethod === 'card' ? selectedCardId : null,
				note: note.trim()
			});

			amount = '';
			note = '';
		} catch (err) {
			errorMessage = err instanceof Error ? err.message : 'Failed to add transaction';
			console.error('Submit failed:', err);
		} finally {
			isSubmitting = false;
		}
	}

	// Swipe gesture for type toggle
	let touchStartX = 0;

	function handleTouchStart(e: TouchEvent) {
		touchStartX = e.changedTouches[0].screenX;
	}

	function handleTouchEnd(e: TouchEvent) {
		const diff = touchStartX - e.changedTouches[0].screenX;
		if (Math.abs(diff) > 50) {
			type = diff > 0 ? 'income' : 'expense';
		}
	}

	const displayParts = $derived(formatCurrencyInput(amount));
</script>

<div class="pb-safe flex shrink-0 flex-col border-t border-slate-800 bg-slate-950" style="touch-action: none;">
	<!-- Amount Display -->
	<div
		class="flex items-center justify-between border-b border-slate-800 px-4 py-3"
		ontouchstart={handleTouchStart}
		ontouchend={handleTouchEnd}
		aria-label="Swipe left or right to toggle between expense and income"
		role="switch"
		aria-checked={type === 'income'}
		tabindex="0"
	>
		<div class="flex items-center gap-3">
			<!-- Type Toggle -->
			<div class="flex rounded-lg bg-slate-800 p-0.5">
				<button
					class="rounded-md px-3 py-1.5 text-xs font-medium transition-colors {type === 'expense'
						? 'bg-rose-500 text-white'
						: 'text-slate-400'}"
					style="touch-action: manipulation;"
					onclick={() => handleTypeToggle('expense')}
				>
					Expense
				</button>
				<button
					class="rounded-md px-3 py-1.5 text-xs font-medium transition-colors {type === 'income'
						? 'bg-emerald-500 text-white'
						: 'text-slate-400'}"
					style="touch-action: manipulation;"
					onclick={() => handleTypeToggle('income')}
				>
					Income
				</button>
			</div>
		</div>

		<div class="flex items-baseline">
			<span class="mr-1 text-lg font-semibold text-slate-500">{CURRENCY_SYMBOL}</span><span
				class="text-3xl font-bold tracking-tight text-white"
			>{displayParts.integerPart}</span><span
				class="text-3xl font-bold tracking-tight {displayParts.dotActive ? 'text-white' : 'text-slate-600'}"
			>.</span><span
				class="text-3xl font-bold tracking-tight {displayParts.decimalDigitsEntered >= 1 ? 'text-white' : 'text-slate-600'}"
			>{displayParts.dec1}</span><span
				class="text-3xl font-bold tracking-tight {displayParts.decimalDigitsEntered >= 2 ? 'text-white' : 'text-slate-600'}"
			>{displayParts.dec2}</span>
		</div>
	</div>

	<!-- Note Input -->
	<div class="border-b border-slate-800 px-4 py-2">
		<input
			type="text"
			placeholder="Add a note..."
			class="w-full bg-transparent text-sm text-slate-200 placeholder-slate-500 outline-none"
			bind:value={note}
		/>
	</div>

	<!-- Payment Method Toggle -->
	<div class="flex items-center justify-between border-b border-slate-800 px-4 py-2">
		<div class="flex rounded-lg bg-slate-800 p-0.5">
			<button
				class="rounded-md px-3 py-1.5 text-xs font-medium transition-colors {paymentMethod ===
				'cash'
					? 'bg-sky-500 text-white'
					: 'text-slate-400'}"
				style="touch-action: manipulation;"
				onclick={() => handlePaymentToggle('cash')}
			>
				Cash
			</button>
			<button
				class="rounded-md px-3 py-1.5 text-xs font-medium transition-colors {paymentMethod ===
				'card'
					? 'bg-sky-500 text-white'
					: 'text-slate-400'}"
				style="touch-action: manipulation;"
				onclick={() => handlePaymentToggle('card')}
			>
				Card
			</button>
		</div>

		<!-- Card Selector (only when card is selected) -->
		{#if paymentMethod === 'card'}
			<div class="flex gap-2 overflow-x-auto">
				{#each transactionStore.cards as card}
					<button
						class="flex shrink-0 items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors {selectedCardId ===
						card.id
							? 'border-sky-500 bg-sky-500/10 text-sky-400'
							: 'border-slate-700 text-slate-400'}"
						style="touch-action: manipulation;"
						onclick={() => (selectedCardId = card.id)}
					>
						<span class="h-2 w-2 rounded-full" style="background-color: {card.color}"></span>
						{card.name}
					</button>
				{/each}
			</div>
		{/if}
	</div>

	<!-- Keypad Grid -->
	<div class="grid grid-cols-3 gap-px bg-slate-800">
		{#each digitRows as row}
			{#each row as digit}
				{#if digit === 'backspace'}
					<button
						class="flex h-16 items-center justify-center bg-slate-950 text-slate-400 transition-colors active:bg-slate-800"
						style="touch-action: manipulation;"
						onpointerdown={handleBackspaceStart}
						onpointerup={handleBackspaceEnd}
						onpointerleave={handleBackspaceEnd}
						aria-label="Backspace"
					>
						<svg class="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path
								stroke-linecap="round"
								stroke-linejoin="round"
								stroke-width="2"
								d="M12 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2M3 12l6.414 6.414a2 2 0 001.414.586H21a2 2 0 002-2V7a2 2 0 00-2-2h-9.172a2 2 0 00-1.414.586L3 12z"
							/>
						</svg>
					</button>
				{:else}
					<button
						class="flex h-16 items-center justify-center bg-slate-950 text-xl font-medium text-slate-200 transition-colors active:bg-slate-800 {digit ===
							'.'
							? 'text-slate-400'
							: ''}"
						style="touch-action: manipulation;"
						onclick={() => handleDigit(digit)}
					>
						{digit}
					</button>
				{/if}
			{/each}
		{/each}
	</div>

	<!-- Error Message -->
	{#if errorMessage}
		<div class="bg-rose-950/60 px-4 py-2 text-center text-xs font-medium text-rose-400">
			{errorMessage}
		</div>
	{/if}

	<!-- Add Button -->
	<button
		class="flex h-14 w-full items-center justify-center bg-sky-600 text-base font-semibold text-white transition-colors active:bg-sky-700 {parseAmountToCents(
			amount
		) <= 0 || isSubmitting
			? 'opacity-50'
			: ''}"
		style="touch-action: manipulation;"
		onclick={handleSubmit}
		disabled={parseAmountToCents(amount) <= 0 || isSubmitting}
	>
		{#if isSubmitting}
			<svg class="mr-2 h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
				<circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
				<path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
			</svg>
			Adding...
		{:else}
			Add {type === 'income' ? 'Income' : 'Expense'}
		{/if}
	</button>
</div>

<style>
	.pb-safe {
		padding-bottom: env(safe-area-inset-bottom);
		-webkit-touch-callout: none;
		-webkit-user-select: none;
		user-select: none;
	}
</style>
