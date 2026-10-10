// Texture → CPU. copyTextureToBuffer needs bytesPerRow padded to a multiple of 256; we strip it again.
import { IMAGE_BYTES_PER_PIXEL } from './textures';

const ROW_ALIGNMENT = 256;
/** Read back in chunks of about this size, so huge images don't need one giant mappable buffer. */
const CHUNK_BYTES = 64 * 1024 * 1024;

export const paddedRowBytes = (tightBytes: number) => Math.ceil(tightBytes / ROW_ALIGNMENT) * ROW_ALIGNMENT;

/** Copy `rows` rows from a padded layout into a tight one at `dstOffset`. */
export function stripRowPadding(
	src: Uint8Array,
	dst: Uint8Array,
	rows: number,
	tightBytes: number,
	paddedBytes: number,
	dstOffset = 0
) {
	for (let r = 0; r < rows; r++) {
		dst.set(src.subarray(r * paddedBytes, r * paddedBytes + tightBytes), dstOffset + r * tightBytes);
	}
}

/** Read a whole texture as tightly packed bytes. */
export async function readTexture(device: GPUDevice, texture: GPUTexture, bytesPerTexel: number): Promise<Uint8Array> {
	const { width, height } = texture;
	const tight = width * bytesPerTexel;
	const padded = paddedRowBytes(tight);
	const chunkRows = Math.max(1, Math.min(height, Math.floor(CHUNK_BYTES / padded)));
	const out = new Uint8Array(tight * height);

	for (let y = 0; y < height; y += chunkRows) {
		const rows = Math.min(chunkRows, height - y);
		const buffer = device.createBuffer({
			label: 'readback',
			size: padded * rows,
			usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ
		});
		const encoder = device.createCommandEncoder({ label: 'readback' });
		encoder.copyTextureToBuffer(
			{ texture, origin: [0, y] },
			{ buffer, bytesPerRow: padded, rowsPerImage: rows },
			[width, rows]
		);
		device.queue.submit([encoder.finish()]);
		try {
			await buffer.mapAsync(GPUMapMode.READ);
			stripRowPadding(new Uint8Array(buffer.getMappedRange()), out, rows, tight, padded, y * tight);
		} finally {
			buffer.destroy();
		}
	}
	return out;
}

/** Read an rgba16uint image texture as RGBA16 values. */
export async function readImageTexture(device: GPUDevice, texture: GPUTexture): Promise<Uint16Array> {
	const bytes = await readTexture(device, texture, IMAGE_BYTES_PER_PIXEL);
	return new Uint16Array(bytes.buffer, bytes.byteOffset, bytes.byteLength / 2);
}
