<script lang="ts">
	import type { Snippet } from 'svelte';

	interface Option {
		value: string;
		label: string;
		icon?: Snippet<[]>;
	}

	interface Props {
		options: Option[];
		value: string;
		onChange: (value: string) => void;
		class?: string;
	}

	let { options, value, onChange, class: className = '' }: Props = $props();
</script>

<!-- iOS-style segmented control: one track, equal-size segment buttons. -->
<div class="flex w-full items-center gap-1 rounded-2xl bg-muted p-1 {className}">
	{#each options as option (option.value)}
		<button
			type="button"
			class="flex h-14 min-w-0 flex-1 items-center justify-center gap-2 rounded-xl px-2 text-base font-semibold transition-colors {option.value ===
			value
				? 'bg-card text-foreground shadow-sm'
				: 'text-muted-foreground active:bg-card/60'}"
			aria-pressed={option.value === value}
			onclick={() => onChange(option.value)}
		>
			{#if option.icon}
				{@render option.icon()}
			{/if}
			<span class="truncate">{option.label}</span>
		</button>
	{/each}
</div>
