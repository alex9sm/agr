<!--
	Image viewer: hosts the WebGPU canvas and turns pointer, wheel and keyboard input into zoom and pan.
	Drag to pan (middle button always), wheel zooms around the cursor, arrows pan, +/- zoom.
-->
<script lang="ts">
	import { processParams } from './normalmap';
	import type { NormalMapState } from './state.svelte';

	let { app }: { app: NormalMapState } = $props();

	let frame: HTMLDivElement;
	let canvas: HTMLCanvasElement;
	let drag = $state<{ x: number; y: number } | null>(null);

	const message = $derived.by(() => {
		const s = app.gpuStatus.state;
		if (s === 'starting') return 'Starting GPU…';
		if (s === 'failed') return 'WebGPU is not available, so images cannot be displayed.';
		if (s === 'lost') return 'The GPU device was lost.';
		if (!app.base) return app.busy ?? 'Open a normal map (Ctrl+O), or drop a PNG or TGA file here.';
		return null;
	});

	// The renderer draws into our canvas; a new renderer (after a lost device) re-attaches.
	$effect(() => {
		const renderer = app.renderer;
		if (!renderer) return;
		renderer.attachCanvas(canvas);
		return () => renderer.detachCanvas();
	});

	// Keep the canvas backing store at exactly the displayed size in device pixels.
	$effect(() => {
		const observer = new ResizeObserver(([entry]) => {
			const box = entry.devicePixelContentBoxSize?.[0];
			const w = box ? box.inlineSize : Math.round(entry.contentRect.width * devicePixelRatio);
			const h = box ? box.blockSize : Math.round(entry.contentRect.height * devicePixelRatio);
			canvas.width = Math.max(1, w);
			canvas.height = Math.max(1, h);
			app.viewerSize = [w, h];
			app.renderer?.resized();
		});
		try {
			observer.observe(canvas, { box: 'device-pixel-content-box' });
		} catch {
			observer.observe(canvas); // Safari: content box only
		}
		return () => observer.disconnect();
	});

	$effect(() => {
		if (app.base) app.renderer?.setProcess(processParams(app.settings));
	});

	$effect(() => {
		app.renderer?.setView({ zoom: app.view.zoom, pan: [app.view.pan[0], app.view.pan[1]] });
	});

	/** Device pixels per CSS pixel of the canvas. */
	const scale = () => canvas.width / canvas.getBoundingClientRect().width || devicePixelRatio;

	/** Pointer position in device pixels from the canvas center. */
	function fromCenter(e: MouseEvent): [number, number] {
		const r = canvas.getBoundingClientRect();
		const s = scale();
		return [(e.clientX - r.left) * s - canvas.width / 2, (e.clientY - r.top) * s - canvas.height / 2];
	}

	function onpointerdown(e: PointerEvent) {
		frame.focus();
		const panButton = e.button === 1 || (e.button === 0 && app.view.tool === 'pan');
		if (!app.base || !panButton) return;
		e.preventDefault();
		frame.setPointerCapture(e.pointerId);
		drag = { x: e.clientX, y: e.clientY };
	}

	function onpointermove(e: PointerEvent) {
		if (!drag) return;
		const s = scale();
		app.panBy((e.clientX - drag.x) * s, (e.clientY - drag.y) * s);
		drag = { x: e.clientX, y: e.clientY };
	}

	// Wheel needs a non-passive listener to stop the page from scrolling.
	$effect(() => {
		const onwheel = (e: WheelEvent) => {
			if (!app.base) return;
			e.preventDefault();
			const lines = e.deltaMode === WheelEvent.DOM_DELTA_LINE ? 40 : 1;
			app.zoomBy(2 ** ((-e.deltaY * lines) / 300), fromCenter(e));
		};
		frame.addEventListener('wheel', onwheel, { passive: false });
		return () => frame.removeEventListener('wheel', onwheel);
	});

	function onkeydown(e: KeyboardEvent) {
		if (!app.base || e.ctrlKey || e.metaKey || e.altKey) return;
		const step = 64;
		const pans: Record<string, [number, number]> = {
			ArrowLeft: [step, 0],
			ArrowRight: [-step, 0],
			ArrowUp: [0, step],
			ArrowDown: [0, -step]
		};
		if (pans[e.key]) app.panBy(...pans[e.key]);
		else if (e.key === '+' || e.key === '=') app.zoomIn();
		else if (e.key === '-') app.zoomOut();
		else return;
		e.preventDefault();
	}
</script>

<!-- svelte-ignore a11y_no_noninteractive_tabindex, a11y_no_noninteractive_element_interactions (custom widget with its own keyboard handling) -->
<div
	bind:this={frame}
	class="viewer"
	class:pannable={app.base && app.view.tool === 'pan'}
	class:dragging={drag}
	role="application"
	aria-roledescription="image viewer"
	aria-label={app.base ? `Normal map ${app.base.name}. Arrow keys pan, plus and minus zoom.` : 'Image viewer'}
	tabindex="0"
	{onpointerdown}
	{onpointermove}
	onpointerup={() => (drag = null)}
	onpointercancel={() => (drag = null)}
	{onkeydown}
>
	<canvas bind:this={canvas}></canvas>
	{#if message}<div class="message">{message}</div>{/if}
</div>

<style>
	.viewer {
		position: relative;
		height: 100%;
		overflow: hidden;
		background: var(--workspace);
		outline: none;
		touch-action: none;
	}
	.pannable {
		cursor: grab;
	}
	.dragging {
		cursor: grabbing;
	}
	canvas {
		display: block;
		width: 100%;
		height: 100%;
	}
	.message {
		position: absolute;
		inset: 0;
		display: grid;
		place-items: center;
		padding: 16px;
		color: var(--face);
		text-align: center;
		pointer-events: none;
	}
</style>
