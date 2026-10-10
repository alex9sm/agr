// CPU reference for all normal map math. process.wgsl must match it to within 1 LSB at 16-bit
// (diagnostics.ts checks this on the user's GPU). Working space: OpenGL convention (+Y up), vectors in [-1, 1].

export type Vec3 = [number, number, number];

export interface ProcessParams {
	/** Slope scale. Exactly 1 passes vectors through untouched (no renormalization). */
	strength: number;
	/** The input map is DirectX (Y down): negate Y on the way in. */
	flipInput: boolean;
	/** Write DirectX (Y down): negate Y on the way out. */
	flipOutput: boolean;
}

type Convention = 'opengl' | 'directx';

export function processParams(settings: {
	base: { convention: Convention; strength: number };
	output: { convention: Convention };
}): ProcessParams {
	return {
		strength: settings.base.strength,
		flipInput: settings.base.convention === 'directx',
		flipOutput: settings.output.convention === 'directx'
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

/** Process an RGBA16 image (the GPU texture layout). Alpha passes through untouched. */
export function processRGBA16(src: Uint16Array, p: ProcessParams): Uint16Array {
	const out = new Uint16Array(src.length);
	for (let i = 0; i < src.length; i += 4) {
		let n: Vec3 = [decode(src[i]), decode(src[i + 1]), decode(src[i + 2])];
		if (p.flipInput) n[1] = -n[1];
		n = applyStrength(n, p.strength);
		if (p.flipOutput) n[1] = -n[1];
		out[i] = encode(n[0]);
		out[i + 1] = encode(n[1]);
		out[i + 2] = encode(n[2]);
		out[i + 3] = src[i + 3];
	}
	return out;
}
