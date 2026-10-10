import { describe, expect, it } from 'vitest';
import { decodeImage, detectFormat, encodeImage } from '$lib/image/codecs';
import { ImageFormatError } from '$lib/image/types';
import { paddedRowBytes, stripRowPadding } from '$lib/gpu/readback';
import { describeAdapter } from '$lib/gpu/device';
import { noiseImage } from './helpers';

describe('format detection', () => {
	it('recognizes PNG by signature and TGA by footer or name', () => {
		const image = noiseImage(3, 8);
		expect(detectFormat(encodeImage(image, 'png'))).toBe('png');
		expect(detectFormat(encodeImage(image, 'tga'))).toBe('tga');
		expect(detectFormat(new Uint8Array(20), 'old.TGA')).toBe('tga');
	});

	it('decodes either format through one entry point', () => {
		const image = noiseImage(4, 8);
		expect(decodeImage(encodeImage(image, 'png')).format).toBe('png');
		expect(decodeImage(encodeImage(image, 'tga', { tgaRle: true })).image.data).toEqual(image.data);
	});

	it('names formats it does not support', () => {
		const jpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, ...Array(30).fill(0)]);
		expect(() => decodeImage(jpeg, 'photo.jpg')).toThrow(ImageFormatError);
		expect(() => decodeImage(jpeg, 'photo.jpg')).toThrow('It is a JPEG image');
		expect(() => decodeImage(new Uint8Array([1, 2, 3]), 'notes.txt')).toThrow('It is not a PNG or TGA image');
	});
});

describe('readback row padding', () => {
	it('pads rows to 256 bytes', () => {
		expect(paddedRowBytes(8)).toBe(256);
		expect(paddedRowBytes(256)).toBe(256);
		expect(paddedRowBytes(257)).toBe(512);
	});

	it('strips padding into a tight buffer', () => {
		const tight = 3;
		const padded = 8;
		const src = new Uint8Array([1, 2, 3, 0, 0, 0, 0, 0, 4, 5, 6, 0, 0, 0, 0, 0]);
		const dst = new Uint8Array(8).fill(9);
		stripRowPadding(src, dst, 2, tight, padded, 2);
		expect([...dst]).toEqual([9, 9, 1, 2, 3, 4, 5, 6]);
	});
});

describe('adapter names', () => {
	it('prefers the description, then vendor and architecture', () => {
		expect(describeAdapter({ vendor: 'nvidia', architecture: 'ampere', description: 'RTX 3080' })).toBe('RTX 3080');
		expect(describeAdapter({ vendor: 'nvidia', architecture: 'ampere', description: '' })).toBe('NVIDIA Ampere');
		expect(describeAdapter({ vendor: 'acme', architecture: '', description: '' })).toBe('Acme');
		expect(describeAdapter(undefined)).toBe('WebGPU adapter');
	});
});
