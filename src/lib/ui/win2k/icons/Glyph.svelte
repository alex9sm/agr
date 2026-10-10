<script lang="ts">
	import { glyphs, type GlyphName } from './glyphs';
	import { gridHeight, gridWidth, toPaths } from './pixels';

	let { name }: { name: GlyphName } = $props();

	const grid = $derived(glyphs[name]);
	const w = $derived(gridWidth(grid));
	const h = $derived(gridHeight(grid));
</script>

<svg class="w2k-glyph" width={w} height={h} viewBox="0 0 {w} {h}" shape-rendering="crispEdges" aria-hidden="true">
	{#each toPaths(grid) as p (p.fill)}
		<path d={p.d} fill={p.fill} />
	{/each}
</svg>

<style>
	.w2k-glyph {
		display: block;
		flex: none;
	}
</style>
