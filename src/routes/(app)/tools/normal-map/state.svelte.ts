// Normal Map Editor state. `Settings` change the output (and will be undoable); `View` only changes the display.
import { initGpu, type Gpu, type GpuFailure } from '$lib/gpu/device';
import { decodeFile, encodeImageFile } from '$lib/image/codec';
import { fromRGBA16 } from '$lib/image/convert';
import { download } from '$lib/image/download';
import type { ImageBuffer, ImageFormat } from '$lib/image/types';
import { domeRadius, lightAtPoint } from './lighting';
import { processParams } from './normalmap';
import { Renderer } from './renderer';

export type Convention = 'opengl' | 'directx';
export type BlendMethod = 'rnm' | 'whiteout' | 'udn' | 'linear';
export type LayerId = 'output' | 'base' | 'detail';

export interface Settings {
	base: { convention: Convention; strength: number };
	detail: {
		convention: Convention;
		strength: number;
		method: BlendMethod;
		tiling: [number, number];
		offset: [number, number];
	} | null;
	output: { convention: Convention; format: 'png' | 'tga'; bitDepth: 8 | 16 };
}

export interface View {
	mode: 'wipe' | 'lit' | 'raw';
	/** Divider position across the viewer, 0..1; lit on the left. */
	wipe: number;
	/** Degrees; see lighting.ts. `shininess` is the Blinn-Phong exponent, used when `specular` is on. */
	light: { azimuth: number; elevation: number; specular: boolean; shininess: number };
	zoom: number;
	pan: [number, number];
	channel: 'rgb' | 'r' | 'g' | 'b' | 'a';
	tile3x3: boolean;
	tool: 'pan' | 'light';
}

export const defaultSettings = (): Settings => ({
	base: { convention: 'opengl', strength: 1 },
	detail: null,
	output: { convention: 'opengl', format: 'png', bitDepth: 16 }
});

export const defaultView = (): View => ({
	mode: 'wipe',
	wipe: 0.5,
	light: { azimuth: 135, elevation: 45, specular: false, shininess: 10 },
	zoom: 1,
	pan: [0, 0],
	channel: 'rgb',
	tile3x3: false,
	tool: 'pan'
});

export type GpuStatus =
	| { state: 'starting' }
	| { state: 'ready'; gpu: Gpu }
	| { state: 'failed'; failure: GpuFailure }
	| { state: 'lost'; message: string };

export interface SourceImage {
	name: string;
	format: ImageFormat;
	fileBytes: number;
	/** Kept on the CPU so it can be re-uploaded after a lost GPU device. */
	image: ImageBuffer;
}

/** Highest Blinn-Phong exponent offered; above it the highlight barely changes on typical maps. */
export const MAX_SHININESS = 20;

/** Zoom presets for the zoom buttons, as in classic image viewers. */
export const ZOOM_STEPS = [1 / 16, 1 / 8, 1 / 4, 1 / 3, 1 / 2, 2 / 3, 1, 1.5, 2, 3, 4, 6, 8, 16, 32];
const MIN_ZOOM = 1 / 64;
const MAX_ZOOM = 64;

const messageOf = (err: unknown) => (err instanceof Error ? err.message : String(err));

export class NormalMapState {
	settings = $state(defaultSettings());
	view = $state(defaultView());
	/** Node selected in the Layers tree; picks what the property grid shows. */
	layer = $state<LayerId>('output');
	/** Raw: holds a GPUDevice, which must not be proxied. Each change is a new object. */
	gpuStatus = $state.raw<GpuStatus>({ state: 'starting' });
	renderer = $state.raw<Renderer | null>(null);
	base = $state.raw<SourceImage | null>(null);
	/** Viewer canvas size in device pixels. */
	viewerSize = $state.raw<[number, number]>([0, 0]);
	/** Wall time of the last processing pass. */
	processMs = $state<number | null>(null);
	/** What the app is busy doing, for the status bar. */
	busy = $state<string | null>(null);
	/** An error to show the user. */
	error = $state<string | null>(null);

	/** Acquire the GPU, replacing any current device (also used to recover from a lost device). */
	async startGpu() {
		this.stopGpu();
		this.gpuStatus = { state: 'starting' };
		const result = await initGpu({
			onLost: (message) => {
				this.renderer?.destroy();
				this.renderer = null;
				this.gpuStatus = { state: 'lost', message };
			}
		});
		if (!result.ok) {
			this.gpuStatus = { state: 'failed', failure: result };
			return;
		}
		try {
			const renderer = await Renderer.create(result.device);
			renderer.onProcessed = (ms) => (this.processMs = ms);
			if (this.base) await this.restoreBase(renderer, this.base);
			this.renderer = renderer;
			this.gpuStatus = { state: 'ready', gpu: result };
		} catch (err) {
			result.destroy();
			const message = `The GPU could not run this tool: ${messageOf(err)}`;
			this.gpuStatus = { state: 'failed', failure: { reason: 'device-failed', message } };
		}
	}

	private async restoreBase(renderer: Renderer, base: SourceImage) {
		try {
			await renderer.setBase(base.image);
		} catch (err) {
			this.base = null;
			this.error = `${base.name} could not be restored on the GPU: ${messageOf(err)}`;
		}
	}

	stopGpu() {
		this.renderer?.destroy();
		this.renderer = null;
		if (this.gpuStatus.state === 'ready') this.gpuStatus.gpu.destroy();
	}

	async open(file: File) {
		const renderer = this.renderer;
		if (!renderer) {
			this.error = 'Images can only be opened while the GPU is available.';
			return;
		}
		this.busy = `Opening ${file.name}…`;
		try {
			const { format, image } = await decodeFile(file);
			if (this.renderer !== renderer) return; // the device changed while decoding
			await renderer.setBase(image);
			this.base = { name: file.name, format, fileBytes: file.size, image };
			this.applySourceDefaults();
			this.zoomInitial();
		} catch (err) {
			this.error = `Cannot open ${file.name}. ${messageOf(err)}`;
		} finally {
			this.busy = null;
		}
	}

	close() {
		this.base = null;
		this.renderer?.clearBase();
		this.processMs = null;
	}

	/** Export defaults follow the source: same format, same bit depth. */
	private applySourceDefaults() {
		if (!this.base) return;
		this.settings.output.format = this.base.format;
		this.settings.output.bitDepth = this.base.image.bitDepth;
	}

	/** Bit depth actually written: TGA is always 8-bit. */
	get exportBitDepth(): 8 | 16 {
		return this.settings.output.format === 'tga' ? 8 : this.settings.output.bitDepth;
	}

	async exportImage(filename: string, { tgaRle = false } = {}) {
		const { base, renderer } = this;
		if (!base || !renderer) return;
		this.busy = `Exporting ${filename}…`;
		try {
			renderer.setProcess(processParams(this.settings));
			const rgba = await renderer.readOutput();
			const { width, height, channels } = base.image;
			const hasAlpha = channels === 2 || channels === 4;
			const image = fromRGBA16(rgba, width, height, this.exportBitDepth, hasAlpha ? 4 : 3);
			download(await encodeImageFile(image, this.settings.output.format, { tgaRle }), filename);
		} catch (err) {
			this.error = `Cannot export ${filename}. ${messageOf(err)}`;
		} finally {
			this.busy = null;
		}
	}

	resetSettings() {
		this.settings = defaultSettings();
		this.applySourceDefaults();
	}

	/** Flip G: switch the output convention between OpenGL and DirectX. */
	flipGreen() {
		const out = this.settings.output;
		out.convention = out.convention === 'opengl' ? 'directx' : 'opengl';
	}

	// --- Zoom and pan. Anchors are device pixels from the viewer center. ---

	private setZoom(zoom: number, anchor: [number, number] = [0, 0]) {
		const z0 = this.view.zoom;
		const z = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, zoom));
		// Keep the image point under the anchor where it is.
		const k = 1 / z0 - 1 / z;
		this.view.pan = this.clampPan([this.view.pan[0] + anchor[0] * k, this.view.pan[1] + anchor[1] * k]);
		this.view.zoom = z;
	}

	zoomIn() {
		this.setZoom(ZOOM_STEPS.find((z) => z > this.view.zoom * 1.001) ?? this.view.zoom * 2);
	}

	zoomOut() {
		this.setZoom(ZOOM_STEPS.findLast((z) => z < this.view.zoom * 0.999) ?? this.view.zoom / 2);
	}

	/** Continuous zoom (mouse wheel, pinch) around an anchor point. */
	zoomBy(factor: number, anchor?: [number, number]) {
		this.setZoom(this.view.zoom * factor, anchor);
	}

	zoomActual() {
		this.view.zoom = 1;
		this.view.pan = [0, 0];
	}

	zoomFit() {
		const [vw, vh] = this.viewerSize;
		if (!this.base || !vw || !vh) return this.zoomActual();
		this.view.zoom = Math.min(vw / this.base.image.width, vh / this.base.image.height);
		this.view.pan = [0, 0];
	}

	/** On open: fit large images, show small ones at 100%. */
	private zoomInitial() {
		this.zoomFit();
		if (this.view.zoom > 1) this.zoomActual();
	}

	/** Pan by a drag of (dx, dy) device pixels. */
	panBy(dx: number, dy: number) {
		const z = this.view.zoom;
		this.view.pan = this.clampPan([this.view.pan[0] - dx / z, this.view.pan[1] - dy / z]);
	}

	/** Light tool: point the light at a spot on the dome, given in device pixels from the viewer center. */
	aimLight(dx: number, dy: number) {
		const { azimuth, elevation } = lightAtPoint(dx, dy, domeRadius(...this.viewerSize));
		this.view.light.azimuth = azimuth;
		this.view.light.elevation = elevation;
	}

	/** Keep the view center over the image. */
	private clampPan([x, y]: [number, number]): [number, number] {
		if (!this.base) return [0, 0];
		const hw = this.base.image.width / 2;
		const hh = this.base.image.height / 2;
		return [Math.min(hw, Math.max(-hw, x)), Math.min(hh, Math.max(-hh, y))];
	}
}
