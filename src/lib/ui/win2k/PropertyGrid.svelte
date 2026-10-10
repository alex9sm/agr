<!-- Two-column property / value grid with category rows and in-place editors. -->
<script lang="ts">
	import Checkbox from './Checkbox.svelte';
	import NumberField from './NumberField.svelte';
	import Select from './Select.svelte';
	import type { Property } from './types';

	let { properties, label }: { properties: Property[]; label: string } = $props();

	const uid = $props.id();
</script>

<div class="w2k-propgrid">
	<table aria-label={label}>
		<colgroup>
			<col class="name" />
			<col />
		</colgroup>
		<thead>
			<tr>
				<th scope="col">Property</th>
				<th scope="col">Value</th>
			</tr>
		</thead>
		<tbody>
			{#each properties as p, i (i)}
				{#if p.kind === 'category'}
					<tr class="category"><th colspan="2" scope="colgroup">{p.label}</th></tr>
				{:else}
					{@const id = `${uid}-${i}`}
					<tr>
						<th scope="row"><label for={id}>{p.label}</label></th>
						<td>
							{#if p.kind === 'text'}
								<output {id}>{p.value}</output>
							{:else if p.kind === 'number'}
								<NumberField
									{id}
									compact
									value={p.value}
									min={p.min}
									max={p.max}
									step={p.step}
									decimals={p.decimals}
									disabled={p.disabled}
									onchange={p.set}
								/>
							{:else if p.kind === 'select'}
								<Select {id} compact value={p.value} options={p.options} disabled={p.disabled} onchange={p.set} />
							{:else}
								<Checkbox {id} checked={p.value} disabled={p.disabled} onchange={p.set} />
							{/if}
						</td>
					</tr>
				{/if}
			{/each}
		</tbody>
	</table>
</div>

<style>
	.w2k-propgrid {
		min-height: 100%;
		background: var(--window);
	}
	table {
		width: 100%;
		border-collapse: collapse;
		table-layout: fixed;
	}
	col.name {
		width: 45%;
	}
	thead th {
		position: sticky;
		z-index: 1;
		top: 0;
		height: 18px;
		padding: 0 6px;
		background: var(--face);
		box-shadow: var(--header);
		font-weight: normal;
		text-align: left;
	}
	tbody th,
	tbody td {
		height: 18px;
		padding: 0;
		border: 1px solid var(--face);
	}
	tbody th {
		overflow: hidden;
		padding: 0 4px;
		font-weight: normal;
		text-align: left;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	tbody tr:focus-within th {
		background: var(--select);
		color: var(--select-text);
	}
	tbody td > :global(.w2k-checkbox) {
		padding-left: 3px;
	}
	.category th {
		padding: 0 4px;
		background: var(--face);
		color: var(--text);
		font-weight: bold;
	}
	output {
		display: block;
		padding: 0 3px;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		user-select: text;
	}
</style>
