// CPU reference for all normal map math. process.wgsl must match it to within 1 LSB at 16-bit
// (diagnostics.ts checks this on the user's GPU). Working space: OpenGL convention (+Y up), vectors in [-1, 1].

export type Vec3 = [number, number, number];

export type BlendMethod = 'rnm' | 'whiteout' | 'udn' | 'linear';

/** Blend methods in the order process.wgsl numbers them. */
export const BLEND_METHODS: readonly BlendMethod[] = ['rnm', 'whiteout', 'udn', 'linear'];

export const BLEND_METHOD_NAMES: Record<BlendMethod, string> = {
	rnm: 'Reoriented (RNM)',
	whiteout: 'Whiteout',
	udn: 'UDN',
	linear: 'Linear'
};

export interface DetailParams {
	/** Slope scale of the detail, applied before blending. */
	strength: number;
	/** The detail map is DirectX (Y down). */
	flipInput: boolean;
	method: BlendMethod;
	/** Detail repeats across the base. */
	tiling: [number, number];
	/** Detail shift, in detail UV units. */
	offset: [number, number];
}

export interface ProcessParams {
	/** Slope scale. Exactly 1 passes vectors through untouched (no renormalization). */
	strength: number;
	/** The input map is DirectX (Y down): negate Y on the way in. */
	flipInput: boolean;
	/** Write DirectX (Y down): negate Y on the way out. */
	flipOutput: boolean;
	/** Blend a detail map on top; null or absent for none. */
	detail?: DetailParams | null;
}

/** An image in the GPU texture layout: RGBA, 16 bits per channel. */
export interface RGBA16Image {
	width: number;
	height: number;
	data: Uint16Array;
}

type Convention = 'opengl' | 'directx';

export function processParams(settings: {
	base: { convention: Convention; strength: number };
	detail?: {
		convention: Convention;
		strength: number;
		method: BlendMethod;
		tiling: [number, number];
		offset: [number, number];
	} | null;
	output: { convention: Convention };
}): ProcessParams {
	const d = settings.detail;
	return {
		strength: settings.base.strength,
		flipInput: settings.base.convention === 'directx',
		flipOutput: settings.output.convention === 'directx',
		detail: d && {
			strength: d.strength,
			flipInput: d.convention === 'directx',
			method: d.method,
			tiling: [d.tiling[0], d.tiling[1]],
			offset: [d.offset[0], d.offset[1]]
		}
	};
}

/** Keeps z positive so a flattened or inverted normal still points out of the surface. */
export const MIN_Z = 1e-4;

/** 16-bit channel value → [-1, 1]. */
export const decode = (c: number) => (c / 65535) * 2 - 1;

/** [-1, 1] → 16-bit channel value, rounded to nearest. */
export const encode = (v: number) => Math.round(Math.min(1, Math.max(0, v * 0.5 + 0.5)) * 65535);

/**
 * Scale the surface slope by `s`: n' = |n| · normalize(n.xy · s, max(n.z, ε)).
 * Equivalent to scaling the height field's derivatives (n.xy / n.z), so bumps get deeper or
 * shallower rather than just more contrasty. s = 0 is flat; s = 1 returns n unchanged.
 *
 * The vector keeps its length. Many maps aren't normalized (resizing, blurring and mipmapping all
 * shorten normals); renormalizing here would visibly jump the colors as s moves off 1. Fixing the
 * length is the separate Renormalize tool.
 */
export function applyStrength([x, y, z]: Vec3, s: number): Vec3 {
	if (s === 1) return [x, y, z];
	const sx = x * s;
	const sy = y * s;
	const sz = Math.max(z, MIN_Z);
	const k = Math.hypot(x, y, z) / Math.hypot(sx, sy, sz);
	return [sx * k, sy * k, sz * k];
}

function normalize([x, y, z]: Vec3): Vec3 {
	const length = Math.hypot(x, y, z);
	return [x / length, y / length, z / length];
}

/** Unit vector on the upper hemisphere (z ≥ ε): what the blend methods assume of their inputs. Never zero length. */
export const toHemisphere = ([x, y, z]: Vec3): Vec3 => normalize([x, y, Math.max(z, MIN_Z)]);

/**
 * Blend detail normal `d` onto base normal `b`. Both must be unit vectors with z > 0 (see toHemisphere); the
 * result is a unit vector.
 * - rnm: Reoriented Normal Mapping. Rotates the detail onto the base surface, so slopes add up like real geometry.
 * - whiteout: adds slopes, multiplies z. A cheap approximation of rnm.
 * - udn: adds slopes, keeps the base z. Matches some engines; flattens strong detail.
 * - linear: plain vector average. Loses detail; for matching engines that do it.
 */
export function blend(method: BlendMethod, b: Vec3, d: Vec3): Vec3 {
	switch (method) {
		case 'rnm': {
			const t: Vec3 = [b[0], b[1], b[2] + 1];
			const u: Vec3 = [-d[0], -d[1], d[2]];
			const k = (t[0] * u[0] + t[1] * u[1] + t[2] * u[2]) / t[2];
			return normalize([t[0] * k - u[0], t[1] * k - u[1], t[2] * k - u[2]]);
		}
		case 'whiteout':
			return normalize([b[0] + d[0], b[1] + d[1], b[2] * d[2]]);
		case 'udn':
			return normalize([b[0] + d[0], b[1] + d[1], b[2]]);
		case 'linear':
			return normalize([b[0] + d[0], b[1] + d[1], b[2] + d[2]]);
	}
}

const mix = (a: number, b: number, t: number) => a * (1 - t) + b * t;
const fract = (v: number) => v - Math.floor(v);

/**
 * Bilinear sample of RGB at p in texel units (texel i spans [i, i + 1)), wrapping at the edges. Channels in [0, 1].
 * Mirrors sample_bilinear_repeat_px in common.wgsl.
 */
export function sampleRepeat({ width, height, data }: RGBA16Image, px: number, py: number): Vec3 {
	const qx = px - 0.5;
	const qy = py - 0.5;
	const x0 = Math.floor(qx);
	const y0 = Math.floor(qy);
	const fx = qx - x0;
	const fy = qy - y0;
	const wrap = (v: number, size: number) => ((v % size) + size) % size;
	const at = (x: number, y: number) => (wrap(y, height) * width + wrap(x, width)) * 4;
	const [a, b, c, d] = [at(x0, y0), at(x0 + 1, y0), at(x0, y0 + 1), at(x0 + 1, y0 + 1)];
	const out: Vec3 = [0, 0, 0];
	for (let ch = 0; ch < 3; ch++) {
		const top = mix(data[a + ch] / 65535, data[b + ch] / 65535, fx);
		const bottom = mix(data[c + ch] / 65535, data[d + ch] / 65535, fx);
		out[ch] = mix(top, bottom, fy);
	}
	return out;
}

/** Most bilinear taps per axis when the detail is minified. */
const MAX_TAPS = 4;

/**
 * The detail map under base pixel (x, y), channels in [0, 1]. Detail UV = fract(baseUV · tiling + offset).
 * When a base pixel covers more than one detail texel, averages a grid of bilinear taps across it (up to 4 × 4),
 * so heavy tiling doesn't alias. Mirrors sample_detail in process.wgsl.
 */
export function sampleDetail(
	map: RGBA16Image,
	x: number,
	y: number,
	baseSize: [number, number],
	tiling: [number, number],
	offset: [number, number]
): Vec3 {
	const px = fract(((x + 0.5) / baseSize[0]) * tiling[0] + offset[0]) * map.width;
	const py = fract(((y + 0.5) / baseSize[1]) * tiling[1] + offset[1]) * map.height;
	// Detail texels per base pixel.
	const fx = (Math.abs(tiling[0]) * map.width) / baseSize[0];
	const fy = (Math.abs(tiling[1]) * map.height) / baseSize[1];
	const nx = Math.min(MAX_TAPS, Math.max(1, Math.ceil(fx)));
	const ny = Math.min(MAX_TAPS, Math.max(1, Math.ceil(fy)));
	const sum: Vec3 = [0, 0, 0];
	for (let j = 0; j < ny; j++) {
		for (let i = 0; i < nx; i++) {
			const s = sampleRepeat(map, px + ((i + 0.5) / nx - 0.5) * fx, py + ((j + 0.5) / ny - 0.5) * fy);
			sum[0] += s[0];
			sum[1] += s[1];
			sum[2] += s[2];
		}
	}
	const n = nx * ny;
	return [sum[0] / n, sum[1] / n, sum[2] / n];
}

/**
 * Process an RGBA16 image (the GPU texture layout). Alpha passes through untouched.
 * With `p.detail` and a detail map, blends the detail on top; `baseWidth` locates each pixel for sampling it.
 * Blending works on unit vectors, so its output is normalized even where the base wasn't.
 */
export function processRGBA16(
	src: Uint16Array,
	p: ProcessParams,
	detail?: { map: RGBA16Image; baseWidth: number }
): Uint16Array {
	const out = new Uint16Array(src.length);
	const dp = detail && p.detail;
	const baseSize: [number, number] = detail ? [detail.baseWidth, src.length / 4 / detail.baseWidth] : [0, 0];
	for (let i = 0; i < src.length; i += 4) {
		let n: Vec3 = [decode(src[i]), decode(src[i + 1]), decode(src[i + 2])];
		if (p.flipInput) n[1] = -n[1];
		n = applyStrength(n, p.strength);
		if (dp) {
			const pixel = i / 4;
			const x = pixel % baseSize[0];
			const y = (pixel - x) / baseSize[0];
			const c = sampleDetail(detail.map, x, y, baseSize, dp.tiling, dp.offset);
			let d: Vec3 = [c[0] * 2 - 1, c[1] * 2 - 1, c[2] * 2 - 1];
			if (dp.flipInput) d[1] = -d[1];
			d = applyStrength(toHemisphere(d), dp.strength);
			n = blend(dp.method, toHemisphere(n), d);
		}
		if (p.flipOutput) n[1] = -n[1];
		out[i] = encode(n[0]);
		out[i + 1] = encode(n[1]);
		out[i + 2] = encode(n[2]);
		out[i + 3] = src[i + 3];
	}
	return out;
}
