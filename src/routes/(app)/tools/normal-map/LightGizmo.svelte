<!--
	Light tool overlay: the dome seen from above (horizon ring, plus rings at 30° and 60° elevation) and the light's
	position on it. Display only; the Viewer handles the drag.
-->
<script lang="ts">
	import { domeRadius, pointOfLight, type Light } from './lighting';

	/** `size` is the viewer in device pixels, the units the Light tool's dome is defined in. */
	let { light, size }: { light: Light; size: [number, number] } = $props();

	const radius = $derived(domeRadius(size[0], size[1]));
	const sun = $derived(pointOfLight(light, radius));
	/** The light's position as a percentage of the viewer, for the HTML marker and tooltip. */
	const left = $derived(50 + (sun[0] / size[0]) * 100);
	const top = $derived(50 + (sun[1] / size[1]) * 100);
</script>

{#snippet dome()}
	<circle r={radius} />
	<circle r={(radius * 2) / 3} class="ring" />
	<circle r={radius / 3} class="ring" />
	<line x2={sun[0]} y2={sun[1]} />
{/snippet}

<svg viewBox="{-size[0] / 2} {-size[1] / 2} {size[0]} {size[1]}" aria-hidden="true">
	<g class="halo">{@render dome()}</g>
	<g>{@render dome()}</g>
</svg>
<div class="sun" style:left="{left}%" style:top="{top}%"></div>
<div class="tip" class:flip={sun[0] > 0} style:left="{left}%" style:top="{top}%">
	Azimuth {light.azimuth}°, elevation {light.elevation}°
</div>

<style>
	svg {
		position: absolute;
		inset: 0;
		width: 100%;
		height: 100%;
		fill: none;
		stroke: var(--hilite);
		stroke-width: 1px;
		pointer-events: none;
	}
	circle,
	line {
		vector-effect: non-scaling-stroke;
	}
	.halo {
		stroke: rgb(0 0 0 / 0.55);
		stroke-width: 3px;
	}
	.ring {
		stroke-dasharray: 2 3;
	}
	.sun,
	.tip {
		position: absolute;
		pointer-events: none;
	}
	.sun {
		width: 11px;
		height: 11px;
		margin: -6px 0 0 -6px;
		border: 1px solid #000;
		border-radius: 50%;
		background: #ffff00;
	}
	/* Classic tooltip. */
	.tip {
		margin: 9px 0 0 10px;
		padding: 1px 4px;
		border: 1px solid #000;
		background: #ffffe1;
		white-space: nowrap;
	}
	.tip.flip {
		margin-left: -10px;
		transform: translateX(-100%);
	}
</style>
