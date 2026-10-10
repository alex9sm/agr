// WebGPU adapter and device acquisition. WebGPU only: no fallback, callers show the failure message.

export interface Gpu {
	device: GPUDevice;
	/** Human-readable adapter name for the status bar. */
	adapterName: string;
	/** Destroy the device on purpose (this does not count as a loss). */
	destroy(): void;
}

export type GpuFailureReason = 'no-webgpu' | 'no-adapter' | 'device-failed';
export interface GpuFailure {
	reason: GpuFailureReason;
	message: string;
}

export type GpuInit = ({ ok: true } & Gpu) | ({ ok: false } & GpuFailure);

export interface GpuOptions {
	/** Called when the device is lost for any reason other than our own `destroy()`. */
	onLost?: (message: string) => void;
}

/** Limits raised to the adapter's maximum, so large images fit. */
const RAISED_LIMITS = ['maxTextureDimension2D', 'maxBufferSize', 'maxStorageBufferBindingSize'] as const;

const VENDORS: Record<string, string> = {
	nvidia: 'NVIDIA',
	amd: 'AMD',
	intel: 'Intel',
	apple: 'Apple',
	qualcomm: 'Qualcomm',
	arm: 'Arm',
	microsoft: 'Microsoft'
};

/** Browsers often hide the description; fall back to "vendor architecture". */
export function describeAdapter(info: Pick<GPUAdapterInfo, 'vendor' | 'architecture' | 'description'> | undefined) {
	if (!info) return 'WebGPU adapter';
	if (info.description) return info.description;
	const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
	const vendor = VENDORS[info.vendor] ?? cap(info.vendor);
	return [vendor, cap(info.architecture)].filter(Boolean).join(' ') || 'WebGPU adapter';
}

const fail = (reason: GpuFailureReason, message: string): GpuInit => ({ ok: false, reason, message });

export async function initGpu({ onLost }: GpuOptions = {}): Promise<GpuInit> {
	if (typeof navigator === 'undefined' || !navigator.gpu) {
		return fail(
			'no-webgpu',
			'This tool needs WebGPU, which this browser does not provide. Use a current version of Chrome, Edge or Safari, or Firefox on a platform where WebGPU is enabled.'
		);
	}

	let adapter: GPUAdapter | null = null;
	try {
		adapter = await navigator.gpu.requestAdapter({ powerPreference: 'high-performance' });
	} catch {
		// treated like no adapter
	}
	if (!adapter) {
		return fail(
			'no-adapter',
			'WebGPU is available, but no compatible graphics adapter was found. Your GPU or driver may be blocked by the browser; updating the graphics driver can help.'
		);
	}

	const requiredLimits: Record<string, number> = {};
	for (const name of RAISED_LIMITS) requiredLimits[name] = adapter.limits[name];

	let device: GPUDevice;
	try {
		device = await adapter.requestDevice({ label: 'AGR', requiredLimits });
	} catch (err) {
		return fail('device-failed', `The graphics adapter could not be started: ${(err as Error).message}`);
	}

	let destroying = false;
	device.lost.then((info) => {
		if (!destroying) onLost?.(info.message || `reason: ${info.reason}`);
	});
	device.addEventListener('uncapturederror', (e) => {
		console.error('WebGPU:', (e as GPUUncapturedErrorEvent).error.message);
	});

	return {
		ok: true,
		device,
		adapterName: describeAdapter(adapter.info),
		destroy() {
			destroying = true;
			device.destroy();
		}
	};
}
