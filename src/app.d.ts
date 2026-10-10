// See https://svelte.dev/docs/kit/types#app.d.ts
declare global {
	namespace App {
		interface PageData {
			/** Tool pages set this; the (app) layout shows it in the strip and <title>. */
			title?: string;
		}
	}
}

export {};
