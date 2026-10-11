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
	import DiagnosticsDialog from './DiagnosticsDialog.svelte';
	import ExportDialog from './ExportDialog.svelte';
	import { BLEND_METHOD_NAMES, BLEND_METHODS } from './normalmap';
	import Viewer from './Viewer.svelte';
	import {
		MAX_SHININESS,
		NormalMapState,
		type BlendMethod,
		type Convention,
		type LayerId,
		type SourceImage,
		type View
	} from './state.svelte';

	const app = new NormalMapState();
	const narrow = new MediaQuery('(max-width: 899px)', false);

	let fileInput: HTMLInputElement;
	/** Which map the file picker is choosing. */
	let fileTarget: 'base' | 'detail' = 'base';
	let exportOpen = $state(false);
	let diagnosticsOpen = $state(false);
	/** A file dropped while a base map is open, waiting for the user to say which map it is. */
	let droppedFile = $state.raw<File | null>(null);

	const hasImage = $derived(app.base !== null);
	const canOpen = $derived(app.renderer !== null && app.busy === null);
	const canOpenDetail = $derived(canOpen && hasImage);
	const canExport = $derived(hasImage && app.renderer !== null && app.busy === null);
	/** Flip G is on when the output convention differs from the input's. */
	const flipping = $derived(app.settings.output.convention !== app.settings.base.convention);

	function chooseFile(target: 'base' | 'detail') {
		if (!(target === 'base' ? canOpen : canOpenDetail)) return;
		fileTarget = target;
		fileInput.click();
	}

	function onFileChosen() {
		const file = fileInput.files?.[0];
		fileInput.value = ''; // so choosing the same file again still fires
		if (file) openAs(file, fileTarget);
	}

	function openAs(file: File, target: 'base' | 'detail') {
		droppedFile = null;
		if (target === 'detail') app.openDetail(file);
		else app.open(file);
	}

	const CHANNELS = { 1: 'Gray', 2: 'Gray + alpha', 3: 'RGB', 4: 'RGBA' } as const;

	function formatBytes(n: number) {
		if (n < 1024) return `${n} bytes`;
		if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
		return `${(n / 1024 / 1024).toFixed(1)} MB`;
	}

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

	const layers: TreeNode[] = $derived([
		{
			id: 'output',
			label: 'Output',
			icon: 'output',
			children: [
				{ id: 'base', label: 'Base map', icon: 'baseMap', note: app.base?.name ?? '[none]' },
				{ id: 'detail', label: 'Detail map', icon: 'detailMap', note: app.detail?.name ?? '[none]' }
			]
		}
	]);
	const blendMethods: SelectOption[] = BLEND_METHODS.map((m) => ({ value: m, label: BLEND_METHOD_NAMES[m] }));
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

	// Items whose feature lands in a later phase stay disabled.
	const menus: MenuDef[] = $derived([
		{
			label: '&File',
			items: [
				{ label: '&Open Base…', shortcut: 'Ctrl+O', disabled: !canOpen, action: () => chooseFile('base') },
				{
					label: 'Open &Detail…',
					shortcut: 'Ctrl+Shift+O',
					disabled: !canOpenDetail,
					action: () => chooseFile('detail')
				},
				'separator',
				{ label: '&Export…', shortcut: 'Ctrl+E', disabled: !canExport, action: () => (exportOpen = true) },
				'separator',
				{ label: 'Close De&tail', disabled: !app.detail, action: () => app.closeDetail() },
				{ label: '&Close', disabled: !hasImage, action: () => app.close() }
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
						{ label: 'Zoom &In', shortcut: 'Ctrl++', disabled: !hasImage, action: () => app.zoomIn() },
						{ label: 'Zoom &Out', shortcut: 'Ctrl+-', disabled: !hasImage, action: () => app.zoomOut() },
						'separator',
						{ label: '&Fit', shortcut: 'Ctrl+0', disabled: !hasImage, action: () => app.zoomFit() },
						{ label: '&Actual Size', disabled: !hasImage, action: () => app.zoomActual() }
					]
				}
			]
		},
		{
			label: '&Tools',
			items: [
				{
					label: 'Flip &Green (OpenGL ↔ DirectX)',
					shortcut: 'Ctrl+G',
					checked: flipping,
					disabled: !hasImage,
					action: () => app.flipGreen()
				},
				{ label: '&Renormalize', disabled: true }
			]
		},
		{
			label: '&Help',
			items: [
				{ label: 'Run &Diagnostics…', action: () => (diagnosticsOpen = true) },
				'separator',
				{ label: '&About AGR Normal Map Editor…', action: () => (aboutOpen = true) }
			]
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
		const strength = (value: number, set: (x: number) => void): Property => ({
			kind: 'slider',
			label: 'Strength',
			value,
			min: 0,
			max: 5,
			step: 0.05,
			decimals: 2,
			set
		});
		const fileRows = (f: SourceImage | null): Property[] => [
			{ kind: 'category', label: 'File' },
			{ kind: 'text', label: 'Name', value: f?.name ?? '(none)' },
			{ kind: 'text', label: 'Format', value: f ? f.format.toUpperCase() : '—' },
			{ kind: 'text', label: 'File size', value: f ? formatBytes(f.fileBytes) : '—' },
			{ kind: 'text', label: 'Size', value: f ? `${f.image.width} × ${f.image.height}` : '—' },
			{ kind: 'text', label: 'Bit depth', value: f ? `${f.image.bitDepth}-bit` : '—' },
			{ kind: 'text', label: 'Channels', value: f ? CHANNELS[f.image.channels] : '—' }
		];
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
						value: String(app.exportBitDepth),
						options: [
							{ value: '8', label: '8-bit' },
							{ value: '16', label: '16-bit' }
						],
						disabled: s.output.format === 'tga',
						set: (d) => (s.output.bitDepth = d === '8' ? 8 : 16)
					},
					{ kind: 'category', label: 'Lighting' },
					{
						kind: 'slider',
						label: 'Light azimuth',
						value: v.light.azimuth,
						min: 0,
						max: 360,
						step: 1,
						unit: '°',
						set: (a) => (v.light.azimuth = a)
					},
					{
						kind: 'slider',
						label: 'Light elevation',
						value: v.light.elevation,
						min: 0,
						max: 90,
						step: 1,
						unit: '°',
						set: (e) => (v.light.elevation = e)
					},
					{
						kind: 'checkbox',
						label: 'Specular',
						value: v.light.specular,
						set: (on) => (v.light.specular = on)
					},
					{
						kind: 'slider',
						label: 'Shininess',
						value: v.light.shininess,
						min: 1,
						max: MAX_SHININESS,
						step: 1,
						disabled: !v.light.specular,
						set: (x) => (v.light.shininess = x)
					}
				];
			case 'base':
				return [
					...fileRows(app.base),
					{ kind: 'category', label: 'Settings' },
					convention('Convention', s.base.convention, (c) => (s.base.convention = c)),
					strength(s.base.strength, (x) => (s.base.strength = x))
				];
			case 'detail': {
				const d = s.detail;
				if (!d) return fileRows(null);
				// Tiling: repeats across the base. Offset: in detail UV units, so 0..1 covers every position.
				const placement = (label: string, values: [number, number], axis: 0 | 1): Property => {
					const tiling = values === d.tiling;
					return {
						kind: 'number',
						label,
						value: values[axis],
						min: tiling ? 0.01 : 0,
						max: tiling ? 64 : 1,
						step: tiling ? 1 : 0.01,
						decimals: tiling ? 2 : 3,
						set: (x) => (values[axis] = x)
					};
				};
				return [
					...fileRows(app.detail),
					{ kind: 'category', label: 'Settings' },
					convention('Convention', d.convention, (c) => (d.convention = c)),
					{
						kind: 'select',
						label: 'Blend method',
						value: d.method,
						options: blendMethods,
						set: (m) => (d.method = m as BlendMethod)
					},
					strength(d.strength, (x) => (d.strength = x)),
					{ kind: 'category', label: 'Placement' },
					placement('Tiling X', d.tiling, 0),
					placement('Tiling Y', d.tiling, 1),
					placement('Offset X', d.offset, 0),
					placement('Offset Y', d.offset, 1)
				];
			}
		}
	});

	const status: StatusSegment[] = $derived.by(() => {
		const b = app.base;
		return [
			{ text: app.busy ?? (b ? `${b.image.width}×${b.image.height}` : 'No image'), width: 140 },
			{ text: b ? `${b.image.bitDepth}-bit ${b.format.toUpperCase()}` : '—', width: 90 },
			{ text: b ? `${Math.round(app.view.zoom * 100)}%` : '—', width: 50 },
			{ text: gpuText, grow: true },
			{ text: b && app.processMs !== null ? `${app.processMs.toFixed(1)} ms` : '', width: 60 }
		];
	});
</script>

<svelte:window
	ondragover={(e) => {
		if (!e.dataTransfer?.types.includes('Files')) return;
		e.preventDefault();
		e.dataTransfer.dropEffect = canOpen ? 'copy' : 'none';
	}}
	ondrop={(e) => {
		const file = e.dataTransfer?.files[0];
		if (!file) return;
		e.preventDefault();
		if (!canOpen) return;
		if (hasImage) droppedFile = file;
		else app.open(file);
	}}
/>

<input bind:this={fileInput} type="file" accept=".png,.tga,image/png" hidden onchange={onFileChosen} />

{#snippet viewer()}
	<Pane title="Viewer">
		<Viewer {app} />
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
	<ToolButton icon="open" label="Open Base Map (Ctrl+O)" disabled={!canOpen} onclick={() => chooseFile('base')} />
	<ToolButton
		icon="detailMap"
		label="Open Detail Map (Ctrl+Shift+O)"
		disabled={!canOpenDetail}
		onclick={() => chooseFile('detail')}
	/>
	<ToolButton icon="save" label="Export (Ctrl+E)" disabled={!canExport} onclick={() => (exportOpen = true)} />
	<ToolSeparator />
	<ToolButton
		icon="flipGreen"
		label="Flip Green (Ctrl+G)"
		pressed={flipping}
		disabled={!hasImage}
		onclick={() => app.flipGreen()}
	/>
	<ToolSeparator />
	<ToolButton icon="pan" label="Pan" pressed={app.view.tool === 'pan'} onclick={() => (app.view.tool = 'pan')} />
	<ToolButton
		icon="light"
		label="Light Direction"
		pressed={app.view.tool === 'light'}
		onclick={() => (app.view.tool = 'light')}
	/>
	<ToolSeparator />
	<ToolButton icon="zoomOut" label="Zoom Out (Ctrl+-)" disabled={!hasImage} onclick={() => app.zoomOut()} />
	<ToolButton icon="zoomIn" label="Zoom In (Ctrl++)" disabled={!hasImage} onclick={() => app.zoomIn()} />
	<ToolButton icon="zoomFit" label="Fit (Ctrl+0)" disabled={!hasImage} onclick={() => app.zoomFit()} />
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
			<p>Adjusts, converts and blends normal maps on your GPU. Everything runs in your browser and images never leave
				your computer.</p>
			<hr class="w2k-etched" />
			<p>&copy; 2026 AGR Holdings LLC</p>
		</div>
	</div>
	{#snippet buttons()}
		<Button default onclick={() => (aboutOpen = false)}>OK</Button>
	{/snippet}
</Dialog>

<ExportDialog {app} bind:open={exportOpen} />

<DiagnosticsDialog bind:open={diagnosticsOpen} />

<MessageBox
	open={droppedFile !== null}
	title="AGR Normal Map Editor"
	icon="question"
	onclose={() => (droppedFile = null)}
>
	<p>Open {droppedFile?.name} as:</p>
	{#snippet buttons()}
		{#if droppedFile}
			{@const file = droppedFile}
			<Button default onclick={() => openAs(file, 'base')}>Base Map</Button>
			<Button onclick={() => openAs(file, 'detail')}>Detail Map</Button>
		{/if}
		<Button onclick={() => (droppedFile = null)}>Cancel</Button>
	{/snippet}
</MessageBox>

<MessageBox open={app.error !== null} title="AGR Normal Map Editor" icon="error" onclose={() => (app.error = null)}>
	<p>{app.error}</p>
	{#snippet buttons()}
		<Button default onclick={() => (app.error = null)}>OK</Button>
	{/snippet}
</MessageBox>

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
