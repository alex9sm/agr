<!-- A dropdown menu; renders itself again for submenus. Focus follows the highlighted item. -->
<script lang="ts">
	import { onMount } from 'svelte';
	import Menu from './Menu.svelte';
	import Glyph from './icons/Glyph.svelte';
	import { accessKey, isItem, keyLetter, plainLabel, splitAccessKey, type CloseReason, type MenuEntry } from './menu';

	interface Props {
		items: MenuEntry[];
		label: string;
		/** Underline access keys. */
		mnemonics: boolean;
		/** Opened from the keyboard: highlight the first item. */
		keyboard?: boolean;
		submenu?: boolean;
		onclose: (reason: CloseReason) => void;
	}
	let { items, label, mnemonics, keyboard = false, submenu = false, onclose }: Props = $props();

	let active = $state(-1);
	let openSub = $state<number | null>(null);
	let subKeyboard = $state(false);
	let flip = $state(false);
	let shift = $state<[number, number]>([0, 0]);
	let root: HTMLUListElement;
	const els: HTMLElement[] = [];
	let hoverTimer: ReturnType<typeof setTimeout> | undefined;

	onMount(() => {
		// Keep the menu on screen: submenus flip to the left, top-level menus slide.
		const r = root.getBoundingClientRect();
		if (r.right > innerWidth) {
			if (submenu) flip = true;
			else shift[0] = Math.min(0, innerWidth - r.right);
		}
		if (r.bottom > innerHeight) shift[1] = Math.max(-r.top, innerHeight - r.bottom);
		active = keyboard ? step(-1, 1) : -1;
		return () => clearTimeout(hoverTimer);
	});

	$effect(() => {
		if (openSub === null) (els[active] ?? root).focus();
	});

	/** Next item index from `from` in direction `dir`, skipping separators and wrapping. */
	function step(from: number, dir: 1 | -1) {
		const n = items.length;
		const start = from < 0 ? (dir > 0 ? -1 : n) : from;
		for (let k = 1; k <= n; k++) {
			const i = (((start + dir * k) % n) + n) % n;
			if (isItem(items[i])) return i;
		}
		return from;
	}

	function activate(i: number, viaKeyboard: boolean) {
		const item = items[i];
		if (!isItem(item) || item.disabled) return;
		clearTimeout(hoverTimer);
		if (item.submenu) {
			subKeyboard = viaKeyboard;
			openSub = i;
			return;
		}
		onclose('done');
		item.action?.();
	}

	function hover(i: number) {
		if (active === i) return;
		active = i;
		clearTimeout(hoverTimer);
		const item = items[i];
		hoverTimer = setTimeout(() => {
			subKeyboard = false;
			openSub = isItem(item) && item.submenu && !item.disabled ? i : null;
		}, 300);
	}

	function childClose(reason: CloseReason) {
		// Escape or Left closes just the submenu; the effect refocuses our item.
		if (reason === 'escape' || reason === 'left') openSub = null;
		else onclose(reason);
	}

	function onkeydown(e: KeyboardEvent) {
		const item = items[active];
		switch (e.key) {
			case 'ArrowDown':
				active = step(active, 1);
				break;
			case 'ArrowUp':
				active = step(active, -1);
				break;
			case 'Home':
				active = step(-1, 1);
				break;
			case 'End':
				active = step(-1, -1);
				break;
			case 'ArrowRight':
				if (item && isItem(item) && item.submenu && !item.disabled) activate(active, true);
				else onclose('right');
				break;
			case 'ArrowLeft':
				onclose('left');
				break;
			case 'Escape':
				onclose('escape');
				break;
			case 'Enter':
			case ' ':
				if (active >= 0) activate(active, true);
				break;
			case 'Tab':
				break;
			default: {
				if (e.key.length !== 1 || e.ctrlKey || e.metaKey || e.altKey) return;
				const i = items.findIndex((it) => isItem(it) && accessKey(it.label) === keyLetter(e));
				if (i < 0) return;
				active = i;
				activate(i, true);
			}
		}
		e.preventDefault();
		e.stopPropagation();
	}
</script>

<ul
	bind:this={root}
	class="w2k-menu"
	class:submenu
	class:flip
	style:translate="{shift[0]}px {shift[1]}px"
	role="menu"
	aria-label={label}
	tabindex="-1"
	{onkeydown}
	onpointerleave={() => {
		if (openSub === null) active = -1;
	}}
>
	{#each items as item, i (i)}
		{#if item === 'separator'}
			<li class="sep" role="separator"></li>
		{:else}
			{@const [pre, key, post] = splitAccessKey(item.label)}
			<li role="none" onpointerenter={() => hover(i)}>
				<div
					bind:this={els[i]}
					class="item"
					class:active={active === i}
					class:disabled={item.disabled}
					role={item.checked === undefined ? 'menuitem' : item.radio ? 'menuitemradio' : 'menuitemcheckbox'}
					aria-checked={item.checked}
					aria-disabled={item.disabled || undefined}
					aria-haspopup={item.submenu ? 'menu' : undefined}
					aria-expanded={item.submenu ? openSub === i : undefined}
					tabindex="-1"
					onclick={() => activate(i, false)}
				>
					<span class="mark">
						{#if item.checked}<Glyph name={item.radio ? 'dot' : 'check'} />{/if}
					</span>
					<span class="text">{pre}{#if mnemonics && key}<u>{key}</u>{:else}{key}{/if}{post}</span>
					<span class="shortcut">{item.shortcut ?? ''}</span>
					<span class="arrow">
						{#if item.submenu}<Glyph name="right" />{/if}
					</span>
				</div>
				{#if item.submenu && openSub === i}
					<Menu
						items={item.submenu}
						label={plainLabel(item.label)}
						{mnemonics}
						keyboard={subKeyboard}
						submenu
						onclose={childClose}
					/>
				{/if}
			</li>
		{/if}
	{/each}
</ul>

<style>
	.w2k-menu {
		position: absolute;
		z-index: 100;
		top: 100%;
		left: 0;
		min-width: 120px;
		margin: 0;
		padding: 3px;
		list-style: none;
		background: var(--face);
		box-shadow: var(--raised-window), 2px 2px 0 rgb(0 0 0 / 0.2);
		color: var(--text);
		font-weight: normal;
		white-space: nowrap;
		outline: none;
		cursor: default;
	}
	.w2k-menu.submenu {
		top: -3px;
		left: calc(100% - 2px);
	}
	.w2k-menu.flip {
		left: auto;
		right: calc(100% - 2px);
	}

	li {
		position: relative;
	}

	.item {
		display: flex;
		align-items: center;
		height: 17px;
		outline: none;
	}
	.item.active {
		background: var(--select);
		color: var(--select-text);
	}
	.item.disabled {
		color: var(--shadow);
		text-shadow: 1px 1px var(--hilite);
	}
	.item.disabled :global(.w2k-glyph) {
		filter: drop-shadow(1px 1px 0 var(--hilite));
	}
	.item.disabled.active {
		text-shadow: none;
	}
	.item.disabled.active :global(.w2k-glyph) {
		filter: none;
	}

	.mark,
	.arrow {
		display: flex;
		flex: none;
		justify-content: center;
		width: 18px;
	}
	.arrow {
		width: 14px;
	}
	.text {
		flex: 1;
		padding-right: 18px;
	}
	.shortcut:not(:empty) {
		padding-right: 4px;
	}

	.sep {
		height: 2px;
		margin: 3px 1px;
		border-top: 1px solid var(--shadow);
		border-bottom: 1px solid var(--hilite);
	}
</style>
