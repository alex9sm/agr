import { describe, expect, it } from 'vitest';
import { fromRGBA16, toRGBA16 } from '$lib/image/convert';
import { noiseImage } from './helpers';

describe('toRGBA16', () => {
	it('scales 8-bit exactly by 257', () => {
		const out = toRGBA16({ width: 1, height: 1, channels: 4, bitDepth: 8, data: new Uint8Array([0, 1, 128, 255]) });
		expect([...out]).toEqual([0, 257, 32896, 65535]);
	});

	it('copies gray to RGB and fills missing alpha', () => {
		const gray = toRGBA16({ width: 1, height: 1, channels: 1, bitDepth: 16, data: new Uint16Array([1234]) });
		expect([...gray]).toEqual([1234, 1234, 1234, 65535]);
		const grayAlpha = toRGBA16({ width: 1, height: 1, channels: 2, bitDepth: 16, data: new Uint16Array([5, 6]) });
		expect([...grayAlpha]).toEqual([5, 5, 5, 6]);
		const rgb = toRGBA16({ width: 1, height: 1, channels: 3, bitDepth: 16, data: new Uint16Array([1, 2, 3]) });
		expect([...rgb]).toEqual([1, 2, 3, 65535]);
	});

	it('converts a row range', () => {
		const image = noiseImage(3, 16, 5, 4);
		expect(toRGBA16(image, 1, 2)).toEqual(toRGBA16(image).subarray(5 * 4, 3 * 5 * 4));
	});
});

describe('fromRGBA16', () => {
	it('round-trips 8- and 16-bit images', () => {
		for (const image of [noiseImage(4, 8), noiseImage(3, 8), noiseImage(4, 16), noiseImage(3, 16)]) {
			const back = fromRGBA16(toRGBA16(image), image.width, image.height, image.bitDepth, image.channels);
			expect(back.data).toEqual(image.data);
		}
	});

	it('quantizes to 8-bit by rounding v / 257', () => {
		const out = fromRGBA16(new Uint16Array([128, 129, 32896, 65535]), 1, 1, 8, 4);
		expect([...out.data]).toEqual([0, 1, 128, 255]);
	});

	it('takes gray from R', () => {
		const out = fromRGBA16(new Uint16Array([100, 200, 300, 400]), 1, 1, 16, 2);
		expect([...out.data]).toEqual([100, 400]);
	});
});
