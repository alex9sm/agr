// GPU round trip check: upload → compute pass through common.wgsl → readback, compared bit for bit.
// Tools include it in their diagnostics; from a dev console:
//   const { gpuSelfTest } = await import('/src/lib/gpu/selftest.ts'); await gpuSelfTest();
import { toRGBA16 } from '$lib/image/convert';
import type { ImageBuffer } from '$lib/image/types';
import { initGpu } from './device';
import { bindGroup, computePipeline, createShader, workgroupCount } from './pipeline';
import { readImageTexture } from './readback';
import { createImageTexture, uploadImage } from './textures';

// MODE 0: unpack/pack. MODE 1: normal decode/encode. MODE 2: bilinear sample at texel centers.
// All three must reproduce the input exactly.
const SHADER = /* wgsl */ `
override MODE: u32 = 0;
@group(0) @binding(0) var src: texture_2d<u32>;
@group(0) @binding(1) var dst: texture_storage_2d<rgba16uint, write>;

@compute @workgroup_size(8, 8)
fn main(@builtin(global_invocation_id) id: vec3u) {
  let size = textureDimensions(src);
  if (any(id.xy >= size)) { return; }
  let c = textureLoad(src, id.xy, 0);
  var out: vec4<u32>;
  if (MODE == 0u) {
    out = pack_unorm(unpack_unorm(c));
  } else if (MODE == 1u) {
    out = vec4<u32>(encode_normal(decode_normal(c.rgb)), c.a);
  } else {
    out = pack_unorm(sample_bilinear_repeat_px(src, vec2f(id.xy) + 0.5));
  }
  textureStore(dst, id.xy, out);
}`;

/** Deterministic 16-bit RGBA noise with odd dimensions (exercises row padding). */
function testImage(width = 67, height = 33): ImageBuffer {
	const data = new Uint16Array(width * height * 4);
	let s = 12345;
	for (let i = 0; i < data.length; i++) {
		s = (s * 1103515245 + 12345) >>> 0;
		data[i] = s >>> 16;
	}
	data.set([0, 0, 0, 0, 65535, 65535, 65535, 65535], 0); // extremes
	return { width, height, channels: 4, bitDepth: 16, data };
}

export async function gpuSelfTest(image = testImage()) {
	const init = await initGpu();
	if (!init.ok) return { ok: false, error: init.message };
	const { device } = init;
	try {
		const module = await createShader(device, SHADER, 'selftest');
		const src = uploadImage(device, image, 'selftest src');
		const expected = toRGBA16(image);
		const results: Record<string, number> = {};
		for (const [mode, name] of ['unpack/pack', 'normal decode/encode', 'bilinear at centers'].entries()) {
			const pipeline = await computePipeline(device, module, `selftest ${name}`, { MODE: mode });
			const dst = createImageTexture(
				device,
				image.width,
				image.height,
				'selftest dst',
				GPUTextureUsage.STORAGE_BINDING | GPUTextureUsage.COPY_SRC
			);
			const encoder = device.createCommandEncoder();
			const pass = encoder.beginComputePass();
			pass.setPipeline(pipeline);
			pass.setBindGroup(0, bindGroup(device, pipeline, [src.createView(), dst.createView()]));
			pass.dispatchWorkgroups(...workgroupCount(image.width, image.height));
			pass.end();
			device.queue.submit([encoder.finish()]);
			const actual = await readImageTexture(device, dst);
			results[name] = actual.reduce((n, v, i) => n + (v === expected[i] ? 0 : 1), 0);
			dst.destroy();
		}
		const direct = await readImageTexture(device, src);
		results['upload/readback'] = direct.reduce((n, v, i) => n + (v === expected[i] ? 0 : 1), 0);
		return { ok: Object.values(results).every((n) => n === 0), adapter: init.adapterName, mismatches: results };
	} finally {
		init.destroy();
	}
}
