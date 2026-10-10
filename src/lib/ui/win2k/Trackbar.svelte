<!-- Classic slider. `value` updates live while dragging; `onchange` fires once on release or key press. -->
<script lang="ts">
	interface Props {
		value?: number;
		min?: number;
		max?: number;
		step?: number;
		/** PageUp/PageDown step; defaults to a tenth of the range. */
		page?: number;
		width?: number;
		label: string;
		disabled?: boolean;
		onchange?: (value: number) => void;
	}
	let {
		value = $bindable(0),
		min = 0,
		max = 1,
		step = 0.01,
		page,
		width = 120,
		label,
		disabled = false,
		onchange
	}: Props = $props();

	const THUMB = 11;
	let el: HTMLElement;
	let dragging = false;

	const frac = $derived(max > min ? (value - min) / (max - min) : 0);

	function snap(v: number) {
		const snapped = min + Math.round((v - min) / step) * step;
		return Math.min(max, Math.max(min, Number(snapped.toFixed(10))));
	}

	function fromPointer(e: PointerEvent) {
		const r = el.getBoundingClientRect();
		value = snap(min + ((e.clientX - r.left - THUMB / 2) / (r.width - THUMB)) * (max - min));
	}

	function onpointerdown(e: PointerEvent) {
		if (disabled || e.button !== 0) return;
		e.preventDefault();
		el.setPointerCapture(e.pointerId);
		el.focus();
		dragging = true;
		fromPointer(e);
	}

	function onpointerup() {
		if (!dragging) return;
		dragging = false;
		onchange?.(value);
	}

	function onkeydown(e: KeyboardEvent) {
		if (disabled) return;
		const big = page ?? (max - min) / 10;
		const next = (
			{
				ArrowLeft: value - step,
				ArrowDown: value - step,
				ArrowRight: value + step,
				ArrowUp: value + step,
				PageDown: value - big,
				PageUp: value + big,
				Home: min,
				End: max
			} as Record<string, number | undefined>
		)[e.key];
		if (next === undefined) return;
		e.preventDefault();
		value = snap(next);
		onchange?.(value);
	}
</script>

<div
	bind:this={el}
	class="w2k-trackbar"
	class:disabled
	style:width="{width}px"
	role="slider"
	tabindex={disabled ? -1 : 0}
	aria-label={label}
	aria-valuemin={min}
	aria-valuemax={max}
	aria-valuenow={value}
	aria-disabled={disabled || undefined}
	{onpointerdown}
	onpointermove={(e) => dragging && fromPointer(e)}
	{onpointerup}
	onpointercancel={onpointerup}
	{onkeydown}
>
	<span class="channel"></span>
	<span class="thumb" style:left="calc((100% - {THUMB}px) * {frac})"></span>
</div>

<style>
	.w2k-trackbar {
		position: relative;
		flex: none;
		height: 22px;
		outline: none;
		touch-action: none;
	}
	.w2k-trackbar:focus {
		outline: 1px dotted #000;
	}
	.channel {
		position: absolute;
		top: 9px;
		left: 4px;
		right: 4px;
		height: 4px;
		background: var(--window);
		box-shadow: var(--sunken);
	}
	.thumb {
		position: absolute;
		top: 1px;
		width: 11px;
		height: 20px;
		background: var(--face);
		box-shadow: var(--raised-window);
	}
	.disabled .thumb {
		background: var(--dither);
	}
</style>
