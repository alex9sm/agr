// Base map (+ optional detail map) → output: input conventions, renormalize, strengths, blend, output convention.
// Mirrors processRGBA16 in normalmap.ts.

struct Params {
  strength: f32,
  flip_input: u32,
  flip_output: u32,
  has_detail: u32,
  detail_strength: f32,
  detail_flip: u32,
  method: u32,      // index into BLEND_METHODS: 0 rnm, 1 whiteout, 2 udn, 3 linear
  renormalize: u32,
  tiling: vec2f,
  offset: vec2f,
}

@group(0) @binding(0) var base: texture_2d<u32>;
@group(0) @binding(1) var dst: texture_storage_2d<rgba16uint, write>;
@group(0) @binding(2) var<uniform> params: Params;
@group(0) @binding(3) var detail: texture_2d<u32>; // 1×1 placeholder when has_detail is 0

const MIN_Z: f32 = 1e-4;
const MIN_LENGTH: f32 = 0.01;
const MAX_TAPS: f32 = 4.0;

// Scale the slope, keep the vector's length (see applyStrength in normalmap.ts).
fn apply_strength(n: vec3f, s: f32) -> vec3f {
  if (s == 1.0) { return n; }
  return normalize(vec3f(n.xy * s, max(n.z, MIN_Z))) * length(n);
}

// See renormalize in normalmap.ts.
fn renormalize(v: vec3f) -> vec3f {
  let len = length(v);
  if (len < MIN_LENGTH) { return vec3f(0.0, 0.0, 1.0); }
  return v / len;
}

fn to_hemisphere(v: vec3f) -> vec3f {
  return normalize(vec3f(v.xy, max(v.z, MIN_Z)));
}

// b, d: unit vectors with z > 0 (see blend in normalmap.ts).
fn blend(b: vec3f, d: vec3f) -> vec3f {
  switch params.method {
    case 0u: { // reoriented normal mapping
      let t = b + vec3f(0.0, 0.0, 1.0);
      let u = d * vec3f(-1.0, -1.0, 1.0);
      return normalize(t * (dot(t, u) / t.z) - u);
    }
    case 1u: { return normalize(vec3f(b.xy + d.xy, b.z * d.z)); } // whiteout
    case 2u: { return normalize(vec3f(b.xy + d.xy, b.z)); }       // UDN
    default: { return normalize(b + d); }                         // linear
  }
}

// The detail map under base pixel `id`, channels in [0, 1]: a grid of bilinear taps across the pixel's footprint.
fn sample_detail(id: vec2u, base_size: vec2f) -> vec3f {
  let size = vec2f(textureDimensions(detail));
  let p = fract((vec2f(id) + 0.5) / base_size * params.tiling + params.offset) * size;
  let footprint = abs(params.tiling) * size / base_size; // detail texels per base pixel
  let n = clamp(ceil(footprint), vec2f(1.0), vec2f(MAX_TAPS));
  var sum = vec3f(0.0);
  for (var j = 0.0; j < n.y; j += 1.0) {
    for (var i = 0.0; i < n.x; i += 1.0) {
      sum += sample_bilinear_repeat_px(detail, p + ((vec2f(i, j) + 0.5) / n - 0.5) * footprint).rgb;
    }
  }
  return sum / (n.x * n.y);
}

@compute @workgroup_size(8, 8)
fn main(@builtin(global_invocation_id) id: vec3u) {
  let size = textureDimensions(base);
  if (any(id.xy >= size)) { return; }

  let c = textureLoad(base, id.xy, 0);
  var n = decode_normal(c.rgb);
  if (params.flip_input != 0u) { n.y = -n.y; }
  if (params.renormalize != 0u) { n = renormalize(n); }
  n = apply_strength(n, params.strength);
  if (params.has_detail != 0u) {
    var d = sample_detail(id.xy, vec2f(size)) * 2.0 - 1.0;
    if (params.detail_flip != 0u) { d.y = -d.y; }
    d = apply_strength(to_hemisphere(d), params.detail_strength);
    n = blend(to_hemisphere(n), d);
  }
  if (params.flip_output != 0u) { n.y = -n.y; }
  textureStore(dst, id.xy, vec4<u32>(encode_normal(n), c.a));
}
