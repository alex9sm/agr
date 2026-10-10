import { describe, expect, it } from 'vitest';
import { decodePng, encodePng } from '$lib/image/png';
import { ImageFormatError, type Channels } from '$lib/image/types';
import { makePng, noiseImage } from './helpers';

describe('PNG round trip', () => {
	const cases: [Channels, 8 | 16][] = [
		[4, 16],
		[3, 16],
		[1, 16],
		[4, 8],
		[3, 8],
		[2, 8],
		[1, 8]
	];
	it.each(cases)('%i channels at %i bits survives encode → decode exactly', (channels, depth) => {
		const image = noiseImage(channels, depth);
		const decoded = decodePng(encodePng(image));
		expect(decoded.width).toBe(image.width);
		expect(decoded.height).toBe(image.height);
		expect(decoded.channels).toBe(channels);
		expect(decoded.bitDepth).toBe(depth);
		expect(decoded.data).toEqual(image.data);
	});

	it('16-bit decode → encode → decode is identical', () => {
		const first = decodePng(encodePng(noiseImage(4, 16, 64, 40, 7)));
		const second = decodePng(encodePng(first));
		expect(second.data).toBeInstanceOf(Uint16Array);
		expect(second.data).toEqual(first.data);
	});
});

describe('PNG decode of formats we never write', () => {
	it('expands a palette to RGB', () => {
		const png = makePng({
			width: 3,
			height: 1,
			colorType: 3,
			depth: 8,
			rows: [[2, 0, 1]],
			palette: [
				[10, 20, 30],
				[40, 50, 60],
				[70, 80, 90]
			]
		});
		const image = decodePng(png);
		expect(image).toMatchObject({ channels: 3, bitDepth: 8 });
		expect([...image.data]).toEqual([70, 80, 90, 10, 20, 30, 40, 50, 60]);
	});

	it('expands a palette with tRNS to RGBA', () => {
		const png = makePng({
			width: 2,
			height: 1,
			colorType: 3,
			depth: 8,
			rows: [[0, 1]],
			palette: [
				[1, 2, 3],
				[4, 5, 6]
			],
			alpha: [128]
		});
		const image = decodePng(png);
		expect(image.channels).toBe(4);
		expect([...image.data]).toEqual([1, 2, 3, 128, 4, 5, 6, 255]);
	});

	it('unpacks a 2-bit palette with a padded row', () => {
		// 5 pixels × 2 bits = 10 bits → 2 bytes per row.
		const png = makePng({
			width: 5,
			height: 1,
			colorType: 3,
			depth: 2,
			rows: [[0b00011011, 0b00000000]],
			palette: [
				[0, 0, 0],
				[1, 1, 1],
				[2, 2, 2],
				[3, 3, 3]
			]
		});
		expect([...decodePng(png).data]).toEqual([0, 0, 0, 1, 1, 1, 2, 2, 2, 3, 3, 3, 0, 0, 0]);
	});

	it('scales 1-bit grayscale to 0 and 255', () => {
		const png = makePng({ width: 10, height: 2, colorType: 0, depth: 1, rows: [[0b10100000, 0b01000000], [0xff, 0xc0]] });
		const image = decodePng(png);
		expect(image).toMatchObject({ channels: 1, bitDepth: 8 });
		expect([...image.data]).toEqual([255, 0, 255, 0, 0, 0, 0, 0, 0, 255, ...Array(10).fill(255)]);
	});

	it('scales 4-bit grayscale by 17', () => {
		const png = makePng({ width: 2, height: 1, colorType: 0, depth: 4, rows: [[0x0f]] });
		expect([...decodePng(png).data]).toEqual([0, 255]);
	});
});

describe('PNG errors', () => {
	it('rejects damaged data with a user-facing error', () => {
		const png = encodePng(noiseImage(3, 8));
		png[40] ^= 0xff; // inside IDAT
		expect(() => decodePng(png)).toThrow(ImageFormatError);
	});
});
