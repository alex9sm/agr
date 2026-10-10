<!--
	Modal dialog on <dialog>: the browser traps focus. `open` is the source of truth; Esc and the
	title-bar X set it to false. (The native close event can arrive late, e.g. while the page is hidden.)
-->
<script lang="ts">
	import { onDestroy, untrack, type Snippet } from 'svelte';
	import Glyph from './icons/Glyph.svelte';
	import { modal } from './modal.svelte';

	interface Props {
		open?: boolean;
		title: string;
		width?: number;
		children: Snippet;
		/** Button row; mark one `<Button default>` to focus it on open. */
		buttons?: Snippet;
		/** Center the button row (message boxes) instead of right-aligning it. */
		centerButtons?: boolean;
		/** The user dismissed the dialog with Esc or the title-bar X. */
		onclose?: () => void;
	}
	let { open = $bindable(false), title, width, children, buttons, centerButtons = false, onclose }: Props = $props();

	const uid = $props.id();
	let el: HTMLDialogElement;
	let offset = $state<[number, number]>([0, 0]);
	let drag: { x: number; y: number; from: [number, number] } | null = null;

	// Whether this dialog is counted in `modal.count`.
	let counted = false;
	const hold = () => {
		if (!counted) untrack(() => modal.count++);
		counted = true;
	};
	const release = () => {
		if (counted) untrack(() => modal.count--);
		counted = false;
	};

	$effect(() => {
		if (open && !el.open) {
			offset = [0, 0];
			el.showModal();
			hold();
			el.querySelector<HTMLElement>('.w2k-button.default')?.focus();
		} else if (!open && el.open) {
			el.close();
			release();
		}
	});

	onDestroy(release);

	function dismiss() {
		open = false;
		onclose?.();
	}

	function oncancel(e: Event) {
		e.preventDefault();
		dismiss();
	}

	/** Closed some other way (a form with method="dialog", or a second Esc the browser forces through). */
	function onNativeClose() {
		release();
		if (open) dismiss();
	}

	function dragStart(e: PointerEvent) {
		if (e.button !== 0 || (e.target as HTMLElement).closest('button')) return;
		(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
		drag = { x: e.clientX, y: e.clientY, from: offset };
	}

	function dragMove(e: PointerEvent) {
		if (drag) offset = [drag.from[0] + e.clientX - drag.x, drag.from[1] + e.clientY - drag.y];
	}
</script>

<dialog
	bind:this={el}
	class="w2k-dialog"
	aria-labelledby="{uid}-title"
	style:translate="{offset[0]}px {offset[1]}px"
	style:width={width ? `${width}px` : undefined}
	{oncancel}
	onclose={onNativeClose}
>
	<div
		class="w2k-titlebar"
		role="presentation"
		onpointerdown={dragStart}
		onpointermove={dragMove}
		onpointerup={() => (drag = null)}
		onpointercancel={() => (drag = null)}
	>
		<span class="title" id="{uid}-title">{title}</span>
		<button type="button" class="w2k-captionbutton" aria-label="Close" onclick={dismiss}>
			<Glyph name="close" />
		</button>
	</div>
	<div class="body">{@render children()}</div>
	{#if buttons}
		<div class="buttons" class:center={centerButtons}>{@render buttons()}</div>
	{/if}
</dialog>

<style>
	.w2k-dialog {
		min-width: 250px;
		max-width: calc(100vw - 16px);
		padding: 3px;
		border: 0;
		background: var(--face);
		box-shadow: var(--raised-window);
		color: var(--text);
		font: 11px/1.25 var(--font);
	}
	.w2k-dialog::backdrop {
		background: transparent;
	}
	.w2k-titlebar {
		padding-right: 2px;
	}
	.body {
		padding: 12px 10px 4px;
	}
	.buttons {
		display: flex;
		justify-content: flex-end;
		gap: 6px;
		padding: 8px 8px 7px;
	}
	.buttons.center {
		justify-content: center;
	}
</style>
