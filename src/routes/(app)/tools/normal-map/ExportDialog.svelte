<!-- Export: file name, format and bit depth (shared with the Output properties), TGA compression. -->
<script lang="ts">
	import { untrack } from 'svelte';
	import { Button, Checkbox, Dialog, Select, TextField } from '$lib/ui/win2k';
	import type { NormalMapState } from './state.svelte';

	let { app, open = $bindable(false) }: { app: NormalMapState; open?: boolean } = $props();

	const uid = $props.id();
	let name = $state('');
	let tgaRle = $state(false);

	const out = $derived(app.settings.output);
	const losesPrecision = $derived(out.format === 'tga' && app.base?.image.bitDepth === 16);

	const withExtension = (file: string, ext: string) => `${file.replace(/\.(png|tga)$/i, '')}.${ext}`;

	// Each time the dialog opens, suggest the source name with the export format's extension.
	$effect(() => {
		if (open) untrack(() => (name = withExtension(app.base?.name ?? 'normal', out.format)));
	});

	function setFormat(format: string) {
		out.format = format === 'tga' ? 'tga' : 'png';
		name = withExtension(name, out.format);
		app.commit('Output Format');
	}

	function submit(e: SubmitEvent) {
		e.preventDefault();
		const file = withExtension(name.trim() || 'normal', out.format);
		open = false;
		app.exportImage(file, { tgaRle: out.format === 'tga' && tgaRle });
	}
</script>

<Dialog bind:open title="Export" width={360}>
	<form id="{uid}-form" class="fields" onsubmit={submit}>
		<label for="{uid}-name">File name:</label>
		<TextField id="{uid}-name" bind:value={name} spellcheck="false" autocomplete="off" />

		<label for="{uid}-format">Format:</label>
		<Select
			id="{uid}-format"
			value={out.format}
			options={[
				{ value: 'png', label: 'PNG' },
				{ value: 'tga', label: 'TGA' }
			]}
			onchange={setFormat}
		/>

		<label for="{uid}-depth">Bit depth:</label>
		<Select
			id="{uid}-depth"
			value={String(app.exportBitDepth)}
			options={[
				{ value: '8', label: '8 bits per channel' },
				{ value: '16', label: '16 bits per channel' }
			]}
			disabled={out.format === 'tga'}
			onchange={(d) => {
				out.bitDepth = d === '8' ? 8 : 16;
				app.commit('Output Bit depth');
			}}
			width={160}
		/>

		{#if out.format === 'tga'}
			<span></span>
			<Checkbox bind:checked={tgaRle}>RLE compression</Checkbox>
		{/if}
	</form>
	{#if losesPrecision}
		<p class="warning">TGA stores 8 bits per channel, so this 16-bit map loses precision. Use PNG to keep all 16 bits.</p>
	{/if}
	{#snippet buttons()}
		<Button default type="submit" form="{uid}-form">Export</Button>
		<Button onclick={() => (open = false)}>Cancel</Button>
	{/snippet}
</Dialog>

<style>
	.fields {
		display: grid;
		grid-template-columns: auto 1fr;
		align-items: center;
		gap: 8px 10px;
	}
	.fields :global(.w2k-textfield) {
		width: 100%;
	}
	.warning {
		margin: 12px 0 0;
		padding: 6px 8px;
		background: var(--window);
		box-shadow: var(--sunken-thin);
	}
</style>
