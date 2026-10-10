// Image textures. All image data on the GPU is rgba16uint: exact for 16-bit sources, and 8-bit sources
// scale by 257, also exact. 8 bytes per pixel (4K ≈ 134 MB, 8K ≈ 537 MB).
import { toRGBA16 } from '$lib/image/convert';
import type { ImageBuffer } from '$lib/image/types';

export const IMAGE_FORMAT = 'rgba16uint' satisfies GPUTextureFormat;
export const IMAGE_BYTES_PER_PIXEL = 8;

/** Upload in strips of about this many bytes, so an 8K image never needs a 537 MB staging copy. */
const UPLOAD_STRIP_BYTES = 32 * 1024 * 1024;

/** A message for the user if the image can't live on this device, otherwise null. */
export function imageSizeProblem(device: GPUDevice, width: number, height: number): string | null {
	const max = device.limits.maxTextureDimension2D;
	if (width > max || height > max) {
		return `This image is ${width}×${height} pixels, but your GPU supports at most ${max}×${max}.`;
	}
	return null;
}

export function createImageTexture(
	device: GPUDevice,
	width: number,
	height: number,
	label: string,
	usage = GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST | GPUTextureUsage.COPY_SRC
): GPUTexture {
	const problem = imageSizeProblem(device, width, height);
	if (problem) throw new Error(problem);
	return device.createTexture({ label, size: [width, height], format: IMAGE_FORMAT, usage });
}

/** Create an rgba16uint texture holding the image. */
export function uploadImage(device: GPUDevice, image: ImageBuffer, label: string): GPUTexture {
	const texture = createImageTexture(device, image.width, image.height, label);
	const rowBytes = image.width * IMAGE_BYTES_PER_PIXEL;
	const stripRows = Math.max(1, Math.floor(UPLOAD_STRIP_BYTES / rowBytes));
	for (let y = 0; y < image.height; y += stripRows) {
		const rows = Math.min(stripRows, image.height - y);
		device.queue.writeTexture(
			{ texture, origin: [0, y] },
			toRGBA16(image, y, rows),
			{ bytesPerRow: rowBytes, rowsPerImage: rows },
			[image.width, rows]
		);
	}
	return texture;
}
