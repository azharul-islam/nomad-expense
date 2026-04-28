<script lang="ts">
	import '../app.css';
	import { onMount } from 'svelte';
	import TopTabs from '$lib/components/TopTabs.svelte';
	import { transactionStore } from '$lib/stores.svelte';

	let { children } = $props();

	onMount(async () => {
		// Register service worker via vite-plugin-pwa
		if ('serviceWorker' in navigator) {
			const { registerSW } = await import('virtual:pwa-register');
			registerSW({
				immediate: true,
				onRegistered(r: ServiceWorkerRegistration | undefined) {
					console.log('SW registered:', r);
				},
				onRegisterError(error: Error) {
					console.error('SW registration error:', error);
				}
			});
		}

		// Initialize store
		await transactionStore.init();
	});
</script>

<div class="flex h-[100dvh] flex-col overflow-hidden bg-slate-950 text-white">
	<TopTabs />
	<main class="flex-1 overflow-hidden">
		{@render children()}
	</main>
</div>
