// Adapted from bluesky-social/social-app@4e4ad9c (MIT) - src/lib/numbers.ts
export function clamp(v: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, v))
}
