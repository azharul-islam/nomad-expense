import adapter from '@sveltejs/adapter-static';

/** @type {import('@sveltejs/kit').Config} */
const config = {
	compilerOptions: {
		// Force runes mode for the project, except for libraries. Can be removed in svelte 6.
		runes: ({ filename }) => {
			return filename.includes('node_modules') ? undefined : true;
		}
	},
	kit: {
		// Absolute asset paths in prerendered pages — required so the PWA's service
		// worker navigation fallback works on deep/dynamic offline routes.
		paths: { relative: false },
		adapter: adapter({
			fallback: 'index.html'
		}),
		prerender: {
			entries: [
				'/',
				'/add',
				'/history',
				'/settings',
				'/settings/appearance',
				'/settings/cards',
				'/settings/data'
			]
		}
	}
};

export default config;
