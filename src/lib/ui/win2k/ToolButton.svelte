<script lang="ts">
	import Icon from './icons/Icon.svelte';
	import type { IconName } from './icons/icons';

	interface Props {
		icon: IconName;
		/** Tooltip and accessible name. */
		label: string;
		/** Set (true or false) to make this a toggle button. */
		pressed?: boolean;
		disabled?: boolean;
		onclick?: () => void;
	}
	let { icon, label, pressed, disabled = false, onclick }: Props = $props();
</script>

<button
	type="button"
	class="w2k-toolbutton"
	class:pressed
	title={label}
	aria-label={label}
	aria-pressed={pressed}
	{disabled}
	{onclick}
>
	<Icon name={icon} {disabled} />
</button>

<style>
	.w2k-toolbutton {
		display: grid;
		flex: none;
		place-items: center;
		width: 23px;
		height: 22px;
		padding: 0;
		border: 0;
		background: none;
		outline: none;
	}
	.w2k-toolbutton:not(:disabled):hover {
		box-shadow: var(--raised-thin);
	}
	.w2k-toolbutton.pressed,
	.w2k-toolbutton:not(:disabled):active {
		box-shadow: var(--sunken-thin);
	}
	.w2k-toolbutton.pressed:not(:hover) {
		background: var(--dither);
	}
	.w2k-toolbutton.pressed :global(.w2k-icon),
	.w2k-toolbutton:not(:disabled):active :global(.w2k-icon) {
		translate: 1px 1px;
	}
	.w2k-toolbutton:focus-visible {
		outline: 1px dotted #000;
		outline-offset: -3px;
	}
</style>
