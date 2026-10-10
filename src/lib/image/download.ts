const MIME: Record<string, string> = { png: 'image/png', tga: 'image/x-tga' };

/** Save bytes as a file through the browser's download flow. */
export function download(bytes: Uint8Array, filename: string) {
	const ext = filename.split('.').pop()?.toLowerCase() ?? '';
	const blob = new Blob([bytes as Uint8Array<ArrayBuffer>], { type: MIME[ext] ?? 'application/octet-stream' });
	const url = URL.createObjectURL(blob);
	const a = document.createElement('a');
	a.href = url;
	a.download = filename;
	a.click();
	// The click starts the download synchronously; give the browser a moment before releasing the blob.
	setTimeout(() => URL.revokeObjectURL(url), 10_000);
}
