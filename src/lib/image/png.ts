// PNG 8/16-bit via fast-png. Gamma, ICC and color-key transparency are ignored: normal maps are data.
import { convertIndexedToRgb, decode, encode } from 'fast-png';
import { ImageFormatError, type Channels, type ImageBuffer } from './types';

export function decodePng(bytes: Uint8Array): ImageBuffer {
	let png;
	try {
		png = decode(bytes);
	} catch (err) {
		throw new ImageFormatError(`This PNG file is damaged or unsupported (${(err as Error).message}).`);
	}
	const { width, height } = png;

	if (png.palette) {
		const channels = png.palette[0]?.length === 4 ? 4 : 3;
		return { width, height, channels, bitDepth: 8, data: convertIndexedToRgb(png) };
	}

	const channels = png.channels as Channels;
	if (png.depth === 16) return { width, height, channels, bitDepth: 16, data: png.data as Uint16Array };
	if (png.depth === 8) return { width, height, channels, bitDepth: 8, data: new Uint8Array(png.data.buffer, png.data.byteOffset, png.data.length) };
	// 1, 2 and 4 bits only exist for grayscale (palettes were handled above).
	return { width, height, channels: 1, bitDepth: 8, data: unpackGray(png.data as Uint8Array, width, height, png.depth) };
}

/** Unpack sub-byte grayscale rows (each padded to a whole byte) to 8-bit, scaling to 0..255. */
function unpackGray(packed: Uint8Array, width: number, height: number, depth: number): Uint8Array {
	const rowBytes = Math.ceil((width * depth) / 8);
	const mask = (1 << depth) - 1;
	const scale = 255 / mask;
	const out = new Uint8Array(width * height);
	for (let y = 0; y < height; y++) {
		for (let x = 0; x < width; x++) {
			const bit = x * depth;
			const byte = packed[y * rowBytes + (bit >> 3)];
			out[y * width + x] = ((byte >> (8 - depth - (bit & 7))) & mask) * scale;
		}
	}
	return out;
}

export function encodePng(image: ImageBuffer): Uint8Array {
	return encode({
		width: image.width,
		height: image.height,
		data: image.data,
		depth: image.bitDepth,
		channels: image.channels
	});
}
