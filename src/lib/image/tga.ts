// Truevision TGA: 24/32-bit true-color and 8-bit grayscale, raw or run-length encoded. Always 8 bits per channel.
import { ImageFormatError, type Channels, type ImageBuffer } from './types';

const HEADER_SIZE = 18;
const FOOTER_SIGNATURE = 'TRUEVISION-XFILE.\0';
const TYPE_TRUECOLOR = 2;
const TYPE_GRAY = 3;
const TYPE_RLE = 8; // added to the base type
const ORIGIN_RIGHT = 0x10;
const ORIGIN_TOP = 0x20;

const truncated = () => new ImageFormatError('This TGA file is truncated.');

/** TGA has no magic number: accept the 2.0 footer, or a header that looks sane. */
export function looksLikeTga(bytes: Uint8Array): boolean {
	if (bytes.length < HEADER_SIZE) return false;
	const tail = new TextDecoder().decode(bytes.subarray(bytes.length - FOOTER_SIGNATURE.length));
	if (tail === FOOTER_SIGNATURE) return true;
	const [, colorMapType, type] = bytes;
	const width = bytes[12] | (bytes[13] << 8);
	const height = bytes[14] | (bytes[15] << 8);
	return colorMapType <= 1 && [1, 2, 3, 9, 10, 11].includes(type) && [8, 15, 16, 24, 32].includes(bytes[16]) && width > 0 && height > 0;
}

export function decodeTga(bytes: Uint8Array): ImageBuffer {
	if (bytes.length < HEADER_SIZE) throw truncated();
	const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
	const [idLength, colorMapType, type] = bytes;
	const colorMapLength = view.getUint16(5, true);
	const colorMapEntryBits = bytes[7];
	const width = view.getUint16(12, true);
	const height = view.getUint16(14, true);
	const depth = bytes[16];
	const descriptor = bytes[17];

	const rle = type > TYPE_RLE;
	const base = rle ? type - TYPE_RLE : type;
	if (base !== TYPE_TRUECOLOR && base !== TYPE_GRAY) {
		throw new ImageFormatError(
			base === 1
				? 'Color-mapped (palette) TGA files are not supported. Save as 24- or 32-bit TGA.'
				: `Unsupported TGA image type ${type}.`
		);
	}
	if (base === TYPE_TRUECOLOR && depth !== 24 && depth !== 32) {
		throw new ImageFormatError(`${depth}-bit TGA files are not supported. Save as 24- or 32-bit TGA.`);
	}
	if (base === TYPE_GRAY && depth !== 8) throw new ImageFormatError(`${depth}-bit grayscale TGA files are not supported.`);
	if (!width || !height) throw new ImageFormatError('This TGA file has no pixels.');

	const bpp = depth / 8;
	const start = HEADER_SIZE + idLength + (colorMapType === 1 ? colorMapLength * Math.ceil(colorMapEntryBits / 8) : 0);
	const stored = new Uint8Array(width * height * bpp); // file order: rows from the origin corner, BGR(A)
	if (rle) unpackRle(bytes, start, stored, bpp);
	else {
		if (start + stored.length > bytes.length) throw truncated();
		stored.set(bytes.subarray(start, start + stored.length));
	}

	// 32-bit files that declare no alpha bits carry padding, not alpha.
	const channels: Channels = base === TYPE_GRAY ? 1 : depth === 32 && (descriptor & 0x0f) > 0 ? 4 : 3;
	const fromTop = (descriptor & ORIGIN_TOP) !== 0;
	const fromRight = (descriptor & ORIGIN_RIGHT) !== 0;
	const data = new Uint8Array(width * height * channels);
	for (let y = 0; y < height; y++) {
		const sy = fromTop ? y : height - 1 - y;
		for (let x = 0; x < width; x++) {
			const s = (sy * width + (fromRight ? width - 1 - x : x)) * bpp;
			const d = (y * width + x) * channels;
			if (channels === 1) {
				data[d] = stored[s];
				continue;
			}
			data[d] = stored[s + 2];
			data[d + 1] = stored[s + 1];
			data[d + 2] = stored[s];
			if (channels === 4) data[d + 3] = stored[s + 3];
		}
	}
	return { width, height, channels, bitDepth: 8, data };
}

/** Packets may cross scanlines (older writers do this), so decode into one flat run of pixels. */
function unpackRle(bytes: Uint8Array, offset: number, out: Uint8Array, bpp: number) {
	let o = 0;
	while (o < out.length) {
		if (offset >= bytes.length) throw truncated();
		const header = bytes[offset++];
		// Clamp a final packet that runs past the image instead of rejecting the file.
		const length = Math.min(((header & 0x7f) + 1) * bpp, out.length - o);
		if (header & 0x80) {
			if (offset + bpp > bytes.length) throw truncated();
			for (let i = 0; i < length; i++) out[o + i] = bytes[offset + (i % bpp)];
			offset += bpp;
		} else {
			if (offset + length > bytes.length) throw truncated();
			out.set(bytes.subarray(offset, offset + length), o);
			offset += length;
		}
		o += length;
	}
}

export interface TgaOptions {
	/** Run-length encode. Smaller files; uncompressed is the most widely readable. */
	rle?: boolean;
}

/** Write an 8-bit image as TGA with a bottom-left origin (the most compatible). Gray + alpha becomes RGBA. */
export function encodeTga(image: ImageBuffer, { rle = false }: TgaOptions = {}): Uint8Array {
	if (image.bitDepth !== 8) throw new Error('TGA stores 8 bits per channel; convert the image to 8-bit first.');
	const { width, height, channels, data } = image;
	if (width > 0xffff || height > 0xffff) throw new Error('TGA images are limited to 65535×65535.');

	const bpp = channels === 1 ? 1 : channels === 3 ? 3 : 4;
	const pixels = new Uint8Array(width * height * bpp);
	for (let y = 0; y < height; y++) {
		const sy = height - 1 - y;
		for (let x = 0; x < width; x++) {
			const s = (sy * width + x) * channels;
			const d = (y * width + x) * bpp;
			if (channels === 1) pixels[d] = data[s];
			else if (channels === 2) {
				pixels[d] = pixels[d + 1] = pixels[d + 2] = data[s];
				pixels[d + 3] = data[s + 1];
			} else {
				pixels[d] = data[s + 2];
				pixels[d + 1] = data[s + 1];
				pixels[d + 2] = data[s];
				if (bpp === 4) pixels[d + 3] = data[s + 3];
			}
		}
	}

	const body = rle ? packRle(pixels, width, height, bpp) : pixels;
	const out = new Uint8Array(HEADER_SIZE + body.length + 8 + FOOTER_SIGNATURE.length);
	const view = new DataView(out.buffer);
	out[2] = (channels === 1 ? TYPE_GRAY : TYPE_TRUECOLOR) + (rle ? TYPE_RLE : 0);
	view.setUint16(12, width, true);
	view.setUint16(14, height, true);
	out[16] = bpp * 8;
	out[17] = bpp === 4 ? 8 : 0; // alpha bits; origin bottom-left
	out.set(body, HEADER_SIZE);
	// TGA 2.0 footer with no extension or developer areas.
	out.set(new TextEncoder().encode(FOOTER_SIGNATURE), out.length - FOOTER_SIGNATURE.length);
	return out;
}

/** Run-length encode per scanline (packets never cross rows, as TGA 2.0 requires). */
function packRle(pixels: Uint8Array, width: number, height: number, bpp: number): Uint8Array {
	// Worst case is all raw packets: one header byte per 128 pixels, plus one per row for the split.
	const out = new Uint8Array(pixels.length + Math.ceil((width * height) / 128) + height);
	const same = (a: number, b: number) => {
		for (let c = 0; c < bpp; c++) if (pixels[a * bpp + c] !== pixels[b * bpp + c]) return false;
		return true;
	};
	let o = 0;
	for (let y = 0; y < height; y++) {
		const end = (y + 1) * width;
		let i = y * width;
		while (i < end) {
			let run = 1;
			while (i + run < end && run < 128 && same(i, i + run)) run++;
			if (run > 1) {
				out[o++] = 0x80 | (run - 1);
				out.set(pixels.subarray(i * bpp, (i + 1) * bpp), o);
				o += bpp;
				i += run;
				continue;
			}
			// Raw packet: stop where the next run of two or more begins.
			let n = 1;
			while (i + n < end && n < 128 && !(i + n + 1 < end && same(i + n, i + n + 1))) n++;
			out[o++] = n - 1;
			out.set(pixels.subarray(i * bpp, (i + n) * bpp), o);
			o += n * bpp;
			i += n;
		}
	}
	return out.subarray(0, o);
}
