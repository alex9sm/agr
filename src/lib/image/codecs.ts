// Format detection and dispatch. Synchronous; the app calls these through the codec worker.
import { decodePng, encodePng } from './png';
import { decodeTga, encodeTga, looksLikeTga } from './tga';
import { ImageFormatError, type DecodedImage, type ImageBuffer, type ImageFormat } from './types';

const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

const startsWith = (bytes: Uint8Array, sig: (number | string)[], at = 0) =>
	sig.every((s, i) => bytes[at + i] === (typeof s === 'string' ? s.charCodeAt(0) : s));

/** Recognizable formats we don't read, for a clearer message than "not an image". */
function otherFormat(bytes: Uint8Array): string | null {
	if (startsWith(bytes, [0xff, 0xd8, 0xff])) return 'JPEG';
	if (startsWith(bytes, ['G', 'I', 'F', '8'])) return 'GIF';
	if (startsWith(bytes, ['B', 'M'])) return 'BMP';
	if (startsWith(bytes, ['R', 'I', 'F', 'F']) && startsWith(bytes, ['W', 'E', 'B', 'P'], 8)) return 'WebP';
	if (startsWith(bytes, [0x76, 0x2f, 0x31, 0x01])) return 'OpenEXR';
	if (startsWith(bytes, ['D', 'D', 'S', ' '])) return 'DDS';
	if (startsWith(bytes, ['I', 'I', 0x2a, 0]) || startsWith(bytes, ['M', 'M', 0, 0x2a])) return 'TIFF';
	return null;
}

export function detectFormat(bytes: Uint8Array, name = ''): ImageFormat | null {
	if (startsWith(bytes, PNG_SIGNATURE)) return 'png';
	if (otherFormat(bytes)) return null;
	if (/\.tga$/i.test(name) || looksLikeTga(bytes)) return 'tga';
	return null;
}

export function decodeImage(bytes: Uint8Array, name = ''): DecodedImage {
	const format = detectFormat(bytes, name);
	if (format === 'png') return { format, image: decodePng(bytes) };
	if (format === 'tga') return { format, image: decodeTga(bytes) };
	const other = otherFormat(bytes);
	throw new ImageFormatError(
		other ? `It is a ${other} image; only PNG and TGA files are supported.` : 'It is not a PNG or TGA image.'
	);
}

export interface EncodeOptions {
	/** Run-length encode TGA output. */
	tgaRle?: boolean;
}

export function encodeImage(image: ImageBuffer, format: ImageFormat, options: EncodeOptions = {}): Uint8Array {
	return format === 'png' ? encodePng(image) : encodeTga(image, { rle: options.tgaRle });
}
