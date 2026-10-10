// Base map → output: input convention, strength, output convention. Mirrors processRGBA16 in normalmap.ts.

struct Params {
  strength: f32,
  flip_input: u32,
  flip_output: u32,
  _pad: u32,
}

@group(0) @binding(0) var base: texture_2d<u32>;
@group(0) @binding(1) var dst: texture_storage_2d<rgba16uint, write>;
@group(0) @binding(2) var<uniform> params: Params;

const MIN_Z: f32 = 1e-4;

@compute @workgroup_size(8, 8)
fn main(@builtin(global_invocation_id) id: vec3u) {
  let size = textureDimensions(base);
  if (any(id.xy >= size)) { return; }

  let c = textureLoad(base, id.xy, 0);
  var n = decode_normal(c.rgb);
  if (params.flip_input != 0u) { n.y = -n.y; }
  if (params.strength != 1.0) {
    // Scale the slope, keep the vector's length (see applyStrength in normalmap.ts).
    n = normalize(vec3f(n.xy * params.strength, max(n.z, MIN_Z))) * length(n);
  }
  if (params.flip_output != 0u) { n.y = -n.y; }
  textureStore(dst, id.xy, vec4<u32>(encode_normal(n), c.a));
}
