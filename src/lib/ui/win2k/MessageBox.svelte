<!-- Classic message box: 32×32 icon beside the message, buttons centered underneath. -->
<script lang="ts">
	import type { Snippet } from 'svelte';
	import Dialog from './Dialog.svelte';
	import Icon from './icons/Icon.svelte';

	interface Props {
		open?: boolean;
		title: string;
		icon: 'error' | 'warning';
		width?: number;
		children: Snippet;
		/** Mark one `<Button default>`. */
		buttons: Snippet;
		onclose?: () => void;
	}
	let { open = $bindable(false), title, icon, width = 380, children, buttons, onclose }: Props = $props();
</script>

<Dialog bind:open {title} {width} {onclose} {buttons} centerButtons>
	<div class="message">
		<Icon name={icon} />
		<div class="text">{@render children()}</div>
	</div>
</Dialog>

<style>
	.message {
		display: flex;
		align-items: flex-start;
		gap: 14px;
		padding: 2px 4px 0;
	}
	.text {
		padding-top: 2px;
		user-select: text;
	}
	.text :global(p) {
		margin: 0 0 8px;
	}
</style>
