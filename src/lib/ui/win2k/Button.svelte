<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { HTMLButtonAttributes } from 'svelte/elements';

	interface Props extends HTMLButtonAttributes {
		/** The dialog's default button: heavy black frame, focused when the dialog opens. */
		default?: boolean;
		children: Snippet;
	}
	let { default: isDefault = false, type = 'button', children, ...rest }: Props = $props();
</script>

<button {...rest} {type} class="w2k-button" class:default={isDefault}>
	{@render children()}
</button>

<style>
	.w2k-button {
		min-width: 75px;
		height: 23px;
		padding: 0 8px;
		border: 0;
		background: var(--face);
		box-shadow: var(--raised);
		outline: none;
	}
	.w2k-button.default {
		box-shadow: var(--raised-default);
	}
	.w2k-button:focus-visible {
		outline: 1px dotted #000;
		outline-offset: -5px;
	}
	.w2k-button:not(:disabled):active {
		padding: 1px 7px 0 9px;
		box-shadow: var(--pressed);
	}
	.w2k-button.default:not(:disabled):active {
		box-shadow:
			inset 0 0 0 1px #000,
			inset 0 0 0 2px var(--shadow);
	}
	.w2k-button:disabled {
		color: var(--shadow);
		text-shadow: 1px 1px var(--hilite);
	}
</style>
