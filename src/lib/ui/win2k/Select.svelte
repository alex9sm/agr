<!--
	Drop-down list. Closed: arrows change the value directly, Alt+Down or F4 opens.
	The list is a popover, so it shows above dialogs and isn't clipped by scrolling panes.
-->
<script lang="ts">
	import Glyph from './icons/Glyph.svelte';
	import type { SelectOption } from './types';

	interface Props {
		value?: string;
		options: readonly SelectOption[];
		disabled?: boolean;
		/** Borderless, fills its container (property grid cells). */
		compact?: boolean;
		id?: string;
		label?: string;
		width?: number;
		onchange?: (value: string) => void;
	}
	let {
		value = $bindable(''),
		options,
		disabled = false,
		compact = false,
		id,
		label,
		width,
		onchange
	}: Props = $props();

	const uid = $props.id();
	let open = $state(false);
	let highlight = $state(-1);
	let field: HTMLElement;
	let list: HTMLElement;

	const selected = $derived(options.findIndex((o) => o.value === value));

	function choose(i: number) {
		close();
		const option = options[i];
		if (!option || option.value === value) return;
		value = option.value;
		onchange?.(option.value);
	}

	function show() {
		if (open || disabled) return;
		open = true;
		highlight = selected;
		list.showPopover();
		const r = field.getBoundingClientRect();
		list.style.minWidth = `${r.width}px`;
		list.style.left = `${Math.min(r.left, innerWidth - list.offsetWidth)}px`;
		list.style.top = `${r.bottom + list.offsetHeight > innerHeight ? r.top - list.offsetHeight : r.bottom}px`;
	}

	function close() {
		if (!open) return;
		open = false;
		list.hidePopover();
	}

	/** Next option whose label starts with the typed letter, cycling. */
	function typeahead(key: string, from: number) {
		const n = options.length;
		for (let k = 1; k <= n; k++) {
			const i = (from + k) % n;
			if (options[i].label.toLowerCase().startsWith(key.toLowerCase())) return i;
		}
		return -1;
	}

	function onkeydown(e: KeyboardEvent) {
		const last = options.length - 1;
		const toggle = e.key === 'F4' || (e.altKey && (e.key === 'ArrowDown' || e.key === 'ArrowUp'));
		if (open) {
			if (toggle) close();
			else if (e.key === 'ArrowDown') highlight = Math.min(highlight + 1, last);
			else if (e.key === 'ArrowUp') highlight = Math.max(highlight - 1, 0);
			else if (e.key === 'Home') highlight = 0;
			else if (e.key === 'End') highlight = last;
			else if (e.key === 'Enter' || e.key === ' ') choose(highlight);
			else if (e.key === 'Escape') close();
			else if (e.key === 'Tab') return close();
			else if (e.key.length === 1 && typeahead(e.key, highlight) >= 0) highlight = typeahead(e.key, highlight);
			else return;
		} else {
			if (toggle || e.key === 'Enter' || e.key === ' ') show();
			else if (e.key === 'ArrowDown' || e.key === 'ArrowRight') choose(Math.min(selected + 1, last));
			else if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') choose(Math.max(selected - 1, 0));
			else if (e.key === 'Home') choose(0);
			else if (e.key === 'End') choose(last);
			else if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && typeahead(e.key, selected) >= 0)
				choose(typeahead(e.key, selected));
			else return;
		}
		e.preventDefault();
		e.stopPropagation();
	}

	// While open: close on outside press, outside scroll, or resize.
	$effect(() => {
		if (!open) return;
		const outside = (e: Event) => {
			const t = e.target as Node;
			if (!field.contains(t) && !list.contains(t)) close();
		};
		addEventListener('pointerdown', outside, true);
		addEventListener('scroll', outside, true);
		addEventListener('resize', close);
		return () => {
			removeEventListener('pointerdown', outside, true);
			removeEventListener('scroll', outside, true);
			removeEventListener('resize', close);
		};
	});
</script>

<span
	bind:this={field}
	class="w2k-select"
	class:compact
	class:disabled
	class:open
	style:width={width ? `${width}px` : undefined}
>
	<button
		{id}
		type="button"
		role="combobox"
		aria-label={label}
		aria-haspopup="listbox"
		aria-expanded={open}
		aria-controls="{uid}-list"
		aria-activedescendant={open && highlight >= 0 ? `${uid}-${highlight}` : undefined}
		{disabled}
		onpointerdown={(e) => {
			if (e.button !== 0) return;
			if (open) close();
			else show();
		}}
		{onkeydown}
		onblur={close}
	>
		<span class="value">{options[selected]?.label ?? ''}</span>
		<span class="arrow"><Glyph name="down" /></span>
	</button>
	<ul bind:this={list} id="{uid}-list" class="list" role="listbox" aria-label={label} popover="manual">
		{#each options as option, i (option.value)}
			<!-- svelte-ignore a11y_click_events_have_key_events (keyboard is handled by the combobox button) -->
			<li
				id="{uid}-{i}"
				role="option"
				aria-selected={i === selected}
				class:hl={i === highlight}
				onpointerdown={(e) => e.preventDefault()}
				onpointerenter={() => (highlight = i)}
				onclick={() => choose(i)}
			>
				{option.label}
			</li>
		{/each}
	</ul>
</span>

<style>
	.w2k-select {
		display: inline-flex;
		width: 120px;
		height: 21px;
		padding: 2px;
		background: var(--window);
		box-shadow: var(--sunken);
	}
	button {
		display: flex;
		flex: 1;
		align-items: stretch;
		min-width: 0;
		padding: 0;
		border: 0;
		background: none;
		text-align: left;
		outline: none;
	}
	.value {
		flex: 1;
		min-width: 0;
		margin: 1px;
		padding: 0 2px;
		overflow: hidden;
		line-height: 13px;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	button:focus .value {
		background: var(--select);
		color: var(--select-text);
		outline: 1px dotted var(--title-b);
		outline-offset: -1px;
	}
	.arrow {
		display: grid;
		flex: none;
		place-items: center;
		width: 16px;
		background: var(--face);
		box-shadow: var(--raised-window);
	}
	.open .arrow {
		box-shadow: inset 0 0 0 1px var(--shadow);
	}
	.open .arrow :global(.w2k-glyph) {
		translate: 1px 1px;
	}

	.compact {
		width: 100%;
		height: 100%;
		padding: 0;
		box-shadow: none;
	}
	.compact .value {
		margin: 1px 1px 1px 0;
		padding: 0 2px;
	}
	.compact .arrow {
		width: 15px;
	}

	.disabled {
		background: var(--face);
	}
	.disabled .value {
		color: var(--shadow);
		text-shadow: 1px 1px var(--hilite);
	}
	.disabled .arrow {
		color: var(--shadow);
	}
	.disabled .arrow :global(.w2k-glyph) {
		filter: drop-shadow(1px 1px 0 var(--hilite));
	}

	.list {
		inset: auto;
		max-height: 240px;
		margin: 0;
		padding: 0;
		overflow-y: auto;
		border: 1px solid #000;
		background: var(--window);
		color: var(--text);
		list-style: none;
		font: 11px/1.25 var(--font);
	}
	li {
		padding: 1px 3px;
		white-space: nowrap;
		cursor: default;
	}
	li.hl {
		background: var(--select);
		color: var(--select-text);
	}
</style>
