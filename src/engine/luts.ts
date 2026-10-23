import type { LookId } from '../types'

export const LUT_SIZE = 32

type Rgb = [number, number, number]
type Grade = (r: number, g: number, b: number) => Rgb

export function bakeLut(grade: Grade): Uint8Array {
  const size = LUT_SIZE
  const data = new Uint8Array(size * size * size * 4)
  let offset = 0
  for (let b = 0; b < size; b++) {
    const blue = b / (size - 1)
    for (let g = 0; g < size; g++) {
      const green = g / (size - 1)
      for (let r = 0; r < size; r++) {
        const [outR, outG, outB] = grade(r / (size - 1), green, blue)
        data[offset++] = toByte(outR)
        data[offset++] = toByte(outG)
        data[offset++] = toByte(outB)
        data[offset++] = 255
      }
    }
  }
  return data
}

export const LUT_GRADES: Record<LookId, Grade> = {
  original: (r, g, b) => [r, g, b],
  soft: (r, g, b) => finish(warm(saturate(lift(contrast([r, g, b], 0.86), 0.07), 0.9), 0.04)),
  glow: (r, g, b) => {
    const y = luma(r, g, b)
    const mid = Math.sin(clamp01(y) * Math.PI)
    let color = lift([r, g, b], mid * 0.1)
    const highlight = smoothstep(0.5, 1, y)
    color = mix(color, warm(color, 0.05), highlight * 0.65)
    return finish(saturate(color, 0.88))
  },
  warm: (r, g, b) => finish(saturate(warm(contrast([r, g, b], 1.05), 0.08), 1.06)),
  rosy: (r, g, b) => {
    const mid = Math.sin(clamp01(luma(r, g, b)) * Math.PI)
    return finish(saturate([r + mid * 0.08, g - mid * 0.012, b + mid * 0.03], 0.94))
  },
  fade: (r, g, b) => finish(warm(saturate([r, g, b].map((channel) => channel * 0.76 + 0.14) as Rgb, 0.72), 0.025)),
  cool: (r, g, b) => {
    const shadow = 1 - smoothstep(0.12, 0.72, luma(r, g, b))
    const shifted: Rgb = [r - shadow * 0.035, g, b + shadow * 0.07]
    return finish(saturate(contrast(shifted, 1.03), 0.84))
  },
  film: (r, g, b) => {
    const curved = ([r, g, b] as Rgb).map((channel) => {
      const x = clamp01(channel)
      const s = x * x * (3 - 2 * x)
      return x * 0.62 + s * 0.38
    }) as Rgb
    const y = luma(curved[0], curved[1], curved[2])
    const shadow = 1 - smoothstep(0.15, 0.55, y)
    const highlight = smoothstep(0.45, 0.92, y)
    const split: Rgb = [
      curved[0] + highlight * 0.045,
      curved[1] + shadow * 0.03,
      curved[2] + shadow * 0.028 - highlight * 0.015,
    ]
    return finish(saturate(split, 0.8).map((channel) => channel * 0.9 + 0.05) as Rgb)
  },
}

function finish(color: Rgb): Rgb {
  return [clamp01(color[0]), clamp01(color[1]), clamp01(color[2])]
}

function contrast(color: Rgb, amount: number): Rgb {
  return color.map((channel) => (channel - 0.5) * amount + 0.5) as Rgb
}

function lift(color: Rgb, amount: number): Rgb {
  return color.map((channel) => channel + (1 - channel) * amount) as Rgb
}

function saturate(color: Rgb, amount: number): Rgb {
  const y = luma(color[0], color[1], color[2])
  return color.map((channel) => y + (channel - y) * amount) as Rgb
}

function warm(color: Rgb, amount: number): Rgb {
  return [color[0] + amount, color[1] + amount * 0.12, color[2] - amount * 0.85]
}

function mix(a: Rgb, b: Rgb, t: number): Rgb {
  return [
    a[0] + (b[0] - a[0]) * t,
    a[1] + (b[1] - a[1]) * t,
    a[2] + (b[2] - a[2]) * t,
  ]
}

function luma(r: number, g: number, b: number) {
  return r * 0.2126 + g * 0.7152 + b * 0.0722
}

function smoothstep(edge0: number, edge1: number, value: number) {
  const t = clamp01((value - edge0) / (edge1 - edge0))
  return t * t * (3 - 2 * t)
}

function clamp01(value: number) {
  return Math.min(1, Math.max(0, value))
}

function toByte(value: number) {
  return Math.round(clamp01(value) * 255)
}
