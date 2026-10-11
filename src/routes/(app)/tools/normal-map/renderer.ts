// Owns the tool's GPU resources and runs the passes:
//   base + detail (rgba16uint) ─ process.wgsl ─► output (rgba16uint) ─ display.wgsl ─► canvas
// Settings changes re-run both passes, view changes only the display pass; either way at most once per frame.
import { bindGroup, computePipeline, createShader, renderPipeline, workgroupCount } from '$lib/gpu/pipeline';
import { readImageTexture } from '$lib/gpu/readback';
import { createImageTexture, imageSizeProblem, uploadImage } from '$lib/gpu/textures';
import type { ImageBuffer } from '$lib/image/types';
import { halfVector, lightVector, type Light } from './lighting';
import { BLEND_METHODS, type ProcessParams } from './normalmap';
import displayWgsl from './display.wgsl?raw';
import processWgsl from './process.wgsl?raw';

export interface ViewParams {
	/** Device pixels per image pixel. */
	zoom: number;
	/** View center relative to the image center, in image pixels. */
	pan: [number, number];
	/** Part of the canvas width, from the left, that shows the lit surface; the rest shows the raw output. */
	lit: number;
	light: Light;
	/** Blinn-Phong exponent of the specular highlight, or 0 for none. */
	shininess: number;
}

const BACKGROUND = { r: 0.502, g: 0.502, b: 0.502, a: 1 };

export class Renderer {
	private base: GPUTexture | null = null;
	private detail: GPUTexture | null = null;
	private output: GPUTexture | null = null;
	private processBind: GPUBindGroup | null = null;
	private displayBind: GPUBindGroup | null = null;
	private context: GPUCanvasContext | null = null;
	private canvas: HTMLCanvasElement | null = null;
	private params: ProcessParams = { strength: 1, flipInput: false, flipOutput: false };
	private view: ViewParams = {
		zoom: 1,
		pan: [0, 0],
		lit: 0.5,
		light: { azimuth: 135, elevation: 45 },
		shininess: 0
	};
	private needsProcess = false;
	private needsRender = false;
	private frame = 0;
	private readonly paramsBuffer: GPUBuffer;
	private readonly viewBuffer: GPUBuffer;
	/** Bound in the detail slot when there is no detail map. */
	private readonly noDetail: GPUTexture;

	/** Called with the wall time of each processing pass, in ms. */
	onProcessed?: (ms: number) => void;

	private constructor(
		readonly device: GPUDevice,
		private readonly processPipeline: GPUComputePipeline,
		private readonly displayPipeline: GPURenderPipeline,
		private readonly format: GPUTextureFormat
	) {
		const uniform = GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST;
		this.paramsBuffer = device.createBuffer({ label: 'process params', size: 48, usage: uniform });
		this.viewBuffer = device.createBuffer({ label: 'view', size: 64, usage: uniform });
		this.noDetail = createImageTexture(device, 1, 1, 'no detail');
	}

	static async create(device: GPUDevice): Promise<Renderer> {
		const format = navigator.gpu.getPreferredCanvasFormat();
		const [processModule, displayModule] = await Promise.all([
			createShader(device, processWgsl, 'process.wgsl'),
			createShader(device, displayWgsl, 'display.wgsl')
		]);
		const [processPipeline, displayPipeline] = await Promise.all([
			computePipeline(device, processModule, 'process'),
			renderPipeline(device, displayModule, 'display', format)
		]);
		return new Renderer(device, processPipeline, displayPipeline, format);
	}

	get imageSize(): [number, number] | null {
		return this.base ? [this.base.width, this.base.height] : null;
	}

	/** Upload a new base map. Throws a user-facing Error if it doesn't fit on the GPU. */
	async setBase(image: ImageBuffer) {
		const { device } = this;
		const problem = imageSizeProblem(device, image.width, image.height);
		if (problem) throw new Error(problem);

		device.pushErrorScope('out-of-memory');
		const base = uploadImage(device, image, 'base');
		const output = createImageTexture(
			device,
			image.width,
			image.height,
			'output',
			GPUTextureUsage.STORAGE_BINDING | GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_SRC
		);
		if (await device.popErrorScope()) {
			base.destroy();
			output.destroy();
			throw new Error(`There is not enough GPU memory for a ${image.width}×${image.height} image.`);
		}

		this.clearBase();
		this.base = base;
		this.output = output;
		this.bindProcess();
		this.displayBind = bindGroup(device, this.displayPipeline, [output.createView(), { buffer: this.viewBuffer }]);
		this.invalidate(true);
	}

	clearBase() {
		this.base?.destroy();
		this.output?.destroy();
		this.base = this.output = null;
		this.processBind = this.displayBind = null;
		this.invalidate(false);
	}

	/** Upload a new detail map. Throws a user-facing Error if it doesn't fit on the GPU. */
	async setDetail(image: ImageBuffer) {
		const { device } = this;
		const problem = imageSizeProblem(device, image.width, image.height);
		if (problem) throw new Error(problem);

		device.pushErrorScope('out-of-memory');
		const detail = uploadImage(device, image, 'detail');
		if (await device.popErrorScope()) {
			detail.destroy();
			throw new Error(`There is not enough GPU memory for a ${image.width}×${image.height} detail map.`);
		}

		this.detail?.destroy();
		this.detail = detail;
		this.bindProcess();
		this.invalidate(true);
	}

	clearDetail() {
		this.detail?.destroy();
		this.detail = null;
		this.bindProcess();
		this.invalidate(true);
	}

	private bindProcess() {
		const { base, output } = this;
		this.processBind =
			base && output
				? bindGroup(this.device, this.processPipeline, [
						base.createView(),
						output.createView(),
						{ buffer: this.paramsBuffer },
						(this.detail ?? this.noDetail).createView()
					])
				: null;
	}

	setProcess(params: ProcessParams) {
		this.params = params;
		this.invalidate(true);
	}

	setView(view: ViewParams) {
		this.view = view;
		this.invalidate(false);
	}

	attachCanvas(canvas: HTMLCanvasElement) {
		const context = canvas.getContext('webgpu') as GPUCanvasContext | null;
		if (!context) throw new Error('Could not get a WebGPU context for the viewer.');
		context.configure({ device: this.device, format: this.format, alphaMode: 'opaque' });
		this.canvas = canvas;
		this.context = context;
		this.invalidate(false);
	}

	detachCanvas() {
		this.context?.unconfigure();
		this.context = this.canvas = null;
	}

	/** The canvas backing size changed. */
	resized() {
		this.invalidate(false);
	}

	private invalidate(process: boolean) {
		if (process) this.needsProcess = true;
		this.needsRender = true;
		if (!this.frame) {
			this.frame = requestAnimationFrame(() => {
				this.frame = 0;
				this.flush();
			});
		}
	}

	/** Run pending passes now instead of waiting for the next frame. */
	flush() {
		if (this.needsProcess) this.runProcess();
		if (this.needsRender) this.runRender();
	}

	private runProcess() {
		this.needsProcess = false;
		if (!this.base || !this.processBind) return;
		const { device, params } = this;
		// Layout of Params in process.wgsl.
		const data = new DataView(new ArrayBuffer(48));
		data.setFloat32(0, params.strength, true);
		data.setUint32(4, params.flipInput ? 1 : 0, true);
		data.setUint32(8, params.flipOutput ? 1 : 0, true);
		data.setUint32(28, params.renormalize ? 1 : 0, true);
		const detail = this.detail && params.detail;
		if (detail) {
			data.setUint32(12, 1, true);
			data.setFloat32(16, detail.strength, true);
			data.setUint32(20, detail.flipInput ? 1 : 0, true);
			data.setUint32(24, BLEND_METHODS.indexOf(detail.method), true);
			data.setFloat32(32, detail.tiling[0], true);
			data.setFloat32(36, detail.tiling[1], true);
			data.setFloat32(40, detail.offset[0], true);
			data.setFloat32(44, detail.offset[1], true);
		}
		device.queue.writeBuffer(this.paramsBuffer, 0, data);

		const encoder = device.createCommandEncoder({ label: 'process' });
		const pass = encoder.beginComputePass({ label: 'process' });
		pass.setPipeline(this.processPipeline);
		pass.setBindGroup(0, this.processBind);
		pass.dispatchWorkgroups(...workgroupCount(this.base.width, this.base.height));
		pass.end();
		const start = performance.now();
		device.queue.submit([encoder.finish()]);
		device.queue.onSubmittedWorkDone().then(() => this.onProcessed?.(performance.now() - start));
	}

	private runRender() {
		this.needsRender = false;
		const { canvas, context, device } = this;
		if (!canvas || !context || !canvas.width || !canvas.height) return;
		const size = this.imageSize ?? [1, 1];
		const { zoom, pan, lit, light, shininess } = this.view;
		// Layout of View in display.wgsl.
		device.queue.writeBuffer(
			this.viewBuffer,
			0,
			new Float32Array([
				canvas.width,
				canvas.height,
				...size,
				...pan,
				zoom,
				Math.round(lit * canvas.width),
				...lightVector(light),
				0,
				...halfVector(light),
				shininess
			])
		);
		const encoder = device.createCommandEncoder({ label: 'display' });
		const pass = encoder.beginRenderPass({
			label: 'display',
			colorAttachments: [
				{ view: context.getCurrentTexture().createView(), loadOp: 'clear', storeOp: 'store', clearValue: BACKGROUND }
			]
		});
		if (this.displayBind) {
			pass.setPipeline(this.displayPipeline);
			pass.setBindGroup(0, this.displayBind);
			pass.draw(3);
		}
		pass.end();
		device.queue.submit([encoder.finish()]);
	}

	/** The processed output as RGBA16, exactly what export writes. */
	async readOutput(): Promise<Uint16Array> {
		if (!this.output) throw new Error('No image is loaded.');
		this.flush();
		return readImageTexture(this.device, this.output);
	}

	destroy() {
		this.clearBase();
		this.clearDetail();
		this.noDetail.destroy();
		cancelAnimationFrame(this.frame);
		this.frame = 0;
		this.needsProcess = this.needsRender = false;
		this.detachCanvas();
		this.paramsBuffer.destroy();
		this.viewBuffer.destroy();
	}
}
