<script lang="ts">
	import type { Snippet } from 'svelte';
	import Glyph from './icons/Glyph.svelte';

	interface Props {
		checked?: boolean;
		disabled?: boolean;
		id?: string;
		onchange?: (checked: boolean) => void;
		children?: Snippet;
	}
	let { checked = $bindable(false), disabled = false, id, onchange, children }: Props = $props();
</script>

<label class="w2k-checkbox" class:disabled>
	<input type="checkbox" {id} {disabled} bind:checked onchange={() => onchange?.(checked)} />
	<span class="box" aria-hidden="true">
		{#if checked}<Glyph name="check" />{/if}
	</span>
	{#if children}<span class="text">{@render children()}</span>{/if}
</label>

<style>
	.w2k-checkbox {
		position: relative;
		display: inline-flex;
		align-items: center;
		gap: 5px;
	}
	input {
		position: absolute;
		opacity: 0;
		width: 13px;
		height: 13px;
		margin: 0;
	}
	.box {
		display: grid;
		flex: none;
		place-items: center;
		width: 13px;
		height: 13px;
		background: var(--window);
		box-shadow: var(--sunken);
	}
	.w2k-checkbox:active:not(.disabled) .box,
	.disabled .box {
		background: var(--face);
	}
	.disabled {
		color: var(--shadow);
	}
	.disabled .text {
		text-shadow: 1px 1px var(--hilite);
	}
	.text {
		padding: 0 1px;
	}
	input:focus-visible ~ .text,
	input:focus-visible ~ .box:last-child {
		outline: 1px dotted #000;
	}
</style>
