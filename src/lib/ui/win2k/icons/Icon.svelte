<script lang="ts">
	import { icons, type IconName } from './icons';
	import { gridHeight, gridWidth, toPaths, toSilhouette } from './pixels';

	interface Props {
		name: IconName;
		/** Embossed gray silhouette, as Win2000 draws disabled toolbar icons. */
		disabled?: boolean;
		/** Rendered width in px (defaults to the icon's own size); pixels scale up crisply. */
		size?: number;
	}
	let { name, disabled = false, size }: Props = $props();

	const grid = $derived(icons[name]);
	const w = $derived(gridWidth(grid));
	const h = $derived(gridHeight(grid));
	const scale = $derived((size ?? w) / w);
</script>

<svg
	class="w2k-icon"
	width={w * scale}
	height={h * scale}
	viewBox="0 0 {w} {h}"
	shape-rendering="crispEdges"
	aria-hidden="true"
>
	{#if disabled}
		{@const d = toSilhouette(grid)}
		<path {d} fill="var(--hilite)" transform="translate(1 1)" />
		<path {d} fill="var(--shadow)" />
	{:else}
		{#each toPaths(grid) as p (p.fill)}
			<path d={p.d} fill={p.fill} />
		{/each}
	{/if}
</svg>

<style>
	.w2k-icon {
		display: block;
		flex: none;
	}
</style>
