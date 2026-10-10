// Small monochrome glyphs (arrows, checks, close X). They draw in currentColor.
import { fromRows, type Grid } from './pixels';

const glyph = (rows: string[]) => fromRows(rows, { k: 'currentColor' });

/** Status bar size grip: diagonal stripes of one light and two shadow lines. */
function sizeGrip(): Grid {
	const stripe = [null, '#ffffff', '#808080', '#808080'];
	return Array.from({ length: 12 }, (_, y) =>
		Array.from({ length: 12 }, (_, x) => (x + y < 11 ? null : stripe[(x + y - 11) % 4]))
	);
}

export const glyphs = {
	down: glyph(['kkkkkkk', '.kkkkk.', '..kkk..', '...k...']),
	up: glyph(['...k...', '..kkk..', '.kkkkk.', 'kkkkkkk']),
	right: glyph(['k...', 'kk..', 'kkk.', 'kkkk', 'kkk.', 'kk..', 'k...']),
	left: glyph(['...k', '..kk', '.kkk', 'kkkk', '.kkk', '..kk', '...k']),
	spinUp: glyph(['..k..', '.kkk.', 'kkkkk']),
	spinDown: glyph(['kkkkk', '.kkk.', '..k..']),
	check: glyph(['......k', '.....kk', 'k...kkk', 'kk.kkk.', 'kkkkk..', '.kkk...', '..k....']),
	dot: glyph(['.kkkk.', 'kkkkkk', 'kkkkkk', 'kkkkkk', 'kkkkkk', '.kkkk.']),
	close: glyph(['kk....kk', '.kk..kk.', '..kkkk..', '...kk...', '..kkkk..', '.kk..kk.', 'kk....kk']),
	grip: sizeGrip()
} satisfies Record<string, Grid>;

export type GlyphName = keyof typeof glyphs;
