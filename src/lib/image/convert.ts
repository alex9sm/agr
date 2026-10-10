// Conversions between ImageBuffer and the RGBA16 layout used on the GPU.
import type { BitDepth, Channels, ImageBuffer } from './types';

/**
 * Expand rows [y0, y0 + rows) of an image to RGBA16. 8-bit values scale by 257 (exact: 255 → 65535),
 * gray is copied to R, G and B, and a missing alpha channel becomes opaque.
 */
export function toRGBA16(image: ImageBuffer, y0 = 0, rows = image.height - y0): Uint16Array {
	const { width, channels, data } = image;
	const scale = image.bitDepth === 8 ? 257 : 1;
	const out = new Uint16Array(width * rows * 4);
	const start = y0 * width;
	for (let i = 0; i < width * rows; i++) {
		const s = (start + i) * channels;
		const d = i * 4;
		if (channels >= 3) {
			out[d] = data[s] * scale;
			out[d + 1] = data[s + 1] * scale;
			out[d + 2] = data[s + 2] * scale;
		} else {
			out[d] = out[d + 1] = out[d + 2] = data[s] * scale;
		}
		out[d + 3] = channels === 2 || channels === 4 ? data[s + channels - 1] * scale : 65535;
	}
	return out;
}

/** Pack RGBA16 into an ImageBuffer. 8-bit output rounds `v / 257` to nearest; 1–2 channel output takes gray from R. */
export function fromRGBA16(
	rgba: Uint16Array,
	width: number,
	height: number,
	bitDepth: BitDepth,
	channels: Channels
): ImageBuffer {
	const count = width * height;
	const data = bitDepth === 8 ? new Uint8Array(count * channels) : new Uint16Array(count * channels);
	const q = bitDepth === 8 ? (v: number) => Math.round(v / 257) : (v: number) => v;
	for (let i = 0; i < count; i++) {
		const s = i * 4;
		const d = i * channels;
		if (channels >= 3) {
			data[d] = q(rgba[s]);
			data[d + 1] = q(rgba[s + 1]);
			data[d + 2] = q(rgba[s + 2]);
		} else {
			data[d] = q(rgba[s]);
		}
		if (channels === 2 || channels === 4) data[d + channels - 1] = q(rgba[s + 3]);
	}
	return bitDepth === 8
		? { width, height, channels, bitDepth, data: data as Uint8Array }
		: { width, height, channels, bitDepth, data: data as Uint16Array };
}
