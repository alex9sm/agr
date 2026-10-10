<script lang="ts">
	import '$lib/styles/win2k.css';
	import type { Snippet } from 'svelte';
	import { page } from '$app/state';
	import { resolve } from '$app/paths';
	import { AppWindow } from '$lib/ui/win2k';

	let { children }: { children: Snippet } = $props();

	const title = $derived(page.data.title ?? 'AGR Tools');
</script>

<svelte:head><title>{title}</title></svelte:head>

<!-- AppWindow's back link does a full page load, so tool styles never carry over to the site. -->
<AppWindow {title} icon={page.data.icon} back={{ href: resolve('/'), label: 'AGR Home' }}>
	{@render children()}
</AppWindow>
