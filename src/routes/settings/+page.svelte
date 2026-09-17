<script lang="ts">
	import { goto } from '$app/navigation';
	import { themeStore } from '$lib/theme.svelte';

	const themeLabel = $derived.by(() => {
		if (themeStore.preference === 'light') return 'Light';
		if (themeStore.preference === 'dark') return 'Dark';
		return 'Auto';
	});
</script>

<div
	class="flex h-full flex-col overflow-hidden bg-gray-100 text-gray-900 dark:bg-slate-950 dark:text-white"
>
	<div class="flex-1 overflow-y-auto overscroll-contain px-4 pt-4 pb-4">
		<h1 class="mb-6 text-3xl font-bold tracking-tight">Settings</h1>

		<!-- Cards Section -->
		<div class="mb-6">
			<p class="mb-2 px-3 text-xs font-medium text-gray-400 uppercase dark:text-slate-400">Cards</p>
			<div class="overflow-hidden rounded-2xl bg-white shadow-sm dark:bg-slate-800/60">
				<button
					class="flex w-full items-center justify-between px-4 py-3.5 text-left transition-colors active:bg-gray-50 dark:active:bg-slate-700"
					onclick={() => goto('/settings/cards')}
				>
					<span class="text-base text-gray-900 dark:text-white">Manage Cards</span>
					<svg
						class="h-5 w-5 text-gray-400 dark:text-slate-400"
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
			</div>
		</div>

		<!-- Appearance Section -->
		<div class="mb-6">
			<p class="mb-2 px-3 text-xs font-medium text-gray-400 uppercase dark:text-slate-400">
				Appearance
			</p>
			<div class="overflow-hidden rounded-2xl bg-white shadow-sm dark:bg-slate-800/60">
				<button
					class="flex w-full items-center justify-between px-4 py-3.5 text-left transition-colors active:bg-gray-50 dark:active:bg-slate-700"
					onclick={() => goto('/settings/appearance')}
				>
					<span class="text-base text-gray-900 dark:text-white">Theme</span>
					<div class="flex items-center gap-1">
						<span class="text-sm text-gray-400 dark:text-slate-400">{themeLabel}</span>
						<svg
							class="h-5 w-5 text-gray-400 dark:text-slate-400"
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
					</div>
				</button>
			</div>
		</div>

		<!-- Data Section -->
		<div class="mb-6">
			<p class="mb-2 px-3 text-xs font-medium text-gray-400 uppercase dark:text-slate-400">Data</p>
			<div class="overflow-hidden rounded-2xl bg-white shadow-sm dark:bg-slate-800/60">
				<button
					class="flex w-full items-center justify-between px-4 py-3.5 text-left transition-colors active:bg-gray-50 dark:active:bg-slate-700"
					onclick={() => goto('/settings/data')}
				>
					<span class="text-base text-gray-900 dark:text-white">Export/Import</span>
					<svg
						class="h-5 w-5 text-gray-400 dark:text-slate-400"
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
			</div>
		</div>
	</div>
</div>
