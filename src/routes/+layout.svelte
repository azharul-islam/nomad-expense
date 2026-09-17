<script lang="ts">
	import '../app.css';
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { page } from '$app/stores';
	import AppTabs from '$lib/components/AppTabs.svelte';
	import { transactionStore } from '$lib/stores.svelte';
	import { loansStore } from '$lib/loans.svelte';
	import { themeStore } from '$lib/theme.svelte';

	let { children } = $props();

	// Full-screen wizard routes hide the tab bar so the top stays button-free.
	function isEntryScreen(pathname: string): boolean {
		return pathname === '/add' || /^\/loans\/[^/]+\/pay$/.test(pathname);
	}

	function setVh() {
		document.documentElement.style.setProperty('--vh', `${window.innerHeight * 0.01}px`);
	}

	function applyTheme() {
		const html = document.documentElement;
		const theme = themeStore.effectiveTheme;
		if (theme === 'dark') {
			html.classList.add('dark');
		} else {
			html.classList.remove('dark');
		}
		html.setAttribute('data-theme', theme);
	}

	onMount(() => {
		setVh();

		// The PWA service worker serves the prerendered '/' shell as its navigation
		// fallback for any deep URL, so on first load SvelteKit hydrates the shell's
		// embedded route instead of the requested one. Re-navigate to the real URL —
		// the route chunk is precached, so this also works fully offline.
		const realUrl = window.location.pathname + window.location.search;
		const hydratedUrl = $page.url.pathname + $page.url.search;
		// Defence in depth: if the served document's route ever disagrees with the
		// real URL, re-navigate to the real URL (route chunks are precached).
		if (realUrl !== hydratedUrl) {
			goto(realUrl, { invalidateAll: false });
		}
		window.addEventListener('resize', setVh);

		// Register service worker via vite-plugin-pwa
		if ('serviceWorker' in navigator) {
			import('virtual:pwa-register').then(({ registerSW }) => {
				registerSW({
					immediate: true,
					onRegistered(r: ServiceWorkerRegistration | undefined) {
						console.log('SW registered:', r);
					},
					onRegisterError(error: Error) {
						console.error('SW registration error:', error);
					}
				});
			});
		}

		// Initialize stores
		transactionStore.init().catch((err) => console.error('Store init failed:', err));
		loansStore.init().catch((err) => console.error('Loans store init failed:', err));

		// Apply theme
		applyTheme();

		return () => {
			window.removeEventListener('resize', setVh);
		};
	});

	$effect(() => {
		// Re-apply theme when effectiveTheme changes
		themeStore.effectiveTheme;
		applyTheme();
	});
</script>

<div
	class="flex flex-col overflow-hidden bg-background text-foreground"
	style="height: calc(var(--vh, 1dvh) * 100); padding-top: env(safe-area-inset-top)"
>
	{#if !isEntryScreen($page.url.pathname)}
		<AppTabs />
	{/if}
	<main class="min-h-0 flex-1 overflow-hidden">
		{@render children()}
	</main>
</div>
