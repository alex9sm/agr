<!-- Full-window app frame: title bar (inactive while a modal dialog is up) over the client area. -->
<script lang="ts">
	import type { Snippet } from 'svelte';
	import Glyph from './icons/Glyph.svelte';
	import Icon from './icons/Icon.svelte';
	import type { IconName } from './icons/icons';
	import { modal } from './modal.svelte';

	interface Props {
		title: string;
		icon?: IconName;
		/** Link out of the app, shown as a caption button before the title. Full page load. */
		back?: { href: string; label: string };
		children: Snippet;
	}
	let { title, icon, back, children }: Props = $props();
</script>

<div class="w2k-appwindow">
	<header class="w2k-titlebar" class:inactive={modal.count > 0}>
		{#if back}
			<a class="w2k-captionbutton back" href={back.href} data-sveltekit-reload><Glyph name="left" />{back.label}</a>
		{/if}
		{#if icon}<Icon name={icon} />{/if}
		<h1 class="title">{title}</h1>
	</header>
	<div class="client">{@render children()}</div>
</div>

<style>
	.w2k-appwindow {
		display: flex;
		flex-direction: column;
		height: 100vh;
		height: 100dvh;
		background: var(--face);
	}
	.w2k-titlebar {
		height: 20px;
		gap: 5px;
	}
	.back {
		height: 16px;
		margin-right: 4px;
		padding: 0 5px 0 4px;
	}
	.client {
		display: flex;
		flex: 1;
		flex-direction: column;
		min-height: 0;
	}
</style>
