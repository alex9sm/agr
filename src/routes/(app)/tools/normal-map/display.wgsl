// Output texture → canvas, raw (no color conversion). Zoom and pan map canvas pixels to image pixels:
// nearest neighbor at 100% and above, a box filter of bilinear taps below.

struct View {
  canvas: vec2f, // device pixels
  image: vec2f,  // image pixels
  pan: vec2f,    // view center relative to the image center, in image pixels
  zoom: f32,     // device pixels per image pixel
  _pad: f32,
}

@group(0) @binding(0) var img: texture_2d<u32>;
@group(0) @binding(1) var<uniform> view: View;

const BACKGROUND = vec3f(0.502); // Win2000 app workspace gray

@vertex
fn vs(@builtin(vertex_index) i: u32) -> @builtin(position) vec4f {
  // One triangle covering the screen.
  let p = vec2f(f32((i << 1u) & 2u), f32(i & 2u));
  return vec4f(p * 2.0 - 1.0, 0.0, 1.0);
}

@fragment
fn fs(@builtin(position) frag: vec4f) -> @location(0) vec4f {
  // Image position of this pixel's center; texel i spans [i, i + 1).
  let p = (frag.xy - view.canvas * 0.5) / view.zoom + view.image * 0.5 + view.pan;
  if (any(p < vec2f(0.0)) || any(p >= view.image)) {
    return vec4f(BACKGROUND, 1.0);
  }

  if (view.zoom >= 1.0) {
    return vec4f(unpack_unorm(textureLoad(img, vec2<i32>(floor(p)), 0)).rgb, 1.0);
  }

  // Zoomed out: average up to 4×4 bilinear taps across the pixel's footprint.
  let footprint = 1.0 / view.zoom;
  let n = min(ceil(footprint), 4.0);
  var sum = vec3f(0.0);
  for (var j = 0.0; j < n; j += 1.0) {
    for (var i = 0.0; i < n; i += 1.0) {
      let q = p + ((vec2f(i, j) + 0.5) / n - 0.5) * footprint;
      sum += sample_bilinear_clamp_px(img, q).rgb;
    }
  }
  return vec4f(sum / (n * n), 1.0);
}
