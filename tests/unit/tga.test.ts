import { describe, expect, it } from 'vitest';
import { decodeTga, encodeTga, looksLikeTga } from '$lib/image/tga';
import { ImageFormatError, type Channels } from '$lib/image/types';
import { noiseImage } from './helpers';

/** Hand-built TGA: 18-byte header, then pixel bytes exactly as given. */
function tga(type: number, width: number, height: number, depth: number, descriptor: number, body: number[]) {
	const header = [0, 0, type, 0, 0, 0, 0, 0, 0, 0, 0, 0, width & 255, width >> 8, height & 255, height >> 8, depth, descriptor];
	return new Uint8Array([...header, ...body]);
}

describe('TGA round trip', () => {
	const cases: [Channels, boolean][] = [
		[1, false],
		[1, true],
		[3, false],
		[3, true],
		[4, false],
		[4, true]
	];
	it.each(cases)('%i channels, rle=%s', (channels, rle) => {
		const image = noiseImage(channels, 8);
		const file = encodeTga(image, { rle });
		expect(looksLikeTga(file)).toBe(true);
		const decoded = decodeTga(file);
		expect(decoded).toMatchObject({ width: image.width, height: image.height, channels, bitDepth: 8 });
		expect(decoded.data).toEqual(image.data);
	});

	it('RLE compresses flat images', () => {
		const flat = { width: 300, height: 10, channels: 3 as const, bitDepth: 8 as const, data: new Uint8Array(9000).fill(9) };
		const raw = encodeTga(flat);
		const rle = encodeTga(flat, { rle: true });
		expect(rle.length).toBeLessThan(raw.length / 20);
		expect(decodeTga(rle).data).toEqual(flat.data);
	});

	it('writes gray + alpha as RGBA', () => {
		const image = { width: 2, height: 1, channels: 2 as const, bitDepth: 8 as const, data: new Uint8Array([10, 200, 30, 40]) };
		const decoded = decodeTga(encodeTga(image));
		expect(decoded.channels).toBe(4);
		expect([...decoded.data]).toEqual([10, 10, 10, 200, 30, 30, 30, 40]);
	});

	it('refuses 16-bit input', () => {
		expect(() => encodeTga(noiseImage(3, 16))).toThrow(/8 bits/);
	});
});

describe('TGA decode', () => {
	// 2×2 BGR pixels in storage order.
	const body = [/* row 0 */ 1, 2, 3, 4, 5, 6, /* row 1 */ 7, 8, 9, 10, 11, 12];

	it('flips bottom-left origin files and swaps BGR to RGB', () => {
		const image = decodeTga(tga(2, 2, 2, 24, 0, body));
		expect([...image.data]).toEqual([9, 8, 7, 12, 11, 10, 3, 2, 1, 6, 5, 4]);
	});

	it('keeps top-left origin files in order', () => {
		const image = decodeTga(tga(2, 2, 2, 24, 0x20, body));
		expect([...image.data]).toEqual([3, 2, 1, 6, 5, 4, 9, 8, 7, 12, 11, 10]);
	});

	it('mirrors right-to-left files', () => {
		const image = decodeTga(tga(2, 2, 2, 24, 0x30, body));
		expect([...image.data]).toEqual([6, 5, 4, 3, 2, 1, 12, 11, 10, 9, 8, 7]);
	});

	it('decodes RLE packets that cross scanlines', () => {
		// 3×2 gray: one run of 4 (crossing the row end) then a raw packet of 2.
		const image = decodeTga(tga(11, 3, 2, 8, 0x20, [0x83, 50, 0x01, 60, 70]));
		expect([...image.data]).toEqual([50, 50, 50, 50, 60, 70]);
	});

	it('treats 32-bit files without alpha bits as RGB', () => {
		const image = decodeTga(tga(2, 1, 1, 32, 0, [1, 2, 3, 0]));
		expect(image.channels).toBe(3);
		expect([...image.data]).toEqual([3, 2, 1]);
	});

	it('reads alpha from 32-bit files that declare it', () => {
		expect([...decodeTga(tga(2, 1, 1, 32, 8, [1, 2, 3, 99])).data]).toEqual([3, 2, 1, 99]);
	});

	it('skips the image ID field', () => {
		const file = tga(3, 1, 1, 8, 0, [77]);
		const withId = new Uint8Array([3, ...file.slice(1, 18), 0xaa, 0xbb, 0xcc, 77]);
		expect([...decodeTga(withId).data]).toEqual([77]);
	});

	it('rejects truncated files', () => {
		expect(() => decodeTga(tga(2, 2, 2, 24, 0, body.slice(0, 7)))).toThrow(ImageFormatError);
		expect(() => decodeTga(tga(10, 2, 2, 24, 0, [0x81, 1, 2, 3]))).toThrow(ImageFormatError);
	});

	it('explains unsupported variants', () => {
		expect(() => decodeTga(tga(1, 1, 1, 8, 0, [0]))).toThrow(/Color-mapped/);
		expect(() => decodeTga(tga(2, 1, 1, 16, 0, [0, 0]))).toThrow(/16-bit/);
	});
});
