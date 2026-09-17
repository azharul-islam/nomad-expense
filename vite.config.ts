import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vitest/config';
import { playwright } from '@vitest/browser-playwright';
import { sveltekit } from '@sveltejs/kit/vite';
import { SvelteKitPWA } from '@vite-pwa/sveltekit';

export default defineConfig({
	plugins: [
		tailwindcss(),
		sveltekit(),
		SvelteKitPWA({
			manifest: {
				name: 'Expense Tracker',
				short_name: 'Expenses',
				description: 'Fast and clean expense tracker optimized for mobile',
				theme_color: '#0f172a',
				background_color: '#0f172a',
				display: 'standalone',
				orientation: 'portrait',
				scope: '/',
				start_url: '/',
				icons: [
					{
						src: '/icon-192x192.png',
						sizes: '192x192',
						type: 'image/png'
					},
					{
						src: '/icon-512x512.png',
						sizes: '512x512',
						type: 'image/png'
					}
				]
			},
			workbox: {
				globPatterns: ['client/**/*.{js,css,ico,png,svg,webp,webmanifest,ttf,woff2}'],
				// The custom font is ~4.8 MB — allow it in the precache for offline use.
				maximumFileSizeToCacheInBytes: 8 * 1024 * 1024
			},
			kit: {
				includeVersionFile: true,
				// SPA fallback: precache the route-agnostic shell and use it for the
				// service worker navigation fallback so deep/dynamic URLs hydrate correctly.
				adapterFallback: 'index.html',
				spa: true
			}
		})
	],
	test: {
		expect: { requireAssertions: true },
		projects: [
			{
				extends: './vite.config.ts',
				test: {
					name: 'client',
					browser: {
						enabled: true,
						provider: playwright(),
						instances: [{ browser: 'chromium', headless: true }]
					},
					include: ['src/**/*.svelte.{test,spec}.{js,ts}'],
					exclude: ['src/lib/server/**']
				}
			},
			{
				extends: './vite.config.ts',
				test: {
					name: 'server',
					environment: 'node',
					include: ['src/**/*.{test,spec}.{js,ts}'],
					exclude: ['src/**/*.svelte.{test,spec}.{js,ts}']
				}
			}
		]
	}
});
