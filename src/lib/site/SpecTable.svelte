<script lang="ts">
	import type { Snippet } from 'svelte';

	let { children }: { children: Snippet } = $props();
</script>

<!-- Spec-style key/value table. Fill with <SpecRow>. -->
<table class="spec">
	<tbody>
		{@render children()}
	</tbody>
</table>
