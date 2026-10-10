// Main-thread API for the codec worker. The worker starts on first use.
import type { CodecJob, CodecRequest, CodecResponse } from './codec.worker';
import type { EncodeOptions } from './codecs';
import { ImageFormatError, type DecodedImage, type ImageBuffer, type ImageFormat } from './types';

let worker: Worker | undefined;
let nextId = 1;
const pending = new Map<number, { resolve: (value: unknown) => void; reject: (error: Error) => void }>();

function getWorker() {
	if (worker) return worker;
	worker = new Worker(new URL('./codec.worker.ts', import.meta.url), { type: 'module', name: 'image-codec' });
	worker.onmessage = (e: MessageEvent<CodecResponse>) => {
		const res = e.data;
		const job = pending.get(res.id);
		if (!job) return;
		pending.delete(res.id);
		if (res.ok) job.resolve(res.result);
		else job.reject(res.userError ? new ImageFormatError(res.message) : new Error(res.message));
	};
	worker.onerror = (e) => {
		// A crashed worker fails everything in flight; the next call starts a fresh one.
		const error = new Error(e.message || 'The image codec worker failed.');
		for (const job of pending.values()) job.reject(error);
		pending.clear();
		worker?.terminate();
		worker = undefined;
	};
	return worker;
}

function run<T>(job: CodecJob, transfer: Transferable[]): Promise<T> {
	const id = nextId++;
	return new Promise<T>((resolve, reject) => {
		pending.set(id, { resolve: resolve as (value: unknown) => void, reject });
		getWorker().postMessage({ ...job, id } satisfies CodecRequest, transfer);
	});
}

/** Decode a PNG or TGA file. Rejects with ImageFormatError (user-facing message) for unreadable files. */
export async function decodeFile(file: File): Promise<DecodedImage> {
	return decodeBytes(await file.arrayBuffer(), file.name);
}

/** Decode file contents. `bytes` is transferred to the worker and unusable afterwards. */
export function decodeBytes(bytes: ArrayBuffer, name = ''): Promise<DecodedImage> {
	return run({ op: 'decode', bytes, name }, [bytes]);
}

/** Encode to PNG or TGA. `image.data` is transferred to the worker and unusable afterwards. */
export function encodeImageFile(image: ImageBuffer, format: ImageFormat, options: EncodeOptions = {}): Promise<Uint8Array> {
	return run({ op: 'encode', image, format, options }, [image.data.buffer as ArrayBuffer]);
}
