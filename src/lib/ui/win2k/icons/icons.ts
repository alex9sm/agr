// Icons: 16×16 drawn as text in the classic 16-color palette plus normal-map blues; 32×32 message box icons drawn by function.
import { fromRows, type Grid } from './pixels';

const palette = {
	k: '#000000',
	w: '#ffffff',
	g: '#808080',
	s: '#c0c0c0',
	y: '#ffff00',
	Y: '#808000',
	B: '#000080',
	b: '#0000ff',
	G: '#008000',
	p: '#8080ff', // flat normal (0, 0, 1)
	P: '#c0c0ff', // slope facing the light
	q: '#4040c0' // slope facing away
};

const icon = (rows: string[]) => fromRows(rows, palette);

/** 32×32 grid from a per-pixel function of the offset from the center. */
function drawn32(color: (dx: number, dy: number) => string | null): Grid {
	return Array.from({ length: 32 }, (_, y) => Array.from({ length: 32 }, (_, x) => color(x - 15.5, y - 15.5)));
}

/** Message box error icon: red disc, white X, gray drop shadow. */
const errorIcon = drawn32((dx, dy) => {
	const r = Math.hypot(dx, dy);
	if (r <= 12.5) {
		const onX = Math.abs(dx) <= 6.5 && (Math.abs(dx - dy) <= 1.6 || Math.abs(dx + dy) <= 1.6);
		return onX ? '#ffffff' : '#ff0000';
	}
	if (r <= 13.5) return '#800000';
	return Math.hypot(dx - 2, dy - 2) <= 13.5 ? '#808080' : null;
});

/** Message box warning icon: yellow triangle, black outline and exclamation mark. */
const warningIcon = drawn32((dx, dy) => {
	const y = dy + 15.5;
	const half = ((y - 2) / 26) * 14; // half-width of the triangle at this row
	if (y < 2 || y > 28 || Math.abs(dx) > half) return null;
	if (Math.abs(dx) > half - 1.8 || y > 26.5) return '#000000';
	const bang = Math.abs(dx) <= 1.5 && ((y >= 9 && y <= 19) || (y >= 22 && y <= 24.5));
	return bang ? '#000000' : '#ffff00';
});

/** Question mark for questionIcon, placed at its center. */
const QUESTION_MARK = [
	'..xxxxxx..',
	'.xxxxxxxx.',
	'xxx....xxx',
	'xxx....xxx',
	'.......xxx',
	'......xxx.',
	'.....xxx..',
	'....xxx...',
	'....xxx...',
	'..........',
	'....xxx...',
	'....xxx...'
];

/** Message box question icon: white disc, blue question mark, gray drop shadow. */
const questionIcon = drawn32((dx, dy) => {
	const r = Math.hypot(dx, dy);
	if (r <= 12.5) {
		const row = QUESTION_MARK[Math.floor(dy + 15.5) - 10];
		return row?.[Math.floor(dx + 15.5) - 11] === 'x' ? '#0000ff' : '#ffffff';
	}
	if (r <= 13.5) return '#000000';
	return Math.hypot(dx - 2, dy - 2) <= 13.5 ? '#808080' : null;
});

/** A sphere whose pixels are its own normals: the app icon. */
function normalSphere(): Grid {
	const channel = (v: number) => Math.round((v * 0.5 + 0.5) * 255).toString(16).padStart(2, '0');
	return Array.from({ length: 16 }, (_, y) =>
		Array.from({ length: 16 }, (_, x) => {
			const nx = (x + 0.5 - 8) / 7.5;
			const ny = (8 - (y + 0.5)) / 7.5;
			const r2 = nx * nx + ny * ny;
			if (r2 > 1) return null;
			return `#${channel(nx)}${channel(ny)}${channel(Math.sqrt(1 - r2))}`;
		})
	);
}

export const icons = {
	normalMap: normalSphere(),
	error: errorIcon,
	warning: warningIcon,
	question: questionIcon,
	open: icon([
		'................',
		'................',
		'................',
		'.kkkk...........',
		'kYwwYk..........',
		'kYYYYYkkkkkkk...',
		'kYYYYYYYYYYYk...',
		'kYYYkkkkkkkkkkkk',
		'kYYkyyyyyyyyyyyk',
		'kYYkyyyyyyyyyyk.',
		'kYkyyyyyyyyyyyk.',
		'kYkyyyyyyyyyyk..',
		'kkyyyyyyyyyyyk..',
		'kkkkkkkkkkkkkk..',
		'................',
		'................'
	]),
	save: icon([
		'................',
		'.kkkkkkkkkkkkkk.',
		'.kBwwwwwwwwwwBk.',
		'.kBwwwwwwwwwwBk.',
		'.kBwggggggggwBk.',
		'.kBwwwwwwwwwwBk.',
		'.kBwggggggggwBk.',
		'.kBwwwwwwwwwwBk.',
		'.kBBBBBBBBBBBBk.',
		'.kBBBssssssBBBk.',
		'.kBBBsBBsssBBBk.',
		'.kBBBsBBsssBBBk.',
		'.kBBBsBBsssBBBk.',
		'.kBBBssssssBBBk.',
		'.kkkkkkkkkkkkkk.',
		'................'
	]),
	flipGreen: icon([
		'.......k........',
		'......kGk.......',
		'.....kGGGk......',
		'....kGGGGGk.....',
		'...kkkGGGkkk....',
		'.....kGGGk......',
		'.....kGGGk......',
		'.....kGGGk......',
		'.....kGGGk......',
		'.....kGGGk......',
		'.....kGGGk......',
		'...kkkGGGkkk....',
		'....kGGGGGk.....',
		'.....kGGGk......',
		'......kGk.......',
		'.......k........'
	]),
	pan: icon([
		'.......k........',
		'......kkk.......',
		'.....kkkkk......',
		'.......k........',
		'.......k........',
		'..k....k....k...',
		'.kk....k....kk..',
		'kkkkkkkkkkkkkkk.',
		'.kk....k....kk..',
		'..k....k....k...',
		'.......k........',
		'.......k........',
		'.....kkkkk......',
		'......kkk.......',
		'.......k........',
		'................'
	]),
	light: icon([
		'................',
		'......kkkk......',
		'.....kyyyyk.....',
		'....kyywyyyk....',
		'...kyywyyyyyk...',
		'...kywyyyyyyk...',
		'...kyyyyyyyyk...',
		'...kyyyyyyyyk...',
		'....kyyyyyyk....',
		'.....kyyyyk.....',
		'.....kyyyyk.....',
		'.....kssssk.....',
		'.....kggggk.....',
		'.....kssssk.....',
		'......kggk......',
		'.......kk.......'
	]),
	zoomIn: icon([
		'................',
		'....kkkk........',
		'..kkwwwwkk......',
		'.kwwwwwwwwk.....',
		'.kwwwkkwwwk.....',
		'kwwwwkkwwwwk....',
		'kwwkkkkkkwwk....',
		'kwwkkkkkkwwk....',
		'kwwwwkkwwwwk....',
		'.kwwwkkwwwk.....',
		'.kwwwwwwwwk.....',
		'..kkwwwwkkk.....',
		'....kkkk..kkk...',
		'...........kkk..',
		'............kkk.',
		'.............kk.'
	]),
	zoomOut: icon([
		'................',
		'....kkkk........',
		'..kkwwwwkk......',
		'.kwwwwwwwwk.....',
		'.kwwwwwwwwk.....',
		'kwwwwwwwwwwk....',
		'kwwkkkkkkwwk....',
		'kwwkkkkkkwwk....',
		'kwwwwwwwwwwk....',
		'.kwwwwwwwwk.....',
		'.kwwwwwwwwk.....',
		'..kkwwwwkkk.....',
		'....kkkk..kkk...',
		'...........kkk..',
		'............kkk.',
		'.............kk.'
	]),
	zoomFit: icon([
		'................',
		'.kkkk......kkkk.',
		'.k............k.',
		'.k............k.',
		'.k............k.',
		'.....bbbbbb.....',
		'.....bbbbbb.....',
		'.....bbbbbb.....',
		'.....bbbbbb.....',
		'.....bbbbbb.....',
		'.....bbbbbb.....',
		'.k............k.',
		'.k............k.',
		'.k............k.',
		'.kkkk......kkkk.',
		'................'
	]),
	baseMap: icon([
		'................',
		'................',
		'.kkkkkkkkkkkkkk.',
		'.kppppppppppppk.',
		'.kppPPppppPPppk.',
		'.kpPPpqppPPpqpk.',
		'.kpPpqqppPpqqpk.',
		'.kppqqppppqqppk.',
		'.kpppppPPpppppk.',
		'.kppppPPpqppppk.',
		'.kppppPpqqppppk.',
		'.kpppppqqpppppk.',
		'.kppppppppppppk.',
		'.kkkkkkkkkkkkkk.',
		'................',
		'................'
	]),
	detailMap: icon([
		'................',
		'................',
		'.kkkkkkkkkkkkkk.',
		'.kPpppPpppPpppk.',
		'.kpqpppqpppqppk.',
		'.kppppppppppppk.',
		'.kppppppppppppk.',
		'.kPpppPpppPpppk.',
		'.kpqpppqpppqppk.',
		'.kppppppppppppk.',
		'.kppppppppppppk.',
		'.kPpppPpppPpppk.',
		'.kpqpppqpppqppk.',
		'.kkkkkkkkkkkkkk.',
		'................',
		'................'
	]),
	output: icon([
		'................',
		'....kkkkkkkkkkk.',
		'....kPPPPPPPPPk.',
		'....kPPPPPPPPPk.',
		'....kPPPPPPPPPk.',
		'.kkkkkkkkkkkPPk.',
		'.kpppppppppkPPk.',
		'.kppPPpppppkPPk.',
		'.kpPPpqppppkPPk.',
		'.kpPpqqppppkPPk.',
		'.kppqqpppppkkkk.',
		'.kpppppPPppk....',
		'.kppppPPpqpk....',
		'.kppppPpqqpk....',
		'.kkkkkkkkkkk....',
		'................'
	])
} satisfies Record<string, Grid>;

export type IconName = keyof typeof icons;
