<script lang="ts">
	import { goto } from '$app/navigation';
	import { themeStore } from '$lib/theme.svelte';

	const options: { label: string; value: 'auto' | 'light' | 'dark' }[] = [
		{ label: 'Auto', value: 'auto' },
		{ label: 'Light', value: 'light' },
		{ label: 'Dark', value: 'dark' }
	];
</script>

<div class="flex h-full flex-col overflow-hidden bg-gray-100 text-gray-900 dark:bg-slate-950 dark:text-white">
	<div class="flex-1 overflow-y-auto overscroll-contain px-4 pt-16 pb-4">
		<button
			class="mb-4 flex items-center gap-1 text-sm text-blue-600 transition-colors active:text-blue-700 dark:text-sky-400 dark:active:text-sky-300"
			onclick={() => goto('/settings')}
		>
			<svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
				<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
			</svg>
			Settings
		</button>
		<h1 class="mb-6 text-3xl font-bold tracking-tight">Appearance</h1>

		<div class="overflow-hidden rounded-2xl bg-white shadow-sm dark:bg-slate-800/60">
			{#each options as option, i}
				<button
					class="flex w-full items-center justify-between px-4 py-3.5 text-left transition-colors active:bg-gray-50 dark:active:bg-slate-700 {i !== options.length - 1 ? 'border-b border-gray-100 dark:border-slate-700/50' : ''}"
					onclick={() => themeStore.setTheme(option.value)}
				>
					<span class="text-base text-gray-900 dark:text-white">{option.label}</span>
					{#if themeStore.preference === option.value}
						<svg class="h-5 w-5 text-blue-600 dark:text-sky-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
						</svg>
					{/if}
				</button>
			{/each}
		</div>
	</div>
</div>
