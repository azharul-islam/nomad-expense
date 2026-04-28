<script lang="ts">
	import '../app.css';
	import { onMount } from 'svelte';
	import TopTabs from '$lib/components/TopTabs.svelte';
	import { transactionStore } from '$lib/stores.svelte';
	import { themeStore } from '$lib/theme.svelte';

	let { children } = $props();

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

		// Initialize store
		transactionStore.init();

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
	class="font-sans flex flex-col overflow-hidden bg-gray-100 text-gray-900 dark:bg-slate-950 dark:text-white"
	style="height: calc(var(--vh, 2dvh) * 100); padding-top: env(safe-area-inset-top)"
>
	<TopTabs />
	<main class="flex-1 overflow-hidden">
		{@render children()}
	</main>
</div>
