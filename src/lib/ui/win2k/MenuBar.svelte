<!--
	Menu bar with Windows keyboard behavior: Alt or F10 enters menu mode, Alt+letter opens a menu,
	arrows move between and within menus, Esc backs out one level. Item shortcuts are bound globally.
-->
<script lang="ts">
	import Menu from './Menu.svelte';
	import {
		accessKey,
		allItems,
		keyLetter,
		matchesShortcut,
		plainLabel,
		splitAccessKey,
		type CloseReason,
		type MenuDef
	} from './menu';
	import { modal } from './modal.svelte';

	let { menus, label = 'Menu bar' }: { menus: MenuDef[]; label?: string } = $props();

	/** Menu whose dropdown is showing. */
	let open = $state<number | null>(null);
	/** Highlighted title in keyboard mode. */
	let hot = $state<number | null>(null);
	let keyboardMode = $state(false);
	let openedByKeyboard = $state(false);
	let altHeld = $state(false);
	let altAlone = false;
	let restoreFocus: HTMLElement | null = null;
	let bar: HTMLElement;
	const buttons: HTMLButtonElement[] = [];

	const mnemonics = $derived(keyboardMode || altHeld);

	/** Remember where focus was so leaving the menus can put it back. */
	function begin() {
		const current = document.activeElement;
		if (current instanceof HTMLElement && !bar.contains(current)) restoreFocus = current;
	}

	function reset() {
		open = null;
		hot = null;
		keyboardMode = false;
		restoreFocus = null;
	}

	function exit(restore = true) {
		if (restore && bar.contains(document.activeElement)) {
			if (restoreFocus?.isConnected) restoreFocus.focus();
			else (document.activeElement as HTMLElement).blur();
		}
		reset();
	}

	function openMenu(i: number, viaKeyboard: boolean) {
		begin();
		open = i;
		hot = i;
		openedByKeyboard = viaKeyboard;
		if (viaKeyboard) keyboardMode = true;
	}

	function highlight(i: number) {
		begin();
		open = null;
		hot = i;
		keyboardMode = true;
		buttons[i]?.focus();
	}

	function menuClose(reason: CloseReason) {
		if (open === null) return;
		const n = menus.length;
		if (reason === 'left') openMenu((open + n - 1) % n, true);
		else if (reason === 'right') openMenu((open + 1) % n, true);
		else if (reason === 'escape') highlight(open);
		else exit();
	}

	const menuFor = (e: KeyboardEvent) => menus.findIndex((m) => accessKey(m.label) === keyLetter(e));

	function titleKey(e: KeyboardEvent, i: number) {
		const n = menus.length;
		switch (e.key) {
			case 'ArrowLeft':
				highlight((i + n - 1) % n);
				break;
			case 'ArrowRight':
				highlight((i + 1) % n);
				break;
			case 'ArrowDown':
			case 'ArrowUp':
			case 'Enter':
			case ' ':
				openMenu(i, true);
				break;
			case 'Escape':
				exit();
				break;
			default: {
				if (e.key.length !== 1 || e.ctrlKey || e.metaKey || e.altKey) return;
				const j = menuFor(e);
				if (j < 0) return;
				openMenu(j, true);
			}
		}
		e.preventDefault();
	}

	function titlePointerdown(e: PointerEvent, i: number) {
		if (e.button !== 0) return;
		e.preventDefault(); // the dropdown takes focus, not the title
		if (open === i) exit();
		else openMenu(i, false);
	}

	/** Let text fields keep their own undo/clipboard keys. */
	function isTextEdit(e: KeyboardEvent) {
		const t = e.target as HTMLElement;
		const editable = t.isContentEditable || t instanceof HTMLInputElement || t instanceof HTMLTextAreaElement;
		return editable && 'zyacvx'.includes(e.key.toLowerCase());
	}

	function onkeydown(e: KeyboardEvent) {
		if (modal.count > 0) return;
		if (e.key === 'Alt') {
			if (!e.repeat) {
				altHeld = true;
				altAlone = true;
			}
			e.preventDefault();
			return;
		}
		altAlone = false;
		if (e.key === 'F10' && !e.shiftKey && !e.ctrlKey && !e.altKey) {
			e.preventDefault();
			if (open !== null || hot !== null) exit();
			else highlight(0);
			return;
		}
		if (e.altKey && !e.ctrlKey && !e.metaKey) {
			const i = menuFor(e);
			if (i >= 0) {
				e.preventDefault();
				openMenu(i, true);
			}
			return;
		}
		if (open !== null || !(e.ctrlKey || e.metaKey) || isTextEdit(e)) return;
		for (const menu of menus) {
			for (const item of allItems(menu.items)) {
				if (item.shortcut && matchesShortcut(e, item.shortcut)) {
					e.preventDefault(); // even when disabled, so the browser doesn't act on it
					if (!item.disabled) item.action?.();
					return;
				}
			}
		}
	}

	function onkeyup(e: KeyboardEvent) {
		if (e.key !== 'Alt') return;
		const alone = altHeld && altAlone;
		altHeld = false;
		if (!alone || modal.count > 0) return;
		e.preventDefault();
		if (open !== null || hot !== null) exit();
		else highlight(0);
	}
</script>

<svelte:window
	{onkeydown}
	{onkeyup}
	onpointerdown={(e) => {
		if ((open !== null || hot !== null) && !bar.contains(e.target as Node)) exit(false);
	}}
	onblur={() => {
		altHeld = false;
		if (open !== null) exit(false);
	}}
/>

<div
	bind:this={bar}
	class="w2k-menubar"
	role="menubar"
	aria-label={label}
	tabindex="-1"
	onfocusout={(e) => {
		// Tabbing away leaves menu mode. (A null target is a click on nothing; pointerdown handles that.)
		const to = e.relatedTarget as Node | null;
		if (to && !bar.contains(to)) reset();
	}}
>
	{#each menus as menu, i (menu.label)}
		{@const [pre, key, post] = splitAccessKey(menu.label)}
		<div class="slot" role="none">
			<button
				bind:this={buttons[i]}
				type="button"
				class="title"
				class:hot={hot === i && open === null}
				class:open={open === i}
				role="menuitem"
				aria-haspopup="menu"
				aria-expanded={open === i}
				tabindex={(hot ?? 0) === i ? 0 : -1}
				onpointerdown={(e) => titlePointerdown(e, i)}
				onpointerenter={() => {
					if (open !== null && open !== i) openMenu(i, false);
				}}
				onkeydown={(e) => titleKey(e, i)}
				onfocus={() => {
					hot = i;
					keyboardMode = true;
				}}
			>
				{pre}{#if mnemonics && key}<u>{key}</u>{:else}{key}{/if}{post}
			</button>
			{#if open === i}
				<Menu
					items={menu.items}
					label={plainLabel(menu.label)}
					{mnemonics}
					keyboard={openedByKeyboard}
					onclose={menuClose}
				/>
			{/if}
		</div>
	{/each}
</div>

<style>
	.w2k-menubar {
		display: flex;
		flex: none;
		flex-wrap: wrap;
		padding: 1px 2px;
		outline: none;
	}
	.slot {
		position: relative;
	}
	.title {
		height: 18px;
		padding: 0 6px;
		border: 0;
		background: none;
		outline: none;
		cursor: default;
	}
	.title:hover,
	.title.hot {
		box-shadow: var(--raised-thin);
	}
	.title.open {
		padding: 1px 5px 0 7px;
		box-shadow: var(--sunken-thin);
	}
</style>
