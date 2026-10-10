import type { IconName } from './icons/icons';

export interface TreeNode {
	id: string;
	label: string;
	icon?: IconName;
	/** Gray text after the label, outside the selection highlight. */
	note?: string;
	children?: TreeNode[];
}

export interface SelectOption {
	value: string;
	label: string;
}

/** One row of a PropertyGrid. Editable rows report edits through `set`. */
export type Property =
	| { kind: 'category'; label: string }
	| { kind: 'text'; label: string; value: string }
	| {
			kind: 'number';
			label: string;
			value: number;
			min?: number;
			max?: number;
			step?: number;
			decimals?: number;
			disabled?: boolean;
			set: (value: number) => void;
	  }
	| {
			kind: 'select';
			label: string;
			value: string;
			options: readonly SelectOption[];
			disabled?: boolean;
			set: (value: string) => void;
	  }
	| { kind: 'checkbox'; label: string; value: boolean; disabled?: boolean; set: (value: boolean) => void };

export interface StatusSegment {
	text: string;
	/** Fixed width in px. */
	width?: number;
	/** Take up the remaining space. */
	grow?: boolean;
}
