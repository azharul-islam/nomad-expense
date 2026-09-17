<script lang="ts">
	import { goto } from '$app/navigation';
	import { transactionStore } from '$lib/stores.svelte';
	import type { Card } from '$lib/db';

	let showModal = $state(false);
	let editingCard = $state<Card | null>(null);
	let cardName = $state('');
	let cardLastFour = $state('');
	let cardColor = $state('#3b82f6');
	let isSaving = $state(false);
	let errorMessage = $state('');

	const presetColors = [
		'#3b82f6', // blue
		'#10b981', // emerald
		'#f59e0b', // amber
		'#ef4444', // red
		'#8b5cf6', // violet
		'#ec4899', // pink
		'#06b6d4', // cyan
		'#f97316' // orange
	];

	function openAdd() {
		editingCard = null;
		cardName = '';
		cardLastFour = '';
		cardColor = presetColors[0];
		errorMessage = '';
		showModal = true;
	}

	function openEdit(card: Card) {
		editingCard = card;
		cardName = card.name;
		cardLastFour = card.lastFour;
		cardColor = card.color;
		errorMessage = '';
		showModal = true;
	}

	function closeModal() {
		showModal = false;
		editingCard = null;
	}

	async function saveCard() {
		const name = cardName.trim();
		const lastFour = cardLastFour.trim();

		if (!name) {
			errorMessage = 'Card name is required';
			return;
		}
		if (!lastFour || /^\d{1,4}$/.test(lastFour) === false) {
			errorMessage = 'Last four digits must be 1-4 numbers';
			return;
		}

		isSaving = true;
		errorMessage = '';

		try {
			if (editingCard) {
				await transactionStore.updateCard(editingCard.id, {
					name,
					lastFour,
					color: cardColor
				});
			} else {
				await transactionStore.addCard({ name, lastFour, color: cardColor });
			}
			closeModal();
		} catch (err) {
			errorMessage = err instanceof Error ? err.message : 'Failed to save card';
		} finally {
			isSaving = false;
		}
	}

	async function handleDelete() {
		if (!editingCard) return;
		if (!confirm('Delete this card?')) return;
		isSaving = true;
		try {
			await transactionStore.deleteCard(editingCard.id);
			closeModal();
		} catch (err) {
			errorMessage = err instanceof Error ? err.message : 'Failed to delete card';
		} finally {
			isSaving = false;
		}
	}

	function handleOverlayClick(e: MouseEvent) {
		if (e.target === e.currentTarget) {
			closeModal();
		}
	}
</script>

<div
	class="flex h-full flex-col overflow-hidden bg-gray-100 text-gray-900 dark:bg-slate-950 dark:text-white"
>
	<div class="flex-1 overflow-y-auto overscroll-contain px-4 pt-4 pb-4">
		<button
			class="mb-4 flex items-center gap-1 text-sm text-blue-600 transition-colors active:text-blue-700 dark:text-sky-400 dark:active:text-sky-300"
			onclick={() => goto('/settings')}
		>
			<svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
				<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
			</svg>
			Settings
		</button>
		<div class="mb-6 flex items-center justify-between">
			<h1 class="text-3xl font-bold tracking-tight">Cards</h1>
			<button
				class="flex h-9 w-9 items-center justify-center rounded-full bg-blue-600 text-white transition-colors active:bg-blue-700 dark:bg-sky-600 dark:active:bg-sky-700"
				onclick={openAdd}
				aria-label="Add card"
			>
				<svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path
						stroke-linecap="round"
						stroke-linejoin="round"
						stroke-width="2"
						d="M12 4v16m8-8H4"
					/>
				</svg>
			</button>
		</div>

		{#if transactionStore.cards.length === 0}
			<div
				class="flex flex-col items-center justify-center py-16 text-gray-400 dark:text-slate-500"
			>
				<p class="text-sm">No cards yet</p>
				<p class="mt-1 text-xs">Tap + to add your first card</p>
			</div>
		{:else}
			<div class="flex flex-col gap-2">
				{#each transactionStore.cards as card (card.id)}
					<button
						class="flex items-center gap-3 rounded-2xl bg-white/80 px-4 py-3.5 text-left shadow-sm transition-colors active:bg-gray-50 dark:bg-slate-800/60 dark:active:bg-slate-700"
						onclick={() => openEdit(card)}
					>
						<span class="h-3 w-3 shrink-0 rounded-full" style="background-color: {card.color}"
						></span>
						<div class="min-w-0 flex-1">
							<p class="text-sm font-medium text-gray-900 dark:text-white">{card.name}</p>
							<p class="text-xs text-gray-500 dark:text-slate-400">•••• {card.lastFour}</p>
						</div>
						<svg
							class="h-5 w-5 shrink-0 text-gray-400 dark:text-slate-400"
							fill="none"
							stroke="currentColor"
							viewBox="0 0 24 24"
						>
							<path
								stroke-linecap="round"
								stroke-linejoin="round"
								stroke-width="2"
								d="M9 5l7 7-7 7"
							/>
						</svg>
					</button>
				{/each}
			</div>
		{/if}
	</div>
</div>

{#if showModal}
	<!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
	<div
		class="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 px-4 backdrop-blur-sm dark:bg-black/60"
		onclick={handleOverlayClick}
		role="dialog"
		aria-modal="true"
		tabindex="-1"
	>
		<div class="w-full max-w-sm rounded-2xl bg-white p-5 shadow-xl dark:bg-slate-900">
			<h2 class="mb-4 text-lg font-semibold text-gray-900 dark:text-white">
				{editingCard ? 'Edit Card' : 'Add Card'}
			</h2>

			{#if errorMessage}
				<div
					class="mb-3 rounded-lg bg-rose-50 px-3 py-2 text-xs font-medium text-rose-600 dark:bg-rose-950/60 dark:text-rose-400"
				>
					{errorMessage}
				</div>
			{/if}

			<div class="mb-3">
				<label
					for="card-name"
					class="mb-1 block text-xs font-medium text-gray-500 dark:text-slate-400">Name</label
				>
				<input
					id="card-name"
					type="text"
					placeholder="e.g. Visa Debit"
					class="w-full rounded-xl bg-gray-100 px-3 py-2.5 text-sm text-gray-900 placeholder-gray-400 ring-1 ring-gray-200 outline-none focus:ring-blue-500 dark:bg-slate-800 dark:text-white dark:placeholder-slate-500 dark:ring-slate-700 dark:focus:ring-sky-500"
					bind:value={cardName}
				/>
			</div>

			<div class="mb-3">
				<label
					for="card-last-four"
					class="mb-1 block text-xs font-medium text-gray-500 dark:text-slate-400"
					>Last Four Digits</label
				>
				<input
					id="card-last-four"
					type="text"
					inputmode="numeric"
					maxlength="4"
					placeholder="0000"
					class="w-full rounded-xl bg-gray-100 px-3 py-2.5 text-sm text-gray-900 placeholder-gray-400 ring-1 ring-gray-200 outline-none focus:ring-blue-500 dark:bg-slate-800 dark:text-white dark:placeholder-slate-500 dark:ring-slate-700 dark:focus:ring-sky-500"
					bind:value={cardLastFour}
				/>
			</div>

			<div class="mb-5">
				<label
					for="card-color"
					class="mb-2 block text-xs font-medium text-gray-500 dark:text-slate-400">Color</label
				>
				<div id="card-color" class="flex flex-wrap gap-2">
					{#each presetColors as color}
						<button
							class="h-8 w-8 rounded-full ring-2 transition-all {cardColor === color
								? 'scale-110 ring-gray-900 dark:ring-white'
								: 'ring-transparent'}"
							style="background-color: {color}"
							onclick={() => (cardColor = color)}
							aria-label="Select color {color}"
						></button>
					{/each}
				</div>
			</div>

			<div class="flex gap-2">
				<button
					class="flex-1 rounded-xl bg-blue-600 py-2.5 text-sm font-semibold text-white transition-colors active:bg-blue-700 dark:bg-sky-600 dark:active:bg-sky-700 {isSaving
						? 'opacity-60'
						: ''}"
					onclick={saveCard}
					disabled={isSaving}
				>
					{isSaving ? 'Saving...' : 'Save'}
				</button>
				<button
					class="flex-1 rounded-xl bg-gray-100 py-2.5 text-sm font-semibold text-gray-600 transition-colors active:bg-gray-200 dark:bg-slate-700 dark:text-slate-300 dark:active:bg-slate-600"
					onclick={closeModal}
					disabled={isSaving}
				>
					Cancel
				</button>
			</div>

			{#if editingCard}
				<button
					class="mt-3 w-full rounded-xl bg-rose-50 py-2.5 text-sm font-semibold text-rose-600 transition-colors active:bg-rose-100 dark:bg-rose-950/40 dark:text-rose-400 dark:active:bg-rose-950/60"
					onclick={handleDelete}
					disabled={isSaving}
				>
					Delete Card
				</button>
			{/if}
		</div>
	</div>
{/if}
