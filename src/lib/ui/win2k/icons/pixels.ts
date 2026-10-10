// Pixel art for icons and glyphs, rendered as crisp SVG paths.

/** A pixel image: rows of CSS colors, null = transparent. */
export type Grid = readonly (readonly (string | null)[])[];

/** Build a grid from text rows: one character per pixel, '.' is transparent. */
export function fromRows(rows: readonly string[], palette: Readonly<Record<string, string>>): Grid {
	if (rows.some((row) => row.length !== rows[0].length)) {
		throw new Error(`pixel art: rows differ in length (${rows.map((r) => r.length).join(', ')})`);
	}
	return rows.map((row) =>
		[...row].map((ch) => {
			if (ch === '.') return null;
			const color = palette[ch];
			if (!color) throw new Error(`pixel art: no color for '${ch}'`);
			return color;
		})
	);
}

export const gridWidth = (grid: Grid) => grid[0]?.length ?? 0;
export const gridHeight = (grid: Grid) => grid.length;

/** SVG path data covering every pixel for which `keep` is true; horizontal runs merge. */
function runsPath(grid: Grid, keep: (color: string | null) => boolean, sameRun: (a: string | null, b: string | null) => boolean) {
	let d = '';
	grid.forEach((row, y) => {
		for (let x = 0; x < row.length; ) {
			let end = x + 1;
			while (end < row.length && sameRun(row[end], row[x])) end++;
			if (keep(row[x])) d += `M${x} ${y}h${end - x}v1h${x - end}z`;
			x = end;
		}
	});
	return d;
}

const pathCache = new WeakMap<Grid, { fill: string; d: string }[]>();

/** One SVG path per color. */
export function toPaths(grid: Grid) {
	let paths = pathCache.get(grid);
	if (!paths) {
		const colors = [...new Set(grid.flat())].filter((c): c is string => c !== null);
		paths = colors.map((fill) => ({ fill, d: runsPath(grid, (c) => c === fill, (a, b) => a === b) }));
		pathCache.set(grid, paths);
	}
	return paths;
}

/** Rec. 601 luma of a #rrggbb color, 0..1. Anything else counts as dark. */
function luma(color: string) {
	const m = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(color);
	if (!m) return 0;
	const [r, g, b] = m.slice(1).map((h) => parseInt(h, 16) / 255);
	return 0.299 * r + 0.587 * g + 0.114 * b;
}

const silhouetteCache = new WeakMap<Grid, string>();

/** Path of the dark pixels only. Win2000 draws disabled icons as an embossed silhouette of these. */
export function toSilhouette(grid: Grid) {
	let d = silhouetteCache.get(grid);
	if (d === undefined) {
		const dark = (c: string | null) => c !== null && luma(c) < 0.6;
		d = runsPath(grid, dark, (a, b) => dark(a) === dark(b));
		silhouetteCache.set(grid, d);
	}
	return d;
}
