import type { BeautyParams, LookId } from '../types'

export const LOOKS: { id: LookId; label: string; strength: number }[] = [
  { id: 'original', label: 'Original', strength: 0 },
  { id: 'soft', label: 'Soft', strength: 0.85 },
  { id: 'glow', label: 'Glow', strength: 0.9 },
  { id: 'warm', label: 'Warm', strength: 0.8 },
  { id: 'rosy', label: 'Rosy', strength: 0.75 },
  { id: 'fade', label: 'Fade', strength: 0.85 },
  { id: 'cool', label: 'Cool', strength: 0.8 },
  { id: 'film', label: 'Film', strength: 0.85 },
]

export function paramsForLook(id: LookId): BeautyParams {
  const look = LOOKS.find((item) => item.id === id) ?? LOOKS[1]
  return { lookId: look.id, strength: look.strength }
}

export function lookLabel(id: LookId): string {
  return LOOKS.find((item) => item.id === id)?.label ?? 'Soft'
}
