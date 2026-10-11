// Output texture → canvas. Left of the split: the surface lit by one directional light, sRGB-encoded for display.
// Right of it: the raw output values, no color conversion.
// Lit shades the output values as an OpenGL (Y+) map, i.e. as written to the file, so Flip G and the conventions
// show in it: a flipped map looks like dents where the original has bumps.
// Zoom and pan map canvas pixels to image pixels. At 100% and above, raw is nearest neighbor (to inspect pixels) and
// lit interpolates normals bilinearly (as an engine's sampler would). Below 100%, both average a box of bilinear taps.

struct View {
  canvas: vec2f,      // device pixels
  image: vec2f,       // image pixels
  pan: vec2f,         // view center relative to the image center, in image pixels
  zoom: f32,          // device pixels per image pixel
  split: f32,         // canvas x in device pixels: lit to the left, raw to the right
  light: vec3f,       // unit vector toward the light, working space
  _pad: f32,
  half_vector: vec3f, // Blinn-Phong half vector, viewer straight above
  shininess: f32,     // highlight exponent; 0 = no highlight
}

@group(0) @binding(0) var img: texture_2d<u32>;
@group(0) @binding(1) var<uniform> view: View;

const BACKGROUND = vec3f(0.502); // Win2000 app workspace gray

// Lit surface: gray material, linear values.
const ALBEDO: f32 = 0.6;
const AMBIENT: f32 = 0.15;
const SPECULAR: f32 = 0.4;

@vertex
fn vs(@builtin(vertex_index) i: u32) -> @builtin(position) vec4f {
  // One triangle covering the screen.
  let p = vec2f(f32((i << 1u) & 2u), f32(i & 2u));
  return vec4f(p * 2.0 - 1.0, 0.0, 1.0);
}

// Linear shading of an encoded normal sample ([0, 1] per channel).
fn shade(c: vec4f) -> f32 {
  var n = c.rgb * 2.0 - 1.0;
  let len = length(n);
  n = select(vec3f(0.0, 0.0, 1.0), n / len, len > 1e-6);
  let n_dot_l = dot(n, view.light);
  var color = ALBEDO * (AMBIENT + max(n_dot_l, 0.0));
  if (view.shininess > 0.0 && n_dot_l > 0.0) {
    color += SPECULAR * pow(max(dot(n, view.half_vector), 0.0), view.shininess);
  }
  return color;
}

fn linear_to_srgb(c: vec3f) -> vec3f {
  let x = clamp(c, vec3f(0.0), vec3f(1.0));
  return select(1.055 * pow(x, vec3f(1.0 / 2.4)) - 0.055, x * 12.92, x <= vec3f(0.0031308));
}

@fragment
fn fs(@builtin(position) frag: vec4f) -> @location(0) vec4f {
  // Image position of this pixel's center; texel i spans [i, i + 1).
  let p = (frag.xy - view.canvas * 0.5) / view.zoom + view.image * 0.5 + view.pan;
  if (any(p < vec2f(0.0)) || any(p >= view.image)) {
    return vec4f(BACKGROUND, 1.0);
  }
  let lit = frag.x < view.split;

  if (view.zoom >= 1.0) {
    if (lit) {
      return vec4f(linear_to_srgb(vec3f(shade(sample_bilinear_clamp_px(img, p)))), 1.0);
    }
    return vec4f(unpack_unorm(textureLoad(img, vec2<i32>(floor(p)), 0)).rgb, 1.0);
  }

  // Zoomed out: average up to 4×4 bilinear taps across the pixel's footprint. Lit averages the shading, not the
  // normals, so fine bumps still read as texture instead of flattening out.
  let footprint = 1.0 / view.zoom;
  let n = min(ceil(footprint), 4.0);
  var sum = vec3f(0.0);
  for (var j = 0.0; j < n; j += 1.0) {
    for (var i = 0.0; i < n; i += 1.0) {
      let q = p + ((vec2f(i, j) + 0.5) / n - 0.5) * footprint;
      let c = sample_bilinear_clamp_px(img, q);
      if (lit) {
        sum += vec3f(shade(c));
      } else {
        sum += c.rgb;
      }
    }
  }
  let average = sum / (n * n);
  if (lit) {
    return vec4f(linear_to_srgb(average), 1.0);
  }
  return vec4f(average, 1.0);
}
