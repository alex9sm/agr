<script lang="ts">
	import type { Snippet } from 'svelte';

	let { children }: { children: Snippet } = $props();
</script>

<!-- Squared content boxes, tiled like a spec sheet. Fill with <Box>. -->
<div class="boxes">
	{@render children()}
</div>
