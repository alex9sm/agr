// Undo/redo over snapshots of a tool's state. The tool calls commit(label) after each finished edit (slider
// release, Enter in a field, a menu command); undo and redo hand back the snapshot to restore.

const MAX_STEPS = 100;
/** Commits with the same label this close together merge into one step (spin buttons, held arrow keys). */
const MERGE_MS = 1000;

interface Step<T> {
	label: string;
	/** The state before this step. */
	state: T;
}

export class History<T> {
	private undoStack = $state.raw<Step<T>[]>([]);
	private redoStack = $state.raw<Step<T>[]>([]);
	/** The state as of the last commit, undo or redo. */
	private committed: T;
	private lastCommit = 0;

	/** `capture` returns a snapshot of the current state that later edits can't change. */
	constructor(
		private readonly capture: () => T,
		private readonly same: (a: T, b: T) => boolean
	) {
		this.committed = capture();
	}

	/** Name of the step Undo would revert, or null when there is none. */
	get undoLabel(): string | null {
		return this.undoStack.at(-1)?.label ?? null;
	}

	get redoLabel(): string | null {
		return this.redoStack.at(-1)?.label ?? null;
	}

	/** Record the current state as a step named `label`, if it changed since the last commit. */
	commit(label: string) {
		const current = this.capture();
		if (this.same(current, this.committed)) return;
		const now = Date.now();
		const top = this.undoStack.at(-1);
		if (top?.label === label && now - this.lastCommit < MERGE_MS) {
			// Same edit continuing. If it ended up back where it started, it's no step at all.
			if (this.same(current, top.state)) this.undoStack = this.undoStack.slice(0, -1);
		} else {
			this.undoStack = [...this.undoStack, { label, state: this.committed }].slice(-MAX_STEPS);
		}
		this.redoStack = [];
		this.committed = current;
		this.lastCommit = now;
	}

	/** Step back. Returns the state to restore, or null if there is nothing to undo. */
	undo(): T | null {
		this.commit('Edit'); // uncommitted changes are undone first
		const step = this.undoStack.at(-1);
		if (!step) return null;
		this.undoStack = this.undoStack.slice(0, -1);
		this.redoStack = [...this.redoStack, { label: step.label, state: this.committed }];
		return this.moveTo(step.state);
	}

	/** Step forward again. Returns the state to restore, or null if there is nothing to redo. */
	redo(): T | null {
		this.commit('Edit'); // a new edit since the undo discards the redo steps
		const step = this.redoStack.at(-1);
		if (!step) return null;
		this.redoStack = this.redoStack.slice(0, -1);
		this.undoStack = [...this.undoStack, { label: step.label, state: this.committed }];
		return this.moveTo(step.state);
	}

	/** Forget every step; the current state becomes the start of history. */
	reset() {
		this.undoStack = [];
		this.redoStack = [];
		this.committed = this.capture();
		this.lastCommit = 0;
	}

	private moveTo(state: T): T {
		this.committed = state;
		this.lastCommit = 0; // the next edit starts a new step
		return state;
	}
}
