// Menu model shared by MenuBar and Menu.

export interface MenuItem {
	/** `&` marks the access key: `'E&xport…'`. */
	label: string;
	/** Shown right-aligned, and bound as a global keyboard shortcut: `'Ctrl+O'`, `'Ctrl++'`. */
	shortcut?: string;
	disabled?: boolean;
	/** Set (true or false) to make the item checkable. */
	checked?: boolean;
	/** Draw a bullet instead of a check mark when checked. */
	radio?: boolean;
	action?: () => void;
	submenu?: MenuEntry[];
}

export type MenuEntry = MenuItem | 'separator';

export interface MenuDef {
	label: string;
	items: MenuEntry[];
}

/** Why a dropdown wants to close; its parent decides what happens next. */
export type CloseReason = 'escape' | 'left' | 'right' | 'done';

export const isItem = (entry: MenuEntry): entry is MenuItem => entry !== 'separator';

/** Split a label at its access key: `'E&xport'` → `['E', 'x', 'port']`. */
export function splitAccessKey(label: string): [string, string, string] {
	const i = label.indexOf('&');
	if (i < 0 || i === label.length - 1) return [label, '', ''];
	return [label.slice(0, i), label[i + 1], label.slice(i + 2)];
}

export const accessKey = (label: string) => splitAccessKey(label)[1].toLowerCase();
export const plainLabel = (label: string) => splitAccessKey(label).join('');

/** The letter a key event stands for, ignoring layout tricks like Option+F → ƒ on macOS. */
export function keyLetter(e: KeyboardEvent) {
	return /^Key([A-Z])$/.exec(e.code)?.[1].toLowerCase() ?? e.key.toLowerCase();
}

export function matchesShortcut(e: KeyboardEvent, shortcut: string) {
	const m = /^((?:(?:Ctrl|Shift|Alt)\+)*)(.+)$/.exec(shortcut);
	if (!m) return false;
	const [, mods, key] = m;
	if ((e.ctrlKey || e.metaKey) !== mods.includes('Ctrl') || e.altKey !== mods.includes('Alt')) return false;
	// '+' needs Shift on some layouts and not others, and '=' shares its key.
	if (key === '+') return e.key === '+' || e.key === '=';
	return e.shiftKey === mods.includes('Shift') && e.key.toLowerCase() === key.toLowerCase();
}

/** Every item in a menu tree, depth first. */
export function* allItems(entries: MenuEntry[]): Generator<MenuItem> {
	for (const entry of entries) {
		if (!isItem(entry)) continue;
		yield entry;
		if (entry.submenu) yield* allItems(entry.submenu);
	}
}
