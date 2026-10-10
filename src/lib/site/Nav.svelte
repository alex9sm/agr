<script lang="ts">
	import { page } from '$app/state';
	import { resolve } from '$app/paths';
	import { pages } from './pages';
</script>

<nav class="nav">
	{#each pages as { path, label } (path)}
		{@const href = resolve(path)}
		<a {href} aria-current={page.url.pathname === href ? 'page' : undefined}>{label}</a>
	{/each}
</nav>
