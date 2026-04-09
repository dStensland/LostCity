/**
 * Warped fBM noise — domain warping produces organic, marble-like patterns.
 * Based on Inigo Quilez's technique: f(p + fbm(p + fbm(p)))
 *
 * Uniforms:
 *   u_time       - elapsed seconds (auto-set by ShaderCanvas)
 *   u_resolution - canvas size in pixels (auto-set by ShaderCanvas)
 *   u_color1     - primary accent color (vec3, 0-1 range)
 *   u_color2     - secondary accent color (vec3, 0-1 range)
 *   u_speed      - animation speed multiplier (default 1.0)
 *   u_intensity  - brightness multiplier (default 1.0)
 */
export const WARPED_NOISE_FRAG = `#version 300 es
precision mediump float;
out vec4 fragColor;

uniform float u_time;
uniform vec2 u_resolution;
uniform vec3 u_color1;
uniform vec3 u_color2;
uniform float u_speed;
uniform float u_intensity;

float hash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
}

float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);

  float a = hash(i);
  float b = hash(i + vec2(1.0, 0.0));
  float c = hash(i + vec2(0.0, 1.0));
  float d = hash(i + vec2(1.0, 1.0));

  return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
}

float fbm(vec2 p) {
  float v = 0.0;
  float a = 0.5;
  vec2 shift = vec2(100.0);
  mat2 rot = mat2(cos(0.5), sin(0.5), -sin(0.5), cos(0.5));
  for (int i = 0; i < 5; i++) {
    v += a * noise(p);
    p = rot * p * 2.0 + shift;
    a *= 0.5;
  }
  return v;
}

void main() {
  vec2 uv = gl_FragCoord.xy / u_resolution;
  float t = u_time * u_speed * 0.15;

  vec2 p = uv * 3.0;
  float f1 = fbm(p + fbm(p + vec2(t * 0.7, t * 0.3)));
  float f2 = fbm(p + vec2(f1 * 1.5 + t * 0.2, f1 * 1.2 - t * 0.1));

  vec3 color = mix(u_color1, u_color2, f2);
  color *= f2 * f2 * u_intensity;

  float vig = 1.0 - 0.5 * length(uv - 0.5);
  color *= vig;

  fragColor = vec4(color, 1.0);
}
`;
