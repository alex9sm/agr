<!-- Draggable bar between two panes. It resizes the pane before it (or after it, with `after`). -->
<script lang="ts">
	interface Props {
		/** Size in px of the pane being resized. */
		size: number;
		/** 'vertical' is an upright bar between side-by-side panes. */
		orientation?: 'vertical' | 'horizontal';
		/** The resized pane is the one after the splitter. */
		after?: boolean;
		min?: number;
		max?: number;
		/** Space in px to always leave for the pane on the other side. */
		reserve?: number;
		label: string;
	}
	let {
		size = $bindable(),
		orientation = 'vertical',
		after = false,
		min = 40,
		max = Infinity,
		reserve = 100,
		label
	}: Props = $props();

	let el: HTMLElement;
	let drag = $state<{ start: number; size: number; limit: number } | null>(null);

	const vertical = $derived(orientation === 'vertical');
	const along = (r: DOMRect) => (vertical ? r.width : r.height);

	/** Largest size that still leaves `reserve` for the other pane. */
	function limit() {
		const room = along(el.parentElement!.getBoundingClientRect()) - along(el.getBoundingClientRect()) - reserve;
		return Math.max(min, Math.min(max, room));
	}

	/** The pane's real size, which CSS may have clamped below `size`. */
	function paneSize() {
		const pane = after ? el.nextElementSibling : el.previousElementSibling;
		return pane ? along(pane.getBoundingClientRect()) : size;
	}

	const clamp = (v: number, hi: number) => Math.round(Math.min(hi, Math.max(min, v)));

	function onpointerdown(e: PointerEvent) {
		if (e.button !== 0) return;
		e.preventDefault();
		el.setPointerCapture(e.pointerId);
		drag = { start: vertical ? e.clientX : e.clientY, size: paneSize(), limit: limit() };
	}

	function onpointermove(e: PointerEvent) {
		if (!drag) return;
		const delta = (vertical ? e.clientX : e.clientY) - drag.start;
		size = clamp(drag.size + (after ? -delta : delta), drag.limit);
	}

	function onkeydown(e: KeyboardEvent) {
		const back = vertical ? 'ArrowLeft' : 'ArrowUp';
		const forward = vertical ? 'ArrowRight' : 'ArrowDown';
		if (e.key === back || e.key === forward) {
			const delta = (e.key === forward ? 8 : -8) * (after ? -1 : 1);
			size = clamp(paneSize() + delta, limit());
		} else if (e.key === 'Home') size = min;
		else if (e.key === 'End') size = limit();
		else return;
		e.preventDefault();
	}
</script>

<!-- A focusable separator is the ARIA window-splitter pattern; Svelte's lint treats separators as static. -->
<!-- svelte-ignore a11y_no_noninteractive_tabindex, a11y_no_noninteractive_element_interactions -->
<div
	bind:this={el}
	class="w2k-splitter {orientation}"
	class:dragging={drag !== null}
	role="separator"
	aria-orientation={orientation}
	aria-label={label}
	aria-valuenow={Math.round(size)}
	aria-valuemin={min}
	tabindex="0"
	{onpointerdown}
	{onpointermove}
	onpointerup={() => (drag = null)}
	onpointercancel={() => (drag = null)}
	{onkeydown}
></div>

<style>
	.w2k-splitter {
		background: var(--face);
		outline: none;
		touch-action: none;
	}
	.vertical {
		width: 4px;
		cursor: col-resize;
	}
	.horizontal {
		height: 4px;
		cursor: row-resize;
	}
	.dragging,
	.w2k-splitter:focus-visible {
		background: repeating-conic-gradient(var(--dkshadow) 0 25%, var(--face) 0 50%) 0 0 / 2px 2px;
	}
</style>
