<script lang="ts">
	import { transactionStore } from '$lib/stores.svelte';
	import { CURRENCY, CURRENCY_SYMBOL, formatCurrencyInput, parseAmountToCents } from '$lib/utils/currency';

	let amount = $state('');
	let note = $state('');
	let type = $state<'income' | 'expense'>('expense');
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

	async function handleSubmit(method: 'cash' | 'card') {
		const cents = parseAmountToCents(amount);
		if (cents <= 0) return;

		isSubmitting = true;
		errorMessage = '';

		try {
			await transactionStore.add({
				amount: cents,
				currency: CURRENCY,
				type,
				paymentMethod: method,
				cardId: method === 'card' ? selectedCardId : null,
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
			type = diff > 0 ? 'expense' : 'income';
		}
	}

	const displayParts = $derived(formatCurrencyInput(amount));
	</script>

<div class="pb-safe flex shrink-0 flex-col border-t border-gray-200 bg-white dark:border-slate-800 dark:bg-slate-950" style="touch-action: none;">
	<!-- Card Selector -->
	<div class="flex gap-2 overflow-x-auto border-b border-gray-200 px-4 py-2 dark:border-slate-800">
		{#each transactionStore.cards as card}
			<button
				class="flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors {selectedCardId ===
				card.id
					? 'border-blue-600 bg-blue-50 text-blue-600 dark:border-sky-500 dark:bg-sky-500/10 dark:text-sky-400'
					: 'border-gray-300 text-gray-500 dark:border-slate-700 dark:text-slate-400'}"
				style="touch-action: manipulation;"
				onclick={() => (selectedCardId = selectedCardId === card.id ? null : card.id)}
			>
				<span class="h-2 w-2 rounded-full" style="background-color: {card.color}"></span>
				{card.name}
			</button>
		{/each}
	</div>

	<!-- Note Input -->
	<div class="flex items-center gap-2 border-b border-gray-200 px-6 py-2 dark:border-slate-800">
		<svg class="h-4 w-4 shrink-0 text-gray-400 dark:text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
			<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
		</svg>
		<input
			type="text"
			placeholder="Add a note..."
			class="min-w-0 flex-1 bg-transparent text-sm text-gray-800 placeholder-gray-400 outline-none dark:text-slate-200 dark:placeholder-slate-500"
			bind:value={note}
		/>
	</div>

	<!-- Amount Display -->
	<div
		class="flex items-center justify-between border-b border-gray-200 px-6 py-3 transition-colors duration-300 dark:border-slate-800 {type ===
		'expense'
			? 'bg-rose-100 dark:bg-rose-900/40'
			: 'bg-emerald-100 dark:bg-emerald-900/40'}"
		ontouchstart={handleTouchStart}
		ontouchend={handleTouchEnd}
		aria-label="Swipe left or right to toggle between expense and income"
		role="switch"
		aria-checked={type === 'income'}
		tabindex="0"
	>
		<div class="flex items-center gap-3">
			<!-- Type Toggle -->
			<div class="flex rounded-full bg-white/40 p-0.5 dark:bg-black/20">
				<button
					class="rounded-full px-4 py-2.5 text-xs font-medium transition-colors {type === 'expense'
						? 'bg-rose-500 text-white'
						: 'text-rose-900/40 dark:text-rose-100/40'}"
					style="touch-action: manipulation;"
					onclick={() => handleTypeToggle('expense')}
				>
					Expense
				</button>
				<button
					class="rounded-full px-4 py-2.5 text-xs font-medium transition-colors {type === 'income'
						? 'bg-emerald-500 text-white'
						: 'text-emerald-900/40 dark:text-emerald-100/40'}"
					style="touch-action: manipulation;"
					onclick={() => handleTypeToggle('income')}
				>
					Income
				</button>
			</div>
		</div>

		<div class="flex items-baseline">
			<span class="mr-1 text-lg font-semibold text-gray-400/40 dark:text-white/20">{CURRENCY_SYMBOL}</span><span
				class="font-mono text-3xl font-bold tracking-tight text-gray-900 dark:text-white"
			>{displayParts.integerPart}</span><span
				class="font-mono text-xl font-bold tracking-tight {displayParts.dotActive
					? 'text-gray-900 dark:text-white'
					: 'text-gray-400/40 dark:text-white/20'}"
			>.</span><span
				class="font-mono text-xl font-bold tracking-tight {displayParts.decimalDigitsEntered >= 1
					? 'text-gray-900 dark:text-white'
					: 'text-gray-400/40 dark:text-white/20'}"
			>{displayParts.dec1}</span><span
				class="font-mono text-xl font-bold tracking-tight {displayParts.decimalDigitsEntered >= 2
					? 'text-gray-900 dark:text-white'
					: 'text-gray-400/40 dark:text-white/20'}"
			>{displayParts.dec2}</span>
		</div>
	</div>

	<!-- Keypad Grid -->
	<div class="grid grid-cols-3 bg-white dark:bg-slate-950">
		{#each digitRows as row}
			{#each row as digit}
				{#if digit === 'backspace'}
					<button
						class="flex h-16 items-center justify-center bg-white text-gray-500 transition-colors transition-transform duration-200 active:scale-150 active:duration-0 dark:bg-slate-950 dark:text-slate-400"
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
						class="flex h-16 items-center justify-center px-2 bg-white text-xl font-medium text-gray-800 transition-transform duration-200 active:scale-150 active:duration-0 {digit ===
							'.'
							? 'text-gray-400 dark:text-slate-400'
							: ''} dark:bg-slate-950 dark:text-slate-200"
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
		<div class="bg-rose-50 px-4 py-2 text-center text-xs font-medium text-rose-600 dark:bg-rose-950/60 dark:text-rose-400">
			{errorMessage}
		</div>
	{/if}

	<!-- Add Buttons -->
	<div class="flex gap-2 px-6 pb-2">
		<button
			class="flex h-14 flex-1 items-center justify-center gap-2 rounded-full bg-blue-600 text-base font-semibold text-white transition-colors active:bg-blue-700 dark:bg-sky-600 dark:active:bg-sky-700 {parseAmountToCents(
				amount
			) <= 0 || isSubmitting
				? 'opacity-50'
				: ''}"
			style="touch-action: manipulation;"
			onclick={() => handleSubmit('cash')}
			disabled={parseAmountToCents(amount) <= 0 || isSubmitting}
		>
			<svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
				<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
			</svg>
			Cash
		</button>
		<button
			class="flex h-14 flex-1 items-center justify-center gap-2 rounded-full bg-blue-600 text-base font-semibold text-white transition-colors active:bg-blue-700 dark:bg-sky-600 dark:active:bg-sky-700 {parseAmountToCents(
				amount
			) <= 0 || isSubmitting
				? 'opacity-50'
				: ''}"
			style="touch-action: manipulation;"
			onclick={() => handleSubmit('card')}
			disabled={parseAmountToCents(amount) <= 0 || isSubmitting}
		>
			<svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
				<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
			</svg>
			Card
		</button>
	</div>
</div>

<style>
	.pb-safe {
		padding-bottom: env(safe-area-inset-bottom);
		-webkit-touch-callout: none;
		-webkit-user-select: none;
		user-select: none;
	}
</style>
