<script lang="ts">
	import type { Snippet } from 'svelte';

	let { title, num, children }: { title: string; num?: string; children: Snippet } = $props();
</script>

<div class="box">
	{#if num}<span class="num">{num}</span>{/if}
	<h3>{title}</h3>
	<p>{@render children()}</p>
</div>
