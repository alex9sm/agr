<script lang="ts">
	import type { HTMLInputAttributes } from 'svelte/elements';

	let { value = $bindable(''), type = 'text', ...rest }: HTMLInputAttributes = $props();
</script>

<input {...rest} {type} class="w2k-textfield" bind:value />

<style>
	.w2k-textfield {
		height: 21px;
		padding: 2px 4px;
		border: 0;
		background: var(--window);
		box-shadow: var(--sunken);
		outline: none;
		user-select: text;
	}
	.w2k-textfield:disabled {
		background: var(--face);
		color: var(--shadow);
	}
</style>
