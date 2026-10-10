<script lang="ts">
	import type { Snippet } from 'svelte';

	let { label, children }: { label: string; children: Snippet } = $props();

	let el: HTMLElement;

	/** Left/Right move between toolbar controls (sliders keep their arrows). */
	function onkeydown(e: KeyboardEvent) {
		if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
		const target = e.target as HTMLElement;
		if (target.getAttribute('role') === 'slider') return;
		const items = [
			...el.querySelectorAll<HTMLElement>('button:not(:disabled), [role="slider"]:not([aria-disabled="true"])')
		];
		const i = items.indexOf(target);
		if (i < 0) return;
		e.preventDefault();
		items[(i + (e.key === 'ArrowLeft' ? items.length - 1 : 1)) % items.length].focus();
	}
</script>

<div bind:this={el} class="w2k-toolbar" role="toolbar" aria-label={label} tabindex="-1" {onkeydown}>
	<span class="grip" aria-hidden="true"></span>
	{@render children()}
</div>

<style>
	.w2k-toolbar {
		display: flex;
		flex: none;
		flex-wrap: wrap;
		align-items: center;
		gap: 1px;
		padding: 2px 2px 3px;
		border-top: 1px solid var(--shadow);
		box-shadow: inset 0 1px var(--hilite);
		outline: none;
	}
	.grip {
		align-self: stretch;
		width: 3px;
		margin: 1px 4px 1px 1px;
		box-shadow: var(--raised-thin);
	}
</style>
