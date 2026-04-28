<script lang="ts">
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';

	const tabs = [
		{ label: 'Tracker', path: '/' },
		{ label: 'History', path: '/history' },
		{ label: 'Settings', path: '/settings' }
	];

	function navigate(event: Event) {
		const select = event.target as HTMLSelectElement;
		if (select.value) goto(select.value);
	}
</script>

<div class="fixed left-3 z-50 flex h-11 w-11 items-center justify-center rounded-full bg-white/90 backdrop-blur border border-gray-200/50 dark:bg-slate-800/90 dark:border-slate-700/50" style="top: calc(env(safe-area-inset-top) + 0.75rem)">
	<svg class="pointer-events-none h-5 w-5 text-gray-500 dark:text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
		<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16" />
	</svg>
	<select
		class="absolute inset-0 opacity-0"
		onchange={navigate}
	>
		{#each tabs as tab}
			<option value={tab.path} selected={$page.url.pathname === tab.path || $page.url.pathname.startsWith(tab.path + '/')}>{tab.label}</option>
		{/each}
	</select>
</div>
