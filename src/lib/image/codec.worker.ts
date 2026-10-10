// Runs image decode/encode off the main thread. Pixel and file buffers are transferred, not copied.
import { decodeImage, encodeImage, type EncodeOptions } from './codecs';
import { ImageFormatError, type ImageBuffer, type ImageFormat } from './types';

export type CodecJob =
	| { op: 'decode'; bytes: ArrayBuffer; name: string }
	| { op: 'encode'; image: ImageBuffer; format: ImageFormat; options: EncodeOptions };

export type CodecRequest = CodecJob & { id: number };

export type CodecResponse =
	| { id: number; ok: true; result: unknown }
	| { id: number; ok: false; message: string; userError: boolean };

self.onmessage = (e: MessageEvent<CodecRequest>) => {
	const job = e.data;
	try {
		if (job.op === 'decode') {
			const result = decodeImage(new Uint8Array(job.bytes), job.name);
			reply({ id: job.id, ok: true, result }, [result.image.data.buffer as ArrayBuffer]);
		} else {
			const result = encodeImage(job.image, job.format, job.options);
			reply({ id: job.id, ok: true, result }, [result.buffer as ArrayBuffer]);
		}
	} catch (err) {
		const message = err instanceof Error ? err.message : String(err);
		reply({ id: job.id, ok: false, message, userError: err instanceof ImageFormatError });
	}
};

function reply(response: CodecResponse, transfer: Transferable[] = []) {
	self.postMessage(response, { transfer });
}
