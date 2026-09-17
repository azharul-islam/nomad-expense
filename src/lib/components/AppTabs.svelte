<script lang="ts">
	import { page } from '$app/stores';

	const tabs = [
		{ label: 'Tracker', path: '/', icon: 'tracker' },
		{ label: 'Loans', path: '/loans', icon: 'loans' },
		{ label: 'History', path: '/history', icon: 'history' },
		{ label: 'Settings', path: '/settings', icon: 'settings' }
	];

	function isActive(path: string): boolean {
		const p = $page.url.pathname;
		if (path === '/') return p === '/';
		return p === path || p.startsWith(path + '/');
	}
</script>

<nav class="z-20 shrink-0 border-b border-border bg-background px-2 pt-2 pb-2" aria-label="Primary">
	<div class="flex gap-1 rounded-2xl bg-muted p-1">
		{#each tabs as tab (tab.path)}
			<a
				href={tab.path}
				aria-current={isActive(tab.path) ? 'page' : undefined}
				class="flex h-12 min-w-0 flex-1 items-center justify-center gap-1 rounded-xl text-[13px] font-semibold transition-colors {isActive(
					tab.path
				)
					? 'bg-card text-foreground shadow-sm'
					: 'text-muted-foreground active:bg-card/60'}"
			>
				{#if tab.icon === 'tracker'}
					<svg class="h-[18px] w-[18px] shrink-0" fill="currentColor" viewBox="0 0 24 24">
						<circle cx="9" cy="6" r="1.6" />
						<circle cx="15" cy="6" r="1.6" />
						<circle cx="9" cy="12" r="1.6" />
						<circle cx="15" cy="12" r="1.6" />
						<circle cx="9" cy="18" r="1.6" />
						<circle cx="15" cy="18" r="1.6" />
					</svg>
				{:else if tab.icon === 'loans'}
					<svg
						class="h-[18px] w-[18px] shrink-0"
						fill="none"
						stroke="currentColor"
						viewBox="0 0 24 24"
					>
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							stroke-width="2"
							d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3zm7-5a2 2 0 11-4 0 2 2 0 014 0z"
						/>
					</svg>
				{:else if tab.icon === 'history'}
					<svg
						class="h-[18px] w-[18px] shrink-0"
						fill="none"
						stroke="currentColor"
						viewBox="0 0 24 24"
					>
						<circle cx="12" cy="12" r="8.5" />
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 7v5l3 3" />
					</svg>
				{:else}
					<svg
						class="h-[18px] w-[18px] shrink-0"
						fill="none"
						stroke="currentColor"
						viewBox="0 0 24 24"
					>
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							stroke-width="2"
							d="M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3M2 14h4M10 8h4M18 16h4"
						/>
					</svg>
				{/if}
				<span class="truncate">{tab.label}</span>
			</a>
		{/each}
	</div>
</nav>
