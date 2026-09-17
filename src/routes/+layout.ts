// Prerender every route so the PWA service worker can precache the app shell
// (adapter-static + @vite-pwa/sveltekit rely on prerendered HTML for offline).
export const prerender = true;
