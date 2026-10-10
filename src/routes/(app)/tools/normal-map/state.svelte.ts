// Normal Map Editor state. `Settings` change the output (and will be undoable); `View` only changes the display.

export type Convention = 'opengl' | 'directx';
export type BlendMethod = 'rnm' | 'whiteout' | 'udn' | 'linear';
export type LayerId = 'output' | 'base' | 'detail';

export interface Settings {
	base: { convention: Convention; strength: number };
	detail: {
		convention: Convention;
		strength: number;
		method: BlendMethod;
		tiling: [number, number];
		offset: [number, number];
	} | null;
	output: { convention: Convention; format: 'png' | 'tga'; bitDepth: 8 | 16 };
}

export interface View {
	mode: 'wipe' | 'lit' | 'raw';
	/** Divider position across the viewer, 0..1; lit on the left. */
	wipe: number;
	light: { azimuth: number; elevation: number };
	zoom: number;
	pan: [number, number];
	channel: 'rgb' | 'r' | 'g' | 'b' | 'a';
	tile3x3: boolean;
	tool: 'pan' | 'light';
}

export const defaultSettings = (): Settings => ({
	base: { convention: 'opengl', strength: 1 },
	detail: null,
	output: { convention: 'opengl', format: 'png', bitDepth: 16 }
});

export const defaultView = (): View => ({
	mode: 'wipe',
	wipe: 0.5,
	light: { azimuth: 135, elevation: 45 },
	zoom: 1,
	pan: [0, 0],
	channel: 'rgb',
	tile3x3: false,
	tool: 'pan'
});

/** Zoom presets, as in classic image viewers. */
export const ZOOM_STEPS = [1 / 16, 1 / 8, 1 / 4, 1 / 3, 1 / 2, 2 / 3, 1, 1.5, 2, 3, 4, 6, 8, 16, 32];

export class NormalMapState {
	settings = $state(defaultSettings());
	view = $state(defaultView());
	/** Node selected in the Layers tree; picks what the property grid shows. */
	layer = $state<LayerId>('output');

	resetSettings() {
		this.settings = defaultSettings();
	}

	zoomIn() {
		this.view.zoom = ZOOM_STEPS.find((z) => z > this.view.zoom * 1.001) ?? this.view.zoom;
	}

	zoomOut() {
		this.view.zoom = ZOOM_STEPS.findLast((z) => z < this.view.zoom * 0.999) ?? this.view.zoom;
	}

	zoomActual() {
		this.view.zoom = 1;
		this.view.pan = [0, 0];
	}

	/** Fit needs an image size; until images load (Phase 3) it means 100%. */
	zoomFit() {
		this.zoomActual();
	}
}
