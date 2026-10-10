// Shader, pipeline and bind group helpers.
import common from './wgsl/common.wgsl?raw';

const COMMON_LINES = common.split('\n').length;

/** Compile WGSL with common.wgsl prepended. Compiler messages are logged with the shader's own line numbers. */
export async function createShader(device: GPUDevice, code: string, label: string): Promise<GPUShaderModule> {
	const module = device.createShaderModule({ label, code: `${common}\n${code}` });
	const { messages } = await module.getCompilationInfo();
	for (const m of messages) {
		const where = m.lineNum > COMMON_LINES ? `${label}:${m.lineNum - COMMON_LINES}` : `common.wgsl:${m.lineNum}`;
		(m.type === 'error' ? console.error : console.warn)(`${where}:${m.linePos} ${m.message}`);
	}
	const error = messages.find((m) => m.type === 'error');
	if (error) throw new Error(`Shader "${label}" failed to compile: ${error.message}`);
	return module;
}

export function computePipeline(
	device: GPUDevice,
	module: GPUShaderModule,
	label: string,
	constants?: Record<string, number>
): Promise<GPUComputePipeline> {
	return device.createComputePipelineAsync({ label, layout: 'auto', compute: { module, entryPoint: 'main', constants } });
}

/** Bind group whose entries are numbered in order: `[a, b]` binds a at 0 and b at 1. */
export function bindGroup(
	device: GPUDevice,
	pipeline: GPUComputePipeline | GPURenderPipeline,
	resources: GPUBindingResource[],
	group = 0
): GPUBindGroup {
	return device.createBindGroup({
		layout: pipeline.getBindGroupLayout(group),
		entries: resources.map((resource, binding) => ({ binding, resource }))
	});
}

/** A uniform buffer initialized with `data` (size rounded up to 16 bytes). */
export function uniformBuffer(device: GPUDevice, data: ArrayBufferView<ArrayBuffer>, label: string): GPUBuffer {
	const buffer = device.createBuffer({
		label,
		size: Math.ceil(data.byteLength / 16) * 16,
		usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
	});
	device.queue.writeBuffer(buffer, 0, data);
	return buffer;
}

/** Workgroup counts to cover width × height with square workgroups of `size`. */
export const workgroupCount = (width: number, height: number, size = 8): [number, number] => [
	Math.ceil(width / size),
	Math.ceil(height / size)
];
