<script lang="ts">
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';

	const tabs = [
		{ label: 'Tracker', path: '/' },
		{ label: 'History', path: '/history' }
	];

	function isActive(path: string, currentPath: string) {
		if (path === '/') return currentPath === '/';
		return currentPath.startsWith(path);
	}
</script>

<nav
	class="flex items-center justify-center gap-1 border-b border-slate-800 bg-slate-950/80 px-4 pt-2 backdrop-blur-md"
>
	{#each tabs as tab}
		<button
			class="relative flex-1 px-4 py-3 text-sm font-medium transition-colors {isActive(
				tab.path,
				$page.url.pathname
			)
				? 'text-sky-400'
				: 'text-slate-400 hover:text-slate-200'}"
			onclick={() => goto(tab.path)}
		>
			{tab.label}
			{#if isActive(tab.path, $page.url.pathname)}
				<span class="absolute right-0 bottom-0 left-0 h-0.5 rounded-full bg-sky-400"></span>
			{/if}
		</button>
	{/each}
</nav>
