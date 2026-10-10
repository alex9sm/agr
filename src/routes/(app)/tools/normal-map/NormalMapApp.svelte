<!-- Normal Map Editor shell: menus, toolbar, Layers / Properties / Viewer / Pixel Info panes, status bar. -->
<script lang="ts">
	import { onMount } from 'svelte';
	import { MediaQuery } from 'svelte/reactivity';
	import {
		Button,
		Dialog,
		Icon,
		MenuBar,
		MessageBox,
		Pane,
		PropertyGrid,
		Select,
		Splitter,
		StatusBar,
		ToolButton,
		ToolSeparator,
		Toolbar,
		Trackbar,
		TreeView,
		type MenuDef,
		type MenuItem,
		type Property,
		type SelectOption,
		type StatusSegment,
		type TreeNode
	} from '$lib/ui/win2k';
	import { NormalMapState, type Convention, type LayerId, type View } from './state.svelte';

	const app = new NormalMapState();
	const narrow = new MediaQuery('(max-width: 899px)', false);

	onMount(() => {
		app.startGpu();
		// Dev only: inspect and poke the state from the console.
		if (import.meta.env.DEV) Object.assign(window, { nmApp: app });
		return () => app.stopGpu();
	});

	/** GPU failure or loss the user hasn't dismissed yet. Raw: compared by identity, so it must not be proxied. */
	let dismissedGpuStatus = $state.raw<object | null>(null);
	const gpuProblem = $derived(
		(app.gpuStatus.state === 'failed' || app.gpuStatus.state === 'lost') && app.gpuStatus !== dismissedGpuStatus
			? app.gpuStatus
			: null
	);
	const dismissGpuProblem = () => (dismissedGpuStatus = app.gpuStatus);

	const gpuText = $derived.by(() => {
		const s = app.gpuStatus;
		if (s.state === 'starting') return 'GPU: starting…';
		if (s.state === 'ready') return `GPU: ${s.gpu.adapterName}`;
		return s.state === 'lost' ? 'GPU: device lost' : 'GPU: unavailable';
	});

	let aboutOpen = $state(false);
	let sideWidth = $state(240);
	let layersHeight = $state(130);
	let infoHeight = $state(76);

	const conventions: SelectOption[] = [
		{ value: 'opengl', label: 'OpenGL (Y+)' },
		{ value: 'directx', label: 'DirectX (Y−)' }
	];

	const layers: TreeNode[] = [
		{
			id: 'output',
			label: 'Output',
			icon: 'output',
			children: [
				{ id: 'base', label: 'Base map', icon: 'baseMap', note: '[none]' },
				{ id: 'detail', label: 'Detail map', icon: 'detailMap', note: '[none]' }
			]
		}
	];
	const layerOptions: SelectOption[] = [
		{ value: 'output', label: 'Output' },
		{ value: 'base', label: 'Base map' },
		{ value: 'detail', label: 'Detail map' }
	];
	const selectLayer = (id: string) => (app.layer = id as LayerId);

	function radio<T>(label: string, current: T, value: T, set: (v: T) => void): MenuItem {
		return { label, radio: true, checked: current === value, action: () => set(value) };
	}
	const setMode = (mode: View['mode']) => (app.view.mode = mode);
	const setChannel = (channel: View['channel']) => (app.view.channel = channel);

	// Items needing image loading or GPU processing stay disabled until their phase lands.
	const menus: MenuDef[] = $derived([
		{
			label: '&File',
			items: [
				{ label: '&Open Base…', shortcut: 'Ctrl+O', disabled: true },
				{ label: 'Open &Detail…', disabled: true },
				'separator',
				{ label: '&Export…', shortcut: 'Ctrl+E', disabled: true },
				'separator',
				{ label: '&Close', disabled: true }
			]
		},
		{
			label: '&Edit',
			items: [
				{ label: '&Undo', shortcut: 'Ctrl+Z', disabled: true },
				{ label: '&Redo', shortcut: 'Ctrl+Y', disabled: true },
				'separator',
				{ label: 'Reset &Settings', action: () => app.resetSettings() }
			]
		},
		{
			label: '&View',
			items: [
				radio('&Lit', app.view.mode, 'lit', setMode),
				radio('&Raw', app.view.mode, 'raw', setMode),
				radio('&Wipe', app.view.mode, 'wipe', setMode),
				'separator',
				{
					label: '&Channel',
					submenu: [
						radio('&RGB', app.view.channel, 'rgb', setChannel),
						radio('R&ed', app.view.channel, 'r', setChannel),
						radio('&Green', app.view.channel, 'g', setChannel),
						radio('&Blue', app.view.channel, 'b', setChannel),
						radio('&Alpha', app.view.channel, 'a', setChannel)
					]
				},
				{
					label: '&Tile 3×3',
					checked: app.view.tile3x3,
					action: () => (app.view.tile3x3 = !app.view.tile3x3)
				},
				'separator',
				{
					label: '&Zoom',
					submenu: [
						{ label: 'Zoom &In', shortcut: 'Ctrl++', action: () => app.zoomIn() },
						{ label: 'Zoom &Out', shortcut: 'Ctrl+-', action: () => app.zoomOut() },
						'separator',
						{ label: '&Fit', shortcut: 'Ctrl+0', action: () => app.zoomFit() },
						{ label: '&Actual Size', action: () => app.zoomActual() }
					]
				}
			]
		},
		{
			label: '&Tools',
			items: [
				{ label: 'Flip &Green (OpenGL ↔ DirectX)', shortcut: 'Ctrl+G', disabled: true },
				{ label: '&Renormalize', disabled: true }
			]
		},
		{
			label: '&Help',
			items: [{ label: '&About AGR Normal Map Editor…', action: () => (aboutOpen = true) }]
		}
	]);

	const properties: Property[] = $derived.by(() => {
		const s = app.settings;
		const v = app.view;
		const convention = (label: string, value: Convention, set: (c: Convention) => void): Property => ({
			kind: 'select',
			label,
			value,
			options: conventions,
			set: (c) => set(c as Convention)
		});
		switch (app.layer) {
			case 'output':
				return [
					{ kind: 'category', label: 'Export' },
					convention('Convention', s.output.convention, (c) => (s.output.convention = c)),
					{
						kind: 'select',
						label: 'Format',
						value: s.output.format,
						options: [
							{ value: 'png', label: 'PNG' },
							{ value: 'tga', label: 'TGA' }
						],
						set: (f) => (s.output.format = f === 'tga' ? 'tga' : 'png')
					},
					{
						kind: 'select',
						label: 'Bit depth',
						value: String(s.output.bitDepth),
						options: [
							{ value: '8', label: '8-bit' },
							{ value: '16', label: '16-bit' }
						],
						set: (d) => (s.output.bitDepth = d === '8' ? 8 : 16)
					},
					{ kind: 'category', label: 'Lighting' },
					{
						kind: 'number',
						label: 'Light azimuth',
						value: v.light.azimuth,
						min: 0,
						max: 360,
						step: 5,
						set: (a) => (v.light.azimuth = a)
					},
					{
						kind: 'number',
						label: 'Light elevation',
						value: v.light.elevation,
						min: 0,
						max: 90,
						step: 5,
						set: (e) => (v.light.elevation = e)
					}
				];
			case 'base':
				return [
					{ kind: 'category', label: 'File' },
					{ kind: 'text', label: 'Name', value: '(none)' },
					{ kind: 'text', label: 'Size', value: '—' },
					{ kind: 'text', label: 'Bit depth', value: '—' },
					{ kind: 'text', label: 'Channels', value: '—' },
					{ kind: 'category', label: 'Settings' },
					convention('Convention', s.base.convention, (c) => (s.base.convention = c)),
					{
						kind: 'number',
						label: 'Strength',
						value: s.base.strength,
						min: 0,
						max: 10,
						step: 0.05,
						decimals: 2,
						set: (x) => (s.base.strength = x)
					}
				];
			case 'detail':
				return [
					{ kind: 'category', label: 'File' },
					{ kind: 'text', label: 'Name', value: '(none)' }
				];
		}
	});

	const status: StatusSegment[] = $derived([
		{ text: 'No image', width: 140 },
		{ text: '—', width: 90 },
		{ text: `${Math.round(app.view.zoom * 100)}%`, width: 50 },
		{ text: gpuText, grow: true },
		{ text: '', width: 60 }
	]);
</script>

{#snippet viewer()}
	<Pane title="Viewer">
		<div class="viewer">No image loaded</div>
	</Pane>
{/snippet}

{#snippet pixelInfo()}
	<Pane title="Pixel Info">
		<table class="pixel-info">
			<tbody>
				<tr><th>Position</th><td>—</td></tr>
				<tr><th>RGBA</th><td>—</td></tr>
				<tr><th>Vector</th><td>—</td></tr>
			</tbody>
		</table>
	</Pane>
{/snippet}

{#snippet propertiesPane()}
	<Pane title="Properties">
		<PropertyGrid {properties} label="Properties" />
	</Pane>
{/snippet}

<MenuBar {menus} />

<Toolbar label="Standard">
	<ToolButton icon="open" label="Open Base Map (Ctrl+O)" disabled />
	<ToolButton icon="save" label="Export (Ctrl+E)" disabled />
	<ToolSeparator />
	<ToolButton icon="flipGreen" label="Flip Green (Ctrl+G)" disabled />
	<ToolSeparator />
	<ToolButton icon="pan" label="Pan" pressed={app.view.tool === 'pan'} onclick={() => (app.view.tool = 'pan')} />
	<ToolButton icon="light" label="Light Direction" pressed={false} disabled />
	<ToolSeparator />
	<ToolButton icon="zoomOut" label="Zoom Out (Ctrl+-)" onclick={() => app.zoomOut()} />
	<ToolButton icon="zoomIn" label="Zoom In (Ctrl++)" onclick={() => app.zoomIn()} />
	<ToolButton icon="zoomFit" label="Fit (Ctrl+0)" onclick={() => app.zoomFit()} />
	<ToolSeparator />
	<span class="tb-label" class:disabled={app.view.mode !== 'wipe'}>Lit</span>
	<Trackbar bind:value={app.view.wipe} label="Wipe position" width={110} disabled={app.view.mode !== 'wipe'} />
	<span class="tb-label" class:disabled={app.view.mode !== 'wipe'}>Raw</span>
</Toolbar>

{#if narrow.current}
	<div class="stack">
		<div class="stack-viewer">{@render viewer()}</div>
		<div class="stack-info">{@render pixelInfo()}</div>
		<div class="layer-pick">
			<label for="layer-pick">Layer:</label>
			<Select id="layer-pick" options={layerOptions} value={app.layer} onchange={selectLayer} width={160} />
		</div>
		<div class="stack-props">{@render propertiesPane()}</div>
	</div>
{:else}
	<div class="workspace" style:grid-template-columns="min({sideWidth}px, calc(100% - 204px)) 4px minmax(0, 1fr)">
		<div class="column" style:grid-template-rows="min({layersHeight}px, calc(100% - 84px)) 4px minmax(0, 1fr)">
			<Pane title="Layers">
				<TreeView nodes={layers} selected={app.layer} onselect={selectLayer} label="Layers" />
			</Pane>
			<Splitter orientation="horizontal" bind:size={layersHeight} min={60} reserve={80} label="Resize Layers pane" />
			{@render propertiesPane()}
		</div>
		<Splitter bind:size={sideWidth} min={160} max={600} reserve={200} label="Resize side panes" />
		<div class="column" style:grid-template-rows="minmax(0, 1fr) 4px min({infoHeight}px, calc(100% - 104px))">
			{@render viewer()}
			<Splitter orientation="horizontal" bind:size={infoHeight} after min={40} label="Resize Pixel Info pane" />
			{@render pixelInfo()}
		</div>
	</div>
{/if}

<StatusBar segments={status} />

<Dialog bind:open={aboutOpen} title="About AGR Normal Map Editor" width={340}>
	<div class="about">
		<Icon name="normalMap" size={32} />
		<div>
			<p><b>AGR Normal Map Editor</b><br />Version 0.1</p>
			<p>Adjusts, converts and blends normal maps on your GPU. Everything runs in your browser; images never leave
				your computer.</p>
			<hr class="w2k-etched" />
			<p>&copy; 2026 AGR Holdings LLC</p>
		</div>
	</div>
	{#snippet buttons()}
		<Button default onclick={() => (aboutOpen = false)}>OK</Button>
	{/snippet}
</Dialog>

<MessageBox
	open={gpuProblem?.state === 'failed'}
	title="AGR Normal Map Editor"
	icon="error"
	onclose={dismissGpuProblem}
>
	{#if gpuProblem?.state === 'failed'}<p>{gpuProblem.failure.message}</p>{/if}
	<p>The rest of the AGR site works in any browser.</p>
	{#snippet buttons()}
		<Button default onclick={dismissGpuProblem}>OK</Button>
	{/snippet}
</MessageBox>

<MessageBox
	open={gpuProblem?.state === 'lost'}
	title="AGR Normal Map Editor"
	icon="warning"
	onclose={dismissGpuProblem}
>
	<p>The graphics device was lost. This can happen when the GPU driver is updated, crashes or is reset.</p>
	{#if gpuProblem?.state === 'lost'}<p class="detail">{gpuProblem.message}</p>{/if}
	<p>Reinitialize the GPU to continue.</p>
	{#snippet buttons()}
		<Button
			default
			onclick={() => {
				dismissGpuProblem();
				app.startGpu();
			}}>Reinitialize</Button
		>
		<Button onclick={dismissGpuProblem}>Close</Button>
	{/snippet}
</MessageBox>

<style>
	.tb-label {
		padding: 0 4px;
	}
	.tb-label.disabled {
		color: var(--shadow);
		text-shadow: 1px 1px var(--hilite);
	}

	.workspace {
		display: grid;
		flex: 1;
		min-height: 0;
		padding: 2px 2px 0;
	}
	.column {
		display: grid;
		min-width: 0;
		min-height: 0;
	}

	.viewer {
		display: grid;
		place-items: center;
		height: 100%;
		background: var(--workspace);
		color: var(--face);
	}

	.pixel-info {
		border-collapse: collapse;
		font-family: var(--mono);
		font-size: 12px;
	}
	.pixel-info th {
		padding: 1px 12px 1px 4px;
		font-weight: normal;
		text-align: left;
	}

	/* Narrow screens: one scrolling column, viewer first. */
	.stack {
		display: flex;
		flex: 1;
		flex-direction: column;
		gap: 4px;
		min-height: 0;
		padding: 2px;
		overflow-y: auto;
	}
	.stack-viewer {
		flex: none;
		height: max(240px, 50vh);
	}
	.stack-info {
		flex: none;
		height: 84px;
	}
	.layer-pick {
		display: flex;
		align-items: center;
		gap: 6px;
		padding: 2px;
	}
	.stack-props {
		flex: none;
		height: 260px;
	}

	.about {
		display: flex;
		gap: 14px;
	}
	.about p {
		margin: 0 0 8px;
	}
	.detail {
		color: var(--gray-text);
	}
</style>
