<!-- Text box with spin buttons. Typed values commit on Enter or blur; Esc reverts. -->
<script lang="ts">
	import { onDestroy } from 'svelte';
	import Glyph from './icons/Glyph.svelte';

	interface Props {
		value?: number;
		min?: number;
		max?: number;
		step?: number;
		decimals?: number;
		disabled?: boolean;
		/** Borderless, fills its container (property grid cells). */
		compact?: boolean;
		id?: string;
		label?: string;
		width?: number;
		onchange?: (value: number) => void;
	}
	let {
		value = $bindable(0),
		min = -Infinity,
		max = Infinity,
		step = 1,
		decimals = 0,
		disabled = false,
		compact = false,
		id,
		label,
		width,
		onchange
	}: Props = $props();

	/** What the user has typed but not committed. */
	let draft = $state<string | null>(null);
	let spinning = $state(0);
	let input: HTMLInputElement;
	let repeat: ReturnType<typeof setTimeout> | undefined;

	function set(v: number) {
		draft = null;
		const factor = 10 ** decimals;
		v = Math.min(max, Math.max(min, Math.round(v * factor) / factor));
		if (v === value) return;
		value = v;
		onchange?.(v);
	}

	function commit() {
		if (draft === null) return;
		const v = Number(draft.trim());
		if (draft.trim() === '' || !Number.isFinite(v)) draft = null;
		else set(v);
	}

	function stepBy(n: number) {
		commit();
		set(value + n * step);
	}

	function onkeydown(e: KeyboardEvent) {
		switch (e.key) {
			case 'ArrowUp':
				stepBy(1);
				break;
			case 'ArrowDown':
				stepBy(-1);
				break;
			case 'PageUp':
				stepBy(10);
				break;
			case 'PageDown':
				stepBy(-10);
				break;
			case 'Enter':
				commit();
				input.select();
				break;
			case 'Escape':
				if (draft === null) return; // nothing to revert: let Esc close a dialog
				draft = null;
				break;
			default:
				return;
		}
		e.preventDefault();
		e.stopPropagation();
	}

	/** Spin button: one step now, then repeat while held. */
	function spinStart(e: PointerEvent, dir: 1 | -1) {
		if (e.button !== 0 || disabled) return;
		e.preventDefault(); // keep focus in the text box
		(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
		input.focus();
		spinning = dir;
		stepBy(dir);
		const loop = (delay: number) => {
			repeat = setTimeout(() => {
				stepBy(dir);
				loop(50);
			}, delay);
		};
		loop(400);
	}

	function spinStop() {
		spinning = 0;
		clearTimeout(repeat);
	}

	onDestroy(() => clearTimeout(repeat));
</script>

<span class="w2k-numberfield" class:compact class:disabled style:width={width ? `${width}px` : undefined}>
	<input
		bind:this={input}
		{id}
		type="text"
		inputmode="decimal"
		role="spinbutton"
		autocomplete="off"
		spellcheck="false"
		aria-label={label}
		aria-valuenow={value}
		aria-valuemin={Number.isFinite(min) ? min : undefined}
		aria-valuemax={Number.isFinite(max) ? max : undefined}
		{disabled}
		value={draft ?? value.toFixed(decimals)}
		oninput={(e) => (draft = e.currentTarget.value)}
		onblur={commit}
		{onkeydown}
	/>
	<span class="spin" aria-hidden="true">
		{#each [1, -1] as const as dir (dir)}
			<!-- svelte-ignore a11y_no_static_element_interactions (mouse helper; keyboard uses Up/Down in the text box) -->
			<span
				class:pressed={spinning === dir}
				onpointerdown={(e) => spinStart(e, dir)}
				onpointerup={spinStop}
				onlostpointercapture={spinStop}
			>
				<Glyph name={dir > 0 ? 'spinUp' : 'spinDown'} />
			</span>
		{/each}
	</span>
</span>

<style>
	.w2k-numberfield {
		display: inline-flex;
		width: 80px;
		height: 21px;
		padding: 2px;
		background: var(--window);
		box-shadow: var(--sunken);
	}
	input {
		flex: 1;
		min-width: 0;
		padding: 0 2px;
		border: 0;
		background: transparent;
		outline: none;
		user-select: text;
	}
	.spin {
		display: flex;
		flex: none;
		flex-direction: column;
		width: 16px;
	}
	.spin > span {
		display: grid;
		flex: 1;
		place-items: center;
		background: var(--face);
		box-shadow: var(--raised-window);
	}
	.spin > span.pressed {
		box-shadow: var(--sunken-thin);
	}
	.spin > span.pressed :global(.w2k-glyph) {
		translate: 1px 1px;
	}

	.compact {
		width: 100%;
		height: 100%;
		padding: 0;
		box-shadow: none;
	}
	.compact .spin {
		width: 13px;
	}

	.disabled,
	.disabled input {
		background: var(--face);
		color: var(--shadow);
	}
	.disabled .spin {
		color: var(--shadow);
	}
	.disabled .spin :global(.w2k-glyph) {
		filter: drop-shadow(1px 1px 0 var(--hilite));
	}
</style>
