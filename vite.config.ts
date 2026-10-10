import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vitest/config';

export default defineConfig({
	plugins: [sveltekit()],
	server: { port: 5173, strictPort: true },
	// The codec worker is a module worker (it imports fast-png).
	worker: { format: 'es' },
	test: {
		include: ['tests/unit/**/*.test.ts']
	}
});
