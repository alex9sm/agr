// Help → Run Diagnostics: checks the GPU path on this machine against the CPU reference (normalmap.ts).
// Uses its own GPU device, so it never disturbs the open image.
import { initGpu } from '$lib/gpu/device';
import { gpuSelfTest } from '$lib/gpu/selftest';
import { toRGBA16 } from '$lib/image/convert';
import type { ImageBuffer } from '$lib/image/types';
import { processRGBA16, type ProcessParams } from './normalmap';
import { Renderer } from './renderer';

export interface Check {
	name: string;
	ok: boolean;
	detail: string;
}

export interface DiagnosticsReport {
	adapter: string;
	userAgent: string;
	checks: Check[];
	ms: number;
}

const STRENGTHS = [1, 0, 0.35, 2.5, 10];
const FLIPS: [boolean, boolean][] = [
	[false, false],
	[true, false],
	[false, true],
	[true, true]
];
const SETTINGS: ProcessParams[] = STRENGTHS.flatMap((strength) =>
	FLIPS.map(([flipInput, flipOutput]) => ({ strength, flipInput, flipOutput }))
);

function random(seed: number) {
	let s = seed;
	return () => (s = (s * 1103515245 + 12345) >>> 0) / 2 ** 32;
}

/** Unit vectors on the upper hemisphere, encoded at 16 bits, with random alpha. */
function unitNormals(): ImageBuffer {
	const [width, height] = [61, 47];
	const rand = random(1);
	const data = new Uint16Array(width * height * 4);
	const enc = (v: number) => Math.round((v * 0.5 + 0.5) * 65535);
	for (let i = 0; i < data.length; i += 4) {
		const z = rand();
		const a = rand() * 2 * Math.PI;
		const r = Math.sqrt(1 - z * z);
		data.set([enc(r * Math.cos(a)), enc(r * Math.sin(a)), enc(z), Math.floor(rand() * 65536)], i);
	}
	return { width, height, channels: 4, bitDepth: 16, data };
}

/** Arbitrary 16-bit values: non-unit and below-horizon vectors, plus the extremes. */
function rawValues(): ImageBuffer {
	const [width, height] = [53, 41];
	const rand = random(2);
	const data = new Uint16Array(width * height * 3).map(() => Math.floor(rand() * 65536));
	data.set([0, 0, 0, 65535, 65535, 65535, 32767, 32767, 32767, 32768, 32768, 32768, 0, 65535, 0]);
	return { width, height, channels: 3, bitDepth: 16, data };
}

function rgb8(): ImageBuffer {
	const [width, height] = [59, 43];
	const rand = random(3);
	return { width, height, channels: 3, bitDepth: 8, data: new Uint8Array(width * height * 3).map(() => Math.floor(rand() * 256)) };
}

const FIXTURES: [string, () => ImageBuffer][] = [
	['16-bit unit normals with alpha', unitNormals],
	['16-bit arbitrary values', rawValues],
	['8-bit RGB', rgb8]
];

function compare(a: Uint16Array, b: Uint16Array) {
	let max = 0;
	let over1 = 0;
	for (let i = 0; i < a.length; i++) {
		const d = Math.abs(a[i] - b[i]);
		if (d > max) max = d;
		if (d > 1) over1++;
	}
	return { max, over1 };
}

const SELF_TEST_NAMES: Record<string, string> = {
	'upload/readback': 'Upload and readback',
	'unpack/pack': 'Channel pack/unpack',
	'normal decode/encode': 'Normal decode/encode',
	'bilinear at centers': 'Bilinear sampling'
};

export async function runDiagnostics(): Promise<DiagnosticsReport> {
	const start = performance.now();
	const checks: Check[] = [];
	const userAgent = navigator.userAgent;

	const self = await gpuSelfTest();
	if (!self.ok && 'error' in self) {
		return { adapter: 'none', userAgent, ms: 0, checks: [{ name: 'WebGPU', ok: false, detail: self.error ?? '' }] };
	}
	for (const [key, mismatches] of Object.entries(self.mismatches ?? {})) {
		const detail = mismatches ? `${mismatches} values differ` : 'bit-exact';
		checks.push({ name: SELF_TEST_NAMES[key] ?? key, ok: mismatches === 0, detail });
	}

	const init = await initGpu();
	if (!init.ok) return { adapter: 'none', userAgent, ms: 0, checks: [...checks, { name: 'WebGPU', ok: false, detail: init.message }] };
	const renderer = await Renderer.create(init.device);
	let lossless = 0;
	try {
		for (const [name, make] of FIXTURES) {
			const image = make();
			const input = toRGBA16(image);
			await renderer.setBase(image);
			let max = 0;
			let over1 = 0;
			for (const params of SETTINGS) {
				renderer.setProcess(params);
				const gpu = await renderer.readOutput();
				const diff = compare(gpu, processRGBA16(input, params));
				max = Math.max(max, diff.max);
				over1 += diff.over1;
				if (params.strength === 1) lossless = Math.max(lossless, diff.max);
			}
			checks.push({
				name: `Processing matches CPU: ${name}`,
				ok: over1 === 0,
				detail: over1 ? `${over1} values off by more than 1 (max ${max})` : `max difference ${max} over ${SETTINGS.length} settings`
			});
		}
		checks.push({
			name: 'Strength 1 and Flip G are lossless',
			ok: lossless === 0,
			detail: lossless ? `max difference ${lossless}` : 'bit-exact'
		});
	} finally {
		renderer.destroy();
		init.destroy();
	}
	return { adapter: init.adapterName, userAgent, checks, ms: Math.round(performance.now() - start) };
}

export function reportText(r: DiagnosticsReport) {
	const lines = r.checks.map((c) => `${c.ok ? 'PASS' : 'FAIL'}  ${c.name} (${c.detail})`);
	return [`AGR Normal Map Editor diagnostics`, `GPU: ${r.adapter}`, `Browser: ${r.userAgent}`, '', ...lines, '', `${r.ms} ms`].join('\n');
}
