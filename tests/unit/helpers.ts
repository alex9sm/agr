import { crc32, deflateSync } from 'node:zlib';
import type { Channels, ImageBuffer } from '$lib/image/types';

/** Deterministic noise image, with odd sizes by default. Flat blocks give RLE something to compress. */
export function noiseImage(channels: Channels, bitDepth: 8 | 16, width = 37, height = 23, seed = 1): ImageBuffer {
	const max = bitDepth === 8 ? 255 : 65535;
	const count = width * height * channels;
	const data = bitDepth === 8 ? new Uint8Array(count) : new Uint16Array(count);
	let s = seed;
	for (let i = 0; i < count; i++) {
		const pixel = Math.floor(i / channels);
		if (pixel % width < 8) {
			data[i] = (i % channels) * 17; // flat run at the start of each row
			continue;
		}
		s = (s * 1103515245 + 12345) >>> 0;
		data[i] = (s >>> 8) % (max + 1);
	}
	data[0] = max;
	return bitDepth === 8
		? { width, height, channels, bitDepth, data: data as Uint8Array }
		: { width, height, channels, bitDepth, data: data as Uint16Array };
}

function chunk(type: string, data: Uint8Array): Uint8Array {
	const body = new Uint8Array([...new TextEncoder().encode(type), ...data]);
	const out = new Uint8Array(8 + data.length + 4);
	const view = new DataView(out.buffer);
	view.setUint32(0, data.length);
	out.set(body, 4);
	view.setUint32(8 + data.length, crc32(body));
	return out;
}

/** A minimal PNG built by hand, for color types and depths our encoder never writes. Rows are packed, unfiltered. */
export function makePng(opts: {
	width: number;
	height: number;
	colorType: 0 | 2 | 3 | 4 | 6;
	depth: 1 | 2 | 4 | 8 | 16;
	rows: number[][];
	palette?: [number, number, number][];
	alpha?: number[];
}): Uint8Array {
	const ihdr = new Uint8Array(13);
	const view = new DataView(ihdr.buffer);
	view.setUint32(0, opts.width);
	view.setUint32(4, opts.height);
	ihdr[8] = opts.depth;
	ihdr[9] = opts.colorType;
	const raw = new Uint8Array(opts.rows.flatMap((row) => [0, ...row]));
	const parts = [
		new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
		chunk('IHDR', ihdr),
		...(opts.palette ? [chunk('PLTE', new Uint8Array(opts.palette.flat()))] : []),
		...(opts.alpha ? [chunk('tRNS', new Uint8Array(opts.alpha))] : []),
		chunk('IDAT', new Uint8Array(deflateSync(raw))),
		chunk('IEND', new Uint8Array(0))
	];
	const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
	let o = 0;
	for (const p of parts) {
		out.set(p, o);
		o += p.length;
	}
	return out;
}
