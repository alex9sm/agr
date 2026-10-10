<script lang="ts">
	import type { Snippet } from 'svelte';

	let { label, class: cls, children }: { label: string; class?: string; children: Snippet } = $props();
</script>

<tr><th>{label}</th><td class={cls}>{@render children()}</td></tr>
