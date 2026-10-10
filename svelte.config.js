import adapter from '@sveltejs/adapter-static';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

/** @type {import('@sveltejs/kit').Config} */
const config = {
	preprocess: vitePreprocess(),
	kit: {
		// Every route is prerendered (see src/routes/+layout.ts); no server.
		adapter: adapter(),
		// Absolute links, so resolve('/x') matches page.url.pathname during prerender too
		// (the nav highlight compares them).
		paths: { relative: false }
	}
};

export default config;
