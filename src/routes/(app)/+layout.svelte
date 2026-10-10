<script lang="ts">
	import type { Snippet } from 'svelte';
	import { page } from '$app/state';
	import { resolve } from '$app/paths';

	let { children }: { children: Snippet } = $props();
</script>

<svelte:head><title>{page.data.title ?? 'AGR Tools'}</title></svelte:head>

<!-- Full-window tool layout. Phase 1 replaces these placeholder styles with win2k.css. -->
<div class="app">
	<div class="strip">
		<!-- Full page load back to the site so tool styles don't carry over. -->
		<a href={resolve('/')} data-sveltekit-reload>&#9668; AGR Home</a>
		<span class="sep"></span>
		<span>{page.data.title}</span>
	</div>
	<div class="content">
		{@render children()}
	</div>
</div>

<style>
	:global(html, body) {
		height: 100%;
		margin: 0;
	}
	.app {
		display: flex;
		flex-direction: column;
		height: 100vh;
		background: #d4d0c8;
		color: #000;
		font: 11px Tahoma, 'MS Sans Serif', Geneva, sans-serif;
	}
	.strip {
		display: flex;
		align-items: center;
		gap: 8px;
		padding: 3px 6px;
		box-shadow: inset 0 -1px #808080, 0 1px #fff;
	}
	.strip a { color: #000; text-decoration: none; }
	.strip a:hover { text-decoration: underline; }
	.sep {
		align-self: stretch;
		width: 2px;
		box-shadow: inset 1px 0 #808080, inset -1px 0 #fff;
	}
	.content {
		flex: 1;
		min-height: 0;
	}
</style>
