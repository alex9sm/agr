import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { History } from '../../src/lib/history.svelte';

/** A History over one number, like a tool's settings object. */
function setup() {
	const state = { value: 0 };
	const history = new History(
		() => state.value,
		(a, b) => a === b
	);
	const edit = (value: number, label = 'Value') => {
		state.value = value;
		history.commit(label);
	};
	const undo = () => {
		const s = history.undo();
		if (s !== null) state.value = s;
	};
	const redo = () => {
		const s = history.redo();
		if (s !== null) state.value = s;
	};
	return { state, history, edit, undo, redo };
}

describe('History', () => {
	beforeEach(() => vi.useFakeTimers());
	afterEach(() => vi.useRealTimers());

	const later = () => vi.advanceTimersByTime(5000);

	it('undoes and redoes steps in order', () => {
		const { state, history, edit, undo, redo } = setup();
		edit(1, 'A');
		later();
		edit(2, 'B');
		expect(history.undoLabel).toBe('B');
		undo();
		expect([state.value, history.undoLabel, history.redoLabel]).toEqual([1, 'A', 'B']);
		undo();
		expect([state.value, history.undoLabel, history.redoLabel]).toEqual([0, null, 'A']);
		undo(); // nothing left
		expect(state.value).toBe(0);
		redo();
		redo();
		expect([state.value, history.redoLabel]).toEqual([2, null]);
	});

	it('ignores commits that change nothing', () => {
		const { history, edit } = setup();
		edit(0);
		expect(history.undoLabel).toBeNull();
	});

	it('merges quick repeats of the same edit, and drops them if they end where they started', () => {
		const { state, history, edit, undo } = setup();
		edit(1);
		edit(2);
		edit(3);
		undo();
		expect([state.value, history.undoLabel]).toEqual([0, null]);

		later();
		edit(5);
		edit(0); // back to the start within the merge window
		expect(history.undoLabel).toBeNull();
	});

	it('keeps separate steps for different edits or after a pause', () => {
		const { state, edit, undo } = setup();
		edit(1, 'A');
		edit(2, 'B');
		later();
		edit(3, 'B');
		undo();
		expect(state.value).toBe(2);
		undo();
		expect(state.value).toBe(1);
	});

	it('does not merge an edit into a step it just undid or redid', () => {
		const { state, edit, undo } = setup();
		edit(1);
		later();
		edit(2);
		undo();
		edit(7); // same label, within the window of nothing: a new step
		undo();
		expect(state.value).toBe(1);
	});

	it('a new edit discards the redo steps', () => {
		const { history, edit, undo } = setup();
		edit(1, 'A');
		later();
		edit(2, 'B');
		undo();
		edit(9, 'C');
		expect(history.redoLabel).toBeNull();
		expect(history.undoLabel).toBe('C');
	});

	it('undo first records uncommitted changes, so they are undone rather than lost', () => {
		const { state, history, edit, undo, redo } = setup();
		edit(1, 'A');
		later();
		state.value = 4; // e.g. mid-drag
		undo();
		expect(state.value).toBe(1);
		redo();
		expect(state.value).toBe(4);
		expect(history.undoLabel).toBe('Edit');
	});

	it('reset forgets everything and starts from the current state', () => {
		const { state, history, edit, undo } = setup();
		edit(1, 'A');
		later();
		edit(2, 'B');
		undo();
		history.reset();
		expect([history.undoLabel, history.redoLabel]).toEqual([null, null]);
		undo();
		expect(state.value).toBe(1);
	});

	it('keeps at most 100 steps', () => {
		const { state, edit, undo } = setup();
		for (let i = 1; i <= 150; i++) {
			edit(i, `step ${i}`);
		}
		for (let i = 0; i < 200; i++) undo();
		expect(state.value).toBe(50);
	});
});
