<script lang="ts">
	import { icons, type IconName } from './icons';
	import { toPaths, toSilhouette } from './pixels';

	interface Props {
		name: IconName;
		/** Embossed gray silhouette, as Win2000 draws disabled toolbar icons. */
		disabled?: boolean;
		/** Rendered size in px; pixels scale up crisply. */
		size?: number;
	}
	let { name, disabled = false, size = 16 }: Props = $props();

	const grid = $derived(icons[name]);
</script>

<svg class="w2k-icon" width={size} height={size} viewBox="0 0 16 16" shape-rendering="crispEdges" aria-hidden="true">
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
