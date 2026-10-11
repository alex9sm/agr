// Help → Run Diagnostics: checks the GPU path on this machine against the CPU reference (normalmap.ts).
// Uses its own GPU device, so it never disturbs the open image.
import { initGpu } from '$lib/gpu/device';
import { gpuSelfTest } from '$lib/gpu/selftest';
import { toRGBA16 } from '$lib/image/convert';
import type { ImageBuffer } from '$lib/image/types';
import {
	BLEND_METHOD_NAMES,
	BLEND_METHODS,
	processRGBA16,
	type BlendMethod,
	type DetailParams,
	type ProcessParams
} from './normalmap';
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

// Detail blending: each method under these detail settings × these base settings. Footprints (detail texels per
// base pixel) cover single bilinear taps and the 2×2 and 4×4 tap grids, kept away from whole numbers.
const DETAIL_SETTINGS: Omit<DetailParams, 'method'>[] = [
	{ strength: 1, flipInput: false, tiling: [1, 1], offset: [0, 0] },
	{ strength: 0.4, flipInput: true, tiling: [2.5, 1.75], offset: [0.3, 0.85] },
	{ strength: 3, flipInput: false, tiling: [8, 0.6], offset: [0.07, 0.5] }
];
const BLEND_BASE_SETTINGS: ProcessParams[] = [
	{ strength: 1, flipInput: false, flipOutput: false },
	{ strength: 1.7, flipInput: true, flipOutput: true },
	{ strength: 0.5, flipInput: false, flipOutput: true }
];

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

/**
 * Smooth, seamlessly tiling bumps: normals of a sum-of-sines height field, slopes up to about 50°. Detail maps are
 * sampled between texels, and on white noise the f32 rounding of those positions alone moves results by a few LSB;
 * smooth data like real maps keeps that far below 1 LSB, while a misaligned sample would still be off by thousands.
 */
function smoothNormals(width: number, height: number, bitDepth: 8 | 16): ImageBuffer {
	const max = bitDepth === 16 ? 65535 : 255;
	const channels = bitDepth === 16 ? 4 : 3;
	const data = bitDepth === 16 ? new Uint16Array(width * height * 4) : new Uint8Array(width * height * 3);
	const enc = (v: number) => Math.round((v * 0.5 + 0.5) * max);
	const T = 2 * Math.PI;
	for (let y = 0; y < height; y++) {
		for (let x = 0; x < width; x++) {
			const u = (x + 0.5) / width;
			const v = (y + 0.5) / height;
			const dx = 0.6 * Math.cos(T * 2 * u) * Math.sin(T * 3 * v) + 0.4 * Math.cos(T * (5 * u + v));
			const dy = 0.6 * Math.sin(T * 2 * u) * Math.cos(T * 3 * v) + 0.3 * Math.sin(T * (4 * v - u));
			const l = Math.hypot(dx, dy, 1);
			data.set([enc(-dx / l), enc(dy / l), enc(1 / l), max].slice(0, channels), (y * width + x) * channels);
		}
	}
	return { width, height, channels, bitDepth, data } as ImageBuffer;
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

/** Detail maps at sizes unrelated to the base's (see smoothNormals for why they aren't noise). */
const DETAIL_FIXTURES: (() => ImageBuffer)[] = [() => smoothNormals(29, 37, 16), () => smoothNormals(23, 19, 8)];

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

		const base = unitNormals();
		const baseInput = toRGBA16(base);
		await renderer.setBase(base);
		const blends = new Map<BlendMethod, { max: number; over1: number; runs: number }>(
			BLEND_METHODS.map((m) => [m, { max: 0, over1: 0, runs: 0 }])
		);
		for (const make of DETAIL_FIXTURES) {
			const image = make();
			await renderer.setDetail(image);
			const detail = { map: { width: image.width, height: image.height, data: toRGBA16(image) }, baseWidth: base.width };
			for (const method of BLEND_METHODS) {
				const stats = blends.get(method)!;
				for (const d of DETAIL_SETTINGS) {
					for (const b of BLEND_BASE_SETTINGS) {
						const params: ProcessParams = { ...b, detail: { ...d, method } };
						renderer.setProcess(params);
						const diff = compare(await renderer.readOutput(), processRGBA16(baseInput, params, detail));
						stats.max = Math.max(stats.max, diff.max);
						stats.over1 += diff.over1;
						stats.runs++;
					}
				}
			}
		}
		for (const [method, { max, over1, runs }] of blends) {
			checks.push({
				name: `Blend matches CPU: ${BLEND_METHOD_NAMES[method]}`,
				ok: over1 === 0,
				detail: over1 ? `${over1} values off by more than 1 (max ${max})` : `max difference ${max} over ${runs} settings`
			});
		}
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
