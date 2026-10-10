<script lang="ts">
	import Glyph from './icons/Glyph.svelte';
	import type { StatusSegment } from './types';

	let { segments }: { segments: StatusSegment[] } = $props();
</script>

<footer class="w2k-statusbar">
	{#each segments as segment, i (i)}
		<div class="segment" class:grow={segment.grow} style:width={segment.width ? `${segment.width}px` : undefined}>
			{segment.text}
		</div>
	{/each}
	<span class="grip"><Glyph name="grip" /></span>
</footer>

<style>
	.w2k-statusbar {
		display: flex;
		flex: none;
		gap: 2px;
		height: 22px;
		padding: 2px 0 0 2px;
	}
	.segment {
		flex: none;
		min-width: 0;
		height: 18px;
		padding: 2px 4px;
		overflow: hidden;
		box-shadow: var(--sunken-thin);
		line-height: 14px;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.grow {
		flex: 1;
	}
	.grip {
		align-self: flex-end;
		margin-left: -2px;
	}
</style>
