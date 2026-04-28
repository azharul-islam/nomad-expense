<script lang="ts">
	import { transactionStore } from '$lib/stores.svelte';

	let amount = $state('');
	let note = $state('');
	let type = $state<'income' | 'expense'>('expense');
	let paymentMethod = $state<'cash' | 'card'>('cash');
	let selectedCardId = $state<string | null>(null);

	const digitRows = [
		['7', '8', '9'],
		['4', '5', '6'],
		['1', '2', '3'],
		['.', '0', 'backspace']
	];

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

	function parseAmount(val: string): number {
		const parsed = parseFloat(val);
		if (isNaN(parsed)) return 0;
		return Math.round(parsed * 100);
	}

	async function handleSubmit() {
		const cents = parseAmount(amount);
		if (cents <= 0) return;

		await transactionStore.add({
			amount: cents,
			currency: 'USD',
			type,
			paymentMethod,
			cardId: paymentMethod === 'card' ? selectedCardId : null,
			note: note.trim()
		});

		amount = '';
		note = '';
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

	const formattedAmount = $derived(() => {
		if (amount === '') return '0.00';
		const parsed = parseFloat(amount);
		if (isNaN(parsed)) return '0.00';
		return parsed.toFixed(2);
	});
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

		<div class="flex items-baseline gap-1">
			<span class="text-lg font-semibold {type === 'income' ? 'text-emerald-400' : 'text-rose-400'}"
				>$</span
			>
			<span class="text-3xl font-bold text-white">{formattedAmount()}</span>
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
				<button
					class="flex h-16 items-center justify-center bg-slate-950 text-xl font-medium text-slate-200 transition-colors active:bg-slate-800 {digit ===
						'.' || digit === 'backspace'
						? 'text-slate-400'
						: ''}"
					style="touch-action: manipulation;"
					onclick={() => handleDigit(digit)}
				>
					{#if digit === 'backspace'}
						<svg class="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path
								stroke-linecap="round"
								stroke-linejoin="round"
								stroke-width="2"
								d="M12 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2M3 12l6.414 6.414a2 2 0 001.414.586H21a2 2 0 002-2V7a2 2 0 00-2-2h-9.172a2 2 0 00-1.414.586L3 12z"
							/>
						</svg>
					{:else}
						{digit}
					{/if}
				</button>
			{/each}
		{/each}
	</div>

	<!-- Add Button -->
	<button
		class="flex h-14 w-full items-center justify-center bg-sky-600 text-base font-semibold text-white transition-colors active:bg-sky-700 {parseAmount(
			amount
		) <= 0
			? 'opacity-50'
			: ''}"
		style="touch-action: manipulation;"
		onclick={handleSubmit}
		disabled={parseAmount(amount) <= 0}
	>
		Add {type === 'income' ? 'Income' : 'Expense'}
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
