// Shared WGSL, prepended to every shader by pipeline.ts.
// Image textures are rgba16uint (texture_2d<u32>): integer formats have no hardware filtering,
// so sampling between texels goes through the bilinear helpers below.

const U16_MAX: f32 = 65535.0;

// rgba16uint texel → [0, 1].
fn unpack_unorm(c: vec4<u32>) -> vec4f {
  return vec4f(c) / U16_MAX;
}

// [0, 1] → rgba16uint texel, rounded to nearest.
fn pack_unorm(v: vec4f) -> vec4<u32> {
  return vec4<u32>(round(clamp(v, vec4f(0.0), vec4f(1.0)) * U16_MAX));
}

// Encoded normal (0..65535 per channel) → vector in [-1, 1]. No renormalization.
fn decode_normal(c: vec3<u32>) -> vec3f {
  return vec3f(c) / U16_MAX * 2.0 - 1.0;
}

// Vector in [-1, 1] → encoded normal, rounded to nearest.
fn encode_normal(n: vec3f) -> vec3<u32> {
  return vec3<u32>(round(clamp(n * 0.5 + 0.5, vec3f(0.0), vec3f(1.0)) * U16_MAX));
}

fn load_unorm_repeat(tex: texture_2d<u32>, p: vec2<i32>, size: vec2<i32>) -> vec4f {
  return unpack_unorm(textureLoad(tex, ((p % size) + size) % size, 0));
}

fn load_unorm_clamp(tex: texture_2d<u32>, p: vec2<i32>, size: vec2<i32>) -> vec4f {
  return unpack_unorm(textureLoad(tex, clamp(p, vec2<i32>(0), size - 1), 0));
}

// Bilinear sample at p in texel units (texel i spans [i, i + 1), center at i + 0.5), wrapping at the edges.
// Exact at texel centers.
fn sample_bilinear_repeat_px(tex: texture_2d<u32>, p: vec2f) -> vec4f {
  let size = vec2<i32>(textureDimensions(tex));
  let q = p - 0.5;
  let i = vec2<i32>(floor(q));
  let f = q - floor(q);
  let a = load_unorm_repeat(tex, i, size);
  let b = load_unorm_repeat(tex, i + vec2<i32>(1, 0), size);
  let c = load_unorm_repeat(tex, i + vec2<i32>(0, 1), size);
  let d = load_unorm_repeat(tex, i + vec2<i32>(1, 1), size);
  return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
}

// As above, clamping at the edges.
fn sample_bilinear_clamp_px(tex: texture_2d<u32>, p: vec2f) -> vec4f {
  let size = vec2<i32>(textureDimensions(tex));
  let q = p - 0.5;
  let i = vec2<i32>(floor(q));
  let f = q - floor(q);
  let a = load_unorm_clamp(tex, i, size);
  let b = load_unorm_clamp(tex, i + vec2<i32>(1, 0), size);
  let c = load_unorm_clamp(tex, i + vec2<i32>(0, 1), size);
  let d = load_unorm_clamp(tex, i + vec2<i32>(1, 1), size);
  return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
}

// uv in [0, 1] versions. Converting to texels costs f32 precision on big textures (about 1/16000 of a
// texel at 1000 px), so prefer the _px versions when texel coordinates are at hand.
fn sample_bilinear_repeat(tex: texture_2d<u32>, uv: vec2f) -> vec4f {
  return sample_bilinear_repeat_px(tex, uv * vec2f(textureDimensions(tex)));
}

fn sample_bilinear_clamp(tex: texture_2d<u32>, uv: vec2f) -> vec4f {
  return sample_bilinear_clamp_px(tex, uv * vec2f(textureDimensions(tex)));
}
