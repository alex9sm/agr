import { describe, expect, it } from 'vitest';
import {
	applyStrength,
	BLEND_METHODS,
	blend,
	decode,
	encode,
	processParams,
	processRGBA16,
	sampleDetail,
	sampleRepeat,
	type DetailParams,
	type ProcessParams,
	type RGBA16Image,
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

describe('blend', () => {
	const flat: Vec3 = [0, 0, 1];
	const b = unit([0.4, -0.3, 0.8]);
	const d = unit([-0.2, 0.5, 0.7]);
	const expectVec = (actual: Vec3, expected: Vec3) => actual.forEach((v, i) => expect(v).toBeCloseTo(expected[i], 12));

	it('returns unit vectors', () => {
		for (const method of BLEND_METHODS) expect(Math.hypot(...blend(method, b, d))).toBeCloseTo(1, 12);
	});

	it('leaves the base unchanged under a flat detail (all but linear)', () => {
		for (const method of ['rnm', 'whiteout', 'udn'] as const) expectVec(blend(method, b, flat), b);
	});

	it('takes the detail as is on a flat base (rnm, whiteout)', () => {
		expectVec(blend('rnm', flat, d), d);
		expectVec(blend('whiteout', flat, d), d);
	});

	it('rnm adds tilts like stacked geometry', () => {
		const tilt = (degrees: number): Vec3 => [Math.sin((degrees * Math.PI) / 180), 0, Math.cos((degrees * Math.PI) / 180)];
		expectVec(blend('rnm', tilt(20), tilt(30)), tilt(50));
		expectVec(blend('rnm', tilt(40), tilt(-15)), tilt(25));
	});

	it('matches hand-computed results', () => {
		const b: Vec3 = [0.6, 0, 0.8];
		const d: Vec3 = [0, 0.6, 0.8];
		expectVec(blend('rnm', b, d), [0.48, 0.6, 0.64]);
		expectVec(blend('whiteout', b, d), unit([0.6, 0.6, 0.64]));
		expectVec(blend('udn', b, d), unit([0.6, 0.6, 0.8]));
		expectVec(blend('linear', b, d), unit([0.6, 0.6, 1.6]));
	});
});

/** An RGBA16 image whose texel (x, y) has channel values from `value`. */
function image(width: number, height: number, value: (x: number, y: number, channel: number) => number): RGBA16Image {
	const data = new Uint16Array(width * height * 4);
	for (let y = 0; y < height; y++) {
		for (let x = 0; x < width; x++) for (let c = 0; c < 4; c++) data[(y * width + x) * 4 + c] = value(x, y, c);
	}
	return { width, height, data };
}

/** Encoded unit normals on the upper hemisphere, fixed seed, alpha = 65535. */
function unitNormals(width: number, height: number, seed = 7): RGBA16Image {
	let s = seed;
	const rand = () => (s = (s * 1103515245 + 12345) >>> 0) / 2 ** 32;
	const img = image(width, height, () => 65535);
	for (let i = 0; i < img.data.length; i += 4) {
		const z = 0.2 + 0.8 * rand();
		const a = rand() * 2 * Math.PI;
		const r = Math.sqrt(1 - z * z);
		img.data.set([encode(r * Math.cos(a)), encode(r * Math.sin(a)), encode(z)], i);
	}
	return img;
}

describe('detail sampling', () => {
	const img = image(4, 4, (x, y, c) => (y * 4 + x) * 1000 + c * 100);
	const texel = (x: number, y: number): Vec3 => [0, 1, 2].map((c) => ((y * 4 + x) * 1000 + c * 100) / 65535) as Vec3;
	const expectVec = (actual: Vec3, expected: Vec3) => actual.forEach((v, i) => expect(v).toBeCloseTo(expected[i], 12));

	it('is exact at texel centers', () => {
		expectVec(sampleRepeat(img, 2.5, 1.5), texel(2, 1));
	});

	it('interpolates between texels and wraps around the edges', () => {
		const left = texel(3, 0);
		const right = texel(0, 0);
		expectVec(sampleRepeat(img, 0, 0.5), [0, 1, 2].map((c) => (left[c] + right[c]) / 2) as Vec3);
	});

	it('maps base pixels to detail texels when sizes match at tiling 1', () => {
		for (const [x, y] of [[0, 0], [3, 1], [2, 3]]) expectVec(sampleDetail(img, x, y, [4, 4], [1, 1], [0, 0]), texel(x, y));
	});

	it('shifts by the offset in detail UV units, wrapping', () => {
		expectVec(sampleDetail(img, 3, 0, [4, 4], [1, 1], [0.25, 0.5]), texel(0, 2));
	});

	it('scales with tiling against a different-size base', () => {
		// An 8×8 base with tiling 2 repeats the 4×4 detail twice, one detail texel per base pixel.
		expectVec(sampleDetail(img, 0, 0, [8, 8], [2, 2], [0, 0]), texel(0, 0));
		expectVec(sampleDetail(img, 5, 2, [8, 8], [2, 2], [0, 0]), texel(1, 2));
	});

	it('averages the texels a minified pixel covers', () => {
		// Tiling 2 on a same-size base: each base pixel covers a 2×2 block of detail texels.
		const block = [texel(2, 0), texel(3, 0), texel(2, 1), texel(3, 1)];
		const mean = [0, 1, 2].map((c) => block.reduce((sum, t) => sum + t[c], 0) / 4) as Vec3;
		expectVec(sampleDetail(img, 1, 0, [4, 4], [2, 2], [0, 0]), mean);
	});
});

describe('processRGBA16 with a detail map', () => {
	const [w, h] = [9, 7];
	const base = unitNormals(w, h, 3);
	const detailMap = unitNormals(w, h, 11);
	const flatBase = image(w, h, (_x, _y, c) => (c === 2 ? 65535 : c === 3 ? 4242 : 32768));
	const detail = (p: Partial<DetailParams>): DetailParams => ({
		strength: 1,
		flipInput: false,
		method: 'rnm',
		tiling: [1, 1],
		offset: [0, 0],
		...p
	});
	const run = (src: RGBA16Image, p: Partial<ProcessParams>) =>
		processRGBA16(src.data, params(p), { map: detailMap, baseWidth: w });
	const maxDiff = (a: Uint16Array, b: Uint16Array) => Math.max(...a.map((v, i) => Math.abs(v - b[i])));

	it('reproduces the detail on a flat base (rnm, whiteout)', () => {
		for (const method of ['rnm', 'whiteout'] as const) {
			const out = run(flatBase, { detail: detail({ method }) });
			for (let i = 0; i < out.length; i += 4) {
				for (let c = 0; c < 3; c++) expect(Math.abs(out[i + c] - detailMap.data[i + c])).toBeLessThanOrEqual(1);
			}
		}
	});

	it('leaves the base at detail strength 0 (all but linear)', () => {
		for (const method of ['rnm', 'whiteout', 'udn'] as const) {
			expect(maxDiff(run(base, { detail: detail({ method, strength: 0 }) }), base.data)).toBeLessThanOrEqual(1);
		}
	});

	it('reads a DirectX detail map with its Y flipped', () => {
		const out = run(flatBase, { detail: detail({ flipInput: true }) });
		for (let i = 0; i < out.length; i += 4) {
			expect(Math.abs(out[i + 1] - (65535 - detailMap.data[i + 1]))).toBeLessThanOrEqual(1);
		}
	});

	it('passes the base alpha through', () => {
		const out = run(flatBase, { detail: detail({ method: 'linear', tiling: [2.5, 0.5] }) });
		for (let i = 3; i < out.length; i += 4) expect(out[i]).toBe(4242);
	});

	it('ignores detail settings without a detail map, and vice versa', () => {
		const plain = processRGBA16(base.data, params({ strength: 2 }));
		expect(processRGBA16(base.data, params({ strength: 2, detail: detail({}) }))).toEqual(plain);
		expect(run(base, { strength: 2 })).toEqual(plain);
	});
});
