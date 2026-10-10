<!--
	Tree with dotted connector lines and +/− expanders. Selection follows focus:
	Up/Down move, Right expands or steps in, Left collapses or steps out, Home/End jump.
-->
<script lang="ts">
	import { tick } from 'svelte';
	import { SvelteSet } from 'svelte/reactivity';
	import Icon from './icons/Icon.svelte';
	import type { TreeNode } from './types';

	interface Props {
		nodes: TreeNode[];
		selected: string;
		label: string;
		onselect?: (id: string) => void;
	}
	let { nodes, selected = $bindable(), label, onselect }: Props = $props();

	interface Row {
		node: TreeNode;
		level: number;
		parent: string | null;
		first: boolean;
		last: boolean;
		/** Per ancestor level: does a dotted line continue down through this row? */
		guides: boolean[];
		pos: number;
		size: number;
	}

	const uid = $props.id();
	const collapsed = new SvelteSet<string>();
	let focused = $state(false);

	const rows = $derived.by(() => {
		const out: Row[] = [];
		const walk = (list: TreeNode[], level: number, parent: string | null, guides: boolean[]) => {
			list.forEach((node, i) => {
				const last = i === list.length - 1;
				out.push({ node, level, parent, first: i === 0, last, guides, pos: i + 1, size: list.length });
				if (node.children?.length && !collapsed.has(node.id)) {
					walk(node.children, level + 1, node.id, [...guides, !last]);
				}
			});
		};
		walk(nodes, 1, null, []);
		return out;
	});

	const index = $derived(rows.findIndex((r) => r.node.id === selected));
	const rowId = (id: string) => `${uid}-${id}`;
	const hasChildren = (node: TreeNode) => !!node.children?.length;
	const contains = (node: TreeNode, id: string): boolean =>
		!!node.children?.some((c) => c.id === id || contains(c, id));

	function select(id: string) {
		if (id === selected) return;
		selected = id;
		onselect?.(id);
		tick().then(() => document.getElementById(rowId(id))?.scrollIntoView({ block: 'nearest' }));
	}

	function setOpen(node: TreeNode, open: boolean) {
		if (!hasChildren(node)) return;
		if (open) collapsed.delete(node.id);
		else {
			collapsed.add(node.id);
			if (contains(node, selected)) select(node.id);
		}
	}

	function onkeydown(e: KeyboardEvent) {
		const row = rows[index];
		let next = index;
		switch (e.key) {
			case 'ArrowDown':
				next = Math.min(index + 1, rows.length - 1);
				break;
			case 'ArrowUp':
				next = Math.max(index - 1, 0);
				break;
			case 'Home':
				next = 0;
				break;
			case 'End':
				next = rows.length - 1;
				break;
			case 'ArrowRight':
				if (row && hasChildren(row.node)) {
					if (collapsed.has(row.node.id)) setOpen(row.node, true);
					else next = index + 1;
				}
				break;
			case 'ArrowLeft':
				if (row && hasChildren(row.node) && !collapsed.has(row.node.id)) setOpen(row.node, false);
				else if (row?.parent) next = rows.findIndex((r) => r.node.id === row.parent);
				break;
			case '+':
				if (row) setOpen(row.node, true);
				break;
			case '-':
				if (row) setOpen(row.node, false);
				break;
			default:
				return;
		}
		e.preventDefault();
		if (rows[next]) select(rows[next].node.id);
	}
</script>

<div
	class="w2k-tree"
	class:focused
	role="tree"
	aria-label={label}
	aria-activedescendant={index >= 0 ? rowId(selected) : undefined}
	tabindex="0"
	{onkeydown}
	onfocus={() => (focused = true)}
	onblur={() => (focused = false)}
>
	{#each rows as row (row.node.id)}
		{@const expandable = hasChildren(row.node)}
		{@const open = expandable && !collapsed.has(row.node.id)}
		<!-- svelte-ignore a11y_interactive_supports_focus (focus stays on the tree; aria-activedescendant points here) -->
		<div
			id={rowId(row.node.id)}
			class="row"
			role="treeitem"
			aria-level={row.level}
			aria-setsize={row.size}
			aria-posinset={row.pos}
			aria-selected={row.node.id === selected}
			aria-expanded={expandable ? open : undefined}
			onpointerdown={() => select(row.node.id)}
			ondblclick={() => setOpen(row.node, !open)}
		>
			{#each row.guides as line, i (i)}
				<span class="guide" class:line></span>
			{/each}
			<span class="joint" class:first-root={row.level === 1 && row.first} class:last={row.last}>
				{#if expandable}
					<!-- svelte-ignore a11y_no_static_element_interactions (mouse helper; keyboard uses Left/Right) -->
					<span
						class="expander"
						class:collapsed={!open}
						onpointerdown={(e) => {
							e.stopPropagation();
							setOpen(row.node, !open);
						}}
					></span>
				{/if}
			</span>
			{#if row.node.icon}<Icon name={row.node.icon} />{/if}
			<span class="label">{row.node.label}</span>
			{#if row.node.note}<span class="note">{row.node.note}</span>{/if}
		</div>
	{/each}
</div>

<style>
	.w2k-tree {
		min-height: 100%;
		padding: 2px 0;
		background: var(--window);
		outline: none;
	}
	.row {
		display: flex;
		align-items: center;
		width: max-content;
		min-width: 100%;
		height: 18px;
		padding-right: 4px;
		outline: none;
		white-space: nowrap;
		cursor: default;
	}

	/* Dotted connectors: one 19px column per level. */
	.guide,
	.joint {
		position: relative;
		flex: none;
		width: 19px;
		height: 18px;
	}
	.guide.line::before,
	.joint::before {
		content: '';
		position: absolute;
		top: 0;
		bottom: 0;
		left: 9px;
		width: 1px;
		background: repeating-linear-gradient(to bottom, var(--shadow) 0 1px, transparent 1px 2px);
	}
	.joint.first-root::before {
		top: 9px;
	}
	.joint.last::before {
		bottom: 9px;
	}
	.joint.first-root.last::before {
		display: none;
	}
	.joint::after {
		content: '';
		position: absolute;
		top: 9px;
		left: 10px;
		width: 8px;
		height: 1px;
		background: repeating-linear-gradient(to right, var(--shadow) 0 1px, transparent 1px 2px);
	}
	.expander {
		position: absolute;
		z-index: 1;
		top: 5px;
		left: 5px;
		width: 9px;
		height: 9px;
		border: 1px solid var(--shadow);
		background: linear-gradient(#000, #000) center / 5px 1px no-repeat var(--window);
	}
	.expander.collapsed {
		background:
			linear-gradient(#000, #000) center / 5px 1px no-repeat,
			linear-gradient(#000, #000) center / 1px 5px no-repeat,
			var(--window);
	}

	.row > :global(.w2k-icon) {
		margin-right: 3px;
	}
	.label {
		padding: 1px 2px;
		line-height: 14px;
	}
	.row[aria-selected='true'] .label {
		background: var(--face);
	}
	.focused .row[aria-selected='true'] .label {
		background: var(--select);
		color: var(--select-text);
		outline: 1px dotted var(--title-b);
		outline-offset: -1px;
	}
	.note {
		margin-left: 4px;
		color: var(--gray-text);
	}
</style>
