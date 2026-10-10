<script lang="ts">
	import '$lib/styles/site.css';
	import { onMount, type Snippet } from 'svelte';
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import { resolve } from '$app/paths';
	import Masthead from '$lib/site/Masthead.svelte';
	import Nav from '$lib/site/Nav.svelte';
	import Sidebar from '$lib/site/Sidebar.svelte';
	import Footer from '$lib/site/Footer.svelte';
	import { pages } from '$lib/site/pages';

	let { children }: { children: Snippet } = $props();

	// The old htmx site lived at /#products etc.; send those bookmarks to the real page.
	onMount(() => {
		if (page.url.pathname !== resolve('/')) return;
		const name = location.hash.slice(1);
		const target = pages.find((p) => p.path === '/' + name || (name === 'home' && p.path === '/'));
		if (target) goto(resolve(target.path), { replaceState: true });
	});
</script>

<div class="page">
	<Masthead />
	<Nav />
	<div class="body">
		<Sidebar />
		<main id="content">
			{@render children()}
		</main>
	</div>
	<Footer />
</div>
