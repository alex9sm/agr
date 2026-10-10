export type BitDepth = 8 | 16;

/** 1 = gray, 2 = gray + alpha, 3 = RGB, 4 = RGBA. */
export type Channels = 1 | 2 | 3 | 4;

/** Decoded pixels: interleaved channels, rows top to bottom, no padding. Values are raw, never color managed. */
export type ImageBuffer = {
	width: number;
	height: number;
	channels: Channels;
} & ({ bitDepth: 8; data: Uint8Array } | { bitDepth: 16; data: Uint16Array });

export type ImageFormat = 'png' | 'tga';

export interface DecodedImage {
	format: ImageFormat;
	image: ImageBuffer;
}

/** A file that can't be read as an image; the message is meant for the user. */
export class ImageFormatError extends Error {
	override name = 'ImageFormatError';
}
