// See https://svelte.dev/docs/kit/types#app.d.ts
declare global {
	namespace App {
		interface PageData {
			/** Tool pages set these; the (app) layout shows them in the title bar and <title>. */
			title?: string;
			icon?: import('$lib/ui/win2k').IconName;
			/** <title> for search results, when it should say more than the title bar. */
			pageTitle?: string;
		}
	}
}

export {};
