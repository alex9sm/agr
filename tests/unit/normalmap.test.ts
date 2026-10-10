import { describe, expect, it } from 'vitest';
import {
	applyStrength,
	decode,
	encode,
	processParams,
	processRGBA16,
	type ProcessParams,
	type Vec3
} from '../../src/routes/(app)/tools/normal-map/normalmap';

const params = (p: Partial<ProcessParams>): ProcessParams => ({ strength: 1, flipInput: false, flipOutput: false, ...p });
const unit = (v: Vec3): Vec3 => {
	const l = Math.hypot(...v);
	return [v[0] / l, v[1] / l, v[2] / l];
};
const slope = ([x, y, z]: Vec3) => Math.hypot(x, y) / z;

/** Random 16-bit RGBA pixels with a fixed seed. */
function noise(pixels: number, seed = 1) {
	let s = seed;
	return new Uint16Array(pixels * 4).map(() => (s = (s * 1103515245 + 12345) >>> 0) >>> 16);
}

describe('encode / decode', () => {
	it('round-trips every 16-bit value exactly', () => {
		for (let c = 0; c <= 65535; c++) expect(encode(decode(c))).toBe(c);
	});

	it('clamps out-of-range vectors', () => {
		expect(encode(-2)).toBe(0);
		expect(encode(2)).toBe(65535);
	});
});

describe('strength', () => {
	const tilted = unit([0.4, -0.3, 0.8]);

	it('is flat at 0', () => {
		const [x, y, z] = applyStrength(tilted, 0);
		expect([x === 0, y === 0, z]).toEqual([true, true, 1]); // y is -0 here; === treats it as 0
	});

	it('returns the vector untouched at 1, even when not unit length', () => {
		expect(applyStrength(tilted, 1)).toEqual(tilted);
		expect(applyStrength([0.5, 0.5, 0.5], 1)).toEqual([0.5, 0.5, 0.5]);
	});

	it('scales the slope by s', () => {
		for (const s of [0.25, 0.5, 2, 5]) {
			const out = applyStrength(tilted, s);
			expect(slope(out)).toBeCloseTo(slope(tilted) * s, 10);
			expect(Math.hypot(...out)).toBeCloseTo(1, 12);
			// Direction in the tangent plane is unchanged.
			expect(Math.atan2(out[1], out[0])).toBeCloseTo(Math.atan2(tilted[1], tilted[0]), 12);
		}
	});

	it('increases monotonically', () => {
		let previous = -1;
		for (let s = 0; s <= 10; s += 0.25) {
			const current = slope(applyStrength(tilted, s));
			expect(current).toBeGreaterThan(previous);
			previous = current;
		}
	});

	it('keeps the length of non-unit vectors', () => {
		const short: Vec3 = [0.3, -0.2, 0.6]; // length 0.7, as in a resized or blurred map
		for (const s of [0, 0.5, 0.95, 1.05, 3]) {
			expect(Math.hypot(...applyStrength(short, s))).toBeCloseTo(Math.hypot(...short), 12);
		}
	});

	it('is continuous through s = 1, even for non-unit vectors', () => {
		const short: Vec3 = [0.3, -0.2, 0.6];
		for (const s of [0.999, 1.001]) {
			const out = applyStrength(short, s);
			out.forEach((v, i) => expect(Math.abs(v - short[i])).toBeLessThan(1e-3));
		}
	});

	it('keeps vectors facing out of the surface', () => {
		const below = applyStrength([0.6, 0, -0.8], 2);
		expect(below[2]).toBeGreaterThan(0);
		expect(applyStrength([0, 0, -1], 3)).toEqual([0, 0, 1]);
	});
});

describe('processRGBA16', () => {
	const src = noise(500);

	it('is the identity at strength 1 with no flips', () => {
		expect(processRGBA16(src, params({}))).toEqual(src);
	});

	it('Flip G inverts green exactly and touches nothing else', () => {
		const out = processRGBA16(src, params({ flipOutput: true }));
		for (let i = 0; i < src.length; i += 4) {
			expect([out[i], out[i + 1], out[i + 2], out[i + 3]]).toEqual([src[i], 65535 - src[i + 1], src[i + 2], src[i + 3]]);
		}
	});

	it('flipping twice is a perfect round trip', () => {
		const once = processRGBA16(src, params({ flipOutput: true }));
		expect(processRGBA16(once, params({ flipInput: true }))).toEqual(src);
	});

	it('matching input and output conventions cancel out', () => {
		expect(processRGBA16(src, params({ flipInput: true, flipOutput: true }))).toEqual(src);
	});

	it('passes alpha through at any strength', () => {
		const out = processRGBA16(src, params({ strength: 3, flipOutput: true }));
		for (let i = 3; i < src.length; i += 4) expect(out[i]).toBe(src[i]);
	});

	it('does not jump as strength moves off 1 (shortened normals)', () => {
		// Normals of length 0.75: a strength of 0.99 must stay within a few LSB of 1.0, not snap to unit length.
		const short = new Uint16Array(400 * 4);
		for (let i = 0; i < short.length; i += 4) {
			const a = (i / 4) * 0.37;
			const n = [0.75 * 0.6 * Math.cos(a), 0.75 * 0.6 * Math.sin(a), 0.75 * 0.8];
			short.set([encode(n[0]), encode(n[1]), encode(n[2]), 65535], i);
		}
		const at1 = processRGBA16(short, params({ strength: 1 }));
		for (const strength of [0.99, 1.01]) {
			const out = processRGBA16(short, params({ strength }));
			const maxDiff = Math.max(...out.map((v, i) => Math.abs(v - at1[i])));
			expect(maxDiff).toBeLessThan(400); // ≈ 0.6% of full scale for a 1% strength change
		}
	});

	it('keeps vector lengths (within 16-bit quantization) when strength ≠ 1', () => {
		const out = processRGBA16(src, params({ strength: 0.5 }));
		for (let i = 0; i < out.length; i += 4) {
			const before = Math.hypot(decode(src[i]), decode(src[i + 1]), decode(src[i + 2]));
			const after = Math.hypot(decode(out[i]), decode(out[i + 1]), decode(out[i + 2]));
			if (before <= 1 && src[i + 2] >= 32768) expect(Math.abs(after - before)).toBeLessThan(1e-4);
		}
	});

	it('gives the same strength result for either input convention, up to the Y sign', () => {
		const gl = processRGBA16(src, params({ strength: 2 }));
		const dx = processRGBA16(src, params({ strength: 2, flipInput: true, flipOutput: true }));
		expect(dx).toEqual(gl);
	});

	it('flattens to straight up at strength 0, keeping the length', () => {
		const out = processRGBA16(src, params({ strength: 0 }));
		for (let i = 0; i < out.length; i += 4) {
			const len = Math.hypot(decode(src[i]), decode(src[i + 1]), decode(src[i + 2]));
			expect([out[i], out[i + 1], out[i + 2]]).toEqual([32768, 32768, encode(len)]);
		}
	});
});

describe('processParams', () => {
	it('maps conventions to flips', () => {
		const settings = { base: { convention: 'directx' as const, strength: 2 }, output: { convention: 'opengl' as const } };
		expect(processParams(settings)).toEqual({ strength: 2, flipInput: true, flipOutput: false });
	});
});
