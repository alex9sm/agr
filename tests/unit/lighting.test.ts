import { describe, expect, it } from 'vitest';
import {
	domeRadius,
	halfVector,
	lightAtPoint,
	lightVector,
	pointOfLight,
	wrapDegrees,
	type Light
} from '../../src/routes/(app)/tools/normal-map/lighting';
import type { Vec3 } from '../../src/routes/(app)/tools/normal-map/normalmap';

const expectVec = (actual: Vec3, expected: Vec3) => actual.forEach((v, i) => expect(v).toBeCloseTo(expected[i], 12));

describe('wrapDegrees', () => {
	it('wraps into [0, 360)', () => {
		expect([0, 5, 360, 365, -5, -360, 719].map(wrapDegrees)).toEqual([0, 5, 0, 5, 355, 0, 359]);
	});
});

describe('lightVector', () => {
	it('follows the working-space axes', () => {
		expectVec(lightVector({ azimuth: 0, elevation: 0 }), [1, 0, 0]); // from the right
		expectVec(lightVector({ azimuth: 90, elevation: 0 }), [0, 1, 0]); // from the top of the image (+Y up)
		expectVec(lightVector({ azimuth: 180, elevation: 0 }), [-1, 0, 0]);
		expectVec(lightVector({ azimuth: 123, elevation: 90 }), [0, 0, 1]); // overhead, whatever the azimuth
	});

	it('is a unit vector at the requested elevation', () => {
		const v = lightVector({ azimuth: 135, elevation: 30 });
		expect(Math.hypot(...v)).toBeCloseTo(1, 12);
		expect(Math.asin(v[2]) * (180 / Math.PI)).toBeCloseTo(30, 10);
	});
});

describe('halfVector', () => {
	it('is the unit bisector of the light and the view direction (+Z)', () => {
		for (const light of [
			{ azimuth: 135, elevation: 45 },
			{ azimuth: 10, elevation: 0 },
			{ azimuth: 250, elevation: 80 }
		]) {
			const l = lightVector(light);
			const h = halfVector(light);
			expect(Math.hypot(...h)).toBeCloseTo(1, 12);
			const toLight = h[0] * l[0] + h[1] * l[1] + h[2] * l[2];
			expect(toLight).toBeCloseTo(h[2], 12); // equal angles to L and to (0, 0, 1)
		}
	});

	it('points straight up for an overhead light', () => {
		expectVec(halfVector({ azimuth: 0, elevation: 90 }), [0, 0, 1]);
	});
});

describe('Light tool dome', () => {
	const R = 200;

	it('puts overhead at the center and the horizon on the circle', () => {
		expect(lightAtPoint(0, 0, R).elevation).toBe(90);
		expect(lightAtPoint(R, 0, R)).toEqual({ azimuth: 0, elevation: 0 });
		expect(lightAtPoint(R / 2, 0, R).elevation).toBe(45); // linear in distance
	});

	it('reads azimuth counter-clockwise from the right, with screen y down', () => {
		expect(lightAtPoint(0, -R, R).azimuth).toBe(90); // above the center: light from the top
		expect(lightAtPoint(-R, 0, R).azimuth).toBe(180);
		expect(lightAtPoint(0, R, R).azimuth).toBe(270);
		expect(lightAtPoint(-R / 2, -R / 2, R).azimuth).toBe(135);
	});

	it('clamps points outside the circle to the horizon', () => {
		expect(lightAtPoint(0, -3 * R, R)).toEqual({ azimuth: 90, elevation: 0 });
	});

	it('returns whole degrees', () => {
		const { azimuth, elevation } = lightAtPoint(37.3, -81.9, R);
		expect(Number.isInteger(azimuth) && Number.isInteger(elevation)).toBe(true);
	});

	it('pointOfLight is its inverse', () => {
		for (let azimuth = 0; azimuth < 360; azimuth += 15) {
			for (const elevation of [0, 10, 45, 89]) {
				const light: Light = { azimuth, elevation };
				expect(lightAtPoint(...pointOfLight(light, R), R)).toEqual(light);
			}
		}
	});

	it('fits the dome inside the viewer', () => {
		expect(domeRadius(800, 400)).toBeLessThan(200);
		expect(domeRadius(0, 0)).toBeGreaterThan(0); // never divides by zero
	});
});
