// 16×16 icons, drawn as text in the classic 16-color palette plus normal-map blues.
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
