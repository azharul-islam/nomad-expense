import { browser } from '$app/environment';

export type ThemePreference = 'auto' | 'light' | 'dark';

function createThemeStore() {
	let preference = $state<ThemePreference>('auto');
	let systemDark = $state(false);

	if (browser) {
		const saved = localStorage.getItem('theme');
		if (saved === 'light' || saved === 'dark' || saved === 'auto') {
			preference = saved;
		}

		const mql = window.matchMedia('(prefers-color-scheme: dark)');
		systemDark = mql.matches;
		mql.addEventListener('change', (e) => {
			systemDark = e.matches;
		});
	}

	let effectiveTheme = $derived.by(() => {
		if (preference === 'light') return 'light';
		if (preference === 'dark') return 'dark';
		return systemDark ? 'dark' : 'light';
	});

	function setTheme(newTheme: ThemePreference) {
		preference = newTheme;
		if (browser) {
			localStorage.setItem('theme', newTheme);
		}
	}

	return {
		get preference() {
			return preference;
		},
		get effectiveTheme() {
			return effectiveTheme;
		},
		setTheme
	};
}

export const themeStore = createThemeStore();
