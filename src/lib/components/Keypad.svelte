<script lang="ts">
	import { onDestroy } from 'svelte';

	interface Props {
		value: string;
		onEnter?: () => void;
	}

	let { value = $bindable(), onEnter }: Props = $props();

	const digitRows = [
		['7', '8', '9'],
		['4', '5', '6'],
		['1', '2', '3'],
		['.', '0', 'backspace']
	];

	let clearTimer: ReturnType<typeof setTimeout> | null = null;
	let held = false;

	function handleDigit(digit: string) {
		if (digit === 'backspace') {
			value = value.slice(0, -1);
			return;
		}
		if (digit === '.') {
			if (value.includes('.')) return;
			if (value === '') value = '0';
		}
		if (value.replace('.', '').length >= 8) return;
		value += digit;
	}

	function handleBackspaceStart() {
		held = false;
		clearTimer = setTimeout(() => {
			value = '';
			held = true;
			clearTimer = null;
		}, 500);
	}

	function handleBackspaceEnd() {
		if (clearTimer) {
			// Quick press: cancel the hold. The following click performs a single delete.
			clearTimeout(clearTimer);
			clearTimer = null;
		}
	}

	function handleBackspaceClick() {
		if (held) {
			held = false;
			return;
		}
		value = value.slice(0, -1);
	}

	// Physical keyboard support (desktop / hardware keyboards).
	function handleKeydown(e: KeyboardEvent) {
		// The keypad shares a screen with the payment note textarea, so keystrokes
		// aimed at a real text field must pass through untouched — otherwise
		// preventDefault() below would divert digits into the amount and stop
		// Backspace from editing the note.
		const target = e.target as HTMLElement | null;
		if (
			target &&
			(target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)
		) {
			return;
		}
		if (e.key >= '0' && e.key <= '9') {
			handleDigit(e.key);
			e.preventDefault();
		} else if (e.key === '.') {
			handleDigit('.');
			e.preventDefault();
		} else if (e.key === 'Backspace') {
			handleDigit('backspace');
			e.preventDefault();
		} else if (e.key === 'Enter' && value !== '') {
			onEnter?.();
		}
	}
	onDestroy(() => {
		if (clearTimer) clearTimeout(clearTimer);
	});
</script>

<svelte:window onkeydown={handleKeydown} />

<div class="shrink-0 pb-2 select-none" style="touch-action: manipulation">
	<div class="grid grid-cols-3 gap-2.5 px-4">
		{#each digitRows as row}
			{#each row as digit (digit)}
				{#if digit === 'backspace'}
					<button
						class="flex h-[4.5rem] items-center justify-center rounded-2xl bg-card text-muted-foreground shadow-sm transition-transform duration-200 ease-out active:scale-[0.97] active:duration-100 dark:active:bg-accent"
						onpointerdown={handleBackspaceStart}
						onpointerup={handleBackspaceEnd}
						onpointerleave={handleBackspaceEnd}
						onclick={handleBackspaceClick}
						aria-label="Backspace"
					>
						<svg class="h-7 w-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
						class="flex h-[4.5rem] items-center justify-center rounded-2xl bg-card text-2xl font-semibold text-foreground shadow-sm transition-transform duration-200 ease-out active:scale-[0.97] active:duration-100 dark:active:bg-accent"
						onclick={(e) => {
							handleDigit(digit);
							e.currentTarget.blur();
						}}
						aria-label={digit === '.' ? 'Decimal point' : undefined}
					>
						{digit}
					</button>
				{/if}
			{/each}
		{/each}
	</div>
</div>
