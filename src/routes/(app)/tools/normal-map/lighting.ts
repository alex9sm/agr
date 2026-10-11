// Light direction math for the lit view: the renderer's light vectors and the Light tool's dome.
// Directions are in working space (OpenGL convention): +X right, +Y up the image, +Z out of the surface.
// Azimuth is degrees counter-clockwise from +X (90° = light from the top of the image); elevation is degrees above
// the surface (90° = straight overhead).
import type { Vec3 } from './normalmap';

export interface Light {
	azimuth: number;
	elevation: number;
}

const RAD = Math.PI / 180;

/** Angle in degrees wrapped to [0, 360). */
export const wrapDegrees = (a: number) => ((a % 360) + 360) % 360;

/** Unit vector toward the light. */
export function lightVector({ azimuth, elevation }: Light): Vec3 {
	const a = azimuth * RAD;
	const e = elevation * RAD;
	return [Math.cos(e) * Math.cos(a), Math.cos(e) * Math.sin(a), Math.sin(e)];
}

/** Blinn-Phong half vector for a viewer looking straight down at the surface (view direction +Z). */
export function halfVector(light: Light): Vec3 {
	const [x, y, z] = lightVector(light);
	const length = Math.hypot(x, y, z + 1); // > 0 for any elevation above -90°
	return [x / length, y / length, (z + 1) / length];
}

/** Horizon radius of the Light tool's dome in a viewer of this size, in the same units. */
export const domeRadius = (width: number, height: number) => Math.max(1, 0.45 * Math.min(width, height));

/**
 * The Light tool's dome: the viewer shows a hemisphere from above, centered in the viewer, with its horizon on a
 * circle of `radius`. Distance from the center maps linearly to elevation (center 90°, circle 0°), so low, grazing
 * angles get as much room as steep ones. `dx`, `dy` are screen offsets from the center (y down); points outside the
 * circle clamp to the horizon. Returns whole degrees.
 */
export function lightAtPoint(dx: number, dy: number, radius: number): Light {
	const r = Math.min(1, Math.hypot(dx, dy) / radius);
	return {
		azimuth: wrapDegrees(Math.round(Math.atan2(-dy, dx) / RAD)),
		elevation: Math.round(90 * (1 - r))
	};
}

/** Inverse of lightAtPoint: the light's position on the dome as a screen offset from the center (y down). */
export function pointOfLight({ azimuth, elevation }: Light, radius: number): [number, number] {
	const r = (1 - elevation / 90) * radius;
	return [r * Math.cos(azimuth * RAD), -r * Math.sin(azimuth * RAD)];
}
