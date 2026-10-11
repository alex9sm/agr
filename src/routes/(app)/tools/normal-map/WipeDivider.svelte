<!--
	Wipe divider over the viewer: lit to its left, raw to its right. Drag it in any tool, or focus it and use the
	arrow keys (Shift for bigger steps), Home and End.
-->
<script lang="ts">
	/** Position across the viewer, 0..1. */
	let { value = $bindable() }: { value: number } = $props();

	let el: HTMLElement;
	/** Pointer x minus the divider's x at the start of a drag, so grabbing it off-center doesn't make it jump. */
	let grab = $state<number | null>(null);

	const clamp = (v: number) => Math.min(1, Math.max(0, v));
	const viewerRect = () => el.parentElement!.getBoundingClientRect();

	function onpointerdown(e: PointerEvent) {
		if (e.button !== 0) return;
		e.preventDefault();
		e.stopPropagation(); // don't also start a pan or light drag in the viewer
		el.focus();
		el.setPointerCapture(e.pointerId);
		const r = viewerRect();
		grab = e.clientX - (r.left + value * r.width);
	}

	function onpointermove(e: PointerEvent) {
		if (grab === null) return;
		const r = viewerRect();
		value = clamp((e.clientX - grab - r.left) / r.width);
	}

	function onkeydown(e: KeyboardEvent) {
		const step = e.shiftKey ? 0.1 : 0.01;
		const next = ({ ArrowLeft: value - step, ArrowRight: value + step, Home: 0, End: 1 } as Record<string, number>)[
			e.key
		];
		if (next === undefined) return;
		e.preventDefault();
		e.stopPropagation(); // the viewer pans on arrow keys
		value = clamp(Math.round(next * 100) / 100);
	}
</script>

<!-- A focusable separator is the ARIA window-splitter pattern; Svelte's lint treats separators as static. -->
<!-- svelte-ignore a11y_no_noninteractive_tabindex, a11y_no_noninteractive_element_interactions -->
<div
	bind:this={el}
	class="wipe"
	style:left="{value * 100}%"
	role="separator"
	aria-orientation="vertical"
	aria-label="Wipe divider: lit on the left, raw on the right"
	aria-valuenow={Math.round(value * 100)}
	aria-valuemin={0}
	aria-valuemax={100}
	tabindex="0"
	{onpointerdown}
	{onpointermove}
	onpointerup={() => (grab = null)}
	onpointercancel={() => (grab = null)}
	{onkeydown}
>
	<span class="line"></span>
	<span class="knob"></span>
</div>

<style>
	.wipe {
		/* Half the hit area; margins (not transforms) keep the line snapped to whole pixels. */
		--half: 6px;
		position: absolute;
		top: 0;
		bottom: 0;
		width: calc(2 * var(--half));
		margin-left: calc(-1 * var(--half));
		cursor: col-resize;
		outline: none;
		touch-action: none;
	}
	@media (pointer: coarse) {
		.wipe {
			--half: 14px;
		}
	}
	/* White line edged in dark gray, so it shows on any image. */
	.line {
		position: absolute;
		top: 0;
		bottom: 0;
		left: var(--half);
		width: 1px;
		background: var(--hilite);
		box-shadow:
			-1px 0 var(--dkshadow),
			1px 0 var(--dkshadow);
	}
	.knob {
		position: absolute;
		top: 50%;
		left: calc(var(--half) - 5px);
		width: 11px;
		height: 32px;
		margin-top: -16px;
		background: var(--face);
		box-shadow: var(--raised);
	}
	.wipe:focus-visible .knob {
		outline: 1px dotted #000;
		outline-offset: -4px;
	}
</style>
