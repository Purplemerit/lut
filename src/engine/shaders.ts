export const QUAD_VERT = `#version 300 es
layout(location = 0) in vec2 aPos;
layout(location = 1) in vec2 aUv;
out vec2 vUv;
void main() {
  vUv = aUv;
  gl_Position = vec4(aPos, 0.0, 1.0);
}
`

export const LUT_FRAG = `#version 300 es
precision highp float;
precision highp sampler3D;
in vec2 vUv;
uniform sampler2D uVideo;
uniform sampler3D uLut;
uniform vec2 uUvScale;
uniform float uMirror;
uniform float uStrength;
uniform float uLutScale;
uniform float uLutOffset;
out vec4 fragColor;

void main() {
  vec2 videoUv = (vUv - 0.5) * uUvScale + 0.5;
  if (uMirror > 0.5) videoUv.x = 1.0 - videoUv.x;
  vec3 src = texture(uVideo, videoUv).rgb;
  vec3 lutUv = clamp(src, 0.0, 1.0) * uLutScale + uLutOffset;
  vec3 graded = texture(uLut, lutUv).rgb;
  fragColor = vec4(mix(src, graded, clamp(uStrength, 0.0, 1.0)), 1.0);
}
`
